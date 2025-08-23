/// <reference path="./global.d.ts" />
import React, { useState, useEffect } from 'react';
import WorkspaceModal from './components/WorkspaceModal/WorkspaceModal';
import FileTree from './components/FileTree/FileTree';
import Conversation from './components/Conversation/Conversation';
import './styles/chat-app.css';

interface AppSettings {
  theme: 'light' | 'dark';
  backgroundImage?: string;
  backgroundOpacity: number;
  backgroundBlur: number;
  overlayOpacity: number;
  voiceInput: boolean;
  hapticFeedback: boolean;
  soundEffects: boolean;
  animationQuality: 'Low' | 'Medium' | 'High' | 'Ultra';
  reduceMotion: boolean;
}

function ChatApp() {
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'light',
    backgroundOpacity: 30,
    backgroundBlur: 0,
    overlayOpacity: 70,
    voiceInput: false,
    hapticFeedback: false,
    soundEffects: false,
    animationQuality: 'High',
    reduceMotion: false
  });
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'settings' | 'tools'>('files');
  const [dynamicStatus, setDynamicStatus] = useState('');
  const [showStatus, setShowStatus] = useState(false);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [currentWorkspace, setCurrentWorkspace] = useState<{ path: string; name: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('Claude');
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-sonnet-20240229');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  // Load settings and workspace on mount
  useEffect(() => {
    loadSettings();
    checkWorkspace();
    loadApiKeys();
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  const loadSettings = async () => {
    try {
      if (window.electronAPI?.getSetting) {
        const savedSettings = await window.electronAPI.getSetting('appSettings');
        if (savedSettings) {
          setSettings(savedSettings);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const checkWorkspace = async () => {
    try {
      if (window.electronAPI?.getCurrentWorkspace) {
        const workspace = await window.electronAPI.getCurrentWorkspace();
        if (workspace) {
          const name = workspace.split('/').pop() || 'Workspace';
          setCurrentWorkspace({ path: workspace, name });
        } else {
          // No workspace, show modal
          setShowWorkspaceModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking workspace:', error);
    }
  };

  const loadApiKeys = async () => {
    try {
      // Check if electronAPI is available
      if (!window.electronAPI || !window.electronAPI.getApiKey) {
        console.error('Electron API not available for getApiKey');
        return;
      }
      
      const providers = ['Claude', 'OpenAI', 'Gemini'];
      const keys: Record<string, string> = {};
      
      for (const provider of providers) {
        try {
          const key = await window.electronAPI.getApiKey(provider);
          if (key) {
            keys[provider] = key;
          }
        } catch (err) {
          console.error(`Error loading API key for ${provider}:`, err);
        }
      }
      
      setApiKeys(keys);
    } catch (error) {
      console.error('Error loading API keys:', error);
    }
  };

  const handleSelectWorkspace = async (path: string, name: string) => {
    setCurrentWorkspace({ path, name });
    setShowWorkspaceModal(false);
    showDynamicStatus(`Workspace opened: ${name}`);
    
    // Save to settings
    if (window.electronAPI?.setSetting) {
      await window.electronAPI.setSetting('currentWorkspace', path);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      if (window.electronAPI?.setSetting) {
        await window.electronAPI.setSetting('appSettings', newSettings);
      }
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const showDynamicStatus = (message: string) => {
    setDynamicStatus(message);
    setShowStatus(true);
    setTimeout(() => setShowStatus(false), 2000);
  };

  const handleThemeChange = (theme: 'light' | 'dark') => {
    saveSettings({ ...settings, theme });
    showDynamicStatus(`${theme.charAt(0).toUpperCase() + theme.slice(1)} Mode`);
  };

  const handleBackgroundImageUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const imageData = event.target?.result as string;
          await saveSettings({ ...settings, backgroundImage: imageData });
          showDynamicStatus('Background Applied');
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  const handleFileSelect = async (filePath: string) => {
    setSelectedFile(filePath);
    showDynamicStatus(`Opened: ${filePath.split('/').pop()}`);
    // TODO: Load file content and display in editor/viewer
  };

  const toggleSwitch = (setting: keyof AppSettings) => {
    const newValue = !settings[setting];
    saveSettings({ ...settings, [setting]: newValue });
    const name = setting.replace(/([A-Z])/g, ' $1').trim();
    showDynamicStatus(`${name.charAt(0).toUpperCase() + name.slice(1)} ${newValue ? 'On' : 'Off'}`);
  };

  // Voice control removed for now - will implement later if needed

  return (
    <div className="app-container">
      {/* Background Image */}
      {settings.backgroundImage && (
        <div className="background-container">
          <img 
            src={settings.backgroundImage} 
            alt="Background" 
            className="background-image"
            style={{
              opacity: settings.backgroundOpacity / 100,
              filter: settings.backgroundBlur > 0 ? `blur(${settings.backgroundBlur}px)` : 'none'
            }}
          />
          <div 
            className="background-overlay"
            style={{ opacity: settings.overlayOpacity / 100 }}
          />
        </div>
      )}

      {/* Theme Switcher */}
      <div className="theme-switcher">
        <button 
          className={`theme-btn ${settings.theme === 'light' ? 'active' : ''}`}
          onClick={() => handleThemeChange('light')}
        >
          Light
        </button>
        <button 
          className={`theme-btn ${settings.theme === 'dark' ? 'active' : ''}`}
          onClick={() => handleThemeChange('dark')}
        >
          Dark
        </button>
      </div>

      {/* Dynamic Status */}
      <div className={`dynamic-status ${showStatus ? 'show' : ''}`}>
        {dynamicStatus}
      </div>

      {/* Menu Toggle Button */}
      <button 
        className={`menu-toggle ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        aria-label="Toggle menu"
      >
        <div className="menu-icon"></div>
      </button>

      {/* Right-Side Expandable Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'expanded' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">KnowledgeOS</div>
          {currentWorkspace && (
            <div className="workspace-indicator">
              <span className="workspace-icon">📁</span>
              <span className="workspace-name">{currentWorkspace.name}</span>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="sidebar-tabs">
          <button 
            className={`tab-btn ${sidebarTab === 'files' ? 'active' : ''}`}
            onClick={() => setSidebarTab('files')}
          >
            <span className="tab-icon">📁</span>
            <span className="tab-label">Files</span>
          </button>
          <button 
            className={`tab-btn ${sidebarTab === 'settings' ? 'active' : ''}`}
            onClick={() => setSidebarTab('settings')}
          >
            <span className="tab-icon">⚙️</span>
            <span className="tab-label">Settings</span>
          </button>
          <button 
            className={`tab-btn ${sidebarTab === 'tools' ? 'active' : ''}`}
            onClick={() => setSidebarTab('tools')}
          >
            <span className="tab-icon">🔧</span>
            <span className="tab-label">Tools</span>
          </button>
        </div>

        <div className="sidebar-content">
          {/* Files Tab */}
          {sidebarTab === 'files' && currentWorkspace && (
            <div className="files-tab">
              <FileTree 
                rootPath={currentWorkspace.path}
                onFileSelect={handleFileSelect}
                activeFile={selectedFile}
              />
            </div>
          )}

          {/* Settings Tab */}
          {sidebarTab === 'settings' && (
            <div className="settings-tab advanced-settings">
          {/* AI Settings */}
          <div className="settings-section">
            <h3 className="settings-title">AI Configuration</h3>
            
            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">AI Provider</span>
              </div>
              <select 
                className="provider-select"
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value);
                  // Update model based on provider
                  if (e.target.value === 'Claude') {
                    setSelectedModel('claude-3-sonnet-20240229');
                  } else if (e.target.value === 'OpenAI') {
                    setSelectedModel('gpt-4-turbo-preview');
                  } else if (e.target.value === 'Gemini') {
                    setSelectedModel('gemini-pro');
                  }
                }}
              >
                <option value="Claude">Claude</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Gemini">Gemini</option>
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Model</span>
              </div>
              <select 
                className="provider-select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {selectedProvider === 'Claude' && (
                  <>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                  </>
                )}
                {selectedProvider === 'OpenAI' && (
                  <>
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
                {selectedProvider === 'Gemini' && (
                  <>
                    <option value="gemini-pro">Gemini Pro</option>
                    <option value="gemini-pro-vision">Gemini Pro Vision</option>
                  </>
                )}
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">API Key</span>
              </div>
              <div className="api-key-input">
                <input 
                  type="password"
                  className="api-key-field"
                  placeholder={`Enter ${selectedProvider} API Key`}
                  value={apiKeys[selectedProvider] || ''}
                  onChange={(e) => {
                    const newKeys = { ...apiKeys, [selectedProvider]: e.target.value };
                    setApiKeys(newKeys);
                  }}
                />
                <button 
                  className="save-key-btn"
                  onClick={async () => {
                    try {
                      if (!window.electronAPI || !window.electronAPI.saveApiKey) {
                        console.error('Electron API not available for saveApiKey');
                        showDynamicStatus('Error: API not available');
                        return;
                      }
                      
                      if (apiKeys[selectedProvider]) {
                        const result = await window.electronAPI.saveApiKey(selectedProvider, apiKeys[selectedProvider]);
                        if (result && result.success) {
                          showDynamicStatus('API Key saved successfully');
                        } else {
                          showDynamicStatus(`Error: ${result?.error || 'Failed to save key'}`);
                        }
                      }
                    } catch (error) {
                      console.error('Error saving API key:', error);
                      showDynamicStatus('Error saving API key');
                    }
                  }}
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div className="settings-section">
            <h3 className="settings-title">Appearance</h3>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Background Image</span>
              </div>
              <div className="image-upload-section">
                <button onClick={handleBackgroundImageUpload} className="upload-button">
                  Choose Background Image
                </button>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Background Blur</span>
                <span className="setting-value">{settings.backgroundBlur}px</span>
              </div>
              <input 
                type="range" 
                className="slider" 
                min="0" 
                max="20" 
                value={settings.backgroundBlur}
                onChange={(e) => saveSettings({ ...settings, backgroundBlur: parseInt(e.target.value) })}
              />
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Background Opacity</span>
                <span className="setting-value">{settings.backgroundOpacity}%</span>
              </div>
              <input 
                type="range" 
                className="slider" 
                min="0" 
                max="100" 
                value={settings.backgroundOpacity}
                onChange={(e) => saveSettings({ ...settings, backgroundOpacity: parseInt(e.target.value) })}
              />
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Overlay Opacity</span>
                <span className="setting-value">{settings.overlayOpacity}%</span>
              </div>
              <input 
                type="range" 
                className="slider" 
                min="0" 
                max="100" 
                value={settings.overlayOpacity}
                onChange={(e) => saveSettings({ ...settings, overlayOpacity: parseInt(e.target.value) })}
              />
            </div>
          </div>

          {/* Interaction Settings */}
          <div className="settings-section">
            <h3 className="settings-title">Interaction</h3>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Voice Input</span>
                <div 
                  className={`toggle-switch ${settings.voiceInput ? 'active' : ''}`}
                  onClick={() => toggleSwitch('voiceInput')}
                >
                  <div className="toggle-knob"></div>
                </div>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Haptic Feedback</span>
                <div 
                  className={`toggle-switch ${settings.hapticFeedback ? 'active' : ''}`}
                  onClick={() => toggleSwitch('hapticFeedback')}
                >
                  <div className="toggle-knob"></div>
                </div>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Sound Effects</span>
                <div 
                  className={`toggle-switch ${settings.soundEffects ? 'active' : ''}`}
                  onClick={() => toggleSwitch('soundEffects')}
                >
                  <div className="toggle-knob"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Future Features */}
          <div className="settings-section">
            <h3 className="settings-title">Future Features</h3>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">
                  AI Vision <span className="future-badge">Coming Soon</span>
                </span>
                <div className="toggle-switch disabled">
                  <div className="toggle-knob"></div>
                </div>
              </div>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">
                  Multi-Modal Input <span className="future-badge">Beta</span>
                </span>
                <div className="toggle-switch disabled">
                  <div className="toggle-knob"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Settings */}
          <div className="settings-section">
            <h3 className="settings-title">Performance</h3>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Animation Quality</span>
                <span className="setting-value">{settings.animationQuality}</span>
              </div>
              <select 
                className="provider-select"
                value={settings.animationQuality}
                onChange={(e) => saveSettings({ ...settings, animationQuality: e.target.value as any })}
              >
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Ultra</option>
              </select>
            </div>

            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Reduce Motion</span>
                <div 
                  className={`toggle-switch ${settings.reduceMotion ? 'active' : ''}`}
                  onClick={() => toggleSwitch('reduceMotion')}
                >
                  <div className="toggle-knob"></div>
                </div>
              </div>
            </div>
          </div>
            </div>
          )}

          {/* Tools Tab */}
          {sidebarTab === 'tools' && (
            <div className="tools-tab">
              <div className="tools-section">
                <h3 className="settings-title">AI Tools</h3>
                <div className="tools-list">
                  <div className="tool-item">
                    <span className="tool-icon">🧠</span>
                    <span className="tool-name">Knowledge Graph</span>
                    <span className="future-badge">Coming Soon</span>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">🔍</span>
                    <span className="tool-name">Smart Search</span>
                    <span className="future-badge">Coming Soon</span>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">📊</span>
                    <span className="tool-name">Analytics</span>
                    <span className="future-badge">Coming Soon</span>
                  </div>
                  <div className="tool-item">
                    <span className="tool-icon">🔗</span>
                    <span className="tool-name">Link Explorer</span>
                    <span className="future-badge">Coming Soon</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <Conversation 
          currentWorkspace={currentWorkspace}
          provider={
            selectedProvider && apiKeys[selectedProvider] 
              ? {
                  name: selectedProvider,
                  model: selectedModel,
                  apiKey: apiKeys[selectedProvider]
                }
              : null
          }
        />
      </div>

      {/* Workspace Modal */}
      <WorkspaceModal
        isOpen={showWorkspaceModal}
        onClose={() => setShowWorkspaceModal(false)}
        onSelectWorkspace={handleSelectWorkspace}
      />
    </div>
  );
}

export default ChatApp;