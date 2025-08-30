import React, { useState, useEffect } from 'react';
import './APIKeysModal.css';

interface APIKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const APIKeysModal: React.FC<APIKeysModalProps> = ({ isOpen, onClose }) => {
  const [claudeKey, setClaudeKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadApiKeys();
    }
  }, [isOpen]);

  const loadApiKeys = async () => {
    setIsLoading(true);
    try {
      const claude = await window.electronAPI.getApiKey('Claude');
      const openai = await window.electronAPI.getApiKey('OpenAI');
      const gemini = await window.electronAPI.getApiKey('Gemini');
      
      setClaudeKey(claude || '');
      setOpenaiKey(openai || '');
      setGeminiKey(gemini || '');
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save all API keys
      const results = await Promise.all([
        window.electronAPI.saveApiKey('Claude', claudeKey),
        window.electronAPI.saveApiKey('OpenAI', openaiKey),
        window.electronAPI.saveApiKey('Gemini', geminiKey)
      ]);
      
      if (results.every(r => r.success)) {
        onClose();
      } else {
        console.error('Failed to save some API keys');
      }
    } catch (error) {
      console.error('Error saving API keys:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container api-keys-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>API Keys</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-content">
          <p className="modal-description">
            Configure your API keys for different LLM providers. Your keys are stored securely and never shared.
          </p>
          
          {isLoading ? (
            <div className="loading-placeholder">Loading...</div>
          ) : (
            <div className="api-keys-form">
              <div className="api-key-group">
                <label htmlFor="claude-key">Claude API Key</label>
                <div className="api-key-input-wrapper">
                  <input
                    id="claude-key"
                    type={showClaudeKey ? "text" : "password"}
                    className="api-key-input"
                    value={claudeKey}
                    onChange={(e) => setClaudeKey(e.target.value)}
                    placeholder="sk-ant-..."
                  />
                  <button 
                    className="toggle-visibility"
                    onClick={() => setShowClaudeKey(!showClaudeKey)}
                    type="button"
                  >
                    {showClaudeKey ? '🙈' : '👁'}
                  </button>
                </div>
                <span className="api-key-hint">Get your key from console.anthropic.com</span>
              </div>

              <div className="api-key-group">
                <label htmlFor="openai-key">OpenAI API Key</label>
                <div className="api-key-input-wrapper">
                  <input
                    id="openai-key"
                    type={showOpenaiKey ? "text" : "password"}
                    className="api-key-input"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <button 
                    className="toggle-visibility"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    type="button"
                  >
                    {showOpenaiKey ? '🙈' : '👁'}
                  </button>
                </div>
                <span className="api-key-hint">Get your key from platform.openai.com</span>
              </div>

              <div className="api-key-group">
                <label htmlFor="gemini-key">Gemini API Key</label>
                <div className="api-key-input-wrapper">
                  <input
                    id="gemini-key"
                    type={showGeminiKey ? "text" : "password"}
                    className="api-key-input"
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AI..."
                  />
                  <button 
                    className="toggle-visibility"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    type="button"
                  >
                    {showGeminiKey ? '🙈' : '👁'}
                  </button>
                </div>
                <span className="api-key-hint">Get your key from makersuite.google.com</span>
              </div>
            </div>
          )}
        </div>
        
        <div className="modal-footer">
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
              {isSaving ? 'Saving...' : 'Save Keys'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIKeysModal;