/**
 * TypeScript client for communicating with Python Knowledge API
 */

import axios, { AxiosInstance } from 'axios';

export interface ProcessTextRequest {
  text: string;
  source?: string;
  context?: string;
}

export interface QueryRequest {
  query: string;
  intent?: string;
  maxResults?: number;
  confidenceThreshold?: string;
  includeRelated?: boolean;
}

export interface Entity {
  id: string;
  type: string;
  name: string;
  aliases: string[];
  attributes: Record<string, any>;
  confidence: string;
  createdAt: string;
  updatedAt: string;
  sources: string[];
}

export interface Relationship {
  id: string;
  type: string;
  sourceEntityId: string;
  targetEntityId: string;
  attributes: Record<string, any>;
  confidence: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessResult {
  entities: Entity[];
  relationships: Relationship[];
  fileMappings: Record<string, string>;
  summary: string;
}

export interface QueryResult {
  entities: Entity[];
  relationships: Relationship[];
  suggestedFiles: string[];
}

export class KnowledgeAPIClient {
  private client: AxiosInstance;
  private baseURL: string;
  private isConnected: boolean = false;

  constructor(baseURL: string = 'http://127.0.0.1:8000') {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if the Python service is running
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      this.isConnected = response.data.status === 'healthy';
      return this.isConnected;
    } catch (error) {
      console.error('Python service health check failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Process text to extract entities and relationships
   */
  async processText(request: ProcessTextRequest): Promise<ProcessResult> {
    try {
      const response = await this.client.post('/process', {
        text: request.text,
        source: request.source || 'user',
        context: request.context,
      });
      
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to process text');
    } catch (error) {
      console.error('Error processing text:', error);
      throw error;
    }
  }

  /**
   * Query the knowledge graph
   */
  async query(request: QueryRequest): Promise<QueryResult> {
    try {
      const response = await this.client.post('/query', {
        query: request.query,
        intent: request.intent,
        max_results: request.maxResults || 10,
        confidence_threshold: request.confidenceThreshold || 'medium',
        include_related: request.includeRelated !== false,
      });
      
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error('Failed to query knowledge');
    } catch (error) {
      console.error('Error querying knowledge:', error);
      throw error;
    }
  }

  /**
   * Get all entities
   */
  async getEntities(entityType?: string): Promise<Entity[]> {
    try {
      const params = entityType ? { entity_type: entityType } : {};
      const response = await this.client.get('/entities', { params });
      
      if (response.data.success) {
        return response.data.data.entities;
      }
      throw new Error('Failed to get entities');
    } catch (error) {
      console.error('Error getting entities:', error);
      throw error;
    }
  }

  /**
   * Get a specific entity
   */
  async getEntity(entityId: string): Promise<{ entity: Entity; relationships: Relationship[] }> {
    try {
      const response = await this.client.get(`/entities/${entityId}`);
      
      if (response.data.success) {
        return response.data.data;
      }
      throw new Error(`Failed to get entity ${entityId}`);
    } catch (error) {
      console.error(`Error getting entity ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Update an entity's attributes
   */
  async updateEntity(entityId: string, attributes: Record<string, any>, source: string = 'user'): Promise<Entity> {
    try {
      const response = await this.client.put(`/entities/${entityId}`, {
        entity_id: entityId,
        attributes,
        source,
      });
      
      if (response.data.success) {
        return response.data.data.entity;
      }
      throw new Error(`Failed to update entity ${entityId}`);
    } catch (error) {
      console.error(`Error updating entity ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Get canonical file locations for entities
   */
  async getCanonicalLocations(entityIds: string[]): Promise<Record<string, string>> {
    try {
      const response = await this.client.post('/canonical-locations', entityIds);
      
      if (response.data.success) {
        return response.data.data.mappings;
      }
      throw new Error('Failed to get canonical locations');
    } catch (error) {
      console.error('Error getting canonical locations:', error);
      throw error;
    }
  }

  /**
   * Resolve conflicts for an entity
   */
  async resolveConflicts(entityId: string): Promise<Entity> {
    try {
      const response = await this.client.post(`/resolve-conflicts/${entityId}`);
      
      if (response.data.success) {
        return response.data.data.entity;
      }
      throw new Error(`Failed to resolve conflicts for entity ${entityId}`);
    } catch (error) {
      console.error(`Error resolving conflicts for entity ${entityId}:`, error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  isServiceConnected(): boolean {
    return this.isConnected;
  }
}