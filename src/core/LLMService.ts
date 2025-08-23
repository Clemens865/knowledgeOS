export interface LLMProvider {
  name: string;
  apiKey: string;
  model: string;
  endpoint?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string; // For function messages
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface FileOperation {
  type: 'read' | 'write' | 'create_folder' | 'list';
  path: string;
  content?: string;
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
  
  constructor(provider: LLMProvider, workspacePath: string) {
    this.provider = provider;
    this.workspacePath = workspacePath;
    this.systemPrompt = this.getDefaultSystemPrompt();
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
    userMessage: string,
    conversationHistory: Message[] = [],
    availableFiles?: string[]
  ): Promise<LLMResponse> {
    const messages: Message[] = [
      { role: 'system', content: this.systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];
    
    // Add available files context if provided
    if (availableFiles && availableFiles.length > 0) {
      messages[0].content += `\n\nAVAILABLE FILES IN WORKSPACE:\n${availableFiles.join('\n')}`;
    }
    
    switch (this.provider.name.toLowerCase()) {
      case 'claude':
        return this.sendToClaude(messages);
      case 'openai':
        return this.sendToOpenAI(messages);
      case 'gemini':
        return this.sendToGemini(messages);
      default:
        throw new Error(`Unsupported provider: ${this.provider.name}`);
    }
  }
  
  private async sendToClaude(messages: Message[]): Promise<LLMResponse> {
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }));
    
    // Validate API key format
    if (!this.provider.apiKey || !this.provider.apiKey.startsWith('sk-ant-')) {
      console.error('Invalid Claude API key format. Key should start with "sk-ant-"');
      throw new Error('Invalid Claude API key format. Please check your API key.');
    }
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.provider.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: this.provider.model || 'claude-3-sonnet-20240229',
        messages: anthropicMessages,
        system: messages.find(m => m.role === 'system')?.content,
        max_tokens: 4096,
        tools: this.getClaudeTools()
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Claude API error:', data);
      throw new Error(`Claude API error: ${data.error?.message || data.message || 'Unknown error'}`);
    }
    
    return this.parseClaudeResponse(data);
  }
  
  private getClaudeTools() {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a markdown file',
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
        description: 'Write or update a markdown file',
        input_schema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' },
            content: { type: 'string', description: 'File content in markdown' }
          },
          required: ['path', 'content']
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
  }
  
  private parseClaudeResponse(data: any): LLMResponse {
    const response: LLMResponse = {
      content: '',
      fileOperations: []
    };
    
    for (const contentBlock of data.content) {
      if (contentBlock.type === 'text') {
        response.content += contentBlock.text;
      } else if (contentBlock.type === 'tool_use') {
        const operation = this.parseToolUse(contentBlock);
        if (operation) {
          response.fileOperations!.push(operation);
        }
      }
    }
    
    if (data.usage) {
      response.usage = {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens
      };
    }
    
    return response;
  }
  
  private parseToolUse(toolUse: any): FileOperation | null {
    const { name, input } = toolUse;
    
    switch (name) {
      case 'read_file':
        return { type: 'read', path: input.path };
      case 'write_file':
        return { type: 'write', path: input.path, content: input.content };
      case 'list_directory':
        return { type: 'list', path: input.path };
      case 'create_folder':
        return { type: 'create_folder', path: input.path };
      default:
        return null;
    }
  }
  
  private async sendToOpenAI(messages: Message[]): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.provider.apiKey}`
      },
      body: JSON.stringify({
        model: this.provider.model || 'gpt-4-turbo-preview',
        messages: messages,
        functions: this.getOpenAIFunctions(),
        function_call: 'auto',
        max_tokens: 4096
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`);
    }
    
    return this.parseOpenAIResponse(data);
  }
  
  private getOpenAIFunctions() {
    return [
      {
        name: 'read_file',
        description: 'Read the contents of a markdown file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write or update a markdown file',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path relative to workspace' },
            content: { type: 'string', description: 'File content in markdown' }
          },
          required: ['path', 'content']
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
  }
  
  private parseOpenAIResponse(data: any): LLMResponse {
    const response: LLMResponse = {
      content: data.choices[0].message.content || '',
      fileOperations: []
    };
    
    if (data.choices[0].message.function_call) {
      const functionCall = data.choices[0].message.function_call;
      const args = JSON.parse(functionCall.arguments);
      
      const operation = this.parseFunctionCall(functionCall.name, args);
      if (operation) {
        response.fileOperations!.push(operation);
      }
    }
    
    if (data.usage) {
      response.usage = data.usage;
    }
    
    return response;
  }
  
  private parseFunctionCall(name: string, args: any): FileOperation | null {
    switch (name) {
      case 'read_file':
        return { type: 'read', path: args.path };
      case 'write_file':
        return { type: 'write', path: args.path, content: args.content };
      case 'list_directory':
        return { type: 'list', path: args.path };
      case 'create_folder':
        return { type: 'create_folder', path: args.path };
      default:
        return null;
    }
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