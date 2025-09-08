#!/usr/bin/env python3
"""
Coding Knowledge API Server - REST API for the coding knowledge service
Runs on port 8001 to avoid conflicts with other services
"""

import json
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import the coding knowledge service
from coding_knowledge_service import CodingKnowledgeService

class CodingKnowledgeAPIHandler(BaseHTTPRequestHandler):
    """HTTP Request Handler for Coding Knowledge API"""
    
    def __init__(self, *args, **kwargs):
        # Get workspace path from environment
        workspace_path = os.environ.get('KNOWLEDGE_WORKSPACE', 
                                       '/Users/clemenshoenig/Documents/My-Coding-Programs/Knowledge OS')
        
        self.knowledge_service = CodingKnowledgeService(workspace_path)
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
            self.send_json_response({
                'status': 'healthy',
                'service': 'coding-knowledge',
                'version': '1.0.0'
            })
            
        elif path == '/statistics':
            stats = self.knowledge_service.get_statistics()
            self.send_json_response(stats)
            
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
            if path == '/save-crawl':
                # Save crawl results to database
                results = data.get('results', [])
                save_result = self.knowledge_service.save_crawl_results(results)
                self.send_json_response(save_result)
                
            elif path == '/search':
                # Search code knowledge
                query = data.get('query', '')
                search_type = data.get('search_type', 'hybrid')
                limit = data.get('limit', 10)
                
                results = self.knowledge_service.search_code(query, search_type, limit)
                self.send_json_response({
                    'success': True,
                    'results': results,
                    'count': len(results)
                })
                
            elif path == '/api-signature':
                # Get API signature
                class_name = data.get('class_name')
                method_name = data.get('method_name', '')
                
                signature = self.knowledge_service.get_api_signature(class_name, method_name)
                if signature:
                    self.send_json_response({
                        'success': True,
                        'signature': signature
                    })
                else:
                    self.send_json_response({
                        'success': False,
                        'error': 'API signature not found'
                    }, 404)
                    
            elif path == '/error-search':
                # Search for error solutions
                error_message = data.get('error', '')
                
                solutions = self.knowledge_service.search_by_error(error_message)
                self.send_json_response({
                    'success': True,
                    'solutions': solutions,
                    'count': len(solutions)
                })
                
            elif path == '/patterns':
                # Get language patterns
                language = data.get('language', '')
                pattern_type = data.get('type', 'all')
                
                patterns = self.knowledge_service.get_language_patterns(language, pattern_type)
                self.send_json_response({
                    'success': True,
                    'patterns': patterns,
                    'count': len(patterns)
                })
                
            else:
                self.send_json_response({'error': 'Endpoint not found'}, 404)
                
        except Exception as e:
            print(f"Error processing request: {e}")
            import traceback
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
        print(f"[Coding Knowledge API] {format % args}")

def run_server(port=8001):
    """Run the HTTP server"""
    workspace_path = os.environ.get('KNOWLEDGE_WORKSPACE', 
                                   '/Users/clemenshoenig/Documents/My-Coding-Programs/Knowledge OS')
    
    print(f"🚀 Starting Coding Knowledge API Server on port {port}")
    print(f"📁 Workspace: {workspace_path}")
    print(f"🗄️  Database: {Path(workspace_path) / '.knowledge' / 'code_knowledge.db'}")
    
    server_address = ('', port)
    
    # Create a custom HTTPServer that passes workspace to handlers
    class CodingKnowledgeHTTPServer(HTTPServer):
        def __init__(self, server_address, RequestHandlerClass):
            super().__init__(server_address, RequestHandlerClass)
            self.workspace_path = workspace_path
            self.knowledge_service = CodingKnowledgeService(workspace_path)
    
    # Create custom handler that uses the shared service
    class CustomHandler(CodingKnowledgeAPIHandler):
        def __init__(self, *args, **kwargs):
            self.knowledge_service = httpd.knowledge_service
            BaseHTTPRequestHandler.__init__(self, *args, **kwargs)
    
    httpd = CodingKnowledgeHTTPServer(server_address, CustomHandler)
    
    print(f"\n✅ Coding Knowledge API ready at http://localhost:{port}")
    print("\nEndpoints:")
    print("  GET  /health           - Check service health")
    print("  GET  /statistics       - Get knowledge base statistics")
    print("  POST /save-crawl       - Save crawl results to database")
    print("  POST /search           - Search code knowledge")
    print("  POST /api-signature    - Get exact API signature")
    print("  POST /error-search     - Find solutions for errors")
    print("  POST /patterns         - Get language patterns and best practices")
    print("\n📚 This is a standalone service for coding documentation")
    print("🔧 It does not interfere with other KnowledgeOS features")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Shutting down Coding Knowledge API Server")
        httpd.shutdown()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    run_server(port)