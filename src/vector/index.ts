/**
 * Enhanced Vector Database for KnowledgeOS
 * 
 * This module provides comprehensive vector search capabilities including:
 * - Hybrid search (semantic + keyword)
 * - Advanced document chunking
 * - Intelligent caching systems
 * - Multiple embedding providers
 * - Performance optimization
 * - Incremental indexing
 */

// Core vector database
export { VectorDatabase } from './core/VectorDatabase';

// Type definitions
export * from './types';

// Utility classes
export { TextChunker } from './utils/TextChunker';
export { SimilarityCalculator } from './utils/SimilarityCalculator';

// Caching system
export { 
  EmbeddingCache, 
  VectorEmbeddingCache, 
  SearchResultCache 
} from './cache/EmbeddingCache';

// Re-export embedding providers from main services (commented out to avoid circular imports)
// export { 
//   EmbeddingProvider,
//   LocalEmbeddingProvider,
//   OpenAIEmbeddingProvider,
//   MockEmbeddingProvider
// } from '../main/services/EmbeddingProvider';

/**
 * Factory function to create a VectorDatabase instance with recommended settings
 */
export function createVectorDatabase(config: {
  workspacePath: string;
  embeddingProvider: any;
  cacheEnabled?: boolean;
  cacheSize?: number; // in MB
  chunkSize?: number;
  chunkOverlap?: number;
}) {
  // Import VectorDatabase here to avoid circular imports
  const { VectorDatabase } = require('./core/VectorDatabase');
  const vectorDb = new VectorDatabase({
    workspacePath: config.workspacePath,
    embeddingProvider: config.embeddingProvider,
    chunkSize: config.chunkSize || 1000,
    chunkOverlap: config.chunkOverlap || 200,
    cacheConfig: {
      enabled: config.cacheEnabled !== false,
      maxSize: (config.cacheSize || 100) * 1024 * 1024,
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      strategy: 'lru'
    },
    indexingBatchSize: 10,
    enableIncrementalIndexing: true,
    enableParallelProcessing: true,
    maxRetries: 3
  });

  return vectorDb;
}

/**
 * Utility function to estimate memory usage for embeddings
 */
export function estimateEmbeddingMemoryUsage(
  documentCount: number,
  averageDocumentSize: number,
  embeddingDimension: number = 1536,
  includeChunks: boolean = true
): {
  totalMemoryMB: number;
  embeddingMemoryMB: number;
  documentMemoryMB: number;
  chunkMemoryMB?: number;
} {
  // Embedding memory (assuming 4 bytes per float)
  const embeddingMemoryBytes = documentCount * embeddingDimension * 4;
  
  // Document content memory (UTF-8, roughly 1 byte per character)
  const documentMemoryBytes = documentCount * averageDocumentSize;
  
  // Chunk memory (assuming average 3 chunks per document)
  const chunkMemoryBytes = includeChunks 
    ? documentCount * 3 * embeddingDimension * 4 
    : 0;
  
  const totalBytes = embeddingMemoryBytes + documentMemoryBytes + chunkMemoryBytes;
  
  return {
    totalMemoryMB: Math.round(totalBytes / (1024 * 1024) * 100) / 100,
    embeddingMemoryMB: Math.round(embeddingMemoryBytes / (1024 * 1024) * 100) / 100,
    documentMemoryMB: Math.round(documentMemoryBytes / (1024 * 1024) * 100) / 100,
    chunkMemoryMB: includeChunks 
      ? Math.round(chunkMemoryBytes / (1024 * 1024) * 100) / 100 
      : undefined
  };
}

/**
 * Validate vector database configuration
 */
export function validateVectorDatabaseConfig(config: any): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.workspacePath) {
    errors.push('workspacePath is required');
  }

  if (!config.embeddingProvider) {
    errors.push('embeddingProvider is required');
  }

  // Validate chunk configuration
  if (config.chunkSize && config.chunkSize < 100) {
    warnings.push('chunkSize is very small, consider using at least 100 characters');
  }

  if (config.chunkSize && config.chunkSize > 8000) {
    warnings.push('chunkSize is very large, consider using less than 8000 characters');
  }

  if (config.chunkOverlap && config.chunkOverlap >= config.chunkSize) {
    errors.push('chunkOverlap must be smaller than chunkSize');
  }

  // Validate cache configuration
  if (config.cacheConfig) {
    if (config.cacheConfig.maxSize && config.cacheConfig.maxSize < 1024 * 1024) {
      warnings.push('Cache size is very small, consider at least 1MB');
    }

    if (config.cacheConfig.ttl && config.cacheConfig.ttl < 60000) {
      warnings.push('Cache TTL is very short, consider at least 1 minute');
    }
  }

  // Validate batch size
  if (config.indexingBatchSize && config.indexingBatchSize > 100) {
    warnings.push('indexingBatchSize is very large, may cause memory issues');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Performance benchmarking utilities
 */
export class VectorDatabaseBenchmark {
  private vectorDb: any; // Use any to avoid import issues

  constructor(vectorDb: any) {
    this.vectorDb = vectorDb;
  }

  async benchmarkSearch(queries: string[], iterations: number = 10): Promise<{
    averageSearchTime: number;
    minSearchTime: number;
    maxSearchTime: number;
    totalQueries: number;
  }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      for (const query of queries) {
        const start = Date.now();
        await this.vectorDb.hybridSearch(query, { limit: 10 });
        times.push(Date.now() - start);
      }
    }

    return {
      averageSearchTime: times.reduce((a, b) => a + b, 0) / times.length,
      minSearchTime: Math.min(...times),
      maxSearchTime: Math.max(...times),
      totalQueries: times.length
    };
  }

  async benchmarkIndexing(documents: any[], batchSize: number = 10): Promise<{
    averageIndexTime: number;
    totalIndexTime: number;
    throughput: number; // docs per second
    totalDocuments: number;
  }> {
    const start = Date.now();
    
    await this.vectorDb.batchUpsertDocuments(documents, { 
      batchSize, 
      parallel: true 
    });

    const totalTime = Date.now() - start;
    
    return {
      averageIndexTime: totalTime / documents.length,
      totalIndexTime: totalTime,
      throughput: documents.length / (totalTime / 1000),
      totalDocuments: documents.length
    };
  }
}

// Export default from core
export { VectorDatabase as default } from './core/VectorDatabase';