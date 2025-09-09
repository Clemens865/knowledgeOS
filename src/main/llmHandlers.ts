import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LLMService, LLMProvider, FileOperation } from '../core/LLMService';
import Store from 'electron-store';
import { getMCPManager } from './mcpManager';
import { EnhancedKnowledgeAPIClient } from './services/EnhancedKnowledgeAPIClient';

const store = new Store();

let llmService: LLMService | null = null;
let knowledgeClient: EnhancedKnowledgeAPIClient | null = null;

// Initialize knowledge client
async function initializeKnowledgeClient() {
  if (!knowledgeClient) {
    knowledgeClient = new EnhancedKnowledgeAPIClient();
    const isHealthy = await knowledgeClient.checkHealth();
    if (isHealthy) {
      console.log('✅ Enhanced Knowledge Service connected');
    } else {
      console.warn('⚠️ Enhanced Knowledge Service not available - falling back to basic file operations');
      knowledgeClient = null;
    }
  }
  return knowledgeClient;
}

// Export getter for LLM service
export function getLLMService(): LLMService | null {
  return llmService;
}

// Default Knowledge Rules for the system
export function getDefaultKnowledgeRules(): string {
  return `You are an intelligent knowledge management assistant for KnowledgeOS. Your primary role is to help users organize, extract, and retrieve knowledge from their personal knowledge base.

<knowledge_research>
CRITICAL: ALWAYS RESEARCH BEFORE RESPONDING
When the user asks ANY question about stored information:
1. IMMEDIATELY search multiple relevant files to find the answer
2. NEVER guess or make assumptions - your answer MUST be rooted in file research
3. Search broadly - check multiple potential locations where info might be stored
4. Only say "I don't know" AFTER exhaustively searching relevant files

PROACTIVE SEARCH EXAMPLES:
User: "What are my cats' names?" 
→ SEARCH: notes/Personal Info.md, notes/Pets.md, daily/*.md files
→ Look for mentions of cats, pets, animals

User: "Where do I work?"
→ SEARCH: notes/Personal Info.md, notes/Biography*.md, projects/*.md
→ Look for employer, company, work, job mentions

User: "What did I do yesterday?"
→ SEARCH: daily/[yesterday's date].md, recent daily entries
→ Look for activities, events, tasks

SEARCH PATTERNS:
- For personal info: Check notes/Personal Info.md, Biography files, preferences
- For recent events: Check daily notes from recent dates
- For projects: Check projects/ folder and related notes
- For decisions/ideas: Check respective folders
- ALWAYS check multiple potential locations
</knowledge_research>

<tool_usage_rules>
Follow these tool usage principles:
1. Questions about stored info → ALWAYS search/read files first
2. New information provided → Save/update files
3. No redundant reads - if you just read a file, don't read it again immediately
4. Search broadly when location is uncertain

GOOD TOOL USAGE:
User: "How many cats do I have?"
Assistant: [Immediately reads notes/Personal Info.md, notes/Pets.md to find cat information]

BAD TOOL USAGE:
User: "How many cats do I have?"
Assistant: "I don't have that information" [Without searching first]
</tool_usage_rules>

FILE OPERATIONS:

1. When user ASKS QUESTIONS about stored information:
   → PROACTIVELY search and read multiple relevant files
   → Check all potential locations where info might exist
   → Synthesize findings from multiple sources
   → Only respond "not found" after thorough search

2. When user PROVIDES NEW INFORMATION:
   → First read existing file to preserve content
   → Update with new information while keeping old
   → Create new file if none exists

3. SEARCH STRATEGY:
   → Cast a wide net - better to check too many files than miss info
   → Use pattern matching - if asking about pets, check Personal Info, daily notes, any pet-related files
   → Check recent daily notes for recent information

FILE MANAGEMENT WORKFLOW:
For QUESTIONS:
1. Identify all potentially relevant files
2. Read each file searching for answer
3. Synthesize information from all sources
4. Provide comprehensive answer

For NEW INFO:
1. Check if relevant file exists
2. Read existing content
3. Merge new with old information
4. Write updated content

FOLDER STRUCTURE:
- /notes/ - Personal information, preferences, biographical data
- /daily/ - Daily journal entries and activities
- /projects/ - Project documentation and notes
- /references/ - External references and resources
- /ideas/ - Ideas and brainstorming
- /decisions/ - Important decisions made

KNOWLEDGE EXTRACTION:
Actively extract and SAVE:
- Personal details (family, pets, preferences, biography)
- Daily activities and events
- Work and professional information
- Relationships and contacts
- Ideas, decisions, and goals
- Any facts the user shares

RESPONSE STYLE:
- Always research thoroughly before responding
- Provide EXACT details as found in files - DO NOT modify or guess
- CRITICAL: Report information EXACTLY as written in the files
- If a file says "Graz", NEVER change it to "Düsseldorf"
- If a file says "Austria", NEVER change it to "Germany"
- Quote directly from files when answering factual questions
- Admit when information cannot be found after searching
- Be conversational but PRECISELY accurate

ACCURACY RULES:
- NEVER hallucinate or invent information not in files
- ALWAYS use the EXACT text from the files
- When in doubt, quote the file directly
- If multiple files conflict, mention all versions found
- Personal facts MUST match what's written, not what seems likely`;
}

export function setupLLMHandlers() {
  // Initialize knowledge client on startup
  initializeKnowledgeClient().catch(console.warn);
  
  // Initialize LLM service
  ipcMain.handle('llm:initialize', async (_, provider: LLMProvider, workspacePath: string) => {
    try {
      // Log the initialization parameters
      console.log('=== LLM Initialization Starting ===');
      console.log('Provider:', provider.name);
      console.log('Model:', provider.model);
      console.log('API Key present:', !!provider.apiKey);
      console.log('API Key length:', provider.apiKey ? provider.apiKey.length : 0);
      console.log('Workspace path:', workspacePath);
      
      // Validate provider data
      if (!provider.apiKey) {
        console.error('No API key provided for', provider.name);
        return { success: false, error: `API key is required for ${provider.name}. Please set it in File → API Keys (Cmd+Shift+K)` };
      }
      
      // Create new LLM service instance
      llmService = new LLMService(provider, workspacePath);
      
      // Set MCP tools if available
      const mcpManager = getMCPManager();
      if (mcpManager) {
        const mcpTools = mcpManager.getToolsForLLM();
        llmService.setMCPTools(mcpTools);
        console.log(`\ud83d\udd0c Setting ${mcpTools.length} MCP tools in LLM service`);
      }
      
      // Check if there's a custom system prompt already set
      let promptToUse = (store as any).get('systemPrompt') as string;
      
      // If no custom prompt exists, use the default
      if (!promptToUse) {
        promptToUse = getDefaultKnowledgeRules();
        // Save it for future use
        (store as any).set('systemPrompt', promptToUse);
        console.log('Using default Knowledge Rules (length:', promptToUse.length, ')');
      } else {
        console.log('Using custom system prompt (length:', promptToUse.length, ')');
        console.log('First 200 chars of prompt:', promptToUse.substring(0, 200));
      }
      
      llmService.setSystemPrompt(promptToUse);
      console.log('System prompt set successfully');
      
      console.log('=== LLM Service initialized successfully ===');
      console.log('Ready to process messages with Knowledge Rules');
      
      return { success: true };
    } catch (error) {
      console.error('=== LLM Initialization Error ===');
      console.error('Error details:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Send message to LLM
  ipcMain.handle('llm:sendMessage', async (_, message: string | any, history: any[], attachments?: any[]) => {
    console.log('\n=== Processing Message Request ===');
    const messagePreview = typeof message === 'string' 
      ? message.substring(0, 100) + (message.length > 100 ? '...' : '')
      : 'Complex message with attachments';
    console.log('Message:', messagePreview);
    console.log('History length:', history.length);
    console.log('Attachments:', attachments?.length || 0);
    
    if (!llmService) {
      console.error('LLM service not initialized when trying to send message');
      return { success: false, error: 'LLM service not initialized. Please ensure you have selected a project and configured your API key.' };
    }

    try {
      // Get list of files in workspace for context
      const workspacePath = (store as any).get('currentWorkspace') as string;
      console.log('Current workspace:', workspacePath);
      
      let availableFiles: string[] = [];
      
      if (workspacePath) {
        try {
          availableFiles = await getWorkspaceFiles(workspacePath);
          console.log('Found', availableFiles.length, 'files in workspace');
          if (availableFiles.length > 0) {
            console.log('Sample files:', availableFiles.slice(0, 3));
          }
        } catch (err) {
          console.warn('Could not get workspace files:', err);
        }
      }

      // Send message to LLM with Knowledge Rules
      console.log('\n=== Sending to LLM Provider ===');
      console.log('Provider in use:', llmService['provider'].name);
      console.log('Model in use:', llmService['provider'].model);
      console.log('System prompt length:', llmService['systemPrompt']?.length || 0);
      console.log('System prompt preview (first 300 chars):', llmService['systemPrompt']?.substring(0, 300) + '...');
      
      // Check if we have a mode personality in the prompt
      const promptStart = llmService['systemPrompt']?.substring(0, 200) || '';
      if (promptStart.toLowerCase().includes('jesus') || promptStart.toLowerCase().includes('christ')) {
        console.log('✝️ JESUS MODE DETECTED IN PROMPT');
      } else if (promptStart.includes('Mode')) {
        console.log('🎭 MODE PERSONALITY DETECTED');
      }
      
      const response = await llmService.sendMessage(message, history, availableFiles);
      console.log('\n=== Response Received ===');
      console.log('Response content length:', response.content?.length || 0);
      console.log('Response preview:', response.content?.substring(0, 100) + (response.content?.length > 100 ? '...' : ''));

      // Execute file operations if any and get results
      let functionResults: any[] = [];
      if (response.fileOperations && response.fileOperations.length > 0) {
        console.log('Executing', response.fileOperations.length, 'file operations');
        
        for (const operation of response.fileOperations) {
          const result = await executeFileOperationWithResult(operation, workspacePath);
          functionResults.push(result);
        }
        
        // For read operations, make a follow-up call with the file contents
        const hasReadOperation = response.fileOperations?.some(op => op.type === 'read');
        if (functionResults.length > 0 && hasReadOperation) {
          console.log('\n=== Making follow-up call with function results ===');
          
          // Add the assistant's function call message and the function results to history
          const updatedHistory = [
            ...history,
            { role: 'user', content: message },
            { role: 'assistant', content: response.content },
            { role: 'function', content: JSON.stringify(functionResults), name: 'function_results' }
          ];
          
          // Make a follow-up call to get the final response with function results
          const followUpResponse = await llmService.sendMessage(
            'Based on the file operations performed, please provide a complete response.',
            updatedHistory,
            availableFiles,
            functionResults
          );
          
          console.log('\n=== Follow-up Response Received ===');
          console.log('Response content length:', followUpResponse.content?.length || 0);
          
          // Execute any file operations from the follow-up response
          if (followUpResponse.fileOperations && followUpResponse.fileOperations.length > 0) {
            console.log('Executing', followUpResponse.fileOperations.length, 'follow-up file operations');
            for (const operation of followUpResponse.fileOperations) {
              await executeFileOperationWithResult(operation, workspacePath);
            }
          }
          
          // Use the follow-up response as the final response
          return { 
            success: true, 
            response: followUpResponse.content,
            usage: followUpResponse.usage,
            fileOperations: [...(response.fileOperations || []), ...(followUpResponse.fileOperations || [])]
          };
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide more helpful error messages
      if (errorMessage.includes('API key')) {
        return { success: false, error: 'Invalid or missing API key. Please check your API key in File → API Keys (Cmd+Shift+K)' };
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        return { success: false, error: 'Network error. Please check your internet connection and try again.' };
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        return { success: false, error: 'Authentication failed. Please verify your API key is correct and has proper permissions.' };
      } else if (errorMessage.includes('429')) {
        return { success: false, error: 'Rate limit exceeded. Please wait a moment and try again.' };
      }
      
      return { success: false, error: errorMessage };
    }
  });

  // Update system prompt
  ipcMain.handle('llm:setSystemPrompt', async (_, prompt: string) => {
    try {
      // Combine mode personality with base Knowledge Rules
      // Put mode character FIRST to establish personality, then add knowledge rules
      const baseKnowledgeRules = getDefaultKnowledgeRules();
      
      // Structure: Mode personality/character first, then operational rules
      // Add emphasis that personality MUST be maintained
      const combinedPrompt = `${prompt}

IMPORTANT: The above personality/character MUST be maintained throughout ALL responses, even when performing knowledge management tasks.

--- KNOWLEDGE MANAGEMENT RULES (Secondary to personality) ---
${baseKnowledgeRules}

REMEMBER: Your PRIMARY identity is defined above. These knowledge rules are secondary tools you use while maintaining your character.`;
      
      // Save to store for persistence (do this first so it's available for initialization)
      (store as any).set('systemPrompt', combinedPrompt);
      console.log('System prompt saved to store (mode + base rules, total length:', combinedPrompt.length, ')');
      
      // Log the first part of the mode prompt to verify what personality is being set
      console.log('=== MODE PROMPT BEING SET ===');
      console.log('First 500 chars of mode prompt:', prompt.substring(0, 500));
      console.log('=== END MODE PROMPT ===');
      
      // Update the LLM service if it's already initialized
      if (llmService) {
        llmService.setSystemPrompt(combinedPrompt);
        console.log('System prompt updated in active LLM service (mode personality + Knowledge Rules)');
      } else {
        console.log('LLM service not yet initialized - combined prompt will be used on next initialization');
      }
      
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
          'claude-opus-4-1-20250805',
          'claude-sonnet-4-20250514',
          'claude-3-5-haiku-20241022',
          'claude-3-opus-20240229',
          'claude-3-haiku-20240307'
        ]
      },
      { 
        name: 'OpenAI', 
        models: [
          'gpt-4o',
          'gpt-4o-mini',
          'gpt-4-vision-preview',
          'gpt-4-turbo-preview',
          'gpt-4-turbo',
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
  
  // Enhanced knowledge search
  ipcMain.handle('knowledge:search', async (_, query: string, searchType?: string, limit?: number) => {
    try {
      const client = await initializeKnowledgeClient();
      if (!client) {
        return { success: false, error: 'Enhanced knowledge service not available' };
      }
      
      const results = await client.search({
        query,
        type: searchType as any || 'hybrid',
        limit: limit || 10
      });
      
      return { success: true, results };
    } catch (error) {
      console.error('Knowledge search error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  
  // Get knowledge statistics
  ipcMain.handle('knowledge:statistics', async () => {
    try {
      const client = await initializeKnowledgeClient();
      if (!client) {
        return { success: false, error: 'Enhanced knowledge service not available' };
      }
      
      const stats = await client.getStatistics();
      return { success: true, statistics: stats };
    } catch (error) {
      console.error('Failed to get knowledge statistics:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

async function executeFileOperation(operation: FileOperation, workspacePath: string): Promise<void> {
  await executeFileOperationWithResult(operation, workspacePath);
  // For backward compatibility, just execute without returning the result
}

async function executeFileOperationWithResult(operation: FileOperation, workspacePath: string): Promise<any> {
  // Handle MCP operations differently
  if (operation.type === 'mcp') {
    const mcpManager = getMCPManager();
    if (!mcpManager) {
      throw new Error('MCP Manager not initialized');
    }
    
    if (!operation.tool) {
      throw new Error('MCP tool name required');
    }
    
    console.log(`\nExecuting MCP tool: ${operation.tool}`);
    
    try {
      const result = await mcpManager.executeTool(operation.tool, operation.args || {});
      console.log(`🔌 MCP tool ${operation.tool} executed successfully`);
      return {
        operation: 'mcp',
        tool: operation.tool,
        success: true,
        result: result
      };
    } catch (error) {
      console.error(`Error executing MCP tool ${operation.tool}:`, error);
      return {
        operation: 'mcp',
        tool: operation.tool,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // Regular file operations require a path
  if (!operation.path) {
    throw new Error('Path required for file operation');
  }
  
  const fullPath = path.join(workspacePath, operation.path);
  
  console.log(`\nExecuting operation: ${operation.type} on ${operation.path}`);

  switch (operation.type) {
    case 'read':
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        console.log(`File read successfully: ${operation.path} (${content.length} characters)`);
        return {
          operation: 'read_file',
          path: operation.path,
          success: true,
          content: content
        };
      } catch (error) {
        console.error(`Error reading file: ${error}`);
        return {
          operation: 'read_file',
          path: operation.path,
          success: false,
          error: `File not found: ${operation.path}`
        };
      }

    case 'write':
      if (!operation.content) {
        throw new Error('Content required for write operation');
      }
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      // CRITICAL: Always preserve existing content by default
      let finalContent = operation.content;
      let fileExists = false;
      
      try {
        const existingContent = await fs.readFile(fullPath, 'utf-8');
        fileExists = true;
        
        // If file exists, intelligently merge content
        console.log(`⚠️ File exists: ${operation.path} - Preserving existing content`);
        
        // Check if the new content already includes the old content
        if (!operation.content.includes(existingContent)) {
          // Add a separator and timestamp
          const date = new Date().toISOString().split('T')[0];
          const time = new Date().toLocaleTimeString();
          
          // If the content appears to be an update, merge intelligently
          if (operation.content.toLowerCase().includes('update') || 
              operation.content.toLowerCase().includes('edit')) {
            // This seems to be an update - merge the content
            finalContent = existingContent + `\n\n---\n\n## Updated: ${date} ${time}\n\n` + operation.content;
          } else {
            // This is new content - append it
            finalContent = existingContent + `\n\n---\n\n## Added: ${date} ${time}\n\n` + operation.content;
          }
        }
        // If new content includes old content, it's probably an intelligent update
      } catch (error) {
        // File doesn't exist, create new one
        console.log(`Creating new file: ${operation.path}`);
      }
      
      await fs.writeFile(fullPath, finalContent);
      console.log(`File ${fileExists ? 'updated' : 'created'}: ${operation.path}`);
      
      // Enhanced knowledge save with entity extraction
      try {
        const client = await initializeKnowledgeClient();
        if (client) {
          const saveResult = await client.save({
            content: finalContent,
            title: operation.path,
            metadata: {
              source: 'chat',
              path: operation.path,
              workspace: workspacePath,
              timestamp: new Date().toISOString()
            },
            mode: fileExists ? 'update' : 'new'
          });
          
          if (saveResult.success && saveResult.entities_extracted) {
            console.log(`🧠 Enhanced: Extracted ${saveResult.entities_extracted} entities from ${operation.path}`);
          }
        }
      } catch (error) {
        console.warn('Enhanced knowledge save failed, file saved normally:', error);
      }
      
      return {
        operation: 'write_file',
        path: operation.path,
        success: true,
        message: `File successfully ${fileExists ? 'updated (existing content preserved)' : 'created'} with ${finalContent.length} characters`
      };

    case 'append': {
      if (!operation.content) {
        throw new Error('Content required for append operation');
      }
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      // Check if file exists
      let existingContent = '';
      try {
        existingContent = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        // File doesn't exist, will create new one
      }
      
      // Append with appropriate separator
      const date = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString();
      const separator = existingContent ? `\n\n---\n\n## Added: ${date} ${time}\n\n` : '';
      const finalContent = existingContent + separator + operation.content;
      
      await fs.writeFile(fullPath, finalContent);
      console.log(`Content appended to: ${operation.path}`);
      
      // Enhanced knowledge append with entity extraction
      try {
        const client = await initializeKnowledgeClient();
        if (client) {
          const appendResult = await client.append(
            operation.content,
            operation.path,
            {
              source: 'chat',
              path: operation.path,
              workspace: workspacePath,
              timestamp: new Date().toISOString()
            }
          );
          
          if (appendResult.success && appendResult.entities_extracted) {
            console.log(`🧠 Enhanced: Extracted ${appendResult.entities_extracted} entities from appended content`);
          }
        }
      } catch (error) {
        console.warn('Enhanced knowledge append failed, content appended normally:', error);
      }
      
      return {
        operation: 'append_file',
        path: operation.path,
        success: true,
        message: `Content successfully appended`
      };
    }

    case 'update': {
      if (!operation.content) {
        throw new Error('Content required for update operation');
      }
      
      // Read existing file content
      let existingFileContent = '';
      try {
        existingFileContent = await fs.readFile(fullPath, 'utf-8');
      } catch (error) {
        // If file doesn't exist, fall back to write
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, operation.content);
        console.log(`File created (update attempted on non-existent file): ${operation.path}`);
        return {
          operation: 'update_file',
          path: operation.path,
          success: true,
          message: 'File created with new content'
        };
      }
      
      // Intelligently update the section if specified
      let updatedContent = existingFileContent;
      const date = new Date().toISOString().split('T')[0];
      const time = new Date().toLocaleTimeString();
      
      if (operation.section) {
        // Try to find and replace the section
        const sectionRegex = new RegExp(`(#+\\s*${operation.section}[^#]*?)(?=#+|$)`, 'i');
        if (sectionRegex.test(updatedContent)) {
          // Section exists, update it
          updatedContent = updatedContent.replace(sectionRegex, 
            `$1\n\n_Last updated: ${date} ${time}_\n\n${operation.content}\n`);
        } else {
          // Section doesn't exist, append it
          updatedContent += `\n\n## ${operation.section}\n\n_Created: ${date} ${time}_\n\n${operation.content}`;
        }
      } else {
        // No specific section, append with timestamp
        updatedContent += `\n\n---\n\n## Updated: ${date} ${time}\n\n${operation.content}`;
      }
      
      await fs.writeFile(fullPath, updatedContent);
      console.log(`File updated intelligently: ${operation.path}`);
      return {
        operation: 'update_file',
        path: operation.path,
        success: true,
        message: 'File updated while preserving existing content'
      };
    }

    case 'create_folder':
      await fs.mkdir(fullPath, { recursive: true });
      console.log(`Folder created: ${operation.path}`);
      return {
        operation: 'create_folder',
        path: operation.path,
        success: true,
        message: `Folder successfully created`
      };

    case 'list':
      const files = await fs.readdir(fullPath);
      console.log(`Directory listed: ${operation.path} (${files.length} items)`);
      return {
        operation: 'list_directory',
        path: operation.path,
        success: true,
        files: files
      };

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