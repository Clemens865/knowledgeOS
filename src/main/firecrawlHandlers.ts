import { ipcMain } from 'electron';
import WebScraperService from './services/WebScraperService';

export function setupFirecrawlHandlers() {
  // No longer need API key - using local scraper
  ipcMain.handle('firecrawl:setApiKey', async (_event, _apiKey: string) => {
    // Keep for compatibility but not needed
    return { success: true };
  });

  // Always return true since we don't need API key
  ipcMain.handle('firecrawl:hasApiKey', async (_event) => {
    return true;
  });

  // Scrape a single page
  ipcMain.handle('firecrawl:scrapePage', async (_event, url: string) => {
    try {
      const content = await WebScraperService.scrapePage(url);
      return { success: true, data: content };
    } catch (error: any) {
      console.error('Error scraping page:', error);
      return { success: false, error: error.message };
    }
  });

  // Crawl a website
  ipcMain.handle('firecrawl:crawlWebsite', async (_event, options: {
    url: string;
    maxPages?: number;
    includeSubdomains?: boolean;
  }) => {
    try {
      const contents = await WebScraperService.crawlWebsite(options);
      return { success: true, data: contents };
    } catch (error: any) {
      console.error('Error crawling website:', error);
      return { success: false, error: error.message };
    }
  });

  // Save content as note
  ipcMain.handle('firecrawl:saveAsNote', async (_event, content: any, workspacePath: string) => {
    try {
      const filePath = await WebScraperService.saveAsNote(content, workspacePath);
      return { success: true, filePath };
    } catch (error: any) {
      console.error('Error saving note:', error);
      return { success: false, error: error.message };
    }
  });
}