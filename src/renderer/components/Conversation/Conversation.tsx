/// <reference path="../../global.d.ts" />
import React, { useState, useEffect, useRef } from 'react';
import './Conversation.css';
import { ConversationMode, DEFAULT_MODES } from '../../../core/ConversationModes';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string | MessageContent[];
  timestamp: Date;
  isStreaming?: boolean;
  displayContent?: string; // For UI display when content is complex
}

interface MessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
    detail?: 'low' | 'high' | 'auto';
  };
}

interface ConversationProps {
  currentWorkspace: { path: string; name: string } | null;
  provider: {
    name: string;
    model: string;
    apiKey?: string;
  } | null;
  currentMode?: ConversationMode;
}

const Conversation: React.FC<ConversationProps> = ({ currentWorkspace, provider, currentMode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const activeMode = currentMode || DEFAULT_MODES[0];
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversation history on mount
  useEffect(() => {
    loadConversationHistory();
  }, [currentWorkspace]);

  // Save conversation history when messages change
  useEffect(() => {
    if (messages.length > 0 && conversationId) {
      saveConversationHistory();
    }
  }, [messages, conversationId]);

  // Initialize LLM when provider, workspace, or mode changes
  useEffect(() => {
    if (currentWorkspace && provider && provider.apiKey) {
      initializeLLM();
    }
  }, [currentWorkspace, provider, currentMode]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversationHistory = () => {
    if (!currentWorkspace) return;
    
    try {
      // Create a unique conversation ID based on workspace
      const convId = `conversation-${currentWorkspace.path.replace(/[^a-z0-9]/gi, '-')}`;
      setConversationId(convId);
      
      // Load from localStorage
      const saved = localStorage.getItem(convId);
      if (saved) {
        const parsedMessages = JSON.parse(saved);
        // Only load messages from the last 24 hours to keep conversations fresh
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);
        
        const recentMessages = parsedMessages.filter((msg: any) => {
          return new Date(msg.timestamp) > oneDayAgo;
        }).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        setMessages(recentMessages);
        console.log(`Loaded ${recentMessages.length} recent messages from conversation history`);
      }
    } catch (error) {
      console.error('Error loading conversation history:', error);
    }
  };

  const saveConversationHistory = () => {
    if (!conversationId) return;
    
    try {
      // Save to localStorage (with size limit)
      const toSave = messages.slice(-50); // Keep last 50 messages
      localStorage.setItem(conversationId, JSON.stringify(toSave));
    } catch (error) {
      console.error('Error saving conversation history:', error);
    }
  };

  const initializeLLM = async () => {
    if (!currentWorkspace) {
      setError('No project selected. Please open a project first (File → Open Project).');
      setIsInitialized(false);
      return;
    }
    
    if (!provider) {
      setError('No AI provider selected. Please select a provider in the settings.');
      setIsInitialized(false);
      return;
    }
    
    if (!provider.apiKey) {
      setError(`No API key configured for ${provider.name}. Please add your API key in File → API Keys (Cmd+Shift+K).`);
      setIsInitialized(false);
      return;
    }

    try {
      console.log('Initializing LLM with mode:', activeMode.name);
      console.log('Provider:', provider.name, 'Model:', provider.model, 'Workspace:', currentWorkspace.path);
      console.log('System prompt (first 200 chars):', activeMode.systemPrompt.substring(0, 200));
      
      // Set the system prompt based on current mode
      const promptResult = await window.electronAPI.setSystemPrompt(activeMode.systemPrompt);
      console.log('System prompt set result:', promptResult);
      
      const result = await window.electronAPI.initializeLLM(
        {
          name: provider.name,
          apiKey: provider.apiKey,
          model: provider.model
        },
        currentWorkspace.path
      );

      if (result.success) {
        setIsInitialized(true);
        setError(null);
        console.log('LLM initialized successfully');
      } else {
        const errorMsg = result.error || 'Failed to initialize LLM';
        setError(errorMsg);
        setIsInitialized(false);
        console.error('LLM initialization failed:', errorMsg);
      }
    } catch (err) {
      const errorMsg = 'Error initializing LLM: ' + (err as Error).message;
      setError(errorMsg);
      setIsInitialized(false);
      console.error(errorMsg, err);
    }
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && uploadedFiles.length === 0) || isLoading || !isInitialized) return;
    
    // Prepare message content
    let messageContent: string | MessageContent[] = inputMessage.trim();
    let displayContent = inputMessage.trim();
    
    // Handle attachments for vision-capable models
    if (uploadedFiles.length > 0) {
      const hasImages = uploadedFiles.some(f => f.type.startsWith('image/'));
      // Check if using a vision-capable model
      const isVisionModel = provider?.model?.includes('vision') || 
                           provider?.model?.includes('gpt-4o') || 
                           provider?.model === 'gpt-4-turbo' ||
                           provider?.model === 'gpt-4-turbo-preview' ||
                           provider?.model === 'gemini-pro-vision';
      
      if (hasImages && isVisionModel) {
        // Use structured content for vision models
        const contentArray: MessageContent[] = [];
        
        // Add text if present
        if (inputMessage.trim()) {
          contentArray.push({ type: 'text', text: inputMessage.trim() });
        }
        
        // Add images
        for (const file of uploadedFiles) {
          if (file.type.startsWith('image/')) {
            const dataUrl = await readFileContent(file);
            contentArray.push({
              type: 'image_url',
              image_url: {
                url: dataUrl,
                detail: 'auto'
              }
            });
            displayContent += `\n🖼️ [Image: ${file.name}]`;
          } else {
            // For non-image files, add as text
            const content = await readFileContent(file);
            const maxContentLength = 10000;
            const truncatedContent = content.length > maxContentLength 
              ? content.substring(0, maxContentLength) + '\n... (content truncated)'
              : content;
            contentArray.push({ 
              type: 'text', 
              text: `\n📄 File: ${file.name}\nContent:\n${truncatedContent}` 
            });
            displayContent += `\n📄 [File: ${file.name}]`;
          }
        }
        
        messageContent = contentArray;
      } else {
        // Fallback to text-only format for non-vision models
        displayContent += '\n\n--- Attached Files ---\n';
        
        for (const file of uploadedFiles) {
          const content = await readFileContent(file);
          displayContent += `\n📄 File: ${file.name} (${file.type || 'unknown'})\n`;
          
          if (file.type.startsWith('image/')) {
            displayContent += `⚠️ [Image attachments require a vision-capable model like gpt-4-vision-preview, gpt-4o, or gemini-pro-vision]\n`;
            messageContent += `\n[Image: ${file.name} - Please use a vision model like gpt-4-vision-preview, gpt-4o, or gemini-pro-vision to view images]`;
          } else {
            const maxContentLength = 10000;
            const truncatedContent = content.length > maxContentLength 
              ? content.substring(0, maxContentLength) + '\n... (content truncated)'
              : content;
            displayContent += `\nContent:\n${truncatedContent}\n`;
            messageContent += `\n📄 File: ${file.name}\nContent:\n${truncatedContent}`;
          }
        }
      }
      
      // Clear uploaded files after including them
      setUploadedFiles([]);
    }

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: messageContent,
      displayContent: displayContent,
      timestamp: new Date()
    };

    // Add user message to conversation
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      // Send message to LLM
      const result = await window.electronAPI.sendMessageToLLM(
        userMessage.content,
        messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      );

      if (result.success && result.response) {
        const assistantMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: result.response,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Show usage stats if available
        if (result.usage) {
          console.log('Token usage:', result.usage);
        }

        // File operations were handled in the main process
        if (result.fileOperations && result.fileOperations.length > 0) {
          console.log('File operations executed:', result.fileOperations);
          // Trigger file tree refresh
          window.dispatchEvent(new CustomEvent('refresh-file-tree'));
        }
      } else {
        const errorMsg = result.error || 'Failed to get response from LLM';
        setError(errorMsg);
        console.error('LLM response error:', errorMsg);
        
        // Re-initialize if needed
        if (errorMsg.includes('not initialized')) {
          console.log('Attempting to re-initialize LLM...');
          await initializeLLM();
        }
      }
    } catch (err) {
      const errorMsg = 'Error sending message: ' + (err as Error).message;
      setError(errorMsg);
      console.error(errorMsg, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  };

  const generateId = () => {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const clearConversation = async () => {
    // Save current conversation to a markdown file before clearing
    if (messages.length > 0 && currentWorkspace) {
      try {
        // Create conversation log in daily folder
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `conversation-${timestamp}.md`;
        const filepath = `daily/${filename}`;
        
        // Format conversation as markdown
        let content = `# Conversation Log\n\n`;
        content += `**Date**: ${new Date().toLocaleString()}\n`;
        content += `**Workspace**: ${currentWorkspace.name}\n\n`;
        content += `---\n\n`;
        
        messages.forEach(msg => {
          const role = msg.role === 'user' ? '👤 You' : '🤖 AI';
          const time = formatTime(msg.timestamp);
          content += `### ${role} (${time})\n\n`;
          content += `${msg.content}\n\n`;
        });
        
        // Send to LLM to save (it will handle the file operation)
        console.log('Saving conversation log to:', filepath);
        
        // Clear localStorage for this conversation
        if (conversationId) {
          localStorage.removeItem(conversationId);
        }
      } catch (error) {
        console.error('Error saving conversation log:', error);
      }
    }
    
    // Clear messages
    setMessages([]);
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const fileList = Array.from(files);
    setUploadedFiles(prev => [...prev, ...fileList]);
    
    // Clear the input so the same file can be selected again
    event.target.value = '';
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = reject;
      
      if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
      } else {
        reader.readAsText(file);
      }
    });
  };

  if (!currentWorkspace) {
    return (
      <div className="conversation-container no-workspace">
        <div className="empty-state">
          <span className="empty-icon">📁</span>
          <h3>No Workspace Selected</h3>
          <p>Please select a workspace to start your conversation</p>
        </div>
      </div>
    );
  }

  if (!provider || !provider.apiKey) {
    return (
      <div className="conversation-container no-provider">
        <div className="empty-state">
          <span className="empty-icon">🔑</span>
          <h3>API Key Required</h3>
          <p>Please configure your AI provider and API key in Settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="conversation-container">
      {/* Header */}
      <div className="conversation-header">
        <div className="header-info">
          <span className="provider-badge">
            {provider.name} - {provider.model}
          </span>
          <span className="workspace-badge">
            📁 {currentWorkspace.name}
          </span>
          <span className="mode-badge" title={activeMode.description}>
            {activeMode.icon} {activeMode.name}
          </span>
          {messages.length > 0 && (
            <span className="conversation-status" title="Conversation history is automatically saved">
              💬 Ongoing conversation
            </span>
          )}
        </div>
        <button 
          className="clear-btn"
          onClick={clearConversation}
          title="Start new conversation (current conversation will be saved to daily folder)"
        >
          🆕
        </button>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome back to KnowledgeOS</h2>
            <p>Start a conversation and I'll automatically organize your knowledge</p>
            <div className="tips">
              <div className="tip">
                💡 I'll extract and save important information to your knowledge base
              </div>
              <div className="tip">
                📁 Files are organized automatically in your workspace
              </div>
              <div className="tip">
                🔗 I'll create connections between related concepts
              </div>
              <div className="tip">
                💬 Our conversation continues across sessions - I remember our previous chats!
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`message ${message.role}`}
              >
                <div className="message-header">
                  <span className="message-role">
                    {message.role === 'user' ? '👤 You' : '🤖 AI'}
                  </span>
                  <span className="message-time">
                    {formatTime(message.timestamp)}
                  </span>
                </div>
                <div className="message-content">
                  {message.displayContent || (typeof message.content === 'string' ? message.content : '[Complex content with images]')}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant loading">
                <div className="message-header">
                  <span className="message-role">🤖 AI</span>
                </div>
                <div className="loading-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}

      {/* File Upload Area */}
      {
        <div className="file-upload-area">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={activeMode.supportedFileTypes?.join(',') || '*'}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
          {uploadedFiles.length > 0 && (
            <div className="uploaded-files">
              {uploadedFiles.map((file, index) => (
                <span key={index} className="uploaded-file">
                  📄 {file.name}
                  <button 
                    className="remove-file-btn"
                    onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      }

      {/* Input area */}
      <div className="input-container">
        <button
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach files"
        >
          📎
        </button>
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isInitialized 
              ? "Type your message... (Shift+Enter for new line, no length limit)"
              : "Initializing AI..."
          }
          disabled={!isInitialized || isLoading}
          className="message-input"
          rows={1}
        />
        <button 
          onClick={sendMessage}
          disabled={!inputMessage.trim() || isLoading || !isInitialized}
          className="send-button"
        >
          {isLoading ? '⏳' : '📤'}
        </button>
      </div>
    </div>
  );
};

export default Conversation;