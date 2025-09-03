import * as fs from 'fs';
import * as path from 'path';

interface FileInfo {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  extension?: string;
  modifiedAt: Date;
}

interface DirectoryStats {
  fileCount: number;
  totalSize: number;
  directories: number;
}

interface WorkspaceStats {
  totalFiles: number;
  totalSize: number;
  totalDirectories: number;
  fileTypeDistribution: Record<string, number>;
  recentFiles: FileInfo[];
}

interface DirectoryNode {
  name: string;
  path: string;
  type: 'directory';
  children: (DirectoryNode | FileInfo)[];
  stats: DirectoryStats;
}

export class WorkspaceMonitor {
  private workspacePath: string;
  private maxDepth: number = 3;
  private maxRecentFiles: number = 10;
  private excludePatterns: string[] = [
    'node_modules',
    '.git',
    '.DS_Store',
    'dist',
    'build',
    '.next',
    'coverage',
    '.nyc_output',
    '.cache',
    'tmp',
    'temp',
    '*.log'
  ];

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Build complete workspace snapshot with directory tree and metadata
   */
  public async buildWorkspaceSnapshot(): Promise<{
    structure: DirectoryNode;
    stats: WorkspaceStats;
    xmlSnapshot: string;
  }> {
    const structure = await this.buildDirectoryTree(this.workspacePath, 0);
    const stats = this.calculateWorkspaceStats(structure);
    const xmlSnapshot = this.generateXMLSnapshot(structure, stats);

    return {
      structure,
      stats,
      xmlSnapshot
    };
  }

  /**
   * Build directory tree with file metadata up to specified depth
   */
  private async buildDirectoryTree(dirPath: string, currentDepth: number): Promise<DirectoryNode> {
    const dirName = path.basename(dirPath);
    const node: DirectoryNode = {
      name: dirName,
      path: dirPath,
      type: 'directory',
      children: [],
      stats: {
        fileCount: 0,
        totalSize: 0,
        directories: 0
      }
    };

    if (currentDepth >= this.maxDepth || this.shouldExclude(dirName)) {
      return node;
    }

    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (this.shouldExclude(entry.name)) {
          continue;
        }

        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const subDir = await this.buildDirectoryTree(fullPath, currentDepth + 1);
          node.children.push(subDir);
          node.stats.directories++;
          node.stats.fileCount += subDir.stats.fileCount;
          node.stats.totalSize += subDir.stats.totalSize;
        } else if (entry.isFile()) {
          try {
            const stat = await fs.promises.stat(fullPath);
            const fileInfo: FileInfo = {
              name: entry.name,
              path: fullPath,
              type: 'file',
              size: stat.size,
              extension: path.extname(entry.name).toLowerCase(),
              modifiedAt: stat.mtime
            };
            
            node.children.push(fileInfo);
            node.stats.fileCount++;
            node.stats.totalSize += stat.size;
          } catch (error) {
            // Skip files that can't be accessed
            console.warn(`Could not access file: ${fullPath}`, error);
          }
        }
      }
    } catch (error) {
      console.warn(`Could not read directory: ${dirPath}`, error);
    }

    return node;
  }

  /**
   * Calculate comprehensive workspace statistics
   */
  private calculateWorkspaceStats(rootNode: DirectoryNode): WorkspaceStats {
    const stats: WorkspaceStats = {
      totalFiles: 0,
      totalSize: 0,
      totalDirectories: 0,
      fileTypeDistribution: {},
      recentFiles: []
    };

    const allFiles: FileInfo[] = [];

    const traverse = (node: DirectoryNode | FileInfo) => {
      if (node.type === 'directory') {
        stats.totalDirectories++;
        (node as DirectoryNode).children.forEach(traverse);
      } else {
        stats.totalFiles++;
        stats.totalSize += node.size;
        allFiles.push(node as FileInfo);

        // Track file type distribution
        const ext = (node as FileInfo).extension || 'no-extension';
        stats.fileTypeDistribution[ext] = (stats.fileTypeDistribution[ext] || 0) + 1;
      }
    };

    traverse(rootNode);

    // Get recent files (sorted by modification time)
    stats.recentFiles = allFiles
      .sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())
      .slice(0, this.maxRecentFiles);

    return stats;
  }

  /**
   * Generate XML-formatted workspace snapshot like Windsurf
   */
  private generateXMLSnapshot(structure: DirectoryNode, stats: WorkspaceStats): string {
    const formatSize = (bytes: number): string => {
      const units = ['B', 'KB', 'MB', 'GB'];
      let size = bytes;
      let unitIndex = 0;
      
      while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
      }
      
      return `${Math.round(size)}${units[unitIndex]}`;
    };

    const formatTime = (date: Date): string => {
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} minutes ago`;
      if (diffHours < 24) return `${diffHours} hours ago`;
      if (diffDays === 1) return 'yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString();
    };

    const renderDirectoryTree = (node: DirectoryNode, indent: string = ''): string => {
      let result = `${indent}${node.name}/ (${node.stats.fileCount} files, ${formatSize(node.stats.totalSize)})\n`;
      
      // Show directories first, then files (limited for readability)
      const directories = node.children.filter(child => child.type === 'directory') as DirectoryNode[];
      const files = node.children.filter(child => child.type === 'file') as FileInfo[];
      
      directories.forEach(dir => {
        result += renderDirectoryTree(dir, indent + '  ');
      });
      
      // Show only first few files to avoid overwhelming output
      const maxFilesToShow = 5;
      const filesToShow = files.slice(0, maxFilesToShow);
      
      filesToShow.forEach(file => {
        result += `${indent}  ${file.name} (${formatSize(file.size)})\n`;
      });
      
      if (files.length > maxFilesToShow) {
        result += `${indent}  ... and ${files.length - maxFilesToShow} more files\n`;
      }
      
      return result;
    };

    const xmlSnapshot = `<workspace_information>
  <summary>
    Total files: ${stats.totalFiles}
    Total directories: ${stats.totalDirectories}
    Total size: ${formatSize(stats.totalSize)}
    Workspace: ${path.basename(this.workspacePath)}
  </summary>
  
  <structure>
${renderDirectoryTree(structure).trim()}
  </structure>
  
  <recent_files>
${stats.recentFiles.map(file => `    - ${path.basename(file.name)} (modified ${formatTime(file.modifiedAt)})`).join('\n')}
  </recent_files>
  
  <file_types>
${Object.entries(stats.fileTypeDistribution)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 10)
  .map(([ext, count]) => `    ${ext === 'no-extension' ? 'no extension' : ext}: ${count} files`)
  .join('\n')}
  </file_types>
</workspace_information>`;

    return xmlSnapshot;
  }

  /**
   * Check if a file or directory should be excluded
   */
  private shouldExclude(name: string): boolean {
    return this.excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        // Simple glob pattern matching
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(name);
      }
      return name === pattern;
    });
  }

  /**
   * Get workspace changes since last snapshot (for future use)
   */
  public async getRecentChanges(sinceDate?: Date): Promise<FileInfo[]> {
    const changes: FileInfo[] = [];
    const cutoffDate = sinceDate || new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

    const scanForChanges = async (dirPath: string, depth: number = 0) => {
      if (depth >= this.maxDepth) return;

      try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          if (this.shouldExclude(entry.name)) continue;
          
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isFile()) {
            try {
              const stat = await fs.promises.stat(fullPath);
              if (stat.mtime > cutoffDate) {
                changes.push({
                  name: entry.name,
                  path: fullPath,
                  type: 'file',
                  size: stat.size,
                  extension: path.extname(entry.name).toLowerCase(),
                  modifiedAt: stat.mtime
                });
              }
            } catch (error) {
              // Skip inaccessible files
            }
          } else if (entry.isDirectory()) {
            await scanForChanges(fullPath, depth + 1);
          }
        }
      } catch (error) {
        // Skip inaccessible directories
      }
    };

    await scanForChanges(this.workspacePath);
    return changes.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime());
  }

  /**
   * Update exclude patterns for workspace monitoring
   */
  public setExcludePatterns(patterns: string[]): void {
    this.excludePatterns = patterns;
  }

  /**
   * Set maximum depth for directory traversal
   */
  public setMaxDepth(depth: number): void {
    this.maxDepth = Math.max(1, Math.min(depth, 10)); // Clamp between 1 and 10
  }

  /**
   * Set maximum number of recent files to track
   */
  public setMaxRecentFiles(count: number): void {
    this.maxRecentFiles = Math.max(1, Math.min(count, 50)); // Clamp between 1 and 50
  }
}

export default WorkspaceMonitor;