/**
 * Intelligent Web Crawler with Instruction Support
 * Can follow natural language instructions for targeted crawling and content generation
 */

import { WebCrawler, CrawlOptions, CrawlResult, ExtractedContent } from './WebCrawler';
import { LLMService } from '../../core/LLMService';

export interface ParsedInstruction {
  intent: 'extract' | 'summarize' | 'answer' | 'compare' | 'generate' | 'default';
  targets: string[];           // What to look for
  outputFormat: 'markdown' | 'table' | 'list' | 'paragraph' | 'json';
  depth: 'shallow' | 'deep' | 'smart';  // How thoroughly to crawl
  filters: string[];           // What to include/exclude
  question?: string;           // For Q&A intent
}

export interface IntelligentCrawlResult extends CrawlResult {
  processedContent?: ProcessedContent;
  instruction?: ParsedInstruction;
}

export interface ProcessedContent {
  type: string;
  content: string;
  metadata: {
    instruction: string;
    intent: string;
    sourcesUsed: number;
    processingTime: number;
  };
  suggestedFilePath?: string;
  entities?: Array<{ type: string; name: string; context: string }>;
}

export class IntelligentWebCrawler {
  private llmService: LLMService | null = null;

  constructor() {}

  /**
   * Initialize with LLM service
   */
  setLLMService(llmService: LLMService): void {
    this.llmService = llmService;
  }

  /**
   * Crawl with natural language instructions
   */
  async crawlWithInstruction(
    url: string, 
    instruction: string = ''
  ): Promise<IntelligentCrawlResult> {
    // Parse instruction if provided
    let parsedInstruction: ParsedInstruction | undefined;
    let crawlOptions: CrawlOptions;

    if (instruction && this.llmService) {
      parsedInstruction = await this.parseInstruction(instruction);
      crawlOptions = this.buildCrawlStrategy(url, parsedInstruction);
    } else {
      // Default crawl options
      crawlOptions = {
        url,
        depth: 0,
        maxPages: 1,
        includeSubdomains: false,
        respectRobotsTxt: true
      };
    }

    // Perform the crawl
    const crawler = new WebCrawler(crawlOptions);
    const crawlResult = await crawler.crawl();

    // Process content based on instruction
    let processedContent: ProcessedContent | undefined;
    if (instruction && parsedInstruction && this.llmService) {
      processedContent = await this.processContent(
        crawlResult.pages,
        instruction,
        parsedInstruction
      );
    }

    return {
      ...crawlResult,
      processedContent,
      instruction: parsedInstruction
    };
  }

  /**
   * Parse natural language instruction using LLM
   */
  private async parseInstruction(instruction: string): Promise<ParsedInstruction> {
    if (!this.llmService) {
      throw new Error('LLM service not initialized');
    }

    const prompt = `Analyze this web scraping instruction and return a JSON object with the following structure:
{
  "intent": "extract|summarize|answer|compare|generate|default",
  "targets": ["array of specific things to look for"],
  "outputFormat": "markdown|table|list|paragraph|json",
  "depth": "shallow|deep|smart",
  "filters": ["things to include or exclude"],
  "question": "the specific question if intent is answer"
}

Instruction: "${instruction}"

Examples:
- "Find all pricing information" → intent: "extract", targets: ["pricing", "plans", "costs"]
- "Summarize the main points" → intent: "summarize", outputFormat: "paragraph"
- "How does authentication work?" → intent: "answer", question: "How does authentication work?"
- "Create a blog post about this" → intent: "generate", outputFormat: "markdown"
- "Compare with our features" → intent: "compare", targets: ["features", "capabilities"]

Return only the JSON object, no explanation:`;

    try {
      const response = await this.llmService.sendMessage(prompt, []);
      const parsed = JSON.parse(response.content || '{}');
      
      // Validate and provide defaults
      return {
        intent: parsed.intent || 'default',
        targets: parsed.targets || [],
        outputFormat: parsed.outputFormat || 'markdown',
        depth: parsed.depth || 'smart',
        filters: parsed.filters || [],
        question: parsed.question
      };
    } catch (error) {
      console.error('Failed to parse instruction:', error);
      // Return default if parsing fails
      return {
        intent: 'default',
        targets: [],
        outputFormat: 'markdown',
        depth: 'shallow',
        filters: []
      };
    }
  }

  /**
   * Build crawl strategy based on parsed instruction
   */
  private buildCrawlStrategy(url: string, instruction: ParsedInstruction): CrawlOptions {
    let depth = 0;
    let maxPages = 1;

    // Adjust depth based on intent and instruction
    switch (instruction.depth) {
      case 'deep':
        depth = 3;
        maxPages = 50;
        break;
      case 'smart':
        // Smart depth based on intent
        if (instruction.intent === 'answer' || instruction.intent === 'extract') {
          depth = 2;
          maxPages = 10;
        } else if (instruction.intent === 'compare' || instruction.intent === 'generate') {
          depth = 1;
          maxPages = 20;
        }
        break;
      case 'shallow':
      default:
        depth = 0;
        maxPages = 1;
    }

    // Build selectors based on targets
    const selectors = this.buildSelectors(instruction);

    return {
      url,
      depth,
      maxPages,
      includeSubdomains: false,
      respectRobotsTxt: true,
      instruction: instruction.question || instruction.targets.join(', '),
      selectors
    };
  }

  /**
   * Build CSS selectors based on instruction targets
   */
  private buildSelectors(instruction: ParsedInstruction): { content?: string; excludes?: string[] } {
    const excludes = [
      '.ads', '.advertisement', '.cookie-banner', 
      '.popup', '.modal', '.newsletter-signup'
    ];

    // Add instruction-specific selectors
    if (instruction.intent === 'extract' && instruction.targets.includes('pricing')) {
      return {
        content: '.pricing, .plans, .price-table, [class*="price"], [id*="price"]',
        excludes
      };
    }

    if (instruction.intent === 'answer' && instruction.targets.some(t => t.includes('doc'))) {
      return {
        content: '.documentation, .docs, article, .content, main',
        excludes
      };
    }

    return { excludes };
  }

  /**
   * Process crawled content based on instruction
   */
  private async processContent(
    pages: ExtractedContent[],
    instruction: string,
    parsed: ParsedInstruction
  ): Promise<ProcessedContent> {
    if (!this.llmService) {
      throw new Error('LLM service not initialized');
    }

    const startTime = Date.now();
    let processedContent: string = '';
    let type: string = parsed.intent;

    // Combine all page content
    const combinedText = pages.map(p => `
URL: ${p.url}
Title: ${p.title}
Content: ${p.text}
`).join('\n\n---\n\n');

    switch (parsed.intent) {
      case 'extract':
        processedContent = await this.extractSpecific(combinedText, parsed.targets);
        break;
      
      case 'summarize':
        processedContent = await this.summarizeContent(combinedText, parsed.outputFormat);
        break;
      
      case 'answer':
        if (parsed.question) {
          processedContent = await this.answerQuestion(combinedText, parsed.question);
        }
        break;
      
      case 'generate':
        processedContent = await this.generateContent(combinedText, instruction);
        break;
      
      case 'compare':
        processedContent = await this.compareContent(combinedText, parsed.targets);
        break;
      
      default:
        processedContent = this.formatAsMarkdown(pages);
    }

    // Extract entities for knowledge graph
    const entities = await this.extractEntities(combinedText);

    // Suggest file path based on intent
    const suggestedFilePath = this.suggestFilePath(parsed, pages[0]?.url);

    return {
      type,
      content: processedContent,
      metadata: {
        instruction,
        intent: parsed.intent,
        sourcesUsed: pages.length,
        processingTime: Date.now() - startTime
      },
      suggestedFilePath,
      entities
    };
  }

  /**
   * Extract specific information
   */
  private async extractSpecific(content: string, targets: string[]): Promise<string> {
    if (!this.llmService) return content;

    const prompt = `Extract the following information from the web content:
${targets.map(t => `- ${t}`).join('\n')}

Format the extracted information in a clear, structured markdown format.

Content:
${content.substring(0, 8000)}

Extracted Information:`;

    const response = await this.llmService.sendMessage(prompt, []);
    return response.content || content;
  }

  /**
   * Summarize content
   */
  private async summarizeContent(content: string, format: string): Promise<string> {
    if (!this.llmService) return content;

    const prompt = `Summarize the following web content in ${format} format.
Focus on the main points, key insights, and important information.

Content:
${content.substring(0, 8000)}

Summary:`;

    const response = await this.llmService.sendMessage(prompt, []);
    return response.content || content;
  }

  /**
   * Answer a specific question
   */
  private async answerQuestion(content: string, question: string): Promise<string> {
    if (!this.llmService) return 'Unable to answer question.';

    const prompt = `Based on the following web content, answer this question:
Question: ${question}

Provide a clear, direct answer. If the answer is not in the content, say so.

Content:
${content.substring(0, 8000)}

Answer:`;

    const response = await this.llmService.sendMessage(prompt, []);
    return response.content || content;
  }

  /**
   * Generate new content based on source
   */
  private async generateContent(content: string, instruction: string): Promise<string> {
    if (!this.llmService) return content;

    const prompt = `Based on the following web content, ${instruction}

Source Content:
${content.substring(0, 6000)}

Generated Content:`;

    const response = await this.llmService.sendMessage(prompt, []);
    return response.content || content;
  }

  /**
   * Compare content with targets
   */
  private async compareContent(content: string, targets: string[]): Promise<string> {
    if (!this.llmService) return content;

    const prompt = `Compare the following aspects in the web content:
${targets.map(t => `- ${t}`).join('\n')}

Create a comparison table or structured analysis.

Content:
${content.substring(0, 8000)}

Comparison:`;

    const response = await this.llmService.sendMessage(prompt, []);
    return response.content || content;
  }

  /**
   * Extract entities for knowledge graph
   */
  private async extractEntities(content: string): Promise<Array<{ type: string; name: string; context: string }>> {
    if (!this.llmService) return [];

    const prompt = `Extract key entities (people, organizations, products, technologies) from this content.
Return as JSON array with: type, name, context

Content:
${content.substring(0, 4000)}

Entities (JSON array only):`;

    try {
      const response = await this.llmService.sendMessage(prompt, []);
      return JSON.parse(response.content || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Format pages as markdown (default)
   */
  private formatAsMarkdown(pages: ExtractedContent[]): string {
    return pages.map(page => `# ${page.title}

**Source:** ${page.url}
**Captured:** ${page.timestamp.toISOString()}

${page.text}

${page.links.length > 0 ? `\n## Links\n${page.links.map(l => `- ${l}`).join('\n')}` : ''}
`).join('\n\n---\n\n');
  }

  /**
   * Suggest file path based on intent and content
   */
  private suggestFilePath(instruction: ParsedInstruction, url?: string): string {
    const date = new Date().toISOString().split('T')[0];
    const domain = url ? new URL(url).hostname.replace('www.', '') : 'web';
    
    switch (instruction.intent) {
      case 'extract':
        return `extracted/${domain}/${date}-${instruction.targets[0] || 'data'}.md`;
      case 'summarize':
        return `summaries/${domain}/${date}.md`;
      case 'answer':
        return `qa/${date}/${domain}.md`;
      case 'generate':
        return `generated/${date}/${domain}.md`;
      case 'compare':
        return `comparisons/${date}/${instruction.targets[0] || 'comparison'}.md`;
      default:
        return `web/${domain}/${date}.md`;
    }
  }
}