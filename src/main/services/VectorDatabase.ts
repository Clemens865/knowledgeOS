import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

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

export class VectorDatabase {
  private db: Database.Database | null = null;
  private workspacePath: string = '';
  private dbPath: string = '';

  /**
   * Initialize database for a specific workspace
   * Creates .knowledge.db in the workspace root
   */
  async initialize(workspacePath: string): Promise<void> {
    this.workspacePath = workspacePath;
    this.dbPath = path.join(this.workspacePath, '.knowledge.db');
    
    // Create database file if it doesn't exist
    this.db = new Database(this.dbPath);
    
    // Enable foreign keys
    this.db.exec('PRAGMA foreign_keys = ON');
    
    // Create tables
    await this.createTables();
    
    // Create indexes for better performance
    await this.createIndexes();
    
    console.log(`Vector database initialized at: ${this.dbPath}`);
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Documents table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        title TEXT,
        path TEXT UNIQUE,
        file_type TEXT,
        checksum TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        modified_at DATETIME,
        indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        access_count INTEGER DEFAULT 0,
        last_accessed DATETIME
      )
    `);

    // Embeddings table - store vectors as JSON for simplicity
    // In production, you might want to use a specialized vector extension
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS embeddings (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        embedding TEXT NOT NULL,  -- JSON array of numbers
        provider TEXT NOT NULL,
        dimension INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
      )
    `);

    // Document chunks for large files
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT,  -- JSON array
        start_pos INTEGER,
        end_pos INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        UNIQUE(document_id, chunk_index)
      )
    `);

    // Tags table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        UNIQUE(document_id, tag)
      )
    `);

    // Search history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS search_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        results_count INTEGER,
        search_type TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  private async createIndexes(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Create indexes for better query performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_documents_path ON documents(path);
      CREATE INDEX IF NOT EXISTS idx_documents_checksum ON documents(checksum);
      CREATE INDEX IF NOT EXISTS idx_documents_access_count ON documents(access_count);
      CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON embeddings(document_id);
      CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON document_chunks(document_id);
      CREATE INDEX IF NOT EXISTS idx_tags_document_id ON tags(document_id);
      CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
    `);
  }

  /**
   * Add or update a document with its embedding
   */
  async upsertDocument(doc: VectorDocument, embedding: number[], provider: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const checksum = this.calculateChecksum(doc.content);
    
    // Start transaction
    const transaction = this.db.transaction(() => {
      // Upsert document
      const docStmt = this.db!.prepare(`
        INSERT INTO documents (id, content, title, path, file_type, checksum, modified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          content = excluded.content,
          title = excluded.title,
          checksum = excluded.checksum,
          modified_at = excluded.modified_at,
          indexed_at = CURRENT_TIMESTAMP
      `);
      
      docStmt.run(
        doc.id,
        doc.content,
        doc.metadata?.title || null,
        doc.metadata?.path || null,
        doc.metadata?.fileType || 'text',
        checksum,
        doc.metadata?.modifiedAt || new Date().toISOString()
      );

      // Delete old embedding if exists
      this.db!.prepare('DELETE FROM embeddings WHERE document_id = ?').run(doc.id);
      
      // Insert new embedding
      const embStmt = this.db!.prepare(`
        INSERT INTO embeddings (id, document_id, embedding, provider, dimension)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      embStmt.run(
        `${doc.id}_emb`,
        doc.id,
        JSON.stringify(embedding),
        provider,
        embedding.length
      );

      // Handle tags if present
      if (doc.metadata?.tags && doc.metadata.tags.length > 0) {
        // Delete old tags
        this.db!.prepare('DELETE FROM tags WHERE document_id = ?').run(doc.id);
        
        // Insert new tags
        const tagStmt = this.db!.prepare('INSERT INTO tags (document_id, tag) VALUES (?, ?)');
        for (const tag of doc.metadata.tags) {
          tagStmt.run(doc.id, tag);
        }
      }
    });

    transaction();
  }

  /**
   * Get all documents that need indexing or re-indexing
   */
  async getDocumentsToIndex(paths: string[]): Promise<Array<{path: string; needsIndexing: boolean}>> {
    if (!this.db) throw new Error('Database not initialized');

    const results: Array<{path: string; needsIndexing: boolean}> = [];
    
    for (const filePath of paths) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const checksum = this.calculateChecksum(content);
      
      const existing = this.db.prepare(
        'SELECT checksum, indexed_at FROM documents WHERE path = ?'
      ).get(filePath) as any;
      
      if (!existing || existing.checksum !== checksum) {
        results.push({ path: filePath, needsIndexing: true });
      } else {
        results.push({ path: filePath, needsIndexing: false });
      }
    }
    
    return results;
  }

  /**
   * Search for similar documents using cosine similarity
   */
  async search(queryEmbedding: number[], limit: number = 5): Promise<SearchResult[]> {
    if (!this.db) throw new Error('Database not initialized');

    // Get all embeddings
    const rows = this.db.prepare(`
      SELECT 
        d.id, d.content, d.title, d.path, d.file_type,
        d.created_at, d.modified_at,
        e.embedding
      FROM documents d
      JOIN embeddings e ON d.id = e.document_id
    `).all() as any[];

    const results: SearchResult[] = [];
    
    for (const row of rows) {
      const docEmbedding = JSON.parse(row.embedding) as number[];
      const score = this.cosineSimilarity(queryEmbedding, docEmbedding);
      
      // Get tags for this document
      const tags = this.db.prepare(
        'SELECT tag FROM tags WHERE document_id = ?'
      ).all(row.id).map((t: any) => t.tag);
      
      results.push({
        id: row.id,
        content: row.content.substring(0, 500), // Truncate for display
        score,
        metadata: {
          title: row.title,
          path: row.path,
          fileType: row.file_type,
          tags,
          createdAt: row.created_at,
          modifiedAt: row.modified_at
        }
      });
    }
    
    // Sort by score and return top results
    results.sort((a, b) => b.score - a.score);
    
    // Log search to history
    this.db.prepare(`
      INSERT INTO search_history (query, results_count, search_type)
      VALUES ('semantic_search', ?, 'semantic')
    `).run(Math.min(results.length, limit));
    
    return results.slice(0, limit);
  }

  /**
   * Keyword search in documents
   */
  async keywordSearch(keywords: string[], limit: number = 5): Promise<SearchResult[]> {
    if (!this.db) throw new Error('Database not initialized');

    const placeholders = keywords.map(() => '?').join(' OR content LIKE ');
    const searchParams = keywords.map(k => `%${k}%`);
    
    const rows = this.db.prepare(`
      SELECT id, content, title, path, file_type, created_at, modified_at
      FROM documents
      WHERE content LIKE ${placeholders}
      LIMIT ?
    `).all(...searchParams, limit) as any[];
    
    const results: SearchResult[] = rows.map(row => ({
      id: row.id,
      content: row.content.substring(0, 500),
      score: this.calculateKeywordScore(row.content, keywords),
      metadata: {
        title: row.title,
        path: row.path,
        fileType: row.file_type,
        createdAt: row.created_at,
        modifiedAt: row.modified_at
      }
    }));
    
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');

    const stats = {
      databasePath: this.dbPath,
      databaseSize: fs.existsSync(this.dbPath) 
        ? (fs.statSync(this.dbPath).size / 1024 / 1024).toFixed(2) + ' MB'
        : '0 MB',
      documentCount: (this.db.prepare('SELECT COUNT(*) as count FROM documents').get() as any).count,
      embeddingCount: (this.db.prepare('SELECT COUNT(*) as count FROM embeddings').get() as any).count,
      chunkCount: (this.db.prepare('SELECT COUNT(*) as count FROM document_chunks').get() as any).count,
      uniqueTags: (this.db.prepare('SELECT COUNT(DISTINCT tag) as count FROM tags').get() as any).count,
      searchHistory: (this.db.prepare('SELECT COUNT(*) as count FROM search_history').get() as any).count,
      lastIndexed: (this.db.prepare('SELECT MAX(indexed_at) as last FROM documents').get() as any).last
    };
    
    return stats;
  }

  /**
   * Clear all data from database
   */
  async clear(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec(`
      DELETE FROM search_history;
      DELETE FROM tags;
      DELETE FROM document_chunks;
      DELETE FROM embeddings;
      DELETE FROM documents;
    `);
  }

  /**
   * Remove a document and its embeddings
   */
  async removeDocument(documentId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    // Cascading delete will remove related embeddings, chunks, and tags
    this.db.prepare('DELETE FROM documents WHERE id = ?').run(documentId);
  }

  /**
   * Get all indexed file paths
   */
  async getIndexedPaths(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const rows = this.db.prepare('SELECT path FROM documents WHERE path IS NOT NULL').all() as any[];
    return rows.map(r => r.path);
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
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

  private calculateKeywordScore(content: string, keywords: string[]): number {
    const lowerContent = content.toLowerCase();
    let score = 0;
    
    for (const keyword of keywords) {
      const regex = new RegExp(keyword.toLowerCase(), 'g');
      const matches = lowerContent.match(regex);
      if (matches) {
        score += matches.length;
      }
    }
    
    // Normalize by content length and keyword count
    return score / (Math.sqrt(content.length) * keywords.length);
  }
}