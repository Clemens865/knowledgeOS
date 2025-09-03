# KnowledgeOS

A revolutionary AI-powered knowledge management system that combines intelligent conversation, document analysis, and beautiful glass morphism design to organize your digital mind.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS%20|%20Windows%20|%20Linux-green)
![License](https://img.shields.io/badge/license-MIT-purple)

## 🌟 What's New in v2.0

- **🎨 Vision AI Support**: Upload and analyze images with GPT-4o, GPT-4 Vision
- **📊 Analytics Dashboard**: Obsidian-inspired knowledge insights
- **🔌 MCP Integration**: Extend with external tools and services
- **📝 Split Editor**: Side-by-side editing with resizable panes
- **🧠 Multi-Provider AI**: Support for Claude, OpenAI, and Gemini
- **🤖 Knowledge Agents**: Intelligent entity recognition and knowledge deduplication (Experimental)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- API keys for AI providers (OpenAI, Claude, or Gemini)

### Installation
```bash
# Clone the repository
git clone https://github.com/Clemens865/knowledgeOS.git
cd knowledgeOS

# Install dependencies
npm install

# Start the application
npm start
```

### First Run Setup
1. Launch the app
2. Click the gear icon to open Settings
3. Configure your API keys (Cmd+Shift+K)
4. Select or create a workspace
5. Start chatting with your AI assistant!

## ✨ Key Features

### 🤖 AI-Powered Knowledge Management
- **Intelligent Conversations**: Chat with Claude, GPT-4, or Gemini
- **Vision Analysis**: Upload images for AI analysis (GPT-4o, GPT-4 Vision)
- **Document Processing**: Extract knowledge from PDFs and documents
- **Auto-Organization**: AI automatically organizes your notes

### 📊 Analytics Dashboard
- **Knowledge Metrics**: Track notes, words, and connections
- **Activity Visualization**: See your knowledge growth over time
- **Connection Mapping**: Discover relationships between notes
- **Orphaned Notes Detection**: Find disconnected information

### 🔌 Model Context Protocol (MCP)
- **Tool Integration**: Connect external services and tools
- **Extensible Architecture**: Add custom capabilities
- **Server Management**: Configure and manage MCP servers

### 📝 Advanced Editor
- **Split-Pane Editing**: Work on multiple files simultaneously
- **Markdown Support**: Full markdown editing with preview
- **Syntax Highlighting**: Beautiful code highlighting
- **File Operations**: Create, edit, and organize notes

### 🎨 Beautiful Interface
- **Glass Morphism Design**: Modern, translucent UI
- **Dark/Light Themes**: Comfortable viewing in any environment
- **Smooth Animations**: Delightful user experience
- **Responsive Layout**: Adapts to your workflow

## 📁 Project Structure

```
KnowledgeOS/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Application entry point
│   │   ├── llmHandlers.ts # LLM communication
│   │   ├── mcpManager.ts  # MCP integration
│   │   └── analyticsHandlers.ts # Analytics engine
│   ├── renderer/          # React frontend
│   │   ├── ChatApp.tsx    # Main application
│   │   └── components/    # UI components
│   ├── features/          # Feature modules
│   │   └── analytics/     # Analytics dashboard
│   └── core/              # Core services
│       └── LLMService.ts  # AI provider abstraction
├── assets/                # Icons and images
└── docs/                  # Documentation
```

## 🛠️ Configuration

### API Keys
Configure your AI provider API keys through:
- Menu: `File → API Keys`
- Shortcut: `Cmd+Shift+K` (Mac) / `Ctrl+Shift+K` (Windows/Linux)

### Supported AI Models

#### OpenAI
- GPT-4o (Vision)
- GPT-4o Mini (Vision)
- GPT-4 Vision
- GPT-4 Turbo
- GPT-3.5 Turbo

#### Claude
- Claude 3 Opus
- Claude 3 Sonnet
- Claude 3 Haiku

#### Gemini
- Gemini Pro
- Gemini Pro Vision

### Workspace Rules
Customize system prompts per workspace:
- Menu: `File → Workspace Rules`
- Define custom behaviors and knowledge extraction rules

## ⌨️ Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| New Note | `Cmd+N` | `Ctrl+N` |
| Open File | `Cmd+O` | `Ctrl+O` |
| Save | `Cmd+S` | `Ctrl+S` |
| API Keys | `Cmd+Shift+K` | `Ctrl+Shift+K` |
| Toggle Sidebar | `Cmd+B` | `Ctrl+B` |
| Command Palette | `Cmd+K` | `Ctrl+K` |
| Toggle Editor | `Cmd+E` | `Ctrl+E` |

## 🔧 Development

### Tech Stack
- **Electron**: Desktop application framework
- **React**: UI framework
- **TypeScript**: Type-safe development
- **Webpack**: Module bundling
- **IPC**: Inter-process communication

### Development Commands
```bash
# Run in development mode
npm run dev

# Build the application
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint

# Package for distribution
npm run package
```

### Building from Source
```bash
# macOS
npm run build:mac

# Windows
npm run build:win

# Linux
npm run build:linux
```

## 📊 Analytics Features

The built-in analytics dashboard provides insights into your knowledge base:

- **Overview**: Total notes, words, links, and tag statistics
- **Activity**: Daily activity charts and recent modifications
- **Connections**: Most linked notes and orphaned content
- **Growth**: Knowledge base growth over time

Access analytics through the Tools sidebar.

## 🔌 MCP Integration

Extend KnowledgeOS with Model Context Protocol servers:

1. Open MCP Configuration (`File → MCP Servers`)
2. Add server configuration
3. Test connection
4. Use integrated tools in conversations

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Areas for Contribution
- New AI provider integrations
- Additional analytics visualizations
- MCP server implementations
- UI/UX improvements
- Documentation
- Bug fixes

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI inspired by [Obsidian](https://obsidian.md/)
- AI powered by [OpenAI](https://openai.com/), [Anthropic](https://anthropic.com/), and [Google](https://ai.google/)

## 🐛 Known Issues

- Analytics may take time with large workspaces (1000+ notes)
- Some vision models require specific API access
- MCP servers require manual configuration

## 📮 Support

- Report issues on [GitHub Issues](https://github.com/Clemens865/knowledgeOS/issues)
- Join our [Discord community](https://discord.gg/knowledgeos)
- Check the [Wiki](https://github.com/Clemens865/knowledgeOS/wiki) for detailed guides

## 🗺️ Roadmap

### Coming Soon
- [ ] Knowledge Graph visualization
- [ ] Smart Search with semantic understanding
- [ ] Link Explorer for connection discovery
- [ ] Template system for structured notes
- [ ] Plugin marketplace
- [ ] Collaboration features
- [ ] Mobile companion app
- [ ] Optional cloud sync

---

**Built with ❤️ for knowledge workers, researchers, and digital thinkers**