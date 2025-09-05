"""
Enhanced Knowledge Management Service with Full Python Power
Persistent storage, semantic search, and intelligent save/append/search
"""

import json
import sqlite3
import hashlib
import re
import os
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path
import numpy as np
from sentence_transformers import SentenceTransformer
import spacy
from collections import defaultdict
import pickle

class EnhancedKnowledgeService:
    """Full-featured knowledge management with persistence and intelligence"""
    
    def __init__(self, workspace_path: str):
        self.workspace_path = Path(workspace_path)
        self.knowledge_dir = self.workspace_path / ".knowledge"
        self.knowledge_dir.mkdir(exist_ok=True)
        
        # Initialize database
        self.db_path = self.knowledge_dir / "knowledge.db"
        self.init_database()
        
        # Initialize NLP models
        try:
            self.nlp = spacy.load("en_core_web_sm")
        except:
            # Fallback to simple extraction if spacy not available
            self.nlp = None
            
        # Initialize embedding model
        try:
            self.embedder = SentenceTransformer('all-MiniLM-L6-v2')
        except:
            self.embedder = None
            
        # In-memory caches
        self.entity_cache = {}
        self.relationship_cache = defaultdict(list)
        
    def init_database(self):
        """Initialize SQLite database for persistent storage"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Entities table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS entities (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                canonical_name TEXT,
                attributes TEXT,
                confidence REAL DEFAULT 1.0,
                embedding BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                source TEXT,
                metadata TEXT
            )
        ''')
        
        # Relationships table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS relationships (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                type TEXT NOT NULL,
                attributes TEXT,
                confidence REAL DEFAULT 1.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (source_id) REFERENCES entities(id),
                FOREIGN KEY (target_id) REFERENCES entities(id)
            )
        ''')
        
        # Documents table for markdown storage
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                file_path TEXT,
                entities TEXT,
                summary TEXT,
                embedding BLOB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        ''')
        
        # Create indexes for faster queries
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)')
        
        conn.commit()
        conn.close()
        
    def extract_entities(self, text: str, source: str = None) -> List[Dict]:
        """Extract entities using NLP or pattern matching"""
        entities = []
        
        if self.nlp:
            # Use spaCy for advanced entity extraction
            doc = self.nlp(text)
            
            for ent in doc.ents:
                entity_id = self.generate_entity_id(ent.text, ent.label_)
                entity = {
                    'id': entity_id,
                    'type': ent.label_.lower(),
                    'name': ent.text,
                    'canonical_name': self.canonicalize_name(ent.text),
                    'confidence': 0.9,
                    'source': source,
                    'context': text[max(0, ent.start_char-50):min(len(text), ent.end_char+50)]
                }
                entities.append(entity)
                
            # Extract relationships between entities
            self.extract_relationships(doc, entities)
        else:
            # Fallback to pattern-based extraction
            entities = self.pattern_based_extraction(text, source)
            
        return entities
    
    def pattern_based_extraction(self, text: str, source: str = None) -> List[Dict]:
        """Simple pattern-based entity extraction as fallback"""
        entities = []
        
        # Person patterns
        person_patterns = [
            r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b',
            r'\b(Dr\.|Prof\.|Mr\.|Mrs\.|Ms\.) ([A-Z][a-z]+ [A-Z][a-z]+)\b'
        ]
        
        for pattern in person_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                name = match if isinstance(match, str) else ' '.join(match)
                entity_id = self.generate_entity_id(name, 'person')
                entities.append({
                    'id': entity_id,
                    'type': 'person',
                    'name': name,
                    'canonical_name': self.canonicalize_name(name),
                    'confidence': 0.7,
                    'source': source
                })
        
        # Organization patterns
        org_patterns = [
            r'\b([A-Z][a-z]+ (?:Inc|Corp|LLC|Ltd|Company|Corporation))\b',
            r'\b(Apple|Google|Microsoft|Amazon|Facebook|Meta|OpenAI|Anthropic)\b'
        ]
        
        for pattern in org_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                entity_id = self.generate_entity_id(match, 'organization')
                entities.append({
                    'id': entity_id,
                    'type': 'organization', 
                    'name': match,
                    'canonical_name': self.canonicalize_name(match),
                    'confidence': 0.8,
                    'source': source
                })
                
        return entities
    
    def extract_relationships(self, doc, entities):
        """Extract relationships between entities"""
        if not self.nlp:
            return []
            
        relationships = []
        entity_map = {e['name']: e for e in entities}
        
        # Look for relationships in dependency parse
        for token in doc:
            if token.dep_ in ['nsubj', 'dobj', 'pobj']:
                # Check if this token is part of an entity
                for ent in doc.ents:
                    if token.i >= ent.start and token.i < ent.end:
                        # Look for related entities
                        for other_ent in doc.ents:
                            if other_ent != ent:
                                # Check if they're connected through the verb
                                if token.head.pos_ == 'VERB':
                                    rel = {
                                        'source': entity_map.get(ent.text),
                                        'target': entity_map.get(other_ent.text),
                                        'type': token.head.lemma_,
                                        'confidence': 0.7
                                    }
                                    if rel['source'] and rel['target']:
                                        relationships.append(rel)
                                        
        return relationships
    
    def save_to_knowledge(self, content: str, title: str = None, 
                         metadata: Dict = None, mode: str = 'new') -> Dict:
        """
        Smart save with entity extraction and deduplication
        Modes: 'new', 'append', 'update'
        """
        # Generate document ID
        doc_id = self.generate_document_id(title or "untitled")
        
        # Extract entities from content
        entities = self.extract_entities(content, source=title)
        
        # Generate embedding for semantic search
        embedding = None
        if self.embedder:
            embedding = self.embedder.encode(content[:1000])  # Use first 1000 chars
            
        # Handle different save modes
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        try:
            if mode == 'append':
                # Check if document exists
                cursor.execute('SELECT content, entities FROM documents WHERE id = ?', (doc_id,))
                existing = cursor.fetchone()
                
                if existing:
                    # Append to existing content
                    existing_content = existing[0]
                    existing_entities = json.loads(existing[1] or '[]')
                    
                    # Merge content intelligently (avoid duplication)
                    merged_content = self.merge_content(existing_content, content)
                    
                    # Merge entities
                    all_entities = existing_entities + entities
                    unique_entities = self.deduplicate_entities(all_entities)
                    
                    # Update document
                    cursor.execute('''
                        UPDATE documents 
                        SET content = ?, entities = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                    ''', (merged_content, json.dumps(unique_entities), doc_id))
                else:
                    mode = 'new'  # Fall through to new creation
                    
            if mode in ['new', 'update']:
                # Save or update document
                cursor.execute('''
                    INSERT OR REPLACE INTO documents 
                    (id, title, content, entities, embedding, metadata)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    doc_id,
                    title or "Untitled",
                    content,
                    json.dumps(entities),
                    pickle.dumps(embedding) if embedding is not None else None,
                    json.dumps(metadata or {})
                ))
                
            # Save entities to entities table
            for entity in entities:
                entity_embedding = None
                if self.embedder:
                    entity_embedding = self.embedder.encode(entity['name'])
                    
                cursor.execute('''
                    INSERT OR REPLACE INTO entities
                    (id, type, name, canonical_name, confidence, embedding, source)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ''', (
                    entity['id'],
                    entity['type'],
                    entity['name'],
                    entity.get('canonical_name', entity['name']),
                    entity.get('confidence', 1.0),
                    pickle.dumps(entity_embedding) if entity_embedding is not None else None,
                    entity.get('source')
                ))
                
            conn.commit()
            
            # Also save as markdown file
            self.save_as_markdown(content, title, entities, metadata)
            
            return {
                'success': True,
                'document_id': doc_id,
                'entities_extracted': len(entities),
                'mode': mode
            }
            
        except Exception as e:
            conn.rollback()
            return {'success': False, 'error': str(e)}
        finally:
            conn.close()
            
    def search_knowledge(self, query: str, search_type: str = 'hybrid') -> List[Dict]:
        """
        Advanced search with multiple strategies
        Types: 'keyword', 'semantic', 'entity', 'hybrid'
        """
        results = []
        
        if search_type in ['semantic', 'hybrid'] and self.embedder:
            # Semantic search using embeddings
            query_embedding = self.embedder.encode(query)
            results.extend(self.semantic_search(query_embedding))
            
        if search_type in ['keyword', 'hybrid']:
            # Keyword search
            results.extend(self.keyword_search(query))
            
        if search_type in ['entity', 'hybrid']:
            # Entity-based search
            query_entities = self.extract_entities(query)
            results.extend(self.entity_search(query_entities))
            
        # Deduplicate and rank results
        unique_results = self.deduplicate_results(results)
        ranked_results = self.rank_results(unique_results, query)
        
        return ranked_results[:10]  # Return top 10 results
    
    def semantic_search(self, query_embedding: np.ndarray, top_k: int = 5) -> List[Dict]:
        """Search using semantic similarity"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        cursor.execute('SELECT id, title, content, embedding FROM documents WHERE embedding IS NOT NULL')
        documents = cursor.fetchall()
        
        results = []
        for doc_id, title, content, embedding_blob in documents:
            if embedding_blob:
                doc_embedding = pickle.loads(embedding_blob)
                similarity = self.cosine_similarity(query_embedding, doc_embedding)
                
                results.append({
                    'id': doc_id,
                    'title': title,
                    'content': content[:500],  # Preview
                    'score': similarity,
                    'type': 'semantic'
                })
                
        conn.close()
        
        # Sort by similarity score
        results.sort(key=lambda x: x['score'], reverse=True)
        return results[:top_k]
    
    def keyword_search(self, query: str) -> List[Dict]:
        """Traditional keyword search"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        # Search in content and title
        cursor.execute('''
            SELECT id, title, content 
            FROM documents 
            WHERE content LIKE ? OR title LIKE ?
        ''', (f'%{query}%', f'%{query}%'))
        
        results = []
        for doc_id, title, content in cursor.fetchall():
            # Calculate relevance score based on frequency
            score = content.lower().count(query.lower()) + title.lower().count(query.lower()) * 2
            
            results.append({
                'id': doc_id,
                'title': title,
                'content': content[:500],
                'score': score,
                'type': 'keyword'
            })
            
        conn.close()
        return results
    
    def entity_search(self, query_entities: List[Dict]) -> List[Dict]:
        """Search based on entities"""
        if not query_entities:
            return []
            
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        results = []
        for entity in query_entities:
            # Find documents containing this entity
            cursor.execute('''
                SELECT id, title, content, entities
                FROM documents
                WHERE entities LIKE ?
            ''', (f'%{entity["name"]}%',))
            
            for doc_id, title, content, entities_json in cursor.fetchall():
                doc_entities = json.loads(entities_json or '[]')
                
                # Count matching entities
                matching_entities = sum(1 for e in doc_entities 
                                      if e['name'].lower() == entity['name'].lower())
                
                if matching_entities > 0:
                    results.append({
                        'id': doc_id,
                        'title': title,
                        'content': content[:500],
                        'score': matching_entities * 10,  # Weight entity matches highly
                        'type': 'entity',
                        'matched_entity': entity['name']
                    })
                    
        conn.close()
        return results
    
    def merge_content(self, existing: str, new: str) -> str:
        """Intelligently merge content to avoid duplication"""
        # Simple approach: check if new content is already in existing
        if new in existing:
            return existing
            
        # Check for substantial overlap
        overlap = self.find_overlap(existing, new)
        if len(overlap) > len(new) * 0.5:  # More than 50% overlap
            # Merge by removing overlapping part
            return existing + new[len(overlap):]
        else:
            # Append with separator
            return existing + "\n\n---\n\n" + new
    
    def find_overlap(self, text1: str, text2: str) -> str:
        """Find overlapping text between two strings"""
        max_overlap = min(len(text1), len(text2))
        
        for i in range(max_overlap, 0, -1):
            if text1[-i:] == text2[:i]:
                return text2[:i]
                
        return ""
    
    def deduplicate_entities(self, entities: List[Dict]) -> List[Dict]:
        """Remove duplicate entities based on canonical name"""
        seen = {}
        unique = []
        
        for entity in entities:
            canonical = entity.get('canonical_name', entity['name']).lower()
            
            if canonical not in seen:
                seen[canonical] = entity
                unique.append(entity)
            else:
                # Merge attributes if needed
                existing = seen[canonical]
                if entity.get('confidence', 0) > existing.get('confidence', 0):
                    seen[canonical] = entity
                    
        return unique
    
    def deduplicate_results(self, results: List[Dict]) -> List[Dict]:
        """Remove duplicate search results"""
        seen = set()
        unique = []
        
        for result in results:
            if result['id'] not in seen:
                seen.add(result['id'])
                unique.append(result)
                
        return unique
    
    def rank_results(self, results: List[Dict], query: str) -> List[Dict]:
        """Rank search results by relevance"""
        # Combine scores from different search types
        combined = defaultdict(lambda: {'score': 0, 'result': None})
        
        for result in results:
            doc_id = result['id']
            weight = {'semantic': 1.0, 'keyword': 0.8, 'entity': 1.2}.get(result['type'], 1.0)
            
            if combined[doc_id]['result'] is None:
                combined[doc_id]['result'] = result
                
            combined[doc_id]['score'] += result['score'] * weight
            
        # Sort by combined score
        ranked = sorted(combined.values(), key=lambda x: x['score'], reverse=True)
        return [item['result'] for item in ranked]
    
    def save_as_markdown(self, content: str, title: str, entities: List[Dict], metadata: Dict):
        """Save as markdown file with YAML frontmatter"""
        # Create filename from title
        safe_title = re.sub(r'[^\w\s-]', '', title or 'untitled').strip()
        safe_title = re.sub(r'[-\s]+', '-', safe_title)
        
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{safe_title}_{timestamp}.md"
        filepath = self.workspace_path / filename
        
        # Build YAML frontmatter
        frontmatter = {
            'title': title,
            'created': datetime.now().isoformat(),
            'entities': [{'name': e['name'], 'type': e['type']} for e in entities],
            'entity_count': len(entities),
            **metadata
        } if metadata else {
            'title': title,
            'created': datetime.now().isoformat(),
            'entities': [{'name': e['name'], 'type': e['type']} for e in entities],
            'entity_count': len(entities)
        }
        
        # Write file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('---\n')
            for key, value in frontmatter.items():
                if isinstance(value, list):
                    f.write(f'{key}:\n')
                    for item in value:
                        f.write(f'  - {item}\n')
                else:
                    f.write(f'{key}: {value}\n')
            f.write('---\n\n')
            f.write(content)
    
    def generate_entity_id(self, name: str, entity_type: str) -> str:
        """Generate unique entity ID"""
        normalized = name.lower().replace(' ', '_')
        return f"{entity_type}_{hashlib.md5(normalized.encode()).hexdigest()[:8]}"
    
    def generate_document_id(self, title: str) -> str:
        """Generate unique document ID"""
        normalized = title.lower().replace(' ', '_')
        return f"doc_{hashlib.md5(normalized.encode()).hexdigest()[:12]}"
    
    def canonicalize_name(self, name: str) -> str:
        """Create canonical form of name"""
        return ' '.join(name.split()).title()
    
    def cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors"""
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    
    def get_statistics(self) -> Dict:
        """Get knowledge base statistics"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()
        
        stats = {}
        
        cursor.execute('SELECT COUNT(*) FROM documents')
        stats['total_documents'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM entities')
        stats['total_entities'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM relationships')
        stats['total_relationships'] = cursor.fetchone()[0]
        
        cursor.execute('SELECT type, COUNT(*) FROM entities GROUP BY type')
        stats['entities_by_type'] = dict(cursor.fetchall())
        
        conn.close()
        return stats