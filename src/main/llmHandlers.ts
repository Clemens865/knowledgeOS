import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMService, LLMProvider, FileOperation } from '../core/LLMService';
import Store from 'electron-store';

const store = new Store();

let llmService: LLMService | null = null;

export function setupLLMHandlers() {
  // Initialize LLM service
  ipcMain.handle('llm:initialize', async (_, provider: LLMProvider, workspacePath: string) => {
    try {
      llmService = new LLMService(provider, workspacePath);
      
      // Load and set the saved system prompt if available
      const savedPrompt = (store as any).get('systemPrompt');
      if (savedPrompt) {
        llmService.setSystemPrompt(savedPrompt);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error initializing LLM:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Send message to LLM
  ipcMain.handle('llm:sendMessage', async (_, message: string, history: any[]) => {
    if (!llmService) {
      return { success: false, error: 'LLM service not initialized' };
    }

    try {
      // Get list of files in workspace for context
      const workspacePath = (store as any).get('currentWorkspace') as string;
      let availableFiles: string[] = [];
      
      if (workspacePath) {
        availableFiles = await getWorkspaceFiles(workspacePath);
      }

      // Send message to LLM
      const response = await llmService.sendMessage(message, history, availableFiles);

      // Execute file operations if any
      if (response.fileOperations && response.fileOperations.length > 0) {
        for (const operation of response.fileOperations) {
          await executeFileOperation(operation, workspacePath);
        }
      }

      return { 
        success: true, 
        response: response.content,
        usage: response.usage,
        fileOperations: response.fileOperations
      };
    } catch (error) {
      console.error('Error sending message to LLM:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Update system prompt
  ipcMain.handle('llm:setSystemPrompt', async (_, prompt: string) => {
    if (!llmService) {
      return { success: false, error: 'LLM service not initialized' };
    }

    try {
      llmService.setSystemPrompt(prompt);
      // Save to store for persistence
      (store as any).set('systemPrompt', prompt);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get saved system prompt
  ipcMain.handle('llm:getSystemPrompt', async () => {
    return (store as any).get('systemPrompt', null);
  });

  // Save API keys securely
  ipcMain.handle('llm:saveApiKey', async (_, provider: string, apiKey: string) => {
    try {
      // In production, use keytar or similar for secure storage
      (store as any).set(`apiKey_${provider}`, apiKey);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get API key
  ipcMain.handle('llm:getApiKey', async (_, provider: string) => {
    return (store as any).get(`apiKey_${provider}`, '');
  });

  // List available providers
  ipcMain.handle('llm:getProviders', async () => {
    return [
      { 
        name: 'Claude', 
        models: [
          'claude-3-opus-20240229',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ]
      },
      { 
        name: 'OpenAI', 
        models: [
          'gpt-4-turbo-preview',
          'gpt-4',
          'gpt-3.5-turbo'
        ]
      },
      { 
        name: 'Gemini', 
        models: [
          'gemini-pro',
          'gemini-pro-vision'
        ]
      }
    ];
  });

  // Execute file operations from LLM
  ipcMain.handle('llm:executeFileOperation', async (_, operation: FileOperation, workspacePath: string) => {
    try {
      await executeFileOperation(operation, workspacePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

async function executeFileOperation(operation: FileOperation, workspacePath: string): Promise<void> {
  const fullPath = path.join(workspacePath, operation.path);

  switch (operation.type) {
    case 'read':
      // This would typically be handled before sending to LLM
      // But included for completeness
      await fs.readFile(fullPath, 'utf-8');
      break;

    case 'write':
      if (!operation.content) {
        throw new Error('Content required for write operation');
      }
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, operation.content);
      console.log(`File written: ${operation.path}`);
      break;

    case 'create_folder':
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`Folder created: ${operation.path}`);
      break;

    case 'list':
      // This would typically be handled before sending to LLM
      await fs.readdir(fullPath);
      break;

    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

async function getWorkspaceFiles(workspacePath: string, relativePath: string = ''): Promise<string[]> {
  const files: string[] = [];
  const currentPath = path.join(workspacePath, relativePath);

  try {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(relativePath, entry.name);
      
      // Skip hidden files and common ignore patterns
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        // Recursively get files from subdirectories (limit depth to avoid too many files)
        if (relativePath.split('/').length < 3) {
          const subFiles = await getWorkspaceFiles(workspacePath, entryPath);
          files.push(...subFiles);
        }
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
        files.push(entryPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${currentPath}:`, error);
  }

  return files;
}

// Function to read file content for LLM context
export async function readFileForContext(workspacePath: string, filePath: string): Promise<string> {
  try {
    const fullPath = path.join(workspacePath, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return '';
  }
}