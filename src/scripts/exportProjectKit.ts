#!/usr/bin/env node

import * as fs from 'fs-extra';
import * as path from 'path';
import { program } from 'commander';
import * as chalk from 'chalk';

interface ExportOptions {
  targetPath: string;
  includeDocs?: boolean;
  framework?: string;
  lightweight?: boolean;
}

class ProjectKitExporter {
  private sourceRoot: string;
  private knowledgeDbPath: string;

  constructor() {
    this.sourceRoot = path.join(__dirname, '..', '..');
    this.knowledgeDbPath = path.join(this.sourceRoot, '.knowledge', 'code_knowledge.db');
  }

  async exportKit(options: ExportOptions) {
    const { targetPath, framework, lightweight = false } = options;
    
    console.log(chalk.blue('🚀 Exporting Project Starter Kit...'));
    
    // Create target directory structure
    const dirs = [
      path.join(targetPath, '.knowledge-kit'),
      path.join(targetPath, '.knowledge-kit', 'db'),
      path.join(targetPath, '.knowledge-kit', 'scripts'),
      path.join(targetPath, '.knowledge-kit', 'templates'),
      path.join(targetPath, '.vscode'),
    ];

    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }

    // 1. Copy the knowledge database
    if (await fs.pathExists(this.knowledgeDbPath)) {
      console.log(chalk.gray('📦 Copying knowledge database...'));
      await fs.copy(
        this.knowledgeDbPath,
        path.join(targetPath, '.knowledge-kit', 'db', 'knowledge.db')
      );
    }

    // 2. Create standalone query script
    await this.createQueryScript(targetPath, lightweight);

    // 3. Create project initializer
    await this.createInitScript(targetPath, framework);

    // 4. Create local API server (Python)
    if (!lightweight) {
      await this.createLocalApiServer(targetPath);
    }

    // 5. Create VS Code integration
    await this.createVSCodeIntegration(targetPath);

    // 6. Create CLI tools
    await this.createCLITools(targetPath);

    // 7. Create README
    await this.createReadme(targetPath, framework);

    console.log(chalk.green('✅ Project Kit exported successfully!'));
    console.log(chalk.yellow('\n📖 Next steps:'));
    console.log(chalk.white('   1. cd ' + targetPath));
    console.log(chalk.white('   2. ./knowledge-kit init'));
    console.log(chalk.white('   3. ./knowledge-kit search "your query"'));
  }

  private async createQueryScript(targetPath: string, lightweight: boolean) {
    const scriptContent = `#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const chalk = require('chalk');

class KnowledgeQuery {
  constructor() {
    this.dbPath = path.join(__dirname, '.knowledge-kit', 'db', 'knowledge.db');
    this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY);
  }

  async search(query, options = {}) {
    const { limit = 10, type = 'all' } = options;
    
    return new Promise((resolve, reject) => {
      let sql = \`
        SELECT 
          cd.title,
          cd.url,
          cd.content,
          cd.framework,
          cd.language
        FROM code_docs cd
        WHERE cd.content LIKE ?
      \`;

      if (type === 'examples') {
        sql = \`
          SELECT 
            ce.title,
            ce.description,
            ce.code,
            ce.language
          FROM code_examples ce
          WHERE ce.code LIKE ? OR ce.description LIKE ?
        \`;
      }

      sql += ' LIMIT ?';

      const params = type === 'examples' 
        ? [\`%\${query}%\`, \`%\${query}%\`, limit]
        : [\`%\${query}%\`, limit];

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getTemplates(framework) {
    return new Promise((resolve, reject) => {
      const sql = \`
        SELECT DISTINCT
          ce.title,
          ce.code,
          ce.description
        FROM code_examples ce
        JOIN code_docs cd ON ce.doc_id = cd.id
        WHERE cd.framework = ?
        ORDER BY ce.title
      \`;

      this.db.all(sql, [framework], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    this.db.close();
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const query = args[1];

  const kb = new KnowledgeQuery();

  switch(command) {
    case 'search':
      kb.search(query)
        .then(results => {
          results.forEach(r => {
            console.log(chalk.blue('📄 ' + r.title));
            console.log(chalk.gray(r.url || ''));
            console.log(r.content?.substring(0, 200) + '...\\n');
          });
        })
        .finally(() => kb.close());
      break;

    case 'templates':
      kb.getTemplates(query)
        .then(results => {
          results.forEach(r => {
            console.log(chalk.green('📝 ' + r.title));
            console.log(chalk.gray(r.description));
            console.log(chalk.cyan(r.code?.substring(0, 100) + '...\\n'));
          });
        })
        .finally(() => kb.close());
      break;

    default:
      console.log('Usage: knowledge-query [search|templates] <query>');
      kb.close();
  }
}

module.exports = KnowledgeQuery;
`;

    await fs.writeFile(
      path.join(targetPath, '.knowledge-kit', 'scripts', 'query.js'),
      scriptContent
    );
    await fs.chmod(path.join(targetPath, '.knowledge-kit', 'scripts', 'query.js'), '755');
  }

  private async createInitScript(targetPath: string, framework?: string) {
    const initScript = `#!/bin/bash

echo "🚀 Initializing Project with Knowledge Kit..."

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm init -y
  npm install sqlite3 chalk commander
fi

# Framework-specific initialization
FRAMEWORK="${framework || 'generic'}"

case $FRAMEWORK in
  "react")
    echo "⚛️ Setting up React project..."
    npx create-react-app . --template typescript
    ;;
  "nextjs")
    echo "▲ Setting up Next.js project..."
    npx create-next-app@latest . --typescript --tailwind --app
    ;;
  "vue")
    echo "💚 Setting up Vue project..."
    npm create vue@latest . -- --typescript
    ;;
  *)
    echo "📝 Generic project setup..."
    ;;
esac

# Create knowledge-kit CLI symlink
echo "🔗 Creating knowledge-kit CLI..."
cat > knowledge-kit << 'EOF'
#!/bin/bash

COMMAND=$1
shift

case $COMMAND in
  "search")
    node .knowledge-kit/scripts/query.js search "$@"
    ;;
  "templates")
    node .knowledge-kit/scripts/query.js templates "$@"
    ;;
  "serve")
    python3 .knowledge-kit/scripts/api_server.py
    ;;
  "init")
    ./.knowledge-kit/scripts/init.sh
    ;;
  *)
    echo "Usage: ./knowledge-kit [search|templates|serve|init] <args>"
    ;;
esac
EOF

chmod +x knowledge-kit

echo "✅ Project initialized! Use ./knowledge-kit search 'query' to search documentation"
`;

    const scriptPath = path.join(targetPath, '.knowledge-kit', 'scripts', 'init.sh');
    await fs.writeFile(scriptPath, initScript);
    await fs.chmod(scriptPath, '755');
  }

  private async createLocalApiServer(targetPath: string) {
    const apiServer = `#!/usr/bin/env python3

import sqlite3
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import os

class KnowledgeAPIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        path = parsed_path.path
        params = parse_qs(parsed_path.query)
        
        db_path = os.path.join(os.path.dirname(__file__), '..', 'db', 'knowledge.db')
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        try:
            if path == '/search':
                query = params.get('q', [''])[0]
                limit = int(params.get('limit', [10])[0])
                
                cursor.execute("""
                    SELECT title, content, url, language, framework
                    FROM code_docs
                    WHERE content LIKE ?
                    LIMIT ?
                """, (f'%{query}%', limit))
                
                results = [dict(row) for row in cursor.fetchall()]
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(results).encode())
                
            elif path == '/examples':
                language = params.get('lang', [''])[0]
                
                cursor.execute("""
                    SELECT title, code, description, language
                    FROM code_examples
                    WHERE language LIKE ?
                    LIMIT 20
                """, (f'%{language}%',))
                
                results = [dict(row) for row in cursor.fetchall()]
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(results).encode())
                
            else:
                self.send_response(404)
                self.end_headers()
                
        finally:
            conn.close()

if __name__ == '__main__':
    port = 8002
    server = HTTPServer(('localhost', port), KnowledgeAPIHandler)
    print(f'🚀 Knowledge API running on http://localhost:{port}')
    print('📝 Endpoints:')
    print('   GET /search?q=<query>&limit=<n>')
    print('   GET /examples?lang=<language>')
    server.serve_forever()
`;

    await fs.writeFile(
      path.join(targetPath, '.knowledge-kit', 'scripts', 'api_server.py'),
      apiServer
    );
    await fs.chmod(path.join(targetPath, '.knowledge-kit', 'scripts', 'api_server.py'), '755');
  }

  private async createVSCodeIntegration(targetPath: string) {
    const snippets = {
      "Knowledge Search": {
        "prefix": "ksearch",
        "body": [
          "// Search knowledge base",
          "const KnowledgeQuery = require('./.knowledge-kit/scripts/query.js');",
          "const kb = new KnowledgeQuery();",
          "const results = await kb.search('$1');",
          "console.log(results);"
        ]
      },
      "Get Template": {
        "prefix": "ktemplate",
        "body": [
          "// Get template from knowledge base",
          "const KnowledgeQuery = require('./.knowledge-kit/scripts/query.js');",
          "const kb = new KnowledgeQuery();",
          "const templates = await kb.getTemplates('$1');",
          "// Use template: templates[0].code"
        ]
      }
    };

    const tasks = {
      "version": "2.0.0",
      "tasks": [
        {
          "label": "Knowledge Search",
          "type": "shell",
          "command": "./knowledge-kit search '${input:searchQuery}'",
          "problemMatcher": []
        },
        {
          "label": "Start Knowledge API",
          "type": "shell",
          "command": "./knowledge-kit serve",
          "isBackground": true,
          "problemMatcher": []
        }
      ],
      "inputs": [
        {
          "id": "searchQuery",
          "type": "promptString",
          "description": "Enter search query"
        }
      ]
    };

    await fs.writeJson(
      path.join(targetPath, '.vscode', 'snippets.json'),
      snippets,
      { spaces: 2 }
    );

    await fs.writeJson(
      path.join(targetPath, '.vscode', 'tasks.json'),
      tasks,
      { spaces: 2 }
    );
  }

  private async createCLITools(targetPath: string) {
    const mainCLI = `#!/bin/bash
# Main Knowledge Kit CLI
node .knowledge-kit/scripts/query.js "$@"
`;

    await fs.writeFile(path.join(targetPath, 'knowledge-kit'), mainCLI);
    await fs.chmod(path.join(targetPath, 'knowledge-kit'), '755');
  }

  private async createReadme(targetPath: string, framework?: string) {
    const readme = `# Project with Knowledge Kit

This project includes an embedded knowledge base with indexed documentation from:
- React Documentation
- TypeScript Handbook
- Framework-specific patterns
- Custom code examples

## Quick Start

\`\`\`bash
# Initialize the project
./knowledge-kit init

# Search documentation
./knowledge-kit search "react hooks"

# Get code templates
./knowledge-kit templates react

# Start local API server (optional)
./knowledge-kit serve
\`\`\`

## VS Code Integration

This project includes VS Code snippets and tasks:
- Use \`ksearch\` snippet to search from code
- Run "Knowledge Search" task from Command Palette
- Start API server from Tasks menu

## API Usage

When the API server is running (port 8002):

\`\`\`javascript
// Search from your code
fetch('http://localhost:8002/search?q=authentication')
  .then(res => res.json())
  .then(docs => console.log(docs));

// Get examples
fetch('http://localhost:8002/examples?lang=typescript')
  .then(res => res.json())
  .then(examples => console.log(examples));
\`\`\`

## Structure

\`\`\`
.knowledge-kit/
├── db/
│   └── knowledge.db      # Indexed documentation
├── scripts/
│   ├── query.js          # Query engine
│   ├── api_server.py     # REST API server
│   └── init.sh          # Project initializer
└── templates/           # Code templates
\`\`\`

${framework ? `\n## Framework: ${framework}\n\nThis project is configured for ${framework} development.\n` : ''}
`;

    await fs.writeFile(path.join(targetPath, 'KNOWLEDGE_KIT.md'), readme);
  }
}

// CLI Program
program
  .name('export-project-kit')
  .description('Export Knowledge Kit to new project')
  .version('1.0.0');

program
  .command('export <path>')
  .description('Export knowledge kit to target path')
  .option('-d, --docs', 'Include documentation', true)
  .option('-f, --framework <type>', 'Framework type (react/nextjs/vue)')
  .option('-l, --lightweight', 'Lightweight export (no API server)')
  .action(async (targetPath: string, options) => {
    const exporter = new ProjectKitExporter();
    const resolvedPath = path.resolve(targetPath);
    
    try {
      await fs.ensureDir(resolvedPath);
      await exporter.exportKit({
        targetPath: resolvedPath,
        includeDocs: options.docs,
        framework: options.framework,
        lightweight: options.lightweight
      });
    } catch (error) {
      console.error(chalk.red('❌ Export failed:'), error);
      process.exit(1);
    }
  });

program.parse(process.argv);