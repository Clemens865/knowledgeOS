#!/usr/bin/env python3
"""
Coding Knowledge Service - Standalone service for managing coding documentation
Completely independent from other services
"""

import sqlite3
import json
import os
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
import hashlib
import re

# Try to import NLP libraries for enhanced features
try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    EMBEDDINGS_AVAILABLE = True
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
except ImportError:
    EMBEDDINGS_AVAILABLE = False
    embedding_model = None
    print("⚠️  Embeddings not available. Install sentence-transformers for semantic search.")

class CodingKnowledgeService:
    """Service for managing coding documentation knowledge base"""
    
    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path)
        self.knowledge_dir = self.workspace_path / ".knowledge"
        self.db_path = self.knowledge_dir / "code_knowledge.db"
        
        # Create knowledge directory if it doesn't exist
        self.knowledge_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize database
        self.init_database()
    
    def init_database(self):
        """Initialize the SQLite database with schema for coding knowledge"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Main documentation table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS code_docs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT UNIQUE NOT NULL,
                title TEXT,
                language TEXT,
                framework TEXT,
                version TEXT,
                content TEXT,
                structured_data TEXT,
                embeddings BLOB,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(url)
            )
        ''')
        
        # Code examples table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS code_examples (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id INTEGER REFERENCES code_docs(id) ON DELETE CASCADE,
                title TEXT,
                description TEXT,
                language TEXT,
                code TEXT NOT NULL,
                imports TEXT,
                dependencies TEXT,
                output TEXT,
                explanation TEXT,
                embeddings BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # API references table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS api_references (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id INTEGER REFERENCES code_docs(id) ON DELETE CASCADE,
                class_name TEXT,
                method_name TEXT NOT NULL,
                signature TEXT,
                parameters TEXT,
                return_type TEXT,
                description TEXT,
                examples TEXT,
                embeddings BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Concepts and patterns table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS coding_concepts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_id INTEGER REFERENCES code_docs(id) ON DELETE CASCADE,
                concept_name TEXT NOT NULL,
                category TEXT,
                description TEXT,
                best_practices TEXT,
                anti_patterns TEXT,
                related_concepts TEXT,
                embeddings BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_code_language ON code_examples(language)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_code_doc_id ON code_examples(doc_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_class_method ON api_references(class_name, method_name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_api_doc_id ON api_references(doc_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_concept_category ON coding_concepts(category)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_concept_doc_id ON coding_concepts(doc_id)')
        
        # Search index for fast retrieval
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS search_index (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id INTEGER NOT NULL,
                searchable_text TEXT,
                metadata TEXT,
                embeddings BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create index for search_index table
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_table_record ON search_index(table_name, record_id)')
        
        # Create full-text search virtual table
        cursor.execute('''
            CREATE VIRTUAL TABLE IF NOT EXISTS search_fts 
            USING fts5(
                table_name, 
                record_id, 
                searchable_text, 
                content=search_index
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def save_crawl_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Save crawl results to the database"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        stats = {
            'docs_saved': 0,
            'examples_saved': 0,
            'api_refs_saved': 0,
            'concepts_saved': 0
        }
        
        try:
            for result in results:
                # Save main documentation
                cursor.execute('''
                    INSERT OR REPLACE INTO code_docs 
                    (url, title, language, framework, version, content, structured_data, embeddings, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    result.get('url'),
                    result.get('title'),
                    result.get('metadata', {}).get('language'),
                    result.get('metadata', {}).get('framework'),
                    result.get('metadata', {}).get('version'),
                    result.get('content'),
                    json.dumps(result.get('structured_data', {})),
                    self._generate_embedding(result.get('content', '')),
                    datetime.now()
                ))
                
                doc_id = cursor.lastrowid
                stats['docs_saved'] += 1
                
                # Save code examples
                for example in result.get('codeBlocks', []):
                    cursor.execute('''
                        INSERT INTO code_examples 
                        (doc_id, title, description, language, code, imports, explanation, embeddings)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        doc_id,
                        example.get('title'),
                        example.get('description'),
                        example.get('language'),
                        example.get('code'),
                        json.dumps(example.get('imports', [])),
                        example.get('explanation'),
                        self._generate_embedding(example.get('code', ''))
                    ))
                    stats['examples_saved'] += 1
                    
                    # Add to search index
                    self._add_to_search_index(
                        cursor,
                        'code_examples',
                        cursor.lastrowid,
                        f"{example.get('title', '')} {example.get('code', '')}"
                    )
                
                # Save API references
                for api_ref in result.get('apiReferences', []):
                    cursor.execute('''
                        INSERT INTO api_references 
                        (doc_id, class_name, method_name, signature, parameters, return_type, description, embeddings)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        doc_id,
                        api_ref.get('className'),
                        api_ref.get('methodName'),
                        api_ref.get('signature'),
                        json.dumps(api_ref.get('parameters', [])),
                        api_ref.get('returnType'),
                        api_ref.get('description'),
                        self._generate_embedding(api_ref.get('signature', ''))
                    ))
                    stats['api_refs_saved'] += 1
                    
                    # Add to search index
                    self._add_to_search_index(
                        cursor,
                        'api_references',
                        cursor.lastrowid,
                        f"{api_ref.get('methodName', '')} {api_ref.get('signature', '')} {api_ref.get('description', '')}"
                    )
            
            conn.commit()
            return {
                'success': True,
                'stats': stats
            }
            
        except Exception as e:
            conn.rollback()
            return {
                'success': False,
                'error': str(e)
            }
        finally:
            conn.close()
    
    def search_code(self, query: str, search_type: str = 'hybrid', limit: int = 10) -> List[Dict[str, Any]]:
        """Search for code examples and documentation"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        results = []
        
        try:
            if search_type in ['keyword', 'hybrid']:
                # Full-text search
                cursor.execute('''
                    SELECT table_name, record_id, searchable_text, metadata
                    FROM search_fts
                    WHERE searchable_text MATCH ?
                    LIMIT ?
                ''', (query, limit))
                
                for row in cursor.fetchall():
                    table_name, record_id, text, metadata = row
                    results.append({
                        'type': table_name,
                        'id': record_id,
                        'text': text[:500],  # Truncate for preview
                        'metadata': json.loads(metadata) if metadata else {},
                        'score': 1.0  # FTS doesn't provide scores
                    })
            
            if search_type in ['semantic', 'hybrid'] and EMBEDDINGS_AVAILABLE:
                # Semantic search using embeddings
                query_embedding = self._generate_embedding(query)
                if query_embedding is not None:
                    # Search in code examples
                    results.extend(self._semantic_search(
                        cursor, 
                        'code_examples', 
                        query_embedding, 
                        limit
                    ))
                    
                    # Search in API references
                    results.extend(self._semantic_search(
                        cursor, 
                        'api_references', 
                        query_embedding, 
                        limit
                    ))
            
            # Remove duplicates and sort by relevance
            seen = set()
            unique_results = []
            for result in results:
                key = f"{result['type']}_{result['id']}"
                if key not in seen:
                    seen.add(key)
                    unique_results.append(result)
            
            # Sort by score (if available)
            unique_results.sort(key=lambda x: x.get('score', 0), reverse=True)
            
            return unique_results[:limit]
            
        finally:
            conn.close()
    
    def get_api_signature(self, class_name: Optional[str], method_name: str) -> Optional[Dict[str, Any]]:
        """Get exact API signature and usage"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        try:
            if class_name:
                cursor.execute('''
                    SELECT * FROM api_references
                    WHERE class_name = ? AND method_name = ?
                    LIMIT 1
                ''', (class_name, method_name))
            else:
                cursor.execute('''
                    SELECT * FROM api_references
                    WHERE method_name = ?
                    LIMIT 1
                ''', (method_name,))
            
            row = cursor.fetchone()
            if row:
                columns = [desc[0] for desc in cursor.description]
                result = dict(zip(columns, row))
                
                # Parse JSON fields
                if result.get('parameters'):
                    result['parameters'] = json.loads(result['parameters'])
                if result.get('examples'):
                    result['examples'] = json.loads(result['examples'])
                
                return result
            
            return None
            
        finally:
            conn.close()
    
    def search_by_error(self, error_message: str) -> List[Dict[str, Any]]:
        """Find solutions for specific errors"""
        # Extract key terms from error message
        error_terms = self._extract_error_terms(error_message)
        
        # Search for related examples and documentation
        results = self.search_code(' '.join(error_terms), 'hybrid', limit=20)
        
        # Filter and rank results based on error relevance
        relevant_results = []
        for result in results:
            if self._is_error_relevant(result, error_message):
                relevant_results.append(result)
        
        return relevant_results
    
    def get_language_patterns(self, language: str, pattern_type: str = 'all') -> List[Dict[str, Any]]:
        """Get language-specific patterns and best practices"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        try:
            if pattern_type == 'all':
                cursor.execute('''
                    SELECT * FROM coding_concepts
                    WHERE category IN ('pattern', 'best_practice', 'idiom')
                    AND doc_id IN (
                        SELECT id FROM code_docs WHERE language = ?
                    )
                ''', (language,))
            else:
                cursor.execute('''
                    SELECT * FROM coding_concepts
                    WHERE category = ?
                    AND doc_id IN (
                        SELECT id FROM code_docs WHERE language = ?
                    )
                ''', (pattern_type, language))
            
            results = []
            for row in cursor.fetchall():
                columns = [desc[0] for desc in cursor.description]
                concept = dict(zip(columns, row))
                
                # Parse JSON fields
                for field in ['best_practices', 'anti_patterns', 'related_concepts']:
                    if concept.get(field):
                        concept[field] = json.loads(concept[field])
                
                results.append(concept)
            
            return results
            
        finally:
            conn.close()
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about the knowledge base"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        try:
            stats = {}
            
            # Count documents
            cursor.execute('SELECT COUNT(*) FROM code_docs')
            stats['total_docs'] = cursor.fetchone()[0]
            
            # Count code examples
            cursor.execute('SELECT COUNT(*) FROM code_examples')
            stats['total_examples'] = cursor.fetchone()[0]
            
            # Count API references
            cursor.execute('SELECT COUNT(*) FROM api_references')
            stats['total_api_refs'] = cursor.fetchone()[0]
            
            # Count concepts
            cursor.execute('SELECT COUNT(*) FROM coding_concepts')
            stats['total_concepts'] = cursor.fetchone()[0]
            
            # Get languages
            cursor.execute('SELECT DISTINCT language FROM code_docs WHERE language IS NOT NULL')
            stats['languages'] = [row[0] for row in cursor.fetchall()]
            
            # Get frameworks
            cursor.execute('SELECT DISTINCT framework FROM code_docs WHERE framework IS NOT NULL')
            stats['frameworks'] = [row[0] for row in cursor.fetchall()]
            
            # Database size
            stats['db_size_mb'] = os.path.getsize(self.db_path) / (1024 * 1024)
            
            return stats
            
        finally:
            conn.close()
    
    def _generate_embedding(self, text: str) -> Optional[bytes]:
        """Generate embeddings for text if available"""
        if not EMBEDDINGS_AVAILABLE or not text:
            return None
        
        try:
            embedding = embedding_model.encode(text)
            return embedding.tobytes()
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return None
    
    def _add_to_search_index(self, cursor, table_name: str, record_id: int, text: str):
        """Add entry to search index"""
        cursor.execute('''
            INSERT INTO search_index (table_name, record_id, searchable_text, embeddings)
            VALUES (?, ?, ?, ?)
        ''', (table_name, record_id, text, self._generate_embedding(text)))
        
        # Also add to FTS index
        cursor.execute('''
            INSERT INTO search_fts (table_name, record_id, searchable_text)
            VALUES (?, ?, ?)
        ''', (table_name, record_id, text))
    
    def _semantic_search(self, cursor, table_name: str, query_embedding: bytes, limit: int) -> List[Dict[str, Any]]:
        """Perform semantic search using embeddings"""
        results = []
        
        # Get all embeddings from the table
        cursor.execute(f'''
            SELECT id, embeddings FROM {table_name}
            WHERE embeddings IS NOT NULL
        ''')
        
        query_vec = np.frombuffer(query_embedding, dtype=np.float32)
        
        for row_id, embedding_bytes in cursor.fetchall():
            if embedding_bytes:
                doc_vec = np.frombuffer(embedding_bytes, dtype=np.float32)
                
                # Cosine similarity
                similarity = np.dot(query_vec, doc_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(doc_vec))
                
                if similarity > 0.5:  # Threshold for relevance
                    results.append({
                        'type': table_name,
                        'id': row_id,
                        'score': float(similarity)
                    })
        
        # Sort by similarity and return top results
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:limit]
    
    def _extract_error_terms(self, error_message: str) -> List[str]:
        """Extract meaningful terms from error message"""
        # Remove common words and extract key terms
        stop_words = {'the', 'is', 'at', 'which', 'on', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be'}
        
        # Extract potential class/function names (CamelCase or snake_case)
        pattern = r'\b[A-Z][a-z]+(?:[A-Z][a-z]+)*\b|\b[a-z]+(?:_[a-z]+)*\b'
        terms = re.findall(pattern, error_message)
        
        # Filter out stop words and short terms
        terms = [term for term in terms if term.lower() not in stop_words and len(term) > 2]
        
        return terms
    
    def _is_error_relevant(self, result: Dict[str, Any], error_message: str) -> bool:
        """Check if a search result is relevant to the error"""
        # Simple relevance check - can be enhanced
        error_lower = error_message.lower()
        text_lower = result.get('text', '').lower()
        
        # Check for error-related keywords
        error_keywords = ['error', 'exception', 'fix', 'solution', 'resolve', 'handle']
        
        for keyword in error_keywords:
            if keyword in text_lower:
                return True
        
        # Check if error terms appear in the result
        error_terms = self._extract_error_terms(error_message)
        for term in error_terms:
            if term.lower() in text_lower:
                return True
        
        return False

# Export the service class
__all__ = ['CodingKnowledgeService']