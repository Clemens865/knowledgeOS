/**
 * Intelligent Entity-Based Knowledge Merger
 * Prevents duplicates while preserving all information history
 */

import * as crypto from 'crypto';

interface Entity {
  id: string;
  type: 'person' | 'place' | 'organization' | 'event' | 'concept';
  canonicalName: string;
  aliases: string[];
  currentState: Record<string, any>;
  history: VersionEntry[];
  relationships: Relationship[];
  lastModified: Date;
  confidence: number;
}

interface VersionEntry {
  timestamp: Date;
  operation: 'create' | 'update' | 'merge' | 'delete';
  fields: string[];
  previousValues?: Record<string, any>;
  newValues: Record<string, any>;
  source: string;
}

interface Relationship {
  type: string; // 'brother_of', 'works_at', 'lives_in'
  targetId: string;
  confidence: number;
}

interface MergeStrategy {
  field: string;
  strategy: 'latest' | 'longest' | 'merge_array' | 'ask_user' | 'confidence';
}

export class EntityMerger {
  private entities: Map<string, Entity> = new Map();
  private mergeStrategies: Map<string, MergeStrategy> = new Map([
    ['career', { field: 'career', strategy: 'merge_array' }],
    ['aliases', { field: 'aliases', strategy: 'merge_array' }],
    ['birthdate', { field: 'birthdate', strategy: 'confidence' }],
    ['name', { field: 'name', strategy: 'latest' }],
  ]);

  /**
   * Process new information and merge with existing entities
   */
  async processInformation(text: string, source: string = 'user'): Promise<Entity[]> {
    // Step 1: Extract entities from text
    const detectedEntities = await this.detectEntities(text);
    
    // Step 2: For each detected entity, merge with existing or create new
    const results: Entity[] = [];
    
    for (const detected of detectedEntities) {
      const existing = await this.findExistingEntity(detected);
      
      if (existing) {
        // Merge with existing entity
        const merged = await this.mergeEntities(existing, detected, source);
        results.push(merged);
      } else {
        // Create new entity
        const created = await this.createEntity(detected, source);
        results.push(created);
      }
    }
    
    return results;
  }

  /**
   * Detect entities in text using pattern matching and NER
   */
  private async detectEntities(text: string): Promise<Partial<Entity>[]> {
    const entities: Partial<Entity>[] = [];
    
    // Person detection patterns
    const personPatterns = [
      /(?:my |My )?(brother|sister|mother|father|wife|daughter|son) ([A-Z][a-z]+ [A-Z][a-zÖöÄäÜü]+)/g,
      /([A-Z][a-z]+ [A-Z][a-zÖöÄäÜü]+) (?:was |is |works)/g,
      /Name:\s*([A-Z][a-z]+ [A-Z][a-zÖöÄäÜü]+)/g,
    ];
    
    for (const pattern of personPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[2] || match[1];
        const relation = match[1] && match[2] ? match[1] : undefined;
        
        // Extract additional context
        const context = this.extractContext(text, match.index);
        
        entities.push({
          type: 'person',
          canonicalName: name,
          currentState: {
            name,
            ...(relation && { relation }),
            ...this.parseContext(context)
          }
        });
      }
    }
    
    return entities;
  }

  /**
   * Find existing entity that matches the detected one
   */
  private async findExistingEntity(detected: Partial<Entity>): Promise<Entity | null> {
    // Check by canonical name
    for (const [, entity] of this.entities) {
      // Direct name match
      if (entity.canonicalName === detected.canonicalName) {
        return entity;
      }
      
      // Alias match
      if (entity.aliases.includes(detected.canonicalName || '')) {
        return entity;
      }
      
      // Fuzzy match for similar names
      const similarity = this.calculateSimilarity(
        entity.canonicalName, 
        detected.canonicalName || ''
      );
      if (similarity > 0.85) {
        return entity;
      }
    }
    
    return null;
  }

  /**
   * Merge two entities intelligently
   */
  private async mergeEntities(
    existing: Entity, 
    incoming: Partial<Entity>,
    source: string
  ): Promise<Entity> {
    const timestamp = new Date();
    const changes: Record<string, any> = {};
    const previousValues: Record<string, any> = {};
    
    // Merge each field based on strategy
    for (const [field, value] of Object.entries(incoming.currentState || {})) {
      const existingValue = existing.currentState[field];
      const strategy = this.mergeStrategies.get(field)?.strategy || 'latest';
      
      if (!existingValue) {
        // New field - add it
        changes[field] = value;
      } else if (existingValue !== value) {
        // Conflict - resolve based on strategy
        previousValues[field] = existingValue;
        
        switch (strategy) {
          case 'merge_array':
            if (Array.isArray(existingValue) && Array.isArray(value)) {
              changes[field] = [...new Set([...existingValue, ...value])];
            } else {
              changes[field] = value;
            }
            break;
            
          case 'longest':
            changes[field] = String(value).length > String(existingValue).length 
              ? value : existingValue;
            break;
            
          case 'confidence':
            // Keep existing if confidence is higher
            if ((incoming as any).confidence && (incoming as any).confidence > existing.confidence) {
              changes[field] = value;
            }
            break;
            
          case 'latest':
          default:
            changes[field] = value;
            break;
        }
      }
    }
    
    // Update entity if there are changes
    if (Object.keys(changes).length > 0) {
      // Update current state
      existing.currentState = { ...existing.currentState, ...changes };
      
      // Add to history
      existing.history.push({
        timestamp,
        operation: 'update',
        fields: Object.keys(changes),
        previousValues,
        newValues: changes,
        source
      });
      
      existing.lastModified = timestamp;
    }
    
    return existing;
  }

  /**
   * Create a new entity
   */
  private async createEntity(detected: Partial<Entity>, source: string): Promise<Entity> {
    const id = crypto.randomBytes(16).toString('hex');
    const timestamp = new Date();
    
    const entity: Entity = {
      id,
      type: detected.type || 'concept',
      canonicalName: detected.canonicalName || 'Unknown',
      aliases: detected.aliases || [],
      currentState: detected.currentState || {},
      history: [{
        timestamp,
        operation: 'create',
        fields: Object.keys(detected.currentState || {}),
        newValues: detected.currentState || {},
        source
      }],
      relationships: detected.relationships || [],
      lastModified: timestamp,
      confidence: detected.confidence || 1.0
    };
    
    this.entities.set(id, entity);
    return entity;
  }

  /**
   * Extract context around a match
   */
  private extractContext(text: string, position: number, windowSize: number = 200): string {
    const start = Math.max(0, position - windowSize);
    const end = Math.min(text.length, position + windowSize);
    return text.substring(start, end);
  }

  /**
   * Parse context for additional fields
   */
  private parseContext(context: string): Record<string, any> {
    const fields: Record<string, any> = {};
    
    // Birth date patterns
    const birthPattern = /(?:born|Born)(?: on)?\s*:?\s*([A-Za-z]+ \d+(?:st|nd|rd|th)?,? \d{4})/;
    const birthMatch = context.match(birthPattern);
    if (birthMatch) {
      fields.birthdate = birthMatch[1];
    }
    
    // Career patterns
    const careerPattern = /(?:works?|Works?|Career)(?: at| for)?\s*:?\s*([A-Z][a-zA-Z\s&]+)/;
    const careerMatch = context.match(careerPattern);
    if (careerMatch) {
      fields.currentEmployer = careerMatch[1].trim();
    }
    
    // Education patterns
    const educationPattern = /(?:Education|Studied|University)\s*:?\s*([^\.]+)/;
    const eduMatch = context.match(educationPattern);
    if (eduMatch) {
      fields.education = eduMatch[1].trim();
    }
    
    return fields;
  }

  /**
   * Calculate string similarity (Levenshtein distance based)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance calculation
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get clean presentation of an entity
   */
  getEntityPresentation(entityId: string): string {
    const entity = this.entities.get(entityId);
    if (!entity) return 'Entity not found';
    
    let output = `# ${entity.canonicalName}\n\n`;
    
    for (const [field, value] of Object.entries(entity.currentState)) {
      if (field !== 'name') {
        output += `**${field.charAt(0).toUpperCase() + field.slice(1)}:** ${value}\n`;
      }
    }
    
    if (entity.history.length > 1) {
      output += `\n_Last updated: ${entity.lastModified.toISOString()}_\n`;
      output += `_Version history: ${entity.history.length} changes_\n`;
    }
    
    return output;
  }
}

// Example usage:
/*
const merger = new EntityMerger();

// First mention
await merger.processInformation("My brother Julian Hönig");

// Later, more details
await merger.processInformation("Julian Hönig was born on September 11, 1976. He works at Apple as an Exterior Designer.");

// Get clean presentation
const presentation = merger.getEntityPresentation('julian-id');
console.log(presentation);
// Output: Clean, deduplicated current state with all information merged
*/