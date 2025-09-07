# Enhanced Knowledge Service Verification Guide

## Overview
The enhanced Python knowledge service has been successfully pushed to GitHub. This service provides:
- **SQLite database persistence** for all knowledge
- **Entity extraction** using spaCy NLP
- **Semantic search** using sentence transformers
- **Knowledge graph** with relationships and confidence scoring
- **Fallback mode** when dependencies aren't installed

## Where Everything Is Stored

### 1. SQLite Database Location
The knowledge database is stored at:
```
{workspace}/.knowledge/knowledge.db
```
For your current workspace, this would be:
```
/Users/clemenshoenig/Documents/My-Knowledge_NEW/.knowledge/knowledge.db
```

### 2. Source Code Files
- **Python Service**: `src/python/enhanced_knowledge_service.py`
- **HTTP Server**: `src/python/enhanced_server.py`
- **TypeScript Client**: `src/main/services/EnhancedKnowledgeAPIClient.ts`
- **Service Manager**: `src/main/services/PythonServiceManager.ts`
- **Integration**: `src/main/llmHandlers.ts`

## How to Verify Everything is Working

### Step 1: Install Python Dependencies (Optional but Recommended)
For full functionality, install the Python dependencies:

```bash
# Navigate to the Python directory
cd src/python

# Install dependencies
pip3 install spacy sentence-transformers numpy

# Download spaCy language model
python3 -m spacy download en_core_web_sm
```

**Note**: The system will work without these dependencies in "simple mode" with basic functionality.

### Step 2: Restart the Application
After pulling the latest changes:

```bash
# Pull latest changes
git pull origin feature/web-intelligence

# Build the application
npm run build

# Start the application
npm start
```

### Step 3: Test Entity Extraction
1. Open KnowledgeOS
2. Have a conversation with Claude
3. Save the conversation to your knowledge base
4. The system will automatically:
   - Extract entities (people, organizations, locations, concepts)
   - Create embeddings for semantic search
   - Store everything in the SQLite database

### Step 4: Verify Database Creation
Check if the database was created:

```bash
# Check if the .knowledge directory exists
ls -la /Users/clemenshoenig/Documents/My-Knowledge_NEW/.knowledge/

# If it exists, you can examine the database
sqlite3 /Users/clemenshoenig/Documents/My-Knowledge_NEW/.knowledge/knowledge.db

# In SQLite prompt, check tables:
.tables
# Should show: documents, entities, embeddings, relationships

# Check if documents are being saved:
SELECT COUNT(*) FROM documents;

# Check extracted entities:
SELECT * FROM entities LIMIT 10;

# Exit SQLite
.quit
```

### Step 5: Test Search Functionality
The enhanced search supports multiple modes:

1. **Keyword Search**: Traditional text matching
2. **Semantic Search**: Finds conceptually similar content
3. **Entity Search**: Searches by extracted entities
4. **Hybrid Search**: Combines all methods for best results

To test:
1. Save several conversations
2. Use the search feature in KnowledgeOS
3. Try searching for:
   - Specific keywords
   - Concepts (e.g., "machine learning" will find AI-related content)
   - Entity names (people, companies, locations mentioned)

### Step 6: Monitor Python Service Status
The Python service should start automatically. Check its status in the console output when starting KnowledgeOS:

```
🐍 Starting Python Knowledge Service...
✅ Enhanced Knowledge Service loaded with full features
✅ Knowledge API ready at http://localhost:8000
```

If you see warnings about missing dependencies:
```
⚠️  Some dependencies missing: [error details]
⚠️  Falling back to simple mode
```
This means it's running in simple mode without NLP features.

### Step 7: Test API Endpoints Directly
You can test the Python service directly:

```bash
# Check if service is running
curl http://localhost:8000/health

# Get statistics
curl http://localhost:8000/statistics

# Test entity extraction
curl -X POST http://localhost:8000/process \
  -H "Content-Type: application/json" \
  -d '{"text": "Apple Inc. announced new products in Cupertino."}'
```

## Troubleshooting

### Python Service Not Starting
If you see `spawn python3 ENOENT`:
- **Fixed**: The latest update includes automatic detection of Homebrew Python paths
- The service now checks:
  - `/opt/homebrew/bin/python3` (Apple Silicon Macs)
  - `/usr/local/bin/python3` (Intel Macs)
  - Falls back to system `python3`

### Database Not Created
If the database isn't being created:
1. Check console for Python service errors
2. Ensure you have write permissions to the workspace directory
3. Try manually starting the Python service:
   ```bash
   cd src/python
   python3 enhanced_server.py
   ```

### Dependencies Not Installing
If pip install fails:
1. Ensure you have Python 3.8+ installed
2. Try using a virtual environment:
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

## Expected Behavior

When everything is working correctly:

1. **On Startup**: Python service starts automatically, no errors in console
2. **On Save**: Conversations are saved with entity extraction
3. **Database Growth**: The `.knowledge/knowledge.db` file grows as you save content
4. **Search Results**: Searches return relevant results, including semantic matches
5. **Performance**: Saving and searching are fast (< 1 second for most operations)

## Features in Action

### Entity Extraction Example
Input: "I met with Tim Cook at Apple headquarters in Cupertino to discuss the new iPhone."

Extracted:
- **People**: Tim Cook
- **Organizations**: Apple
- **Locations**: Cupertino
- **Products**: iPhone

### Semantic Search Example
Query: "artificial intelligence"

Finds documents about:
- Machine learning
- Neural networks
- AI applications
- Deep learning
- Even if they don't contain the exact phrase "artificial intelligence"

### Knowledge Graph
The system builds relationships between entities:
- Tim Cook → works_at → Apple
- Apple → located_in → Cupertino
- iPhone → produced_by → Apple

## Next Steps

1. **Install Dependencies**: For full NLP capabilities
2. **Test the System**: Save some conversations and test search
3. **Monitor Performance**: Check if entity extraction is working
4. **Explore the Database**: Use SQLite tools to examine the data

## Support

If you encounter issues:
1. Check the console output for error messages
2. Verify Python 3 is installed: `python3 --version`
3. Check the GitHub repository for updates
4. The system has graceful fallbacks, so it should work even without all dependencies

The enhanced knowledge service is now part of your KnowledgeOS installation and will continuously improve your knowledge management capabilities!