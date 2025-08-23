import * as path from 'path';

export interface ExtractedKnowledge {
  topic: string;
  content: string;
  keywords: string[];
  category: string;
  importance: 'high' | 'medium' | 'low';
  timestamp: string;
  source: 'conversation' | 'file' | 'manual';
  relatedNotes?: string[];
}

interface NoteUpdate {
  path: string;
  content: string;
  lastModified: string;
  changeType: 'created' | 'updated' | 'unchanged';
}

export class KnowledgeExtractor {
  // private knowledgeBase: Map<string, ExtractedKnowledge> = new Map(); // Reserved for future use
  private categories = {
    technical: ['code', 'programming', 'api', 'function', 'bug', 'error', 'implementation'],
    concepts: ['idea', 'theory', 'principle', 'concept', 'framework', 'pattern'],
    tasks: ['todo', 'task', 'implement', 'fix', 'create', 'build', 'design'],
    references: ['link', 'url', 'resource', 'documentation', 'guide', 'tutorial'],
    questions: ['how', 'what', 'why', 'when', 'where', 'can', 'should'],
    decisions: ['decided', 'chose', 'selected', 'agreed', 'concluded', 'determined']
  };

  async extractFromConversation(message: string): Promise<ExtractedKnowledge[]> {
    const extracted: ExtractedKnowledge[] = [];
    
    // Split message into semantic chunks
    const chunks = this.splitIntoChunks(message);
    
    for (const chunk of chunks) {
      // Analyze chunk importance
      const importance = this.analyzeImportance(chunk);
      
      // Skip low importance chunks unless they contain key information
      if (importance === 'low' && !this.containsKeyInformation(chunk)) {
        continue;
      }
      
      // Extract topic and keywords
      const topic = this.extractTopic(chunk);
      const keywords = this.extractKeywords(chunk);
      const category = this.categorizeContent(chunk, keywords);
      
      // Check for existing related notes
      const relatedNotes = await this.findRelatedNotes(topic, keywords);
      
      extracted.push({
        topic,
        content: chunk,
        keywords,
        category,
        importance,
        timestamp: new Date().toISOString(),
        source: 'conversation',
        relatedNotes
      });
    }
    
    return extracted;
  }

  private splitIntoChunks(text: string): string[] {
    // Split by sentences, but keep related sentences together
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (this.isRelatedSentence(currentChunk, sentence)) {
        currentChunk += ' ' + sentence.trim();
      } else {
        if (currentChunk) chunks.push(currentChunk.trim());
        currentChunk = sentence.trim();
      }
    }
    
    if (currentChunk) chunks.push(currentChunk.trim());
    return chunks;
  }

  private isRelatedSentence(_current: string, next: string): boolean {
    // Check if sentences are related by pronouns, conjunctions, or topics
    const relationIndicators = ['therefore', 'however', 'also', 'furthermore', 'this', 'that', 'these', 'those'];
    const nextLower = next.toLowerCase();
    return relationIndicators.some(indicator => nextLower.includes(indicator));
  }

  private analyzeImportance(text: string): 'high' | 'medium' | 'low' {
    const highIndicators = ['important', 'critical', 'must', 'required', 'essential', 'key', 'main', 'primary'];
    const mediumIndicators = ['should', 'consider', 'note', 'remember', 'useful', 'helpful'];
    
    const textLower = text.toLowerCase();
    
    if (highIndicators.some(ind => textLower.includes(ind))) return 'high';
    if (mediumIndicators.some(ind => textLower.includes(ind))) return 'medium';
    
    // Check for actionable items
    if (this.containsActionableItem(text)) return 'high';
    
    // Check for definitions or explanations
    if (text.includes(':') || text.includes('is defined as') || text.includes('means')) return 'medium';
    
    return 'low';
  }

  private containsActionableItem(text: string): boolean {
    const actionWords = ['create', 'implement', 'fix', 'update', 'delete', 'modify', 'build', 'design'];
    return actionWords.some(word => text.toLowerCase().includes(word));
  }

  private containsKeyInformation(text: string): boolean {
    // Check for URLs, code snippets, file paths, specific names
    const patterns = [
      /https?:\/\/[^\s]+/,  // URLs
      /`[^`]+`/,            // Code snippets
      /\/[\w\/]+\.\w+/,     // File paths
      /[A-Z][a-z]+[A-Z]\w*/, // CamelCase (likely class/component names)
    ];
    
    return patterns.some(pattern => pattern.test(text));
  }

  private extractTopic(text: string): string {
    // Extract the main topic from the text
    const sentences = text.split(/[.!?]/)[0]; // Get first sentence
    
    // Remove common starting phrases
    const cleanedSentence = sentences
      .replace(/^(we need to|we should|let's|i think|i believe|the|a|an)\s+/i, '')
      .trim();
    
    // Extract noun phrases as potential topics
    const words = cleanedSentence.split(' ');
    if (words.length <= 5) {
      return cleanedSentence;
    }
    
    // For longer sentences, extract the key phrase
    const keyPhrases = this.extractKeyPhrases(cleanedSentence);
    return keyPhrases[0] || cleanedSentence.substring(0, 50) + '...';
  }

  private extractKeyPhrases(text: string): string[] {
    // Simple key phrase extraction
    const phrases: string[] = [];
    
    // Look for patterns like "X is Y", "X of Y", etc.
    const patterns = [
      /(\w+\s+(?:of|for|in|with)\s+\w+)/gi,
      /(\w+\s+\w+\s+(?:system|feature|component|module))/gi,
      /(?:implement|create|build|design)\s+(\w+\s+\w+)/gi
    ];
    
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        phrases.push(...matches);
      }
    }
    
    return phrases.slice(0, 3); // Return top 3 phrases
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by', 'that', 'this', 'these', 'those', 'it', 'its']);
    
    // Extract potential keywords
    const words = text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
    
    // Count word frequency
    const wordFreq = new Map<string, number>();
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }
    
    // Sort by frequency and return top keywords
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  private categorizeContent(text: string, keywords: string[]): string {
    const textLower = text.toLowerCase();
    const allWords = textLower + ' ' + keywords.join(' ');
    
    let maxScore = 0;
    let bestCategory = 'general';
    
    for (const [category, indicators] of Object.entries(this.categories)) {
      const score = indicators.filter(ind => allWords.includes(ind)).length;
      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    }
    
    return bestCategory;
  }

  private async findRelatedNotes(_topic: string, _keywords: string[]): Promise<string[]> {
    // This would search existing notes for related content
    // For now, return empty array - will be implemented with file system integration
    return [];
  }

  async organizeKnowledge(knowledge: ExtractedKnowledge, workspacePath: string): Promise<NoteUpdate> {
    // Determine the appropriate folder based on category
    const folderMap: Record<string, string> = {
      technical: 'notes/technical',
      concepts: 'notes/concepts',
      tasks: 'projects/tasks',
      references: 'references',
      questions: 'notes/questions',
      decisions: 'notes/decisions',
      general: 'notes'
    };
    
    const folder = folderMap[knowledge.category] || 'notes';
    const folderPath = path.join(workspacePath, folder);
    
    // Generate filename from topic
    const fileName = this.generateFileName(knowledge.topic);
    const filePath = path.join(folderPath, fileName);
    
    // Check if file exists and merge content if needed
    const noteContent = await this.formatNoteContent(knowledge);
    
    return {
      path: filePath,
      content: noteContent,
      lastModified: knowledge.timestamp,
      changeType: 'created' // Will be determined by actual file system check
    };
  }

  private generateFileName(topic: string): string {
    // Convert topic to valid filename
    const cleaned = topic
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);
    
    return `${cleaned}.md`;
  }

  private async formatNoteContent(knowledge: ExtractedKnowledge): Promise<string> {
    const { topic, content, keywords, category, importance, timestamp, relatedNotes } = knowledge;
    
    let markdown = `# ${topic}\n\n`;
    markdown += `**Created:** ${new Date(timestamp).toLocaleString()}\n`;
    markdown += `**Category:** ${category}\n`;
    markdown += `**Importance:** ${importance}\n`;
    markdown += `**Keywords:** ${keywords.map(k => `#${k}`).join(' ')}\n\n`;
    markdown += `---\n\n`;
    markdown += `${content}\n\n`;
    
    if (relatedNotes && relatedNotes.length > 0) {
      markdown += `## Related Notes\n\n`;
      for (const note of relatedNotes) {
        markdown += `- [[${note}]]\n`;
      }
      markdown += '\n';
    }
    
    markdown += `---\n`;
    markdown += `*Automatically extracted from conversation*\n`;
    
    return markdown;
  }

  async mergeWithExisting(existingContent: string, newKnowledge: ExtractedKnowledge): Promise<string> {
    // Parse existing content
    const lines = existingContent.split('\n');
    const updateTimestamp = `\n**Last Updated:** ${new Date(newKnowledge.timestamp).toLocaleString()}\n`;
    
    // Find the content section
    const contentStart = lines.findIndex(line => line.startsWith('---')) + 1;
    const contentEnd = lines.findIndex((line, idx) => idx > contentStart && line.startsWith('---'));
    
    // Check if new content already exists
    if (!existingContent.includes(newKnowledge.content)) {
      // Add new content after existing content
      const newSection = `\n## Update - ${new Date(newKnowledge.timestamp).toLocaleDateString()}\n\n${newKnowledge.content}\n`;
      
      if (contentEnd > -1) {
        lines.splice(contentEnd, 0, newSection);
      } else {
        lines.push(newSection);
      }
    }
    
    // Update keywords if new ones found
    const keywordLine = lines.findIndex(line => line.startsWith('**Keywords:**'));
    if (keywordLine > -1) {
      const existingKeywords = lines[keywordLine].match(/#\w+/g) || [];
      const allKeywords = new Set([...existingKeywords, ...newKnowledge.keywords.map(k => `#${k}`)]);
      lines[keywordLine] = `**Keywords:** ${Array.from(allKeywords).join(' ')}`;
    }
    
    // Add update timestamp
    const createdLine = lines.findIndex(line => line.startsWith('**Created:**'));
    if (createdLine > -1 && !lines[createdLine + 1].startsWith('**Last Updated:**')) {
      lines.splice(createdLine + 1, 0, updateTimestamp);
    }
    
    return lines.join('\n');
  }
}