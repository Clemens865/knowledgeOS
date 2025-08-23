import React, { useState } from 'react';
import Editor from './components/Editor/Editor';
import Sidebar from './components/Sidebar/Sidebar';

function AppSimple() {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('# Welcome to KnowledgeOS\n\nYour intelligent knowledge management system.');
  const [isSidebarOpen] = useState(true);

  console.log('AppSimple rendering...');

  const handleFileSelect = async (filePath: string) => {
    console.log('File selected:', filePath);
    setActiveFile(filePath);
    // For now, just set some test content
    setFileContent(`# File: ${filePath}\n\nContent would be loaded here...`);
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
    </div>
  );
}

export default AppSimple;