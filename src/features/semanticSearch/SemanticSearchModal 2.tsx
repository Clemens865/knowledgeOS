import React, { useState, useEffect } from 'react';
import ElysiaService, { SearchResult } from './ElysiaService';
import './semanticSearch.css';

interface SemanticSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspacePath: string | null;
  onSelectResult?: (content: string) => void;
}

type SearchMode = 'semantic' | 'hybrid';

const SemanticSearchModal: React.FC<SemanticSearchModalProps> = ({
  isOpen,
  onClose,
  workspacePath,
  onSelectResult
}) => {
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<SearchMode>('hybrid');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [stats, setStats] = useState({ documentCount: 0, totalSize: 0, averageEmbeddingSize: 0 });
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadStats();
      // Initialize Elysia if not already done
      ElysiaService.initialize().catch(console.error);
    }
  }, [isOpen]);

  const loadStats = () => {
    const currentStats = ElysiaService.getStats();
    setStats(currentStats);
  };

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setIsSearching(true);
    setError('');

    try {
      let searchResults: SearchResult[];
      
      if (searchMode === 'semantic') {
        searchResults = await ElysiaService.search(query, 10);
      } else {
        searchResults = await ElysiaService.hybridSearch(query, 10);
      }

      setResults(searchResults);
      
      if (searchResults.length === 0) {
        setError('No results found. Try indexing your workspace first.');
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

    setIsIndexing(true);
    setError('');

    try {
      // This would normally scan the workspace and index all markdown files
      // For now, we'll just show the process
      const mockDocuments = [
        {
          id: 'doc1',
          content: 'Sample document about React and TypeScript development',
          metadata: { title: 'React Guide', tags: ['react', 'typescript'] }
        },
        {
          id: 'doc2',
          content: 'Knowledge graph visualization and semantic search',
          metadata: { title: 'Knowledge Graph', tags: ['graph', 'search'] }
        }
      ];

      await ElysiaService.addDocuments(mockDocuments);
      loadStats();
      setError(`Indexed ${mockDocuments.length} documents successfully`);
    } catch (err: any) {
      setError(err.message || 'Indexing failed');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (onSelectResult) {
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
          <div className="search-stats">
            <div className="stat-item">
              <span className="stat-label">Documents:</span>
              <span className="stat-value">{stats.documentCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Index Size:</span>
              <span className="stat-value">{(stats.totalSize / 1024).toFixed(1)} KB</span>
            </div>
            <div className="stat-item">
              <button 
                className="index-btn"
                onClick={handleIndexWorkspace}
                disabled={isIndexing || !workspacePath}
              >
                {isIndexing ? '⏳ Indexing...' : '📚 Index Workspace'}
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

          {error && (
            <div className={`search-message ${error.includes('success') ? 'success' : 'error'}`}>
              <span className="message-icon">{error.includes('success') ? '✅' : '⚠️'}</span>
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
                    <p className="result-content">
                      {result.content.length > 150
                        ? result.content.substring(0, 150) + '...'
                        : result.content}
                    </p>
                    {result.metadata?.tags && (
                      <div className="result-tags">
                        {result.metadata.tags.map(tag => (
                          <span key={tag} className="tag">#{tag}</span>
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
                <li><strong>Semantic:</strong> Finds conceptually similar content</li>
                <li><strong>Hybrid:</strong> Combines semantic and keyword matching</li>
                <li>Index your workspace to enable search across all notes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SemanticSearchModal;