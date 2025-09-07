import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { extract } from '@extractus/article-extractor';
import { net } from 'electron';
import { URL } from 'url';
import { promises as fs } from 'fs';
import * as path from 'path';

interface WebContent {
  url: string;
  title: string;
  content: string;
  markdown?: string;
  metadata?: {
    description?: string;
    author?: string;
    publishedDate?: string;
    tags?: string[];
    image?: string;
  };
}

interface CrawlOptions {
  url: string;
  maxPages?: number;
  includeSubdomains?: boolean;
  depth?: number;
}

class WebScraperService {
  private turndown: TurndownService;
  private visitedUrls: Set<string> = new Set();
  
  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    });
    
    // Configure turndown to handle common elements better
    this.turndown.addRule('strikethrough', {
      filter: ['del', 's'],
      replacement: (content: string) => `~~${content}~~`
    });
    
    // Remove script and style tags
    this.turndown.remove(['script', 'style', 'nav', 'header', 'footer']);
  }
  
  /**
   * Scrape a single webpage
   */
  async scrapePage(url: string): Promise<WebContent> {
    try {
      // First try to extract article content
      const article = await extract(url).catch(() => null);
      
      if (article && article.content) {
        // Use article extractor for clean content
        const $ = cheerio.load(article.content || '');
        const markdown = this.turndown.turndown(article.content || '');
        
        return {
          url,
          title: article.title || 'Untitled',
          content: $('body').text(),
          markdown,
          metadata: {
            description: article.description,
            author: article.author,
            publishedDate: article.published,
            image: article.image,
            tags: this.extractKeywords($('body').text()),
          }
        };
      }
      
      // Fallback to basic HTML scraping
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);
      
      // Remove unwanted elements
      $('script, style, nav, header, footer, .sidebar, .menu, .advertisement').remove();
      
      // Extract metadata
      const title = $('title').text() || 
                   $('h1').first().text() || 
                   $('meta[property="og:title"]').attr('content') || 
                   'Untitled';
                   
      const description = $('meta[name="description"]').attr('content') || 
                         $('meta[property="og:description"]').attr('content') || 
                         '';
                         
      const author = $('meta[name="author"]').attr('content') || 
                    $('meta[property="article:author"]').attr('content') || 
                    '';
                    
      const publishedDate = $('meta[property="article:published_time"]').attr('content') || 
                           $('time').first().attr('datetime') || 
                           '';
      
      // Get main content
      let mainContent = $('main').html() || 
                       $('article').html() || 
                       $('.content').html() || 
                       $('#content').html() || 
                       $('body').html() || 
                       '';
      
      // Convert to markdown
      const markdown = this.turndown.turndown(mainContent);
      
      // Extract keywords from content
      const textContent = $('body').text();
      const keywords = this.extractKeywords(textContent);
      
      return {
        url,
        title,
        content: textContent,
        markdown,
        metadata: {
          description,
          author,
          publishedDate,
          tags: keywords,
        }
      };
    } catch (error: any) {
      console.error(`Error scraping ${url}:`, error);
      throw new Error(`Failed to scrape ${url}: ${error.message}`);
    }
  }
  
  /**
   * Crawl a website
   */
  async crawlWebsite(options: CrawlOptions): Promise<WebContent[]> {
    const { url, maxPages = 10, includeSubdomains = false, depth = 2 } = options;
    const results: WebContent[] = [];
    const baseUrl = new URL(url);
    const queue: { url: string; depth: number }[] = [{ url, depth: 0 }];
    
    this.visitedUrls.clear();
    
    while (queue.length > 0 && results.length < maxPages) {
      const current = queue.shift();
      if (!current) break;
      
      // Skip if already visited
      if (this.visitedUrls.has(current.url)) continue;
      this.visitedUrls.add(current.url);
      
      try {
        // Scrape the page
        const content = await this.scrapePage(current.url);
        results.push(content);
        
        // Extract links if we haven't reached max depth
        if (current.depth < depth) {
          const links = await this.extractLinks(current.url);
          
          for (const link of links) {
            const linkUrl = new URL(link, current.url);
            
            // Check if we should include this link
            if (this.shouldCrawlUrl(linkUrl, baseUrl, includeSubdomains)) {
              queue.push({ url: linkUrl.href, depth: current.depth + 1 });
            }
          }
        }
      } catch (error) {
        console.error(`Error crawling ${current.url}:`, error);
      }
      
      // Add a small delay to be respectful
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return results;
  }
  
  /**
   * Fetch a webpage using Electron's net module
   */
  private fetchPage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request({
        url,
        method: 'GET',
      });
      
      request.setHeader('User-Agent', 'Mozilla/5.0 (compatible; KnowledgeOS/1.0)');
      
      let data = '';
      
      request.on('response', (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
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
      
      request.end();
    });
  }
  
  /**
   * Extract links from a webpage
   */
  private async extractLinks(url: string): Promise<string[]> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);
      const links: string[] = [];
      
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        if (href && !href.startsWith('#') && !href.startsWith('mailto:')) {
          links.push(href);
        }
      });
      
      return links;
    } catch (error) {
      console.error(`Error extracting links from ${url}:`, error);
      return [];
    }
  }
  
  /**
   * Check if a URL should be crawled
   */
  private shouldCrawlUrl(url: URL, baseUrl: URL, includeSubdomains: boolean): boolean {
    // Skip non-HTTP protocols
    if (!url.protocol.startsWith('http')) return false;
    
    // Skip already visited
    if (this.visitedUrls.has(url.href)) return false;
    
    // Check domain rules
    if (includeSubdomains) {
      // Include subdomains - check if it ends with the base domain
      const baseDomain = baseUrl.hostname.replace(/^www\./, '');
      const urlDomain = url.hostname.replace(/^www\./, '');
      return urlDomain.endsWith(baseDomain);
    } else {
      // Same domain only
      return url.hostname === baseUrl.hostname;
    }
  }
  
  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    // Simple keyword extraction - can be improved with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);
    
    // Count word frequency
    const frequency: Map<string, number> = new Map();
    for (const word of words) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
    
    // Get top keywords
    const sorted = Array.from(frequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
    
    return sorted;
  }
  
  /**
   * Save content as a note file
   */
  async saveAsNote(content: WebContent, workspacePath: string): Promise<string> {
    const noteContent = this.convertToNote(content);
    
    // Generate filename from title
    const filename = content.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    const date = new Date().toISOString().split('T')[0];
    const importedDir = path.join(workspacePath, 'imported');
    const filePath = path.join(importedDir, `${date}-${filename}.md`);
    
    // Create imported directory if it doesn't exist
    await fs.mkdir(importedDir, { recursive: true });
    
    // Check if file exists and add number if needed
    let finalPath = filePath;
    let counter = 1;
    while (await fs.access(finalPath).then(() => true).catch(() => false)) {
      finalPath = filePath.replace('.md', `-${counter}.md`);
      counter++;
    }
    
    await fs.writeFile(finalPath, noteContent, 'utf-8');
    
    return finalPath;
  }
  
  /**
   * Convert web content to note format
   */
  private convertToNote(content: WebContent): string {
    const date = new Date().toISOString().split('T')[0];
    const tags = content.metadata?.tags?.map(tag => `#${tag}`).join(' ') || '';
    
    return `---
title: ${content.title}
source: ${content.url}
date_imported: ${date}
author: ${content.metadata?.author || 'Unknown'}
tags: ${tags}
---

# ${content.title}

> **Source**: [${content.url}](${content.url})
> **Imported**: ${date}
${content.metadata?.description ? `> **Description**: ${content.metadata.description}` : ''}

---

${content.markdown || content.content}

---

*This note was imported from the web by KnowledgeOS.*
`;
  }
}

export default new WebScraperService();