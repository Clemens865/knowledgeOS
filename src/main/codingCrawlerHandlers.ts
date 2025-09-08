/**
 * IPC handlers for Coding Crawler Mode - Standalone feature
 */

import { ipcMain } from 'electron';
import { CodingCrawlerService } from './services/CodingCrawlerService';
import Store from 'electron-store';
import * as path from 'path';
import { spawn } from 'child_process';

const store = new Store();
let crawlerService: CodingCrawlerService | null = null;
let pythonProcess: any = null;

export function setupCodingCrawlerHandlers() {
  console.log('🔧 Setting up Coding Crawler handlers...');

  // Initialize crawler service
  crawlerService = new CodingCrawlerService();

  // Start Python coding knowledge service
  ipcMain.handle('coding-crawler:start-python-service', async () => {
    if (pythonProcess) {
      return { success: true, message: 'Service already running' };
    }

    try {
      const workspacePath = (store as any).get('currentWorkspace') || process.cwd();
      const pythonPath = process.platform === 'darwin' ? 
        '/opt/homebrew/bin/python3' : 'python3';
      
      // Start the Python service
      pythonProcess = spawn(pythonPath, [
        path.join(__dirname, '..', '..', 'src', 'python', 'coding_knowledge_api.py')
      ], {
        env: {
          ...process.env,
          KNOWLEDGE_WORKSPACE: workspacePath,
          PYTHONUNBUFFERED: '1'
        }
      });

      pythonProcess.stdout?.on('data', (data: Buffer) => {
        console.log(`Coding Knowledge Service: ${data.toString()}`);
      });

      pythonProcess.stderr?.on('data', (data: Buffer) => {
        console.error(`Coding Knowledge Service Error: ${data.toString()}`);
      });

      pythonProcess.on('exit', (code: number) => {
        console.log(`Coding Knowledge Service exited with code ${code}`);
        pythonProcess = null;
      });

      return { success: true, message: 'Service started' };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // Start crawl
  ipcMain.handle('coding-crawler:start-crawl', async (event, options) => {
    try {
      if (!crawlerService) {
        throw new Error('Crawler service not initialized');
      }

      // Set up progress listener
      crawlerService.on('progress', (progress) => {
        event.sender.send('coding-crawler:progress', progress);
      });

      crawlerService.on('error', (error) => {
        event.sender.send('coding-crawler:error', error);
      });

      crawlerService.on('complete', (result) => {
        event.sender.send('coding-crawler:complete', result);
      });

      // Start the crawl
      const result = await crawlerService.crawl({
        ...options,
        outputPath: path.join(
          (store as any).get('currentWorkspace') || process.cwd(),
          '.knowledge'
        )
      });

      // Save results to Python database
      if (result.success && result.results.length > 0) {
        await saveToPythonDatabase(result.results);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // Stop crawl
  ipcMain.handle('coding-crawler:stop-crawl', async () => {
    if (crawlerService) {
      crawlerService.stop();
      return { success: true };
    }
    return { success: false, error: 'No active crawl' };
  });

  // Get available profiles
  ipcMain.handle('coding-crawler:get-profiles', async () => {
    if (crawlerService) {
      return crawlerService.getProfiles();
    }
    return [];
  });

  // Search code knowledge
  ipcMain.handle('coding-crawler:search', async (_, query, searchType = 'hybrid') => {
    try {
      const response = await fetch('http://localhost:8001/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, search_type: searchType })
      });
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        results: []
      };
    }
  });

  // Get API signature
  ipcMain.handle('coding-crawler:get-api-signature', async (_, className, methodName) => {
    try {
      const response = await fetch('http://localhost:8001/api-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: className, method_name: methodName })
      });
      
      if (!response.ok) {
        throw new Error(`API lookup failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // Get statistics
  ipcMain.handle('coding-crawler:get-stats', async () => {
    try {
      const response = await fetch('http://localhost:8001/statistics');
      
      if (!response.ok) {
        throw new Error(`Stats fetch failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        stats: {}
      };
    }
  });

  // Create project template with coding knowledge
  ipcMain.handle('coding-crawler:create-project-template', async (_, projectPath, options) => {
    try {
      const fs = require('fs').promises;
      
      // Create project structure
      const dirs = [
        '.knowledge',
        '.claude-flow',
        '.claude-flow/agents',
        '.claude-flow/workflows',
        'src',
        'tests',
        'docs',
        'examples'
      ];

      for (const dir of dirs) {
        await fs.mkdir(path.join(projectPath, dir), { recursive: true });
      }

      // Create CLAUDE.md with knowledge base instructions
      const claudeMd = generateClaudeMd(options);
      await fs.writeFile(
        path.join(projectPath, 'CLAUDE.md'),
        claudeMd
      );

      // Create claude-flow config
      const claudeFlowConfig = {
        version: '1.0.0',
        project: path.basename(projectPath),
        knowledge: {
          database: '.knowledge/code_knowledge.db',
          languages: options.languages || [],
          frameworks: options.frameworks || []
        },
        agents: {
          coder: { enabled: true },
          reviewer: { enabled: true },
          tester: { enabled: true }
        }
      };

      await fs.writeFile(
        path.join(projectPath, '.claude-flow', 'config.json'),
        JSON.stringify(claudeFlowConfig, null, 2)
      );

      return {
        success: true,
        projectPath
      };

    } catch (error) {
      return {
        success: false,
        error: (error as Error).message
      };
    }
  });

  // Stop Python service on cleanup
  ipcMain.on('coding-crawler:cleanup', () => {
    if (pythonProcess) {
      pythonProcess.kill();
      pythonProcess = null;
    }
  });
}

/**
 * Save crawl results to Python database
 */
async function saveToPythonDatabase(results: any[]): Promise<void> {
  try {
    const response = await fetch('http://localhost:8001/save-crawl', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results })
    });

    if (!response.ok) {
      throw new Error(`Failed to save to database: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Saved to database:', result.stats);
  } catch (error) {
    console.error('Error saving to database:', error);
  }
}

/**
 * Generate CLAUDE.md content for project
 */
function generateClaudeMd(options: any): string {
  return `# Coding Knowledge Base Configuration

## Project Setup
This project has an integrated coding knowledge base with documentation for:
${options.languages?.map((lang: string) => `- ${lang}`).join('\n') || '- [No languages specified]'}
${options.frameworks?.map((fw: string) => `- ${fw}`).join('\n') || ''}

## Knowledge Base Location
Database: \`.knowledge/code_knowledge.db\`

## For AI Assistants (Claude, GPT, etc.)

### IMPORTANT: Always Check Knowledge Base First!

Before implementing any code:
1. Query the local knowledge base for API signatures
2. Search for similar code examples
3. Check best practices for the language/framework
4. Look for common patterns and idioms

### Database Queries

\`\`\`sql
-- Find API documentation
SELECT * FROM api_references 
WHERE method_name = 'your_method' 
LIMIT 5;

-- Search code examples
SELECT * FROM code_examples 
WHERE language = 'rust' 
AND code LIKE '%async%' 
LIMIT 10;

-- Get best practices
SELECT * FROM coding_concepts 
WHERE category = 'best_practice' 
AND language = 'python';

-- Find error solutions
SELECT * FROM search_index 
WHERE searchable_text LIKE '%error_message%';
\`\`\`

### Available Tables

1. **code_docs** - Documentation pages
2. **code_examples** - Code snippets with context
3. **api_references** - API signatures and parameters
4. **coding_concepts** - Patterns and best practices
5. **search_index** - Full-text search index

### Search Functions

Use these endpoints for advanced search:
- \`/search\` - Hybrid search (keyword + semantic)
- \`/api-signature\` - Get exact API signatures
- \`/error-search\` - Find solutions for errors
- \`/patterns\` - Get language patterns

## Workflow

1. **Before coding**: Query knowledge base
2. **During coding**: Reference exact signatures
3. **When stuck**: Search for examples
4. **For errors**: Query error solutions

## Important Notes

- This is LOCAL documentation - no internet needed
- Always prefer knowledge base over guessing
- Use exact signatures from api_references table
- Check examples for implementation patterns

---
Generated by KnowledgeOS Coding Crawler
`;
}