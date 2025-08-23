import React, { useState } from 'react';
import Editor from './components/Editor/Editor';
import './styles/app-full.css';

function AppDebug() {
  const [content, setContent] = useState('# Welcome to KnowledgeOS\n\nYour intelligent knowledge management system.');
  
  return (
    <div className="app-full">
      <div className="theme-switcher">
        <button className="theme-btn active">Light</button>
        <button className="theme-btn">Dark</button>
      </div>
      
      <div className="app-container">
        <div className="main-content">
          <div style={{ 
            width: '100%', 
            height: '100%', 
            background: 'rgba(255, 255, 255, 0.9)',
            borderRadius: '12px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.05)' }}>
              <span>Editor Header - Test</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <Editor 
                content={content}
                onChange={setContent}
                fileName="test.md"
              />
            </div>
          </div>
        </div>
        
        <div className="sidebar expanded" style={{ 
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          width: '400px',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          padding: '20px'
        }}>
          <h3>Sidebar Test</h3>
          <p>If you can see this, the layout is working.</p>
        </div>
      </div>
    </div>
  );
}

export default AppDebug;