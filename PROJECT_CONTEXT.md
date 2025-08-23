# KnowledgeOS Project Context
## Quick Start Guide for New Developers & AI Assistants

### 🎯 Project Vision
KnowledgeOS is building a **full desktop application** - a universal "operating system for thought" that combines:
- The editing power of VS Code (Monaco Editor at its core)
- The knowledge management elegance of Obsidian (markdown-based)
- The intelligence of modern AI (deeply integrated, not bolted on)
- The flexibility to scale from personal use to enterprise
- Beautiful glass morphism UI (from the mockup)

**Important**: This is a complete Electron application, NOT just a repository with rules. The original "repository as assistant" vision provides the conceptual foundation for how knowledge should be organized and accessed.

### 📍 Current Status (August 2025)
- **Phase**: Pre-MVP Development
- **Focus**: Foundation building (Phase 1.1) - Setting up Electron + Monaco
- **Next Milestone**: Working Electron app with Monaco editor integrated
- **GitHub**: https://github.com/Clemens865/knowledgeOS

### 🗂️ Project Structure
```
Knowledge OS/
├── Documents/
│   ├── PRD-Knowledge-OS.md      # Complete product requirements (738 lines)
│   ├── mockup-reference.html    # UI design reference with glass morphism
│   └── vscode-main/             # VS Code source for reference
├── DEVELOPMENT_PLAN.md          # Detailed implementation roadmap
├── PROJECT_CONTEXT.md           # This file - quick orientation
├── .claude/                     # Claude Flow configuration
├── .swarm/                      # Swarm orchestration data
└── .hive-mind/                  # Collective intelligence system
```

### 🏗️ Technical Architecture

#### Core Stack
- **Frontend**: Electron + React + TypeScript + Monaco Editor
- **Backend**: Node.js + SQLite + Neo4j (graph DB)
- **AI Layer**: LangChain.js + Multiple LLM providers + Local LLM support
- **UI Design**: Glass morphism (see mockup-reference.html)
- **Search**: MiniSearch (full-text) + Vector DB (semantic)

#### Key Architectural Decisions
1. **VS Code as Backend**: Using Monaco Editor and Language Server Protocol
2. **Local-First**: All data stored locally with optional sync
3. **Plugin Architecture**: Extensible like VS Code
4. **Graph-Based Knowledge**: Neo4j for relationships between notes
5. **Multi-AI Support**: Not locked to single provider

### 📋 Development Phases

#### Phase 1: Foundation (Months 1-3) - CURRENT
- [ ] Electron + Monaco setup
- [ ] Glass morphism UI from mockup
- [ ] AI chat integration
- [ ] File operations & markdown editor
- [ ] Wiki-links implementation
- [ ] Basic search

#### Phase 2: Intelligence (Months 4-6)
- Knowledge graph visualization
- AI knowledge extraction
- Semantic search
- Auto-categorization
- Context-aware AI

#### Phase 3: Extensibility (Months 7-9)
- Plugin API & marketplace
- Theme system
- Workflow automation
- External integrations

#### Phase 4: Collaboration (Months 10-12)
- Real-time collaboration
- Shared workspaces
- Version control
- Team features

#### Phase 5: Scale (Year 2)
- Enterprise features
- Mobile/web platforms
- Vertical markets
- API platform

### 🚀 Quick Start Commands

```bash
# Initialize hive mind for analysis
npx claude-flow@alpha hive-mind init

# Store important information
npx claude-flow@alpha memory store "key" "value"

# Retrieve stored information
npx claude-flow@alpha memory get "key"

# Start a development swarm
npx claude-flow@alpha swarm "Build feature X" --strategy development --claude

# Use SPARC for specific tasks
npx claude-flow@alpha sparc tdd "Implement wiki-links feature"
```

### 💾 Memory Keys
Important information stored in the memory system:

- `project_overview`: High-level project description
- `development_phases`: Detailed phase breakdown
- `github_repo`: Repository information and tracking
- `tech_stack`: Technology decisions
- `current_milestone`: What we're working on now

### 📊 Progress Tracking

#### Completed
- ✅ Project requirements document (PRD)
- ✅ UI mockup design (glass morphism)
- ✅ Development plan creation
- ✅ Hive mind initialization
- ✅ Memory system setup

#### In Progress
- 🔄 Phase 1.1: Electron + Monaco setup
- 🔄 GitHub repository organization

#### Upcoming
- ⏳ Glass morphism UI implementation
- ⏳ AI provider integration
- ⏳ File system operations

### 🎯 Immediate Priorities

1. **Set up Electron application** with TypeScript and React
2. **Integrate Monaco Editor** with full VS Code capabilities
3. **Port mockup UI** to React components
4. **Create GitHub structure** with proper organization
5. **Implement basic IPC** for renderer-main communication

### 🔗 Key Resources

- **PRD**: `Documents/PRD-Knowledge-OS.md` - Complete requirements
- **UI Design**: `Documents/mockup-reference.html` - Glass morphism reference
- **VS Code Ref**: `Documents/vscode-main/` - Implementation patterns
- **Dev Plan**: `DEVELOPMENT_PLAN.md` - Detailed roadmap
- **GitHub**: https://github.com/Clemens865/knowledgeOS

### 🤝 For New Contributors

#### Getting Oriented
1. Read this PROJECT_CONTEXT.md first
2. Review the PRD for full vision
3. Check DEVELOPMENT_PLAN.md for technical details
4. Look at mockup-reference.html for UI design
5. Check GitHub Issues for current tasks

#### Starting Work
1. Use `npx claude-flow@alpha memory list` to see stored context
2. Check the todo list for current priorities
3. Use SPARC modes for specific development tasks
4. Always update memory when making significant changes
5. Track all progress in GitHub

#### Key Principles
- **Local-First**: User data privacy is paramount
- **AI-Native**: Intelligence should be deeply integrated
- **Extensible**: Everything should be pluggable
- **Performance**: Sub-second response times
- **Beautiful**: Glass morphism UI with attention to detail

### 🔄 Keeping Context Updated

When making significant changes:
1. Update this PROJECT_CONTEXT.md
2. Store key decisions in memory system
3. Create GitHub Issues for new tasks
4. Update DEVELOPMENT_PLAN.md milestones
5. Document in GitHub Wiki for permanence

### 💡 Innovation Opportunities

Areas where we can differentiate:
1. **VS Code Integration**: Deeper than any competitor
2. **AI Orchestration**: Smart routing between models
3. **Knowledge Graph**: Visual thinking at scale
4. **Plugin Ecosystem**: Learn from VS Code's success
5. **Privacy**: Local LLMs and zero-knowledge sync

### 🚦 Current Blockers
- None currently identified

### 📝 Notes for AI Assistants

When continuing work on this project:
1. Always check memory first: `npx claude-flow@alpha memory list`
2. Read this context document completely
3. Use TodoWrite to track your progress
4. Store new insights in memory system
5. Update GitHub with any changes
6. Maintain the glass morphism aesthetic from mockup
7. Prioritize VS Code/Monaco integration depth
8. Keep local-first philosophy in all decisions

### 🎨 Design Language

From mockup-reference.html:
- **Glass Morphism**: Translucent panels with blur
- **Prism Effects**: Subtle rainbow gradients
- **Dark/Light Modes**: Full theme support
- **Typography**: SF Pro Display, clean hierarchy
- **Spacing**: Generous whitespace, breathing room
- **Animations**: Smooth, purposeful transitions

### 🔐 Security Considerations

- All data encrypted at rest (AES-256)
- Local-first with optional sync
- API keys never transmitted
- Plugin sandboxing required
- Audit logs for enterprise

### 📈 Success Metrics

Phase 1 targets:
- Startup time < 2s
- File open < 100ms
- Search results < 200ms
- Memory usage < 500MB
- 95% crash-free sessions

### 🌟 Unique Value Proposition

**"The only knowledge platform that combines the full power of VS Code with AI-native intelligence and beautiful design."**

Key differentiators:
1. True IDE capabilities (not just markdown)
2. Multiple AI providers (not locked in)
3. Local-first privacy (your data stays yours)
4. Knowledge graph visualization (see connections)
5. Extensible platform (infinite possibilities)

---

**Last Updated**: August 2025
**Version**: 1.0.0
**Maintainer**: Claude Flow Hive Mind

*For questions or updates, check GitHub Discussions or use the memory system.*