import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { createWindow } from './window';
import { setupIPC } from './ipc';
import { createMenu } from './menu';

let mainWindow: BrowserWindow | null = null;

const createMainWindow = () => {
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
  createMainWindow();
  setupIPC();
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

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});