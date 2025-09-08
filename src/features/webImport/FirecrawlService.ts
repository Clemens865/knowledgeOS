// Firecrawl is optional - will be loaded if available
let FirecrawlApp: any;
try {
  FirecrawlApp = require('@mendable/firecrawl-js').default;
} catch (e) {
  console.log('Firecrawl not installed - web import features disabled');
}

export interface WebImportOptions {
  url: string;
  depth?: number;
  includeSubdomains?: boolean;
  maxPages?: number;
  format?: 'markdown' | 'html' | 'text';
}

export interface WebContent {
  url: string;
  title: string;
  content: string;
  markdown?: string;
  metadata?: {
    description?: string;
    author?: string;
    publishedDate?: string;
    tags?: string[];
  };
}

class FirecrawlService {
  private firecrawl: any | null = null;
  private apiKey: string | null = null;

  constructor() {
    // API key will be set from settings
    this.initializeFirecrawl();
  }

  private async initializeFirecrawl() {
    // Try to get API key from electron store
    if (window.electronAPI?.getSetting) {
      this.apiKey = await window.electronAPI.getSetting('firecrawlApiKey');
      if (this.apiKey) {
        this.firecrawl = new FirecrawlApp({ apiKey: this.apiKey });
      }
    }
  }

  public setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    this.firecrawl = new FirecrawlApp({ apiKey });
    // Save to electron store
    if (window.electronAPI?.setSetting) {
      window.electronAPI.setSetting('firecrawlApiKey', apiKey);
    }
  }

  public hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Scrape a single webpage
   */
  public async scrapePage(url: string): Promise<WebContent> {
    if (!this.firecrawl) {
      throw new Error('Firecrawl not initialized. Please set API key.');
    }

    try {
      const response = await this.firecrawl.scrape(url, {
        formats: ['markdown', 'html'],
        waitFor: 2000, // Wait for dynamic content
      });

      if (!response.success) {
        throw new Error(`Failed to scrape ${url}: ${response.error}`);
      }

      return {
        url,
        title: response.metadata?.title || 'Untitled',
        content: response.markdown || response.text || '',
        markdown: response.markdown,
        metadata: {
          description: response.metadata?.description,
          author: response.metadata?.author,
          publishedDate: response.metadata?.publishedDate,
          tags: response.metadata?.keywords,
        },
      };
    } catch (error) {
      console.error('Error scraping page:', error);
      throw error;
    }
  }

  /**
   * Crawl an entire website
   */
  public async crawlWebsite(options: WebImportOptions): Promise<WebContent[]> {
    if (!this.firecrawl) {
      throw new Error('Firecrawl not initialized. Please set API key.');
    }

    try {
      const crawlResult = await this.firecrawl.crawlUrl(options.url, {
        limit: options.maxPages || 10,
        scrapeOptions: {
          formats: ['markdown'],
        },
      });

      if (!crawlResult.success) {
        throw new Error(`Failed to crawl ${options.url}: ${crawlResult.error}`);
      }

      const contents: WebContent[] = [];
      
      // Wait for crawl to complete
      let crawlStatus = await this.firecrawl.checkCrawlStatus(crawlResult.id);
      
      while (crawlStatus.status === 'crawling') {
        await new Promise(resolve => setTimeout(resolve, 2000));
        crawlStatus = await this.firecrawl.checkCrawlStatus(crawlResult.id);
      }

      if (crawlStatus.status === 'completed' && crawlStatus.data) {
        for (const page of crawlStatus.data) {
          contents.push({
            url: page.url,
            title: page.metadata?.title || 'Untitled',
            content: page.markdown || '',
            markdown: page.markdown,
            metadata: {
              description: page.metadata?.description,
              author: page.metadata?.author,
              publishedDate: page.metadata?.publishedDate,
              tags: page.metadata?.keywords,
            },
          });
        }
      }

      return contents;
    } catch (error) {
      console.error('Error crawling website:', error);
      throw error;
    }
  }

  /**
   * Convert web content to a note format
   */
  public convertToNote(content: WebContent): string {
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

*This note was automatically imported from the web using Firecrawl.*
`;
  }

  /**
   * Save content as a note file
   */
  public async saveAsNote(content: WebContent, workspacePath: string): Promise<string> {
    const noteContent = this.convertToNote(content);
    
    // Generate filename from title
    const filename = content.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    const date = new Date().toISOString().split('T')[0];
    const filePath = `${workspacePath}/imported/${date}-${filename}.md`;
    
    // Create imported directory if it doesn't exist
    if (window.electronAPI?.writeFile) {
      await window.electronAPI?.ensureDir?.(`${workspacePath}/imported`);
      await window.electronAPI.writeFile(filePath, noteContent);
    }
    
    return filePath;
  }
}

export default new FirecrawlService();