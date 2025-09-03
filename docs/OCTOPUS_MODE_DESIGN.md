# 🐙 Octopus Mode - Web Knowledge Extraction System

## Overview
Octopus Mode is an intelligent web scraping feature that crawls websites and automatically extracts, processes, and organizes knowledge into your personal knowledge base.

## Architecture

### 1. Core Components

```
┌─────────────────────────────────────────────────────────┐
│                    Renderer Process                       │
│  ┌─────────────────────────────────────────────────┐    │
│  │          Octopus Mode UI Component              │    │
│  │  - URL input & crawl settings                   │    │
│  │  - Progress tracking                            │    │
│  │  - Preview & editing                            │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            │
                    IPC Communication
                            │
┌─────────────────────────────────────────────────────────┐
│                     Main Process                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │            Web Crawler Service                  │    │
│  │  - Electron net module (no CORS)                │    │
│  │  - Queue management                             │    │
│  │  - HTML parsing & link extraction               │    │
│  │  - Rate limiting                                │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
                            │
                    HTTP API / IPC
                            │
┌─────────────────────────────────────────────────────────┐
│              Python Knowledge Backend                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │         Knowledge Processing Pipeline           │    │
│  │  - Content extraction & cleaning                │    │
│  │  - Entity recognition                           │    │
│  │  - Deduplication                                │    │
│  │  - Smart categorization                         │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Implementation Details

### Phase 1: Web Crawler Service (Electron Main Process)

```typescript
// src/main/services/WebCrawler.ts
import { net, BrowserWindow } from 'electron';
import * as cheerio from 'cheerio';
import { URL } from 'url';

interface CrawlOptions {
  url: string;
  depth: number;           // How deep to crawl (0 = single page)
  maxPages: number;        // Maximum pages to crawl
  includeSubdomains: boolean;
  respectRobotsTxt: boolean;
  selectors?: {
    content?: string;      // CSS selector for main content
    excludes?: string[];   // Selectors to exclude
  };
}

class WebCrawler {
  private queue: Set<string> = new Set();
  private visited: Set<string> = new Set();
  private results: Map<string, ExtractedContent> = new Map();
  
  async crawl(options: CrawlOptions): Promise<CrawlResult> {
    // Implementation using Electron's net module
    // No CORS restrictions!
  }
  
  private async fetchPage(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const request = net.request(url);
      let data = '';
      
      request.on('response', (response) => {
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve(data);
        });
      });
      
      request.on('error', reject);
      request.end();
    });
  }
}
```

### Phase 2: Content Processing Pipeline

```python
# src/python/services/web_knowledge_extractor.py
from typing import Dict, List, Any
import trafilatura  # For content extraction
from bs4 import BeautifulSoup
import re

class WebKnowledgeExtractor:
    def __init__(self, entity_merger, knowledge_graph):
        self.entity_merger = entity_merger
        self.knowledge_graph = knowledge_graph
    
    def process_web_content(self, html: str, url: str, metadata: Dict) -> KnowledgeResult:
        """
        Process scraped web content into structured knowledge
        """
        # 1. Extract clean text
        text = self.extract_text(html)
        
        # 2. Extract metadata
        metadata = self.extract_metadata(html, url)
        
        # 3. Identify entities
        entities = self.entity_merger.detect_entities(text)
        
        # 4. Check for duplicates
        new_info = self.deduplicate(entities, text)
        
        # 5. Categorize and file
        filing_plan = self.smart_categorization(new_info, metadata)
        
        # 6. Generate markdown
        markdown = self.generate_markdown(new_info, metadata, url)
        
        return KnowledgeResult(
            entities=entities,
            markdown=markdown,
            filing_plan=filing_plan,
            metadata=metadata
        )
    
    def smart_categorization(self, content: Dict, metadata: Dict) -> Dict[str, str]:
        """
        Intelligently categorize content into appropriate knowledge files
        """
        categories = {
            'technical': ['programming', 'software', 'code', 'API', 'documentation'],
            'business': ['company', 'startup', 'market', 'finance'],
            'research': ['paper', 'study', 'analysis', 'findings'],
            'personal': ['blog', 'opinion', 'experience', 'story'],
            'reference': ['tutorial', 'guide', 'howto', 'documentation']
        }
        
        # Analyze content and suggest filing locations
        # ...
```

### Phase 3: UI Components

```typescript
// src/renderer/components/OctopusMode/OctopusMode.tsx
import React, { useState } from 'react';

interface OctopusModeProps {
  onKnowledgeExtracted: (knowledge: ExtractedKnowledge) => void;
}

export const OctopusMode: React.FC<OctopusModeProps> = ({ onKnowledgeExtracted }) => {
  const [url, setUrl] = useState('');
  const [crawlDepth, setCrawlDepth] = useState(0);
  const [progress, setProgress] = useState<CrawlProgress | null>(null);
  const [preview, setPreview] = useState<ExtractedContent | null>(null);
  
  const startCrawl = async () => {
    const result = await window.electronAPI.startWebCrawl({
      url,
      depth: crawlDepth,
      options: {
        // Smart defaults
        extractMainContent: true,
        removeAds: true,
        preserveLinks: true,
        extractImages: selectively
      }
    });
    
    // Show preview and allow editing before saving
    setPreview(result);
  };
  
  return (
    <div className="octopus-mode">
      {/* UI implementation */}
    </div>
  );
};
```

## Key Features

### 1. Smart Crawling Strategies

- **Single Page**: Extract content from one URL
- **Site Section**: Crawl a specific section (e.g., /docs/*)
- **Full Site**: Crawl entire website with limits
- **Smart Discovery**: Follow relevant links based on content

### 2. Content Intelligence

- **Duplicate Detection**: Don't re-save known information
- **Entity Merging**: Update existing entities with new info
- **Relevance Scoring**: Prioritize important content
- **Relationship Discovery**: Find connections to existing knowledge

### 3. Processing Options

```typescript
interface ProcessingOptions {
  // Content extraction
  extractMainContent: boolean;    // Use readability algorithms
  preserveFormatting: boolean;    // Keep code blocks, tables, etc.
  extractMetadata: boolean;        // Author, date, tags
  
  // Entity processing
  runEntityExtraction: boolean;
  mergeWithExisting: boolean;
  
  // Storage options
  saveRawHtml: boolean;           // Keep original for reference
  generateSummary: boolean;        // AI-powered summary
  createBacklinks: boolean;        // Link to related notes
}
```

### 4. Intelligent Filing System

```typescript
interface FilingStrategy {
  strategy: 'domain' | 'topic' | 'entity' | 'date' | 'custom';
  
  // Examples:
  // domain: /web/github.com/repo-name/
  // topic: /research/machine-learning/transformers/
  // entity: /people/john-doe/articles/
  // date: /daily/2024-09-03/web-clips/
}
```

## Integration with Knowledge Agents

### Entity-Based Organization
When crawling a page about a person or organization:
1. Extract all entities mentioned
2. Check if they exist in knowledge base
3. Update existing entities or create new ones
4. File information in entity-specific folders

### Example Flow
```
User crawls: https://blog.example.com/interview-with-john-doe

System:
1. Extracts: "John Doe", "TechCorp", "Project Alpha"
2. Finds existing: "John Doe" entity
3. Updates: Adds new interview content to John Doe's file
4. Creates: New file "interviews/2024-09-03-john-doe-techcorp.md"
5. Links: Adds relationships between entities
```

## Advanced Features

### 1. Incremental Updates
- Track previously crawled URLs
- Only fetch changed content
- Merge updates intelligently

### 2. Scheduled Crawling
- Monitor specific sites for updates
- RSS/Atom feed integration
- Change notifications

### 3. Content Transformers
- PDF extraction
- Video transcription (YouTube)
- Image OCR
- Code repository analysis

### 4. Privacy & Ethics
- Respect robots.txt
- Rate limiting
- User agent identification
- Local processing (no external APIs)

## Implementation Priority

1. **Phase 1**: Basic single-page extraction
2. **Phase 2**: Multi-page crawling with depth control
3. **Phase 3**: Entity recognition integration
4. **Phase 4**: Smart categorization and filing
5. **Phase 5**: Duplicate detection and merging
6. **Phase 6**: Advanced features (scheduling, monitoring)

## Benefits Over Traditional Bookmarking

1. **Content Preservation**: Save actual content, not just links
2. **Knowledge Integration**: Automatically organize with existing knowledge
3. **Entity Tracking**: Build comprehensive profiles over time
4. **Offline Access**: Everything stored locally
5. **Semantic Search**: Search content, not just titles
6. **Relationship Discovery**: Find connections between sources

## Technical Advantages

### Using Electron's net module:
- ✅ No CORS restrictions
- ✅ No API rate limits (beyond ethical crawling)
- ✅ Access to all content (not just public APIs)
- ✅ Cookie/session support for authenticated content
- ✅ Full control over headers and requests

### Python Backend Integration:
- ✅ Advanced NLP for entity extraction
- ✅ Existing knowledge graph integration
- ✅ Smart deduplication
- ✅ Scalable processing pipeline

## User Experience

### Simple Mode
```
🔗 Enter URL: [________________] [🐙 Extract]
□ Include subpages (depth: [1])
```

### Advanced Mode
```
🔗 URL Pattern: https://docs.example.com/*
📊 Crawl Depth: [3]
📄 Max Pages: [50]
🎯 Content Selector: article.main-content
🚫 Exclude: .ads, .comments, .sidebar
📁 File to: /research/[domain]/[date]/
⚡ Options:
  ☑ Extract entities
  ☑ Generate summary
  ☑ Preserve code blocks
  ☑ Create backlinks
```

## Conclusion

Octopus Mode transforms KnowledgeOS from a note-taking app into a comprehensive knowledge acquisition system. By combining Electron's unrestricted web access with intelligent knowledge processing, users can build a rich, interconnected knowledge base from any web source.