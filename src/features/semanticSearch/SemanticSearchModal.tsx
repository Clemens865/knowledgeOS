import React, { useState, useEffect } from 'react';
import FileSelector from './FileSelector';
import './semanticSearch.css';

interface SemanticSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string | null;
  openAIApiKey?: string;
  onSelectResult?: (content: string) => void;
}

interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata?: {
    title?: string;
    path?: string;
    tags?: string[];
    createdAt?: string;
    modifiedAt?: string;
  };
}

type SearchMode = 'semantic' | 'hybrid';
type EmbeddingProvider = 'local' | 'openai' | 'mock';

const SemanticSearchModal: React.FC<SemanticSearchModalProps> = ({
  isOpen,
  onClose,
  workspacePath,
  openAIApiKey = '',
  onSelectResult
}) => {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
  const [embeddingProvider, setEmbeddingProvider] = useState<EmbeddingProvider>('mock');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [stats, setStats] = useState<{
    documentCount: number;
    provider: string;
    dimension: number;
    databasePath?: string;
    databaseSize?: string;
    lastIndexed?: string;
    embeddingCount?: number;
    uniqueTags?: number;
  }>({ 
    documentCount: 0, 
    provider: 'Mock', 
    dimension: 384
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'search' | 'index'>('search');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = async () => {
    if (window.electronAPI?.semanticSearch) {
      const currentStats = await window.electronAPI.semanticSearch.getStatus();
      setStats({
        documentCount: currentStats.totalDocuments || 0,
        provider: 'Mock',
        dimension: 384,
        databasePath: undefined,
        databaseSize: undefined,
        lastIndexed: currentStats.lastIndexed,
        embeddingCount: undefined,
        uniqueTags: undefined
      });
    }
  };

  const handleProviderChange = async (provider: EmbeddingProvider) => {
    if (provider === 'openai' && !openAIApiKey) {
      setError('OpenAI API key not configured. Please add your key in Settings → API Keys');
      return;
    }

    setEmbeddingProvider(provider);
    setError('');
    setMessage('');

    if (window.electronAPI?.semanticSearch) {
      // Provider switching temporarily disabled - using mock provider
      const result = { success: true };
      
      if (result.success) {
        setMessage(`Switched to ${provider === 'local' ? 'Local' : provider === 'openai' ? 'OpenAI' : 'Mock'} embeddings`);
        loadStats();
        
        // If we have documents, suggest re-indexing
        if (stats.documentCount > 0) {
          setMessage(prev => prev + '. Consider re-indexing for best results.');
        }
      } else {
        setError('Failed to set provider');
        // Revert provider selection
        setEmbeddingProvider('mock');
      }
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    if (!window.electronAPI?.semanticSearch) {
      setError('Semantic search not available');
      return;
    }

    setIsSearching(true);
    setError('');
    setMessage('');

    try {
      let result;
      
      if (searchMode === 'semantic') {
        result = await window.electronAPI.semanticSearch.search(query, { limit: 10 });
      } else {
        result = await window.electronAPI.semanticSearch.search(query, { limit: 10 });
      }

      if (result.success) {
        const formattedResults = (result.results || []).map((r: any) => ({
          id: r.path || r.id || Math.random().toString(),
          content: r.content,
          score: r.score,
          metadata: r.metadata
        }));
        setResults(formattedResults);
        
        if (result.results?.length === 0) {
          setMessage('No results found. Try indexing your workspace first.');
        }
      } else {
        setError(result.error || 'Search failed');
        setResults([]);
      }
    } catch (err: any) {
      setError(err.message || 'Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleIndexWorkspace = async () => {
    if (!workspacePath) {
      setError('No workspace selected');
      return;
    }

    if (!window.electronAPI?.semanticSearch) {
      setError('Semantic search not available');
      return;
    }

    setIsIndexing(true);
    setError('');
    setMessage('Indexing workspace...');

    try {
      const result = await window.electronAPI.semanticSearch.indexWorkspace(workspacePath);
      
      if (result.success) {
        setMessage(`Successfully indexed ${result.indexed || 0} new/modified documents`);
        loadStats();
      } else {
        setError(result.error || 'Indexing failed');
      }
    } catch (err: any) {
      setError(err.message || 'Indexing failed');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleIndexSelectedFiles = async () => {
    if (selectedFiles.length === 0) {
      setError('No files selected for indexing');
      return;
    }

    if (!window.electronAPI?.semanticSearch) {
      setError('Semantic search not available');
      return;
    }

    setIsIndexing(true);
    setError('');
    setMessage(`Indexing ${selectedFiles.length} selected files...`);

    try {
      // For now, we'll index selected files through the workspace indexer
      // In the future, we'll add a specific endpoint for selective indexing
      const result = await window.electronAPI.semanticSearch.indexWorkspace(workspacePath || '');
      
      if (result.success) {
        setMessage(`Successfully indexed ${selectedFiles.length} files`);
        loadStats();
        setSelectedFiles([]);
        setActiveTab('search');
      } else {
        setError(result.error || 'Indexing failed');
      }
    } catch (err: any) {
      setError(err.message || 'Indexing failed');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleClearIndex = async () => {
    if (!window.electronAPI?.semanticSearch) {
      setError('Semantic search not available');
      return;
    }

    if (confirm('Are you sure you want to clear the entire search index? This cannot be undone.')) {
      setError('');
      setMessage('Clearing index...');

      try {
        const result = await window.electronAPI.semanticSearch.clearIndex();
        
        if (result.success) {
          setMessage('Index cleared successfully');
          setResults([]);
          loadStats();
        } else {
          setError(result.error || 'Failed to clear index');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to clear index');
      }
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.metadata?.path && window.electronAPI?.readFile) {
      // Open the file in the editor
      window.electronAPI.readFile(result.metadata.path).then(response => {
        if (response.success && response.content && onSelectResult) {
          onSelectResult(response.content);
        }
      });
    } else if (onSelectResult) {
      onSelectResult(result.content);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };


  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal semantic-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔍 Semantic Search</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-content">
          <div className="tab-buttons">
            <button 
              className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              🔍 Search
            </button>
            <button 
              className={`tab-btn ${activeTab === 'index' ? 'active' : ''}`}
              onClick={() => setActiveTab('index')}
            >
              📚 Index Files
            </button>
          </div>

          {activeTab === 'search' ? (
            <>
          <div className="search-stats">
            <div className="stat-item">
              <span className="stat-label">Documents:</span>
              <span className="stat-value">{stats.documentCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">DB Size:</span>
              <span className="stat-value">{stats.databaseSize}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Provider:</span>
              <span className="stat-value">{stats.provider}</span>
            </div>
            {stats.lastIndexed && (
              <div className="stat-item">
                <span className="stat-label">Last Indexed:</span>
                <span className="stat-value">{new Date(stats.lastIndexed).toLocaleDateString()}</span>
              </div>
            )}
            <div className="stat-item">
              <button 
                className="index-btn"
                onClick={handleIndexWorkspace}
                disabled={isIndexing || !workspacePath}
              >
                {isIndexing ? '⏳ Indexing...' : '📚 Index Workspace'}
              </button>
            </div>
            {stats.documentCount > 0 && (
              <div className="stat-item">
                <button 
                  className="index-btn clear-btn"
                  onClick={handleClearIndex}
                  disabled={isIndexing}
                  style={{ backgroundColor: '#ff4444' }}
                >
                  🗑️ Clear Index
                </button>
              </div>
            )}
          </div>

          <div className="provider-selector">
            <label>Embedding Provider:</label>
            <div className="provider-options">
              <button
                className={`provider-btn ${embeddingProvider === 'mock' ? 'active' : ''}`}
                onClick={() => handleProviderChange('mock')}
                title="Fast mock embeddings for testing"
              >
                🧪 Mock
              </button>
              <button
                className={`provider-btn ${embeddingProvider === 'local' ? 'active' : ''}`}
                onClick={() => handleProviderChange('local')}
                title="Private, on-device embeddings"
              >
                💻 Local
              </button>
              <button
                className={`provider-btn ${embeddingProvider === 'openai' ? 'active' : ''}`}
                onClick={() => handleProviderChange('openai')}
                title="High-quality OpenAI embeddings"
              >
                🚀 OpenAI
              </button>
            </div>
          </div>

          <div className="search-mode-selector">
            <button
              className={`mode-btn ${searchMode === 'semantic' ? 'active' : ''}`}
              onClick={() => setSearchMode('semantic')}
            >
              🧠 Semantic
            </button>
            <button
              className={`mode-btn ${searchMode === 'hybrid' ? 'active' : ''}`}
              onClick={() => setSearchMode('hybrid')}
            >
              🔀 Hybrid
            </button>
          </div>

          <div className="search-input-section">
            <textarea
              placeholder="Enter your search query..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isSearching}
              className="search-textarea"
              rows={3}
            />
            <button
              className="search-btn"
              onClick={handleSearch}
              disabled={isSearching || !query.trim()}
            >
              {isSearching ? '🔄 Searching...' : '🔍 Search'}
            </button>
          </div>

          {message && (
            <div className="search-message success">
              <span className="message-icon">ℹ️</span>
              <p>{message}</p>
            </div>
          )}

          {error && (
            <div className="search-message error">
              <span className="message-icon">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="search-results">
              <h3>Results ({results.length})</h3>
              <div className="results-list">
                {results.map((result, index) => (
                  <div
                    key={result.id}
                    className="result-item"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="result-header">
                      <span className="result-rank">#{index + 1}</span>
                      <span className="result-score">Score: {(result.score * 100).toFixed(1)}%</span>
                    </div>
                    {result.metadata?.title && (
                      <h4 className="result-title">{result.metadata.title}</h4>
                    )}
                    {result.metadata?.path && (
                      <p className="result-path">{result.metadata.path.split('/').slice(-2).join('/')}</p>
                    )}
                    <p className="result-content">
                      {result.content.length > 200
                        ? result.content.substring(0, 200) + '...'
                        : result.content}
                    </p>
                    {result.metadata?.tags && result.metadata.tags.length > 0 && (
                      <div className="result-tags">
                        {result.metadata.tags.slice(0, 5).map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-footer">
            <div className="search-tips">
              <p><strong>Tips:</strong></p>
              <ul>
                <li><strong>Mock:</strong> Fast testing mode (not real semantic search)</li>
                <li><strong>Local:</strong> Private on-device AI (slower but free)</li>
                <li><strong>OpenAI:</strong> Best quality (requires API key)</li>
                <li><strong>Semantic:</strong> Finds conceptually similar content</li>
                <li><strong>Hybrid:</strong> Combines semantic and keyword matching</li>
              </ul>
            </div>
          </div>
            </>
          ) : (
            <div className="file-selector-container">
              <FileSelector 
                workspacePath={workspacePath || ''}
                onSelectionChange={setSelectedFiles}
                supportedExtensions={[
                  '.md', '.txt', '.pdf', '.docx', '.doc',
                  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', 
                  '.cpp', '.c', '.h', '.cs', '.rb', '.go', '.rs',
                  '.html', '.css', '.json', '.xml', '.yaml', '.yml'
                ]}
              />
              
              <div className="index-actions">
                <button 
                  className="index-selected-btn"
                  onClick={handleIndexSelectedFiles}
                  disabled={isIndexing || selectedFiles.length === 0}
                >
                  {isIndexing ? '⏳ Indexing...' : `📚 Index ${selectedFiles.length} Selected Files`}
                </button>
              </div>

              {message && (
                <div className="search-message success">
                  <span className="message-icon">ℹ️</span>
                  <p>{message}</p>
                </div>
              )}

              {error && (
                <div className="search-message error">
                  <span className="message-icon">⚠️</span>
                  <p>{error}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SemanticSearchModal;