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
    this.rulesPath = rulesPath || 'knowledge-rules.yaml';
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
      // TODO: Parse YAML/JSON content when available
      // For now, just use default rules
      try {
        const config = JSON.parse(content) as RulesConfig;
        if (config && config.rules) {
          this.rules = config.rules.sort((a, b) => 
            (b.priority || 0) - (a.priority || 0)
          );
          console.log(`Loaded ${this.rules.length} pattern rules`);
        } else {
          this.rules = this.getDefaultRulesArray();
        }
      } catch {
        // If parsing fails, use default rules
        this.rules = this.getDefaultRulesArray();
      }
    } catch (error) {
      console.error('Error loading rules:', error);
      this.rules = [];
    }
  }

  private getDefaultRulesArray(): PatternRule[] {
    return [
      {
        name: 'Extract TODOs',
        pattern: 'TODO:\s*(.+)',
        action: 'append',
        target: 'todos/${year}-${month}-${day}.md',
        template: '- [ ] ${match}',
        priority: 10
      },
      {
        name: 'Meeting Notes',
        pattern: '@meeting\s+"([^"]+)"\s+(.+)',
        action: 'create',
        target: 'meetings/${year}/${month}/${1}.md',
        template: '# Meeting: ${1}\n\nDate: ${date}\nTime: ${time}\n\n## Notes\n${2}',
        priority: 20
      },
      {
        name: 'Extract Questions',
        pattern: '\?\?\s*(.+)',
        action: 'extract',
        priority: 5
      }
    ];
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
    
    // Write as JSON for now
    const jsonContent = JSON.stringify(defaultRules, null, 2);
    await this.api.files.write(this.rulesPath, jsonContent);
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
      // Use the plugin API to check if file exists
      await this.api.files.read(filePath);
      return true;
    } catch {
      return false;
    }
  }
}