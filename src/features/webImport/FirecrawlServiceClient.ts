// Client-side service that communicates with main process via IPC

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

class FirecrawlServiceClient {
  private apiKey: string | null = null;

  constructor() {
    this.initializeFirecrawl();
  }

  private async initializeFirecrawl() {
    // Try to get API key from electron store
    if (window.electronAPI?.getSetting) {
      this.apiKey = await window.electronAPI.getSetting('firecrawlApiKey');
      if (this.apiKey) {
        await this.setApiKey(this.apiKey);
      }
    }
  }

  public async setApiKey(apiKey: string) {
    this.apiKey = apiKey;
    
    // Send API key to main process
    if (window.electronAPI) {
      const result = await (window.electronAPI as any).invoke('firecrawl:setApiKey', apiKey);
      if (result.success) {
        // Save to electron store
        if (window.electronAPI.setSetting) {
          await window.electronAPI.setSetting('firecrawlApiKey', apiKey);
        }
      }
      return result;
    }
    return { success: false, error: 'Electron API not available' };
  }

  public async hasApiKey(): Promise<boolean> {
    if (window.electronAPI) {
      return await (window.electronAPI as any).invoke('firecrawl:hasApiKey');
    }
    return false;
  }

  /**
   * Scrape a single webpage
   */
  public async scrapePage(url: string): Promise<WebContent> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    const result = await (window.electronAPI as any).invoke('firecrawl:scrapePage', url);
    
    if (!result.success) {
      throw new Error(result.error || `Failed to scrape ${url}`);
    }
    
    return result.data;
  }

  /**
   * Crawl an entire website
   */
  public async crawlWebsite(options: WebImportOptions): Promise<WebContent[]> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    const result = await (window.electronAPI as any).invoke('firecrawl:crawlWebsite', {
      url: options.url,
      maxPages: options.maxPages,
      includeSubdomains: options.includeSubdomains,
    });
    
    if (!result.success) {
      throw new Error(result.error || `Failed to crawl ${options.url}`);
    }
    
    return result.data;
  }

  /**
   * Save content as a note file
   */
  public async saveAsNote(content: WebContent, workspacePath: string): Promise<string> {
    if (!window.electronAPI) {
      throw new Error('Electron API not available');
    }

    const result = await (window.electronAPI as any).invoke('firecrawl:saveAsNote', content, workspacePath);
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to save note');
    }
    
    return result.filePath;
  }

  /**
   * Convert web content to a note format (client-side for preview)
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
}

export default new FirecrawlServiceClient();