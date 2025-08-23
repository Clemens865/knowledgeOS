/**
 * BasicPatternPlugin - Simple pattern matching from YAML rules
 */

import {
  KnowledgePlugin,
  IProcessor,
  Context,
  ProcessResult,
  FileOperation,
  PluginAPI
} from '../../core/interfaces';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface PatternRule {
  name: string;
  pattern: string;
  action: 'append' | 'create' | 'update' | 'extract';
  target?: string;
  template?: string;
  priority?: number;
}

interface RulesConfig {
  version: number;
  rules: PatternRule[];
}

export class BasicPatternPlugin implements KnowledgePlugin {
  name = 'basic-patterns';
  version = '1.0.0';
  description = 'Simple pattern matching and extraction from YAML rules';
  
  private rules: PatternRule[] = [];
  private api: PluginAPI;
  private rulesPath: string;

  constructor(api: PluginAPI, rulesPath?: string) {
    this.api = api;
    this.rulesPath = rulesPath || path.join(process.cwd(), 'knowledge-rules.yaml');
  }

  processor: IProcessor = {
    name: 'BasicPatternProcessor',
    priority: 10,
    
    canProcess: () => {
      // Always process if we have rules
      return this.rules.length > 0;
    },
    
    process: async (content: string, _context: Context): Promise<ProcessResult> => {
      const operations: FileOperation[] = [];
      const extractedData: Record<string, string[]> = {};
      
      for (const rule of this.rules) {
        try {
          const regex = new RegExp(rule.pattern, 'gm');
          const matches = Array.from(content.matchAll(regex));
          
          if (matches.length === 0) continue;
          
          for (const match of matches) {
            const extracted = match[1] || match[0];
            
            // Store extracted data
            if (rule.action === 'extract') {
              if (!extractedData[rule.name]) {
                extractedData[rule.name] = [];
              }
              extractedData[rule.name].push(extracted);
              continue;
            }
            
            // Process target path
            let targetPath = rule.target || '';
            targetPath = this.interpolate(targetPath, {
              date: new Date().toISOString().split('T')[0],
              time: new Date().toISOString().split('T')[1].split('.')[0],
              year: new Date().getFullYear().toString(),
              month: (new Date().getMonth() + 1).toString().padStart(2, '0'),
              day: new Date().getDate().toString().padStart(2, '0'),
              match: extracted,
              ...this.extractNamedGroups(match)
            });
            
            // Process content
            let contentToWrite = extracted;
            if (rule.template) {
              contentToWrite = this.interpolate(rule.template, {
                match: extracted,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toISOString(),
                ...this.extractNamedGroups(match)
              });
            }
            
            // Create operation
            switch (rule.action) {
              case 'append':
                operations.push({
                  type: 'append',
                  path: targetPath,
                  content: `\n${contentToWrite}`
                });
                break;
              
              case 'create':
                operations.push({
                  type: 'create',
                  path: targetPath,
                  content: contentToWrite
                });
                break;
              
              case 'update':
                operations.push({
                  type: 'update',
                  path: targetPath,
                  content: contentToWrite
                });
                break;
            }
          }
        } catch (error) {
          console.error(`Error processing rule ${rule.name}:`, error);
        }
      }
      
      return {
        content,
        operations,
        suggestions: [],
        metadata: { extracted: extractedData }
      };
    }
  };

  async onActivate(): Promise<void> {
    await this.loadRules();
    
    // Watch rules file for changes
    if (await this.fileExists(this.rulesPath)) {
      this.api.files.watch(this.rulesPath, async (event) => {
        if (event === 'change') {
          console.log('Rules file changed, reloading...');
          await this.loadRules();
        }
      });
    }
  }

  async onDeactivate(): Promise<void> {
    this.rules = [];
  }

  private async loadRules(): Promise<void> {
    try {
      if (!await this.fileExists(this.rulesPath)) {
        console.log('No rules file found, creating default...');
        await this.createDefaultRules();
      }
      
      const content = await this.api.files.read(this.rulesPath);
      const config = yaml.load(content) as RulesConfig;
      
      if (config && config.rules) {
        this.rules = config.rules.sort((a, b) => 
          (b.priority || 0) - (a.priority || 0)
        );
        console.log(`Loaded ${this.rules.length} pattern rules`);
      } else {
        this.rules = [];
        console.warn('No rules found in configuration');
      }
    } catch (error) {
      console.error('Error loading rules:', error);
      this.rules = [];
    }
  }

  private async createDefaultRules(): Promise<void> {
    const defaultRules: RulesConfig = {
      version: 1,
      rules: [
        {
          name: "Extract Tasks",
          pattern: "TODO:\\s*(.+)",
          action: "append",
          target: "tasks/inbox.md",
          template: "- [ ] {{match}} ({{date}})",
          priority: 10
        },
        {
          name: "Track Meetings",
          pattern: "Meeting with ([\\w\\s]+) about (.+)",
          action: "create",
          target: "meetings/{{date}}-{{1}}.md",
          template: "# Meeting with {{1}}\n\nDate: {{date}}\nTopic: {{2}}\n\n## Notes\n{{match}}",
          priority: 9
        },
        {
          name: "Personal Preferences",
          pattern: "I (?:like|love|prefer|enjoy)\\s+(.+)",
          action: "append",
          target: "personal/preferences.md",
          template: "- {{match}} (noted on {{date}})",
          priority: 8
        },
        {
          name: "Decisions",
          pattern: "(?:Decided|Decision):\\s*(.+)",
          action: "append",
          target: "decisions/{{year}}-{{month}}.md",
          template: "## {{date}}\n{{match}}\n",
          priority: 7
        },
        {
          name: "Learning",
          pattern: "(?:TIL|I learned|Learned):\\s*(.+)",
          action: "append",
          target: "learning/til.md",
          template: "### {{date}}\n{{match}}\n",
          priority: 6
        }
      ]
    };
    
    const yamlContent = yaml.dump(defaultRules, { 
      indent: 2,
      lineWidth: -1 
    });
    
    await this.api.files.write(this.rulesPath, yamlContent);
    console.log('Created default rules file');
  }

  private interpolate(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  private extractNamedGroups(match: RegExpMatchArray): Record<string, string> {
    const groups: Record<string, string> = {};
    for (let i = 1; i < match.length; i++) {
      if (match[i]) {
        groups[i.toString()] = match[i];
      }
    }
    return groups;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}