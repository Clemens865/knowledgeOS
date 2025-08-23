# KnowledgeOS Implementation Plan

## 🎯 Immediate Priority: Workspace Management

### Step 1: Create Workspace UI Components

```typescript
// src/renderer/components/WorkspaceModal/WorkspaceModal.tsx
interface WorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWorkspace: (path: string) => void;
}

// Features:
// - "Open Existing Workspace" button
// - "Create New Workspace" button
// - Recent workspaces list
// - Folder browser dialog
```

### Step 2: Workspace Initialization

```typescript
// src/main/workspace.ts
interface WorkspaceManager {
  createWorkspace(path: string): Promise<void>;
  openWorkspace(path: string): Promise<Workspace>;
  getRecentWorkspaces(): Promise<string[]>;
  initializeStructure(path: string): Promise<void>;
}

// Default structure:
const DEFAULT_FOLDERS = [
  'notes',
  'daily',
  'projects',
  'references',
  'attachments',
  '.knowledgeos'
];

// Default files:
const DEFAULT_FILES = [
  'notes/Welcome.md',
  'notes/Getting Started.md',
  '.knowledgeos/config.json'
];
```

### Step 3: Integrate with Current UI

1. **Add "Open Workspace" to quick actions**
```typescript
<button className="quick-action" onClick={openWorkspaceModal}>
  Open Workspace
</button>
```

2. **Show current workspace in header**
```typescript
<div className="workspace-indicator">
  📁 {workspaceName || 'No workspace open'}
</div>
```

3. **Add File Tree to Sidebar**
```typescript
// When workspace is open, show file tree instead of just settings
<FileTree 
  workspace={currentWorkspace}
  onFileSelect={handleFileSelect}
/>
```

## 📝 User Stories with Implementation

### Story 1: First Time User
**"As a new user, I want to create my knowledge base"**

1. User launches app
2. Sees welcome screen with "Create Knowledge Base" button
3. Clicks button → Opens folder selector
4. Chooses/creates folder
5. App creates structure:
   ```
   /my-knowledge/
     ├── notes/
     │   ├── Welcome.md
     │   └── Getting Started.md
     ├── daily/
     │   └── 2025-08-23.md (auto-created)
     ├── projects/
     ├── references/
     └── .knowledgeos/
         └── config.json
   ```
6. Opens Welcome.md in editor

### Story 2: Daily Note Creation
**"As a user, I want to quickly capture thoughts"**

1. User opens app (workspace auto-loads)
2. Types in chat input: "Today I learned about..."
3. System automatically:
   - Creates/appends to `daily/2025-08-23.md`
   - Extracts any [[links]] or #tags
   - Updates knowledge graph

### Story 3: Knowledge Building
**"As a user, I want to build connected knowledge"**

1. User writes note with [[concepts]]
2. System creates stub files for missing links
3. Shows backlinks in sidebar
4. Suggests related notes
5. AI helps connect ideas

## 🗂️ File Storage Implementation

### Option A: Pure Markdown Files (Recommended)
```markdown
---
id: unique-id
created: 2025-08-23T10:00:00Z
modified: 2025-08-23T10:30:00Z
tags: [knowledge, management, ai]
---

# Note Title

Content with [[links]] and #tags
```

**Pros:**
- Works with any Markdown editor
- Git-friendly
- Portable
- Future-proof

### Option B: SQLite + Markdown
- SQLite for metadata, search index, graph
- Markdown files for content
- Best of both worlds

## 🔄 Implementation Phases

### Phase 1: Basic Workspace (Week 1)
- [ ] Workspace modal UI
- [ ] Folder selection dialog
- [ ] Create default structure
- [ ] Store workspace path
- [ ] Load on startup

### Phase 2: File Operations (Week 1-2)
- [ ] File tree component
- [ ] Create/edit/delete files
- [ ] Monaco editor integration
- [ ] Auto-save
- [ ] File watchers

### Phase 3: Knowledge Features (Week 2-3)
- [ ] Link extraction
- [ ] Backlinks calculation
- [ ] Tag system
- [ ] Search implementation
- [ ] Graph visualization

### Phase 4: AI Integration (Week 3-4)
- [ ] API key management
- [ ] OpenAI integration
- [ ] Anthropic integration
- [ ] Context injection
- [ ] Smart suggestions

## 🏗️ Technical Architecture

```typescript
// Main Process
- WorkspaceManager (handles file operations)
- DatabaseManager (SQLite for indexing)
- FileWatcher (monitors changes)
- SearchEngine (full-text search)

// Renderer Process
- WorkspaceContext (React context for state)
- FileTreeComponent (navigation)
- EditorView (Monaco-based)
- KnowledgePanel (links, tags, etc.)
- ChatInterface (AI interaction)

// IPC Channels
- workspace:create
- workspace:open
- workspace:getRecent
- file:read
- file:write
- file:delete
- search:query
- ai:complete
```

## 🎨 UI Flow Diagram

```
┌─────────────────────────────────────┐
│         Welcome Screen              │
│  ┌─────────────────────────────┐    │
│  │  Create Knowledge Base      │    │
│  └─────────────────────────────┘    │
│  ┌─────────────────────────────┐    │
│  │  Open Existing             │    │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
                ↓
┌─────────────────────────────────────┐
│         Main Interface              │
│ ┌──────┬─────────────┬───────────┐ │
│ │ Tree │   Editor    │ Knowledge │ │
│ │      │             │   Panel   │ │
│ │ notes│  # Title    │           │ │
│ │  └📄 │             │ Backlinks │ │
│ │ daily│  Content... │  - [[a]]  │ │
│ │  └📄 │             │  - [[b]]  │ │
│ └──────┴─────────────┴───────────┘ │
│ ┌─────────────────────────────────┐ │
│ │    Chat/Command Input           │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## 🚀 Quick Wins

1. **Workspace Selector** (2 hours)
   - Simple modal with folder picker
   - Store path in electron-store

2. **File Tree** (3 hours)
   - Use existing React component library
   - Connect to file system via IPC

3. **Basic Editor** (2 hours)
   - Switch chat view to editor view
   - Load/save files

4. **Daily Notes** (1 hour)
   - Auto-create with date
   - Quick capture from chat

## 💾 Data Models

```typescript
interface Workspace {
  id: string;
  path: string;
  name: string;
  created: Date;
  lastOpened: Date;
  settings: {
    theme: string;
    defaultFolder: string;
    autoSave: boolean;
    aiProvider: string;
  };
}

interface Note {
  id: string;
  path: string;
  title: string;
  content: string;
  frontmatter: {
    created: Date;
    modified: Date;
    tags: string[];
    aliases: string[];
  };
  links: {
    outgoing: string[];
    incoming: string[];
  };
}

interface KnowledgeIndex {
  notes: Map<string, Note>;
  tags: Map<string, string[]>;
  links: Map<string, string[]>;
  searchIndex: any; // Lunr/FlexSearch
}
```

## 🔧 Configuration

```json
// .knowledgeos/config.json
{
  "version": "1.0.0",
  "workspace": {
    "name": "My Knowledge Base",
    "created": "2025-08-23T10:00:00Z",
    "folders": {
      "notes": "notes",
      "daily": "daily",
      "templates": "templates"
    }
  },
  "plugins": {
    "wiki-links": { "enabled": true },
    "tags": { "enabled": true },
    "daily-notes": { 
      "enabled": true,
      "format": "YYYY-MM-DD"
    }
  },
  "ai": {
    "provider": "openai",
    "model": "gpt-4"
  }
}
```

## ✅ Definition of Done

Each feature is complete when:
1. UI is implemented and polished
2. Functionality works end-to-end
3. Data persists correctly
4. Errors are handled gracefully
5. User can accomplish their goal
6. Code is committed to GitHub

## 🎯 Next Actions

1. **Today:** Create WorkspaceModal component
2. **Tomorrow:** Implement workspace creation/loading
3. **Day 3:** Add file tree navigation
4. **Day 4:** Connect editor to file system
5. **Day 5:** Implement auto-save and file watching

The goal is to have a working knowledge base system where users can create, edit, and organize their notes within a week!