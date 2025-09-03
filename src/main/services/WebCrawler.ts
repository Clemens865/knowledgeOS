/**
 * Web Crawler Service using Electron's net module
 * No CORS restrictions - direct HTTP requests like curl/wget
 */

import { net } from 'electron';
import * as cheerio from 'cheerio';
import { URL } from 'url';

export interface CrawlOptions {
  url: string;
  depth: number;                    // How deep to crawl (0 = single page)
  maxPages: number;                 // Maximum pages to crawl
  includeSubdomains: boolean;       // Whether to crawl subdomains
  respectRobotsTxt: boolean;        // Whether to respect robots.txt
  instruction?: string;             // Optional user instruction for smart crawling
  selectors?: {
    content?: string;               // CSS selector for main content
    excludes?: string[];            // Selectors to exclude (ads, nav, etc.)
  };
}

export interface ExtractedContent {
  url: string;
  title: string;
  text: string;
  html: string;
  links: string[];
  images: string[];
  metadata: {
    author?: string;
    date?: string;
    description?: string;
    keywords?: string[];
  };
  timestamp: Date;
}

export interface CrawlResult {
  pages: ExtractedContent[];
  totalPages: number;
  errors: Array<{ url: string; error: string }>;
  duration: number;
}

export class WebCrawler {
  private queue: Set<string> = new Set();
  private visited: Set<string> = new Set();
  private results: Map<string, ExtractedContent> = new Map();
  private errors: Array<{ url: string; error: string }> = [];
  private startTime: number = 0;
  private baseUrl: URL;
  private options: CrawlOptions;

  constructor(options: CrawlOptions) {
    this.options = options;
    this.baseUrl = new URL(options.url);
  }

  /**
   * Main crawl method
   */
  async crawl(): Promise<CrawlResult> {
    this.startTime = Date.now();
    this.queue.add(this.options.url);

    // Check robots.txt if needed
    if (this.options.respectRobotsTxt) {
      await this.checkRobotsTxt();
    }

    // Process queue
    while (this.queue.size > 0 && this.visited.size < this.options.maxPages) {
      const batch = Array.from(this.queue).slice(0, 5); // Process 5 at a time
      
      await Promise.all(
        batch.map(async (url) => {
          this.queue.delete(url);
          if (!this.visited.has(url)) {
            await this.crawlPage(url, 0);
          }
        })
      );
    }

    return {
      pages: Array.from(this.results.values()),
      totalPages: this.results.size,
      errors: this.errors,
      duration: Date.now() - this.startTime
    };
  }

  /**
   * Crawl a single page
   */
  private async crawlPage(url: string, currentDepth: number): Promise<void> {
    if (this.visited.has(url) || this.visited.size >= this.options.maxPages) {
      return;
    }

    this.visited.add(url);

    try {
      const html = await this.fetchPage(url);
      const content = this.extractContent(html, url);
      this.results.set(url, content);

      // Add discovered links to queue if within depth limit
      if (currentDepth < this.options.depth) {
        for (const link of content.links) {
          if (this.shouldCrawl(link)) {
            this.queue.add(link);
          }
        }
      }
    } catch (error) {
      this.errors.push({ 
        url, 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Fetch page content using Electron's net module
   * No CORS restrictions!
   */
  private fetchPage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request({
        method: 'GET',
        url: url,
        redirect: 'follow'
      });

      let data = '';
      
      request.on('response', (response) => {
        // Check content type
        const contentType = response.headers['content-type'] as string;
        if (contentType && !contentType.includes('text/html')) {
          reject(new Error(`Non-HTML content type: ${contentType}`));
          return;
        }

        response.on('data', (chunk) => {
          data += chunk.toString();
        });

        response.on('end', () => {
          resolve(data);
        });

        response.on('error', (error) => {
          reject(error);
        });
      });

      request.on('error', (error) => {
        reject(error);
      });

      // Set user agent to identify ourselves
      request.setHeader('User-Agent', 'KnowledgeOS-Octopus/1.0 (Intelligent Web Crawler)');
      
      request.end();
    });
  }

  /**
   * Extract content from HTML
   */
  private extractContent(html: string, url: string): ExtractedContent {
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    if (this.options.selectors?.excludes) {
      this.options.selectors.excludes.forEach(selector => {
        $(selector).remove();
      });
    }
    
    // Common ad/nav selectors to remove by default
    $('.advertisement, .ads, .nav, .sidebar, .footer, .header, .cookie-banner').remove();
    $('script, style, noscript').remove();

    // Extract main content
    let contentElement = $('body');
    if (this.options.selectors?.content) {
      const selected = $(this.options.selectors.content);
      if (selected.length > 0) {
        contentElement = selected;
      }
    } else {
      // Try common content selectors
      const commonSelectors = [
        'main', 'article', '[role="main"]', '.content', '#content', '.post', '.entry-content'
      ];
      for (const selector of commonSelectors) {
        const selected = $(selector);
        if (selected.length > 0) {
          contentElement = selected;
          break;
        }
      }
    }

    // Extract text
    const text = contentElement.text()
      .replace(/\s+/g, ' ')
      .trim();

    // Extract links
    const links: string[] = [];
    $('a[href]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, url).toString();
          links.push(absoluteUrl);
        } catch {
          // Invalid URL, skip
        }
      }
    });

    // Extract images
    const images: string[] = [];
    $('img[src]').each((_, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        try {
          const absoluteUrl = new URL(src, url).toString();
          images.push(absoluteUrl);
        } catch {
          // Invalid URL, skip
        }
      }
    });

    // Extract metadata
    const metadata = {
      author: $('meta[name="author"]').attr('content'),
      date: $('meta[name="date"]').attr('content') || 
            $('time').first().attr('datetime'),
      description: $('meta[name="description"]').attr('content'),
      keywords: $('meta[name="keywords"]').attr('content')?.split(',').map(k => k.trim())
    };

    return {
      url,
      title: $('title').text() || $('h1').first().text() || 'Untitled',
      text,
      html: contentElement.html() || '',
      links: [...new Set(links)], // Remove duplicates
      images: [...new Set(images)],
      metadata,
      timestamp: new Date()
    };
  }

  /**
   * Check if a URL should be crawled
   */
  private shouldCrawl(url: string): boolean {
    // Already visited or in queue
    if (this.visited.has(url) || this.queue.has(url)) {
      return false;
    }

    try {
      const urlObj = new URL(url);
      
      // Check if same domain (or subdomain if allowed)
      if (this.options.includeSubdomains) {
        const baseDomain = this.baseUrl.hostname.split('.').slice(-2).join('.');
        const urlDomain = urlObj.hostname.split('.').slice(-2).join('.');
        if (baseDomain !== urlDomain) {
          return false;
        }
      } else {
        if (urlObj.hostname !== this.baseUrl.hostname) {
          return false;
        }
      }

      // Skip non-HTTP(S) protocols
      if (!urlObj.protocol.startsWith('http')) {
        return false;
      }

      // Skip common non-content extensions
      const skipExtensions = ['.pdf', '.zip', '.exe', '.dmg', '.pkg', '.deb'];
      if (skipExtensions.some(ext => urlObj.pathname.endsWith(ext))) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check robots.txt (optional)
   */
  private async checkRobotsTxt(): Promise<void> {
    try {
      const robotsUrl = `${this.baseUrl.protocol}//${this.baseUrl.hostname}/robots.txt`;
      const robotsTxt = await this.fetchPage(robotsUrl);
      
      // Basic robots.txt parsing (simplified)
      const lines = robotsTxt.split('\n');
      const disallowed: string[] = [];
      let isOurUserAgent = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('User-agent:')) {
          isOurUserAgent = trimmed.includes('*') || trimmed.includes('KnowledgeOS');
        } else if (isOurUserAgent && trimmed.startsWith('Disallow:')) {
          const path = trimmed.replace('Disallow:', '').trim();
          if (path) {
            disallowed.push(path);
          }
        }
      }

      // Remove disallowed URLs from queue
      this.queue = new Set(
        Array.from(this.queue).filter(url => {
          const urlPath = new URL(url).pathname;
          return !disallowed.some(path => urlPath.startsWith(path));
        })
      );
    } catch {
      // robots.txt not found or error - continue anyway
    }
  }
}