/// <reference path="../../global.d.ts" />
import React, { useState, useEffect, useRef } from 'react';
import './Conversation.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface ConversationProps {
  currentWorkspace: { path: string; name: string } | null;
  provider: {
    name: string;
    model: string;
    apiKey?: string;
  } | null;
}

const Conversation: React.FC<ConversationProps> = ({ currentWorkspace, provider }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize LLM when provider or workspace changes
  useEffect(() => {
    if (currentWorkspace && provider && provider.apiKey) {
      initializeLLM();
    }
  }, [currentWorkspace, provider]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initializeLLM = async () => {
    if (!currentWorkspace || !provider || !provider.apiKey) return;

    try {
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
      } else {
        setError(result.error || 'Failed to initialize LLM');
        setIsInitialized(false);
      }
    } catch (err) {
      setError('Error initializing LLM: ' + (err as Error).message);
      setIsInitialized(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isInitialized) return;

    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: inputMessage.trim(),
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
        setError(result.error || 'Failed to get response from LLM');
      }
    } catch (err) {
      setError('Error sending message: ' + (err as Error).message);
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

  const clearConversation = () => {
    setMessages([]);
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
        </div>
        <button 
          className="clear-btn"
          onClick={clearConversation}
          title="Clear conversation"
        >
          🗑️
        </button>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome to KnowledgeOS</h2>
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
                  {message.content}
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

      {/* Input area */}
      <div className="input-container">
        <textarea
          ref={textareaRef}
          value={inputMessage}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={
            isInitialized 
              ? "Type your message... (Shift+Enter for new line)"
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