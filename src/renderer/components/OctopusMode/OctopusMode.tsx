import React, { useState, useCallback } from 'react';
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
}

interface ProcessedContent {
  type: string;
  content: string;
  metadata: {
    instruction: string;
    intent: string;
    sourcesUsed: number;
    processingTime: number;
  };
  suggestedFilePath?: string;
}

export const OctopusMode: React.FC<OctopusModeProps> = ({ onClose }) => {
  const [url, setUrl] = useState('');
  const [instruction, setInstruction] = useState('');
  const [depth, setDepth] = useState(0);
  const [maxPages, setMaxPages] = useState(1);
  const [progress, setProgress] = useState<CrawlProgress>({
    status: 'idle',
    pagesProcessed: 0,
    totalPages: 0
  });
  const [result, setResult] = useState<ProcessedContent | null>(null);
  const [preview, setPreview] = useState('');
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);

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
    setResult(null);
    setPreview('');

    try {
      // Listen for progress updates
      window.electronAPI.onCrawlProgress((progress: any) => {
        setProgress({
          status: 'crawling',
          currentUrl: progress.currentUrl,
          pagesProcessed: progress.pagesProcessed,
          totalPages: progress.totalPages,
          message: progress.message
        });
      });

      // Start the crawl
      const crawlResult = await window.electronAPI.startOctopusCrawl({
        url,
        instruction,
        options: {
          depth,
          maxPages,
          includeSubdomains: false,
          respectRobotsTxt: true
        }
      });

      if (crawlResult.success) {
        setProgress({
          status: 'processing',
          pagesProcessed: crawlResult.totalPages || 0,
          totalPages: crawlResult.totalPages || 0,
          message: 'Processing content...'
        });

        // Show preview of processed content
        if (crawlResult.processedContent) {
          setResult(crawlResult.processedContent);
          setPreview(crawlResult.processedContent.content);
        } else if (crawlResult.pages && crawlResult.pages.length > 0) {
          // Default markdown format if no instruction
          const markdown = crawlResult.pages.map((page: any) => 
            `# ${page.title}\n\n**Source:** ${page.url}\n**Date:** ${new Date(page.timestamp).toLocaleString()}\n\n${page.text}\n`
          ).join('\n---\n\n');
          setPreview(markdown);
        }

        setProgress({
          status: 'complete',
          pagesProcessed: crawlResult.totalPages || 0,
          totalPages: crawlResult.totalPages || 0,
          message: 'Crawl complete!'
        });
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

  const handleSave = useCallback(async () => {
    if (!preview) {
      alert('No content to save');
      return;
    }

    try {
      const fileName = result?.suggestedFilePath || 
        `web/${new URL(url).hostname}/${new Date().toISOString().split('T')[0]}.md`;
      
      const saved = await window.electronAPI.saveToKnowledge({
        content: preview,
        fileName,
        metadata: {
          source: url,
          instruction: instruction || 'No instruction provided',
          crawledAt: new Date().toISOString(),
          pagesProcessed: progress.pagesProcessed
        }
      });

      if (saved) {
        alert('Content saved to knowledge base!');
        onClose();
      }
    } catch (error) {
      alert('Failed to save content: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }, [preview, url, instruction, result, progress.pagesProcessed, onClose]);

  const getQuickActions = () => {
    const actions = [
      { label: '📝 Summarize', value: 'Summarize the main points of this page' },
      { label: '❓ Q&A', value: 'Extract all questions and answers' },
      { label: '📊 Extract Data', value: 'Extract all data, statistics, and facts' },
      { label: '💰 Find Pricing', value: 'Extract all pricing information and plans' },
      { label: '📚 API Docs', value: 'Extract API endpoints and documentation' },
      { label: '✍️ Blog Post', value: 'Write a blog post about the main content' }
    ];

    return actions;
  };

  return (
    <div className="octopus-mode">
      <div className="octopus-header">
        <h2>🐙 Octopus Mode - Web Intelligence</h2>
        <button className="close-button" onClick={onClose}>✕</button>
      </div>

      <div className="octopus-content">
        <div className="input-section">
          <div className="url-input">
            <label>URL to Crawl:</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              disabled={progress.status === 'crawling' || progress.status === 'processing'}
            />
          </div>

          <div className="instruction-input">
            <label>Instructions (optional):</label>
            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Leave empty to save entire page, or specify what to extract/generate..."
              rows={3}
              disabled={progress.status === 'crawling' || progress.status === 'processing'}
            />
          </div>

          <div className="quick-actions">
            <label>Quick Actions:</label>
            <div className="action-buttons">
              {getQuickActions().map(action => (
                <button
                  key={action.value}
                  className="quick-action"
                  onClick={() => setInstruction(action.value)}
                  disabled={progress.status === 'crawling' || progress.status === 'processing'}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          <div className="advanced-toggle">
            <button onClick={() => setIsAdvancedMode(!isAdvancedMode)}>
              {isAdvancedMode ? '▼' : '▶'} Advanced Options
            </button>
          </div>

          {isAdvancedMode && (
            <div className="advanced-options">
              <div className="option-group">
                <label>Crawl Depth:</label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={depth}
                  onChange={(e) => setDepth(parseInt(e.target.value) || 0)}
                  disabled={progress.status === 'crawling' || progress.status === 'processing'}
                />
                <span className="option-help">0 = single page, 1+ = follow links</span>
              </div>

              <div className="option-group">
                <label>Max Pages:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={maxPages}
                  onChange={(e) => setMaxPages(parseInt(e.target.value) || 1)}
                  disabled={progress.status === 'crawling' || progress.status === 'processing'}
                />
                <span className="option-help">Maximum pages to crawl</span>
              </div>
            </div>
          )}

          <div className="action-buttons-main">
            <button
              className="crawl-button"
              onClick={handleCrawl}
              disabled={!url || progress.status === 'crawling' || progress.status === 'processing'}
            >
              {progress.status === 'crawling' ? '🐙 Crawling...' : 
               progress.status === 'processing' ? '⚡ Processing...' : 
               '🐙 Start Crawling'}
            </button>
          </div>
        </div>

        {progress.status !== 'idle' && (
          <div className="progress-section">
            <div className={`status-indicator status-${progress.status}`}>
              {progress.status === 'crawling' && '🔄'}
              {progress.status === 'processing' && '⚡'}
              {progress.status === 'complete' && '✅'}
              {progress.status === 'error' && '❌'}
              {' '}
              {progress.message}
            </div>

            {(progress.status === 'crawling' || progress.status === 'processing') && (
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${(progress.pagesProcessed / progress.totalPages) * 100}%` }}
                />
              </div>
            )}

            {progress.currentUrl && (
              <div className="current-url">
                Currently processing: {progress.currentUrl}
              </div>
            )}

            <div className="progress-stats">
              Pages: {progress.pagesProcessed} / {progress.totalPages}
            </div>
          </div>
        )}

        {result && (
          <div className="result-info">
            <div className="result-metadata">
              <span className="intent-badge">{result.metadata.intent}</span>
              <span>Sources: {result.metadata.sourcesUsed}</span>
              <span>Time: {(result.metadata.processingTime / 1000).toFixed(2)}s</span>
              {result.suggestedFilePath && (
                <span>📁 {result.suggestedFilePath}</span>
              )}
            </div>
          </div>
        )}

        {preview && (
          <div className="preview-section">
            <div className="preview-header">
              <h3>📝 Preview</h3>
              <button className="save-button" onClick={handleSave}>
                💾 Save to Knowledge Base
              </button>
            </div>
            <div className="preview-content">
              <pre>{preview}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};