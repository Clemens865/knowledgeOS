import React, { useState, useEffect, useRef } from 'react';
import Editor from './components/Editor/Editor';
import Sidebar from './components/Sidebar/Sidebar';
import Chat from './components/Chat/Chat';
import CommandPalette from './components/CommandPalette/CommandPalette';
import { KnowledgeEngine } from '../core/KnowledgeEngine';
import { PluginAPIImpl } from './services/PluginAPIImpl';
import { BasicPatternPlugin } from '../plugins/basic/BasicPatternPlugin';
import { WikiLinksPlugin } from '../plugins/basic/WikiLinksPlugin';

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
    };
  }
}

function App() {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  
  const knowledgeEngineRef = useRef<KnowledgeEngine | null>(null);
  const pluginAPIRef = useRef<PluginAPIImpl | null>(null);
  const editorRef = useRef<any>(null);

  // Move handleFileSelect definition before the useEffect that uses it
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
      // Create Plugin API
      const api = new PluginAPIImpl();
      pluginAPIRef.current = api;
      
      // Set up API callbacks
      api.setFileContentSetter(setFileContent);
      api.setFileOpener(handleFileSelect);
      
      // Create Knowledge Engine
      const engine = new KnowledgeEngine(api);
      knowledgeEngineRef.current = engine;
      
      // Load basic plugins
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

  useEffect(() => {
    // Listen for menu actions
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

    // Cleanup
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
      
      // Process content with Knowledge Engine
      if (knowledgeEngineRef.current) {
        try {
          const result = await knowledgeEngineRef.current.process(fileContent, {
            filePath: activeFile,
            fileName: activeFile.split('/').pop(),
            fileContent: fileContent,
            timestamp: new Date()
          });
          
          // Execute any file operations from plugins
          if (result.operations && result.operations.length > 0) {
            await knowledgeEngineRef.current.executeOperations(result.operations);
            console.log(`Executed ${result.operations.length} operations from plugins`);
          }
          
          // Show suggestions if any
          if (result.suggestions && result.suggestions.length > 0) {
            console.log('Plugin suggestions:', result.suggestions);
          }
        } catch (error) {
          console.error('Error processing with Knowledge Engine:', error);
        }
      }
      
      // Emit file saved event
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

  console.log('App rendering', { isSidebarOpen, isChatOpen, isCommandPaletteOpen, activeFile });

  return (
    <div className="app-container">
      {isSidebarOpen && (
        <Sidebar 
          onFileSelect={handleFileSelect}
          activeFile={activeFile}
        />
      )}
      
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
      
      {isChatOpen && (
        <Chat onClose={() => setIsChatOpen(false)} />
      )}
      
      {isCommandPaletteOpen && (
        <CommandPalette onClose={() => setIsCommandPaletteOpen(false)} />
      )}
    </div>
  );
}

export default App;