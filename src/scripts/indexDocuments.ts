#!/usr/bin/env node

/**
 * Simple document indexing script for KnowledgeOS
 * 
 * This script indexes markdown files from the knowledge base into the vector database.
 * It handles chunking, embedding generation, and progress reporting.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { VectorDatabase } from '../main/services/VectorDatabase';
import { LocalEmbeddingProvider } from '../main/services/EmbeddingProvider';

interface IndexingOptions {
  knowledgeBasePath: string;
  workspacePath: string;
  filePattern: string;
  chunkSize: number;
  overlapSize: number;
  showProgress: boolean;
  forceReindex: boolean;
}

interface IndexingStats {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  failedFiles: number;
  totalChunks: number;
  startTime: number;
  errors: Array<{file: string; error: string}>;
}

class DocumentIndexer {
  private db: VectorDatabase;
  private embeddingProvider: LocalEmbeddingProvider;
  private stats: IndexingStats;

  constructor() {
    this.db = new VectorDatabase();
    this.embeddingProvider = new LocalEmbeddingProvider();
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      failedFiles: 0,
      totalChunks: 0,
      startTime: Date.now(),
      errors: []
    };
  }

  /**
   * Main indexing function
   */
  async indexDocuments(options: IndexingOptions): Promise<void> {
    console.log('🚀 Starting KnowledgeOS document indexing...');
    console.log(`📁 Knowledge base: ${options.knowledgeBasePath}`);
    console.log(`💾 Workspace: ${options.workspacePath}`);
    console.log('');

    try {
      // Initialize database
      await this.initializeDatabase(options.workspacePath);

      // Initialize embedding provider
      await this.initializeEmbeddingProvider();

      // Find all markdown files
      const files = await this.findMarkdownFiles(options.knowledgeBasePath, options.filePattern);
      this.stats.totalFiles = files.length;

      console.log(`📄 Found ${files.length} markdown files to process`);

      if (files.length === 0) {
        console.log('❌ No files found matching pattern');
        return;
      }

      // Process each file
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (options.showProgress) {
          this.showProgress(i + 1, file);
        }

        try {
          await this.processFile(file, options);
          this.stats.processedFiles++;
        } catch (error) {
          console.error(`❌ Failed to process ${file}: ${error}`);
          this.stats.failedFiles++;
          this.stats.errors.push({
            file,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Show final stats
      await this.showFinalStats();

    } catch (error) {
      console.error('💥 Indexing failed:', error);
      throw error;
    } finally {
      // Clean up
      this.db.close();
    }
  }

  /**
   * Initialize the vector database
   */
  private async initializeDatabase(workspacePath: string): Promise<void> {
    console.log('🔧 Initializing vector database...');
    
    // Ensure workspace directory exists
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    await this.db.initialize(workspacePath);
    console.log('✅ Vector database initialized');
  }

  /**
   * Initialize the embedding provider
   */
  private async initializeEmbeddingProvider(): Promise<void> {
    console.log('🧠 Loading embedding model (this may take a moment on first run)...');
    await this.embeddingProvider.initialize();
    console.log('✅ Embedding provider ready');
  }

  /**
   * Find all markdown files in the knowledge base
   */
  private async findMarkdownFiles(basePath: string, pattern: string): Promise<string[]> {
    const files: string[] = [];
    
    if (!fs.existsSync(basePath)) {
      throw new Error(`Knowledge base path does not exist: ${basePath}`);
    }

    const searchDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          searchDir(fullPath);
        } else if (entry.isFile() && this.matchesPattern(entry.name, pattern)) {
          files.push(fullPath);
        }
      }
    };

    searchDir(basePath);
    return files.sort(); // Sort for consistent processing order
  }

  /**
   * Check if filename matches the pattern
   */
  private matchesPattern(filename: string, pattern: string): boolean {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(filename);
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string, options: IndexingOptions): Promise<void> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const stats = fs.statSync(filePath);
    
    // Create document ID from file path (relative to knowledge base)
    const relativePath = path.relative(options.knowledgeBasePath, filePath);
    const documentId = this.createDocumentId(relativePath);

    // Check if we need to reindex
    if (!options.forceReindex) {
      const needsReindex = await this.needsReindexing(filePath, content);
      if (!needsReindex) {
        this.stats.skippedFiles++;
        return;
      }
    }

    // Extract metadata
    const metadata = this.extractMetadata(filePath, content, stats);

    // Create chunks for better search
    const chunks = this.createTextChunks(content, options.chunkSize, options.overlapSize);
    this.stats.totalChunks += chunks.length;

    // For each chunk, generate embedding and store
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = `${documentId}_chunk_${i}`;
      
      // Generate embedding for chunk
      const embedding = await this.embeddingProvider.generateEmbedding(chunk);
      
      // Create document object
      const doc = {
        id: chunkId,
        content: chunk,
        metadata: {
          ...metadata,
          title: `${metadata.title} (Part ${i + 1})`,
          chunkIndex: i,
          totalChunks: chunks.length,
          originalDocumentId: documentId
        }
      };

      // Store in database
      await this.db.upsertDocument(doc, embedding, this.embeddingProvider.getName());
    }

    // Also store the full document
    const fullEmbedding = await this.embeddingProvider.generateEmbedding(
      content.substring(0, 8000) // Limit to first 8k chars for embedding
    );
    
    const fullDoc = {
      id: documentId,
      content,
      metadata
    };

    await this.db.upsertDocument(fullDoc, fullEmbedding, this.embeddingProvider.getName());
  }

  /**
   * Create document ID from file path
   */
  private createDocumentId(relativePath: string): string {
    // Remove extension and normalize path separators
    const normalized = relativePath.replace(/\.[^.]+$/, '').replace(/[/\\]/g, '_');
    return `doc_${crypto.createHash('md5').update(normalized).digest('hex').substring(0, 8)}_${normalized}`;
  }

  /**
   * Check if file needs reindexing based on modification time and checksum
   */
  private async needsReindexing(filePath: string, content: string): Promise<boolean> {
    try {
      const checksum = crypto.createHash('md5').update(content).digest('hex');
      const indexingInfo = await this.db.getDocumentsToIndex([filePath]);
      
      return indexingInfo.length === 0 || indexingInfo[0]?.needsIndexing === true;
    } catch (error) {
      // If we can't determine, err on the side of reindexing
      return true;
    }
  }

  /**
   * Extract metadata from file
   */
  private extractMetadata(filePath: string, content: string, stats: fs.Stats) {
    const basename = path.basename(filePath);
    const title = basename.replace(/\.[^.]+$/, ''); // Remove extension
    
    // Try to extract title from first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    const extractedTitle = headingMatch ? headingMatch[1].trim() : title;

    // Extract tags from content (look for #tag patterns)
    const tagMatches = content.match(/#[\w-]+/g) || [];
    const tags = [...new Set(tagMatches.map(tag => tag.substring(1)))]; // Remove # and dedupe

    return {
      title: extractedTitle,
      path: filePath,
      fileType: 'markdown',
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      createdAt: stats.ctime.toISOString(),
      tags: tags.length > 0 ? tags : undefined,
      checksum: crypto.createHash('md5').update(content).digest('hex')
    };
  }

  /**
   * Create text chunks with overlap for better context
   */
  private createTextChunks(text: string, chunkSize: number, overlapSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    let currentSize = 0;

    for (const sentence of sentences) {
      const sentenceWithPunctuation = sentence.trim() + '.';
      
      if (currentSize + sentenceWithPunctuation.length > chunkSize && currentChunk.length > 0) {
        // Save current chunk
        chunks.push(currentChunk.trim());
        
        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, overlapSize);
        currentChunk = overlapText + ' ' + sentenceWithPunctuation;
        currentSize = currentChunk.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentenceWithPunctuation;
        currentSize = currentChunk.length;
      }
    }

    // Add the last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks.filter(chunk => chunk.length > 50); // Filter out very small chunks
  }

  /**
   * Get overlap text from the end of a chunk
   */
  private getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // Try to get overlap that ends on a word boundary
    const overlapText = text.substring(text.length - overlapSize);
    const spaceIndex = overlapText.indexOf(' ');
    
    return spaceIndex > 0 ? overlapText.substring(spaceIndex + 1) : overlapText;
  }

  /**
   * Show indexing progress
   */
  private showProgress(current: number, currentFile: string): void {
    const percentage = ((current / this.stats.totalFiles) * 100).toFixed(1);
    const filename = path.basename(currentFile);
    
    process.stdout.write(`\r⏳ [${percentage}%] Processing: ${filename}${' '.repeat(50)}`);
  }

  /**
   * Show final indexing statistics
   */
  private async showFinalStats(): Promise<void> {
    console.log('\n');
    console.log('📊 Indexing Complete!');
    console.log('================================');
    
    const duration = (Date.now() - this.stats.startTime) / 1000;
    
    console.log(`📄 Files processed: ${this.stats.processedFiles}`);
    console.log(`⏭️  Files skipped: ${this.stats.skippedFiles}`);
    console.log(`❌ Files failed: ${this.stats.failedFiles}`);
    console.log(`🧩 Total chunks created: ${this.stats.totalChunks}`);
    console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
    
    // Show database stats
    try {
      const dbStats = await this.db.getStats();
      console.log(`💾 Database size: ${dbStats.databaseSize}`);
      console.log(`📚 Total documents: ${dbStats.documentCount}`);
      console.log(`🧠 Total embeddings: ${dbStats.embeddingCount}`);
    } catch (error) {
      console.warn('⚠️  Could not retrieve database stats');
    }

    // Show errors if any
    if (this.stats.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      for (const error of this.stats.errors) {
        console.log(`   ${path.basename(error.file)}: ${error.error}`);
      }
    }

    console.log('\n✅ Indexing completed successfully!');
  }
}

/**
 * Main execution function
 */
async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  
  // Default options
  const options: IndexingOptions = {
    knowledgeBasePath: '/Users/clemenshoenig/Documents/My-Knowledge_Test/notes',
    workspacePath: '/Users/clemenshoenig/Documents/My-Coding-Programs/Knowledge OS',
    filePattern: '*.md',
    chunkSize: 1000,
    overlapSize: 200,
    showProgress: true,
    forceReindex: false
  };

  // Simple argument parsing
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--knowledge-path':
        options.knowledgeBasePath = args[i + 1];
        i++; // Skip next arg as it's the value
        break;
      case '--workspace':
        options.workspacePath = args[i + 1];
        i++;
        break;
      case '--pattern':
        options.filePattern = args[i + 1];
        i++;
        break;
      case '--chunk-size':
        options.chunkSize = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--overlap':
        options.overlapSize = parseInt(args[i + 1], 10);
        i++;
        break;
      case '--force':
        options.forceReindex = true;
        break;
      case '--quiet':
        options.showProgress = false;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
    }
  }

  // Validate options
  if (!fs.existsSync(options.knowledgeBasePath)) {
    console.error(`❌ Knowledge base path does not exist: ${options.knowledgeBasePath}`);
    process.exit(1);
  }

  try {
    const indexer = new DocumentIndexer();
    await indexer.indexDocuments(options);
  } catch (error) {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  }
}

/**
 * Show help information
 */
function showHelp() {
  console.log(`
KnowledgeOS Document Indexer

Usage: node indexDocuments.js [options]

Options:
  --knowledge-path PATH   Path to the knowledge base directory
                         (default: /Users/clemenshoenig/Documents/My-Knowledge_Test/notes)
  --workspace PATH        Path to the workspace directory
                         (default: /Users/clemenshoenig/Documents/My-Coding-Programs/Knowledge OS)
  --pattern PATTERN       File pattern to match (default: *.md)
  --chunk-size SIZE       Size of text chunks in characters (default: 1000)
  --overlap SIZE          Overlap between chunks in characters (default: 200)
  --force                 Force reindexing of all files
  --quiet                 Disable progress output
  --help                  Show this help message

Examples:
  # Index all markdown files with default settings
  node indexDocuments.js
  
  # Index with custom chunk size and force reindexing
  node indexDocuments.js --chunk-size 1500 --force
  
  # Index specific directory with different pattern
  node indexDocuments.js --knowledge-path /path/to/docs --pattern "*.txt"
`);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}