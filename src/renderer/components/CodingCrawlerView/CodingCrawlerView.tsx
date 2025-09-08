import React, { useState, useEffect } from 'react';
import './CodingCrawlerView.css';

interface CrawlProfile {
  name: string;
  baseUrl: string;
  patterns: string[];
}

interface SearchResult {
  type: string;
  content: string;
  score: number;
  metadata?: any;
}

interface CrawlStats {
  totalDocuments: number;
  totalExamples: number;
  totalAPIs: number;
  languages: string[];
  frameworks: string[];
  lastCrawl?: string;
}

export const CodingCrawlerView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'crawl' | 'search' | 'stats'>('crawl');
  const [profiles, setProfiles] = useState<CrawlProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [customUrl, setCustomUrl] = useState('');
  const [maxPages, setMaxPages] = useState(100);
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'hybrid' | 'keyword' | 'semantic'>('hybrid');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [stats, setStats] = useState<CrawlStats | null>(null);
  const [pythonServiceStarted, setPythonServiceStarted] = useState(false);

  // Load profiles on mount
  useEffect(() => {
    loadProfiles();
    loadStats();
  }, []);

  // Set up crawl progress listener
  useEffect(() => {
    if (window.electronAPI?.codingCrawler?.onProgress) {
      window.electronAPI.codingCrawler.onProgress((progress: any) => {
        setCrawlProgress(progress);
      });
    }

    if (window.electronAPI?.codingCrawler?.onError) {
      window.electronAPI.codingCrawler.onError((error: any) => {
        console.error('Crawl error:', error);
        setIsCrawling(false);
      });
    }

    if (window.electronAPI?.codingCrawler?.onComplete) {
      window.electronAPI.codingCrawler.onComplete(() => {
        setIsCrawling(false);
        loadStats();
      });
    }

    return () => {
      if (window.electronAPI?.codingCrawler?.removeListeners) {
        window.electronAPI.codingCrawler.removeListeners();
      }
    };
  }, []);

  const loadProfiles = async () => {
    try {
      if (window.electronAPI?.codingCrawler?.getProfiles) {
        const profilesList = await window.electronAPI.codingCrawler.getProfiles();
        setProfiles(profilesList || []);
      }
    } catch (error) {
      console.error('Failed to load profiles:', error);
    }
  };

  const startCrawl = async () => {
    const url = selectedProfile 
      ? profiles.find(p => p.name === selectedProfile)?.baseUrl 
      : customUrl;

    if (!url) {
      alert('Please select a profile or enter a custom URL');
      return;
    }

    setIsCrawling(true);
    setCrawlProgress(null);

    try {
      // Start Python service if not already started
      if (!pythonServiceStarted && window.electronAPI?.codingCrawler?.startPythonService) {
        await window.electronAPI.codingCrawler.startPythonService();
        setPythonServiceStarted(true);
      }

      // Start the crawl
      if (window.electronAPI?.codingCrawler?.startCrawl) {
        await window.electronAPI.codingCrawler.startCrawl({
          url,
          maxPages,
          depth: crawlDepth,
          profileName: selectedProfile || 'custom'
        });
      }
    } catch (error) {
      console.error('Failed to start crawl:', error);
      setIsCrawling(false);
    }
  };

  const stopCrawl = async () => {
    try {
      if (window.electronAPI?.codingCrawler?.stopCrawl) {
        await window.electronAPI.codingCrawler.stopCrawl();
        setIsCrawling(false);
      }
    } catch (error) {
      console.error('Failed to stop crawl:', error);
    }
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      if (window.electronAPI?.codingCrawler?.search) {
        const results = await window.electronAPI.codingCrawler.search(searchQuery, searchType);
        setSearchResults(results || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const loadStats = async () => {
    try {
      if (window.electronAPI?.codingCrawler?.getStats) {
        const statistics = await window.electronAPI.codingCrawler.getStats();
        setStats(statistics);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const renderCrawlTab = () => (
    <div className="crawl-container">
      <h3>Crawl Documentation</h3>
      
      <div className="form-group">
        <label>Select Documentation Profile:</label>
        <select 
          value={selectedProfile} 
          onChange={(e) => {
            setSelectedProfile(e.target.value);
            setCustomUrl('');
          }}
          disabled={isCrawling}
        >
          <option value="">Custom URL</option>
          {profiles.map(profile => (
            <option key={profile.name} value={profile.name}>
              {profile.name} ({profile.baseUrl})
            </option>
          ))}
        </select>
      </div>

      {!selectedProfile && (
        <div className="form-group">
          <label>Custom URL:</label>
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="https://docs.example.com"
            disabled={isCrawling}
          />
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>Max Pages:</label>
          <input
            type="number"
            value={maxPages}
            onChange={(e) => setMaxPages(parseInt(e.target.value) || 100)}
            min="1"
            max="1000"
            disabled={isCrawling}
          />
        </div>

        <div className="form-group">
          <label>Crawl Depth:</label>
          <input
            type="number"
            value={crawlDepth}
            onChange={(e) => setCrawlDepth(parseInt(e.target.value) || 3)}
            min="1"
            max="10"
            disabled={isCrawling}
          />
        </div>
      </div>

      <div className="crawl-actions">
        {!isCrawling ? (
          <button className="btn-primary" onClick={startCrawl}>
            Start Crawl
          </button>
        ) : (
          <button className="btn-danger" onClick={stopCrawl}>
            Stop Crawl
          </button>
        )}
      </div>

      {crawlProgress && (
        <div className="crawl-progress">
          <div className="progress-status">
            {crawlProgress.status || 'Crawling...'}
          </div>
          {crawlProgress.currentUrl && (
            <div className="progress-url">
              Current: {crawlProgress.currentUrl}
            </div>
          )}
          <div className="progress-stats">
            Pages: {crawlProgress.pagesProcessed || 0} / {crawlProgress.totalPages || maxPages}
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${(crawlProgress.pagesProcessed / (crawlProgress.totalPages || maxPages)) * 100}%` 
              }}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderSearchTab = () => (
    <div className="search-container">
      <h3>Search Documentation</h3>
      
      <div className="search-bar">
        <input
          type="text"
          className="search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for functions, classes, concepts..."
          onKeyPress={(e) => e.key === 'Enter' && performSearch()}
        />
        <select 
          className="search-type"
          value={searchType}
          onChange={(e) => setSearchType(e.target.value as any)}
        >
          <option value="hybrid">Hybrid Search</option>
          <option value="keyword">Keyword Search</option>
          <option value="semantic">Semantic Search</option>
        </select>
        <button className="btn-search" onClick={performSearch}>
          Search
        </button>
      </div>

      <div className="search-results">
        {searchResults.length > 0 ? (
          <>
            <div className="results-count">
              Found {searchResults.length} results
            </div>
            {searchResults.map((result, index) => (
              <div key={index} className="search-result">
                <div className="result-header">
                  <span className="result-type">{result.type}</span>
                  <span className="result-score">Score: {result.score.toFixed(2)}</span>
                </div>
                <div className="result-content">
                  {result.content}
                </div>
              </div>
            ))}
          </>
        ) : searchQuery ? (
          <div className="no-results">No results found</div>
        ) : (
          <div className="search-hint">
            Start typing to search your crawled documentation
          </div>
        )}
      </div>
    </div>
  );

  const renderStatsTab = () => (
    <div className="stats-container">
      <h3>Crawl Statistics</h3>
      
      {stats ? (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalDocuments}</div>
            <div className="stat-label">Total Documents</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{stats.totalExamples}</div>
            <div className="stat-label">Code Examples</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-value">{stats.totalAPIs}</div>
            <div className="stat-label">API References</div>
          </div>
          
          <div className="stat-card full-width">
            <div className="stat-label">Languages</div>
            <div className="stat-list">
              {stats.languages.length > 0 ? (
                stats.languages.map(lang => (
                  <span key={lang} className="tag">{lang}</span>
                ))
              ) : (
                <span className="empty">No languages detected</span>
              )}
            </div>
          </div>
          
          <div className="stat-card full-width">
            <div className="stat-label">Frameworks</div>
            <div className="stat-list">
              {stats.frameworks.length > 0 ? (
                stats.frameworks.map(framework => (
                  <span key={framework} className="tag">{framework}</span>
                ))
              ) : (
                <span className="empty">No frameworks detected</span>
              )}
            </div>
          </div>
          
          {stats.lastCrawl && (
            <div className="stat-card full-width">
              <div className="stat-label">Last Crawl</div>
              <div className="stat-value">{new Date(stats.lastCrawl).toLocaleString()}</div>
            </div>
          )}
        </div>
      ) : (
        <div className="loading">Loading statistics...</div>
      )}
    </div>
  );

  return (
    <div className="coding-crawler-view">
      <div className="view-header">
        <h2>🕷️ Coding Crawler</h2>
        <p>Crawl and index documentation for LLM-optimized retrieval</p>
      </div>

      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'crawl' ? 'active' : ''}`}
          onClick={() => setActiveTab('crawl')}
        >
          Crawl
        </button>
        <button 
          className={`tab ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search
        </button>
        <button 
          className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Statistics
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'crawl' && renderCrawlTab()}
        {activeTab === 'search' && renderSearchTab()}
        {activeTab === 'stats' && renderStatsTab()}
      </div>

      {!pythonServiceStarted && (
        <div className="service-warning">
          Python service not started. Some features may be limited.
        </div>
      )}
    </div>
  );
};