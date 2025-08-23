import { KnowledgeExtractor, ExtractedKnowledge } from './KnowledgeExtractor';
import { DocumentParser } from './DocumentParser';
import * as path from 'path';
import * as fs from 'fs/promises';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  attachments?: FileAttachment[];
  extractedKnowledge?: ExtractedKnowledge[];
}

interface FileAttachment {
  name: string;
  path: string;
  type: string;
  size: number;
}

interface ConversationContext {
  topic?: string;
  recentTopics: string[];
  activeProject?: string;
  keywords: Set<string>;
}

export class ConversationManager {
  private messages: Message[] = [];
  private knowledgeExtractor: KnowledgeExtractor;
  private documentParser: DocumentParser;
  private context: ConversationContext;
  private workspacePath: string;
  private autoExtractEnabled: boolean = true;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
    this.knowledgeExtractor = new KnowledgeExtractor();
    this.documentParser = new DocumentParser();
    this.context = {
      recentTopics: [],
      keywords: new Set()
    };
  }

  async processUserMessage(content: string, attachments?: FileAttachment[]): Promise<Message> {
    const message: Message = {
      id: this.generateId(),
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
      attachments
    };

    // Process attachments if present
    if (attachments && attachments.length > 0) {
      await this.processAttachments(attachments);
    }

    // Extract knowledge from the message
    if (this.autoExtractEnabled) {
      const extracted = await this.extractKnowledge(content);
      message.extractedKnowledge = extracted;
      
      // Automatically save extracted knowledge
      await this.saveExtractedKnowledge(extracted);
    }

    // Update context
    this.updateContext(content);
    
    // Add to message history
    this.messages.push(message);
    
    return message;
  }

  async processAssistantMessage(content: string): Promise<Message> {
    const message: Message = {
      id: this.generateId(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString()
    };

    // Extract knowledge from assistant's response too
    if (this.autoExtractEnabled) {
      const extracted = await this.extractKnowledge(content);
      message.extractedKnowledge = extracted;
      
      // Save important information from assistant
      const importantKnowledge = extracted.filter(k => k.importance !== 'low');
      await this.saveExtractedKnowledge(importantKnowledge);
    }

    // Update context
    this.updateContext(content);
    
    // Add to message history
    this.messages.push(message);
    
    return message;
  }

  private async extractKnowledge(content: string): Promise<ExtractedKnowledge[]> {
    // Context is now handled internally by the extractor
    return await this.knowledgeExtractor.extractFromConversation(content);
  }

  private async saveExtractedKnowledge(knowledge: ExtractedKnowledge[]): Promise<void> {
    for (const item of knowledge) {
      try {
        const noteUpdate = await this.knowledgeExtractor.organizeKnowledge(item, this.workspacePath);
        
        // Ensure directory exists
        const dir = path.dirname(noteUpdate.path);
        await fs.mkdir(dir, { recursive: true });
        
        // Check if file exists
        let finalContent = noteUpdate.content;
        try {
          const existingContent = await fs.readFile(noteUpdate.path, 'utf-8');
          // Merge with existing content
          finalContent = await this.knowledgeExtractor.mergeWithExisting(existingContent, item);
          noteUpdate.changeType = 'updated';
        } catch {
          // File doesn't exist, will create new
          noteUpdate.changeType = 'created';
        }
        
        // Write the file
        await fs.writeFile(noteUpdate.path, finalContent);
        
        // Log the update
        console.log(`Note ${noteUpdate.changeType}: ${noteUpdate.path}`);
        
        // Emit event for UI update
        this.emitNoteUpdate(noteUpdate);
      } catch (error) {
        console.error('Error saving extracted knowledge:', error);
      }
    }
  }

  private async processAttachments(attachments: FileAttachment[]): Promise<void> {
    for (const attachment of attachments) {
      try {
        // Parse the document
        const parsed = await this.documentParser.parseDocument(attachment.path);
        
        // Convert to markdown
        const markdown = await this.documentParser.convertToMarkdown(parsed);
        
        // Extract keywords
        const keywords = await this.documentParser.extractKeywordsFromDocument(parsed);
        
        // Create knowledge entry for the document
        const knowledge: ExtractedKnowledge = {
          topic: parsed.title,
          content: markdown,
          keywords,
          category: this.categorizeDocument(attachment.type),
          importance: 'high', // Uploaded documents are considered important
          timestamp: new Date().toISOString(),
          source: 'file'
        };
        
        // Save the document as a note
        const noteUpdate = await this.knowledgeExtractor.organizeKnowledge(knowledge, this.workspacePath);
        
        // Ensure directory exists
        const dir = path.dirname(noteUpdate.path);
        await fs.mkdir(dir, { recursive: true });
        
        // Save the file
        await fs.writeFile(noteUpdate.path, markdown);
        
        // If the document has images, save them to attachments folder
        if (parsed.images && parsed.images.length > 0) {
          await this.saveDocumentImages(parsed.images, parsed.title);
        }
        
        console.log(`Document imported: ${noteUpdate.path}`);
        this.emitNoteUpdate(noteUpdate);
      } catch (error) {
        console.error(`Error processing attachment ${attachment.name}:`, error);
      }
    }
  }

  private categorizeDocument(fileType: string): string {
    const typeMap: Record<string, string> = {
      'application/pdf': 'references',
      'application/msword': 'references',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'references',
      'application/vnd.ms-excel': 'technical',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'technical',
      'text/plain': 'general',
      'text/markdown': 'general',
      'application/json': 'technical'
    };
    
    return typeMap[fileType] || 'general';
  }

  private async saveDocumentImages(images: any[], documentTitle: string): Promise<void> {
    const imagesDir = path.join(this.workspacePath, 'attachments', 'images', documentTitle);
    await fs.mkdir(imagesDir, { recursive: true });
    
    for (const image of images) {
      const imagePath = path.join(imagesDir, image.name);
      // Convert base64 to buffer and save
      const buffer = Buffer.from(image.data, 'base64');
      await fs.writeFile(imagePath, buffer);
    }
  }

  private updateContext(content: string): void {
    // Extract potential topics from content
    const words = content.toLowerCase().split(/\s+/);
    
    // Update keywords
    const importantWords = words.filter(w => w.length > 4 && !this.isStopWord(w));
    importantWords.forEach(word => this.context.keywords.add(word));
    
    // Keep only recent keywords (last 50)
    if (this.context.keywords.size > 50) {
      const keywords = Array.from(this.context.keywords);
      this.context.keywords = new Set(keywords.slice(-50));
    }
    
    // Update recent topics (keep last 5)
    const topics = this.extractTopics(content);
    if (topics.length > 0) {
      this.context.recentTopics = [...topics, ...this.context.recentTopics].slice(0, 5);
      this.context.topic = topics[0]; // Most recent topic
    }
  }

  private extractTopics(content: string): string[] {
    // Simple topic extraction - in production, use NLP
    const patterns = [
      /about\s+(.+?)(?:\.|,|$)/gi,
      /regarding\s+(.+?)(?:\.|,|$)/gi,
      /concerning\s+(.+?)(?:\.|,|$)/gi,
      /(?:implement|create|build|design)\s+(.+?)(?:\.|,|$)/gi
    ];
    
    const topics: string[] = [];
    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          topics.push(match[1].trim());
        }
      }
    }
    
    return topics;
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can', 'shall'];
    return stopWords.includes(word);
  }

  private generateId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitNoteUpdate(update: any): void {
    // This would emit an event to update the UI
    // For now, we'll use a custom event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('note-update', { detail: update }));
    }
  }

  // Public methods for configuration
  
  setAutoExtract(enabled: boolean): void {
    this.autoExtractEnabled = enabled;
  }

  getConversationHistory(): Message[] {
    return this.messages;
  }

  getContext(): ConversationContext {
    return this.context;
  }

  async searchConversation(query: string): Promise<Message[]> {
    const queryLower = query.toLowerCase();
    return this.messages.filter(msg => 
      msg.content.toLowerCase().includes(queryLower) ||
      msg.extractedKnowledge?.some(k => 
        k.content.toLowerCase().includes(queryLower) ||
        k.keywords.some((kw: string) => kw.toLowerCase().includes(queryLower))
      )
    );
  }

  async exportConversation(): Promise<string> {
    let markdown = `# Conversation Export\n\n`;
    markdown += `**Date:** ${new Date().toLocaleString()}\n`;
    markdown += `**Messages:** ${this.messages.length}\n\n`;
    markdown += `---\n\n`;
    
    for (const msg of this.messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      markdown += `### ${msg.role === 'user' ? '👤 User' : '🤖 Assistant'} - ${time}\n\n`;
      markdown += `${msg.content}\n\n`;
      
      if (msg.extractedKnowledge && msg.extractedKnowledge.length > 0) {
        markdown += `**Extracted Knowledge:**\n`;
        for (const knowledge of msg.extractedKnowledge) {
          markdown += `- ${knowledge.topic} (${knowledge.importance})\n`;
        }
        markdown += '\n';
      }
      
      if (msg.attachments && msg.attachments.length > 0) {
        markdown += `**Attachments:**\n`;
        for (const attachment of msg.attachments) {
          markdown += `- ${attachment.name} (${attachment.type})\n`;
        }
        markdown += '\n';
      }
    }
    
    return markdown;
  }

  clearConversation(): void {
    this.messages = [];
    this.context = {
      recentTopics: [],
      keywords: new Set()
    };
  }
}