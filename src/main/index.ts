import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import * as path from 'path';
import { createWindow } from './window';
import { setupIPC } from './ipc';
import { createMenu } from './menu';
import { setupWorkspaceHandlers } from './workspace';
import { setupLLMHandlers } from './llmHandlers';
import { setupAnalyticsHandlers } from './analyticsHandlers';
import { setupConversationModesHandlers } from './conversationModesHandlers';
import { setupKnowledgeGraphHandlers } from './knowledgeGraphHandlers';
import { setupKnowledgeAgentHandlers } from './knowledgeAgentHandlers';
import { setupOctopusHandlers } from './octopusHandlers';
import Store from 'electron-store';
import { initMCPManager, getMCPManager } from './mcpManager';
import { PythonServiceManager } from './services/PythonServiceManager';

// Set the app name before anything else - MUST be done early!
app.setName('KnowledgeOS');

interface StoreSchema {
  appSettings: {
    theme: 'light' | 'dark';
    backgroundImage?: string;
    backgroundOpacity: number;
    backgroundBlur: number;
  };
}

let mainWindow: BrowserWindow | null = null;
let pythonService: PythonServiceManager | null = null;

// Initialize electron-store for settings with proper typing
const store = new Store<StoreSchema>({
  defaults: {
    appSettings: {
      theme: 'light',
      backgroundOpacity: 0.3,
      backgroundBlur: 0
    }
  }
});

// Setup settings IPC handlers
ipcMain.handle('settings:get', (_, key: keyof StoreSchema) => {
  return (store as any).get(key);
});

ipcMain.handle('settings:set', async (_, key: keyof StoreSchema, value: any) => {
  (store as any).set(key, value);
});

const createMainWindow = () => {
  // Set app name right before creating window
  app.setName('KnowledgeOS');
  mainWindow = createWindow();
  
  // Load the app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
};

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  // Ensure app name is set (belt and suspenders approach)
  app.setName('KnowledgeOS');
  
  // Set dock icon for macOS
  if (process.platform === 'darwin' && app.dock) {
    // Try ICNS first, then fallback to PNG
    const icnsPath = path.resolve(process.cwd(), 'assets/icons/icon.icns');
    const pngPath = path.resolve(process.cwd(), 'assets/icons/icon.png');
    
    let iconSet = false;
    
    // Try ICNS format first
    try {
      const icnsIcon = nativeImage.createFromPath(icnsPath);
      if (!icnsIcon.isEmpty()) {
        app.dock.setIcon(icnsIcon);
        console.log('✅ Dock icon set successfully from ICNS!');
        iconSet = true;
      }
    } catch (error) {
      console.warn('Could not load ICNS, trying PNG...');
    }
    
    // Fallback to PNG if ICNS didn't work
    if (!iconSet) {
      try {
        const pngIcon = nativeImage.createFromPath(pngPath);
        if (!pngIcon.isEmpty()) {
          app.dock.setIcon(pngIcon);
          console.log('✅ Dock icon set successfully from PNG!');
        } else {
          console.warn('❌ Could not load icon from PNG either');
        }
      } catch (error) {
        console.error('❌ Error setting dock icon:', error);
      }
    }
  }

  createMainWindow();
  setupIPC();
  setupWorkspaceHandlers();
  setupLLMHandlers();
  setupAnalyticsHandlers();
  setupConversationModesHandlers();
  setupKnowledgeGraphHandlers();
  
  // Setup Octopus Mode (it will get LLM service dynamically)
  setupOctopusHandlers();
  
  // Initialize MCP Manager
  initMCPManager();
  console.log('🔌 MCP Manager initialized');
  
  // Initialize Python Knowledge Service
  // Get the workspace path from store
  const workspaceStore = new Store();
  const workspacePath = (workspaceStore as any).get('currentWorkspace') || process.cwd();
  
  pythonService = new PythonServiceManager(workspacePath);
  console.log('🐍 Starting Python Knowledge Service...');
  pythonService.start().then((success) => {
    if (success && pythonService) {
      console.log('✅ Python Knowledge Service started successfully');
      setupKnowledgeAgentHandlers(pythonService);
    } else {
      console.error('❌ Failed to start Python Knowledge Service');
    }
  });
  
  createMenu();

  app.on('activate', () => {
    // On macOS, re-create a window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up MCP connections and Python service on app quit
app.on('before-quit', async () => {
  const mcpManager = getMCPManager();
  if (mcpManager) {
    await mcpManager.cleanup();
    console.log('🔌 MCP Manager cleaned up');
  }
  
  if (pythonService) {
    pythonService.cleanup();
    console.log('🐍 Python service cleaned up');
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});