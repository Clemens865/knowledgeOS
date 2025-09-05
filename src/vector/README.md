# Enhanced Vector Database for KnowledgeOS

A comprehensive, high-performance vector database implementation that provides advanced semantic search capabilities with hybrid search, intelligent caching, and incremental indexing.

## 🚀 Features

### Core Capabilities
- **Hybrid Search**: Combines semantic and keyword search with configurable weights
- **Multiple Embedding Providers**: Support for OpenAI and local Transformers.js models
- **Advanced Document Chunking**: Intelligent text segmentation with overlap and metadata
- **High-Performance Caching**: Multi-level caching with LRU, LFU, and FIFO strategies
- **Incremental Indexing**: Only re-index changed documents
- **Batch Operations**: Efficient batch processing with parallel execution
- **SQLite Backend**: Robust SQLite database with optimized schemas and indexes

### Advanced Features
- **TF-IDF Keyword Scoring**: Advanced keyword matching with frequency analysis
- **Document Relationships**: Track links and relationships between documents
- **Performance Monitoring**: Built-in metrics and benchmarking
- **Error Recovery**: Robust error handling and retry mechanisms
- **Memory Optimization**: Efficient memory usage with configurable limits
- **Similarity Metrics**: Support for cosine, Euclidean, Manhattan, and Jaccard similarity

## 📁 Architecture

```
src/vector/
├── core/
│   └── VectorDatabase.ts          # Main database implementation
├── types/
│   └── index.ts                   # TypeScript type definitions
├── utils/
│   ├── TextChunker.ts             # Advanced text chunking utilities
│   └── SimilarityCalculator.ts    # Similarity calculation algorithms
├── cache/
│   └── EmbeddingCache.ts          # Multi-level caching system
├── examples/
│   └── usage.ts                   # Comprehensive usage examples
└── index.ts                       # Main exports and factory functions
```

## 🛠️ Installation & Setup

The enhanced vector database is part of KnowledgeOS and uses the following dependencies:

```json
{
  "better-sqlite3": "^12.2.0",
  "@xenova/transformers": "^2.17.2", 
  "openai": "^5.16.0"
}
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { createVectorDatabase } from './src/vector';
import { LocalEmbeddingProvider } from './src/main/services/EmbeddingProvider';

// Create embedding provider
const embeddingProvider = new LocalEmbeddingProvider();

// Create vector database
const vectorDb = createVectorDatabase({
  workspacePath: '/path/to/workspace',
  embeddingProvider,
  cacheEnabled: true,
  cacheSize: 100, // 100MB cache
  chunkSize: 1000,
  chunkOverlap: 200
});

// Initialize
await vectorDb.initialize('/path/to/workspace', embeddingProvider);

// Index a document
const document = {
  id: 'doc1',
  content: 'Machine learning is a powerful tool for data analysis...',
  metadata: {
    title: 'ML Introduction',
    tags: ['ai', 'machine-learning'],
    fileType: 'markdown'
  }
};

await vectorDb.upsertDocument(document, { generateChunks: true });

// Search documents
const results = await vectorDb.hybridSearch('machine learning algorithms', {
  limit: 10,
  semanticWeight: 0.7,
  keywordWeight: 0.3,
  includeHighlights: true,
  filterTags: ['ai']
});

console.log(`Found ${results.length} results`);
results.forEach(result => {
  console.log(`${result.metadata?.title}: ${result.score.toFixed(3)}`);
});
```

### Advanced Configuration

```typescript
import { VectorDatabase } from './src/vector';
import { OpenAIEmbeddingProvider } from './src/main/services/EmbeddingProvider';

const embeddingProvider = new OpenAIEmbeddingProvider('your-api-key');

const vectorDb = new VectorDatabase({
  workspacePath: '/path/to/workspace',
  embeddingProvider,
  chunkSize: 800,
  chunkOverlap: 150,
  cacheConfig: {
    enabled: true,
    maxSize: 200 * 1024 * 1024, // 200MB
    ttl: 12 * 60 * 60 * 1000,   // 12 hours
    strategy: 'lru'
  },
  indexingBatchSize: 20,
  enableIncrementalIndexing: true,
  enableParallelProcessing: true,
  maxRetries: 5
});

await vectorDb.initialize('/path/to/workspace', embeddingProvider);
```

## 🔍 Search Options

### Hybrid Search

```typescript
const searchOptions = {
  limit: 15,
  threshold: 0.1,
  semanticWeight: 0.6,        // Semantic search weight
  keywordWeight: 0.4,         // Keyword search weight
  includeChunks: true,        // Include document chunks
  includeHighlights: true,    // Include search highlights
  filterTags: ['research'],   // Filter by tags
  filterFileTypes: ['pdf'],   // Filter by file types
  dateRange: {                // Filter by date range
    from: '2024-01-01',
    to: '2024-12-31'
  },
  sortBy: 'score',            // Sort by: score, date, relevance
  sortOrder: 'desc',          // Sort order: asc, desc
  boostRecent: true,          // Boost recently modified docs
  boostFrequent: true         // Boost frequently accessed docs
};

const results = await vectorDb.hybridSearch('query', searchOptions);
```

### Semantic-Only Search

```typescript
const results = await vectorDb.semanticSearch('artificial intelligence', {
  limit: 5,
  threshold: 0.2,
  includeChunks: true
});
```

### Keyword-Only Search

```typescript
const results = await vectorDb.keywordSearch('machine learning', {
  limit: 10,
  filterTags: ['tutorial']
});
```

## 📈 Performance Features

### Batch Operations

```typescript
const documents = [
  { id: 'doc1', content: 'Content 1...', metadata: { title: 'Doc 1' } },
  { id: 'doc2', content: 'Content 2...', metadata: { title: 'Doc 2' } },
  // ... more documents
];

const result = await vectorDb.batchUpsertDocuments(documents, {
  batchSize: 10,
  parallel: true
});

console.log(`Indexed: ${result.successful}, Failed: ${result.failed}`);
console.log(`Throughput: ${(result.successful / (result.duration / 1000)).toFixed(2)} docs/sec`);
```

### Performance Benchmarking

```typescript
import { VectorDatabaseBenchmark } from './src/vector';

const benchmark = new VectorDatabaseBenchmark(vectorDb);

// Benchmark search performance
const searchBenchmark = await benchmark.benchmarkSearch([
  'machine learning',
  'artificial intelligence',
  'data science'
], 10);

console.log(`Average search time: ${searchBenchmark.averageSearchTime.toFixed(2)}ms`);

// Benchmark indexing performance  
const indexBenchmark = await benchmark.benchmarkIndexing(testDocuments, 5);
console.log(`Indexing throughput: ${indexBenchmark.throughput.toFixed(2)} docs/sec`);
```

### Database Optimization

```typescript
// Optimize database for better performance
await vectorDb.optimizeDatabase();

// Get comprehensive statistics
const stats = await vectorDb.getEnhancedStats();
console.log('Database Stats:', {
  documents: stats.documentCount,
  embeddings: stats.embeddingCount,
  cacheHitRate: `${(stats.performance.cacheHitRate * 100).toFixed(1)}%`,
  avgSearchTime: `${stats.performance.avgSearchTime.toFixed(2)}ms`
});
```

## 🧠 Intelligent Features

### Document Chunking

The system automatically chunks documents intelligently:

```typescript
// Document chunking with advanced options
await vectorDb.upsertDocument(document, {
  generateChunks: true,
  forceReindex: false
});

// Chunks are automatically:
// - Split by sentences, paragraphs, or tokens
// - Analyzed for content type (code, header, list, table)
// - Scored for importance
// - Given metadata about language and structure
```

### Caching System

Multi-level caching for optimal performance:

- **Embedding Cache**: Caches generated embeddings by content hash
- **Search Cache**: Caches search results by query and options
- **Configurable Strategies**: LRU, LFU, FIFO cache eviction
- **TTL Support**: Time-based cache expiration
- **Memory Management**: Automatic cleanup and size limits

### Incremental Indexing

Only processes changed documents:

```typescript
// Automatically detects changes via content checksums
await vectorDb.upsertDocument(document); // Only indexes if content changed

// Check what needs indexing
const toIndex = await vectorDb.getDocumentsToIndex(filePaths);
console.log(`${toIndex.filter(d => d.needsIndexing).length} files need indexing`);
```

## 🛡️ Error Handling

Robust error handling with retry mechanisms:

```typescript
try {
  await vectorDb.batchUpsertDocuments(documents);
} catch (error) {
  console.error('Batch indexing failed:', error);
  // System automatically retries failed operations
  // Check error details in batch result
}
```

## 📊 Database Schema

The enhanced vector database uses an optimized SQLite schema:

### Core Tables
- **documents**: Document content and metadata
- **embeddings**: Vector embeddings with provider info
- **document_chunks**: Document chunks with embeddings
- **keywords**: Extracted keywords with TF-IDF scores
- **tags**: Document tags with weights

### Performance Tables
- **search_history**: Search query history and metrics
- **performance_metrics**: System performance tracking
- **indexing_queue**: Background indexing queue

### Optimization Features
- Comprehensive indexes for fast queries
- Foreign key constraints for data integrity
- WAL mode for better concurrent access
- Memory-optimized settings

## 🔧 Configuration Options

### Database Configuration

```typescript
interface DatabaseConfig {
  workspacePath: string;           // Workspace directory
  embeddingProvider: EmbeddingProvider;
  chunkSize: number;               // Document chunk size (default: 1000)
  chunkOverlap: number;            // Chunk overlap (default: 200)
  cacheConfig: CacheConfig;        // Caching configuration
  indexingBatchSize: number;       // Batch processing size (default: 10)
  enableIncrementalIndexing: boolean; // Enable incremental indexing
  enableParallelProcessing: boolean;  // Enable parallel operations
  maxRetries: number;              // Maximum retry attempts (default: 3)
}
```

### Cache Configuration

```typescript
interface CacheConfig {
  enabled: boolean;                // Enable caching
  maxSize: number;                 // Maximum cache size in bytes
  ttl: number;                     // Time-to-live in milliseconds
  strategy: 'lru' | 'lfu' | 'fifo'; // Eviction strategy
}
```

## 🧪 Testing & Examples

Comprehensive examples are provided in `src/vector/examples/usage.ts`:

1. **Basic Usage**: Simple document indexing and search
2. **Advanced Search**: Hybrid search with filtering
3. **Batch Operations**: High-performance batch processing
4. **Benchmarking**: Performance measurement
5. **Error Handling**: Robust error recovery
6. **Cache Management**: Cache optimization strategies

Run examples:
```typescript
import { runAllExamples } from './src/vector/examples/usage';
await runAllExamples();
```

## 🚦 Best Practices

### Performance Optimization
1. **Use caching**: Enable caching for repeated operations
2. **Batch operations**: Process documents in batches for better throughput
3. **Optimize chunk size**: Balance between context and performance (800-1200 chars)
4. **Regular optimization**: Run database optimization periodically
5. **Monitor metrics**: Track performance metrics for bottlenecks

### Memory Management
1. **Configure cache size**: Set appropriate cache limits for your system
2. **Use incremental indexing**: Only process changed documents
3. **Clean up**: Close database connections when done
4. **Monitor usage**: Track memory usage through stats

### Search Quality
1. **Hybrid search**: Use both semantic and keyword search for best results
2. **Adjust weights**: Tune semantic/keyword weights for your use case
3. **Filter appropriately**: Use tags and metadata for precise results
4. **Boost strategies**: Enable recent/frequent boosting when relevant

## 🔍 Monitoring & Debugging

### Database Statistics

```typescript
const stats = await vectorDb.getEnhancedStats();
console.log('Performance Metrics:', {
  avgSearchTime: stats.performance.avgSearchTime,
  cacheHitRate: stats.performance.cacheHitRate,
  indexStatus: stats.indexStatus
});
```

### Cache Performance

```typescript
// Monitor cache performance
const embeddingCacheStats = vectorDb.embeddingCache.getStats();
const searchCacheStats = vectorDb.searchCache.getStats();

console.log(`Embedding Cache: ${embeddingCacheStats.hitRate.toFixed(2)} hit rate`);
console.log(`Search Cache: ${searchCacheStats.hitRate.toFixed(2)} hit rate`);
```

## 🤝 Integration with KnowledgeOS

The enhanced vector database integrates seamlessly with KnowledgeOS:

- **Workspace Integration**: Automatically indexes workspace files
- **Real-time Updates**: Monitors file changes for incremental indexing  
- **UI Integration**: Powers search functionality in the application
- **Performance Dashboard**: Provides metrics through the analytics system

## 📝 API Reference

### Core Methods

- `initialize(workspacePath, embeddingProvider)`: Initialize database
- `upsertDocument(document, options)`: Index or update document
- `hybridSearch(query, options)`: Perform hybrid search
- `semanticSearch(query, options)`: Perform semantic search
- `keywordSearch(query, options)`: Perform keyword search
- `batchUpsertDocuments(documents, options)`: Batch document processing
- `optimizeDatabase()`: Optimize database performance
- `getEnhancedStats()`: Get comprehensive statistics
- `close()`: Close database connection

### Utility Classes

- `TextChunker`: Advanced document chunking
- `SimilarityCalculator`: Similarity metrics and calculations
- `EmbeddingCache`: High-performance caching
- `VectorDatabaseBenchmark`: Performance benchmarking

## 📋 Migration Guide

When upgrading from the basic VectorDatabase:

1. **Import Changes**: Update imports to use new enhanced version
2. **Configuration**: Review and update configuration options
3. **API Updates**: Some method signatures have additional options
4. **Performance**: Take advantage of new caching and batch features
5. **Monitoring**: Use enhanced statistics and benchmarking

## 🔮 Future Enhancements

Planned improvements include:

- **Advanced Indexing**: HNSW and IVF indexes for larger datasets
- **Distributed Processing**: Multi-node processing capabilities  
- **Advanced NLP**: Named entity recognition and sentiment analysis
- **Graph Relationships**: Advanced document relationship modeling
- **API Server**: REST API for remote access
- **Cloud Storage**: Support for cloud-based storage backends

---

This enhanced vector database provides enterprise-grade performance and features while maintaining simplicity and ease of use. It's designed to scale with your knowledge management needs and provide the best possible search experience.