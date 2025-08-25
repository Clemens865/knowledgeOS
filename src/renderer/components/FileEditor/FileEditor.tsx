import React, { useState, useEffect, useRef } from 'react';
import './FileEditor.css';

interface FileTab {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

interface FileEditorProps {
  isOpen: boolean;
  onClose?: () => void;
}

const FileEditor: React.FC<FileEditorProps> = ({ isOpen }) => {
  const [tabs, setTabs] = useState<FileTab[]>([]);
  const [activeTab, setActiveTab] = useState<number>(0);
  const [content, setContent] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Open file in editor
  const openFile = async (filePath: string) => {
    // Check if file is already open
    const existingTabIndex = tabs.findIndex(tab => tab.path === filePath);
    if (existingTabIndex !== -1) {
      setActiveTab(existingTabIndex);
      return;
    }

    try {
      const result = await window.electronAPI.readFile(filePath);
      if (result.success && result.content !== undefined) {
        const fileName = filePath.split('/').pop() || 'untitled';
        const newTab: FileTab = {
          path: filePath,
          name: fileName,
          content: result.content,
          isDirty: false
        };
        
        setTabs([...tabs, newTab]);
        setActiveTab(tabs.length);
        setContent(result.content);
      }
    } catch (error) {
      console.error('Error opening file:', error);
    }
  };

  // Save current file
  const saveFile = async () => {
    if (activeTab < 0 || activeTab >= tabs.length) return;
    
    const currentTab = tabs[activeTab];
    try {
      const result = await window.electronAPI.writeFile(currentTab.path, content);
      if (result.success) {
        // Update tab to mark as saved
        const updatedTabs = [...tabs];
        updatedTabs[activeTab] = {
          ...currentTab,
          content: content,
          isDirty: false
        };
        setTabs(updatedTabs);
      }
    } catch (error) {
      console.error('Error saving file:', error);
    }
  };

  // Handle content changes
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    
    if (activeTab >= 0 && activeTab < tabs.length) {
      const updatedTabs = [...tabs];
      updatedTabs[activeTab] = {
        ...updatedTabs[activeTab],
        isDirty: updatedTabs[activeTab].content !== newContent
      };
      setTabs(updatedTabs);
    }
  };

  // Close tab
  const closeTab = (index: number) => {
    const newTabs = tabs.filter((_, i) => i !== index);
    setTabs(newTabs);
    
    if (newTabs.length === 0) {
      setContent('');
      setActiveTab(-1);
    } else if (activeTab >= newTabs.length) {
      setActiveTab(newTabs.length - 1);
      setContent(newTabs[newTabs.length - 1].content);
    } else if (index < activeTab) {
      setActiveTab(activeTab - 1);
    } else if (index === activeTab && newTabs.length > 0) {
      const newActiveTab = Math.min(index, newTabs.length - 1);
      setActiveTab(newActiveTab);
      setContent(newTabs[newActiveTab].content);
    }
  };

  // Switch tab
  const switchTab = (index: number) => {
    if (index >= 0 && index < tabs.length) {
      setActiveTab(index);
      setContent(tabs[index].content);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, content, activeTab, tabs]);

  // Listen for file open events
  useEffect(() => {
    const handleFileOpen = (event: CustomEvent) => {
      if (event.detail && event.detail.path) {
        openFile(event.detail.path);
      }
    };

    window.addEventListener('open-file' as any, handleFileOpen);
    
    return () => {
      window.removeEventListener('open-file' as any, handleFileOpen);
    };
  }, [tabs]);

  if (!isOpen || tabs.length === 0) {
    if (!isOpen) return null;
    
    return (
      <div className="file-editor empty">
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No files open</h3>
          <p>Click a file in the sidebar to start editing</p>
        </div>
      </div>
    );
  }

  const currentTab = tabs[activeTab];

  return (
    <div className="file-editor">
      <div className="editor-header">
        <div className="editor-tabs">
          {tabs.map((tab, index) => (
            <div
              key={tab.path}
              className={`editor-tab ${index === activeTab ? 'active' : ''}`}
              onClick={() => switchTab(index)}
            >
              <span className="tab-name">
                {tab.isDirty && <span className="dirty-indicator">•</span>}
                {tab.name}
              </span>
              <button 
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(index);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="editor-actions">
          <button 
            className="editor-action"
            onClick={saveFile}
            title="Save (Cmd+S)"
          >
            💾
          </button>
        </div>
      </div>
      
      <div className="editor-content">
        <div className="line-numbers">
          {content.split('\n').map((_, index) => (
            <div key={index} className="line-number">
              {index + 1}
            </div>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={content}
          onChange={(e) => handleContentChange(e.target.value)}
          spellCheck={false}
          placeholder="Start typing..."
        />
      </div>
      
      <div className="editor-footer">
        <span className="file-path">{currentTab?.path}</span>
        <span className="cursor-position">
          {currentTab?.isDirty ? 'Modified' : 'Saved'}
        </span>
      </div>
    </div>
  );
};

export default FileEditor;