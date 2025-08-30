/// <reference path="./global.d.ts" />
import React, { useState, useEffect } from 'react';
import WorkspaceModal from './components/WorkspaceModal/WorkspaceModal';
import WorkspaceRulesModal from './components/WorkspaceRulesModal/WorkspaceRulesModal';
import APIKeysModal from './components/APIKeysModal/APIKeysModal';
import { MCPServersModal } from './components/MCPServersModal/MCPServersModal';
import { AnalyticsView } from '../features/analytics/AnalyticsView';
import { ConversationMode, DEFAULT_MODES } from '../core/ConversationModes';
import FileTree from './components/FileTree/FileTree';
import Conversation from './components/Conversation/Conversation';
import FileEditor from './components/FileEditor/FileEditor';
import SplitPane from './components/SplitPane/SplitPane';
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
  const [showWorkspaceRules, setShowWorkspaceRules] = useState(false);
  const [showAPIKeysModal, setShowAPIKeysModal] = useState(false);
  const [showMCPModal, setShowMCPModal] = useState(false);
  const [modes, setModes] = useState<ConversationMode[]>(DEFAULT_MODES);
  const [currentMode, setCurrentMode] = useState<ConversationMode>(DEFAULT_MODES[0]);
  const [showEditor, setShowEditor] = useState(false);
  const [splitLayout, setSplitLayout] = useState<'vertical' | 'horizontal'>('vertical');
  const [splitSize, setSplitSize] = useState('50%');
  const [currentWorkspace, setCurrentWorkspace] = useState<{ path: string; name: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<string>('Claude');
  const [selectedModel, setSelectedModel] = useState<string>('claude-3-sonnet-20240229');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [activeTool, setActiveTool] = useState<string | null>(null);

  // Load settings and workspace on mount
  useEffect(() => {
    loadSettings();
    checkWorkspace();
    loadApiKeys();
    loadConversationModes();
  }, []);

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  // Handle menu actions
  useEffect(() => {
    const handleMenuAction = (action: string) => {
      if (action === 'workspaceRules') {
        setShowWorkspaceRules(true);
      } else if (action === 'apiKeys') {
        setShowAPIKeysModal(true);
      } else if (action === 'mcpServers') {
        setShowMCPModal(true);
      } else if (action === 'openProject' || action === 'newProject') {
        setShowWorkspaceModal(true);
      }
    };

    window.electronAPI.onMenuAction(handleMenuAction);
    
    return () => {
      window.electronAPI.removeAllListeners();
    };
  }, []);

  // Handle file open events
  useEffect(() => {
    const handleFileOpen = () => {
      setShowEditor(true);
    };

    window.addEventListener('open-file', handleFileOpen);
    
    return () => {
      window.removeEventListener('open-file', handleFileOpen);
    };
  }, []);

  const loadSettings = async () => {
    try {
      if (window.electronAPI?.getSetting) {
        const savedSettings = await window.electronAPI.getSetting('appSettings');
        if (savedSettings) {
          // Merge with default values to ensure all properties exist
          setSettings({
            theme: savedSettings.theme || 'light',
            backgroundImage: savedSettings.backgroundImage,
            backgroundOpacity: savedSettings.backgroundOpacity ?? 30,
            backgroundBlur: savedSettings.backgroundBlur ?? 0,
            overlayOpacity: savedSettings.overlayOpacity ?? 70,
            voiceInput: savedSettings.voiceInput ?? false,
            hapticFeedback: savedSettings.hapticFeedback ?? false,
            soundEffects: savedSettings.soundEffects ?? false,
            animationQuality: savedSettings.animationQuality || 'High',
            reduceMotion: savedSettings.reduceMotion ?? false
          });
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
          const name = workspace.split('/').pop() || 'Project';
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

  const loadConversationModes = async () => {
    try {
      if (window.electronAPI?.getSetting) {
        const savedModes = await window.electronAPI.getSetting('conversationModes');
        if (savedModes) {
          setModes(savedModes);
          setCurrentMode(savedModes[0]);
        }
      }
    } catch (error) {
      console.error('Error loading conversation modes:', error);
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
    showDynamicStatus(`Project opened: ${name}`);
    
    // Save to settings for persistence
    if (window.electronAPI?.setSetting) {
      await window.electronAPI.setSetting('currentWorkspace', path);
      console.log('Workspace saved to settings:', path);
    }
    
    // Open the workspace through the backend
    if (window.electronAPI?.openWorkspace) {
      await window.electronAPI.openWorkspace(path);
      console.log('Workspace opened in backend:', path);
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
              opacity: isNaN(settings.backgroundOpacity) ? 0.3 : settings.backgroundOpacity / 100,
              filter: settings.backgroundBlur > 0 ? `blur(${settings.backgroundBlur}px)` : 'none'
            }}
          />
          <div 
            className="background-overlay"
            style={{ opacity: isNaN(settings.overlayOpacity) ? 0.7 : settings.overlayOpacity / 100 }}
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
          {currentWorkspace ? (
            <div className="workspace-indicator">
              <span className="workspace-icon">📁</span>
              <div className="workspace-info">
                <span className="workspace-label">Current Project</span>
                <span className="workspace-name">{currentWorkspace.name}</span>
              </div>
            </div>
          ) : (
            <button 
              className="open-project-btn"
              onClick={() => setShowWorkspaceModal(true)}
            >
              Open Project
            </button>
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
            
            {/* Conversation Mode Selector */}
            <div className="setting-item">
              <div className="setting-label">
                <span className="setting-name">Conversation Mode</span>
              </div>
              <select 
                className="provider-select"
                value={currentMode.id}
                onChange={(e) => {
                  const mode = modes.find(m => m.id === e.target.value);
                  if (mode) setCurrentMode(mode);
                }}
              >
                {modes.map(mode => (
                  <option key={mode.id} value={mode.id}>
                    {mode.icon} {mode.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="setting-item">
              <button 
                className="configure-key-btn"
                onClick={() => setShowWorkspaceRules(true)}
                style={{ width: '100%' }}
              >
                📝 Edit Mode Rules
              </button>
            </div>
            
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
                    setSelectedModel('gpt-4o');  // Default to vision-capable model
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
                    <option value="gpt-4o">GPT-4o (Vision)</option>
                    <option value="gpt-4o-mini">GPT-4o Mini (Vision)</option>
                    <option value="gpt-4-vision-preview">GPT-4 Vision</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo (Vision)</option>
                    <option value="gpt-4-turbo-preview">GPT-4 Turbo Preview</option>
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
                <span className="setting-name">API Key Status</span>
              </div>
              <div className="api-key-status">
                {apiKeys[selectedProvider] ? (
                  <div className="status-configured">
                    <span className="status-icon">✅</span>
                    <span className="status-text">Configured</span>
                  </div>
                ) : (
                  <div className="status-missing">
                    <span className="status-icon">⚠️</span>
                    <span className="status-text">Not configured</span>
                  </div>
                )}
                <button 
                  className="configure-key-btn"
                  onClick={() => setShowAPIKeysModal(true)}
                >
                  {apiKeys[selectedProvider] ? 'Update Keys' : 'Add Keys'}
                </button>
              </div>
              <div className="api-key-hint">
                Use Cmd+Shift+K or File → API Keys to manage all keys
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
              {!activeTool ? (
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
                    <div 
                      className="tool-item clickable" 
                      onClick={() => setActiveTool('analytics')}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="tool-icon">📊</span>
                      <span className="tool-name">Analytics</span>
                      <span className="active-badge">Available</span>
                    </div>
                    <div className="tool-item">
                      <span className="tool-icon">🔗</span>
                      <span className="tool-name">Link Explorer</span>
                      <span className="future-badge">Coming Soon</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="tool-view">
                  <button 
                    className="back-button" 
                    onClick={() => setActiveTool(null)}
                    style={{
                      padding: '8px 12px',
                      marginBottom: '12px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    ← Back to Tools
                  </button>
                  {activeTool === 'analytics' && currentWorkspace && (
                    <AnalyticsView workspacePath={currentWorkspace.path} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {showEditor ? (
          <SplitPane
            split={splitLayout}
            defaultSize={splitSize}
            minSize={300}
            onSplitChange={(size) => setSplitSize(`${size}%`)}
          >
            <FileEditor 
              isOpen={true}
              onClose={() => setShowEditor(false)}
            />
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
              currentMode={currentMode}
            />
          </SplitPane>
        ) : (
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
            currentMode={currentMode}
          />
        )}
        
        {/* Editor Toggle Button */}
        <button
          className="editor-toggle"
          onClick={() => setShowEditor(!showEditor)}
          title={showEditor ? 'Hide Editor' : 'Show Editor'}
        >
          {showEditor ? '✕' : '📝'}
        </button>
        
        {/* Layout Toggle Button */}
        {showEditor && (
          <button
            className="layout-toggle"
            onClick={() => setSplitLayout(splitLayout === 'vertical' ? 'horizontal' : 'vertical')}
            title={`Switch to ${splitLayout === 'vertical' ? 'Horizontal' : 'Vertical'} Layout`}
          >
            {splitLayout === 'vertical' ? '⬌' : '⬍'}
          </button>
        )}
      </div>

      {/* Workspace Modal */}
      <WorkspaceModal
        isOpen={showWorkspaceModal}
        onClose={() => setShowWorkspaceModal(false)}
        onSelectWorkspace={handleSelectWorkspace}
      />
      
      <WorkspaceRulesModal
        isOpen={showWorkspaceRules}
        onClose={() => setShowWorkspaceRules(false)}
        currentMode={currentMode}
        modes={modes}
        onModeUpdate={async (updatedMode) => {
          // Update the mode in our list
          const updatedModes = modes.map(m => 
            m.id === updatedMode.id ? updatedMode : m
          );
          setModes(updatedModes);
          setCurrentMode(updatedMode);
          
          // Save to settings
          if (window.electronAPI?.setSetting) {
            await window.electronAPI.setSetting('conversationModes', updatedModes);
          }
        }}
      />
      
      <APIKeysModal
        isOpen={showAPIKeysModal}
        onClose={() => setShowAPIKeysModal(false)}
      />
      
      <MCPServersModal
        isOpen={showMCPModal}
        onClose={() => setShowMCPModal(false)}
      />
    </div>
  );
}

export default ChatApp;