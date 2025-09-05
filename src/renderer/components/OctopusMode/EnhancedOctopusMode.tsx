import React, { useState, useCallback, useRef, useEffect } from 'react';
import './OctopusMode.css';

interface OctopusModeProps {
  onClose: () => void;
}

interface CrawlProgress {
  status: 'idle' | 'crawling' | 'processing' | 'complete' | 'error';
  currentUrl?: string;
  pagesProcessed: number;
  totalPages: number;
  message?: string;
  sessionId?: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

type WorkflowStep = 'crawl' | 'process' | 'refine' | 'export';

export const EnhancedOctopusMode: React.FC<OctopusModeProps> = ({ onClose }) => {
  // Crawl state
  const [url, setUrl] = useState('');
  const [instruction, setInstruction] = useState('');
  const [depth, setDepth] = useState(0);
  const [maxPages, setMaxPages] = useState(1);
  const [progress, setProgress] = useState<CrawlProgress>({
    status: 'idle',
    pagesProcessed: 0,
    totalPages: 0
  });
  
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState('');
  const [rawContent, setRawContent] = useState('');
  const [processedVersions, setProcessedVersions] = useState<any[]>([]);
  
  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('crawl');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // UI state
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('current');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Listen for progress updates
  useEffect(() => {
    const handleProgress = (progress: any) => {
      setProgress({
        status: progress.status,
        currentUrl: progress.currentUrl,
        pagesProcessed: progress.pagesProcessed || 0,
        totalPages: progress.totalPages || 0,
        message: progress.message,
        sessionId: progress.sessionId
      });
      
      if (progress.sessionId) {
        setSessionId(progress.sessionId);
        loadSessionContent(progress.sessionId);
      }
    };

    window.electronAPI.onCrawlProgress(handleProgress);
    
    return () => {
      // Cleanup listener if needed
    };
  }, []);

  const loadSessionContent = async (sessionId: string) => {
    const result = await window.electronAPI.getOctopusSession(sessionId);
    if (result.success) {
      setCurrentContent(result.currentContent || '');
      setProcessedVersions(result.versions || []);
      
      // Store raw content on first load
      if (!rawContent && result.session.currentVersion === 'raw') {
        setRawContent(result.currentContent || '');
      }
    }
  };

  const handleCrawl = useCallback(async () => {
    if (!url) {
      alert('Please enter a URL');
      return;
    }

    setProgress({
      status: 'crawling',
      pagesProcessed: 0,
      totalPages: maxPages,
      message: 'Starting crawl...'
    });
    setCurrentContent('');
    setChatMessages([]);

    try {
      const crawlResult = await window.electronAPI.startOctopusCrawl({
        url,
        instruction: instruction || undefined,
        options: {
          depth,
          maxPages,
          includeSubdomains: false,
          respectRobotsTxt: true
        }
      });

      if (crawlResult.success) {
        setSessionId(crawlResult.sessionId);
        
        // Store raw content
        if (crawlResult.pages && crawlResult.pages.length > 0) {
          const raw = crawlResult.pages.map((page: any) => 
            `# ${page.title}\n\n**Source:** ${page.url}\n\n${page.text}\n`
          ).join('\n---\n\n');
          setRawContent(raw);
          setCurrentContent(crawlResult.processedContent?.content || raw);
        }

        setProgress({
          status: 'complete',
          pagesProcessed: crawlResult.totalPages || 0,
          totalPages: crawlResult.totalPages || 0,
          message: 'Crawl complete!'
        });
        
        // Auto-advance to process step if no initial instruction
        if (!instruction) {
          setCurrentStep('process');
        }
      } else {
        throw new Error(crawlResult.error || 'Crawl failed');
      }
    } catch (error) {
      setProgress({
        status: 'error',
        pagesProcessed: 0,
        totalPages: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [url, instruction, depth, maxPages]);

  const handleProcessInstruction = useCallback(async (newInstruction: string) => {
    if (!sessionId || !newInstruction) return;
    
    setIsProcessing(true);
    try {
      const result = await window.electronAPI.processWithInstruction({
        sessionId,
        instruction: newInstruction
      });
      
      if (result.success) {
        setCurrentContent(result.content);
        await loadSessionContent(sessionId);
        
        // Add to chat history
        setChatMessages(prev => [...prev, 
          { role: 'user', content: `Process: ${newInstruction}`, timestamp: new Date() },
          { role: 'assistant', content: 'Content processed successfully', timestamp: new Date() }
        ]);
      } else {
        alert(`Failed to process: ${result.error}`);
      }
    } catch (error) {
      alert('Processing error: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId]);

  const handleChatSubmit = useCallback(async () => {
    if (!sessionId || !chatInput.trim()) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }]);
    
    setIsProcessing(true);
    try {
      const result = await window.electronAPI.refineContent({
        sessionId,
        message: userMessage
      });
      
      if (result.success) {
        setCurrentContent(result.content);
        setChatMessages(prev => [...prev, 
          { role: 'assistant', content: result.content, timestamp: new Date() }
        ]);
        await loadSessionContent(sessionId);
      } else {
        setChatMessages(prev => [...prev, 
          { role: 'assistant', content: `Error: ${result.error}`, timestamp: new Date() }
        ]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, 
        { role: 'assistant', content: 'Failed to process your request', timestamp: new Date() }
      ]);
    } finally {
      setIsProcessing(false);
    }
  }, [sessionId, chatInput]);

  const handleSave = useCallback(async (format: 'markdown' | 'json' | 'knowledge' = 'knowledge') => {
    if (!sessionId || !currentContent) {
      alert('No content to save');
      return;
    }

    try {
      const exported = await window.electronAPI.exportOctopusContent({
        sessionId,
        format
      });
      
      if (exported.success) {
        // Save to knowledge base
        const saved = await window.electronAPI.saveToKnowledge({
          sessionId,
          fileName: exported.data.suggestedPath || `web/crawl-${Date.now()}.md`,
          metadata: {
            source: url,
            sessionId,
            exportedAt: new Date().toISOString()
          }
        });

        if (saved) {
          alert('Content saved to knowledge base!');
          onClose();
        }
      }
    } catch (error) {
      alert('Failed to save: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [sessionId, currentContent, url, onClose]);

  const getQuickActions = () => {
    return [
      { label: '📝 Summarize', value: 'Summarize the main points of this content' },
      { label: '🔑 Key Takeaways', value: 'Extract the key takeaways and insights' },
      { label: '📊 Extract Data', value: 'Extract all data, statistics, and facts' },
      { label: '❓ Q&A', value: 'Create a Q&A based on this content' },
      { label: '📋 Action Items', value: 'Extract action items and next steps' },
      { label: '✍️ Blog Post', value: 'Transform this into a blog post' }
    ];
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'crawl':
        return (
          <div className="step-content crawl-step">
            <div className="url-input">
              <label>URL to Crawl:</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={progress.status === 'crawling'}
              />
            </div>

            <div className="instruction-input">
              <label>Initial Processing (optional):</label>
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Leave empty to just crawl, or specify what to extract..."
                rows={2}
                disabled={progress.status === 'crawling'}
              />
            </div>

            <div className="advanced-toggle">
              <button onClick={() => setIsAdvancedMode(!isAdvancedMode)}>
                {isAdvancedMode ? '▼' : '▶'} Advanced Options
              </button>
            </div>

            {isAdvancedMode && (
              <div className="advanced-options">
                <div className="option-group">
                  <label>Depth:</label>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    value={depth}
                    onChange={(e) => setDepth(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div className="option-group">
                  <label>Max Pages:</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            )}

            <div className="action-buttons-main">
              <button
                className="crawl-button"
                onClick={handleCrawl}
                disabled={!url || progress.status === 'crawling'}
              >
                {progress.status === 'crawling' ? '🔄 Crawling...' : '🐙 Start Crawling'}
              </button>
            </div>
          </div>
        );

      case 'process':
        return (
          <div className="step-content process-step">
            <h3>Process Content with AI</h3>
            <p className="step-description">
              Apply AI processing to transform the crawled content
            </p>

            <div className="quick-actions">
              <label>Quick Actions:</label>
              <div className="action-buttons">
                {getQuickActions().map(action => (
                  <button
                    key={action.value}
                    className="quick-action"
                    onClick={() => handleProcessInstruction(action.value)}
                    disabled={isProcessing || !sessionId}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="custom-instruction">
              <label>Custom Instruction:</label>
              <div className="instruction-row">
                <input
                  type="text"
                  placeholder="Enter custom processing instruction..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value) {
                      handleProcessInstruction(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  disabled={isProcessing || !sessionId}
                />
                <button 
                  onClick={() => {
                    const input = document.querySelector('.custom-instruction input') as HTMLInputElement;
                    if (input?.value) {
                      handleProcessInstruction(input.value);
                      input.value = '';
                    }
                  }}
                  disabled={isProcessing || !sessionId}
                >
                  Process
                </button>
              </div>
            </div>
          </div>
        );

      case 'refine':
        return (
          <div className="step-content refine-step">
            <h3>Refine with Chat</h3>
            <div className="chat-container">
              <div className="chat-messages">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`chat-message ${msg.role}`}>
                    <div className="message-role">{msg.role === 'user' ? 'You' : 'AI'}</div>
                    <div className="message-content">{msg.content}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              
              <div className="chat-input-container">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                  placeholder="Ask questions or request changes..."
                  disabled={isProcessing || !sessionId}
                />
                <button 
                  onClick={handleChatSubmit}
                  disabled={isProcessing || !sessionId || !chatInput.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        );

      case 'export':
        return (
          <div className="step-content export-step">
            <h3>Save to Knowledge Base</h3>
            
            <div className="export-options">
              <button 
                className="export-button"
                onClick={() => handleSave('knowledge')}
              >
                💾 Save to Knowledge OS
              </button>
              
              <button 
                className="export-button"
                onClick={() => handleSave('markdown')}
              >
                📝 Export as Markdown
              </button>
              
              <button 
                className="export-button"
                onClick={() => handleSave('json')}
              >
                📊 Export as JSON
              </button>
            </div>

            {processedVersions.length > 0 && (
              <div className="version-selector">
                <label>Select Version to Export:</label>
                <select 
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                >
                  <option value="current">Current Version</option>
                  <option value="raw">Original (Raw)</option>
                  {processedVersions.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.instruction} - {new Date(v.timestamp).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="octopus-mode enhanced">
      <div className="octopus-header">
        <h2>🐙 Octopus Mode - Web Intelligence</h2>
        <button className="close-button" onClick={onClose}>✕</button>
      </div>

      {/* Workflow Steps Navigation */}
      <div className="workflow-nav">
        <button 
          className={`step-nav ${currentStep === 'crawl' ? 'active' : ''}`}
          onClick={() => setCurrentStep('crawl')}
          disabled={progress.status === 'crawling'}
        >
          1. Crawl
        </button>
        <button 
          className={`step-nav ${currentStep === 'process' ? 'active' : ''}`}
          onClick={() => setCurrentStep('process')}
          disabled={!sessionId}
        >
          2. Process
        </button>
        <button 
          className={`step-nav ${currentStep === 'refine' ? 'active' : ''}`}
          onClick={() => setCurrentStep('refine')}
          disabled={!sessionId}
        >
          3. Refine
        </button>
        <button 
          className={`step-nav ${currentStep === 'export' ? 'active' : ''}`}
          onClick={() => setCurrentStep('export')}
          disabled={!sessionId}
        >
          4. Export
        </button>
      </div>

      <div className="octopus-content">
        <div className="workflow-container">
          <div className="workflow-step">
            {renderStepContent()}
          </div>

          {/* Content Preview Panel */}
          {currentContent && (
            <div className="content-preview">
              <div className="preview-header">
                <h3>📄 Content Preview</h3>
                {progress.status === 'complete' && (
                  <span className="content-stats">
                    {currentContent.length} characters
                  </span>
                )}
              </div>
              <div className="preview-body">
                <pre>{currentContent}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Progress Indicator */}
        {progress.status !== 'idle' && progress.status !== 'complete' && (
          <div className="progress-section">
            <div className={`status-indicator status-${progress.status}`}>
              {progress.status === 'crawling' && '🔄'}
              {progress.status === 'processing' && '⚡'}
              {progress.status === 'error' && '❌'}
              {' '}
              {progress.message}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};