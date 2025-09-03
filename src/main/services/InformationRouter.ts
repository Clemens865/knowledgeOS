/**
 * Smart Information Router
 * Routes information to canonical locations to prevent fragmentation
 */

import * as path from 'path';
import * as fs from 'fs/promises';

interface RoutingRule {
  pattern: RegExp;
  canonicalFile: string;
  section?: string;
  keywords: string[];
  updateStrategy: 'replace' | 'append' | 'merge' | 'replace_section';
  priority: number;
}

interface QueryIntent {
  type: 'current_status' | 'historical' | 'relationship' | 'medical' | 'general';
  confidence: number;
  searchPaths: string[];
}

export class InformationRouter {
  private routingRules: Map<string, RoutingRule> = new Map([
    ['current_work', {
      pattern: /(?:currently work|work at|employed at|position at|job at|working at)/i,
      canonicalFile: 'Personal Info.md',
      section: 'Work History',
      keywords: ['work', 'job', 'employer', 'company', 'position', 'Yorizon'],
      updateStrategy: 'replace_section',
      priority: 1
    }],
    ['work_history', {
      pattern: /(?:worked at|used to work|previous job|former employer|career history)/i,
      canonicalFile: 'Professional Journey.md',
      section: 'Career Timeline',
      keywords: ['worked', 'previous', 'history', 'experience', 'former'],
      updateStrategy: 'append',
      priority: 2
    }],
    ['family', {
      pattern: /(?:brother|sister|mother|father|wife|husband|daughter|son|family)/i,
      canonicalFile: 'Personal Info.md',
      section: 'Family',
      keywords: ['brother', 'sister', 'mother', 'father', 'family', 'Julian', 'Clara', 'Karin'],
      updateStrategy: 'merge',
      priority: 1
    }],
    ['medical', {
      pattern: /(?:diagnosed|medical|doctor|health|condition|medication|treatment)/i,
      canonicalFile: 'Medical Records.md',
      section: undefined,
      keywords: ['health', 'medical', 'doctor', 'diagnosis', 'medication'],
      updateStrategy: 'append',
      priority: 1
    }],
    ['skills', {
      pattern: /(?:skills|expertise|proficient|experience with|knowledge of)/i,
      canonicalFile: 'Professional Journey.md',
      section: 'Skills & Expertise',
      keywords: ['skills', 'expertise', 'proficient', 'knowledge'],
      updateStrategy: 'merge',
      priority: 2
    }]
  ]);

  /**
   * Determine where to store new information
   */
  async routeInformation(text: string, workspacePath: string): Promise<{
    file: string;
    section?: string;
    strategy: string;
    reason: string;
  }> {
    // Detect information type
    for (const [type, rule] of this.routingRules) {
      if (rule.pattern.test(text)) {
        // Check if the canonical file exists
        const filePath = path.join(workspacePath, 'notes', rule.canonicalFile);
        const exists = await this.fileExists(filePath);
        
        return {
          file: rule.canonicalFile,
          section: rule.section,
          strategy: exists ? rule.updateStrategy : 'create',
          reason: `Detected ${type} information - routing to canonical location`
        };
      }
    }
    
    // Default fallback
    return {
      file: 'Personal Info.md',
      strategy: 'append',
      reason: 'No specific routing rule matched - using default'
    };
  }

  /**
   * Detect query intent to prioritize search locations
   */
  detectQueryIntent(query: string): QueryIntent {
    const lowercaseQuery = query.toLowerCase();
    
    // Current work/status queries
    if (this.matchesPatterns(lowercaseQuery, [
      'where do i work',
      'what is my job',
      'current employer',
      'my company',
      'what do i do'
    ])) {
      return {
        type: 'current_status',
        confidence: 0.95,
        searchPaths: ['Personal Info.md#Work History', 'Personal Info.md']
      };
    }
    
    // Historical/career queries
    if (this.matchesPatterns(lowercaseQuery, [
      'where have i worked',
      'work history',
      'previous jobs',
      'career path',
      'professional experience'
    ])) {
      return {
        type: 'historical',
        confidence: 0.9,
        searchPaths: ['Professional Journey.md', 'Personal Info.md#Work History']
      };
    }
    
    // Family/relationship queries
    if (this.matchesPatterns(lowercaseQuery, [
      'my brother',
      'my sister',
      'my family',
      'my wife',
      'my daughter',
      'julian',
      'clara',
      'karin'
    ])) {
      return {
        type: 'relationship',
        confidence: 0.9,
        searchPaths: ['Personal Info.md#Family', 'Personal Info.md']
      };
    }
    
    // Medical/health queries
    if (this.matchesPatterns(lowercaseQuery, [
      'health',
      'medical',
      'doctor',
      'medication',
      'diagnosis'
    ])) {
      return {
        type: 'medical',
        confidence: 0.9,
        searchPaths: ['Medical Records.md']
      };
    }
    
    // General query - search everywhere
    return {
      type: 'general',
      confidence: 0.5,
      searchPaths: ['Personal Info.md', 'Professional Journey.md', 'Medical Records.md']
    };
  }

  /**
   * Generate smart search strategy based on query
   */
  generateSearchStrategy(query: string): {
    primary: string[];
    secondary: string[];
    keywords: string[];
  } {
    const intent = this.detectQueryIntent(query);
    const keywords = this.extractKeywords(query);
    
    // Add context-aware keywords based on intent
    const contextKeywords = this.getContextKeywords(intent.type);
    
    return {
      primary: intent.searchPaths,
      secondary: this.getAllFiles().filter(f => !intent.searchPaths.includes(f)),
      keywords: [...new Set([...keywords, ...contextKeywords])]
    };
  }

  /**
   * Consolidate fragmented information
   */
  async consolidateInformation(workspacePath: string): Promise<{
    suggestions: Array<{from: string; to: string; reason: string}>;
    duplicates: Array<{entity: string; locations: string[]}>;
  }> {
    const suggestions: Array<{from: string; to: string; reason: string}> = [];
    const duplicates: Array<{entity: string; locations: string[]}> = [];
    
    // Scan all files
    const notesDir = path.join(workspacePath, 'notes');
    const files = await fs.readdir(notesDir);
    
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      
      const content = await fs.readFile(path.join(notesDir, file), 'utf-8');
      
      // Check if content belongs elsewhere
      for (const [type, rule] of this.routingRules) {
        if (rule.pattern.test(content) && file !== rule.canonicalFile) {
          suggestions.push({
            from: file,
            to: rule.canonicalFile,
            reason: `Contains ${type} information that belongs in ${rule.canonicalFile}`
          });
        }
      }
    }
    
    return { suggestions, duplicates };
  }

  /**
   * Helper: Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.stat(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper: Match query against patterns
   */
  private matchesPatterns(query: string, patterns: string[]): boolean {
    return patterns.some(p => query.includes(p));
  }

  /**
   * Helper: Extract keywords from query
   */
  private extractKeywords(query: string): string[] {
    // Remove common words
    const stopWords = ['where', 'what', 'who', 'when', 'how', 'do', 'i', 'my', 'the', 'is', 'at'];
    const words = query.toLowerCase().split(/\s+/);
    return words.filter(w => !stopWords.includes(w) && w.length > 2);
  }

  /**
   * Helper: Get context keywords for intent type
   */
  private getContextKeywords(intentType: string): string[] {
    const contextMap: Record<string, string[]> = {
      current_status: ['current', 'now', 'present', 'today', 'currently', 'Yorizon'],
      historical: ['previous', 'former', 'history', 'worked', 'used to'],
      relationship: ['family', 'brother', 'sister', 'wife', 'daughter', 'Julian', 'Clara', 'Karin'],
      medical: ['health', 'medical', 'doctor', 'diagnosis', 'treatment'],
      general: []
    };
    
    return contextMap[intentType] || [];
  }

  /**
   * Helper: Get all managed files
   */
  private getAllFiles(): string[] {
    const files = new Set<string>();
    for (const rule of this.routingRules.values()) {
      files.add(rule.canonicalFile);
    }
    return Array.from(files);
  }

  /**
   * Enhanced search with routing intelligence
   */
  async smartSearch(query: string, workspacePath: string): Promise<{
    strategy: {
      primary: string[];
      secondary: string[];
      keywords: string[];
    };
    intent: QueryIntent;
    searchOrder: string[];
  }> {
    const intent = this.detectQueryIntent(query);
    const strategy = this.generateSearchStrategy(query);
    
    // Generate optimized search order
    const searchOrder = [
      ...strategy.primary.map(p => path.join(workspacePath, 'notes', p)),
      ...strategy.secondary.map(p => path.join(workspacePath, 'notes', p))
    ];
    
    return {
      strategy,
      intent,
      searchOrder
    };
  }
}

// Integration with LLM Service
export function enhanceSearchWithRouting(
  originalSearchFunction: Function,
  router: InformationRouter
) {
  return async function enhancedSearch(query: string, workspacePath: string, options: any) {
    // Get smart search strategy
    const { strategy, intent, searchOrder } = await router.smartSearch(query, workspacePath);
    
    console.log(`🎯 Query intent: ${intent.type} (confidence: ${intent.confidence})`);
    console.log(`📍 Prioritizing: ${strategy.primary.join(', ')}`);
    console.log(`🔍 Keywords: ${strategy.keywords.join(', ')}`);
    
    // Enhanced search with priority
    const enhancedOptions = {
      ...options,
      searchOrder,
      keywords: strategy.keywords,
      priorityFiles: strategy.primary
    };
    
    return originalSearchFunction(query, workspacePath, enhancedOptions);
  };
}

// Export singleton instance
export const informationRouter = new InformationRouter();