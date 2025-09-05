# KnowledgeOS Windsurf-Style Implementation Plan

## 🎯 Objective
Transform KnowledgeOS's knowledge management system to use Windsurf's exhaustive search and structured context injection approach.

## 📋 Implementation Phases

### Phase 1: Enhanced Search Protocol (Immediate)
**Goal**: Fix the "guessing file location" problem with mandatory exhaustive search.

#### 1.1 Structured System Prompt Update
- Replace prose instructions with XML-structured protocols
- Make search mandatory and exhaustive
- Implement clear search workflow steps

#### 1.2 Search Behavior Enforcement
- Increase default search results to 20+ 
- Implement multi-query search attempts
- Add search validation before "not found" responses

#### 1.3 Tool Instruction Clarity
- Separate search protocol from general instructions
- Add explicit failure conditions
- Implement search tracking

### Phase 2: Workspace Context Injection
**Goal**: Provide complete workspace awareness like Windsurf.

#### 2.1 Workspace Snapshot System
- Full directory tree with metadata
- File counts, sizes, and modification dates
- Recent activity tracking

#### 2.2 Real-time Context Updates
- File system monitoring
- Active document tracking
- Dynamic metadata injection

#### 2.3 Structured Context Layers
- Separate workspace, metadata, and rules contexts
- XML-based structure for clarity
- Priority-based context ordering

### Phase 3: Memory System
**Goal**: Remember successful search patterns and user preferences.

#### 3.1 Search Pattern Memory
- Track successful query-to-file mappings
- Learn user's file organization patterns
- Suggest likely locations based on history

#### 3.2 Cross-Session Persistence
- Store search patterns in SQLite
- Retrieve relevant memories on startup
- Update patterns based on success/failure

#### 3.3 Intelligent Caching
- Cache frequently accessed files
- Remember recent searches
- Predictive file loading

## 🏗️ Technical Architecture

### Core Components

```typescript
// 1. Enhanced LLMService with structured prompts
class LLMService {
  private buildStructuredPrompt(): string {
    return `
      <system_context>
        <role>KnowledgeOS Knowledge Management Assistant</role>
        
        <search_protocol priority="MANDATORY">
          <enforcement>STRICT</enforcement>
          <rules>
            <rule priority="1">NEVER assume file location</rule>
            <rule priority="2">ALWAYS search exhaustively before responding</rule>
            <rule priority="3">Use multiple search strategies</rule>
          </rules>
          
          <workflow>
            <step num="1">
              <action>search_files</action>
              <params>query="${keywords}", max_results=30</params>
              <on_empty>continue</on_empty>
            </step>
            <step num="2">
              <action>search_files</action>
              <params>query="${alternativeKeywords}", max_results=20</params>
              <on_empty>continue</on_empty>
            </step>
            <step num="3">
              <action>list_directory</action>
              <params>path="/", recursive=true</params>
              <then>analyze_filenames</then>
            </step>
            <step num="4">
              <action>read_file</action>
              <params>path="${promising_files}"</params>
              <exhaustive>true</exhaustive>
            </step>
          </workflow>
        </search_protocol>
        
        <workspace_context>
          ${this.workspaceSnapshot}
        </workspace_context>
        
        <file_operations>
          ${this.fileOperationRules}
        </file_operations>
      </system_context>
    `;
  }
}

// 2. Workspace Monitor Service
class WorkspaceMonitor {
  private snapshot: WorkspaceSnapshot;
  
  async generateSnapshot(): Promise<string> {
    const tree = await this.buildDirectoryTree();
    const stats = await this.gatherStatistics();
    const recent = await this.getRecentActivity();
    
    return `
      <workspace_information>
        <structure>
          ${tree}
        </structure>
        <statistics>
          <total_files>${stats.totalFiles}</total_files>
          <total_size>${stats.totalSize}</total_size>
          <last_updated>${stats.lastUpdated}</last_updated>
        </statistics>
        <recent_activity>
          ${recent.map(f => `<file modified="${f.modified}">${f.path}</file>`).join('\n')}
        </recent_activity>
      </workspace_information>
    `;
  }
}

// 3. Search Memory System
class SearchMemory {
  private db: Database;
  
  async recordSearch(query: string, results: SearchResult[]) {
    await this.db.run(`
      INSERT INTO search_patterns (query, results, timestamp)
      VALUES (?, ?, ?)
    `, [query, JSON.stringify(results), Date.now()]);
  }
  
  async getSuggestions(query: string): Promise<string[]> {
    const patterns = await this.db.all(`
      SELECT results FROM search_patterns
      WHERE query LIKE ?
      ORDER BY timestamp DESC
      LIMIT 10
    `, [`%${query}%`]);
    
    return this.extractFilePatterns(patterns);
  }
}
```

## 📝 File Changes Required

### Modified Files
1. **src/core/LLMService.ts**
   - Implement structured prompt system
   - Add workspace context injection
   - Enhance search protocol enforcement

2. **src/main/llmHandlers.ts**
   - Add workspace snapshot generation
   - Implement search tracking
   - Add memory system integration

3. **src/core/ConversationModes.ts**
   - Update all modes with structured format
   - Ensure search protocol in all modes
   - Add workspace context to mode prompts

### New Files
1. **src/main/services/WorkspaceMonitor.ts**
   - Directory tree building
   - File statistics gathering
   - Recent activity tracking

2. **src/main/services/SearchMemory.ts**
   - Pattern storage and retrieval
   - Success/failure tracking
   - Suggestion generation

3. **src/main/services/ContextInjector.ts**
   - Structured context building
   - Priority-based layering
   - Dynamic updates

## 🔄 Migration Strategy

### Step 1: Update System Prompts (No breaking changes)
- Add structured XML format alongside existing prose
- Maintain backward compatibility
- Test with existing conversations

### Step 2: Implement Workspace Context
- Add optional workspace snapshot
- Gradually increase context detail
- Monitor performance impact

### Step 3: Enable Memory System
- Start recording search patterns
- Build pattern database over time
- Enable suggestions after sufficient data

## 📊 Success Metrics

### Search Accuracy
- **Before**: ~40% success on first try
- **Target**: >90% success on first try
- **Measure**: Track search attempts per query

### User Satisfaction
- **Before**: "Can't find information" complaints
- **Target**: Zero search-related issues
- **Measure**: User feedback and error logs

### Performance
- **Before**: 1-2 search attempts average
- **Target**: Comprehensive search in single pass
- **Measure**: Tool call analytics

## 🚀 Quick Start Implementation

### Immediate Fix (Today)
```typescript
// In LLMService.ts - Quick enhancement to search protocol
private getDefaultSystemPrompt(): string {
  return `<system_role>
KnowledgeOS Knowledge Management Assistant
</system_role>

<search_protocol>
MANDATORY RULES - MUST FOLLOW:
1. NEVER assume where information is stored
2. ALWAYS use search_files with AT LEAST 20 results
3. Try MULTIPLE search queries before saying "not found"
4. Search exhaustively across ALL files

REQUIRED WORKFLOW:
- First: search_files(query, max_results=30)
- If empty: search_files(alternative_keywords, max_results=20)
- If still empty: list_directory + read promising files
- ONLY after exhaustive search: respond "not found"
</search_protocol>

<workspace_path>${this.workspacePath}</workspace_path>

${this.existingPromptContent}`;
}
```

## 🎯 Expected Outcomes

### Week 1
- Eliminated "can't find" false negatives
- Consistent exhaustive search behavior
- Clear search audit trail

### Week 2
- Full workspace awareness
- Faster file discovery
- Reduced search iterations

### Week 3
- Pattern-based predictions
- Learning from user behavior
- Near-instant information retrieval

## 📈 Performance Optimizations

### Search Optimization
- Index frequently accessed files
- Cache search results for 5 minutes
- Parallel search execution

### Context Management
- Compress workspace snapshots
- Incremental updates only
- Smart context pruning

### Memory Efficiency
- Limit pattern history to 1000 entries
- Aggregate similar patterns
- Periodic cleanup of old data

## ✅ Testing Strategy

### Unit Tests
- Search protocol enforcement
- Workspace snapshot generation
- Memory pattern matching

### Integration Tests
- End-to-end search workflows
- Multi-mode search behavior
- Cross-session memory persistence

### User Acceptance Tests
- "Find my birthday" scenario
- "Update work notes" workflow
- "Search across projects" test

## 🔧 Rollback Plan

If issues arise:
1. Revert to prose-based prompts
2. Disable memory system
3. Reduce search scope
4. Return to original behavior

All changes are backward compatible and can be toggled via configuration.

## 📅 Timeline

### Day 1-2: Phase 1
- Implement structured search protocol
- Update all conversation modes
- Test exhaustive search

### Day 3-4: Phase 2
- Build workspace monitor
- Add context injection
- Test with real workspaces

### Day 5-6: Phase 3
- Implement memory system
- Add pattern learning
- Full system testing

### Day 7: Deployment
- Final testing
- Documentation update
- User communication

## 🎉 Success Criteria

The implementation is successful when:
1. ✅ Zero "can't find" errors when information exists
2. ✅ All searches are exhaustive by default
3. ✅ LLM has full workspace awareness
4. ✅ Search patterns improve over time
5. ✅ User satisfaction with search accuracy

---

**Next Step**: Begin with Phase 1 - Enhanced Search Protocol implementation in LLMService.ts