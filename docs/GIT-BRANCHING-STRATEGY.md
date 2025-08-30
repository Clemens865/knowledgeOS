# Git Branching Strategy & Best Practices

## 🌳 Branch Structure

### Main Branches
- **`main`** (or `master`) - Production-ready code
  - Always stable and deployable
  - Protected branch - requires PR to merge
  - Tagged with version numbers for releases

- **`develop`** - Integration branch (optional)
  - Latest development changes
  - Features merge here first
  - Periodically merged to main

### Feature Branches
- **Pattern**: `feature/feature-name` or `feat/feature-name`
- **Examples**:
  - `feature/knowledge-graph`
  - `feature/smart-search`
  - `feat/template-system`

### Other Branch Types
- **`bugfix/issue-description`** - Bug fixes
- **`hotfix/critical-fix`** - Urgent production fixes
- **`refactor/component-name`** - Code refactoring
- **`docs/documentation-update`** - Documentation only
- **`test/test-description`** - Testing additions
- **`chore/task-description`** - Maintenance tasks

## 📋 Workflow Steps

### 1. Starting New Feature
```bash
# Ensure main is up to date
git checkout main
git pull origin main

# Create and switch to feature branch
git checkout -b feature/knowledge-graph

# Or create from specific branch
git checkout -b feature/knowledge-graph develop
```

### 2. During Development
```bash
# Regular commits with clear messages
git add .
git commit -m "feat: add graph visualization component"

# Keep branch updated with main
git fetch origin
git merge origin/main  # or rebase: git rebase origin/main

# Push to remote regularly
git push -u origin feature/knowledge-graph
```

### 3. Preparing for Merge
```bash
# Update from main one final time
git checkout main
git pull origin main
git checkout feature/knowledge-graph
git merge main  # Resolve any conflicts

# Clean up commit history (optional)
git rebase -i main  # Interactive rebase to squash commits

# Run tests
npm test
npm run lint
npm run build
```

### 4. Creating Pull Request
```bash
# Push final changes
git push origin feature/knowledge-graph

# Create PR using GitHub CLI
gh pr create --title "Add Knowledge Graph Feature" \
  --body "Implements interactive knowledge graph visualization"

# Or create PR on GitHub website
```

### 5. After Merge
```bash
# Delete local feature branch
git checkout main
git pull origin main
git branch -d feature/knowledge-graph

# Delete remote branch
git push origin --delete feature/knowledge-graph
```

## ✅ Best Practices

### Commit Messages
Follow conventional commits format:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code changes that neither fix bugs nor add features
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

**Examples**:
```
feat: add knowledge graph visualization
fix: resolve search index memory leak
docs: update API documentation
refactor: extract search logic to service
```

### Branch Rules
1. **Keep branches small and focused** - One feature per branch
2. **Branch from main** - Unless specifically working on develop
3. **Update frequently** - Merge/rebase from main regularly
4. **Test before merging** - All tests must pass
5. **Use descriptive names** - Branch name should explain the feature
6. **Delete after merge** - Clean up merged branches

### Code Review Process
1. **Self-review first** - Check your own PR before requesting review
2. **Small PRs** - Easier to review, faster to merge
3. **Clear description** - Explain what and why
4. **Screenshots** - For UI changes
5. **Link issues** - Reference related issues with "Closes #123"

## 🚫 What NOT to Do

### Avoid These Mistakes
- ❌ **Don't commit directly to main** - Always use feature branches
- ❌ **Don't force push to shared branches** - Unless absolutely necessary
- ❌ **Don't merge without review** - Get at least one approval
- ❌ **Don't leave commented code** - Remove or use feature flags
- ❌ **Don't commit secrets** - Use environment variables
- ❌ **Don't merge broken code** - Fix failing tests first

## 🔄 Conflict Resolution

### When Conflicts Occur
```bash
# Update your branch
git checkout feature/your-branch
git fetch origin
git merge origin/main

# Resolve conflicts in your editor
# Look for <<<<<<< HEAD markers

# After resolving
git add .
git commit -m "resolve: merge conflicts with main"
git push origin feature/your-branch
```

## 🏷️ Version Tagging

### Semantic Versioning
- **Major**: Breaking changes (v2.0.0)
- **Minor**: New features (v1.1.0)
- **Patch**: Bug fixes (v1.0.1)

```bash
# Create tag
git tag -a v1.2.0 -m "Release version 1.2.0"

# Push tag
git push origin v1.2.0

# List tags
git tag -l

# Delete tag
git tag -d v1.2.0
git push origin --delete v1.2.0
```

## 🚀 GitHub Flow (Simplified)

For smaller teams or simpler projects:

1. **Main branch** is always deployable
2. **Create feature branch** from main
3. **Commit changes** to feature branch
4. **Open Pull Request** for discussion
5. **Merge to main** after review
6. **Deploy immediately** from main

## 🔧 Git Configuration

### Useful Git Aliases
```bash
# Add to ~/.gitconfig
[alias]
    co = checkout
    br = branch
    ci = commit
    st = status
    unstage = reset HEAD --
    last = log -1 HEAD
    visual = !gitk
    graph = log --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit
```

### Branch Protection Rules (GitHub)
1. Go to Settings → Branches
2. Add rule for `main`:
   - Require pull request reviews
   - Require status checks to pass
   - Require branches to be up to date
   - Include administrators
   - Restrict who can push

## 📊 Current Project Status

For KnowledgeOS, we'll use:
- **`main`** - Stable releases
- **`feature/*`** - New features
- **`bugfix/*`** - Bug fixes
- **No `develop` branch** - Keeping it simple

Next step: Create `feature/knowledge-tools` for our new tools!