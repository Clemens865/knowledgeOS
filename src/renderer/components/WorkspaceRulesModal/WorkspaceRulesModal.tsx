import React, { useState, useEffect } from 'react';
import './WorkspaceRulesModal.css';
import { ConversationMode, DEFAULT_MODES } from '../../../core/ConversationModes';

interface WorkspaceRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode?: ConversationMode;
  modes?: ConversationMode[];
  onModeUpdate?: (mode: ConversationMode) => void;
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
   - APPEND to existing files when adding related information
   - UPDATE sections in existing files when information changes
   - CREATE new markdown files only for completely new topics
   - Never overwrite entire files - always preserve existing content
3. When updating existing files:
   - Add new information under appropriate headings
   - Update outdated information while keeping history
   - Use date stamps for significant updates
4. Organize files into logical folders

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

const WorkspaceRulesModal: React.FC<WorkspaceRulesModalProps> = ({ isOpen, onClose, currentMode, modes, onModeUpdate }) => {
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const activeMode = currentMode || DEFAULT_MODES[0];

  useEffect(() => {
    if (isOpen) {
      loadSystemPrompt();
    }
  }, [isOpen]);

  const loadSystemPrompt = async () => {
    setIsLoading(true);
    try {
      // Load the prompt for the current mode
      if (activeMode) {
        setSystemPrompt(activeMode.systemPrompt);
      } else {
        const prompt = await window.electronAPI.getSystemPrompt();
        setSystemPrompt(prompt || DEFAULT_SYSTEM_PROMPT);
      }
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
      // Ensure the prompt includes necessary tool instructions if not already present
      let finalPrompt = systemPrompt;
      
      // Check if the prompt mentions the file operation tools
      const hasFileOps = 
        finalPrompt.includes('write_file') || 
        finalPrompt.includes('append_file') || 
        finalPrompt.includes('read_file');
      
      if (!hasFileOps) {
        // Add essential tool instructions at the end
        finalPrompt += `\n\nFILE OPERATIONS (Required for saving data):
- Use write_file to create or overwrite files
- Use append_file to add content to existing files
- Use read_file to retrieve information from files
- Use update_file to modify specific sections
- Always use these tools to manage the knowledge base`;
      }
      
      // Update the mode with the new prompt
      if (onModeUpdate && activeMode) {
        const updatedMode = {
          ...activeMode,
          systemPrompt: finalPrompt
        };
        
        // First update the mode in the parent component
        await onModeUpdate(updatedMode);
        
        // Then set the system prompt in the LLM
        const result = await window.electronAPI.setSystemPrompt(finalPrompt);
        if (!result.success) {
          console.error('Failed to save system prompt:', result.error);
        }
      }
      onClose();
    } catch (error) {
      console.error('Error saving system prompt:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to the default prompt for this mode
    const defaultMode = DEFAULT_MODES.find(m => m.id === activeMode.id);
    if (defaultMode) {
      setSystemPrompt(defaultMode.systemPrompt);
    } else {
      // For custom modes, just use their original prompt
      const originalMode = modes?.find(m => m.id === activeMode.id);
      setSystemPrompt(originalMode ? originalMode.systemPrompt : DEFAULT_SYSTEM_PROMPT);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{activeMode.icon} {activeMode.name} - Knowledge Rules</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <p className="modal-description">
            Define how your AI assistant should behave and manage your knowledge base.
            These rules determine how information is extracted and organized.
          </p>
          
          <div className="tool-instructions">
            <p><strong>⚠️ Important:</strong> Your prompt must include these tool commands for file operations to work:</p>
            <ul>
              <li><code>write_file</code> - Creates or overwrites a file</li>
              <li><code>append_file</code> - Adds content to existing file</li>
              <li><code>read_file</code> - Reads file contents</li>
              <li><code>update_file</code> - Updates specific sections</li>
            </ul>
            <p>Example: "Use write_file to save conversations in /notes/ folder"</p>
          </div>
          
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