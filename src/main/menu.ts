import { Menu, shell, BrowserWindow } from 'electron';

export function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    // App Menu (macOS only)
    ...(isMac ? [{
      label: 'KnowledgeOS',
      submenu: [
        { role: 'about' as const, label: 'About KnowledgeOS' },
        { type: 'separator' as const },
        { role: 'services' as const, submenu: [] },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const }
      ]
    }] : []),

    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:openProject');
          }
        },
        {
          label: 'New Project...',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:newProject');
          }
        },
        {
          label: 'Recent Projects',
          submenu: [],
          id: 'recentProjects'
        },
        { type: 'separator' },
        {
          label: 'New Note',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:newNote');
          }
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:open');
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:save');
          }
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:saveAs');
          }
        },
        { type: 'separator' },
        {
          label: 'KnowledgeOS Rules...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:workspaceRules');
          }
        },
        {
          label: 'API Keys...',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:apiKeys');
          }
        },
        {
          label: 'Conversation Modes...',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:conversationModes');
          }
        },
        {
          label: 'MCP Servers...',
          accelerator: 'CmdOrCtrl+Shift+M',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:mcpServers');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },

    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' as const },
          { role: 'delete' as const },
          { role: 'selectAll' as const },
          { type: 'separator' as const },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' as const },
              { role: 'stopSpeaking' as const }
            ]
          }
        ] : [
          { role: 'delete' as const },
          { type: 'separator' as const },
          { role: 'selectAll' as const }
        ])
      ]
    },

    // View Menu
    {
      label: 'View',
      submenu: [
        {
          label: 'Command Palette',
          accelerator: 'CmdOrCtrl+K',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:commandPalette');
          }
        },
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:toggleSidebar');
          }
        },
        {
          label: 'Toggle AI Chat',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:toggleChat');
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },

    // Tools Menu
    {
      label: 'Tools',
      submenu: [
        {
          label: '🐙 Octopus Mode',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:octopusMode');
          }
        },
        {
          label: '🕷️ Coding Crawler',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => {
            BrowserWindow.getFocusedWindow()?.webContents.send('menu:codingCrawler');
          }
        }
      ]
    },

    // Window Menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        ...(isMac ? [
          { type: 'separator' as const },
          { role: 'front' as const },
          { type: 'separator' as const },
          { role: 'window' as const }
        ] : [])
      ]
    },

    // Help Menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/Clemens865/knowledgeOS');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/Clemens865/knowledgeOS/issues');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}