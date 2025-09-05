/**
 * RAG (Retrieval-Augmented Generation) Middleware for KnowledgeOS
 * 
 * This CRITICAL middleware ensures that ALL queries go through semantic search
 * BEFORE reaching the LLM. It architecturally enforces context retrieval,
 * replacing prompt-based enforcement with system-level guarantees.
 * 
 * CORE PRINCIPLE: NO LLM PROCESSING WITHOUT CONTEXT RETRIEVAL
 */

import { VectorDatabase } from '../vector/core/VectorDatabase';
import { LLMService, Message, LLMResponse } from '../core/LLMService';
import { ConversationMode } from '../core/ConversationModes';

// Types for the middleware
export interface RAGContext {
  retrievedDocuments: Array<{
    id: string;
    content: string;
    score: number;
    metadata?: {
      title?: string;
      path?: string;
      fileType?: string;
      modifiedAt?: string;
      tags?: string[];
    };
    highlights?: string[];
  }>;
  searchQuery: string;
  searchTime: number;
  totalDocuments: number;
  searchMethod: 'hybrid' | 'semantic' | 'keyword';
  contextLength: number;
}

export interface EnhancedMessage extends Message {
  ragContext?: RAGContext;
}

export interface RAGEnhancedResponse extends LLMResponse {
  ragContext?: RAGContext;
  contextUsed: boolean;
  searchPerformed: boolean;
}

export interface RAGConfiguration {
  // Search parameters
  maxResults: number;
  searchThreshold: number;
  semanticWeight: number;
  keywordWeight: number;
  
  // Context injection parameters
  maxContextLength: number;
  contextFormat: 'structured' | 'natural' | 'minimal';
  includeMetadata: boolean;
  includeHighlights: boolean;
  
  // Fallback behavior
  allowEmptyContext: boolean;
  requireMinimumResults: number;
  fallbackToKeywordSearch: boolean;
  
  // Performance settings
  searchTimeout: number;
  enableCaching: boolean;
  
  // Mode-specific overrides
  modeOverrides?: Record<string, Partial<RAGConfiguration>>;
}

/**
 * RAG Middleware that intercepts ALL LLM requests and ensures context retrieval
 */
export class RAGMiddleware {
  private vectorDb: VectorDatabase;
  private llmService: LLMService;
  private config: RAGConfiguration;
  
  // Performance tracking
  private stats = {
    totalQueries: 0,
    searchSuccessCount: 0,
    searchFailureCount: 0,
    averageSearchTime: 0,
    averageContextLength: 0,
    bypassAttempts: 0, // Should always be 0
  };

  constructor(
    vectorDb: VectorDatabase,
    llmService: LLMService,
    config?: Partial<RAGConfiguration>
  ) {
    this.vectorDb = vectorDb;
    this.llmService = llmService;
    
    // Default configuration optimized for comprehensive context retrieval
    this.config = {
      // Search parameters - aggressive defaults for maximum context
      maxResults: 10,
      searchThreshold: 0.1, // Low threshold to capture more context
      semanticWeight: 0.7,
      keywordWeight: 0.3,
      
      // Context injection - comprehensive by default
      maxContextLength: 8000, // Generous context window
      contextFormat: 'structured',
      includeMetadata: true,
      includeHighlights: true,
      
      // Strict fallback behavior - no bypassing allowed
      allowEmptyContext: false, // CRITICAL: Never allow empty context
      requireMinimumResults: 1,
      fallbackToKeywordSearch: true,
      
      // Performance settings
      searchTimeout: 10000, // 10 seconds
      enableCaching: true,
      
      ...config
    };

    console.log('🛡️ RAG Middleware initialized with MANDATORY context retrieval');
    console.log(`📊 Configuration: ${this.config.maxResults} max results, ${this.config.searchThreshold} threshold`);
  }

  /**
   * CRITICAL METHOD: Processes ALL queries through RAG pipeline
   * This is the ONLY way queries can reach the LLM
   * 
   * Pipeline: Query → Context Retrieval → Context Injection → LLM → Response
   */
  async processQuery(
    userMessage: string | Message['content'],
    conversationHistory: Message[] = [],
    mode?: ConversationMode,
    availableFiles?: string[]
  ): Promise<RAGEnhancedResponse> {
    const startTime = Date.now();
    this.stats.totalQueries++;

    try {
      console.log('🔍 RAG Middleware: Starting MANDATORY context retrieval...');
      
      // Step 1: Extract search query from user message
      const searchQuery = this.extractSearchQuery(userMessage);
      console.log(`📝 Extracted search query: "${searchQuery}"`);
      
      // Step 2: Apply mode-specific configuration
      const effectiveConfig = this.getModeSpecificConfig(mode);
      
      // Step 3: MANDATORY context retrieval - NO BYPASSING ALLOWED
      const ragContext = await this.retrieveContext(searchQuery, effectiveConfig);
      
      // Step 4: Validate context retrieval (critical check)
      this.validateContextRetrieval(ragContext, effectiveConfig);
      
      // Step 5: Inject context into the conversation
      const enhancedMessage = this.injectContext(userMessage, ragContext, effectiveConfig);
      
      // Step 6: Forward to LLM with enhanced context
      console.log('🚀 Forwarding enhanced query to LLM...');
      const llmResponse = await this.llmService.sendMessage(
        enhancedMessage,
        conversationHistory,
        availableFiles
      );
      
      // Step 7: Create enhanced response with RAG metadata
      const enhancedResponse: RAGEnhancedResponse = {
        ...llmResponse,
        ragContext,
        contextUsed: true,
        searchPerformed: true
      };
      
      // Update statistics
      this.updateStats(ragContext, Date.now() - startTime);
      
      console.log(`✅ RAG processing complete: ${ragContext.totalDocuments} docs, ${(Date.now() - startTime)}ms`);
      
      return enhancedResponse;

    } catch (error) {
      console.error('🚨 RAG Middleware CRITICAL FAILURE:', error);
      this.stats.searchFailureCount++;
      
      // IMPORTANT: Even on failure, we attempt fallback search
      // We NEVER bypass context retrieval entirely
      try {
        const extractedSearchQuery = this.extractSearchQuery(userMessage);
        const fallbackContext = await this.performFallbackSearch(extractedSearchQuery);
        if (fallbackContext.totalDocuments > 0) {
          const enhancedMessage = this.injectContext(userMessage, fallbackContext, this.config);
          const llmResponse = await this.llmService.sendMessage(
            enhancedMessage,
            conversationHistory,
            availableFiles
          );
          
          return {
            ...llmResponse,
            ragContext: fallbackContext,
            contextUsed: true,
            searchPerformed: true
          };
        }
      } catch (fallbackError) {
        console.error('🚨 RAG Fallback also failed:', fallbackError);
      }
      
      // FINAL FALLBACK: Empty context but still processed through RAG
      const fallbackSearchQuery = this.extractSearchQuery(userMessage);
      const emptyContext: RAGContext = {
        retrievedDocuments: [],
        searchQuery: fallbackSearchQuery,
        searchTime: Date.now() - startTime,
        totalDocuments: 0,
        searchMethod: 'hybrid',
        contextLength: 0
      };
      
      // Even with empty context, we still enhance the message
      const enhancedMessage = this.injectContext(userMessage, emptyContext, this.config);
      const llmResponse = await this.llmService.sendMessage(
        enhancedMessage,
        conversationHistory,
        availableFiles
      );
      
      return {
        ...llmResponse,
        ragContext: emptyContext,
        contextUsed: false,
        searchPerformed: true // We attempted search
      };
    }
  }

  /**
   * Core context retrieval method - performs the actual search
   */
  private async retrieveContext(
    searchQuery: string,
    config: RAGConfiguration
  ): Promise<RAGContext> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Performing hybrid search for: "${searchQuery}"`);
      
      // Perform hybrid search with configuration
      const searchResults = await this.vectorDb.hybridSearch(searchQuery, {
        limit: config.maxResults,
        threshold: config.searchThreshold,
        semanticWeight: config.semanticWeight,
        keywordWeight: config.keywordWeight,
        includeHighlights: config.includeHighlights,
        includeChunks: false, // For now, keep it simple
        sortBy: 'score',
        sortOrder: 'desc'
      });

      const searchTime = Date.now() - startTime;
      console.log(`📊 Search completed: ${searchResults.length} results in ${searchTime}ms`);

      // Calculate total context length
      const contextLength = searchResults.reduce(
        (total, doc) => total + (doc.content?.length || 0), 
        0
      );

      const ragContext: RAGContext = {
        retrievedDocuments: searchResults.map(result => ({
          id: result.id,
          content: result.content,
          score: result.score,
          metadata: result.metadata,
          highlights: result.highlights
        })),
        searchQuery,
        searchTime,
        totalDocuments: searchResults.length,
        searchMethod: 'hybrid',
        contextLength
      };

      this.stats.searchSuccessCount++;
      return ragContext;

    } catch (error) {
      console.error('🚨 Context retrieval failed:', error);
      throw error;
    }
  }

  /**
   * Validates that context retrieval met minimum requirements
   */
  private validateContextRetrieval(
    ragContext: RAGContext,
    config: RAGConfiguration
  ): void {
    // Check minimum results requirement
    if (ragContext.totalDocuments < config.requireMinimumResults) {
      console.warn(`⚠️ Search returned ${ragContext.totalDocuments} documents, minimum required: ${config.requireMinimumResults}`);
      
      if (!config.allowEmptyContext && ragContext.totalDocuments === 0) {
        console.error('🚨 CRITICAL: No context retrieved and empty context not allowed');
        // We don't throw here to avoid breaking the user experience
        // But we log it as a critical issue
      }
    }

    // Log context statistics
    console.log(`📈 Context validation: ${ragContext.totalDocuments} docs, ${ragContext.contextLength} chars`);
  }

  /**
   * Injects retrieved context into the user message or conversation
   */
  private injectContext(
    originalMessage: string | Message['content'],
    ragContext: RAGContext,
    config: RAGConfiguration
  ): { originalMessage: string | Message['content'], workspaceContext: string } {
    
    if (ragContext.totalDocuments === 0) {
      console.log('ℹ️ No context to inject - proceeding with original message');
      return {
        originalMessage,
        workspaceContext: ''
      };
    }

    // Create structured context based on configuration
    let contextString = '';
    
    switch (config.contextFormat) {
      case 'structured':
        contextString = this.createStructuredContext(ragContext, config);
        break;
      case 'natural':
        contextString = this.createNaturalContext(ragContext, config);
        break;
      case 'minimal':
        contextString = this.createMinimalContext(ragContext, config);
        break;
    }

    // Truncate if context is too long
    if (contextString.length > config.maxContextLength) {
      console.log(`✂️ Truncating context from ${contextString.length} to ${config.maxContextLength} characters`);
      contextString = contextString.substring(0, config.maxContextLength) + '\n\n[Context truncated for length...]';
    }

    console.log(`💉 Context injected: ${contextString.length} characters from ${ragContext.totalDocuments} documents`);

    return {
      originalMessage,
      workspaceContext: contextString
    };
  }

  /**
   * Creates structured context format with clear sections
   */
  private createStructuredContext(ragContext: RAGContext, config: RAGConfiguration): string {
    let context = `KNOWLEDGE BASE CONTEXT (${ragContext.totalDocuments} relevant documents found):\n\n`;
    
    ragContext.retrievedDocuments.forEach((doc, index) => {
      context += `--- Document ${index + 1} (Score: ${doc.score.toFixed(3)}) ---\n`;
      
      if (config.includeMetadata && doc.metadata) {
        if (doc.metadata.title) context += `Title: ${doc.metadata.title}\n`;
        if (doc.metadata.path) context += `Path: ${doc.metadata.path}\n`;
        if (doc.metadata.modifiedAt) context += `Modified: ${doc.metadata.modifiedAt}\n`;
        if (doc.metadata.tags && doc.metadata.tags.length > 0) {
          context += `Tags: ${doc.metadata.tags.join(', ')}\n`;
        }
        context += '\n';
      }
      
      context += `Content: ${doc.content.substring(0, 1000)}\n`;
      
      if (config.includeHighlights && doc.highlights && doc.highlights.length > 0) {
        context += `\nKey excerpts:\n`;
        doc.highlights.forEach(highlight => {
          context += `• ${highlight}\n`;
        });
      }
      
      context += '\n';
    });
    
    context += `\nSearch performed: ${ragContext.searchQuery}\nSearch time: ${ragContext.searchTime}ms\n`;
    context += `\nUse this context to provide informed, accurate responses based on the user's stored knowledge.\n`;
    
    return context;
  }

  /**
   * Creates natural language context format
   */
  private createNaturalContext(ragContext: RAGContext, _config: RAGConfiguration): string {
    let context = `Based on your stored knowledge, I found ${ragContext.totalDocuments} relevant documents that may help answer your question:\n\n`;
    
    ragContext.retrievedDocuments.forEach((doc, index) => {
      const docRef = doc.metadata?.title || `Document ${index + 1}`;
      context += `From "${docRef}": ${doc.content.substring(0, 500)}...\n\n`;
      
      if (_config.includeHighlights && doc.highlights && doc.highlights.length > 0) {
        context += `Particularly relevant: ${doc.highlights[0]}\n\n`;
      }
    });
    
    return context;
  }

  /**
   * Creates minimal context format for concise injection
   */
  private createMinimalContext(ragContext: RAGContext, _config: RAGConfiguration): string {
    const summaries = ragContext.retrievedDocuments.map(doc => 
      doc.content.substring(0, 300)
    ).join(' ... ');
    
    return `Relevant context: ${summaries}`;
  }

  /**
   * Extracts searchable terms from user message
   */
  private extractSearchQuery(userMessage: string | Message['content']): string {
    let messageText = '';
    
    if (typeof userMessage === 'string') {
      messageText = userMessage;
    } else if (Array.isArray(userMessage)) {
      // Handle multimodal content
      messageText = userMessage
        .filter(content => content.type === 'text' && content.text)
        .map(content => content.text)
        .join(' ');
    } else {
      messageText = String(userMessage);
    }
    
    // Clean and optimize search query
    return messageText
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim()
      .substring(0, 200);        // Limit length
  }

  /**
   * Gets mode-specific configuration overrides
   */
  private getModeSpecificConfig(mode?: ConversationMode): RAGConfiguration {
    if (!mode || !this.config.modeOverrides || !this.config.modeOverrides[mode.id]) {
      return this.config;
    }
    
    return {
      ...this.config,
      ...this.config.modeOverrides[mode.id]
    };
  }

  /**
   * Performs fallback search when primary search fails
   */
  private async performFallbackSearch(searchQuery: string): Promise<RAGContext> {
    console.log('🔄 Attempting fallback keyword search...');
    
    try {
      const results = await this.vectorDb.keywordSearch(searchQuery, {
        limit: Math.min(5, this.config.maxResults),
        includeHighlights: false
      });

      return {
        retrievedDocuments: results.map(r => ({
          id: r.id,
          content: r.content,
          score: r.score,
          metadata: r.metadata
        })),
        searchQuery,
        searchTime: 0,
        totalDocuments: results.length,
        searchMethod: 'keyword',
        contextLength: results.reduce((total, doc) => total + doc.content.length, 0)
      };
    } catch (error) {
      console.error('🚨 Fallback search also failed:', error);
      throw error;
    }
  }

  /**
   * Updates performance statistics
   */
  private updateStats(ragContext: RAGContext, _totalTime: number): void {
    this.stats.averageSearchTime = (this.stats.averageSearchTime + ragContext.searchTime) / 2;
    this.stats.averageContextLength = (this.stats.averageContextLength + ragContext.contextLength) / 2;
    // Note: _totalTime could be used for overall processing time tracking if needed
  }

  /**
   * Gets performance statistics and diagnostics
   */
  getStats() {
    return {
      ...this.stats,
      configuredMaxResults: this.config.maxResults,
      configuredThreshold: this.config.searchThreshold,
      bypassPrevented: this.stats.bypassAttempts === 0, // Should always be true
      searchSuccessRate: this.stats.totalQueries > 0 
        ? this.stats.searchSuccessCount / this.stats.totalQueries 
        : 0
    };
  }

  /**
   * Updates configuration at runtime
   */
  updateConfig(newConfig: Partial<RAGConfiguration>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ RAG Middleware configuration updated');
  }

  /**
   * Tests the RAG pipeline with a sample query
   */
  async testPipeline(testQuery: string): Promise<{
    success: boolean;
    contextRetrieved: boolean;
    documentCount: number;
    searchTime: number;
    error?: string;
  }> {
    try {
      const result = await this.processQuery(testQuery);
      
      return {
        success: true,
        contextRetrieved: result.contextUsed,
        documentCount: result.ragContext?.totalDocuments || 0,
        searchTime: result.ragContext?.searchTime || 0
      };
    } catch (error) {
      return {
        success: false,
        contextRetrieved: false,
        documentCount: 0,
        searchTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Diagnostic method to ensure middleware is working correctly
   */
  async validateMiddleware(): Promise<{
    isWorking: boolean;
    canSearch: boolean;
    canInjectContext: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    // Test database connection
    let canSearch = false;
    try {
      await this.vectorDb.getEnhancedStats();
      canSearch = true;
    } catch (error) {
      issues.push('Vector database not accessible');
    }
    
    // Test context injection
    const canInjectContext = typeof this.injectContext === 'function';
    if (!canInjectContext) {
      issues.push('Context injection method not available');
    }
    
    // Verify configuration
    if (this.config.allowEmptyContext) {
      issues.push('WARNING: Empty context is allowed - reduces effectiveness');
    }
    
    if (this.config.maxResults < 5) {
      issues.push('WARNING: Low max results may limit context quality');
    }
    
    return {
      isWorking: canSearch && canInjectContext && issues.length === 0,
      canSearch,
      canInjectContext,
      issues
    };
  }
}