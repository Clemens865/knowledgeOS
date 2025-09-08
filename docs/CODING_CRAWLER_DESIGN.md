# Coding Crawler Mode - Design Document

## Overview
The Coding Crawler Mode is a specialized feature for building comprehensive coding knowledge bases from documentation sites. It crawls, processes, and stores technical documentation in an LLM-optimized format, enabling AI coding assistants to have instant access to best practices, API references, and implementation patterns.

## Core Features

### 1. Documentation Crawling Engine
- **Multi-source Support**: Crawl documentation from various sources
  - Official documentation sites (Rust, Python, TypeScript, etc.)
  - API documentation (Pydantic AI, FastAPI, React, etc.)
  - Framework guides (Next.js, Django, Express, etc.)
  - Tutorial sites and code examples
  
- **Smart Crawling**: 
  - Respect robots.txt
  - Rate limiting to avoid overwhelming servers
  - Parallel crawling with configurable workers
  - Resume capability for interrupted crawls
  - Version-aware crawling (e.g., React 18 vs React 17)

### 2. Content Processing Pipeline

#### A. Documentation Parser
```typescript
interface DocParser {
  // Extract structured content from HTML
  parseAPIReference(html: string): APIDoc[]
  parseCodeExamples(html: string): CodeExample[]
  parseConcepts(html: string): Concept[]
  parseConfiguration(html: string): ConfigOption[]
}
```

#### B. Code Extraction
- Identify and extract code blocks with language tags
- Preserve context around code examples
- Link code to explanations
- Extract import statements and dependencies

#### C. Semantic Chunking
- Break documentation into semantic chunks
- Preserve relationships between sections
- Maintain hierarchy (class → methods → parameters)
- Cross-reference related content

### 3. LLM-Optimized Storage

#### Database Schema
```sql
-- Main documentation table
CREATE TABLE code_docs (
  id INTEGER PRIMARY KEY,
  url TEXT UNIQUE,
  title TEXT,
  language TEXT,
  framework TEXT,
  version TEXT,
  content TEXT,
  structured_data JSON,
  embeddings BLOB,
  last_updated TIMESTAMP,
  INDEX idx_language_framework (language, framework)
);

-- Code examples table
CREATE TABLE code_examples (
  id INTEGER PRIMARY KEY,
  doc_id INTEGER REFERENCES code_docs(id),
  title TEXT,
  description TEXT,
  language TEXT,
  code TEXT,
  imports JSON,
  dependencies JSON,
  output TEXT,
  explanation TEXT,
  embeddings BLOB,
  INDEX idx_language (language)
);

-- API references table
CREATE TABLE api_references (
  id INTEGER PRIMARY KEY,
  doc_id INTEGER REFERENCES code_docs(id),
  class_name TEXT,
  method_name TEXT,
  signature TEXT,
  parameters JSON,
  return_type TEXT,
  description TEXT,
  examples JSON,
  embeddings BLOB,
  INDEX idx_class_method (class_name, method_name)
);

-- Concepts and patterns table
CREATE TABLE coding_concepts (
  id INTEGER PRIMARY KEY,
  doc_id INTEGER REFERENCES code_docs(id),
  concept_name TEXT,
  category TEXT,
  description TEXT,
  best_practices JSON,
  anti_patterns JSON,
  related_concepts JSON,
  embeddings BLOB,
  INDEX idx_category (category)
);

-- Search index for fast retrieval
CREATE TABLE search_index (
  id INTEGER PRIMARY KEY,
  table_name TEXT,
  record_id INTEGER,
  searchable_text TEXT,
  metadata JSON,
  embeddings BLOB,
  FULLTEXT INDEX idx_search (searchable_text)
);
```

### 4. Workspace Template Structure

When creating a new coding project, generate this structure:

```
my-rust-project/
├── .knowledge/
│   ├── code_knowledge.db      # SQLite database with documentation
│   ├── embeddings/            # Vector embeddings cache
│   └── crawl_config.json      # Crawl configuration and sources
├── .claude-flow/
│   ├── config.json           # Claude-flow configuration
│   ├── agents/               # Agent configurations
│   └── workflows/            # Workflow definitions
├── CLAUDE.md                 # Instructions for Claude
├── src/                      # Source code
├── docs/                     # Local documentation
├── examples/                 # Code examples
└── tests/                    # Test files
```

### 5. Integration with Claude-Flow

#### CLAUDE.md Template
```markdown
# Project Knowledge Base

## Available Documentation
This project has an integrated knowledge base with documentation for:
- Rust (1.75.0) - Complete standard library and language reference
- Pydantic AI (0.0.9) - Full API documentation and examples
- [Other indexed documentation...]

## Knowledge Lookup Instructions

### For Claude/AI Assistants:
1. **Before implementing**: Query the knowledge base for best practices
   - Use: `SELECT * FROM api_references WHERE class_name = ? AND method_name = ?`
   - Check code_examples for similar implementations
   
2. **Pattern Matching**: 
   - Search coding_concepts for design patterns
   - Review best_practices JSON for language-specific idioms
   
3. **Error Resolution**:
   - Query search_index for error messages
   - Check api_references for correct signatures

### Knowledge Base Queries
The knowledge base at `.knowledge/code_knowledge.db` contains:
- {doc_count} documentation pages
- {example_count} code examples
- {api_count} API references
- {concept_count} coding concepts

### Search Examples:
```sql
-- Find all Rust async examples
SELECT * FROM code_examples 
WHERE language = 'rust' 
AND code LIKE '%async%';

-- Get Pydantic model validation info
SELECT * FROM api_references 
WHERE framework = 'pydantic' 
AND class_name = 'BaseModel';

-- Find error handling patterns
SELECT * FROM coding_concepts 
WHERE category = 'error_handling' 
AND language = ?;
```
```

### 6. Crawling Profiles

Pre-configured profiles for popular documentation:

```typescript
interface CrawlProfile {
  name: string;
  baseUrl: string;
  selectors: {
    content: string;
    code: string;
    apiDocs: string;
    navigation: string;
  };
  patterns: {
    apiPages: RegExp;
    tutorialPages: RegExp;
    examplePages: RegExp;
  };
  preprocessing?: (html: string) => string;
}

const profiles: CrawlProfile[] = [
  {
    name: 'rust-docs',
    baseUrl: 'https://doc.rust-lang.org',
    selectors: {
      content: '.content',
      code: 'pre.rust',
      apiDocs: '.docblock',
      navigation: '.sidebar'
    },
    patterns: {
      apiPages: /\/std\//,
      tutorialPages: /\/book\//,
      examplePages: /\/rust-by-example\//
    }
  },
  {
    name: 'pydantic-ai',
    baseUrl: 'https://ai.pydantic.dev',
    selectors: {
      content: '.markdown-body',
      code: 'pre code',
      apiDocs: '.api-docs',
      navigation: '.nav-menu'
    },
    patterns: {
      apiPages: /\/api\//,
      tutorialPages: /\/guide\//,
      examplePages: /\/examples\//
    }
  }
  // More profiles...
];
```

### 7. UI Components

#### Coding Crawler Interface
- Documentation source selector
- Crawl configuration (depth, max pages, filters)
- Progress visualization
- Preview of extracted content
- Knowledge base statistics
- Search interface for testing queries

### 8. Python Service Extension

Extend the enhanced_knowledge_service.py:

```python
class CodingKnowledgeService:
    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path)
        self.db_path = self.workspace_path / ".knowledge" / "code_knowledge.db"
        
    async def crawl_documentation(
        self, 
        url: str, 
        profile: str = None,
        max_pages: int = 1000
    ) -> CrawlResult:
        """Crawl and process documentation"""
        pass
        
    def extract_code_blocks(self, html: str) -> List[CodeBlock]:
        """Extract and classify code blocks"""
        pass
        
    def generate_embeddings_for_code(self, code: str, context: str) -> np.array:
        """Generate embeddings optimized for code search"""
        pass
        
    def search_by_error(self, error_message: str) -> List[Solution]:
        """Find solutions for specific errors"""
        pass
        
    def get_api_signature(self, class_name: str, method: str) -> APISignature:
        """Get exact API signature and usage"""
        pass
```

## Implementation Plan

### Phase 1: Core Infrastructure
1. Create CodingCrawlerService class
2. Implement documentation parser
3. Set up code_knowledge.db schema
4. Build basic crawling engine

### Phase 2: Content Processing
1. Implement code extraction
2. Add semantic chunking
3. Create embedding generation
4. Build search indexing

### Phase 3: Integration
1. Add UI components
2. Create workspace template generator
3. Update CLAUDE.md generator
4. Integrate with conversation modes

### Phase 4: Optimization
1. Add crawl profiles for popular docs
2. Implement incremental updates
3. Add version tracking
4. Optimize search performance

## Benefits

1. **Instant Documentation Access**: No need to search online
2. **Version-Specific Knowledge**: Keep docs for specific versions
3. **Offline Capability**: Full documentation available offline
4. **Optimized for AI**: Structured for LLM consumption
5. **Project-Specific**: Each project has its own knowledge base
6. **Best Practices**: Automatically extract and index patterns

## Usage Example

```typescript
// User initiates crawl
await codingCrawler.crawl({
  urls: [
    'https://doc.rust-lang.org/std/',
    'https://ai.pydantic.dev/api/'
  ],
  profile: 'rust-docs',
  maxPages: 500,
  outputPath: './my-project/.knowledge'
});

// Claude uses the knowledge
// In CLAUDE.md: "Before writing Rust code, query the knowledge base"
const rustAsync = await db.query(
  'SELECT * FROM code_examples WHERE language = "rust" AND code LIKE "%tokio%"'
);
```

## Next Steps

1. Review and approve design
2. Start with Phase 1 implementation
3. Create UI mockups
4. Test with Rust and Pydantic AI docs
5. Gather feedback and iterate