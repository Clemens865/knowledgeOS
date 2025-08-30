import React, { useState, useEffect } from 'react';
import './ConversationModesModal.css';
import { ConversationMode, DEFAULT_MODES } from '../../../core/ConversationModes';

interface ConversationModesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ConversationModesModal: React.FC<ConversationModesModalProps> = ({ isOpen, onClose }) => {
  const [modes, setModes] = useState<ConversationMode[]>(DEFAULT_MODES);
  const [selectedMode, setSelectedMode] = useState<ConversationMode | null>(null);
  const [editedPrompt, setEditedPrompt] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadSavedModes();
  }, []);

  useEffect(() => {
    if (selectedMode) {
      setEditedPrompt(selectedMode.systemPrompt);
    }
  }, [selectedMode]);

  const loadSavedModes = async () => {
    try {
      if (window.electronAPI?.getSetting) {
        const savedModes = await window.electronAPI.getSetting('conversationModes');
        if (savedModes) {
          setModes(savedModes);
        } else {
          // Save default modes if none exist
          if (window.electronAPI?.setSetting) {
            await window.electronAPI.setSetting('conversationModes', DEFAULT_MODES);
          }
        }
      }
    } catch (error) {
      console.error('Error loading conversation modes:', error);
    }
  };

  const handleSave = async () => {
    if (!selectedMode) return;
    
    setIsSaving(true);
    try {
      // Update the selected mode's prompt
      const updatedModes = modes.map(mode => 
        mode.id === selectedMode.id 
          ? { ...mode, systemPrompt: editedPrompt }
          : mode
      );
      
      // Save to settings
      if (window.electronAPI?.setSetting) {
        await window.electronAPI.setSetting('conversationModes', updatedModes);
      }
      setModes(updatedModes);
      
      // Update the selected mode
      setSelectedMode({ ...selectedMode, systemPrompt: editedPrompt });
      
      // Show success feedback
      alert('Conversation mode saved successfully!');
    } catch (error) {
      console.error('Error saving conversation mode:', error);
      alert('Failed to save conversation mode');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddMode = () => {
    const name = prompt('Enter name for new mode:');
    if (!name) return;
    
    const description = prompt('Enter description:');
    if (!description) return;
    
    const icon = prompt('Enter an emoji icon:') || '💬';
    
    const newMode: ConversationMode = {
      id: `custom-${Date.now()}`,
      name,
      icon,
      description,
      systemPrompt: 'You are a helpful assistant. [Edit this prompt to define the behavior]',
      allowFileUpload: false
    };
    
    const updatedModes = [...modes, newMode];
    setModes(updatedModes);
    if (window.electronAPI?.setSetting) {
      window.electronAPI.setSetting('conversationModes', updatedModes);
    }
    setSelectedMode(newMode);
  };

  const handleDeleteMode = async (modeId: string) => {
    // Prevent deletion of default modes
    if (DEFAULT_MODES.find(m => m.id === modeId)) {
      alert('Cannot delete default modes');
      return;
    }
    
    if (confirm('Are you sure you want to delete this mode?')) {
      const updatedModes = modes.filter(m => m.id !== modeId);
      setModes(updatedModes);
      if (window.electronAPI?.setSetting) {
        await window.electronAPI.setSetting('conversationModes', updatedModes);
      }
      
      if (selectedMode?.id === modeId) {
        setSelectedMode(null);
        setEditedPrompt('');
      }
    }
  };

  const handleReset = () => {
    if (selectedMode && confirm('Reset this mode to default settings?')) {
      const defaultMode = DEFAULT_MODES.find(m => m.id === selectedMode.id);
      if (defaultMode) {
        setEditedPrompt(defaultMode.systemPrompt);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="conversation-modes-modal">
        <div className="modal-header">
          <h2>Conversation Modes</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <div className="modes-sidebar">
            <div className="modes-list">
              {modes.map(mode => (
                <div
                  key={mode.id}
                  className={`mode-item ${selectedMode?.id === mode.id ? 'selected' : ''}`}
                  onClick={() => setSelectedMode(mode)}
                >
                  <span className="mode-item-icon">{mode.icon}</span>
                  <div className="mode-item-info">
                    <div className="mode-item-name">{mode.name}</div>
                    <div className="mode-item-desc">{mode.description}</div>
                  </div>
                  {!DEFAULT_MODES.find(m => m.id === mode.id) && (
                    <button 
                      className="delete-mode-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteMode(mode.id);
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="add-mode-btn" onClick={handleAddMode}>
              + Add Custom Mode
            </button>
          </div>
          
          <div className="mode-editor">
            {selectedMode ? (
              <>
                <div className="editor-header">
                  <h3>{selectedMode.icon} {selectedMode.name}</h3>
                  <p className="editor-description">{selectedMode.description}</p>
                </div>
                
                <div className="editor-content">
                  <label className="editor-label">System Prompt (Knowledge Rules)</label>
                  <textarea
                    className="prompt-editor"
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    placeholder="Enter the system prompt for this mode..."
                    spellCheck={false}
                  />
                  
                  <div className="editor-info">
                    <p>💡 Tips for writing prompts:</p>
                    <ul>
                      <li>Be specific about the assistant's role and behavior</li>
                      <li>Define how it should handle file operations</li>
                      <li>Specify the conversation style and tone</li>
                      <li>Include any special instructions or rules</li>
                    </ul>
                  </div>
                </div>
                
                <div className="editor-actions">
                  <button 
                    className="reset-btn"
                    onClick={handleReset}
                    disabled={DEFAULT_MODES.find(m => m.id === selectedMode.id) === undefined}
                  >
                    Reset to Default
                  </button>
                  <button 
                    className="save-btn"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </>
            ) : (
              <div className="no-selection">
                <p>Select a mode from the left to edit its settings</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConversationModesModal;