import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  
  // Dialog operations
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  saveFile: (defaultPath?: string) => ipcRenderer.invoke('dialog:saveFile', defaultPath),
  
  // App info
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  
  // Menu events
  onMenuAction: (callback: (action: string) => void) => {
    const channels = [
      'menu:newNote',
      'menu:open',
      'menu:save',
      'menu:saveAs',
      'menu:commandPalette',
      'menu:toggleSidebar',
      'menu:toggleChat',
      'menu:workspaceRules',
      'menu:apiKeys',
      'menu:conversationModes',
      'menu:mcpServers',
      'menu:openProject',
      'menu:newProject',
    ];
    
    channels.forEach(channel => {
      ipcRenderer.on(channel, () => callback(channel.replace('menu:', '')));
    });
  },
  
  // Remove all listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('menu:newNote');
    ipcRenderer.removeAllListeners('menu:open');
    ipcRenderer.removeAllListeners('menu:save');
    ipcRenderer.removeAllListeners('menu:saveAs');
    ipcRenderer.removeAllListeners('menu:commandPalette');
    ipcRenderer.removeAllListeners('menu:toggleSidebar');
    ipcRenderer.removeAllListeners('menu:toggleChat');
    ipcRenderer.removeAllListeners('menu:workspaceRules');
    ipcRenderer.removeAllListeners('menu:apiKeys');
    ipcRenderer.removeAllListeners('menu:conversationModes');
    ipcRenderer.removeAllListeners('menu:mcpServers');
    ipcRenderer.removeAllListeners('menu:openProject');
    ipcRenderer.removeAllListeners('menu:newProject');
  },
  
  // Settings API
  getSetting: (key: string) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  
  // Workspace API
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  createWorkspace: (path: string) => ipcRenderer.invoke('workspace:create', path),
  openWorkspace: (path: string) => ipcRenderer.invoke('workspace:open', path),
  getRecentWorkspaces: () => ipcRenderer.invoke('workspace:getRecent'),
  getCurrentWorkspace: () => ipcRenderer.invoke('workspace:getCurrent'),
  listFiles: (folderPath: string) => ipcRenderer.invoke('workspace:listFiles', folderPath),
  createNote: (folderPath: string, fileName: string) => ipcRenderer.invoke('workspace:createNote', folderPath, fileName),
  
  // LLM API
  initializeLLM: (provider: any, workspacePath: string) => ipcRenderer.invoke('llm:initialize', provider, workspacePath),
  sendMessageToLLM: (message: string | any, history: any[], context?: any) => ipcRenderer.invoke('llm:sendMessage', message, history, context),
  setSystemPrompt: (prompt: string) => ipcRenderer.invoke('llm:setSystemPrompt', prompt),
  getSystemPrompt: () => ipcRenderer.invoke('llm:getSystemPrompt'),
  saveApiKey: (provider: string, apiKey: string) => ipcRenderer.invoke('llm:saveApiKey', provider, apiKey),
  getApiKey: (provider: string) => ipcRenderer.invoke('llm:getApiKey', provider),
  getLLMProviders: () => ipcRenderer.invoke('llm:getProviders'),
  
  // MCP API
  mcp: {
    getServers: () => ipcRenderer.invoke('mcp:getServers'),
    addServer: (server: any) => ipcRenderer.invoke('mcp:addServer', server),
    removeServer: (name: string) => ipcRenderer.invoke('mcp:removeServer', name),
    getTools: () => ipcRenderer.invoke('mcp:getTools'),
    executeTool: (toolName: string, args: any) => ipcRenderer.invoke('mcp:executeTool', toolName, args),
    testConnection: (server: any) => ipcRenderer.invoke('mcp:testConnection', server)
  },
  
  // Analytics API
  analytics: {
    getStats: (workspacePath: string) => ipcRenderer.invoke('analytics:getStats', workspacePath)
  },
  
  // Conversation Modes API
  conversationModes: {
    getAll: () => ipcRenderer.invoke('modes:getAll'),
    create: (mode: any) => ipcRenderer.invoke('modes:create', mode),
    update: (mode: any) => ipcRenderer.invoke('modes:update', mode),
    delete: (modeId: string) => ipcRenderer.invoke('modes:delete', modeId),
    reset: () => ipcRenderer.invoke('modes:reset'),
    export: () => ipcRenderer.invoke('modes:export'),
    import: (modes: any[]) => ipcRenderer.invoke('modes:import', modes),
    getDefaultRules: () => ipcRenderer.invoke('modes:getDefaultRules')
  },
  
  // Knowledge Graph API
  knowledgeGraph: {
    buildGraph: (workspacePath: string) => ipcRenderer.invoke('knowledgeGraph:build', workspacePath),
    getNodeDetails: (workspacePath: string, nodeId: string) => ipcRenderer.invoke('knowledgeGraph:getNodeDetails', workspacePath, nodeId)
  }
});