import React, { useState, useEffect } from 'react';
import './Analytics.css';

// Re-declare the interface locally since it's needed for TypeScript
interface KnowledgeStats {
  totalNotes: number;
  totalWords: number;
  totalCharacters: number;
  totalLinks: number;
  averageNoteLength: number;
  longestNote: { path: string; words: number } | null;
  shortestNote: { path: string; words: number } | null;
  recentNotes: Array<{
    path: string;
    name: string;
    words: number;
    modified: Date | string;
    created: Date | string;
    links: string[];
    tags: string[];
  }>;
  topTags: { tag: string; count: number }[];
  orphanedNotes: string[];
  mostLinkedNotes: { path: string; linkCount: number }[];
  folderStats: { [folder: string]: number };
  dailyActivity: { date: string; notesModified: number }[];
  growthOverTime: { date: string; totalNotes: number }[];
}

interface AnalyticsViewProps {
  workspacePath: string;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ workspacePath }) => {
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Start with false to avoid persistent loading
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'connections' | 'growth'>('overview');

  useEffect(() => {
    if (workspacePath) {
      loadAnalytics();
    }
  }, [workspacePath]);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Use IPC to get analytics from main process
      const analyticsData = await window.electronAPI.analytics.getStats(workspacePath);
      setStats(analyticsData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
      setError('Unable to load analytics. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    }).format(dateObj);
  };

  if (error) {
    return (
      <div className="analytics-error">
        <span className="error-icon">⚠️</span>
        <p>{error}</p>
        <button onClick={loadAnalytics} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Analyzing your knowledge base...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="analytics-empty">
        <p>No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <h2>📊 Knowledge Analytics</h2>
        <button onClick={loadAnalytics} className="refresh-button" title="Refresh">
          🔄
        </button>
      </div>

      <div className="analytics-tabs">
        <button 
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab-button ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
        <button 
          className={`tab-button ${activeTab === 'connections' ? 'active' : ''}`}
          onClick={() => setActiveTab('connections')}
        >
          Connections
        </button>
        <button 
          className={`tab-button ${activeTab === 'growth' ? 'active' : ''}`}
          onClick={() => setActiveTab('growth')}
        >
          Growth
        </button>
      </div>

      <div className="analytics-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* Key Metrics */}
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-value">{formatNumber(stats.totalNotes)}</div>
                <div className="metric-label">Total Notes</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{formatNumber(stats.totalWords)}</div>
                <div className="metric-label">Total Words</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{formatNumber(stats.totalLinks)}</div>
                <div className="metric-label">Total Links</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{formatNumber(stats.averageNoteLength)}</div>
                <div className="metric-label">Avg Words/Note</div>
              </div>
            </div>

            {/* Folder Distribution */}
            <div className="stats-section">
              <h3>📁 Folder Distribution</h3>
              <div className="folder-stats">
                {Object.entries(stats.folderStats).map(([folder, count]) => (
                  <div key={folder} className="folder-item">
                    <span className="folder-name">{folder === '.' ? 'root' : folder}</span>
                    <span className="folder-count">{count} notes</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Tags */}
            {stats.topTags.length > 0 && (
              <div className="stats-section">
                <h3>🏷️ Top Tags</h3>
                <div className="tags-list">
                  {stats.topTags.map(({ tag, count }) => (
                    <div key={tag} className="tag-item">
                      <span className="tag-name">#{tag}</span>
                      <span className="tag-count">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="activity-tab">
            {/* Recent Notes */}
            <div className="stats-section">
              <h3>📝 Recently Modified</h3>
              <div className="recent-notes">
                {stats.recentNotes.slice(0, 5).map((note) => (
                  <div key={note.path} className="recent-note">
                    <div className="note-info">
                      <span className="note-name">{note.name}</span>
                      <span className="note-meta">
                        {note.words} words • {formatDate(note.modified)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Daily Activity Chart */}
            <div className="stats-section">
              <h3>📈 Last 30 Days Activity</h3>
              <div className="activity-chart">
                <div className="chart-bars">
                  {stats.dailyActivity.map(({ date, notesModified }) => {
                    const maxActivity = Math.max(...stats.dailyActivity.map(d => d.notesModified));
                    const height = maxActivity > 0 ? (notesModified / maxActivity) * 100 : 0;
                    return (
                      <div 
                        key={date} 
                        className="chart-bar"
                        title={`${date}: ${notesModified} notes`}
                      >
                        <div 
                          className="bar-fill" 
                          style={{ height: `${height}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'connections' && (
          <div className="connections-tab">
            {/* Most Linked Notes */}
            {stats.mostLinkedNotes.length > 0 && (
              <div className="stats-section">
                <h3>🔗 Most Connected Notes</h3>
                <div className="linked-notes">
                  {stats.mostLinkedNotes.map(({ path: notePath, linkCount }) => (
                    <div key={notePath} className="linked-note">
                      <span className="note-path">{notePath}</span>
                      <span className="link-badge">{linkCount} links</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orphaned Notes */}
            {stats.orphanedNotes.length > 0 && (
              <div className="stats-section">
                <h3>🏝️ Orphaned Notes</h3>
                <p className="section-description">
                  Notes without any connections ({stats.orphanedNotes.length} total)
                </p>
                <div className="orphaned-list">
                  {stats.orphanedNotes.slice(0, 10).map((notePath) => (
                    <div key={notePath} className="orphaned-note">
                      {notePath}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note Extremes */}
            <div className="stats-section">
              <h3>📏 Note Extremes</h3>
              <div className="extremes">
                {stats.longestNote && (
                  <div className="extreme-item">
                    <span className="extreme-label">Longest:</span>
                    <span className="extreme-value">
                      {stats.longestNote.path} ({formatNumber(stats.longestNote.words)} words)
                    </span>
                  </div>
                )}
                {stats.shortestNote && (
                  <div className="extreme-item">
                    <span className="extreme-label">Shortest:</span>
                    <span className="extreme-value">
                      {stats.shortestNote.path} ({stats.shortestNote.words} words)
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'growth' && (
          <div className="growth-tab">
            <div className="stats-section">
              <h3>📊 Knowledge Growth</h3>
              <div className="growth-chart">
                <div className="growth-bars">
                  {stats.growthOverTime.map(({ date, totalNotes }) => {
                    const maxNotes = Math.max(...stats.growthOverTime.map(d => d.totalNotes));
                    const height = maxNotes > 0 ? (totalNotes / maxNotes) * 100 : 0;
                    return (
                      <div key={date} className="growth-bar-container">
                        <div 
                          className="growth-bar"
                          title={`${date}: ${totalNotes} total notes`}
                        >
                          <div 
                            className="bar-fill" 
                            style={{ height: `${height}%` }}
                          />
                        </div>
                        <div className="growth-label">{date.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Growth Stats */}
            <div className="stats-section">
              <h3>📈 Growth Statistics</h3>
              <div className="growth-stats">
                <div className="growth-stat">
                  <span className="stat-label">Total Knowledge Base:</span>
                  <span className="stat-value">{formatNumber(stats.totalWords)} words</span>
                </div>
                <div className="growth-stat">
                  <span className="stat-label">Average Note Size:</span>
                  <span className="stat-value">{formatNumber(stats.averageNoteLength)} words</span>
                </div>
                <div className="growth-stat">
                  <span className="stat-label">Total Connections:</span>
                  <span className="stat-value">{formatNumber(stats.totalLinks)} links</span>
                </div>
                <div className="growth-stat">
                  <span className="stat-label">Unique Tags:</span>
                  <span className="stat-value">{stats.topTags.length}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};