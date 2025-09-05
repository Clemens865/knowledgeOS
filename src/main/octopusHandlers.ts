import { ipcMain } from 'electron';
import { WebCrawler, CrawlOptions } from './services/WebCrawler';
import { IntelligentWebCrawler } from './services/IntelligentWebCrawler';
import { crawlSessionManager } from './services/CrawlSession';
import { getLLMService } from './llmHandlers';
import * as fs from 'fs/promises';
import * as path from 'path';
import Store from 'electron-store';

const store = new Store();

let intelligentCrawler: IntelligentWebCrawler | null = null;
let crawlInProgress = false;

export function setupOctopusHandlers() {
  // We'll initialize the intelligent crawler dynamically when needed

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

      // Get the current LLM service dynamically
      const currentLLMService = getLLMService();

      // Use intelligent crawler if instruction is provided and LLM is available
      if (instruction && currentLLMService) {
        console.log('Starting intelligent crawl with instruction:', instruction);
        
        // Create or update the intelligent crawler with the current LLM service
        if (!intelligentCrawler) {
          intelligentCrawler = new IntelligentWebCrawler();
        }
        intelligentCrawler.setLLMService(currentLLMService);
        
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

      // Create a crawl session
      const sessionId = crawlSessionManager.createSession(url, result.pages);

      // Set LLM service in session manager
      const llmService = getLLMService();
      if (llmService) {
        crawlSessionManager.setLLMService(llmService);
      }

      // If we have processed content from intelligent crawl, add it to the session
      if ((result as any).processedContent) {
        const processedVersion = {
          id: 'initial',
          timestamp: new Date(),
          instruction: instruction || '',
          content: (result as any).processedContent.content,
          metadata: {
            processingTime: (result as any).processedContent.metadata?.processingTime || 0,
            llmModel: 'claude-3-sonnet'
          }
        };
        
        const session = crawlSessionManager.getSession(sessionId);
        if (session) {
          session.processedContent = [processedVersion];
          session.currentVersion = 'initial';
        }
      }

      // Send completion
      event.sender.send('octopus:crawl-progress', {
        status: 'complete',
        pagesProcessed: result.totalPages,
        totalPages: result.totalPages,
        message: 'Crawl complete!',
        sessionId // Include session ID for future operations
      });

      return {
        success: true,
        sessionId,
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

  // Save to knowledge base handler is defined later in the file

  // Check if Octopus Mode is available
  ipcMain.handle('octopus:check-availability', async () => {
    const currentLLMService = getLLMService();
    const hasLLM = currentLLMService !== null;
    
    return {
      available: true,
      hasLLM: hasLLM,
      features: {
        basicCrawl: true,
        intelligentCrawl: hasLLM,
        multiPage: true,
        instructionSupport: hasLLM,
        interactiveRefinement: hasLLM,
        multiStepWorkflow: true
      }
    };
  });

  // Process content with instruction (post-crawl)
  ipcMain.handle('octopus:process-instruction', async (_, args: {
    sessionId: string;
    instruction: string;
  }) => {
    try {
      const { sessionId, instruction } = args;
      
      const processedVersion = await crawlSessionManager.processWithInstruction(
        sessionId,
        instruction
      );
      
      if (processedVersion) {
        return {
          success: true,
          content: processedVersion.content,
          versionId: processedVersion.id
        };
      } else {
        return {
          success: false,
          error: 'Failed to process content. Check LLM service and API credits.'
        };
      }
    } catch (error) {
      console.error('Process error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Refine content through chat
  ipcMain.handle('octopus:refine-content', async (_, args: {
    sessionId: string;
    message: string;
  }) => {
    try {
      const { sessionId, message } = args;
      
      const refinedContent = await crawlSessionManager.refineContent(
        sessionId,
        message
      );
      
      if (refinedContent) {
        return {
          success: true,
          content: refinedContent
        };
      } else {
        return {
          success: false,
          error: 'Failed to refine content'
        };
      }
    } catch (error) {
      console.error('Refine error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Get current session state
  ipcMain.handle('octopus:get-session', async (_, sessionId: string) => {
    try {
      const session = crawlSessionManager.getSession(sessionId);
      
      if (session) {
        const currentContent = crawlSessionManager.getCurrentContent(session);
        
        return {
          success: true,
          session: {
            id: session.id,
            url: session.url,
            timestamp: session.timestamp,
            currentVersion: session.currentVersion,
            hasProcessedContent: (session.processedContent?.length || 0) > 0,
            refinementCount: session.refinementHistory.length / 2, // user+assistant pairs
            metadata: session.metadata
          },
          currentContent,
          versions: session.processedContent?.map(v => ({
            id: v.id,
            instruction: v.instruction,
            timestamp: v.timestamp
          }))
        };
      } else {
        return {
          success: false,
          error: 'Session not found'
        };
      }
    } catch (error) {
      console.error('Get session error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Export content in various formats
  ipcMain.handle('octopus:export-content', async (_, args: {
    sessionId: string;
    format: 'markdown' | 'json' | 'knowledge';
  }) => {
    try {
      const { sessionId, format } = args;
      
      const exported = crawlSessionManager.exportContent(sessionId, format);
      
      if (exported) {
        return {
          success: true,
          data: exported
        };
      } else {
        return {
          success: false,
          error: 'Failed to export content'
        };
      }
    } catch (error) {
      console.error('Export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Save to knowledge base (enhanced version)
  ipcMain.handle('octopus:save-to-knowledge', async (_, args: {
    sessionId?: string;
    content?: string;
    fileName: string;
    metadata: any;
  }) => {
    try {
      let contentToSave = args.content;
      
      // If sessionId is provided, get content from session
      if (args.sessionId) {
        const exported = crawlSessionManager.exportContent(args.sessionId, 'knowledge');
        if (exported) {
          contentToSave = exported.content;
          // Use suggested path if no fileName provided
          if (!args.fileName && exported.suggestedPath) {
            args.fileName = exported.suggestedPath;
          }
        }
      }
      
      if (!contentToSave) {
        return {
          success: false,
          error: 'No content to save'
        };
      }
      
      // Add metadata header if metadata is provided
      if (args.metadata) {
        const metadataHeader = `---
source: ${args.metadata.source || 'unknown'}
instruction: ${args.metadata.instruction || 'No instruction provided'}
crawledAt: ${args.metadata.crawledAt || new Date().toISOString()}
pagesProcessed: ${args.metadata.pagesProcessed || 'unknown'}
sessionId: ${args.metadata.sessionId || 'unknown'}
exportedAt: ${args.metadata.exportedAt || new Date().toISOString()}
type: web-crawl
---

`;
        contentToSave = metadataHeader + contentToSave;
      }
      
      const workspacePath = (store as any).get('currentWorkspace') || process.cwd();
      const filePath = path.join(workspacePath, args.fileName);

      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      await fs.mkdir(dir, { recursive: true });

      // Save file
      await fs.writeFile(filePath, contentToSave, 'utf-8');

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

  console.log('Octopus Mode handlers initialized with session management');
}