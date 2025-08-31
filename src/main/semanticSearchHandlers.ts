import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import * as path from 'path';
import { LocalEmbeddingProvider, OpenAIEmbeddingProvider, MockEmbeddingProvider, EmbeddingProvider } from './services/EmbeddingProvider';

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
  };
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: VectorDocument['metadata'];
}

class SemanticSearchService {
  private vectorStore: Map<string, VectorDocument> = new Map();
  private embeddings: Map<string, number[]> = new Map();
  private provider: EmbeddingProvider;
  private currentProviderType: 'local' | 'openai' | 'mock' = 'mock';
  
  constructor() {
    this.provider = new MockEmbeddingProvider();
  }
  
  async setProvider(type: 'local' | 'openai' | 'mock', apiKey?: string) {
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
    if (this.vectorStore.size > 0 && type !== this.currentProviderType) {
      await this.reindexDocuments();
    }
  }
  
  async indexWorkspace(workspacePath: string): Promise<number> {
    const documents = await this.scanWorkspaceForDocuments(workspacePath);
    
    for (const doc of documents) {
      await this.addDocument(doc);
    }
    
    return documents.length;
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
    const embedding = await this.provider.generateEmbedding(doc.content);
    doc.embedding = embedding;
    this.vectorStore.set(doc.id, doc);
    this.embeddings.set(doc.id, embedding);
  }
  
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (this.vectorStore.size === 0) {
      return [];
    }
    
    const queryEmbedding = await this.provider.generateEmbedding(query);
    const results: SearchResult[] = [];
    
    for (const [id, doc] of this.vectorStore) {
      const docEmbedding = this.embeddings.get(id);
      if (!docEmbedding) continue;
      
      const score = this.cosineSimilarity(queryEmbedding, docEmbedding);
      results.push({
        id,
        content: doc.content.substring(0, 500), // Truncate for display
        score,
        metadata: doc.metadata
      });
    }
    
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }
  
  async hybridSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
    // Get semantic results
    const semanticResults = await this.search(query, limit * 2);
    
    // Keyword search
    const keywords = query.toLowerCase().split(' ').filter(k => k.length > 2);
    const keywordResults: SearchResult[] = [];
    
    for (const [id, doc] of this.vectorStore) {
      const content = doc.content.toLowerCase();
      let keywordScore = 0;
      
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          keywordScore += (content.match(new RegExp(keyword, 'g')) || []).length;
        }
      }
      
      if (keywordScore > 0) {
        keywordResults.push({
          id,
          content: doc.content.substring(0, 500),
          score: keywordScore / (keywords.length * 10), // Normalize
          metadata: doc.metadata
        });
      }
    }
    
    // Combine results
    const combinedMap = new Map<string, SearchResult>();
    
    for (const result of semanticResults) {
      combinedMap.set(result.id, {
        ...result,
        score: result.score * 0.7
      });
    }
    
    for (const result of keywordResults) {
      const existing = combinedMap.get(result.id);
      if (existing) {
        existing.score += result.score * 0.3;
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
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (normA * normB);
  }
  
  private async reindexDocuments(): Promise<void> {
    const docs = Array.from(this.vectorStore.values());
    this.embeddings.clear();
    
    for (const doc of docs) {
      const embedding = await this.provider.generateEmbedding(doc.content);
      doc.embedding = embedding;
      this.embeddings.set(doc.id, embedding);
    }
  }
  
  getStats() {
    return {
      documentCount: this.vectorStore.size,
      provider: this.provider.getName(),
      dimension: this.provider.getDimension(),
    };
  }
  
  clearDocuments() {
    this.vectorStore.clear();
    this.embeddings.clear();
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
  
  // Clear documents
  ipcMain.handle('semanticSearch:clearDocuments', async (_event) => {
    semanticSearchService.clearDocuments();
    return { success: true };
  });
}