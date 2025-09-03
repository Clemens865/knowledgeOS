import { ipcMain } from 'electron';
import { WebCrawler, CrawlOptions } from './services/WebCrawler';
import { IntelligentWebCrawler } from './services/IntelligentWebCrawler';
import { LLMService } from '../core/LLMService';
import * as fs from 'fs/promises';
import * as path from 'path';
import Store from 'electron-store';

const store = new Store();

let intelligentCrawler: IntelligentWebCrawler | null = null;
let crawlInProgress = false;

export function setupOctopusHandlers(llmService: LLMService | null) {
  // Initialize intelligent crawler if LLM service is available
  if (llmService) {
    intelligentCrawler = new IntelligentWebCrawler();
    intelligentCrawler.setLLMService(llmService);
  }

  // Start crawl handler
  ipcMain.handle('octopus:start-crawl', async (event, args: {
    url: string;
    instruction?: string;
    options?: Partial<CrawlOptions>;
  }) => {
    if (crawlInProgress) {
      return {
        success: false,
        error: 'Another crawl is already in progress'
      };
    }

    crawlInProgress = true;

    try {
      const { url, instruction, options = {} } = args;

      // Send initial progress
      event.sender.send('octopus:crawl-progress', {
        status: 'starting',
        currentUrl: url,
        pagesProcessed: 0,
        totalPages: options.maxPages || 1,
        message: 'Initializing crawler...'
      });

      let result;

      // Use intelligent crawler if instruction is provided and LLM is available
      if (instruction && intelligentCrawler) {
        console.log('Starting intelligent crawl with instruction:', instruction);
        
        // Send progress update
        event.sender.send('octopus:crawl-progress', {
          status: 'analyzing',
          message: 'Analyzing instruction...'
        });

        result = await intelligentCrawler.crawlWithInstruction(url, instruction);

        // Send processing progress
        if (result.processedContent) {
          event.sender.send('octopus:crawl-progress', {
            status: 'processing',
            pagesProcessed: result.totalPages,
            totalPages: result.totalPages,
            message: 'Processing content based on instruction...'
          });
        }
      } else {
        // Use basic crawler
        console.log('Starting basic crawl for:', url);
        
        const crawlOptions: CrawlOptions = {
          url,
          depth: options.depth || 0,
          maxPages: options.maxPages || 1,
          includeSubdomains: options.includeSubdomains || false,
          respectRobotsTxt: options.respectRobotsTxt !== false,
          selectors: options.selectors
        };

        const crawler = new WebCrawler(crawlOptions);
        
        // Simple progress tracking for basic crawler
        let progressInterval = setInterval(() => {
          event.sender.send('octopus:crawl-progress', {
            status: 'crawling',
            message: 'Crawling pages...'
          });
        }, 1000);

        result = await crawler.crawl();
        clearInterval(progressInterval);
      }

      // Send completion
      event.sender.send('octopus:crawl-progress', {
        status: 'complete',
        pagesProcessed: result.totalPages,
        totalPages: result.totalPages,
        message: 'Crawl complete!'
      });

      return {
        success: true,
        pages: result.pages,
        totalPages: result.totalPages,
        errors: result.errors,
        processedContent: (result as any).processedContent,
        instruction: (result as any).instruction
      };
    } catch (error) {
      console.error('Crawl error:', error);
      
      event.sender.send('octopus:crawl-progress', {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      crawlInProgress = false;
    }
  });

  // Save to knowledge base handler
  ipcMain.handle('octopus:save-to-knowledge', async (_, args: {
    content: string;
    fileName: string;
    metadata: any;
  }) => {
    try {
      const { content, fileName, metadata } = args;
      
      // Get workspace path from store
      const workspacePath = (store as any).get('currentWorkspace') || process.cwd();
      const filePath = path.join(workspacePath, fileName);

      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Add metadata header to content
      const fullContent = `---
source: ${metadata.source}
instruction: ${metadata.instruction}
crawledAt: ${metadata.crawledAt}
pagesProcessed: ${metadata.pagesProcessed}
type: web-crawl
---

${content}`;

      // Save file
      await fs.writeFile(filePath, fullContent, 'utf-8');

      return {
        success: true,
        filePath
      };
    } catch (error) {
      console.error('Save error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Check if Octopus Mode is available
  ipcMain.handle('octopus:check-availability', async () => {
    return {
      available: true,
      hasLLM: intelligentCrawler !== null,
      features: {
        basicCrawl: true,
        intelligentCrawl: intelligentCrawler !== null,
        multiPage: true,
        instructionSupport: intelligentCrawler !== null
      }
    };
  });

  console.log('Octopus Mode handlers initialized');
}