# Semantic Search Improvements Plan

## 1. SQLite Vector Database Implementation

### Install Dependencies
```bash
npm install sqlite3 sqlite-vec
```

### Database Schema
```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  content TEXT,
  title TEXT,
  path TEXT,
  file_type TEXT,
  created_at DATETIME,
  modified_at DATETIME,
  indexed_at DATETIME
);

CREATE TABLE embeddings (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  embedding BLOB,  -- Store as binary for efficiency
  provider TEXT,
  dimension INTEGER,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  chunk_index INTEGER,
  content TEXT,
  embedding BLOB,
  FOREIGN KEY (document_id) REFERENCES documents(id)
);
```

## 2. File Selection UI

### Features
- File tree view with checkboxes
- Filter by file type (.md, .txt, .pdf, .docx, .js, .ts, .py)
- Bulk select/deselect
- Show indexing status per file
- Preview before indexing

### Implementation
```typescript
interface IndexingOptions {
  includePatterns: string[];  // ['**/*.md', '**/*.txt']
  excludePatterns: string[];  // ['**/node_modules/**', '**/.git/**']
  fileTypes: string[];         // ['markdown', 'text', 'code', 'pdf']
  maxFileSize: number;         // Skip files larger than X MB
  incrementalUpdate: boolean;  // Only re-index changed files
}
```

## 3. Document Chunking Strategy

### Why Chunking?
- Large documents exceed context windows
- Better granularity in search results
- More accurate semantic matching

### Implementation
```typescript
interface ChunkingStrategy {
  method: 'sliding_window' | 'sentence' | 'paragraph' | 'semantic';
  maxChunkSize: number;      // 512 tokens
  overlapSize: number;       // 50 tokens
  preserveBoundaries: boolean; // Don't split mid-sentence
}

function chunkDocument(content: string, strategy: ChunkingStrategy): string[] {
  // Smart chunking that preserves context
  // Each chunk gets embedded separately
  // Search returns best matching chunks
}
```

## 4. Incremental Indexing

### Track File Changes
```typescript
interface FileMetadata {
  path: string;
  lastModified: Date;
  lastIndexed: Date;
  checksum: string;  // MD5 hash of content
}

async function needsReindexing(file: FileMetadata): boolean {
  const currentStats = await fs.stat(file.path);
  return currentStats.mtime > file.lastIndexed;
}
```

## 5. Multi-Format Support

### PDF Processing
```typescript
import * as pdfParse from 'pdf-parse';

async function extractPdfText(buffer: Buffer): Promise<string> {
  const data = await pdfParse(buffer);
  return data.text;
}
```

### Office Documents
```typescript
import * as mammoth from 'mammoth';

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
```

### Code Files
```typescript
// Extract docstrings, comments, and function signatures
function extractCodeContext(code: string, language: string): string {
  // Parse AST and extract meaningful content
  // Include function/class names, docstrings, comments
}
```

## 6. Advanced Search Features

### Hybrid Search Improvements
```typescript
interface SearchOptions {
  mode: 'semantic' | 'keyword' | 'hybrid';
  weights: {
    semantic: number;  // 0.7
    keyword: number;   // 0.3
  };
  filters: {
    fileTypes?: string[];
    dateRange?: { from: Date; to: Date };
    tags?: string[];
  };
  rerank?: boolean;  // Use cross-encoder for reranking
}
```

### Search Result Enhancement
```typescript
interface EnhancedSearchResult {
  id: string;
  content: string;
  highlights: string[];     // Relevant snippets
  context: string;          // Surrounding text
  score: number;
  explanation: string;      // Why this matched
  relatedDocuments: string[]; // Similar documents
}
```

## 7. Performance Optimizations

### Batch Processing
```typescript
// Process embeddings in batches
async function batchEmbed(texts: string[], batchSize = 10): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchEmbeddings = await Promise.all(
      batch.map(text => provider.generateEmbedding(text))
    );
    embeddings.push(...batchEmbeddings);
  }
  return embeddings;
}
```

### Caching Layer
```typescript
class EmbeddingCache {
  private cache: LRUCache<string, number[]>;
  
  constructor(maxSize: number = 1000) {
    this.cache = new LRUCache({ max: maxSize });
  }
  
  async getEmbedding(text: string): Promise<number[]> {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    if (this.cache.has(hash)) {
      return this.cache.get(hash)!;
    }
    const embedding = await provider.generateEmbedding(text);
    this.cache.set(hash, embedding);
    return embedding;
  }
}
```

## 8. UI/UX Enhancements

### Visual Feedback
- Progress bar during indexing
- Real-time document count
- Estimated time remaining
- Memory usage indicator

### Search Interface
- Search history
- Saved searches
- Search suggestions
- Faceted filtering
- Export results

## Implementation Priority

1. **Phase 1** (High Priority)
   - SQLite vector database
   - File selector UI
   - Incremental indexing

2. **Phase 2** (Medium Priority)
   - Document chunking
   - Multi-format support (PDF, DOCX)
   - Advanced search options

3. **Phase 3** (Nice to Have)
   - Performance optimizations
   - Caching layer
   - Search analytics
   - Related documents

## Estimated Implementation Time
- Phase 1: 2-3 days
- Phase 2: 3-4 days  
- Phase 3: 2-3 days

## Benefits
- **Persistence**: Embeddings survive app restarts
- **Scalability**: Handle thousands of documents
- **Flexibility**: Index any file type
- **Performance**: Faster searches with indexing
- **User Control**: Choose what to index