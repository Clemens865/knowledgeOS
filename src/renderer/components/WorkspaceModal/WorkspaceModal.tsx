import React, { useState, useEffect } from 'react';
import './WorkspaceModal.css';

interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (path: string, name: string) => void;
}

interface RecentWorkspace {
  path: string;
  name: string;
  lastOpened: string;
}

const WorkspaceModal: React.FC<WorkspaceModalProps> = ({ isOpen, onClose, onSelectWorkspace }) => {
  const [recentWorkspaces, setRecentWorkspaces] = useState<RecentWorkspace[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadRecentWorkspaces();
    }
  }, [isOpen]);

  const loadRecentWorkspaces = async () => {
    try {
      const recent = await window.electronAPI.getRecentWorkspaces();
      setRecentWorkspaces(recent || []);
    } catch (error) {
      console.error('Error loading recent workspaces:', error);
    }
  };

  const handleCreateWorkspace = async () => {
    try {
      const result = await window.electronAPI.selectFolder();
      if (!result.canceled && result.filePaths?.[0]) {
        const path = result.filePaths[0];
        const name = path.split('/').pop() || 'Workspace';
        
        // Create workspace structure
        await window.electronAPI.createWorkspace(path);
        
        // Select the new workspace
        onSelectWorkspace(path, name);
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
    }
  };

  const handleOpenWorkspace = async () => {
    try {
      const result = await window.electronAPI.selectFolder();
      if (!result.canceled && result.filePaths?.[0]) {
        const path = result.filePaths[0];
        const name = path.split('/').pop() || 'Workspace';
        onSelectWorkspace(path, name);
      }
    } catch (error) {
      console.error('Error opening workspace:', error);
    }
  };

  const handleSelectRecent = (workspace: RecentWorkspace) => {
    onSelectWorkspace(workspace.path, workspace.name);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Welcome to KnowledgeOS</h2>
          <p>Choose a workspace to store your knowledge</p>
          <button className="modal-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/>
            </svg>
          </button>
        </div>

        <div className="modal-body">
          {/* Quick Actions */}
          <div className="workspace-actions">
            <button className="workspace-action-card" onClick={handleCreateWorkspace}>
              <div className="action-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect x="8" y="8" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M20 16v8m-4-4h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <h3>Create New Workspace</h3>
              <p>Start fresh with a new knowledge base</p>
            </button>

            <button className="workspace-action-card" onClick={handleOpenWorkspace}>
              <div className="action-icon">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <path d="M8 16v12a4 4 0 004 4h16a4 4 0 004-4V16M8 16l4-6h6l2 6m14 0l-2-6h6l4 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <h3>Open Existing Workspace</h3>
              <p>Continue working with your knowledge</p>
            </button>
          </div>

          {/* Recent Workspaces */}
          {recentWorkspaces.length > 0 && (
            <div className="recent-workspaces">
              <h3 className="section-title">Recent Workspaces</h3>
              <div className="recent-list">
                {recentWorkspaces.map((workspace, index) => (
                  <button
                    key={index}
                    className="recent-item"
                    onClick={() => handleSelectRecent(workspace)}
                  >
                    <div className="recent-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                      </svg>
                    </div>
                    <div className="recent-info">
                      <div className="recent-name">{workspace.name}</div>
                      <div className="recent-path">{workspace.path}</div>
                    </div>
                    <div className="recent-date">
                      {new Date(workspace.lastOpened).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Getting Started Tips */}
          <div className="tips-section">
            <h3 className="section-title">Getting Started</h3>
            <div className="tips-grid">
              <div className="tip-card">
                <div className="tip-icon">📝</div>
                <div className="tip-content">
                  <h4>Daily Notes</h4>
                  <p>Capture thoughts quickly with automatic daily notes</p>
                </div>
              </div>
              <div className="tip-card">
                <div className="tip-icon">🔗</div>
                <div className="tip-content">
                  <h4>Link Everything</h4>
                  <p>Use [[wiki links]] to connect your ideas</p>
                </div>
              </div>
              <div className="tip-card">
                <div className="tip-icon">🤖</div>
                <div className="tip-content">
                  <h4>AI Assistant</h4>
                  <p>Get help synthesizing and connecting knowledge</p>
                </div>
              </div>
              <div className="tip-card">
                <div className="tip-icon">🔍</div>
                <div className="tip-content">
                  <h4>Smart Search</h4>
                  <p>Find anything instantly across all your notes</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <p className="footer-text">Your knowledge stays local and private</p>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceModal;