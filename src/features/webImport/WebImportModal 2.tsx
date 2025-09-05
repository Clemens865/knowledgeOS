import React, { useState, useEffect } from 'react';
import FirecrawlService from './FirecrawlService';
import './webImport.css';

interface WebImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string | null;
  onImportComplete?: (filePath: string) => void;
}

type ImportMode = 'single' | 'crawl';
type ImportStatus = 'idle' | 'importing' | 'success' | 'error';

const WebImportModal: React.FC<WebImportModalProps> = ({ 
  isOpen, 
  onClose, 
  workspacePath,
  onImportComplete 
}) => {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<ImportMode>('single');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState<string>('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  
  // Crawl options
  const [maxPages, setMaxPages] = useState(10);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);

  useEffect(() => {
    if (isOpen && !FirecrawlService.hasApiKey()) {
      setShowApiKeyInput(true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const validateUrl = (urlString: string): boolean => {
    try {
      new URL(urlString);
      return true;
    } catch {
      return false;
    }
  };

  const handleImport = async () => {
    if (!url || !validateUrl(url)) {
      setError('Please enter a valid URL');
      return;
    }

    if (!workspacePath) {
      setError('No workspace selected');
      return;
    }

    if (showApiKeyInput && apiKey) {
      FirecrawlService.setApiKey(apiKey);
      setShowApiKeyInput(false);
    }

    if (!FirecrawlService.hasApiKey()) {
      setError('Please set your Firecrawl API key');
      setShowApiKeyInput(true);
      return;
    }

    setStatus('importing');
    setError('');
    setProgress('Starting import...');

    try {
      if (mode === 'single') {
        // Import single page
        setProgress('Scraping webpage...');
        const content = await FirecrawlService.scrapePage(url);
        
        setProgress('Saving as note...');
        const filePath = await FirecrawlService.saveAsNote(content, workspacePath);
        
        setStatus('success');
        setProgress(`Successfully imported to: ${filePath.split('/').pop()}`);
        
        if (onImportComplete) {
          onImportComplete(filePath);
        }
        
        // Reset form after success
        setTimeout(() => {
          setUrl('');
          setStatus('idle');
          setProgress('');
        }, 3000);
      } else {
        // Crawl website
        setProgress(`Crawling website (max ${maxPages} pages)...`);
        const contents = await FirecrawlService.crawlWebsite({
          url,
          maxPages,
          includeSubdomains,
          format: 'markdown'
        });
        
        setProgress(`Saving ${contents.length} pages...`);
        for (let i = 0; i < contents.length; i++) {
          setProgress(`Saving page ${i + 1} of ${contents.length}...`);
          await FirecrawlService.saveAsNote(contents[i], workspacePath);
        }
        
        setStatus('success');
        setProgress(`Successfully imported ${contents.length} pages!`);
        
        // Reset form after success
        setTimeout(() => {
          setUrl('');
          setStatus('idle');
          setProgress('');
        }, 3000);
      }
    } catch (err: any) {
      setStatus('error');
      setError(err.message || 'Failed to import content');
      setProgress('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal web-import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🌐 Import from Web</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          {showApiKeyInput && (
            <div className="api-key-section">
              <div className="api-key-notice">
                <span className="notice-icon">🔑</span>
                <div>
                  <p>Firecrawl API Key Required</p>
                  <small>Get your API key from <a href="https://firecrawl.dev" target="_blank" rel="noopener noreferrer">firecrawl.dev</a></small>
                </div>
              </div>
              <input
                type="password"
                placeholder="Enter your Firecrawl API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="api-key-input"
              />
            </div>
          )}

          <div className="import-mode-selector">
            <button 
              className={`mode-btn ${mode === 'single' ? 'active' : ''}`}
              onClick={() => setMode('single')}
            >
              📄 Single Page
            </button>
            <button 
              className={`mode-btn ${mode === 'crawl' ? 'active' : ''}`}
              onClick={() => setMode('crawl')}
            >
              🕸️ Crawl Website
            </button>
          </div>

          <div className="url-input-section">
            <label>URL to Import</label>
            <input
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={status === 'importing'}
              className="url-input"
            />
          </div>

          {mode === 'crawl' && (
            <div className="crawl-options">
              <div className="option-row">
                <label>Max Pages</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxPages}
                  onChange={(e) => setMaxPages(parseInt(e.target.value) || 10)}
                  disabled={status === 'importing'}
                  className="number-input"
                />
              </div>
              <div className="option-row">
                <label>
                  <input
                    type="checkbox"
                    checked={includeSubdomains}
                    onChange={(e) => setIncludeSubdomains(e.target.checked)}
                    disabled={status === 'importing'}
                  />
                  Include subdomains
                </label>
              </div>
            </div>
          )}

          {status === 'importing' && (
            <div className="import-progress">
              <div className="spinner"></div>
              <p>{progress}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="import-success">
              <span className="success-icon">✅</span>
              <p>{progress}</p>
            </div>
          )}

          {error && (
            <div className="import-error">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          <div className="modal-actions">
            <button 
              className="btn-secondary" 
              onClick={onClose}
              disabled={status === 'importing'}
            >
              Cancel
            </button>
            <button 
              className="btn-primary"
              onClick={handleImport}
              disabled={status === 'importing' || !url}
            >
              {status === 'importing' ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebImportModal;