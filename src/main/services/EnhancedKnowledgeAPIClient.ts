/**
 * Enhanced API Client for Python Knowledge Service
 * Supports both simple and enhanced modes
 */

const fetch = require('node-fetch');

export interface SaveOptions {
  content: string;
  title?: string;
  metadata?: any;
  mode?: 'new' | 'append' | 'update';
}

export interface SearchOptions {
  query: string;
  type?: 'keyword' | 'semantic' | 'entity' | 'hybrid';
  limit?: number;
}

export interface ProcessResult {
  entities: any[];
  entity_count: number;
  mode: string;
}

export interface SaveResult {
  success: boolean;
  document_id?: string;
  entities_extracted?: number;
  mode?: string;
  error?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  score: number;
  type: string;
  matched_entity?: string;
}

export class EnhancedKnowledgeAPIClient {
  private baseUrl: string;
  
  constructor(port: number = 8000) {
    this.baseUrl = `http://localhost:${port}`;
  }
  
  /**
   * Check if the service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        timeout: 5000,
      });
      
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Get knowledge base statistics
   */
  async getStatistics(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/statistics`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get statistics:', error);
      return null;
    }
  }
  
  /**
   * Process text and extract entities
   */
  async processText(text: string, source?: string): Promise<ProcessResult> {
    try {
      const response = await fetch(`${this.baseUrl}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, source }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to process text:', error);
      throw error;
    }
  }
  
  /**
   * Save content to knowledge base with entity extraction
   */
  async save(options: SaveOptions): Promise<SaveResult> {
    try {
      const response = await fetch(`${this.baseUrl}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to save content:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  /**
   * Append content to existing document
   */
  async append(content: string, title: string, metadata?: any): Promise<SaveResult> {
    try {
      const response = await fetch(`${this.baseUrl}/append`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content, title, metadata }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to append content:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  /**
   * Search knowledge base
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    try {
      // Try POST endpoint first (for advanced search)
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });
      
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      // Fallback to GET endpoint
      try {
        const params = new URLSearchParams({
          q: options.query,
          type: options.type || 'hybrid',
        });
        
        const response = await fetch(`${this.baseUrl}/search?${params}`);
        const data = await response.json();
        return data.results || [];
      } catch (fallbackError) {
        console.error('Failed to search:', fallbackError);
        return [];
      }
    }
  }
  
  /**
   * Query knowledge graph (enhanced mode only)
   */
  async query(query: string, options?: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, ...options }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to query knowledge graph:', error);
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
  
  /**
   * Get all entities (backward compatibility)
   */
  async getEntities(entityType?: string): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/entities${entityType ? `?type=${entityType}` : ''}`);
      const data = await response.json();
      return data.entities || [];
    } catch (error) {
      console.error('Failed to get entities:', error);
      return [];
    }
  }
  
  /**
   * Get specific entity (backward compatibility)
   */
  async getEntity(entityId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/entities/${entityId}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to get entity:', error);
      return null;
    }
  }
  
  /**
   * Update entity (backward compatibility)
   */
  async updateEntity(entityId: string, attributes: any, source?: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/entities/${entityId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attributes, source }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to update entity:', error);
      return null;
    }
  }
  
  /**
   * Add relationship between entities
   */
  async addRelationship(sourceId: string, targetId: string, type: string, attributes?: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/relationships`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_id: sourceId,
          target_id: targetId,
          type,
          attributes,
        }),
      });
      
      return await response.json();
    } catch (error) {
      console.error('Failed to add relationship:', error);
      return null;
    }
  }
}