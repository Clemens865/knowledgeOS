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
  sendMessageToLLM: (message: string, history: any[], context?: any) => Promise<{
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