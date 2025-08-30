import React, { useState, useEffect } from 'react';
import './ConversationModesModal.css';

interface ConversationMode {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  allowFileUpload?: boolean;
  supportedFileTypes?: string[];
  isCustom?: boolean;
  includeDefaultRules?: boolean;
}

interface ConversationModesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode?: ConversationMode;
  onModeSelect?: (mode: ConversationMode) => void;
}

const ConversationModesModal: React.FC<ConversationModesModalProps> = ({ 
  isOpen, 
  onClose, 
  currentMode,
  onModeSelect 
}) => {
  const [modes, setModes] = useState<ConversationMode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingMode, setEditingMode] = useState<ConversationMode | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Form states for create/edit
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    icon: '🎯',
    description: '',
    systemPrompt: '',
    allowFileUpload: false,
    supportedFileTypes: [] as string[],
    includeDefaultRules: false
  });
  const [defaultRules, setDefaultRules] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      loadModes();
      loadDefaultRules();
    }
  }, [isOpen]);

  const loadDefaultRules = async () => {
    try {
      const result = await window.electronAPI.conversationModes.getDefaultRules();
      if (result.success && result.rules) {
        setDefaultRules(result.rules);
      }
    } catch (error) {
      console.error('Error loading default rules:', error);
    }
  };

  const loadModes = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.conversationModes.getAll();
      if (result.success && result.modes) {
        // Mark custom modes
        const markedModes = result.modes.map(mode => ({
          ...mode,
          isCustom: !['standard', 'learning', 'document-analysis', 'research'].includes(mode.id)
        }));
        setModes(markedModes);
      }
    } catch (error) {
      console.error('Error loading conversation modes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMode = () => {
    setFormData({
      id: '',
      name: '',
      icon: '🎯',
      description: '',
      systemPrompt: '',
      allowFileUpload: false,
      supportedFileTypes: [],
      includeDefaultRules: false
    });
    setEditingMode(null);
    setShowCreateDialog(true);
  };

  const handleEditMode = (mode: ConversationMode) => {
    setFormData({
      id: mode.id,
      name: mode.name,
      icon: mode.icon,
      description: mode.description,
      systemPrompt: mode.systemPrompt,
      allowFileUpload: mode.allowFileUpload || false,
      supportedFileTypes: mode.supportedFileTypes || [],
      includeDefaultRules: mode.includeDefaultRules || false
    });
    setEditingMode(mode);
    setShowCreateDialog(true);
  };

  const handleSaveMode = async () => {
    try {
      let finalSystemPrompt = formData.systemPrompt;
      
      // If includeDefaultRules is true, prepend the default rules to the system prompt
      if (formData.includeDefaultRules && defaultRules) {
        finalSystemPrompt = defaultRules + '\n\n---\n\nADDITIONAL MODE-SPECIFIC INSTRUCTIONS:\n\n' + formData.systemPrompt;
      }
      
      const mode: ConversationMode = {
        ...formData,
        systemPrompt: finalSystemPrompt,
        id: formData.id || formData.name.toLowerCase().replace(/\s+/g, '-')
      };

      let result;
      if (editingMode) {
        result = await window.electronAPI.conversationModes.update(mode);
      } else {
        result = await window.electronAPI.conversationModes.create(mode);
      }

      if (result.success) {
        await loadModes();
        setShowCreateDialog(false);
        setEditingMode(null);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving mode:', error);
      alert('Failed to save mode');
    }
  };

  const handleDeleteMode = async (modeId: string) => {
    try {
      const result = await window.electronAPI.conversationModes.delete(modeId);
      if (result.success) {
        await loadModes();
        setShowDeleteConfirm(null);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting mode:', error);
      alert('Failed to delete mode');
    }
  };

  const handleSelectMode = (mode: ConversationMode) => {
    if (onModeSelect) {
      onModeSelect(mode);
    }
    onClose();
  };

  const handleExportModes = async () => {
    try {
      const result = await window.electronAPI.conversationModes.export();
      if (result.success && result.modes) {
        const dataStr = JSON.stringify(result.modes, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'conversation-modes.json';
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
      }
    } catch (error) {
      console.error('Error exporting modes:', error);
      alert('Failed to export modes');
    }
  };

  const handleImportModes = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const modes = JSON.parse(text);
      
      const result = await window.electronAPI.conversationModes.import(modes);
      if (result.success) {
        await loadModes();
        alert(`Successfully imported ${result.importedCount} modes`);
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing modes:', error);
      alert('Failed to import modes. Please check the file format.');
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-container conversation-modes-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Conversation Modes</h2>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          
          <div className="modal-content">
            <div className="modes-toolbar">
              <button onClick={handleCreateMode} className="create-mode-btn">
                ➕ Create New Mode
              </button>
              <div className="toolbar-actions">
                <button onClick={handleExportModes} className="export-btn">
                  📤 Export
                </button>
                <label className="import-btn">
                  📥 Import
                  <input 
                    type="file" 
                    accept=".json"
                    onChange={handleImportModes}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>
            </div>

            <p className="modal-description">
              Select a conversation mode to define how the AI assistant behaves and organizes information.
            </p>
            
            {isLoading ? (
              <div className="loading-placeholder">Loading modes...</div>
            ) : (
              <div className="modes-grid">
                {modes.map((mode) => (
                  <div 
                    key={mode.id}
                    className={`mode-card ${currentMode?.id === mode.id ? 'active' : ''}`}
                  >
                    <div className="mode-card-header">
                      <span className="mode-icon">{mode.icon}</span>
                      <h3>{mode.name}</h3>
                      {mode.isCustom && <span className="custom-badge">Custom</span>}
                    </div>
                    <p className="mode-description">{mode.description}</p>
                    {mode.allowFileUpload && (
                      <div className="mode-features">
                        <span className="feature-badge">📎 File Upload</span>
                      </div>
                    )}
                    <div className="mode-actions">
                      <button 
                        onClick={() => handleSelectMode(mode)}
                        className="select-btn"
                      >
                        Select
                      </button>
                      <button 
                        onClick={() => handleEditMode(mode)}
                        className="edit-btn"
                      >
                        ✏️
                      </button>
                      {mode.isCustom && (
                        <button 
                          onClick={() => setShowDeleteConfirm(mode.id)}
                          className="delete-btn"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="modal-footer">
            <button onClick={onClose} className="cancel-button">
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      {showCreateDialog && (
        <div className="modal-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="modal-container mode-editor-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingMode ? 'Edit Mode' : 'Create New Mode'}</h2>
              <button className="modal-close" onClick={() => setShowCreateDialog(false)}>×</button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Personal Assistant"
                />
              </div>

              <div className="form-group">
                <label>Icon (Emoji)</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="e.g., 🎯"
                  maxLength={2}
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of what this mode does"
                />
              </div>

              <div className="form-group">
                <label>System Prompt</label>
                <textarea
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  placeholder="Define the behavior and rules for this mode..."
                  rows={10}
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.allowFileUpload}
                    onChange={(e) => setFormData({ ...formData, allowFileUpload: e.target.checked })}
                  />
                  Allow File Upload
                </label>
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.includeDefaultRules}
                    onChange={(e) => setFormData({ ...formData, includeDefaultRules: e.target.checked })}
                  />
                  Include Default Knowledge Management Rules
                </label>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '26px', marginTop: '5px' }}>
                  Adds file operations (read, write, append) and folder organization rules
                </p>
              </div>

              {formData.allowFileUpload && (
                <div className="form-group">
                  <label>Supported File Types (comma-separated)</label>
                  <input
                    type="text"
                    value={formData.supportedFileTypes.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      supportedFileTypes: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., .pdf, .txt, .md"
                  />
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button onClick={() => setShowCreateDialog(false)} className="cancel-button">
                Cancel
              </button>
              <button 
                onClick={handleSaveMode} 
                className="save-button"
                disabled={!formData.name || !formData.systemPrompt}
              >
                {editingMode ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
          <div className="modal-container delete-confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Confirm Delete</h2>
            </div>
            <div className="modal-content">
              <p>Are you sure you want to delete this conversation mode?</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowDeleteConfirm(null)} className="cancel-button">
                Cancel
              </button>
              <button 
                onClick={() => handleDeleteMode(showDeleteConfirm)} 
                className="delete-confirm-btn"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ConversationModesModal;