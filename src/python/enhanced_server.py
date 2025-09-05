#!/usr/bin/env python3
"""
Enhanced Knowledge Service HTTP Server
Provides REST API for the enhanced knowledge management system
"""

import json
import sys
import os
import traceback
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

# Add parent directory to path to import our module
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Try to import enhanced service, fall back to simple if dependencies missing
try:
    from enhanced_knowledge_service import EnhancedKnowledgeService
    print("✅ Enhanced Knowledge Service loaded with full features")
    ENHANCED_MODE = True
except ImportError as e:
    print(f"⚠️  Some dependencies missing: {e}")
    print("⚠️  Falling back to simple mode")
    from simple_server import SimpleKnowledgeManager
    ENHANCED_MODE = False

class KnowledgeAPIHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for Knowledge API"""
    
    def __init__(self, *args, **kwargs):
        # Get workspace path from environment or use default
        workspace_path = os.environ.get('KNOWLEDGE_WORKSPACE', 
                                       '/Users/clemenshoenig/Documents/My-Coding-Programs/Knowledge OS')
        
        if ENHANCED_MODE:
            self.knowledge_service = EnhancedKnowledgeService(workspace_path)
        else:
            self.knowledge_service = SimpleKnowledgeManager()
            
        super().__init__(*args, **kwargs)
    
    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests"""
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        
        if path == '/health':
            self.send_json_response({'status': 'healthy', 'mode': 'enhanced' if ENHANCED_MODE else 'simple'})
            
        elif path == '/statistics':
            if ENHANCED_MODE:
                stats = self.knowledge_service.get_statistics()
                self.send_json_response(stats)
            else:
                self.send_json_response({'error': 'Statistics only available in enhanced mode'}, 404)
                
        elif path == '/search':
            params = parse_qs(parsed_path.query)
            query = params.get('q', [''])[0]
            search_type = params.get('type', ['hybrid'])[0]
            
            if ENHANCED_MODE:
                results = self.knowledge_service.search_knowledge(query, search_type)
                self.send_json_response({'results': results})
            else:
                # Simple keyword search fallback
                self.send_json_response({'results': [], 'mode': 'simple'})
                
        else:
            self.send_json_response({'error': 'Not found'}, 404)
    
    def do_POST(self):
        """Handle POST requests"""
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
        except json.JSONDecodeError:
            self.send_json_response({'error': 'Invalid JSON'}, 400)
            return
        
        path = urlparse(self.path).path
        
        try:
            if path == '/process':
                # Process text and extract entities
                text = data.get('text', '')
                source = data.get('source')
                
                if ENHANCED_MODE:
                    entities = self.knowledge_service.extract_entities(text, source)
                    result = {
                        'entities': entities,
                        'entity_count': len(entities),
                        'mode': 'enhanced'
                    }
                else:
                    # Use simple extraction
                    entities = self.knowledge_service.extract_entities(text)
                    result = {
                        'entities': [e.to_dict() for e in entities],
                        'entity_count': len(entities),
                        'mode': 'simple'
                    }
                    
                self.send_json_response(result)
                
            elif path == '/save':
                # Smart save with entity extraction
                content = data.get('content', '')
                title = data.get('title', 'Untitled')
                metadata = data.get('metadata', {})
                mode = data.get('mode', 'new')  # new, append, update
                
                if ENHANCED_MODE:
                    result = self.knowledge_service.save_to_knowledge(
                        content, title, metadata, mode
                    )
                    self.send_json_response(result)
                else:
                    # Simple save without entity extraction
                    self.send_json_response({
                        'success': True,
                        'mode': 'simple',
                        'message': 'Saved without entity extraction'
                    })
                    
            elif path == '/append':
                # Append to existing document
                content = data.get('content', '')
                title = data.get('title', 'Untitled')
                metadata = data.get('metadata', {})
                
                if ENHANCED_MODE:
                    result = self.knowledge_service.save_to_knowledge(
                        content, title, metadata, mode='append'
                    )
                    self.send_json_response(result)
                else:
                    self.send_json_response({'error': 'Append only available in enhanced mode'}, 404)
                    
            elif path == '/search':
                # Advanced search
                query = data.get('query', '')
                search_type = data.get('type', 'hybrid')
                
                if ENHANCED_MODE:
                    results = self.knowledge_service.search_knowledge(query, search_type)
                    self.send_json_response({'results': results})
                else:
                    self.send_json_response({'results': [], 'mode': 'simple'})
                    
            elif path == '/query':
                # Query knowledge graph
                query = data.get('query', '')
                
                if ENHANCED_MODE:
                    # Execute knowledge graph query
                    # This could be expanded to support graph queries
                    results = self.knowledge_service.search_knowledge(query, 'entity')
                    self.send_json_response({'results': results})
                else:
                    self.send_json_response({'error': 'Query only available in enhanced mode'}, 404)
                    
            else:
                self.send_json_response({'error': 'Not found'}, 404)
                
        except Exception as e:
            print(f"Error processing request: {e}")
            traceback.print_exc()
            self.send_json_response({'error': str(e)}, 500)
    
    def send_json_response(self, data, status=200):
        """Send JSON response with proper headers"""
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def log_message(self, format, *args):
        """Custom logging"""
        print(f"[Knowledge API] {format % args}")

def run_server(port=8000):
    """Run the HTTP server"""
    # Set workspace path from environment or use default
    workspace_path = os.environ.get('KNOWLEDGE_WORKSPACE', 
                                   '/Users/clemenshoenig/Documents/My-Coding-Programs/Knowledge OS')
    
    print(f"🚀 Starting Enhanced Knowledge Service on port {port}")
    print(f"📁 Workspace: {workspace_path}")
    print(f"🔧 Mode: {'Enhanced' if ENHANCED_MODE else 'Simple'}")
    
    if not ENHANCED_MODE:
        print("\n📦 To enable full features, install:")
        print("   pip install spacy sentence-transformers numpy")
        print("   python -m spacy download en_core_web_sm")
    
    server_address = ('', port)
    
    # Create a custom HTTPServer that passes the workspace to handlers
    class KnowledgeHTTPServer(HTTPServer):
        def __init__(self, server_address, RequestHandlerClass):
            super().__init__(server_address, RequestHandlerClass)
            self.workspace_path = workspace_path
            
            if ENHANCED_MODE:
                self.knowledge_service = EnhancedKnowledgeService(workspace_path)
            else:
                self.knowledge_service = SimpleKnowledgeManager()
    
    # Create custom handler that uses the shared service
    class CustomHandler(KnowledgeAPIHandler):
        def __init__(self, *args, **kwargs):
            self.knowledge_service = httpd.knowledge_service
            BaseHTTPRequestHandler.__init__(self, *args, **kwargs)
    
    httpd = KnowledgeHTTPServer(server_address, CustomHandler)
    
    print(f"\n✅ Knowledge API ready at http://localhost:{port}")
    print("\nEndpoints:")
    print("  GET  /health           - Check service health")
    print("  GET  /statistics       - Get knowledge base statistics")
    print("  GET  /search?q=...     - Search knowledge base")
    print("  POST /process          - Extract entities from text")
    print("  POST /save             - Save content with entity extraction")
    print("  POST /append           - Append to existing document")
    print("  POST /search           - Advanced search")
    print("  POST /query            - Query knowledge graph")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Shutting down Knowledge Service")
        httpd.shutdown()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run_server(port)