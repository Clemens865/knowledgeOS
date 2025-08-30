# Knowledge Rules Configuration Guide

## Overview
Knowledge Rules are system prompts that define how your AI assistant behaves, organizes information, and manages your knowledge base. KnowledgeOS provides multiple ways to customize these rules.

## 📍 Where Knowledge Rules Are Located

### 1. **Default Rules** 
`src/main/llmHandlers.ts` - `getDefaultKnowledgeRules()` function
- Default rules for knowledge extraction and file management
- Automatically applied when no custom rules exist

### 2. **Conversation Modes**
`src/core/ConversationModes.ts`
- Pre-configured modes with specific behaviors
- Each mode has its own specialized system prompt

### 3. **Workspace Rules Modal**
Access via: **File → Workspace Rules** or button in Settings
- GUI for editing rules per workspace
- Changes persist across sessions

### 4. **Stored Configuration**
Saved in electron-store (local app data)
- Custom prompts override defaults
- Persists between app restarts

## 🎯 How to Add/Modify Knowledge Rules

### Method 1: Through the UI (Recommended)

1. **Open Workspace Rules Modal**
   - Click Settings (⚙️) → "📝 Edit Mode Rules" button
   - Or use File → Workspace Rules menu

2. **Edit the System Prompt**
   - Modify the text in the large textarea
   - Include specific instructions for your use case
   - Save changes

3. **Switch Between Modes**
   - Each conversation mode has different rules
   - Select mode from dropdown in Settings
   - Edit rules specific to that mode

### Method 2: Create Custom Conversation Modes

Add new modes to `src/core/ConversationModes.ts`:

```typescript
{
  id: 'your-custom-mode',
  name: 'Custom Mode Name',
  icon: '🎯',
  description: 'What this mode does',
  systemPrompt: `Your custom knowledge rules here...`,
  allowFileUpload: true, // Optional
  supportedFileTypes: ['.pdf', '.txt'] // Optional
}
```

### Method 3: Modify Default Rules

Edit `src/main/llmHandlers.ts`:

```typescript
function getDefaultKnowledgeRules(): string {
  return `Your modified default rules...`;
}
```

## 📝 Current Available Modes

### 1. **Knowledge OS (Standard)**
- General knowledge management
- Automatic information extraction
- File organization

### 2. **Learning Mode** 🎓
- Identifies knowledge gaps
- Asks follow-up questions
- Builds comprehensive understanding

### 3. **Document Analysis** 📄
- Processes uploaded documents
- Extracts key information
- Integrates into knowledge base

### 4. **Research Mode** 🔍
- Deep topic exploration
- Information synthesis
- Research organization

## 🔧 Rule Structure Best Practices

### Essential Components

1. **Primary Objective**
   - Clear statement of the mode's purpose
   - Expected behavior

2. **File Operations Rules**
   ```
   CRITICAL: Always READ before WRITE
   - Use read_file to check existing content
   - Use append_file to add new information
   - Use write_file only with merged content
   - Never lose existing data
   ```

3. **Folder Structure**
   ```
   - /notes/ - General notes
   - /daily/ - Journal entries
   - /projects/ - Project info
   - /references/ - External content
   ```

4. **Knowledge Extraction Rules**
   - What information to capture
   - How to organize it
   - When to create vs update files

5. **Response Style**
   - Conversational tone
   - No technical jargon
   - Natural confirmations

## 💡 Example Custom Rules

### Personal Assistant Mode
```
You are a personal assistant helping manage daily life.

FOCUS AREAS:
- Calendar and scheduling
- Task management
- Personal reminders
- Contact information
- Health and habits tracking

FILE STRUCTURE:
- /calendar/ - Events and appointments
- /tasks/ - Todo lists and projects
- /health/ - Health logs and habits
- /contacts/ - People and relationships

BEHAVIOR:
- Proactively remind about tasks
- Suggest schedule optimizations
- Track habit progress
- Never forget important dates
```

### Creative Writing Mode
```
You are a creative writing assistant.

FOCUS:
- Story ideas and plots
- Character development
- World building
- Writing progress tracking

FILES:
- /stories/ - Story drafts
- /characters/ - Character profiles
- /worldbuilding/ - Settings and lore
- /ideas/ - Plot ideas and snippets

BEHAVIOR:
- Ask "what if" questions
- Suggest plot developments
- Track writing statistics
- Maintain consistency
```

## ⚠️ Important Considerations

### Data Safety Rules
Always include these critical rules:
```
⚠️ NEVER LOSE DATA:
- ALWAYS read_file FIRST
- PRESERVE existing content
- Use append_file for additions
- Only write_file with merged content
```

### Tool Usage
Ensure your rules mention the available tools:
- `read_file` - Read existing files
- `write_file` - Create/overwrite files
- `append_file` - Add to existing files
- `update_file` - Modify sections
- `create_folder` - Create directories
- `list_files` - List directory contents

### Testing Your Rules

1. **Start with small changes**
   - Test one modification at a time
   - Verify expected behavior

2. **Check file operations**
   - Ensure data preservation
   - Verify correct folder usage

3. **Monitor responses**
   - Confirm natural conversation
   - Check information extraction

## 🚀 Advanced Customization

### Dynamic Rules Based on Context
You can programmatically set rules based on:
- Current workspace
- Time of day
- User preferences
- File content

### Integration with MCP
If using MCP tools, include instructions:
```
When MCP tools are available:
- Use [tool_name] for [specific task]
- Integrate results into knowledge base
```

### Multi-Language Support
Include language-specific rules:
```
LANGUAGE HANDLING:
- Detect user's language
- Respond in same language
- Organize files by language
```

## 📊 Monitoring Rule Effectiveness

Check if your rules are working:
1. Review created files structure
2. Verify information extraction accuracy
3. Monitor conversation quality
4. Check data preservation

## 🔄 Backup and Restore

### Export Current Rules
1. Open Workspace Rules modal
2. Copy current prompt
3. Save to external file

### Import Rules
1. Open Workspace Rules modal
2. Paste saved rules
3. Save changes

## 🎯 Quick Start Templates

### Minimal Rules
```
Extract and save important information.
Organize into logical folders.
Be helpful and conversational.
```

### Comprehensive Rules
Use the default rules in `llmHandlers.ts` as a starting point and customize sections as needed.

## 📚 Further Resources

- Default rules: `/src/main/llmHandlers.ts`
- Conversation modes: `/src/core/ConversationModes.ts`
- Modal component: `/src/renderer/components/WorkspaceRulesModal/`
- Settings storage: electron-store configuration

---

Remember: Good knowledge rules make the difference between a simple chatbot and an intelligent knowledge management system!