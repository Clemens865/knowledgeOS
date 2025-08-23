import React, { useState, useEffect } from 'react';
import Editor from './components/Editor/Editor';
import Sidebar from './components/Sidebar/Sidebar';
import Chat from './components/Chat/Chat';
import CommandPalette from './components/CommandPalette/CommandPalette';

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

  const handleFileSelect = async (filePath: string) => {
    const result = await window.electronAPI.readFile(filePath);
    if (result.success && result.content) {
      setActiveFile(filePath);
      setFileContent(result.content);
    }
  };

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