import { ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface KnowledgeStats {
  totalNotes: number;
  totalWords: number;
  totalCharacters: number;
  totalLinks: number;
  averageNoteLength: number;
  longestNote: { path: string; words: number } | null;
  shortestNote: { path: string; words: number } | null;
  recentNotes: NoteInfo[];
  topTags: { tag: string; count: number }[];
  orphanedNotes: string[];
  mostLinkedNotes: { path: string; linkCount: number }[];
  folderStats: { [folder: string]: number };
  dailyActivity: { date: string; notesModified: number }[];
  growthOverTime: { date: string; totalNotes: number }[];
}

interface NoteInfo {
  path: string;
  name: string;
  words: number;
  modified: Date;
  created: Date;
  links: string[];
  tags: string[];
}

class AnalyticsService {
  private workspacePath: string;
  private cache: Map<string, NoteInfo> = new Map();

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  /**
   * Main method to gather all analytics - READ ONLY
   */
  async gatherStats(): Promise<KnowledgeStats> {
    try {
      // Gather all markdown files
      const notes = await this.getAllNotes();
      
      if (notes.length === 0) {
        return this.getEmptyStats();
      }

      // Calculate various statistics
      const totalWords = notes.reduce((sum, note) => sum + note.words, 0);
      const totalCharacters = notes.reduce((sum, note) => sum + (note.words * 5), 0); // Approximate
      const totalLinks = notes.reduce((sum, note) => sum + note.links.length, 0);
      
      // Find longest and shortest notes
      const sortedByLength = [...notes].sort((a, b) => b.words - a.words);
      const longestNote = sortedByLength[0];
      const shortestNote = sortedByLength[sortedByLength.length - 1];
      
      // Get recent notes
      const recentNotes = [...notes]
        .sort((a, b) => b.modified.getTime() - a.modified.getTime())
        .slice(0, 10);
      
      // Calculate tag statistics
      const tagCounts = new Map<string, number>();
      notes.forEach(note => {
        note.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });
      const topTags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Find orphaned notes (no links in or out)
      const linkedNotes = new Set<string>();
      notes.forEach(note => {
        note.links.forEach(link => linkedNotes.add(link));
        if (note.links.length > 0) {
          linkedNotes.add(note.path);
        }
      });
      const orphanedNotes = notes
        .filter(note => !linkedNotes.has(note.path))
        .map(note => note.path);
      
      // Find most linked notes
      const linkCounts = new Map<string, number>();
      notes.forEach(note => {
        note.links.forEach(link => {
          linkCounts.set(link, (linkCounts.get(link) || 0) + 1);
        });
      });
      const mostLinkedNotes = Array.from(linkCounts.entries())
        .map(([path, linkCount]) => ({ path, linkCount }))
        .sort((a, b) => b.linkCount - a.linkCount)
        .slice(0, 10);
      
      // Calculate folder statistics
      const folderStats: { [folder: string]: number } = {};
      notes.forEach(note => {
        const folder = path.dirname(note.path) || 'root';
        folderStats[folder] = (folderStats[folder] || 0) + 1;
      });
      
      // Calculate daily activity (last 30 days)
      const dailyActivity = this.calculateDailyActivity(notes, 30);
      
      // Calculate growth over time
      const growthOverTime = this.calculateGrowthOverTime(notes);
      
      return {
        totalNotes: notes.length,
        totalWords,
        totalCharacters,
        totalLinks,
        averageNoteLength: Math.round(totalWords / notes.length),
        longestNote: longestNote ? { path: longestNote.path, words: longestNote.words } : null,
        shortestNote: shortestNote ? { path: shortestNote.path, words: shortestNote.words } : null,
        recentNotes,
        topTags,
        orphanedNotes,
        mostLinkedNotes,
        folderStats,
        dailyActivity,
        growthOverTime
      };
    } catch (error) {
      console.error('Error gathering analytics:', error);
      return this.getEmptyStats();
    }
  }

  /**
   * Get all markdown notes from workspace - READ ONLY
   */
  private async getAllNotes(): Promise<NoteInfo[]> {
    const notes: NoteInfo[] = [];
    
    try {
      await this.scanDirectory(this.workspacePath, notes, '');
    } catch (error) {
      console.error('Error scanning directory:', error);
    }
    
    return notes;
  }

  /**
   * Recursively scan directory for markdown files - READ ONLY
   */
  private async scanDirectory(dirPath: string, notes: NoteInfo[], relativePath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files and common ignore patterns
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively scan subdirectories (limit depth for safety)
          if (relativePath.split(path.sep).length < 5) {
            await this.scanDirectory(fullPath, notes, relPath);
          }
        } else if (entry.name.endsWith('.md')) {
          const noteInfo = await this.analyzeNote(fullPath, relPath);
          if (noteInfo) {
            notes.push(noteInfo);
          }
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${dirPath}:`, error);
    }
  }

  /**
   * Analyze a single note file - READ ONLY
   */
  private async analyzeNote(fullPath: string, relativePath: string): Promise<NoteInfo | null> {
    try {
      // Check cache first
      if (this.cache.has(relativePath)) {
        const cached = this.cache.get(relativePath)!;
        const stats = await fs.stat(fullPath);
        // If file hasn't been modified, return cached version
        if (stats.mtime.getTime() === cached.modified.getTime()) {
          return cached;
        }
      }
      
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      
      // Count words (simple approximation)
      const words = content.split(/\s+/).filter(word => word.length > 0).length;
      
      // Extract links (wiki-style [[link]] and markdown [text](link))
      const wikiLinks = content.match(/\[\[([^\]]+)\]\]/g) || [];
      const mdLinks = content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
      const links = [
        ...wikiLinks.map(link => link.slice(2, -2)),
        ...mdLinks.map(link => {
          const match = link.match(/\[([^\]]+)\]\(([^)]+)\)/);
          return match ? match[2] : '';
        })
      ].filter(Boolean);
      
      // Extract tags (#tag)
      const tags = (content.match(/#[\w-]+/g) || [])
        .map(tag => tag.slice(1))
        .filter((tag, index, self) => self.indexOf(tag) === index);
      
      const noteInfo: NoteInfo = {
        path: relativePath,
        name: path.basename(relativePath, '.md'),
        words,
        modified: stats.mtime,
        created: stats.birthtime || stats.ctime,
        links,
        tags
      };
      
      // Update cache
      this.cache.set(relativePath, noteInfo);
      
      return noteInfo;
    } catch (error) {
      console.error(`Error analyzing note ${relativePath}:`, error);
      return null;
    }
  }

  /**
   * Calculate daily activity for the last N days
   */
  private calculateDailyActivity(notes: NoteInfo[], days: number): { date: string; notesModified: number }[] {
    const activity: { [date: string]: number } = {};
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      activity[dateStr] = 0;
    }
    
    // Count modifications
    notes.forEach(note => {
      if (note.modified >= cutoff) {
        const dateStr = note.modified.toISOString().split('T')[0];
        activity[dateStr] = (activity[dateStr] || 0) + 1;
      }
    });
    
    return Object.entries(activity)
      .map(([date, notesModified]) => ({ date, notesModified }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate growth over time
   */
  private calculateGrowthOverTime(notes: NoteInfo[]): { date: string; totalNotes: number }[] {
    if (notes.length === 0) return [];
    
    // Sort notes by creation date
    const sortedByCreation = [...notes].sort((a, b) => a.created.getTime() - b.created.getTime());
    
    // Group by month
    const growthMap = new Map<string, number>();
    let cumulative = 0;
    
    sortedByCreation.forEach(note => {
      cumulative++;
      const monthKey = note.created.toISOString().slice(0, 7); // YYYY-MM
      growthMap.set(monthKey, cumulative);
    });
    
    return Array.from(growthMap.entries())
      .map(([date, totalNotes]) => ({ date, totalNotes }))
      .slice(-12); // Last 12 months
  }

  /**
   * Return empty stats when no data available
   */
  private getEmptyStats(): KnowledgeStats {
    return {
      totalNotes: 0,
      totalWords: 0,
      totalCharacters: 0,
      totalLinks: 0,
      averageNoteLength: 0,
      longestNote: null,
      shortestNote: null,
      recentNotes: [],
      topTags: [],
      orphanedNotes: [],
      mostLinkedNotes: [],
      folderStats: {},
      dailyActivity: [],
      growthOverTime: []
    };
  }
}

export function setupAnalyticsHandlers() {
  ipcMain.handle('analytics:getStats', async (_, workspacePath: string) => {
    try {
      console.log('📊 Gathering analytics for workspace:', workspacePath);
      const service = new AnalyticsService(workspacePath);
      const stats = await service.gatherStats();
      console.log('📊 Analytics gathered successfully');
      return stats;
    } catch (error) {
      console.error('Error in analytics handler:', error);
      throw error;
    }
  });
}