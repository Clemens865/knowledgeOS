import { dialog, ipcMain } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import Store from 'electron-store';

interface WorkspaceConfig {
  version: string;
  name: string;
  created: string;
  folders: {
    notes: string;
    daily: string;
    projects: string;
    references: string;
    attachments: string;
  };
}

interface RecentWorkspace {
  path: string;
  name: string;
  lastOpened: string;
}

interface StoreType {
  currentWorkspace?: string;
  recentWorkspaces?: RecentWorkspace[];
}

const store = new Store<StoreType>();

// Default folder structure
const DEFAULT_FOLDERS = [
  'notes',
  'daily',
  'projects',
  'references',
  'attachments',
  '.knowledgeos'
];

// Default welcome content
const WELCOME_CONTENT = `# Welcome to KnowledgeOS

Your intelligent knowledge management system is ready!

## Getting Started

1. **Create Notes**: Click "New Note" or use Cmd/Ctrl+N
2. **Link Ideas**: Use [[wiki links]] to connect concepts
3. **Tag Content**: Use #tags to organize your knowledge
4. **Daily Notes**: Automatic daily notes capture your thoughts
5. **AI Assistant**: Get help synthesizing and connecting ideas

## Tips

- Use \`[[\` to create links between notes
- Press \`Cmd/Ctrl+K\` for quick search
- Your notes are saved automatically
- All data stays local on your computer

## Keyboard Shortcuts

- \`Cmd/Ctrl+N\`: New note
- \`Cmd/Ctrl+O\`: Open note
- \`Cmd/Ctrl+S\`: Save note
- \`Cmd/Ctrl+K\`: Quick search
- \`Cmd/Ctrl+P\`: Command palette

Happy knowledge building! 🚀
`;

const GETTING_STARTED_CONTENT = `# Getting Started with KnowledgeOS

## Core Concepts

### 📝 Notes
Everything in KnowledgeOS is a note. Notes can be:
- **Documents**: Long-form content
- **Quick Captures**: Thoughts and ideas
- **Daily Notes**: Automatic journal entries
- **Project Notes**: Organized documentation

### 🔗 Linking
Connect your ideas using wiki-style links:
- \`[[Note Name]]\`: Creates a link to another note
- Links are bidirectional (backlinks)
- Build a knowledge graph naturally

### 🏷️ Tags
Organize with tags:
- Use \`#tag\` anywhere in your notes
- Tags are automatically indexed
- Find related content instantly

### 🤖 AI Features
Your AI assistant helps you:
- Synthesize information
- Find connections
- Answer questions
- Generate summaries

## Workflow Examples

### Daily Journaling
1. Open daily note (auto-created)
2. Write thoughts and observations
3. Link to relevant notes
4. Review at end of week

### Research Project
1. Create project folder
2. Add research notes
3. Link sources and ideas
4. Use AI to synthesize findings

### Learning Something New
1. Create topic note
2. Add learning resources
3. Write summaries
4. Connect to existing knowledge

## Advanced Features

### Templates
Create reusable templates for:
- Meeting notes
- Book summaries
- Project plans
- Daily reviews

### Knowledge Graph
Visualize connections between notes:
- See clusters of related ideas
- Identify knowledge gaps
- Discover unexpected connections

### Smart Search
Find anything instantly:
- Full-text search
- Tag filtering
- Date ranges
- AI-powered semantic search

## Privacy & Security

- ✅ All data stored locally
- ✅ No cloud sync required
- ✅ You own your data
- ✅ Export anytime

Need help? Type your question in the chat!
`;

export async function setupWorkspaceHandlers() {
  // Select folder dialog
  ipcMain.handle('dialog:selectFolder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Choose Workspace Folder',
      buttonLabel: 'Select Folder'
    });
    
    return {
      canceled: result.canceled,
      filePaths: result.filePaths
    };
  });

  // Create workspace structure
  ipcMain.handle('workspace:create', async (_, workspacePath: string) => {
    try {
      // Create folders
      for (const folder of DEFAULT_FOLDERS) {
        const folderPath = path.join(workspacePath, folder);
        await fs.mkdir(folderPath, { recursive: true });
      }

      // Create config file
      const config: WorkspaceConfig = {
        version: '1.0.0',
        name: path.basename(workspacePath),
        created: new Date().toISOString(),
        folders: {
          notes: 'notes',
          daily: 'daily',
          projects: 'projects',
          references: 'references',
          attachments: 'attachments'
        }
      };

      await fs.writeFile(
        path.join(workspacePath, '.knowledgeos', 'config.json'),
        JSON.stringify(config, null, 2)
      );

      // Create welcome files
      await fs.writeFile(
        path.join(workspacePath, 'notes', 'Welcome.md'),
        WELCOME_CONTENT
      );

      await fs.writeFile(
        path.join(workspacePath, 'notes', 'Getting Started.md'),
        GETTING_STARTED_CONTENT
      );

      // Create today's daily note
      const today = new Date().toISOString().split('T')[0];
      const dailyContent = `# ${today}\n\n## Notes\n\n## Tasks\n- [ ] \n\n## Ideas\n\n`;
      await fs.writeFile(
        path.join(workspacePath, 'daily', `${today}.md`),
        dailyContent
      );

      // Add to recent workspaces
      await addToRecentWorkspaces(workspacePath);

      return { success: true };
    } catch (error) {
      console.error('Error creating workspace:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Open existing workspace
  ipcMain.handle('workspace:open', async (_, workspacePath: string) => {
    try {
      // Check if it's a valid workspace
      const configPath = path.join(workspacePath, '.knowledgeos', 'config.json');
      
      try {
        await fs.access(configPath);
      } catch {
        // Not a workspace, offer to create it
        return { 
          success: false, 
          needsInit: true,
          message: 'This folder is not a KnowledgeOS workspace. Would you like to initialize it?'
        };
      }

      // Load workspace config
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // Add to recent workspaces
      await addToRecentWorkspaces(workspacePath);

      // Store current workspace
      (store as any).set('currentWorkspace', workspacePath);

      return { 
        success: true, 
        config,
        path: workspacePath
      };
    } catch (error) {
      console.error('Error opening workspace:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get recent workspaces
  ipcMain.handle('workspace:getRecent', async () => {
    const recent = (store as any).get('recentWorkspaces', []) as RecentWorkspace[];
    
    // Filter out non-existent paths
    const validRecent = [];
    for (const workspace of recent) {
      try {
        await fs.access(workspace.path);
        validRecent.push(workspace);
      } catch {
        // Path doesn't exist, skip it
      }
    }
    
    // Update store with valid paths only
    if (validRecent.length !== recent.length) {
      (store as any).set('recentWorkspaces', validRecent);
    }
    
    return validRecent;
  });

  // Get current workspace
  ipcMain.handle('workspace:getCurrent', async () => {
    return (store as any).get('currentWorkspace', null);
  });

  // List files in workspace
  ipcMain.handle('workspace:listFiles', async (_, folderPath: string) => {
    try {
      const entries = await fs.readdir(folderPath, { withFileTypes: true });
      
      const files = await Promise.all(entries.map(async (entry) => {
        const fullPath = path.join(folderPath, entry.name);
        const stats = await fs.stat(fullPath);
        
        return {
          name: entry.name,
          path: fullPath,
          isDirectory: entry.isDirectory(),
          isFile: entry.isFile(),
          size: stats.size,
          modified: stats.mtime.toISOString(),
          created: stats.birthtime.toISOString()
        };
      }));

      // Sort: folders first, then files, alphabetically
      files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      return { success: true, files };
    } catch (error) {
      console.error('Error listing files:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Create new note
  ipcMain.handle('workspace:createNote', async (_, folderPath: string, fileName: string) => {
    try {
      const filePath = path.join(folderPath, fileName);
      
      // Check if file already exists
      try {
        await fs.access(filePath);
        return { 
          success: false, 
          error: 'File already exists',
          exists: true 
        };
      } catch {
        // File doesn't exist, good to create
      }

      // Create with template
      const title = path.basename(fileName, '.md');
      const content = `# ${title}\n\nCreated: ${new Date().toISOString()}\n\n`;
      
      await fs.writeFile(filePath, content);
      
      return { success: true, path: filePath };
    } catch (error) {
      console.error('Error creating note:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

async function addToRecentWorkspaces(workspacePath: string) {
  const recent = (store as any).get('recentWorkspaces', []) as RecentWorkspace[];
  
  // Remove if already exists
  const filtered = recent.filter(w => w.path !== workspacePath);
  
  // Add to beginning
  filtered.unshift({
    path: workspacePath,
    name: path.basename(workspacePath),
    lastOpened: new Date().toISOString()
  });
  
  // Keep only last 10
  const trimmed = filtered.slice(0, 10);
  
  (store as any).set('recentWorkspaces', trimmed);
}