# Git Workflow Plan for Firecrawl & Elysia Integration

## Current Status
- **Current Branch**: `feature/knowledge-tools`
- **Recent Work**: Split view implementation for Knowledge Graph
- **Uncommitted Changes**: Split view feature and documentation

## Recommended Git Workflow

### 🎯 Best Practice Strategy

#### Phase 1: Stabilize Current Work (TODAY)
1. **Commit Split View Changes**
   - Commit the split view implementation
   - Include documentation files
   
2. **Create PR for Knowledge Tools**
   - PR from `feature/knowledge-tools` → `main`
   - Review and test thoroughly
   - Merge when stable

#### Phase 2: New Feature Branch Structure (AFTER MERGE)
```
main (stable)
  ├── feature/web-intelligence (NEW)
  │   ├── Firecrawl integration
  │   └── Elysia integration
  └── feature/knowledge-tools (TO BE MERGED)
```

#### Phase 3: Implementation Strategy

**Option A: Single Feature Branch** ✅ RECOMMENDED
```bash
git checkout main
git pull origin main
git checkout -b feature/web-intelligence
```
**Pros**: 
- Firecrawl and Elysia work together
- Single PR to review
- Easier testing of combined features

**Option B: Separate Feature Branches**
```bash
git checkout -b feature/firecrawl-integration
git checkout -b feature/elysia-integration
```
**Pros**: 
- Independent development
- Smaller PRs
**Cons**: 
- More complex integration testing
- Potential merge conflicts

## Recommended Workflow Steps

### Step 1: Commit Current Changes
```bash
# Add split view changes
git add src/renderer/ChatApp.tsx
git add src/renderer/styles/split-view.css
git add docs/SPLIT-VIEW-FEATURE.md
git add docs/GITHUB_REPOS_INTEGRATION_ANALYSIS.md
git add docs/KNOWLEDGE-GRAPH-COMPLETE.md

# Commit with descriptive message
git commit -m "feat: add split view for Knowledge Graph, Analytics, and Editor

- Implement resizable split panes for better tool visibility
- Add toggle buttons for switching between views
- Support vertical/horizontal layout switching
- Integrate Knowledge Graph with expanded viewing space
- Add comprehensive documentation for new features"
```

### Step 2: Push and Create PR
```bash
# Push current branch
git push origin feature/knowledge-tools

# Create PR via GitHub CLI
gh pr create --title "feat: Knowledge Graph and Split View Implementation" \
  --body "## Summary
  - Adds interactive Knowledge Graph visualization
  - Implements split view for better tool management
  - Enhances UI with resizable panels
  
  ## Features
  - 🧠 Knowledge Graph with D3.js
  - 📊 Analytics integration
  - 📝 Split view editor
  - ⬌ Layout switching
  
  ## Testing
  - [x] Knowledge Graph loads correctly
  - [x] Split view toggles work
  - [x] No console errors
  - [x] Performance acceptable"
```

### Step 3: After Merge - Create New Branch
```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch for web intelligence
git checkout -b feature/web-intelligence

# Create initial structure
mkdir -p src/features/webImport
mkdir -p src/features/intelligentSearch
```

## Implementation Plan for New Features

### Firecrawl Integration (Week 1)
```
src/features/webImport/
  ├── FirecrawlService.ts      # API wrapper
  ├── WebImportModal.tsx        # UI for importing
  ├── WebContentProcessor.ts   # Convert to notes
  └── WebImport.css            # Styling
```

### Elysia Integration (Week 1-2)
```
src/features/intelligentSearch/
  ├── ElysiaService.ts         # Query engine
  ├── SearchInterface.tsx       # Smart search UI
  ├── VectorDatabase.ts        # Vector storage
  └── QueryRouter.ts           # Tool selection
```

## Git Commit Convention

Use conventional commits for clear history:
- `feat:` New features
- `fix:` Bug fixes
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Testing
- `chore:` Maintenance

## Branch Protection Rules

### For `main` branch:
- Require PR reviews
- Pass status checks (build, tests)
- Up-to-date with base branch
- No direct commits

### For feature branches:
- Regular commits (daily)
- Push frequently
- Keep PRs under 500 lines when possible

## Merge Strategy

1. **Feature Complete**: All functionality working
2. **Tests Pass**: Unit and integration tests
3. **Documentation**: Update relevant docs
4. **Code Review**: At least one reviewer
5. **Clean History**: Squash if needed

## Rollback Plan

If issues arise after merge:
```bash
# Create hotfix from main
git checkout main
git checkout -b hotfix/issue-description

# Or revert merge commit
git revert -m 1 <merge-commit-hash>
```

## Timeline

- **Today**: Commit and PR current work
- **Tomorrow**: Merge to main after review
- **Day 3-4**: Implement Firecrawl
- **Day 5-7**: Implement Elysia
- **Week 2**: Testing and refinement
- **Week 2 End**: Final PR and merge

## Success Criteria

✅ Clean Git history
✅ No merge conflicts
✅ All features working
✅ Tests passing
✅ Documentation complete
✅ Main branch stable

This workflow ensures:
- **Stability**: Main branch always works
- **Clarity**: Clear feature separation
- **Safety**: Easy rollback if needed
- **Quality**: Proper review process