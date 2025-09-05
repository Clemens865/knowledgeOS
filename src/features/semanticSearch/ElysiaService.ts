import { EventEmitter } from 'events';

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: {
    title?: string;
    tags?: string[];
    createdAt?: string;
    source?: string;
  };
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[];
  metadata?: Record<string, any>;
}

export interface ElysiaConfig {
  apiKey?: string;
  endpoint?: string;
  model?: 'text-embedding-ada-002' | 'text-embedding-3-small' | 'text-embedding-3-large';
  dimension?: number;
}

class ElysiaService extends EventEmitter {
  private config: ElysiaConfig;
  private vectorStore: Map<string, VectorDocument>;
  private embeddings: Map<string, number[]>;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.config = {
      model: 'text-embedding-3-small',
      dimension: 1536
    };
    this.vectorStore = new Map();
    this.embeddings = new Map();
  }

  /**
   * Initialize the Elysia service with configuration
   */
  async initialize(config?: ElysiaConfig): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Check if we have necessary configuration
    if (!this.config.apiKey && !this.config.endpoint) {
      // For now, we'll use local embeddings or mock
      console.log('Elysia: Running in local mode (no external API)');
    }

    this.isInitialized = true;
    this.emit('initialized');
  }

  /**
   * Add a document to the vector store
   */
  async addDocument(doc: VectorDocument): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Elysia service not initialized');
    }

    // Generate embedding for the document
    const embedding = await this.generateEmbedding(doc.content);
    doc.embedding = embedding;
    
    this.vectorStore.set(doc.id, doc);
    this.embeddings.set(doc.id, embedding);
    
    this.emit('documentAdded', doc.id);
  }

  /**
   * Add multiple documents in batch
   */
  async addDocuments(docs: VectorDocument[]): Promise<void> {
    const promises = docs.map(doc => this.addDocument(doc));
    await Promise.all(promises);
    this.emit('documentsAdded', docs.length);
  }

  /**
   * Search for similar documents
   */
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('Elysia service not initialized');
    }

    // Generate embedding for the query
    const queryEmbedding = await this.generateEmbedding(query);
    
    // Calculate similarity scores
    const results: SearchResult[] = [];
    
    for (const [id, doc] of this.vectorStore) {
      const docEmbedding = this.embeddings.get(id);
      if (!docEmbedding) continue;
      
      const score = this.cosineSimilarity(queryEmbedding, docEmbedding);
      results.push({
        id,
        content: doc.content,
        score,
        metadata: doc.metadata
      });
    }
    
    // Sort by score and return top results
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  async hybridSearch(query: string, limit: number = 5): Promise<SearchResult[]> {
    // Get semantic search results
    const semanticResults = await this.search(query, limit * 2);
    
    // Perform keyword search
    const keywords = query.toLowerCase().split(' ');
    const keywordResults: SearchResult[] = [];
    
    for (const [id, doc] of this.vectorStore) {
      const content = doc.content.toLowerCase();
      let keywordScore = 0;
      
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          keywordScore += 1;
        }
      }
      
      if (keywordScore > 0) {
        keywordResults.push({
          id,
          content: doc.content,
          score: keywordScore / keywords.length,
          metadata: doc.metadata
        });
      }
    }
    
    // Combine and deduplicate results
    const combinedMap = new Map<string, SearchResult>();
    
    // Add semantic results with higher weight
    for (const result of semanticResults) {
      combinedMap.set(result.id, {
        ...result,
        score: result.score * 0.7
      });
    }
    
    // Add keyword results
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
    
    // Sort and return top results
    const finalResults = Array.from(combinedMap.values());
    finalResults.sort((a, b) => b.score - a.score);
    return finalResults.slice(0, limit);
  }

  /**
   * Update a document in the vector store
   */
  async updateDocument(id: string, content: string, metadata?: Record<string, any>): Promise<void> {
    const doc = this.vectorStore.get(id);
    if (!doc) {
      throw new Error(`Document ${id} not found`);
    }

    doc.content = content;
    if (metadata) {
      doc.metadata = { ...doc.metadata, ...metadata };
    }

    // Regenerate embedding
    const embedding = await this.generateEmbedding(content);
    doc.embedding = embedding;
    this.embeddings.set(id, embedding);
    
    this.emit('documentUpdated', id);
  }

  /**
   * Delete a document from the vector store
   */
  async deleteDocument(id: string): Promise<void> {
    this.vectorStore.delete(id);
    this.embeddings.delete(id);
    this.emit('documentDeleted', id);
  }

  /**
   * Clear all documents from the vector store
   */
  async clearDocuments(): Promise<void> {
    this.vectorStore.clear();
    this.embeddings.clear();
    this.emit('documentsCleared');
  }

  /**
   * Get statistics about the vector store
   */
  getStats(): {
    documentCount: number;
    totalSize: number;
    averageEmbeddingSize: number;
  } {
    const documentCount = this.vectorStore.size;
    let totalSize = 0;
    let embeddingSize = 0;

    for (const embedding of this.embeddings.values()) {
      embeddingSize += embedding.length;
    }

    return {
      documentCount,
      totalSize: embeddingSize * 4, // Assuming float32
      averageEmbeddingSize: documentCount > 0 ? embeddingSize / documentCount : 0
    };
  }

  /**
   * Generate embedding for text (mock implementation for now)
   */
  private async generateEmbedding(text: string): Promise<number[]> {
    // For now, generate a simple mock embedding
    // In production, this would call an embedding API
    const dimension = this.config.dimension || 1536;
    const embedding: number[] = [];
    
    // Simple hash-based embedding for testing
    for (let i = 0; i < dimension; i++) {
      const hash = this.simpleHash(text + i.toString());
      embedding.push((hash % 1000) / 1000);
    }
    
    return embedding;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimension');
    }

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

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Simple hash function for mock embeddings
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Export vector store to JSON
   */
  exportToJSON(): string {
    const data = {
      config: this.config,
      documents: Array.from(this.vectorStore.values()),
      embeddings: Array.from(this.embeddings.entries()).map(([id, embedding]) => ({
        id,
        embedding
      }))
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import vector store from JSON
   */
  async importFromJSON(json: string): Promise<void> {
    const data = JSON.parse(json);
    
    if (data.config) {
      this.config = { ...this.config, ...data.config };
    }
    
    if (data.documents) {
      for (const doc of data.documents) {
        this.vectorStore.set(doc.id, doc);
      }
    }
    
    if (data.embeddings) {
      for (const item of data.embeddings) {
        this.embeddings.set(item.id, item.embedding);
      }
    }
    
    this.emit('dataImported');
  }
}

export default new ElysiaService();