/**
 * Crawl Session Manager
 * Maintains state for multi-step web crawling and processing
 */

import { ExtractedContent } from './WebCrawler';
import { LLMService } from '../../core/LLMService';

export interface CrawlSessionState {
  id: string;
  url: string;
  timestamp: Date;
  
  // Content stages
  rawContent: ExtractedContent[];
  processedContent?: ProcessedVersion[];
  currentVersion: string;
  
  // Conversation history for refinement
  refinementHistory: RefinementMessage[];
  
  // Metadata
  metadata: {
    totalPages: number;
    crawlDuration: number;
    lastModified: Date;
    tags?: string[];
  };
}

export interface ProcessedVersion {
  id: string;
  timestamp: Date;
  instruction: string;
  content: string;
  metadata: {
    processingTime: number;
    llmModel?: string;
    tokens?: number;
  };
}

export interface RefinementMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  resultVersion?: string; // ID of the resulting processed version
}

export class CrawlSessionManager {
  private sessions: Map<string, CrawlSessionState> = new Map();
  private activeSessions: Set<string> = new Set();
  private llmService: LLMService | null = null;

  constructor() {
    this.sessions = new Map();
    this.activeSessions = new Set();
  }

  /**
   * Set the LLM service for processing
   */
  setLLMService(service: LLMService) {
    this.llmService = service;
  }

  /**
   * Create a new crawl session
   */
  createSession(url: string, rawContent: ExtractedContent[]): string {
    const sessionId = this.generateSessionId();
    
    const session: CrawlSessionState = {
      id: sessionId,
      url,
      timestamp: new Date(),
      rawContent,
      processedContent: [],
      currentVersion: 'raw',
      refinementHistory: [],
      metadata: {
        totalPages: rawContent.length,
        crawlDuration: 0,
        lastModified: new Date()
      }
    };

    this.sessions.set(sessionId, session);
    this.activeSessions.add(sessionId);
    
    return sessionId;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CrawlSessionState | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Process content with LLM instruction
   */
  async processWithInstruction(
    sessionId: string, 
    instruction: string
  ): Promise<ProcessedVersion | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !this.llmService) return null;

    const startTime = Date.now();
    
    // Combine raw content for processing
    const combinedText = session.rawContent.map(page => 
      `URL: ${page.url}\nTitle: ${page.title}\nContent: ${page.text}`
    ).join('\n---\n');

    // Create processing prompt
    const prompt = `Based on the following web content, ${instruction}\n\nContent:\n${combinedText}`;
    
    try {
      const response = await this.llmService.sendMessage(prompt, [], undefined, undefined, false);
      
      const processedVersion: ProcessedVersion = {
        id: this.generateVersionId(),
        timestamp: new Date(),
        instruction,
        content: response.content || '',
        metadata: {
          processingTime: Date.now() - startTime,
          llmModel: 'claude-3-sonnet',
          tokens: response.content?.length
        }
      };

      // Add to session
      if (!session.processedContent) {
        session.processedContent = [];
      }
      session.processedContent.push(processedVersion);
      session.currentVersion = processedVersion.id;
      session.metadata.lastModified = new Date();

      return processedVersion;
    } catch (error) {
      console.error('Failed to process with instruction:', error);
      return null;
    }
  }

  /**
   * Refine content through conversation
   */
  async refineContent(
    sessionId: string, 
    userMessage: string
  ): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session || !this.llmService) return null;

    // Get current content
    const currentContent = this.getCurrentContent(session);
    if (!currentContent) return null;

    // Build conversation context
    const conversationContext = session.refinementHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content
    }));

    // Add context about the current content
    const contextPrompt = `You are helping refine web-crawled content. Current content:\n\n${currentContent}\n\nUser request: ${userMessage}`;

    try {
      const response = await this.llmService.sendMessage(contextPrompt, conversationContext, undefined, undefined, false);
      
      // Save refinement to history
      session.refinementHistory.push(
        { role: 'user', content: userMessage, timestamp: new Date() },
        { role: 'assistant', content: response.content || '', timestamp: new Date() }
      );

      // Create new processed version if content was modified
      if (response.content && response.content !== currentContent) {
        const refinedVersion: ProcessedVersion = {
          id: this.generateVersionId(),
          timestamp: new Date(),
          instruction: `Refined: ${userMessage}`,
          content: response.content,
          metadata: {
            processingTime: 0,
            llmModel: 'claude-3-sonnet'
          }
        };

        session.processedContent?.push(refinedVersion);
        session.currentVersion = refinedVersion.id;
      }

      session.metadata.lastModified = new Date();
      return response.content || null;
    } catch (error) {
      console.error('Failed to refine content:', error);
      return null;
    }
  }

  /**
   * Get current content (raw or processed)
   */
  getCurrentContent(session: CrawlSessionState): string | null {
    if (session.currentVersion === 'raw') {
      return session.rawContent.map(page => 
        `# ${page.title}\n\n${page.text}`
      ).join('\n\n---\n\n');
    }

    const version = session.processedContent?.find(v => v.id === session.currentVersion);
    return version?.content || null;
  }

  /**
   * Export session content in various formats
   */
  exportContent(sessionId: string, format: 'markdown' | 'json' | 'knowledge'): any {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const content = this.getCurrentContent(session);
    
    switch (format) {
      case 'markdown':
        return {
          content,
          metadata: {
            source: session.url,
            crawledAt: session.timestamp,
            lastModified: session.metadata.lastModified
          }
        };
      
      case 'json':
        return {
          session: {
            id: session.id,
            url: session.url,
            timestamp: session.timestamp
          },
          content,
          versions: session.processedContent,
          refinements: session.refinementHistory
        };
      
      case 'knowledge':
        // Format for Knowledge OS integration
        return {
          content: `---\nsource: ${session.url}\ntype: web-crawl\ncrawledAt: ${session.timestamp.toISOString()}\n---\n\n${content}`,
          suggestedPath: this.suggestKnowledgePath(session)
        };
      
      default:
        return content;
    }
  }

  /**
   * Suggest a path for saving to Knowledge OS
   */
  private suggestKnowledgePath(session: CrawlSessionState): string {
    const url = new URL(session.url);
    const date = new Date().toISOString().split('T')[0];
    const domain = url.hostname.replace('www.', '');
    
    return `web/${domain}/${date}-crawl.md`;
  }

  /**
   * Clean up old sessions
   */
  cleanupSessions(maxAge: number = 3600000) { // 1 hour default
    const now = Date.now();
    
    for (const [id, session] of this.sessions) {
      const age = now - session.timestamp.getTime();
      if (age > maxAge && !this.activeSessions.has(id)) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `crawl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique version ID
   */
  private generateVersionId(): string {
    return `v_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }
}

export const crawlSessionManager = new CrawlSessionManager();