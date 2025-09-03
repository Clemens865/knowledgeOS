"""
Simplified Knowledge Management Service
Minimal dependencies version for easy setup
"""
import json
import re
from typing import Dict, List, Any, Optional
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from datetime import datetime
import threading
import time


class Entity:
    """Simple entity representation"""
    def __init__(self, id: str, type: str, name: str):
        self.id = id
        self.type = type
        self.name = name
        self.attributes = {}
        self.confidence = "high"
        self.created_at = datetime.utcnow().isoformat()
        self.updated_at = datetime.utcnow().isoformat()
        
    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'name': self.name,
            'attributes': self.attributes,
            'confidence': self.confidence,
            'createdAt': self.created_at,
            'updatedAt': self.updated_at
        }


class SimpleKnowledgeManager:
    """Simplified knowledge management without heavy dependencies"""
    
    def __init__(self):
        self.entities = {}
        self.relationships = []
        
    def extract_entities(self, text: str) -> List[Entity]:
        """Simple pattern-based entity extraction"""
        entities = []
        
        # Extract person names (simple pattern)
        person_patterns = [
            r'\b([A-Z][a-z]+ [A-Z][a-z]+)\b',  # Full names
            r'\b(Julian|Clemens|Mark|Sarah|John|Jane)\b',  # Known names
        ]
        
        for pattern in person_patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                entity_id = f"person_{match.lower().replace(' ', '_')}"
                entity = Entity(entity_id, "person", match)
                entities.append(entity)
        
        # Extract organizations
        org_patterns = [
            r'\b(Apple|Google|Microsoft|Amazon|Facebook|Meta)\b',
            r'\b([A-Z][a-z]+ (?:Inc|Corp|LLC|Company))\b',
        ]
        
        for pattern in org_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                entity_id = f"organization_{match.lower().replace(' ', '_')}"
                entity = Entity(entity_id, "organization", match)
                entities.append(entity)
        
        return entities
    
    def process_text(self, text: str) -> Dict[str, Any]:
        """Process text and extract entities"""
        entities = self.extract_entities(text)
        
        # Store entities
        for entity in entities:
            if entity.id not in self.entities:
                self.entities[entity.id] = entity
        
        # Determine file mappings
        file_mappings = {}
        for entity in entities:
            if entity.type == "person":
                # Check context
                if "work" in text.lower() or "employ" in text.lower():
                    file_mappings[entity.id] = "Professional Journey.md"
                else:
                    file_mappings[entity.id] = "Personal Info.md"
            elif entity.type == "organization":
                file_mappings[entity.id] = "Professional Journey.md"
        
        return {
            'entities': [e.to_dict() for e in entities],
            'relationships': [],
            'fileMappings': file_mappings,
            'summary': f'Processed {len(entities)} entities'
        }
    
    def query(self, query_text: str) -> Dict[str, Any]:
        """Simple query processing"""
        query_lower = query_text.lower()
        relevant_entities = []
        
        # Find relevant entities
        for entity_id, entity in self.entities.items():
            if entity.name.lower() in query_lower:
                relevant_entities.append(entity)
        
        # Suggest files based on query
        suggested_files = []
        if "work" in query_lower or "job" in query_lower:
            suggested_files.append("Professional Journey.md")
        elif "brother" in query_lower or "family" in query_lower:
            suggested_files.append("Personal Info.md")
        else:
            suggested_files.extend(["Personal Info.md", "Professional Journey.md"])
        
        return {
            'entities': [e.to_dict() for e in relevant_entities],
            'relationships': [],
            'suggestedFiles': suggested_files
        }


class KnowledgeAPIHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the knowledge API"""
    
    manager = SimpleKnowledgeManager()
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self.send_cors_headers()
        self.end_headers()
    
    def send_cors_headers(self):
        """Send CORS headers"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    
    def do_GET(self):
        """Handle GET requests"""
        parsed = urlparse(self.path)
        
        if parsed.path == '/health':
            self.send_json_response({
                'status': 'healthy',
                'version': '1.0.0-simple',
                'nlp_available': False,
                'entities_count': len(self.manager.entities),
                'relationships_count': len(self.manager.relationships)
            })
        elif parsed.path == '/entities':
            entities = [e.to_dict() for e in self.manager.entities.values()]
            self.send_json_response({
                'success': True,
                'data': {
                    'entities': entities,
                    'count': len(entities)
                }
            })
        else:
            self.send_error(404, 'Not Found')
    
    def do_POST(self):
        """Handle POST requests"""
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length > 0:
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body.decode('utf-8'))
            except json.JSONDecodeError:
                self.send_error(400, 'Invalid JSON')
                return
        else:
            data = {}
        
        parsed = urlparse(self.path)
        
        if parsed.path == '/process':
            text = data.get('text', '')
            result = self.manager.process_text(text)
            self.send_json_response({
                'success': True,
                'data': result,
                'timestamp': datetime.utcnow().isoformat()
            })
        elif parsed.path == '/query':
            query = data.get('query', '')
            result = self.manager.query(query)
            self.send_json_response({
                'success': True,
                'data': result,
                'timestamp': datetime.utcnow().isoformat()
            })
        else:
            self.send_error(404, 'Not Found')
    
    def send_json_response(self, data: Dict[str, Any]):
        """Send JSON response"""
        self.send_response(200)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {format % args}")


def run_server(port: int = 8000):
    """Run the simple HTTP server"""
    server = HTTPServer(('127.0.0.1', port), KnowledgeAPIHandler)
    print(f"🚀 Simple Knowledge Service starting on http://127.0.0.1:{port}")
    print("📊 No heavy dependencies required!")
    print("✅ Ready to accept connections")
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Shutting down Simple Knowledge Service")
        server.shutdown()


if __name__ == "__main__":
    run_server()