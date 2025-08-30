import React, { useState, useEffect } from 'react';
import './MCPServersModal.css';

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

interface MCPServersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MCPServersModal: React.FC<MCPServersModalProps> = ({ isOpen, onClose }) => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [testResult, setTestResult] = useState<{ server: string; success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadServers();
    }
  }, [isOpen]);

  const loadServers = async () => {
    try {
      const result = await window.electronAPI.mcp.getServers();
      setServers(result);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    }
  };

  const handleAddServer = () => {
    const newServer: MCPServer = {
      name: 'New Server',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-example'],
      enabled: false
    };
    setSelectedServer(newServer);
    setIsEditing(true);
  };

  const handleSaveServer = async () => {
    if (!selectedServer) return;

    try {
      await window.electronAPI.mcp.addServer(selectedServer);
      await loadServers();
      setSelectedServer(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save server:', error);
    }
  };

  const handleDeleteServer = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;

    try {
      await window.electronAPI.mcp.removeServer(name);
      await loadServers();
      if (selectedServer?.name === name) {
        setSelectedServer(null);
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Failed to delete server:', error);
    }
  };

  const handleTestConnection = async (server: MCPServer) => {
    setTestResult(null);
    
    try {
      const result = await window.electronAPI.mcp.testConnection(server);
      setTestResult({
        server: server.name,
        success: result.success,
        message: result.success ? 'Connection successful!' : result.error || 'Connection failed'
      });
    } catch (error) {
      setTestResult({
        server: server.name,
        success: false,
        message: error instanceof Error ? error.message : 'Test failed'
      });
    }
  };


  const handleArgsChange = (value: string) => {
    if (!selectedServer) return;
    
    // Parse args string into array (simple space splitting, could be enhanced)
    const args = value.split(' ').filter(arg => arg.length > 0);
    setSelectedServer({ ...selectedServer, args });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mcp-modal-container">
        <div className="modal-header">
          <h2>MCP Server Configuration</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="mcp-modal-content">
          <div className="mcp-servers-list">
            <div className="mcp-list-header">
              <h3>Available Servers</h3>
              <button className="btn-add-server" onClick={handleAddServer}>
                + Add Server
              </button>
            </div>
            
            <div className="mcp-servers">
              {servers.map((server) => (
                <div 
                  key={server.name} 
                  className={`mcp-server-item ${selectedServer?.name === server.name ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedServer(server);
                    setIsEditing(false);
                  }}
                >
                  <div className="mcp-server-info">
                    <span className="mcp-server-name">{server.name}</span>
                    <span className={`mcp-server-status ${server.enabled ? 'enabled' : 'disabled'}`}>
                      {server.enabled ? '🟢 Enabled' : '⚪ Disabled'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mcp-server-details">
            {selectedServer ? (
              <>
                <div className="mcp-detail-header">
                  <h3>{isEditing ? 'Edit Server' : 'Server Details'}</h3>
                  <div className="mcp-detail-actions">
                    {!isEditing && (
                      <>
                        <button className="btn-secondary" onClick={() => setIsEditing(true)}>
                          Edit
                        </button>
                        <button className="btn-secondary" onClick={() => handleTestConnection(selectedServer)}>
                          Test
                        </button>
                        <button 
                          className="btn-danger" 
                          onClick={() => handleDeleteServer(selectedServer.name)}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mcp-form">
                  <div className="mcp-form-group">
                    <label>Server Name</label>
                    <input
                      type="text"
                      value={selectedServer.name}
                      onChange={(e) => setSelectedServer({ ...selectedServer, name: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>

                  <div className="mcp-form-group">
                    <label>Command</label>
                    <input
                      type="text"
                      value={selectedServer.command}
                      onChange={(e) => setSelectedServer({ ...selectedServer, command: e.target.value })}
                      disabled={!isEditing}
                      placeholder="e.g., npx, node, python"
                    />
                  </div>

                  <div className="mcp-form-group">
                    <label>Arguments</label>
                    <input
                      type="text"
                      value={selectedServer.args.join(' ')}
                      onChange={(e) => handleArgsChange(e.target.value)}
                      disabled={!isEditing}
                      placeholder="e.g., -y @modelcontextprotocol/server-example"
                    />
                  </div>

                  <div className="mcp-form-group">
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedServer.enabled}
                        onChange={(e) => setSelectedServer({ ...selectedServer, enabled: e.target.checked })}
                        disabled={!isEditing}
                      />
                      Enable this server
                    </label>
                  </div>

                  {isEditing && (
                    <div className="mcp-form-actions">
                      <button className="btn-primary" onClick={handleSaveServer}>
                        Save
                      </button>
                      <button 
                        className="btn-cancel" 
                        onClick={() => {
                          setSelectedServer(null);
                          setIsEditing(false);
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {testResult && testResult.server === selectedServer.name && (
                    <div className={`mcp-test-result ${testResult.success ? 'success' : 'error'}`}>
                      {testResult.message}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="mcp-empty-state">
                <p>Select a server to view details or add a new server to get started.</p>
                
                <div className="mcp-examples">
                  <h4>Popular MCP Servers:</h4>
                  <ul>
                    <li><strong>Filesystem:</strong> Access and manage files</li>
                    <li><strong>PostgreSQL:</strong> Connect to databases</li>
                    <li><strong>Web Browser:</strong> Browse and interact with websites</li>
                    <li><strong>GitHub:</strong> Manage repositories and issues</li>
                    <li><strong>Slack:</strong> Send messages and read channels</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <div className="mcp-tools-info">
            {servers.filter(s => s.enabled).length} servers enabled
          </div>
          <button className="btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};