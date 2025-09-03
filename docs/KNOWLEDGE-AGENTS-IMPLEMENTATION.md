# Knowledge Agents Implementation

## Overview

This document describes the implementation of the Knowledge Agents system - an intelligent, entity-based knowledge management framework that solves the fundamental problems of information fragmentation and duplication in KnowledgeOS.

## Problems Solved

### 1. Duplicate Information
- **Issue**: Same information (e.g., "Julian" appearing twice) was stored multiple times with different levels of detail
- **Solution**: Entity-based merging that recognizes and consolidates duplicate entities while preserving all attribute history

### 2. Information Fragmentation
- **Issue**: Information stored in wrong files (e.g., work info in Personal Info.md instead of Professional Journey.md)
- **Solution**: Smart routing system that determines canonical locations for different types of information

### 3. Lack of Semantic Understanding
- **Issue**: System couldn't understand relationships between entities or context
- **Solution**: Knowledge graph with entity recognition, relationships, and embeddings for semantic search

## Architecture

### Hybrid Python-TypeScript Architecture

```
┌─────────────────────────────────────────┐
│          Electron Frontend              │
│         (TypeScript/React)               │
└────────────────┬────────────────────────┘
                 │ IPC
┌────────────────┴────────────────────────┐
│        Electron Main Process            │
│         (TypeScript/Node.js)            │
│   - PythonServiceManager                │
│   - KnowledgeAPIClient                  │
│   - IPC Handlers                        │
└────────────────┬────────────────────────┘
                 │ HTTP/REST
┌────────────────┴────────────────────────┐
│      Python Knowledge Service           │
│         (FastAPI/Pydantic)              │
│   - Entity Recognition (spaCy)          │
│   - Knowledge Graph Management          │
│   - Semantic Search (Transformers)      │
│   - Conflict Resolution                 │
└─────────────────────────────────────────┘
```

## Components

### 1. Python Service (`src/python/`)

#### Models (`models/entities.py`)
- **Entity**: Core entity with attributes, embeddings, and confidence levels
- **Relationship**: Connections between entities
- **Attribute**: Versioned attributes with confidence and source tracking
- **KnowledgeContext**: Query context for intelligent search

#### Services (`services/knowledge_graph.py`)
- **KnowledgeGraphManager**: Core service managing entities and relationships
  - Entity extraction using spaCy NLP
  - Relationship detection
  - Conflict resolution
  - Semantic search with embeddings
  - Canonical location determination

#### API Server (`server.py`)
- FastAPI server providing REST endpoints
- CORS configuration for Electron
- Health checking
- Comprehensive API for entity management

### 2. TypeScript Integration (`src/main/services/`)

#### KnowledgeAPIClient.ts
- TypeScript client for Python service
- Type-safe API methods
- Error handling and retry logic

#### PythonServiceManager.ts
- Manages Python process lifecycle
- Automatic startup/shutdown
- Health monitoring
- Dependency installation

#### IPC Handlers (`knowledgeAgentHandlers.ts`)
- Bridge between frontend and Python service
- Electron IPC protocol implementation

## Key Features

### 1. Entity Recognition
- Automatic extraction of people, organizations, locations, projects
- NLP-powered using spaCy
- Configurable entity types

### 2. Relationship Management
- Automatic relationship detection
- Types: WORKS_AT, KNOWS, MANAGES, etc.
- Temporal context support

### 3. Conflict Resolution
- Multiple versions of same attribute preserved
- Confidence-based resolution
- Source tracking for audit trail

### 4. Semantic Search
- Embedding-based similarity search
- Context-aware query processing
- Intent detection

### 5. Smart Routing
- Canonical file determination
- Context-based routing rules
- Prevents information fragmentation

## Installation & Setup

### Prerequisites
- Python 3.8+ installed
- Node.js 18+ installed
- Electron development environment

### Python Dependencies Installation

```bash
cd src/python
pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

### Testing the Service

```bash
# Test Python service standalone
cd src/python
python test_service.py

# Run the FastAPI server manually
python server.py
```

### Integration with Electron

The Python service starts automatically when the Electron app launches:

1. PythonServiceManager spawns Python process
2. Waits for health check to pass
3. Registers IPC handlers
4. Ready for use

## Usage Examples

### Processing Text with Entity Extraction

```typescript
// From the frontend
const result = await window.electronAPI.processKnowledgeText(
  "Julian works at Apple as a software engineer"
);

// Returns:
{
  entities: [
    { id: "person_julian", type: "person", name: "Julian", ... },
    { id: "organization_apple", type: "organization", name: "Apple", ... }
  ],
  relationships: [
    { type: "works_at", source: "person_julian", target: "organization_apple" }
  ],
  fileMappings: {
    "person_julian": "Professional Journey.md",
    "organization_apple": "Professional Journey.md"
  }
}
```

### Querying Knowledge

```typescript
const result = await window.electronAPI.queryKnowledge("Where does Julian work?");

// Returns relevant entities, relationships, and suggested files to search
```

## Future Enhancements

1. **Advanced NLP**
   - Coreference resolution
   - Sentiment analysis
   - Named entity disambiguation

2. **Graph Visualization**
   - D3.js knowledge graph viewer
   - Interactive entity explorer

3. **Learning & Adaptation**
   - User feedback incorporation
   - Pattern learning from corrections

4. **Multi-Model Support**
   - GPT integration for entity extraction
   - Custom fine-tuned models

5. **Distributed Processing**
   - Redis for caching
   - PostgreSQL for persistence
   - Async job queues

## Troubleshooting

### Python Service Won't Start
1. Check Python is in PATH
2. Install dependencies: `pip install -r src/python/requirements.txt`
3. Check port 8000 is available

### Entity Extraction Not Working
1. Install spaCy model: `python -m spacy download en_core_web_sm`
2. Check NLP model loaded in logs

### Slow Performance
1. Ensure sentence-transformers models are cached
2. Consider using smaller embedding models
3. Implement caching layer

## Conclusion

The Knowledge Agents implementation provides a robust, intelligent solution for knowledge management that:
- Prevents duplicate information through entity recognition
- Routes information to appropriate locations
- Enables semantic understanding and search
- Maintains information integrity with conflict resolution
- Scales with the growing knowledge base

This hybrid Python-TypeScript architecture leverages the best of both ecosystems: Python's AI/ML capabilities and TypeScript's type safety and Electron integration.