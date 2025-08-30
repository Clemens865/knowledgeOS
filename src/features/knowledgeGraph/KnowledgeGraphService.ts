import * as fs from 'fs/promises';
import * as path from 'path';

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  type: 'note' | 'folder' | 'tag';
  group: number;
  size: number;
  metadata: {
    created?: Date;
    modified?: Date;
    wordCount: number;
    tags: string[];
    links: string[];
  };
}

export interface GraphLink {
  source: string;
  target: string;
  type: 'link' | 'reference' | 'tag' | 'folder';
  strength: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  stats: {
    totalNodes: number;
    totalLinks: number;
    orphanedNodes: string[];
    mostConnected: { id: string; connections: number }[];
  };
}

export class KnowledgeGraphService {
  private workspacePath: string;
  private nodeMap: Map<string, GraphNode> = new Map();
  private linkMap: Map<string, GraphLink[]> = new Map();

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async buildGraph(): Promise<KnowledgeGraph> {
    this.nodeMap.clear();
    this.linkMap.clear();

    // Parse all markdown files
    await this.parseDirectory(this.workspacePath);

    // Build links between nodes
    this.buildLinks();

    // Calculate statistics
    const stats = this.calculateStats();

    return {
      nodes: Array.from(this.nodeMap.values()),
      links: this.getAllLinks(),
      stats
    };
  }

  private async parseDirectory(dirPath: string, depth: number = 0): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        if (entry.isDirectory()) {
          // Add folder node
          const folderId = this.getNodeId(fullPath);
          this.nodeMap.set(folderId, {
            id: folderId,
            label: entry.name,
            path: fullPath,
            type: 'folder',
            group: 1,
            size: 15,
            metadata: {
              wordCount: 0,
              tags: [],
              links: []
            }
          });

          // Recursively parse subdirectory
          await this.parseDirectory(fullPath, depth + 1);
        } else if (entry.name.endsWith('.md')) {
          // Parse markdown file
          await this.parseMarkdownFile(fullPath);
        }
      }
    } catch (error) {
      console.error(`Error parsing directory ${dirPath}:`, error);
    }
  }

  private async parseMarkdownFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      const nodeId = this.getNodeId(filePath);
      
      // Extract metadata from content
      const tags = this.extractTags(content);
      const links = this.extractLinks(content);
      const wordCount = this.countWords(content);
      
      // Create node for this file
      const node: GraphNode = {
        id: nodeId,
        label: path.basename(filePath, '.md'),
        path: filePath,
        type: 'note',
        group: 0,
        size: Math.min(30, 10 + Math.log(wordCount + 1) * 3), // Size based on word count
        metadata: {
          created: stats.birthtime,
          modified: stats.mtime,
          wordCount,
          tags,
          links
        }
      };

      this.nodeMap.set(nodeId, node);

      // Create nodes for tags
      tags.forEach(tag => {
        const tagId = `tag:${tag}`;
        if (!this.nodeMap.has(tagId)) {
          this.nodeMap.set(tagId, {
            id: tagId,
            label: `#${tag}`,
            path: '',
            type: 'tag',
            group: 2,
            size: 12,
            metadata: {
              wordCount: 0,
              tags: [],
              links: []
            }
          });
        }
      });
    } catch (error) {
      console.error(`Error parsing markdown file ${filePath}:`, error);
    }
  }

  private extractTags(content: string): string[] {
    const tagPattern = /#(\w+)/g;
    const tags: string[] = [];
    let match;
    
    while ((match = tagPattern.exec(content)) !== null) {
      const tag = match[1].toLowerCase();
      if (!tags.includes(tag)) {
        tags.push(tag);
      }
    }
    
    return tags;
  }

  private extractLinks(content: string): string[] {
    const links: string[] = [];
    
    // Wiki-style links [[Link]]
    const wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = wikiLinkPattern.exec(content)) !== null) {
      links.push(match[1]);
    }
    
    // Markdown links [text](link.md)
    const mdLinkPattern = /\[([^\]]+)\]\(([^)]+\.md)\)/g;
    while ((match = mdLinkPattern.exec(content)) !== null) {
      links.push(match[2]);
    }
    
    return links;
  }

  private countWords(content: string): number {
    // Remove markdown syntax for more accurate count
    const cleanContent = content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]*`/g, '') // Remove inline code
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text
      .replace(/[#*_~\[\]]/g, '') // Remove markdown symbols
      .replace(/\s+/g, ' '); // Normalize whitespace
    
    return cleanContent.split(/\s+/).filter(word => word.length > 0).length;
  }

  private buildLinks(): void {
    // Build links between notes based on references
    this.nodeMap.forEach((node, nodeId) => {
      if (node.type === 'note') {
        // Link to parent folder
        const parentPath = path.dirname(node.path);
        const parentId = this.getNodeId(parentPath);
        if (this.nodeMap.has(parentId)) {
          this.addLink(nodeId, parentId, 'folder', 0.5);
        }

        // Link to referenced notes
        node.metadata.links.forEach(link => {
          const targetPath = path.resolve(path.dirname(node.path), link);
          const targetId = this.getNodeId(targetPath);
          if (this.nodeMap.has(targetId)) {
            this.addLink(nodeId, targetId, 'link', 1.0);
          }
        });

        // Link to tags
        node.metadata.tags.forEach(tag => {
          const tagId = `tag:${tag}`;
          if (this.nodeMap.has(tagId)) {
            this.addLink(nodeId, tagId, 'tag', 0.7);
          }
        });
      }
    });
  }

  private addLink(source: string, target: string, type: GraphLink['type'], strength: number): void {
    if (!this.linkMap.has(source)) {
      this.linkMap.set(source, []);
    }
    
    const existingLink = this.linkMap.get(source)?.find(
      link => link.target === target && link.type === type
    );
    
    if (!existingLink) {
      this.linkMap.get(source)!.push({
        source,
        target,
        type,
        strength
      });
    }
  }

  private getAllLinks(): GraphLink[] {
    const allLinks: GraphLink[] = [];
    this.linkMap.forEach(links => {
      allLinks.push(...links);
    });
    return allLinks;
  }

  private calculateStats() {
    const connectionCount = new Map<string, number>();
    
    // Count connections for each node
    this.linkMap.forEach((links, source) => {
      connectionCount.set(source, (connectionCount.get(source) || 0) + links.length);
      links.forEach(link => {
        connectionCount.set(link.target, (connectionCount.get(link.target) || 0) + 1);
      });
    });

    // Find orphaned nodes (no connections)
    const orphanedNodes: string[] = [];
    this.nodeMap.forEach((node, nodeId) => {
      if (node.type === 'note' && !connectionCount.has(nodeId)) {
        orphanedNodes.push(nodeId);
      }
    });

    // Find most connected nodes
    const mostConnected = Array.from(connectionCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id, connections]) => ({ id, connections }));

    return {
      totalNodes: this.nodeMap.size,
      totalLinks: this.getAllLinks().length,
      orphanedNodes,
      mostConnected
    };
  }

  private getNodeId(filePath: string): string {
    // Create a consistent ID from the file path
    const relativePath = path.relative(this.workspacePath, filePath);
    return relativePath.replace(/\\/g, '/');
  }

  async getNodeDetails(nodeId: string): Promise<GraphNode | null> {
    return this.nodeMap.get(nodeId) || null;
  }
}