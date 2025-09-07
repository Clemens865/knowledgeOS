import { pipeline, env } from '@xenova/transformers';
import OpenAI from 'openai';

// Configure Transformers.js for Electron
(env as any).localURL = '';
(env as any).allowRemoteModels = true;

export interface EmbeddingProvider {
  generateEmbedding(text: string): Promise<number[]>;
  getDimension(): number;
  getName(): string;
}

/**
 * Local embedding provider using Transformers.js
 * Uses Sentence-Transformers models that run entirely on device
 */
export class LocalEmbeddingProvider implements EmbeddingProvider {
  private extractor: any = null;
  private modelName = 'Xenova/all-MiniLM-L6-v2';
  private dimension = 384;
  
  async initialize() {
    if (!this.extractor) {
      console.log('Loading local embedding model...');
      this.extractor = await pipeline('feature-extraction', this.modelName);
      console.log('Local embedding model loaded successfully');
    }
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    await this.initialize();
    
    // Generate embeddings
    const output = await this.extractor(text, {
      pooling: 'mean',
      normalize: true
    });
    
    // Convert to array
    return Array.from(output.data);
  }
  
  getDimension(): number {
    return this.dimension;
  }
  
  getName(): string {
    return 'Local (all-MiniLM-L6-v2)';
  }
}

/**
 * OpenAI embedding provider using OpenAI API
 * Requires API key
 */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private client: OpenAI | null = null;
  private model = 'text-embedding-3-small';
  private dimension = 1536;
  
  constructor(apiKey?: string) {
    if (apiKey) {
      this.client = new OpenAI({ apiKey });
    }
  }
  
  setApiKey(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.client) {
      throw new Error('OpenAI API key not set');
    }
    
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    
    return response.data[0].embedding;
  }
  
  getDimension(): number {
    return this.dimension;
  }
  
  getName(): string {
    return 'OpenAI (text-embedding-3-small)';
  }
}

/**
 * Mock embedding provider for testing
 */
export class MockEmbeddingProvider implements EmbeddingProvider {
  private dimension = 384;
  private maxTokens = 8192;
  
  async generateEmbedding(text: string): Promise<number[]> {
    // Simple hash-based mock embedding
    const embedding: number[] = [];
    for (let i = 0; i < this.dimension; i++) {
      const hash = this.simpleHash(text + i.toString());
      embedding.push((hash % 1000) / 1000);
    }
    return embedding;
  }
  
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.generateEmbedding(text)));
  }
  
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  getDimension(): number {
    return this.dimension;
  }
  
  getName(): string {
    return 'Mock (Development)';
  }
  
  getMaxTokens(): number {
    return this.maxTokens;
  }
  
  estimateTokens(text: string): number {
    // Simple approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }
}