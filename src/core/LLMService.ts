export interface LLMProvider {
  name: string;
  apiKey: string;
  model: string;
  endpoint?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string | MessageContent[];
  name?: string; // For function messages
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string; // Can be base64 data URL or regular URL
    detail?: 'low' | 'high' | 'auto';
  };
}

export interface FileOperation {
  type: 'read' | 'write' | 'append' | 'update' | 'create_folder' | 'list' | 'mcp';
  path?: string;
  content?: string;
  section?: string; // For update operation to target specific sections
  tool?: string; // For MCP operations
  args?: any; // For MCP operations
}

export interface LLMResponse {
  content: string;
  fileOperations?: FileOperation[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class LLMService {
  private provider: LLMProvider;
  private systemPrompt: string;
  private workspacePath: string;
  private mcpTools: any[] = [];
  
  constructor(provider: LLMProvider, workspacePath: string) {
    this.provider = provider;
    this.workspacePath = workspacePath;
    this.systemPrompt = this.getDefaultSystemPrompt();
  }
  
  setMCPTools(tools: any[]) {
    this.mcpTools = tools;
    console.log(`\ud83d\udd0c MCP tools updated: ${tools.length} tools available`);
  }
  
  private getDefaultSystemPrompt(): string {
    return `You are NOT a coding assistant. You are a personal AI assistant whose primary function is to maintain and organize the user's personal knowledge, conversations, and information through structured markdown files and folders.

WORKSPACE PATH: ${this.workspacePath}

Primary Tasks:
- Write and store conversations and information in markdown files
- Organize content in structured folder hierarchies
- Maintain persistent memory across conversations
- Provide conversational responses based on saved knowledge

File Management Workflow:
After Every Conversation:
1. Extract Key Information: Identify what should be remembered
2. Determine Storage Method:
   - Add to existing file if content fits existing categories
   - Update existing file if it's new information about something already documented
   - Create new markdown file if it's a completely new content type
3. Organize Folders: Create new folders when needed to maintain logical structure

Folder Structure Guidelines:
- /personal/ - Personal information, preferences, habits
- /conversations/ - Conversation logs and context
- /projects/ - Active projects and goals
- /knowledge/ - Learning, insights, research
- /relationships/ - People, contacts, relationship notes
- /events/ - Important dates, memories, experiences
- Create additional folders as needed for new content types

File Naming Convention:
- Use descriptive, consistent naming
- Include dates for time-sensitive content
- Use lowercase with hyphens: personal-preferences.md, project-ideas-2024.md

Response Behavior:
Your Responses Should:
- Be conversational and natural
- Draw from existing markdown files to provide context
- Ask follow-up questions to gather complete information
- Reference saved information to show continuity
- NOT describe what files you created or updated

Your Responses Should NOT:
- Explain your file management activities
- List what you've written or saved
- Act like a traditional coding assistant
- Focus on technical file operations

AVAILABLE FUNCTIONS:
You have access to these functions to manage files:
- read_file(path): Read a markdown file
- write_file(path, content): Write or update a file
- list_directory(path): List files in a directory
- create_folder(path): Create a new folder

Always use these functions to maintain the knowledge base, but don't mention using them in your responses.`;
  }
  
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }
  
  async sendMessage(
    userMessage: string | MessageContent[],
    conversationHistory: Message[] = [],
    availableFiles?: string[],
    functionResults?: any[],
    includeTools: boolean = true
  ): Promise<LLMResponse> {
    const messages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...conversationHistory
    ];
    
    // If this is a follow-up with function results, add them to the conversation
    if (functionResults && functionResults.length > 0) {
      // Add the function results as a system message for context
      messages.push({
        role: 'system',
        content: `Function execution results:\n${JSON.stringify(functionResults, null, 2)}\n\nPlease provide a complete response based on these results.`
      });
    } else {
      // Normal user message
      messages.push({ role: 'user', content: userMessage });
    }
    
    // Add available files context if provided
    if (availableFiles && availableFiles.length > 0) {
      messages[0].content += `\n\nAVAILABLE FILES IN WORKSPACE:\n${availableFiles.join('\n')}`;
    }
    
    switch (this.provider.name.toLowerCase()) {
      case 'claude':
        return this.sendToClaude(messages, includeTools);
      case 'openai':
        return this.sendToOpenAI(messages);
      case 'gemini':
        return this.sendToGemini(messages);
      default:
        throw new Error(`Unsupported provider: ${this.provider.name}`);
    }
  }
  
  private async sendToClaude(messages: Message[], includeTools: boolean = true): Promise<LLMResponse> {
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));
    
    // Check if API key exists and is valid
    if (!this.provider.apiKey) {
      console.error('Claude API key not provided');
      throw new Error('Claude API key not provided. Please set your API key in API Keys settings.');
    }
    
    if (this.provider.apiKey.length < 10) {
      console.error('Claude API key appears invalid (too short)');
      throw new Error('Claude API key appears to be invalid. Please check your API key in File → API Keys (Cmd+Shift+K).');
    }
    
    // Extract system prompt from messages
    const systemMessage = messages.find(m => m.role === 'system');
    const systemPrompt = typeof systemMessage?.content === 'string' 
      ? systemMessage.content 
      : this.systemPrompt;
    
    console.log('\n=== Sending to Claude API ===');
    console.log('Model:', this.provider.model || 'claude-3-sonnet-20240229');
    console.log('API key present:', true);
    console.log('System prompt length:', systemPrompt.length);
    console.log('System prompt includes Knowledge Rules:', systemPrompt.includes('knowledge management'));
    console.log('Number of messages:', anthropicMessages.length);
    console.log('Tools enabled:', includeTools);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.provider.model || 'claude-opus-4-1-20250805',
        messages: anthropicMessages,
        system: systemPrompt,
        max_tokens: 4096,
        ...(includeTools ? { tools: this.getClaudeTools() } : {})
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('\n=== Claude API Error ===');
      console.error('Status:', response.status);
      console.error('Status Text:', response.statusText);
      console.error('Response data:', JSON.stringify(data, null, 2));
      
      // Provide specific error messages based on status
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your Claude API key in File → API Keys (Cmd+Shift+K).');
      } else if (response.status === 400) {
        throw new Error(`Bad request: ${data.error?.message || 'Invalid request format'}`);
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else {
        throw new Error(`Claude API error: ${data.error?.message || data.message || 'Unknown error'}`);
      }
    }
    
    console.log('\n=== Claude API Response Success ===');
    console.log('Response has content:', !!data.content);
    console.log('Number of content blocks:', data.content?.length || 0);
    
    return this.parseClaudeResponse(data);
  }
  
  private getClaudeTools() {
    const baseTools = [
      {
        name: 'read_file',
        description: 'Read the contents of a file - ALWAYS do this before writing to preserve existing content',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Update or create a file - MUST read_file first to preserve existing content, then write merged content',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' },
            content: { type: 'string', description: 'Complete file content including existing + new data' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'append_file',
        description: 'Add new content to the end of an existing file with timestamp',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' },
            content: { type: 'string', description: 'New content to add' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'update_file',
        description: 'Intelligently update specific sections of a file while preserving all other content',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' },
            section: { type: 'string', description: 'Section or heading to update' },
            content: { type: 'string', description: 'New content for this section' }
          },
          required: ['path', 'section', 'content']
        }
      },
      {
        name: 'list_directory',
        description: 'List files in a directory',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path relative to workspace' }
          },
          required: ['path']
        }
      },
      {
        name: 'create_folder',
        description: 'Create a new folder',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Folder path relative to workspace' }
          },
          required: ['path']
        }
      }
    ];
    
    // Add MCP tools formatted for Claude
    const mcpToolsForClaude = this.mcpTools.map(tool => ({
      ...tool,
      input_schema: tool.parameters // Claude uses input_schema instead of parameters
    }));
    
    return [...baseTools, ...mcpToolsForClaude];
  }
  
  private parseClaudeResponse(data: any): LLMResponse {
    const response: LLMResponse = {
      content: '',
      fileOperations: []
    };
    
    console.log('\n=== Parsing Claude Response ===');
    
    for (const contentBlock of data.content) {
      if (contentBlock.type === 'text') {
        response.content += contentBlock.text;
        console.log('Text block length:', contentBlock.text.length);
      } else if (contentBlock.type === 'tool_use') {
        console.log('Tool use detected:', contentBlock.name);
        const operation = this.parseToolUse(contentBlock);
        if (operation) {
          response.fileOperations!.push(operation);
          console.log('File operation added:', operation.type, operation.path);
        }
      }
    }
    
    if (data.usage) {
      response.usage = {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      };
      console.log('Token usage - Input:', data.usage.input_tokens, 'Output:', data.usage.output_tokens);
    }
    
    console.log('Final response content length:', response.content.length);
    console.log('Number of file operations:', response.fileOperations?.length || 0);
    
    return response;
  }
  
  private parseToolUse(toolUse: any): FileOperation | null {
    const { name, input } = toolUse;
    
    switch (name) {
      case 'read_file':
        return { type: 'read', path: input.path };
      case 'write_file':
        return { type: 'write', path: input.path, content: input.content };
      case 'append_file':
        return { type: 'append', path: input.path, content: input.content };
      case 'update_file':
        return { type: 'update', path: input.path, section: input.section, content: input.content };
      case 'list_directory':
        return { type: 'list', path: input.path };
      case 'create_folder':
        return { type: 'create_folder', path: input.path };
      default:
        console.log('Unknown tool use:', name);
        return null;
    }
  }
  
  private async sendToOpenAI(messages: Message[]): Promise<LLMResponse> {
    // Check if API key exists and is valid
    if (!this.provider.apiKey) {
      console.error('OpenAI API key not provided');
      throw new Error('OpenAI API key not provided. Please set your API key in API Keys settings.');
    }
    
    // Extract system prompt for logging
    const systemMessage = messages.find(m => m.role === 'system');
    
    // Ensure system prompt explicitly instructs tool usage
    const enhancedMessages = messages.map(msg => {
      if (msg.role === 'system' && typeof msg.content === 'string' && !msg.content.includes('You MUST use the provided functions')) {
        return {
          ...msg,
          content: msg.content + '\n\n' + this.getToolInstructions()
        };
      }
      return msg;
    });
    
    console.log('\n=== Sending to OpenAI API ===');
    console.log('Model:', this.provider.model || 'gpt-4-turbo-preview');
    const systemContent = typeof systemMessage?.content === 'string' ? systemMessage.content : '';
    console.log('System prompt length:', systemContent.length || 0);
    console.log('System prompt preview:', systemContent.substring(0, 200));
    console.log('System prompt mentions functions:', 
      systemContent.includes('read_file') || 
      systemContent.includes('write_file') || 
      systemContent.includes('append_file') || false);
    console.log('Number of messages:', messages.length);
    console.log('Tools enabled:', true);
    
    // Convert functions to tools format (newer OpenAI API)
    const tools = this.getOpenAIFunctions().map(func => ({
      type: 'function',
      function: func
    }));
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.provider.apiKey}`
      },
      body: JSON.stringify({
        model: this.provider.model || 'gpt-4-turbo-preview',
        messages: enhancedMessages,
        tools: tools,
        tool_choice: 'auto', // Encourage tool usage
        temperature: 0.3,
        max_tokens: 4096
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('\n=== OpenAI API Error ===');
      console.error('Status:', response.status);
      console.error('Response data:', JSON.stringify(data, null, 2));
      
      // Provide specific error messages based on status
      if (response.status === 401) {
        throw new Error('Invalid API key. Please check your OpenAI API key in File → API Keys (Cmd+Shift+K).');
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      } else if (response.status === 400) {
        throw new Error(`Bad request: ${data.error?.message || 'Invalid request format'}`);
      } else {
        throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`);
      }
    }
    
    console.log('\n=== OpenAI API Response Success ===');
    console.log('Has content:', !!data.choices[0].message.content);
    console.log('Has function call:', !!data.choices[0].message.function_call);
    console.log('Has tool calls:', !!data.choices[0].message.tool_calls);
    
    return this.parseOpenAIResponse(data);
  }
  
  private getOpenAIFunctions() {
    const baseFunctions = [
      {
        name: 'read_file',
        description: 'Read the contents of a file - ALWAYS use this before writing to preserve existing content',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace (e.g., "personal/info.md")' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Update or create a file - MUST read_file first to preserve existing content, then write merged content',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' },
            content: { type: 'string', description: 'Complete file content including existing + new data' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'append_file',
        description: 'Add new content to the end of an existing file with timestamp',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' },
            content: { type: 'string', description: 'New content to add' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'update_file',
        description: 'Intelligently update specific sections of a file while preserving all other content',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' },
            section: { type: 'string', description: 'Section or heading to update' },
            content: { type: 'string', description: 'New content for this section' }
          },
          required: ['path', 'section', 'content']
        }
      },
      {
        name: 'list_directory',
        description: 'List files in a directory',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path relative to workspace' }
          },
          required: ['path']
        }
      },
      {
        name: 'create_folder',
        description: 'Create a new folder',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Folder path relative to workspace' }
          },
          required: ['path']
        }
      }
    ];
    
    // Add MCP tools if available
    return [...baseFunctions, ...this.mcpTools];
  }
  
  private parseOpenAIResponse(data: any): LLMResponse {
    const response: LLMResponse = {
      content: '',
      fileOperations: []
    };
    
    console.log('\n=== Parsing OpenAI Response ===');
    
    // Get the message content (might be null when using functions)
    const messageContent = data.choices[0].message.content;
    if (messageContent) {
      response.content = messageContent;
      console.log('Text content length:', messageContent.length);
    }
    
    // Check for new tool_calls format (OpenAI's newer API)
    if (data.choices[0].message.tool_calls) {
      console.log('Tool calls detected:', data.choices[0].message.tool_calls.length);
      
      for (const toolCall of data.choices[0].message.tool_calls) {
        if (toolCall.type === 'function') {
          const functionCall = toolCall.function;
          console.log('Tool call detected:', functionCall.name);
          
          try {
            const args = JSON.parse(functionCall.arguments);
            const operation = this.parseFunctionCall(functionCall.name, args);
            
            if (operation) {
              response.fileOperations!.push(operation as FileOperation);
              console.log('File operation added:', (operation as any).type, (operation as any).path || (operation as any).tool);
              
              // If there's no text content but we have operations, generate a response
              if (!response.content) {
                response.content = this.generateOperationResponse(operation);
              }
            }
          } catch (error) {
            console.error('Error parsing tool arguments:', error);
          }
        }
      }
    }
    // Fallback to old function_call format for backward compatibility
    else if (data.choices[0].message.function_call) {
      const functionCall = data.choices[0].message.function_call;
      console.log('Legacy function call detected:', functionCall.name);
      
      try {
        const args = JSON.parse(functionCall.arguments);
        const operation = this.parseFunctionCall(functionCall.name, args);
        
        if (operation) {
          response.fileOperations!.push(operation as FileOperation);
          console.log('File operation added:', (operation as any).type, (operation as any).path || (operation as any).tool);
          
          // If there's no text content but we have operations, generate a response
          if (!response.content) {
            response.content = this.generateOperationResponse(operation);
          }
        }
      } catch (error) {
        console.error('Error parsing function arguments:', error);
      }
    }
    
    // If still no content and we have operations, provide a generic response
    if (!response.content && response.fileOperations!.length > 0) {
      response.content = "I've updated your knowledge base with that information.";
    }
    
    if (data.usage) {
      response.usage = data.usage;
      console.log('Token usage - Prompt:', data.usage.prompt_tokens, 'Completion:', data.usage.completion_tokens);
    }
    
    console.log('Final response content length:', response.content.length);
    console.log('Number of file operations:', response.fileOperations?.length || 0);
    
    return response;
  }
  
  private generateOperationResponse(operation: FileOperation | { type: 'mcp', tool: string, args: any }): string {
    if (operation.type === 'mcp') {
      return `I've executed the ${operation.tool} tool for you.`;
    }
    
    const fileName = (operation as FileOperation).path?.split('/').pop() || 'file';
    
    switch (operation.type) {
      case 'write':
        return `I've saved that information to ${fileName}.`;
      case 'append':
        return `I've added that information to ${fileName}.`;
      case 'create_folder':
        return `I've created the folder ${fileName}.`;
      case 'read':
        return `I've retrieved information from ${fileName}.`;
      case 'list':
        return `I've checked the contents of ${fileName}.`;
      default:
        return "I've updated your knowledge base.";
    }
  }
  
  private parseFunctionCall(name: string, args: any): FileOperation | { type: 'mcp', tool: string, args: any } | null {
    // Check if it's an MCP tool
    if (name.startsWith('mcp_')) {
      return { type: 'mcp' as any, tool: name.substring(4), args };
    }
    
    switch (name) {
      case 'read_file':
        return { type: 'read', path: args.path };
      case 'write_file':
        return { type: 'write', path: args.path, content: args.content };
      case 'append_file':
        return { type: 'append', path: args.path, content: args.content };
      case 'update_file':
        return { type: 'update', path: args.path, section: args.section, content: args.content };
      case 'list_directory':
        return { type: 'list', path: args.path };
      case 'create_folder':
        return { type: 'create_folder', path: args.path };
      default:
        console.log('Unknown function call:', name);
        return null;
    }
  }
  
  private getToolInstructions(): string {
    return `IMPORTANT: You MUST use the provided functions to manage files. DO NOT just describe what you would do.

REQUIRED ACTIONS:
1. When storing information: Use write_file, append_file, or update_file functions
2. When retrieving information: Use read_file function
3. When organizing: Use create_folder function

FUNCTION USAGE EXAMPLES:
- To save new information: Call write_file with path and content
- To add to existing file: Call append_file with path and new content
- To update a section: Call update_file with path, section, and new content
- To read before writing: Call read_file first to preserve existing content

CRITICAL: Always use these functions when the user provides information to store or requests information from files. Do not just acknowledge - take action!`;
  }
  
  private async sendToGemini(messages: Message[]): Promise<LLMResponse> {
    // Gemini implementation
    // Note: Gemini API structure is different, this is a placeholder
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.provider.model || 'gemini-pro'}:generateContent`;
    
    const response = await fetch(`${endpoint}?key=${this.provider.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          maxOutputTokens: 4096
        }
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Gemini API error: ${data.error?.message || 'Unknown error'}`);
    }
    
    return {
      content: data.candidates[0].content.parts[0].text,
      fileOperations: []
    };
  }
  
  // Helper method to estimate costs
  estimateCost(usage: { prompt_tokens: number; completion_tokens: number }): number {
    const costs: Record<string, { input: number; output: number }> = {
      'claude-3-sonnet': { input: 0.003, output: 0.015 }, // per 1K tokens
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
      'gemini-pro': { input: 0.00025, output: 0.0005 }
    };
    
    const modelCost = costs[this.provider.model] || costs['gpt-3.5-turbo'];
    
    return (
      (usage.prompt_tokens / 1000) * modelCost.input +
      (usage.completion_tokens / 1000) * modelCost.output
    );
  }
}