# KnowledgeOS

A revolutionary knowledge management platform combining the power of VS Code, AI intelligence, and beautiful glass morphism design.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
# Install dependencies
npm install

# Start the application
npm start
```

### Development
```bash
# Run in development mode
npm run dev

# Build the application
npm run build

# Package for distribution
npm run package
```

## 🏗️ Architecture

- **Electron** - Desktop application framework
- **Monaco Editor** - VS Code's powerful editor at the core
- **React** - UI framework with glass morphism design
- **TypeScript** - Type-safe development
- **Markdown** - Knowledge stored as markdown files

## ✨ Features

### Phase 1 (Current)
- ✅ Electron application with Monaco Editor
- ✅ Glass morphism UI design
- ✅ File tree navigation
- ✅ Markdown editing with syntax highlighting
- ✅ Command palette (Cmd/Ctrl + K)
- ✅ AI chat panel interface
- ✅ Sidebar with files/search/graph tabs

### Upcoming
- 🔄 Wiki-links and backlinking
- 🔄 AI integration (OpenAI, Anthropic, local LLMs)
- 🔄 Knowledge graph visualization
- 📋 Semantic search
- 📋 Plugin system
- 📋 Real-time collaboration

## 🎨 UI Features

- Glass morphism effects with backdrop blur
- Light/dark theme support (coming soon)
- Gradient accents and prism effects
- Smooth animations and transitions
- Command palette for quick actions
- Collapsible sidebar and chat panel

## 📁 Project Structure

```
src/
├── main/              # Electron main process
│   ├── index.ts      # Entry point
│   ├── window.ts     # Window management
│   ├── ipc.ts        # IPC handlers
│   └── menu.ts       # Application menu
├── renderer/          # React application
│   ├── App.tsx       # Main component
│   ├── components/   # UI components
│   └── styles/       # CSS styles
└── shared/           # Shared types/utils
```

## 🛠️ Available Commands

### Application Menu
- **File**: New Note, Open, Save, Save As
- **Edit**: Standard editing operations
- **View**: Toggle sidebar, AI chat, command palette
- **Window**: Window management
- **Help**: Documentation and support

### Keyboard Shortcuts
- `Cmd/Ctrl + N` - New note
- `Cmd/Ctrl + O` - Open file
- `Cmd/Ctrl + S` - Save file
- `Cmd/Ctrl + K` - Command palette
- `Cmd/Ctrl + B` - Toggle sidebar
- `Cmd/Ctrl + Shift + C` - Toggle AI chat

## 🔗 Links

- [GitHub Repository](https://github.com/Clemens865/knowledgeOS)
- [Documentation](./Documents/PRD-Knowledge-OS.md)
- [Development Plan](./DEVELOPMENT_PLAN.md)

## 📝 License

MIT

---

**KnowledgeOS** - Where knowledge meets intelligence