import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

interface SearchPattern {
  id?: number;
  query: string;
  files: string; // JSON string of string array
  success_count: number;
  total_count: number;
  success_rate: number;
  last_used: string;
  created_at: string;
}

interface SearchSuggestion {
  pattern: string;
  files: string[];
  success_rate: number;
  confidence: number;
}

interface FrequentPattern {
  query: string;
  files: string;
  success_rate: string;
}

export class SearchMemory {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Store database in userData directory for persistence across sessions
    this.dbPath = path.join(app.getPath('userData'), 'search_memory.db');
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  private initializeDatabase(): void {
    try {
      // Create search patterns table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS search_patterns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          query TEXT NOT NULL,
          files TEXT NOT NULL,
          success_count INTEGER DEFAULT 0,
          total_count INTEGER DEFAULT 0,
          success_rate REAL DEFAULT 0,
          last_used DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create index for faster queries
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_search_patterns_query 
        ON search_patterns(query)
      `);
      
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_search_patterns_last_used 
        ON search_patterns(last_used DESC)
      `);

      console.log('SearchMemory database initialized');
    } catch (error) {
      console.error('Failed to initialize SearchMemory database:', error);
    }
  }

  /**
   * Record a search operation and its results
   */
  async recordSearch(query: string, files: string[], wasSuccessful: boolean = true): Promise<void> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      const filesJson = JSON.stringify(files.sort());
      
      // Check if pattern already exists
      const existing = this.db.prepare(
        'SELECT * FROM search_patterns WHERE query = ? AND files = ?'
      ).get(normalizedQuery, filesJson) as SearchPattern | undefined;

      if (existing) {
        // Update existing pattern
        const newSuccessCount = existing.success_count + (wasSuccessful ? 1 : 0);
        const newTotalCount = existing.total_count + 1;
        const newSuccessRate = newTotalCount > 0 ? (newSuccessCount / newTotalCount) * 100 : 0;

        this.db.prepare(`
          UPDATE search_patterns 
          SET success_count = ?, total_count = ?, success_rate = ?, last_used = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(newSuccessCount, newTotalCount, newSuccessRate, existing.id);
      } else {
        // Create new pattern
        const successCount = wasSuccessful ? 1 : 0;
        const successRate = wasSuccessful ? 100 : 0;

        this.db.prepare(`
          INSERT INTO search_patterns (query, files, success_count, total_count, success_rate)
          VALUES (?, ?, ?, 1, ?)
        `).run(normalizedQuery, filesJson, successCount, successRate);
      }
    } catch (error) {
      console.error('Failed to record search pattern:', error);
    }
  }

  /**
   * Get search suggestions based on query similarity and historical patterns
   */
  async getSearchSuggestions(query: string, limit: number = 5): Promise<SearchSuggestion[]> {
    try {
      const normalizedQuery = query.toLowerCase().trim();
      const queryWords = normalizedQuery.split(/\s+/).filter(word => word.length > 2);
      
      // Get all patterns ordered by success rate and recency
      const patterns = this.db.prepare(`
        SELECT * FROM search_patterns 
        WHERE success_rate > 50 AND total_count >= 2
        ORDER BY success_rate DESC, last_used DESC
        LIMIT 50
      `).all() as SearchPattern[];

      const suggestions: SearchSuggestion[] = [];

      for (const pattern of patterns) {
        const confidence = this.calculateQuerySimilarity(normalizedQuery, queryWords, pattern.query);
        
        if (confidence > 0.3) { // Only include patterns with reasonable similarity
          const parsedFiles: string[] = JSON.parse(pattern.files);
          suggestions.push({
            pattern: pattern.query,
            files: parsedFiles,
            success_rate: pattern.success_rate,
            confidence: confidence * 100
          });
        }
      }

      // Sort by confidence and success rate
      suggestions.sort((a, b) => 
        (b.confidence * b.success_rate) - (a.confidence * a.success_rate)
      );

      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('Failed to get search suggestions:', error);
      return [];
    }
  }

  /**
   * Get frequent search patterns for memory context
   */
  async getFrequentPatterns(limit: number = 10): Promise<FrequentPattern[]> {
    try {
      const patterns = this.db.prepare(`
        SELECT query, files, success_rate 
        FROM search_patterns 
        WHERE success_rate >= 75 AND total_count >= 3
        ORDER BY (success_rate * total_count) DESC, last_used DESC
        LIMIT ?
      `).all(limit) as SearchPattern[];

      return patterns.map(pattern => {
        const parsedFiles: string[] = JSON.parse(pattern.files);
        return {
          query: pattern.query,
          files: parsedFiles.join(', '),
          success_rate: `${Math.round(pattern.success_rate)}%`
        };
      });
    } catch (error) {
      console.error('Failed to get frequent patterns:', error);
      return [];
    }
  }

  /**
   * Get file organization insights based on successful searches
   */
  async getFileOrganizationPatterns(): Promise<string[]> {
    try {
      const patterns = this.db.prepare(`
        SELECT query, files, success_rate, total_count
        FROM search_patterns 
        WHERE success_rate >= 80 AND total_count >= 2
        ORDER BY success_rate DESC, total_count DESC
        LIMIT 20
      `).all() as SearchPattern[];

      const insights: string[] = [];
      const topicPatterns = new Map<string, Set<string>>();

      // Analyze patterns to find topic → file mappings
      for (const pattern of patterns) {
        const files: string[] = JSON.parse(pattern.files);
        const topic = this.extractTopic(pattern.query);
        
        if (topic && files.length > 0) {
          if (!topicPatterns.has(topic)) {
            topicPatterns.set(topic, new Set());
          }
          files.forEach((file: string) => topicPatterns.get(topic)!.add(file));
        }
      }

      // Generate insights
      for (const [topic, fileSet] of topicPatterns.entries()) {
        const files = Array.from(fileSet);
        if (files.length > 0) {
          insights.push(`${topic} info → ${files.slice(0, 3).join(', ')}`);
        }
      }

      return insights.slice(0, 5);
    } catch (error) {
      console.error('Failed to get file organization patterns:', error);
      return [];
    }
  }

  /**
   * Generate memory context XML for inclusion in LLM prompts
   */
  async getMemoryContext(): Promise<string> {
    try {
      const [frequentPatterns, organizationPatterns] = await Promise.all([
        this.getFrequentPatterns(8),
        this.getFileOrganizationPatterns()
      ]);

      let context = '<search_memory>\n';
      
      if (frequentPatterns.length > 0) {
        context += '  <frequent_patterns>\n';
        for (const pattern of frequentPatterns) {
          context += `    <pattern query="${pattern.query}" files="${pattern.files}" success_rate="${pattern.success_rate}"/>\n`;
        }
        context += '  </frequent_patterns>\n';
      }

      if (organizationPatterns.length > 0) {
        context += '  <suggested_locations>\n';
        context += '    Based on your organization:\n';
        for (const insight of organizationPatterns) {
          context += `    ${insight}\n`;
        }
        context += '  </suggested_locations>\n';
      }

      context += '</search_memory>';
      
      return context;
    } catch (error) {
      console.error('Failed to generate memory context:', error);
      return '<search_memory>\n  <status>Error loading search patterns</status>\n</search_memory>';
    }
  }

  /**
   * Clean up old patterns to prevent database bloat
   */
  async cleanupOldPatterns(): Promise<void> {
    try {
      // Remove patterns older than 6 months with low success rates
      const oldLowSuccess = this.db.prepare(`
        DELETE FROM search_patterns 
        WHERE last_used < datetime('now', '-6 months') 
        AND (success_rate < 25 OR total_count = 1)
      `);
      const deletedLowSuccess = oldLowSuccess.run();

      // Remove patterns older than 1 year regardless of success rate
      const oldPatterns = this.db.prepare(`
        DELETE FROM search_patterns 
        WHERE created_at < datetime('now', '-1 year')
      `);
      const deletedOld = oldPatterns.run();

      console.log(`SearchMemory cleanup completed: ${deletedLowSuccess.changes + deletedOld.changes} patterns removed`);
    } catch (error) {
      console.error('Failed to cleanup old patterns:', error);
    }
  }

  /**
   * Calculate similarity between queries for suggestion matching
   */
  private calculateQuerySimilarity(newQuery: string, newQueryWords: string[], storedQuery: string): number {
    if (newQuery === storedQuery) return 1.0;
    
    const storedWords = storedQuery.split(/\s+/).filter(word => word.length > 2);
    if (storedWords.length === 0) return 0;
    
    // Calculate word overlap
    const commonWords = newQueryWords.filter(word => 
      storedWords.some(stored => 
        stored.includes(word) || word.includes(stored) || 
        this.levenshteinDistance(word, stored) <= 1
      )
    );
    
    const wordOverlap = commonWords.length / Math.max(newQueryWords.length, storedWords.length);
    
    // Calculate string similarity for partial matches
    const stringDistance = this.levenshteinDistance(newQuery, storedQuery);
    const maxLength = Math.max(newQuery.length, storedQuery.length);
    const stringSimilarity = 1 - (stringDistance / maxLength);
    
    // Weighted combination
    return (wordOverlap * 0.7) + (stringSimilarity * 0.3);
  }

  /**
   * Extract main topic from search query
   */
  private extractTopic(query: string): string {
    const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    // Common topic indicators
    const topicWords = ['personal', 'work', 'project', 'meeting', 'birthday', 'contact', 'note', 'idea'];
    const foundTopic = words.find(word => topicWords.includes(word));
    
    if (foundTopic) return foundTopic.charAt(0).toUpperCase() + foundTopic.slice(1);
    
    // Use first significant word as topic
    return words.length > 0 ? words[0].charAt(0).toUpperCase() + words[0].slice(1) : 'General';
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close();
      console.log('SearchMemory database connection closed');
    } catch (error) {
      console.error('Error closing SearchMemory database:', error);
    }
  }
}

export default SearchMemory;