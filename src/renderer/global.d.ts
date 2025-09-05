interface ElectronAPI {
  // File operations
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  
  // Dialog operations
  openFile: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  openDirectory: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  saveFile: (defaultPath?: string) => Promise<{ canceled: boolean; filePath?: string }>;
  
  // App info
  getVersion: () => Promise<string>;
  getPath: (name: string) => Promise<string>;
  
  // Menu events
  onMenuAction: (callback: (action: string) => void) => void;
  removeAllListeners: () => void;
  
  // Settings API
  getSetting?: (key: string) => Promise<any>;
  setSetting?: (key: string, value: any) => Promise<void>;
  
  // Workspace API
  selectFolder: () => Promise<{ canceled: boolean; filePaths?: string[] }>;
  createWorkspace: (path: string) => Promise<{ success: boolean; error?: string }>;
  openWorkspace: (path: string) => Promise<{ 
    success: boolean; 
    config?: any; 
    path?: string; 
    needsInit?: boolean; 
    message?: string; 
    error?: string 
  }>;
  getRecentWorkspaces: () => Promise<Array<{
    path: string;
    name: string;
    lastOpened: string;
  }>>;
  getCurrentWorkspace: () => Promise<string | null>;
  listFiles: (folderPath: string) => Promise<{ 
    success: boolean; 
    files?: Array<{
      name: string;
      path: string;
      isDirectory: boolean;
      isFile: boolean;
      size: number;
      modified: string;
      created: string;
    }>; 
    error?: string 
  }>;
  createNote: (folderPath: string, fileName: string) => Promise<{ 
    success: boolean; 
    path?: string; 
    error?: string; 
    exists?: boolean 
  }>;
  
  // LLM API
  initializeLLM: (provider: LLMProvider, workspacePath: string) => Promise<{ success: boolean; error?: string }>;
  sendMessageToLLM: (message: string | any, history: any[], context?: any) => Promise<{
    success: boolean;
    response?: string;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    fileOperations?: any[];
    error?: string;
  }>;
  setSystemPrompt: (prompt: string) => Promise<{ success: boolean; error?: string }>;
  getSystemPrompt: () => Promise<string | null>;
  saveApiKey: (provider: string, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  getApiKey: (provider: string) => Promise<string>;
  getLLMProviders: () => Promise<Array<{
    name: string;
    models: string[];
  }>>;
  
  // MCP API
  mcp: {
    getServers: () => Promise<MCPServer[]>;
    addServer: (server: MCPServer) => Promise<{ success: boolean; error?: string }>;
    removeServer: (name: string) => Promise<{ success: boolean; error?: string }>;
    getTools: () => Promise<MCPTool[]>;
    executeTool: (toolName: string, args: any) => Promise<{ success: boolean; result?: any; error?: string }>;
    testConnection: (server: MCPServer) => Promise<{ success: boolean; message?: string; error?: string }>;
  };
  
  // Analytics API
  analytics: {
    getStats: (workspacePath: string) => Promise<KnowledgeStats>;
  };
  
  // Conversation Modes API
  conversationModes: {
    getAll: () => Promise<{ success: boolean; modes?: ConversationMode[]; error?: string }>;
    create: (mode: ConversationMode) => Promise<{ success: boolean; mode?: ConversationMode; error?: string }>;
    update: (mode: ConversationMode) => Promise<{ success: boolean; mode?: ConversationMode; error?: string }>;
    delete: (modeId: string) => Promise<{ success: boolean; error?: string }>;
    reset: () => Promise<{ success: boolean; error?: string }>;
    export: () => Promise<{ success: boolean; modes?: ConversationMode[]; error?: string }>;
    import: (modes: ConversationMode[]) => Promise<{ success: boolean; importedCount?: number; error?: string }>;
    getDefaultRules: () => Promise<{ success: boolean; rules?: string; error?: string }>;
  };
  
  // Knowledge Graph API
  knowledgeGraph?: {
    buildGraph: (workspacePath: string) => Promise<{ success: boolean; graph?: any; error?: string }>;
    getNodeDetails: (workspacePath: string, nodeId: string) => Promise<{ success: boolean; node?: any; error?: string }>;
  };
  
  // Octopus Mode API
  startOctopusCrawl: (args: {
    url: string;
    instruction?: string;
    options?: {
      depth?: number;
      maxPages?: number;
      includeSubdomains?: boolean;
      respectRobotsTxt?: boolean;
      selectors?: {
        content?: string;
        excludes?: string[];
      };
    };
  }) => Promise<{
    success: boolean;
    sessionId?: string;
    pages?: any[];
    totalPages?: number;
    errors?: Array<{ url: string; error: string }>;
    processedContent?: any;
    instruction?: any;
    error?: string;
  }>;
  saveToKnowledge: (args: {
    sessionId?: string;
    content?: string;
    fileName: string;
    metadata: any;
  }) => Promise<{
    success: boolean;
    filePath?: string;
    error?: string;
  }>;
  checkOctopusAvailability: () => Promise<{
    available: boolean;
    hasLLM: boolean;
    features: {
      basicCrawl: boolean;
      intelligentCrawl: boolean;
      multiPage: boolean;
      instructionSupport: boolean;
      interactiveRefinement: boolean;
      multiStepWorkflow: boolean;
    };
  }>;
  onCrawlProgress: (callback: (progress: any) => void) => void;
  removeOctopusListeners: () => void;
  
  // Enhanced Octopus Mode Session APIs
  processWithInstruction: (args: {
    sessionId: string;
    instruction: string;
  }) => Promise<{
    success: boolean;
    content?: string;
    versionId?: string;
    error?: string;
  }>;
  
  refineContent: (args: {
    sessionId: string;
    message: string;
  }) => Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }>;
  
  getOctopusSession: (sessionId: string) => Promise<{
    success: boolean;
    session?: any;
    currentContent?: string;
    versions?: any[];
    error?: string;
  }>;
  
  exportOctopusContent: (args: {
    sessionId: string;
    format: 'markdown' | 'json' | 'knowledge';
  }) => Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }>;
}

interface ConversationMode {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  allowFileUpload?: boolean;
  supportedFileTypes?: string[];
  isCustom?: boolean;
  includeDefaultRules?: boolean;
}

interface KnowledgeStats {
  totalNotes: number;
  totalWords: number;
  totalCharacters: number;
  totalLinks: number;
  averageNoteLength: number;
  longestNote: { path: string; words: number } | null;
  shortestNote: { path: string; words: number } | null;
  recentNotes: Array<{
    path: string;
    name: string;
    words: number;
    modified: Date;
    created: Date;
    links: string[];
    tags: string[];
  }>;
  topTags: { tag: string; count: number }[];
  orphanedNotes: string[];
  mostLinkedNotes: { path: string; linkCount: number }[];
  folderStats: { [folder: string]: number };
  dailyActivity: { date: string; notesModified: number }[];
  growthOverTime: { date: string; totalNotes: number }[];
}

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  serverName: string;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

interface LLMProvider {
  name: string;
  apiKey: string;
  model: string;
}