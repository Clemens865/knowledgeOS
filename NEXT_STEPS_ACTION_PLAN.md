# KnowledgeOS Next Steps Action Plan
## Immediate Implementation Roadmap

### 🎯 Priority Matrix

| Priority | Feature | Impact | Effort | Why Now? |
|----------|---------|--------|--------|----------|
| 🔴 P1 | Wiki-Links | High | Medium | Core differentiator, enables knowledge connectivity |
| 🔴 P1 | Multiple Files/Tabs | High | Low | Basic usability requirement |
| 🔴 P1 | AI Integration | High | High | Main value proposition |
| 🟡 P2 | Search | High | Medium | Essential for navigation |
| 🟡 P2 | Markdown Preview | Medium | Low | Expected feature |
| 🟡 P2 | Theme System | Medium | Low | User experience |
| 🟢 P3 | Command Execution | Medium | Medium | Power user feature |
| 🟢 P3 | Settings Storage | Medium | Medium | Persistence needed |
| 🟢 P3 | Graph View | Low | High | Future phase |

## 📋 Week 1: Core Functionality Sprint

### Day 1: Multiple File Support
**Goal**: Open and edit multiple files simultaneously

#### Tasks:
```typescript
// 1. Add tab state to App.tsx
interface TabState {
  id: string;
  filePath: string;
  content: string;
  isDirty: boolean;
  isActive: boolean;
}

// 2. Create TabBar component
// src/renderer/components/TabBar/TabBar.tsx
- Display open files as tabs
- Active tab highlighting
- Close button (×) on each tab
- Unsaved indicator (•)

// 3. Update state management
- Track multiple open files
- Switch between tabs
- Handle close with unsaved changes
```

**Files to modify**:
- `src/renderer/App.tsx` - Add tab state management
- `src/renderer/components/TabBar/TabBar.tsx` - New component
- `src/renderer/components/Editor/Editor.tsx` - Handle multiple files

### Day 2: Wiki-Links Implementation
**Goal**: Parse and navigate [[wiki-links]]

#### Installation:
```bash
npm install remark remark-wiki-link rehype-react unified
npm install @types/remark --save-dev
```

#### Implementation:
```typescript
// 1. Create link parser
// src/renderer/utils/wikiLinks.ts
export const parseWikiLinks = (content: string) => {
  const linkRegex = /\[\[([^\]]+)\]\]/g;
  return content.match(linkRegex);
};

// 2. Monaco editor decoration
// Add link highlighting and click handlers
editor.onMouseDown((e) => {
  if (isWikiLink(e.target)) {
    navigateToFile(extractLinkPath(e.target));
  }
});

// 3. Auto-completion provider
monaco.languages.registerCompletionItemProvider('markdown', {
  provideCompletionItems: (model, position) => {
    // Return list of available files for [[completion
  }
});
```

**Files to create**:
- `src/renderer/utils/wikiLinks.ts` - Link parsing utilities
- `src/renderer/services/linkService.ts` - Navigation logic

### Day 3: Markdown Preview
**Goal**: Split-pane markdown preview

#### Installation:
```bash
npm install react-markdown remark-gfm react-split-pane
npm install @types/react-split-pane --save-dev
```

#### Implementation:
```typescript
// 1. Create Preview component
// src/renderer/components/Preview/Preview.tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 2. Add split pane to Editor
import SplitPane from 'react-split-pane';

<SplitPane split="vertical" defaultSize="50%">
  <MonacoEditor />
  <Preview content={content} />
</SplitPane>
```

### Day 4-5: AI Provider Integration
**Goal**: Connect to OpenAI and Anthropic

#### Installation:
```bash
npm install openai @anthropic-ai/sdk
npm install eventsource-parser  # for streaming
```

#### Architecture:
```typescript
// 1. Provider interface
// src/renderer/services/ai/types.ts
interface AIProvider {
  name: string;
  chat(messages: Message[]): AsyncGenerator<string>;
  configure(apiKey: string): void;
}

// 2. OpenAI implementation
// src/renderer/services/ai/openai.ts
class OpenAIProvider implements AIProvider {
  async *chat(messages) {
    const stream = await openai.chat.completions.create({
      messages,
      model: 'gpt-4',
      stream: true,
    });
    
    for await (const chunk of stream) {
      yield chunk.choices[0]?.delta?.content || '';
    }
  }
}

// 3. API key management
// Store in electron-store, not in code
```

## 📋 Week 2: Search & Persistence Sprint

### Day 6-7: Search Implementation
**Goal**: Full-text search across all markdown files

#### Installation:
```bash
npm install minisearch
```

#### Implementation:
```typescript
// 1. Search index service
// src/renderer/services/searchService.ts
import MiniSearch from 'minisearch';

class SearchService {
  private index: MiniSearch;
  
  buildIndex(files: FileContent[]) {
    this.index = new MiniSearch({
      fields: ['title', 'content'],
      storeFields: ['title', 'path']
    });
    this.index.addAll(files);
  }
  
  search(query: string) {
    return this.index.search(query);
  }
}

// 2. Search UI component
// Update existing search tab to display results
```

### Day 8: Data Persistence
**Goal**: Settings and preferences storage

#### Installation:
```bash
npm install electron-store
```

#### Implementation:
```typescript
// 1. Settings store
// src/main/settings.ts
import Store from 'electron-store';

const store = new Store({
  schema: {
    theme: { type: 'string', default: 'light' },
    recentFiles: { type: 'array', default: [] },
    aiProviders: { type: 'object', default: {} }
  }
});

// 2. IPC handlers for settings
ipcMain.handle('settings:get', (_, key) => store.get(key));
ipcMain.handle('settings:set', (_, key, value) => store.set(key, value));
```

### Day 9-10: Theme System
**Goal**: Dark/light mode with persistence

#### Implementation:
```typescript
// 1. Theme context
// src/renderer/contexts/ThemeContext.tsx
const ThemeContext = createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>();

// 2. Apply theme class to root
document.documentElement.setAttribute('data-theme', theme);

// 3. Theme toggle button in UI
// Add to sidebar or header
```

## 🏗️ Technical Implementation Details

### State Management Setup
```bash
npm install zustand  # Lighter than Redux
```

```typescript
// src/renderer/store/useStore.ts
import { create } from 'zustand';

interface AppState {
  files: Map<string, FileState>;
  activeFileId: string | null;
  theme: 'light' | 'dark';
  
  // Actions
  openFile: (path: string) => void;
  closeFile: (id: string) => void;
  updateFileContent: (id: string, content: string) => void;
  setActiveFile: (id: string) => void;
}

export const useStore = create<AppState>((set) => ({
  // Implementation
}));
```

### File System Service
```typescript
// src/renderer/services/fileService.ts
class FileService {
  private watcher: FSWatcher;
  
  async readFile(path: string): Promise<string> {
    return window.electronAPI.readFile(path);
  }
  
  async saveFile(path: string, content: string): Promise<void> {
    await window.electronAPI.writeFile(path, content);
    this.updateRecentFiles(path);
  }
  
  watchFile(path: string, onChange: () => void) {
    // Implement file watching
  }
}
```

## 📊 Success Criteria

### End of Week 1
- [ ] Can open 5+ files in tabs
- [ ] Can navigate between files using [[wiki-links]]
- [ ] Can preview markdown while editing
- [ ] AI chat works with at least OpenAI

### End of Week 2
- [ ] Search returns relevant results
- [ ] Theme preference persists
- [ ] Recent files list works
- [ ] All settings save properly

### End of Month 1
- [ ] Complete wiki-link system with backlinks
- [ ] 3+ AI providers integrated
- [ ] Command palette fully functional
- [ ] No major bugs or crashes

## 🚦 Implementation Order

1. **Multiple file tabs** ← Start here (Day 1)
2. **Wiki-links** ← Core feature (Day 2)
3. **Markdown preview** ← Quick win (Day 3)
4. **AI integration** ← Main value (Day 4-5)
5. **Search** ← Essential (Day 6-7)
6. **Settings storage** ← Foundation (Day 8)
7. **Theme system** ← Polish (Day 9-10)

## 🛠️ Development Commands

```bash
# Start development
npm start

# Run type checking
npm run typecheck

# Build for production
npm run build

# Package for distribution
npm run package
```

## 🐛 Known Issues to Fix

1. **Command Palette**: Commands don't execute
2. **File Tree**: No refresh on external changes
3. **Editor**: No unsaved changes warning
4. **Memory**: Potential leaks in file watchers
5. **Performance**: Large files slow down editor

## 📚 Dependencies to Add

```json
{
  "dependencies": {
    "zustand": "^4.5.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0",
    "remark-wiki-link": "^2.0.0",
    "minisearch": "^6.3.0",
    "electron-store": "^8.1.0",
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.20.0",
    "react-split-pane": "^0.1.92"
  }
}
```

## 🎯 Next Session Checklist

- [ ] Install required dependencies
- [ ] Create TabBar component
- [ ] Implement tab state management
- [ ] Add wiki-link parsing
- [ ] Test file navigation
- [ ] Commit progress to GitHub

---

**Ready to Execute**: This plan provides concrete, implementable steps with code examples. Start with Day 1 tasks and work systematically through the prioritized list.