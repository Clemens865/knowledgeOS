import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
  listFiles: (dirPath: string) => ipcRenderer.invoke('file:list', dirPath),
  
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
      'menu:toggleChat'
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
  }
});