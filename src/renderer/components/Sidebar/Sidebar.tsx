import React, { useState, useEffect } from 'react';
import FileTree from '../FileTree/FileTree';
import './Sidebar.css';

interface SidebarProps {
  onFileSelect: (filePath: string) => void;
  activeFile: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ onFileSelect, activeFile }) => {
  const [activeTab, setActiveTab] = useState<'files' | 'search' | 'graph'>('files');
  const [currentPath, setCurrentPath] = useState<string>('');

  useEffect(() => {
    // Get default documents path
    const getDefaultPath = async () => {
      const documentsPath = await window.electronAPI.getPath('documents');
      const knowledgeOSPath = `${documentsPath}/KnowledgeOS`;
      setCurrentPath(knowledgeOSPath);
    };
    getDefaultPath();
  }, []);

  const handleOpenFolder = async () => {
    const result = await window.electronAPI.openDirectory();
    if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
      setCurrentPath(result.filePaths[0]);
    }
  };

  return (
    <div className="sidebar glass-morphism">
      <div className="sidebar-header">
        <h2 className="sidebar-title">KnowledgeOS</h2>
        <button className="sidebar-action" onClick={handleOpenFolder} title="Open Folder">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 3.5A1.5 1.5 0 012.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5H2.5A1.5 1.5 0 011 12.5v-9z"/>
          </svg>
        </button>
      </div>
      
      <div className="sidebar-tabs">
        <button 
          className={`sidebar-tab ${activeTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveTab('files')}
        >
          Files
        </button>
        <button 
          className={`sidebar-tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button 
          className={`sidebar-tab ${activeTab === 'graph' ? 'active' : ''}`}
          onClick={() => setActiveTab('graph')}
        >
          Graph
        </button>
      </div>
      
      <div className="sidebar-content">
        {activeTab === 'files' && currentPath && (
          <FileTree 
            rootPath={currentPath}
            onFileSelect={onFileSelect}
            activeFile={activeFile}
          />
        )}
        
        {activeTab === 'search' && (
          <div className="sidebar-panel">
            <input 
              type="text" 
              className="search-input glass-morphism"
              placeholder="Search notes..."
            />
            <div className="search-results">
              <p className="empty-state">Enter a search term to find notes</p>
            </div>
          </div>
        )}
        
        {activeTab === 'graph' && (
          <div className="sidebar-panel">
            <p className="empty-state">Knowledge graph visualization coming soon</p>
          </div>
        )}
      </div>
      
      <div className="sidebar-footer glass-morphism">
        <button className="sidebar-footer-btn" title="Settings">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z"/>
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.42 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.42-1.184-1.185l.159-.291A1.873 1.873 0 001.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 003.06 4.377l-.16-.292c-.415-.764.42-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.115l.094-.319z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;