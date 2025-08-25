import React, { useState, useEffect } from 'react';
import './WorkspaceRulesModal.css';

interface WorkspaceRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_SYSTEM_PROMPT = `You are an intelligent knowledge management assistant for KnowledgeOS. Your primary role is to help users organize and extract knowledge from their conversations.

CORE BEHAVIOR:
- Automatically extract important information from conversations
- Create and update markdown files in the workspace
- Organize knowledge into appropriate folders
- Never explicitly mention file operations to the user
- Respond naturally and conversationally

FILE MANAGEMENT RULES:
After every conversation, you should:
1. Extract key information that should be remembered
2. Determine the best storage method:
   - Update existing files if the information relates to existing topics
   - Create new markdown files for new topics
   - Organize files into logical folders

FOLDER STRUCTURE:
- /notes/ - General notes and ideas
- /daily/ - Daily notes and journal entries  
- /projects/ - Project-related information
- /references/ - External references and resources
- /attachments/ - Files and media

KNOWLEDGE EXTRACTION:
Focus on extracting:
- Important facts and information
- Decisions and conclusions
- Ideas and insights
- Tasks and action items
- Questions for future exploration
- Relationships between concepts

RESPONSE STYLE:
- Be helpful and conversational
- Ask clarifying questions when needed
- Provide context from existing knowledge when relevant
- Focus on understanding and organizing information`;

const WorkspaceRulesModal: React.FC<WorkspaceRulesModalProps> = ({ isOpen, onClose }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSystemPrompt();
    }
  }, [isOpen]);

  const loadSystemPrompt = async () => {
    setIsLoading(true);
    try {
      const prompt = await window.electronAPI.getSystemPrompt();
      setSystemPrompt(prompt || DEFAULT_SYSTEM_PROMPT);
    } catch (error) {
      console.error('Error loading system prompt:', error);
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await window.electronAPI.setSystemPrompt(systemPrompt);
      if (result.success) {
        onClose();
      } else {
        console.error('Failed to save system prompt:', result.error);
      }
    } catch (error) {
      console.error('Error saving system prompt:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Workspace Rules</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <p className="modal-description">
            Define how your AI assistant should behave and manage your knowledge base.
            These rules determine how information is extracted and organized.
          </p>
          
          {isLoading ? (
            <div className="loading-placeholder">Loading...</div>
          ) : (
            <textarea
              className="system-prompt-editor"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter your workspace rules..."
              spellCheck={false}
            />
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn-secondary"
            onClick={handleReset}
            disabled={isSaving}
          >
            Reset to Default
          </button>
          <div className="modal-actions">
            <button 
              className="btn-cancel"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button 
              className="btn-primary"
              onClick={handleSave}
              disabled={isSaving || isLoading}
            >
              {isSaving ? 'Saving...' : 'Save Rules'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceRulesModal;