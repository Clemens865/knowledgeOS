import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalEmbeddingProvider, OpenAIEmbeddingProvider, MockEmbeddingProvider, EmbeddingProvider } from './services/EmbeddingProvider';
import { VectorDatabase } from './services/VectorDatabase';

interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: {
    title?: string;
    path?: string;
    tags?: string[];
    createdAt?: string;
    modifiedAt?: string;
    fileType?: string;
    checksum?: string;
  };
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: VectorDocument['metadata'];
}

class SemanticSearchService {
  private db: VectorDatabase;
  private provider: EmbeddingProvider;
  private currentProviderType: 'local' | 'openai' | 'mock' = 'mock';
  private currentWorkspace: string | null = null;
  
  constructor() {
    this.provider = new MockEmbeddingProvider();
    this.db = new VectorDatabase();
  }
  
  async setProvider(type: 'local' | 'openai' | 'mock', apiKey?: string) {
    const previousType = this.currentProviderType;
    this.currentProviderType = type;
    
    switch (type) {
      case 'local':
        this.provider = new LocalEmbeddingProvider();
        break;
      case 'openai':
        if (!apiKey) {
          throw new Error('OpenAI API key required');
        }
        this.provider = new OpenAIEmbeddingProvider(apiKey);
        break;
      case 'mock':
      default:
        this.provider = new MockEmbeddingProvider();
        break;
    }
    
    // Re-index if we have documents and changed provider
    if (this.currentWorkspace && type !== previousType) {
      const stats = await this.db.getStats();
      if (stats.documentCount > 0) {
        await this.reindexDocuments();
      }
    }
  }
  
  async indexWorkspace(workspacePath: string): Promise<number> {
    // Initialize database for this workspace if not already done
    if (this.currentWorkspace !== workspacePath) {
      try {
        await this.db.initialize(workspacePath);
        this.currentWorkspace = workspacePath;
      } catch (error) {
        console.error('Failed to initialize database:', error);
        throw error;
      }
    }
    
    const documents = await this.scanWorkspaceForDocuments(workspacePath);
    
    // Check which documents need indexing
    const paths = documents.map(d => d.metadata?.path || d.id);
    const indexingStatus = await this.db.getDocumentsToIndex(paths);
    
    let indexedCount = 0;
    for (const doc of documents) {
      const status = indexingStatus.find(s => s.path === doc.metadata?.path);
      if (status?.needsIndexing !== false) {
        await this.addDocument(doc);
        indexedCount++;
      }
    }
    
    console.log(`Indexed ${indexedCount} new/modified documents out of ${documents.length} total`);
    return indexedCount;
  }
  
  private async scanWorkspaceForDocuments(workspacePath: string): Promise<VectorDocument[]> {
    const documents: VectorDocument[] = [];
    
    async function scanDirectory(dirPath: string) {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          // Skip hidden files and directories
          if (entry.name.startsWith('.')) continue;
          
          // Skip node_modules and other common non-content directories
          if (['node_modules', 'dist', 'build', '.git'].includes(entry.name)) continue;
          
          if (entry.isDirectory()) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && entry.name.endsWith('.md')) {
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              const stats = await fs.stat(fullPath);
              
              // Extract title from content or filename
              const titleMatch = content.match(/^#\s+(.+)$/m);
              const title = titleMatch ? titleMatch[1] : entry.name.replace('.md', '');
              
              // Extract tags from content
              const tagMatches = content.match(/#[\w-]+/g);
              const tags = tagMatches ? [...new Set(tagMatches)] : [];
              
              documents.push({
                id: fullPath,
                content,
                metadata: {
                  title,
                  path: fullPath,
                  tags,
                  createdAt: stats.birthtime.toISOString(),
                  modifiedAt: stats.mtime.toISOString(),
                }
              });
            } catch (error) {
              console.error(`Error reading file ${fullPath}:`, error);
            }
          }
        }
      } catch (error) {
        console.error(`Error scanning directory ${dirPath}:`, error);
      }
    }
    
    await scanDirectory(workspacePath);
    return documents;
  }
  
  async addDocument(doc: VectorDocument): Promise<void> {
    if (!this.currentWorkspace) {
      throw new Error('No workspace initialized');
    }
    
    const embedding = await this.provider.generateEmbedding(doc.content);
    await this.db.upsertDocument(doc, embedding, this.provider.getName());
  }
  
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.currentWorkspace) {
      return [];
    }
    
    const queryEmbedding = await this.provider.generateEmbedding(query);
    return await this.db.search(queryEmbedding, limit);
  }
  
  async hybridSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.currentWorkspace) {
      return [];
    }
    
    // Get semantic results
    const semanticResults = await this.search(query, limit * 2);
    
    // Keyword search
    const keywords = query.toLowerCase().split(' ').filter(k => k.length > 2);
    const keywordResults = await this.db.keywordSearch(keywords, limit * 2);
    
    // Combine results with weighted scores
    const combinedMap = new Map<string, SearchResult>();
    
    for (const result of semanticResults) {
      combinedMap.set(result.id, {
        ...result,
        score: result.score * 0.7  // 70% weight for semantic
      });
    }
    
    for (const result of keywordResults) {
      const existing = combinedMap.get(result.id);
      if (existing) {
        existing.score += result.score * 0.3;  // 30% weight for keywords
      } else {
        combinedMap.set(result.id, {
          ...result,
          score: result.score * 0.3
        });
      }
    }
    
    const finalResults = Array.from(combinedMap.values());
    finalResults.sort((a, b) => b.score - a.score);
    return finalResults.slice(0, limit);
  }
  
  private async reindexDocuments(): Promise<void> {
    if (!this.currentWorkspace) {
      throw new Error('No workspace initialized');
    }
    
    // Get all indexed paths from database
    const indexedPaths = await this.db.getIndexedPaths();
    
    console.log(`Re-indexing ${indexedPaths.length} documents with new provider...`);
    
    for (const filePath of indexedPaths) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        // Extract metadata
        const titleMatch = content.match(/^#\s+(.+)$/m);
        const title = titleMatch ? titleMatch[1] : path.basename(filePath).replace('.md', '');
        
        const doc: VectorDocument = {
          id: filePath,
          content,
          metadata: {
            title,
            path: filePath,
            fileType: path.extname(filePath).slice(1) || 'md',
            modifiedAt: stats.mtime.toISOString()
          }
        };
        
        // Generate new embedding with current provider
        const embedding = await this.provider.generateEmbedding(content);
        await this.db.upsertDocument(doc, embedding, this.provider.getName());
      } catch (error) {
        console.error(`Error re-indexing ${filePath}:`, error);
      }
    }
  }
  
  async getStats() {
    if (!this.currentWorkspace) {
      return {
        documentCount: 0,
        provider: this.provider.getName(),
        dimension: this.provider.getDimension(),
      };
    }
    
    const dbStats = await this.db.getStats();
    return {
      documentCount: dbStats.documentCount,
      provider: this.provider.getName(),
      dimension: this.provider.getDimension(),
      databasePath: dbStats.databasePath,
      databaseSize: dbStats.databaseSize,
      lastIndexed: dbStats.lastIndexed,
      embeddingCount: dbStats.embeddingCount,
      uniqueTags: dbStats.uniqueTags
    };
  }
  
  async clearIndex(): Promise<void> {
    if (this.currentWorkspace) {
      await this.db.clear();
    }
  }
}

// Create singleton instance
const semanticSearchService = new SemanticSearchService();

export function setupSemanticSearchHandlers() {
  // Set embedding provider
  ipcMain.handle('semanticSearch:setProvider', async (_event, type: 'local' | 'openai' | 'mock', apiKey?: string) => {
    try {
      await semanticSearchService.setProvider(type, apiKey);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Index workspace
  ipcMain.handle('semanticSearch:indexWorkspace', async (_event, workspacePath: string) => {
    try {
      const count = await semanticSearchService.indexWorkspace(workspacePath);
      return { success: true, count };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Search
  ipcMain.handle('semanticSearch:search', async (_event, query: string, limit: number = 5) => {
    try {
      const results = await semanticSearchService.search(query, limit);
      return { success: true, results };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Hybrid search
  ipcMain.handle('semanticSearch:hybridSearch', async (_event, query: string, limit: number = 5) => {
    try {
      const results = await semanticSearchService.hybridSearch(query, limit);
      return { success: true, results };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
  
  // Get stats
  ipcMain.handle('semanticSearch:getStats', async (_event) => {
    return semanticSearchService.getStats();
  });
  
  // Clear index
  ipcMain.handle('semanticSearch:clearIndex', async (_event) => {
    try {
      await semanticSearchService.clearIndex();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}