import { BrowserWindow, screen } from 'electron';
import * as path from 'path';

export function createWindow(): BrowserWindow {
  // Get primary display dimensions
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // Use PNG for all platforms as it's most compatible
  const iconPath = path.resolve(process.cwd(), 'assets/icons/icon.png');

  // Create the browser window
  const mainWindow = new BrowserWindow({
    width: Math.min(1400, width * 0.9),
    height: Math.min(900, height * 0.9),
    minWidth: 800,
    minHeight: 600,
    title: 'KnowledgeOS',
    icon: iconPath, // Set the app icon
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 20, y: 20 },
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    show: false, // Don't show until ready
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Optimize for performance
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.setZoomFactor(1.0);
  });

  return mainWindow;
}