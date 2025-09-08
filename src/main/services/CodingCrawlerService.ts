/**
 * CodingCrawlerService - Standalone service for crawling and indexing coding documentation
 * This service is completely independent from other features
 */

import { EventEmitter } from 'events';
import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import * as path from 'path';
import * as fs from 'fs/promises';
import { URL } from 'url';

// Crawl profiles for popular documentation sites
export interface CrawlProfile {
  name: string;
  baseUrl: string;
  selectors: {
    content: string;
    codeBlocks: string;
    apiDocs: string;
    navigation: string;
    title: string;
  };
  patterns: {
    apiPages?: RegExp;
    tutorialPages?: RegExp;
    examplePages?: RegExp;
    skipPages?: RegExp;
  };
  preprocessing?: (html: string) => string;
}

export interface CrawlOptions {
  urls: string[];
  maxPages?: number;
  depth?: number;
  profile?: string;
  respectRobotsTxt?: boolean;
  rateLimit?: number; // milliseconds between requests
  outputPath?: string;
}

export interface CodeBlock {
  language: string;
  code: string;
  title?: string;
  description?: string;
  imports?: string[];
  lineNumber?: number;
}

export interface APIReference {
  className?: string;
  methodName: string;
  signature: string;
  parameters: Array<{
    name: string;
    type: string;
    description?: string;
    required?: boolean;
  }>;
  returnType?: string;
  description: string;
  examples?: CodeBlock[];
}

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  codeBlocks: CodeBlock[];
  apiReferences: APIReference[];
  metadata: {
    language?: string;
    framework?: string;
    version?: string;
    lastUpdated?: Date;
  };
}

export class CodingCrawlerService extends EventEmitter {
  private visitedUrls: Set<string> = new Set();
  private urlQueue: string[] = [];
  private crawlResults: CrawlResult[] = [];
  private profiles: Map<string, CrawlProfile>;
  private activeProfile?: CrawlProfile;
  private outputPath: string;
  private isRunning: boolean = false;

  constructor() {
    super();
    this.profiles = new Map();
    this.initializeProfiles();
    this.outputPath = '';
  }

  private initializeProfiles() {
    // Rust documentation profile
    this.profiles.set('rust-docs', {
      name: 'rust-docs',
      baseUrl: 'https://doc.rust-lang.org',
      selectors: {
        content: '.content',
        codeBlocks: 'pre.rust, pre.language-rust',
        apiDocs: '.docblock',
        navigation: '.sidebar',
        title: 'h1.fqn'
      },
      patterns: {
        apiPages: /\/std\//,
        tutorialPages: /\/book\//,
        examplePages: /\/rust-by-example\//,
        skipPages: /\/(search|about|help)\//
      }
    });

    // Pydantic AI documentation profile
    this.profiles.set('pydantic-ai', {
      name: 'pydantic-ai',
      baseUrl: 'https://ai.pydantic.dev',
      selectors: {
        content: '.markdown-body, .content',
        codeBlocks: 'pre code, .highlight',
        apiDocs: '.api-docs, .autodoc',
        navigation: '.nav-menu, .sidebar',
        title: 'h1'
      },
      patterns: {
        apiPages: /\/(api|reference)\//,
        tutorialPages: /\/(guide|tutorial)\//,
        examplePages: /\/examples?\//,
        skipPages: /\/(search|404|login)\//
      }
    });

    // React documentation profile
    this.profiles.set('react-docs', {
      name: 'react-docs',
      baseUrl: 'https://react.dev',
      selectors: {
        content: 'main, article',
        codeBlocks: 'pre code, .code-block',
        apiDocs: '.api-reference',
        navigation: 'nav',
        title: 'h1'
      },
      patterns: {
        apiPages: /\/reference\//,
        tutorialPages: /\/learn\//,
        examplePages: /\/examples?\//
      }
    });
  }

  /**
   * Start crawling documentation
   */
  async crawl(options: CrawlOptions): Promise<{
    success: boolean;
    totalPages: number;
    results: CrawlResult[];
    outputPath?: string;
  }> {
    if (this.isRunning) {
      throw new Error('Crawl already in progress');
    }

    this.isRunning = true;
    this.visitedUrls.clear();
    this.crawlResults = [];
    this.urlQueue = [...options.urls];
    this.outputPath = options.outputPath || path.join(process.cwd(), '.knowledge');

    // Set active profile if specified
    if (options.profile && this.profiles.has(options.profile)) {
      this.activeProfile = this.profiles.get(options.profile);
    }

    const maxPages = options.maxPages || 100;
    const rateLimit = options.rateLimit || 500;

    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputPath, { recursive: true });

      while (this.urlQueue.length > 0 && this.visitedUrls.size < maxPages) {
        const url = this.urlQueue.shift()!;
        
        if (this.visitedUrls.has(url)) {
          continue;
        }

        // Check if URL should be skipped
        if (this.shouldSkipUrl(url)) {
          continue;
        }

        this.emit('progress', {
          status: 'crawling',
          currentUrl: url,
          pagesProcessed: this.visitedUrls.size,
          totalPages: maxPages,
          queueSize: this.urlQueue.length
        });

        try {
          const result = await this.crawlPage(url);
          if (result) {
            this.crawlResults.push(result);
            this.visitedUrls.add(url);

            // Extract and queue new URLs from the page
            const newUrls = this.extractUrls(result.content, url);
            this.urlQueue.push(...newUrls);
          }
        } catch (error) {
          console.error(`Error crawling ${url}:`, error);
          this.emit('error', { url, error });
        }

        // Rate limiting
        await this.sleep(rateLimit);
      }

      // Save results to database
      await this.saveResults();

      this.emit('complete', {
        totalPages: this.crawlResults.length,
        outputPath: this.outputPath
      });

      return {
        success: true,
        totalPages: this.crawlResults.length,
        results: this.crawlResults,
        outputPath: this.outputPath
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Crawl a single page
   */
  private async crawlPage(url: string): Promise<CrawlResult | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Use profile selectors if available
      const selectors = this.activeProfile?.selectors || {
        content: 'main, article, .content',
        codeBlocks: 'pre code',
        apiDocs: '.api',
        title: 'h1'
      };

      // Extract title
      const title = $(selectors.title).first().text().trim() || 
                   $('title').text().trim() || 
                   'Untitled';

      // Extract main content
      const content = $(selectors.content).text().trim();

      // Extract code blocks
      const codeBlocks = this.extractCodeBlocks($, selectors.codeBlocks);

      // Extract API references
      const apiReferences = this.extractAPIReferences($, selectors.apiDocs);

      // Detect metadata
      const metadata = this.detectMetadata($, url);

      return {
        url,
        title,
        content,
        codeBlocks,
        apiReferences,
        metadata
      };

    } catch (error) {
      console.error(`Failed to crawl ${url}:`, error);
      return null;
    }
  }

  /**
   * Extract code blocks from the page
   */
  private extractCodeBlocks($: any, selector: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];

    $(selector).each((index: number, element: any) => {
      const $elem = $(element);
      const code = $elem.text().trim();
      
      // Try to detect language from class names
      const classes = $elem.attr('class') || $elem.parent().attr('class') || '';
      const language = this.detectLanguage(classes, code);

      // Extract title from preceding heading or comment
      const $prev = $elem.parent().prev();
      const title = $prev.is('h1, h2, h3, h4, h5, h6') ? 
                   $prev.text().trim() : undefined;

      // Extract imports
      const imports = this.extractImports(code, language);

      if (code) {
        codeBlocks.push({
          language,
          code,
          title,
          imports,
          lineNumber: index
        });
      }
    });

    return codeBlocks;
  }

  /**
   * Extract API references
   */
  private extractAPIReferences($: any, selector: string): APIReference[] {
    const apiReferences: APIReference[] = [];

    $(selector).each((_: number, element: any) => {
      const $elem = $(element);
      
      // Extract method signature
      const signature = $elem.find('.signature, code').first().text().trim();
      if (!signature) return;

      // Parse method name from signature
      const methodMatch = signature.match(/(?:fn|function|def|method)\s+(\w+)/);
      const methodName = methodMatch ? methodMatch[1] : signature.split('(')[0].trim();

      // Extract description
      const description = $elem.find('.description, p').first().text().trim();

      // Extract parameters (simplified)
      const parameters: APIReference['parameters'] = [];
      $elem.find('.parameter, .param').each((_: number, param: any) => {
        const $param = $(param);
        parameters.push({
          name: $param.find('.name').text().trim() || 'unknown',
          type: $param.find('.type').text().trim() || 'any',
          description: $param.find('.desc').text().trim()
        });
      });

      apiReferences.push({
        methodName,
        signature,
        parameters,
        description
      });
    });

    return apiReferences;
  }

  /**
   * Detect language from class names or code content
   */
  private detectLanguage(classes: string, code: string): string {
    // Check class names
    const classLangs = ['rust', 'python', 'javascript', 'typescript', 'go', 'java', 'cpp', 'c'];
    for (const lang of classLangs) {
      if (classes.toLowerCase().includes(lang)) {
        return lang;
      }
    }

    // Simple heuristics based on code content
    if (code.includes('fn ') && code.includes('let ')) return 'rust';
    if (code.includes('def ') && code.includes('import ')) return 'python';
    if (code.includes('function ') || code.includes('const ')) return 'javascript';
    if (code.includes('interface ') || code.includes(': string')) return 'typescript';
    
    return 'unknown';
  }

  /**
   * Extract import statements from code
   */
  private extractImports(code: string, language: string): string[] {
    const imports: string[] = [];
    const lines = code.split('\n');

    for (const line of lines) {
      // Rust
      if (language === 'rust' && line.trim().startsWith('use ')) {
        imports.push(line.trim());
      }
      // Python
      else if (language === 'python' && (line.trim().startsWith('import ') || line.trim().startsWith('from '))) {
        imports.push(line.trim());
      }
      // JavaScript/TypeScript
      else if (['javascript', 'typescript'].includes(language) && 
               (line.trim().startsWith('import ') || line.trim().startsWith('const ') && line.includes('require'))) {
        imports.push(line.trim());
      }
    }

    return imports;
  }

  /**
   * Detect metadata about the documentation
   */
  private detectMetadata($: any, url: string): CrawlResult['metadata'] {
    const metadata: CrawlResult['metadata'] = {};

    // Try to detect version
    const versionText = $('.version, .release').text();
    const versionMatch = versionText.match(/(\d+\.\d+(\.\d+)?)/);
    if (versionMatch) {
      metadata.version = versionMatch[1];
    }

    // Detect language/framework from URL or content
    if (url.includes('rust')) metadata.language = 'rust';
    else if (url.includes('python') || url.includes('pydantic')) metadata.language = 'python';
    else if (url.includes('react')) {
      metadata.language = 'javascript';
      metadata.framework = 'react';
    }

    metadata.lastUpdated = new Date();

    return metadata;
  }

  /**
   * Extract URLs from the page for further crawling
   */
  private extractUrls(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];
    const base = new URL(baseUrl);

    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (!href) return;

      try {
        const url = new URL(href, base);
        
        // Only crawl same domain
        if (url.hostname === base.hostname) {
          urls.push(url.toString());
        }
      } catch {
        // Invalid URL, skip
      }
    });

    return [...new Set(urls)]; // Remove duplicates
  }

  /**
   * Check if URL should be skipped
   */
  private shouldSkipUrl(url: string): boolean {
    if (!this.activeProfile) return false;

    const skipPattern = this.activeProfile.patterns.skipPages;
    if (skipPattern && skipPattern.test(url)) {
      return true;
    }

    // Skip non-documentation pages
    const skipExtensions = ['.pdf', '.zip', '.tar', '.gz', '.png', '.jpg', '.gif'];
    return skipExtensions.some(ext => url.toLowerCase().endsWith(ext));
  }

  /**
   * Save crawl results to database
   */
  private async saveResults(): Promise<void> {
    // This will be implemented to save to SQLite database
    // For now, save as JSON for testing
    const outputFile = path.join(this.outputPath, 'crawl_results.json');
    await fs.writeFile(
      outputFile,
      JSON.stringify(this.crawlResults, null, 2)
    );
  }

  /**
   * Helper function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Stop the current crawl
   */
  stop(): void {
    this.isRunning = false;
    this.urlQueue = [];
    this.emit('stopped', {
      pagesProcessed: this.visitedUrls.size
    });
  }

  /**
   * Get available profiles
   */
  getProfiles(): CrawlProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Add a custom profile
   */
  addProfile(profile: CrawlProfile): void {
    this.profiles.set(profile.name, profile);
  }
}