import React, { useState } from 'react';
import './Chat.css';

interface ChatProps {
  onClose: () => void;
}

const Chat: React.FC<ChatProps> = ({ onClose }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleSend = () => {
    if (message.trim()) {
      setMessages([...messages, { role: 'user', content: message }]);
      // TODO: Integrate with AI provider
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'AI integration coming soon! This will connect to OpenAI, Anthropic, and local LLMs.' 
      }]);
      setMessage('');
    }
  };

  return (
    <div className="chat-panel glass-morphism">
      <div className="chat-header">
        <h3>AI Assistant</h3>
        <button className="chat-close" onClick={onClose}>×</button>
      </div>
      
      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="chat-welcome">
            <p>👋 Hello! I'm your AI assistant.</p>
            <p>Ask me anything about your knowledge base.</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`chat-message ${msg.role}`}>
              {msg.content}
            </div>
          ))
        )}
      </div>
      
      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input glass-morphism"
          placeholder="Type a message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
        />
        <button className="chat-send" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
};

export default Chat;