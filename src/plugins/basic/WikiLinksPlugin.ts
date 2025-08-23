/**
 * WikiLinksPlugin - Parse and handle [[wiki-style]] links
 */

import {
  KnowledgePlugin,
  IProcessor,
  IEnhancer,
  Context,
  ProcessResult,
  Enhancement,
  PluginAPI,
  ICommand
} from '../../core/interfaces';
import * as path from 'path';

interface WikiLink {
  raw: string;           // Full match including brackets
  target: string;        // The link target
  alias?: string;        // Optional display text
  position: number;      // Position in text
  exists?: boolean;      // Whether target file exists
}

interface BacklinkData {
  source: string;        // File containing the link
  target: string;        // File being linked to
  context: string;       // Surrounding text
  line: number;         // Line number in source
}

export class WikiLinksPlugin implements KnowledgePlugin {
  name = 'wiki-links';
  version = '1.0.0';
  description = 'Parse [[wiki-links]] and manage backlinks';
  
  private api: PluginAPI;
  private backlinks: Map<string, BacklinkData[]> = new Map();
  private linkIndex: Map<string, WikiLink[]> = new Map();

  constructor(api: PluginAPI) {
    this.api = api;
  }

  processor: IProcessor = {
    name: 'WikiLinkProcessor',
    priority: 20,
    
    canProcess: (content: string) => {
      return content.includes('[[');
    },
    
    process: async (content: string, context: Context): Promise<ProcessResult> => {
      const links = this.parseWikiLinks(content);
      
      // Store links for this file
      if (context.filePath) {
        this.linkIndex.set(context.filePath, links);
        
        // Update backlinks
        await this.updateBacklinks(context.filePath, links);
      }
      
      // Convert wiki links to markdown links for preview
      let processedContent = content;
      const suggestions: any[] = [];
      
      for (const link of links) {
        // Check if target exists
        const targetPath = this.resolveLink(link.target, context.filePath);
        link.exists = await this.api.files.exists(targetPath);
        
        if (!link.exists) {
          suggestions.push({
            type: 'create-missing-file',
            description: `Create missing file: ${link.target}`,
            action: async () => {
              const template = this.generateTemplate(link.target);
              await this.api.files.write(targetPath, template);
              await this.api.editor.open(targetPath);
            },
            confidence: 0.9
          });
        }
      }
      
      return {
        content: processedContent,
        operations: [],
        suggestions,
        metadata: { 
          links,
          linkCount: links.length,
          missingLinks: links.filter(l => !l.exists)
        }
      };
    }
  };

  enhancer: IEnhancer = {
    name: 'WikiLinkEnhancer',
    
    enhance: async (_content: string, context: Context): Promise<Enhancement[]> => {
      const enhancements: Enhancement[] = [];
      
      // Add backlinks panel data
      if (context.filePath) {
        const backlinks = this.backlinks.get(context.filePath) || [];
        
        if (backlinks.length > 0) {
          enhancements.push({
            type: 'backlinks',
            content: this.formatBacklinks(backlinks),
            metadata: { count: backlinks.length }
          });
        }
      }
      
      // Add link graph data
      const graphData = this.generateGraphData();
      if (graphData.nodes.length > 0) {
        enhancements.push({
          type: 'link-graph',
          content: JSON.stringify(graphData),
          metadata: { 
            nodeCount: graphData.nodes.length,
            edgeCount: graphData.edges.length
          }
        });
      }
      
      return enhancements;
    }
  };

  commands: ICommand[] = [
    {
      id: 'wiki-links.create-link',
      title: 'Create Wiki Link',
      description: 'Create a wiki link at cursor',
      keybinding: 'ctrl+shift+k',
      action: async () => {
        const selection = this.api.editor.getSelection();
        if (selection) {
          this.api.editor.insertAtCursor(`[[${selection}]]`);
        } else {
          const target = await this.api.ui.showInputBox('Enter link target:');
          if (target) {
            this.api.editor.insertAtCursor(`[[${target}]]`);
          }
        }
      }
    },
    {
      id: 'wiki-links.show-backlinks',
      title: 'Show Backlinks',
      description: 'Display all backlinks to current file',
      action: async (context) => {
        if (context.filePath) {
          const backlinks = this.backlinks.get(context.filePath) || [];
          if (backlinks.length === 0) {
            this.api.ui.showMessage('No backlinks found for this file');
          } else {
            const items = backlinks.map(bl => `${bl.source}: ${bl.context}`);
            const selected = await this.api.ui.showQuickPick(items, 'Select backlink to navigate');
            if (selected) {
              const index = items.indexOf(selected);
              await this.api.editor.open(backlinks[index].source);
            }
          }
        }
      }
    },
    {
      id: 'wiki-links.find-orphaned',
      title: 'Find Orphaned Pages',
      description: 'Find pages with no incoming links',
      action: async () => {
        const orphaned = await this.findOrphanedPages();
        if (orphaned.length === 0) {
          this.api.ui.showMessage('No orphaned pages found');
        } else {
          const selected = await this.api.ui.showQuickPick(orphaned, 'Select orphaned page to open');
          if (selected) {
            await this.api.editor.open(selected);
          }
        }
      }
    }
  ];

  async onActivate(): Promise<void> {
    // Build initial link index
    await this.buildLinkIndex();
    
    // Watch for file changes
    this.api.events.on('file:saved', async (filePath: string) => {
      const content = await this.api.files.read(filePath);
      const links = this.parseWikiLinks(content);
      this.linkIndex.set(filePath, links);
      await this.updateBacklinks(filePath, links);
    });
    
    this.api.events.on('file:deleted', (filePath: string) => {
      this.linkIndex.delete(filePath);
      this.removeBacklinksFrom(filePath);
    });
  }

  async onDeactivate(): Promise<void> {
    this.linkIndex.clear();
    this.backlinks.clear();
  }

  private parseWikiLinks(content: string): WikiLink[] {
    const links: WikiLink[] = [];
    
    // Match [[target]] or [[target|alias]]
    const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
    let match;
    
    while ((match = regex.exec(content)) !== null) {
      links.push({
        raw: match[0],
        target: match[1].trim(),
        alias: match[2]?.trim(),
        position: match.index
      });
    }
    
    return links;
  }

  private resolveLink(target: string, currentFile?: string): string {
    // Remove any file extension if present
    let cleanTarget = target.replace(/\.(md|txt)$/, '');
    
    // Add .md extension
    cleanTarget += '.md';
    
    // If target starts with /, it's absolute
    if (cleanTarget.startsWith('/')) {
      return cleanTarget;
    }
    
    // Otherwise, resolve relative to current file's directory
    if (currentFile) {
      const dir = path.dirname(currentFile);
      return path.join(dir, cleanTarget);
    }
    
    return cleanTarget;
  }

  private async updateBacklinks(sourceFile: string, links: WikiLink[]): Promise<void> {
    // Remove old backlinks from this source
    this.removeBacklinksFrom(sourceFile);
    
    // Add new backlinks
    for (const link of links) {
      const targetPath = this.resolveLink(link.target, sourceFile);
      
      if (!this.backlinks.has(targetPath)) {
        this.backlinks.set(targetPath, []);
      }
      
      const content = await this.api.files.read(sourceFile);
      const lines = content.split('\n');
      const lineNumber = content.substring(0, link.position).split('\n').length;
      
      this.backlinks.get(targetPath)!.push({
        source: sourceFile,
        target: targetPath,
        context: this.extractContext(lines, lineNumber - 1),
        line: lineNumber
      });
    }
  }

  private removeBacklinksFrom(sourceFile: string): void {
    for (const [target, links] of this.backlinks) {
      const filtered = links.filter(link => link.source !== sourceFile);
      if (filtered.length === 0) {
        this.backlinks.delete(target);
      } else {
        this.backlinks.set(target, filtered);
      }
    }
  }

  private extractContext(lines: string[], lineIndex: number, contextLines: number = 1): string {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end).join(' ').trim();
  }

  private formatBacklinks(backlinks: BacklinkData[]): string {
    return backlinks.map(bl => 
      `- [[${path.basename(bl.source, '.md')}]]: ${bl.context.substring(0, 100)}...`
    ).join('\n');
  }

  private generateGraphData(): { nodes: any[], edges: any[] } {
    const nodes: any[] = [];
    const edges: any[] = [];
    const nodeSet = new Set<string>();
    
    for (const [source, links] of this.linkIndex) {
      const sourceId = path.basename(source, '.md');
      
      if (!nodeSet.has(sourceId)) {
        nodes.push({
          id: sourceId,
          label: sourceId,
          type: 'file'
        });
        nodeSet.add(sourceId);
      }
      
      for (const link of links) {
        const targetId = link.target.replace(/\.(md|txt)$/, '');
        
        if (!nodeSet.has(targetId)) {
          nodes.push({
            id: targetId,
            label: targetId,
            type: link.exists ? 'file' : 'missing'
          });
          nodeSet.add(targetId);
        }
        
        edges.push({
          source: sourceId,
          target: targetId,
          type: 'wiki-link'
        });
      }
    }
    
    return { nodes, edges };
  }

  private async buildLinkIndex(): Promise<void> {
    try {
      // Get all markdown files in workspace
      const files = await this.findMarkdownFiles();
      
      for (const file of files) {
        const content = await this.api.files.read(file);
        const links = this.parseWikiLinks(content);
        this.linkIndex.set(file, links);
      }
      
      // Build backlinks from index
      for (const [source, links] of this.linkIndex) {
        await this.updateBacklinks(source, links);
      }
      
      console.log(`Indexed ${files.length} files with ${this.linkIndex.size} link sources`);
    } catch (error) {
      console.error('Error building link index:', error);
    }
  }

  private async findMarkdownFiles(dir: string = '.'): Promise<string[]> {
    const files: string[] = [];
    
    try {
      const entries = await this.api.files.list(dir);
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        
        if (entry.endsWith('.md')) {
          files.push(fullPath);
        } else if (!entry.startsWith('.') && !entry.includes('.')) {
          // Might be a directory, recurse
          const subFiles = await this.findMarkdownFiles(fullPath);
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
      console.debug(`Could not access directory ${dir}:`, error);
    }
    
    return files;
  }

  private async findOrphanedPages(): Promise<string[]> {
    const allFiles = await this.findMarkdownFiles();
    const linkedFiles = new Set<string>();
    
    // Collect all linked files
    for (const links of this.linkIndex.values()) {
      for (const link of links) {
        linkedFiles.add(this.resolveLink(link.target));
      }
    }
    
    // Find files that are not linked
    return allFiles.filter(file => !linkedFiles.has(file));
  }

  private generateTemplate(fileName: string): string {
    const title = path.basename(fileName, '.md')
      .replace(/-/g, ' ')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
    
    return `# ${title}\n\nCreated: ${new Date().toISOString()}\n\n## Content\n\n\n\n## Related\n\n`;
  }
}