import React, { useState, useEffect, useRef } from 'react';
import Editor from './components/Editor/Editor';
import Sidebar from './components/Sidebar/Sidebar';
import Chat from './components/Chat/Chat';
import CommandPalette from './components/CommandPalette/CommandPalette';
import { KnowledgeEngine } from '../core/KnowledgeEngine';
import { PluginAPIImpl } from './services/PluginAPIImpl';
import { BasicPatternPlugin } from '../plugins/basic/BasicPatternPlugin';
import { WikiLinksPlugin } from '../plugins/basic/WikiLinksPlugin';
import './styles/app-full.css';

// TypeScript declaration for the Electron API
declare global {
  interface Window {
    electronAPI: {
      readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      listFiles: (dirPath: string) => Promise<{ success: boolean; files?: any[]; error?: string }>;
      openFile: () => Promise<{ success: boolean; filePath?: string }>;
      openDirectory: () => Promise<{ success: boolean; dirPath?: string }>;
      saveFile: (defaultPath?: string) => Promise<{ success: boolean; filePath?: string }>;
      getVersion: () => Promise<string>;
      getPath: (name: string) => Promise<string>;
      onMenuAction: (callback: (action: string) => void) => void;
      removeAllListeners: () => void;
      // Settings API (optional - may not be used in all components)
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
      createNote: (folderPath: string, fileName: string) => Promise<{ 
        success: boolean; 
        path?: string; 
        error?: string; 
        exists?: boolean 
      }>;
    };
  }
}

interface AppSettings {
  theme: 'light' | 'dark';
  backgroundImage?: string;
  backgroundOpacity: number;
  backgroundBlur: number;
}

function AppFull() {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('# Welcome to KnowledgeOS\n\nYour intelligent knowledge management system.');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    backgroundOpacity: 0.3,
    backgroundBlur: 0
  });
  
  const knowledgeEngineRef = useRef<KnowledgeEngine | null>(null);
  const pluginAPIRef = useRef<PluginAPIImpl | null>(null);
  const editorRef = useRef<any>(null);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const loadSettings = async () => {
    try {
      if (window.electronAPI.getSetting) {
        const savedSettings = await window.electronAPI.getSetting('appSettings');
        if (savedSettings) {
          setSettings(savedSettings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      if (window.electronAPI.setSetting) {
        await window.electronAPI.setSetting('appSettings', newSettings);
      }
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleFileSelect = async (filePath: string) => {
    const result = await window.electronAPI.readFile(filePath);
    if (result.success && result.content) {
      setActiveFile(filePath);
      setFileContent(result.content);
    }
  };

  // Initialize Knowledge Engine
  useEffect(() => {
    const initializeEngine = async () => {
      const api = new PluginAPIImpl();
      pluginAPIRef.current = api;
      
      api.setFileContentSetter(setFileContent);
      api.setFileOpener(handleFileSelect);
      
      const engine = new KnowledgeEngine(api);
      knowledgeEngineRef.current = engine;
      
      try {
        await engine.use(new BasicPatternPlugin(api));
        await engine.use(new WikiLinksPlugin(api));
        console.log('Knowledge Engine initialized with plugins');
      } catch (error) {
        console.error('Error loading plugins:', error);
      }
    };
    
    initializeEngine();
  }, []);

  // Listen for menu actions
  useEffect(() => {
    window.electronAPI.onMenuAction((action) => {
      switch (action) {
        case 'newNote':
          handleNewNote();
          break;
        case 'open':
          handleOpenFile();
          break;
        case 'save':
          handleSaveFile();
          break;
        case 'saveAs':
          handleSaveFileAs();
          break;
        case 'commandPalette':
          setIsCommandPaletteOpen(true);
          break;
        case 'toggleSidebar':
          setIsSidebarOpen(prev => !prev);
          break;
        case 'toggleChat':
          setIsChatOpen(prev => !prev);
          break;
      }
    });

    return () => {
      window.electronAPI.removeAllListeners();
    };
  }, [activeFile, fileContent]);

  const handleNewNote = () => {
    setActiveFile(null);
    setFileContent('# New Note\n\n');
  };

  const handleOpenFile = async () => {
    const result = await window.electronAPI.openFile();
    if (result.success && result.filePath) {
      const fileResult = await window.electronAPI.readFile(result.filePath);
      if (fileResult.success && fileResult.content) {
        setActiveFile(result.filePath);
        setFileContent(fileResult.content);
      }
    }
  };

  const handleSaveFile = async () => {
    if (activeFile) {
      await window.electronAPI.writeFile(activeFile, fileContent);
      
      // Process with Knowledge Engine
      if (knowledgeEngineRef.current) {
        try {
          const result = await knowledgeEngineRef.current.process(fileContent, {
            filePath: activeFile,
            fileName: activeFile.split('/').pop(),
            fileContent: fileContent,
            timestamp: new Date()
          });
          
          if (result.operations && result.operations.length > 0) {
            await knowledgeEngineRef.current.executeOperations(result.operations);
            console.log(`Executed ${result.operations.length} operations from plugins`);
          }
        } catch (error) {
          console.error('Error processing with Knowledge Engine:', error);
        }
      }
      
      if (pluginAPIRef.current) {
        pluginAPIRef.current.emitFileSaved(activeFile);
      }
    } else {
      handleSaveFileAs();
    }
  };

  const handleSaveFileAs = async () => {
    const result = await window.electronAPI.saveFile(activeFile || 'untitled.md');
    if (result.success && result.filePath) {
      await window.electronAPI.writeFile(result.filePath, fileContent);
      setActiveFile(result.filePath);
    }
  };

  const handleBackgroundImageUpload = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageData = event.target?.result as string;
          await saveSettings({ ...settings, backgroundImage: imageData });
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <div className="app-full">
      {/* Background Image */}
      {settings.backgroundImage && (
        <div className="background-container">
          <img 
            src={settings.backgroundImage} 
            alt="Background" 
            className="background-image"
            style={{
              opacity: settings.backgroundOpacity,
              filter: `blur(${settings.backgroundBlur}px)`
            }}
          />
          <div className="background-overlay" />
        </div>
      )}

      {/* Theme Switcher */}
      <div className="theme-switcher">
        <button 
          className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
          onClick={() => saveSettings({ ...settings, theme: 'light' })}
        >
          Light
        </button>
        <button 
          className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
          onClick={() => saveSettings({ ...settings, theme: 'dark' })}
        >
          Dark
        </button>
      </div>

      {/* Main App Container */}
      <div className="app-container">
        {/* Main Content */}
        <div className="main-content">
          <Editor 
            content={fileContent}
            onChange={setFileContent}
            fileName={activeFile ? activeFile.split('/').pop() : 'Untitled'}
            onEditorMount={(editor: any) => {
              editorRef.current = editor;
              if (pluginAPIRef.current) {
                pluginAPIRef.current.setEditorInstance(editor);
              }
            }}
          />
        </div>

        {/* Right Sidebar */}
        <div className={`sidebar ${isSidebarOpen ? 'expanded' : ''}`}>
          <div className="sidebar-content">
            <Sidebar 
              onFileSelect={handleFileSelect}
              activeFile={activeFile}
            />
            
            {/* Settings Section */}
            <div className="settings-section">
              <h3>Settings</h3>
              <div className="setting-item">
                <label>Background Image</label>
                <button onClick={handleBackgroundImageUpload} className="upload-btn">
                  Upload Image
                </button>
              </div>
              <div className="setting-item">
                <label>Background Opacity</label>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1"
                  value={settings.backgroundOpacity}
                  onChange={(e) => saveSettings({ ...settings, backgroundOpacity: parseFloat(e.target.value) })}
                />
              </div>
              <div className="setting-item">
                <label>Background Blur</label>
                <input 
                  type="range" 
                  min="0" 
                  max="20" 
                  step="1"
                  value={settings.backgroundBlur}
                  onChange={(e) => saveSettings({ ...settings, backgroundBlur: parseInt(e.target.value) })}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Menu Toggle Button */}
        <button 
          className="menu-toggle"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {isSidebarOpen ? (
              <path d="M9 18l6-6-6-6" />
            ) : (
              <path d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      {/* Chat Panel */}
      {isChatOpen && (
        <Chat onClose={() => setIsChatOpen(false)} />
      )}

      {/* Command Palette */}
      {isCommandPaletteOpen && (
        <CommandPalette onClose={() => setIsCommandPaletteOpen(false)} />
      )}
    </div>
  );
}

export default AppFull;