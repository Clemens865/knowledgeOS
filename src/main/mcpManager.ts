import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { ipcMain } from 'electron';
import Store from 'electron-store';
import { spawn, ChildProcess } from 'child_process';

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  serverName: string;
}

class MCPManager {
  private store: Store;
  private clients: Map<string, Client> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private availableTools: MCPTool[] = [];

  constructor() {
    this.store = new Store();
    this.setupIpcHandlers();
    this.loadAndConnectServers();
  }

  private setupIpcHandlers() {
    // Get configured MCP servers
    ipcMain.handle('mcp:getServers', () => {
      return this.getServers();
    });

    // Add or update MCP server configuration
    ipcMain.handle('mcp:addServer', async (_, server: MCPServer) => {
      const servers = this.getServers();
      const existingIndex = servers.findIndex(s => s.name === server.name);
      
      if (existingIndex >= 0) {
        servers[existingIndex] = server;
      } else {
        servers.push(server);
      }
      
      (this.store as any).set('mcpServers', servers);
      
      // Reconnect if enabled
      if (server.enabled) {
        await this.connectServer(server);
      } else {
        await this.disconnectServer(server.name);
      }
      
      return { success: true };
    });

    // Remove MCP server
    ipcMain.handle('mcp:removeServer', async (_, name: string) => {
      const servers = this.getServers();
      const filtered = servers.filter(s => s.name !== name);
      (this.store as any).set('mcpServers', filtered);
      
      await this.disconnectServer(name);
      return { success: true };
    });

    // Get available tools from all connected servers
    ipcMain.handle('mcp:getTools', () => {
      return this.availableTools;
    });

    // Execute MCP tool
    ipcMain.handle('mcp:executeTool', async (_, toolName: string, args: any) => {
      const tool = this.availableTools.find(t => t.name === toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      const client = this.clients.get(tool.serverName);
      if (!client) {
        throw new Error(`Server ${tool.serverName} not connected`);
      }

      try {
        const result = await (client as any).callTool(toolName, args);
        return { success: true, result };
      } catch (error) {
        console.error(`Error executing MCP tool ${toolName}:`, error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });

    // Test MCP server connection
    ipcMain.handle('mcp:testConnection', async (_, server: MCPServer) => {
      try {
        await this.connectServer(server, true);
        return { success: true, message: 'Connection successful' };
      } catch (error) {
        return { 
          success: false, 
          error: error instanceof Error ? error.message : String(error) 
        };
      }
    });
  }

  private getServers(): MCPServer[] {
    const servers = (this.store as any).get('mcpServers', []) as MCPServer[];
    
    // Add default servers if none exist
    if (servers.length === 0) {
      const defaultServers: MCPServer[] = [
        {
          name: 'Filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/'],
          enabled: false
        },
        {
          name: 'Web Browser',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-puppeteer'],
          enabled: false
        },
        {
          name: 'PostgreSQL',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-postgres', 'postgresql://localhost/mydb'],
          enabled: false
        }
      ];
      
      (this.store as any).set('mcpServers', defaultServers);
      return defaultServers;
    }
    
    return servers;
  }

  private async loadAndConnectServers() {
    const servers = this.getServers();
    
    for (const server of servers) {
      if (server.enabled) {
        try {
          await this.connectServer(server);
          console.log(`Connected to MCP server: ${server.name}`);
        } catch (error) {
          console.error(`Failed to connect to MCP server ${server.name}:`, error);
        }
      }
    }
  }

  private async connectServer(server: MCPServer, isTest: boolean = false) {
    // Disconnect existing connection
    if (!isTest && this.clients.has(server.name)) {
      await this.disconnectServer(server.name);
    }

    // Spawn the server process
    const env: Record<string, string> = { ...process.env as Record<string, string>, ...(server.env || {}) };
    const childProcess = spawn(server.command, server.args, {
      env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle process errors
    childProcess.on('error', (error) => {
      console.error(`MCP server ${server.name} process error:`, error);
    });

    childProcess.stderr?.on('data', (data) => {
      console.error(`MCP server ${server.name} stderr:`, data.toString());
    });

    // Create MCP client with stdio transport
    const transport = new StdioClientTransport({
      command: server.command,
      args: server.args,
      env
    });

    const client = new Client({
      name: `knowledgeos-${server.name}`,
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    await client.connect(transport);

    if (isTest) {
      // For testing, disconnect immediately
      await client.close();
      childProcess.kill();
      return;
    }

    // Store client and process
    this.clients.set(server.name, client);
    this.processes.set(server.name, childProcess);

    // Discover available tools
    await this.discoverTools(server.name, client);
  }

  private async disconnectServer(name: string) {
    const client = this.clients.get(name);
    const process = this.processes.get(name);

    if (client) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error closing MCP client ${name}:`, error);
      }
      this.clients.delete(name);
    }

    if (process) {
      process.kill();
      this.processes.delete(name);
    }

    // Remove tools from this server
    this.availableTools = this.availableTools.filter(t => t.serverName !== name);
  }

  private async discoverTools(serverName: string, client: Client) {
    try {
      const tools = await (client as any).listTools();
      
      // Add tools to available tools list
      for (const tool of tools.tools) {
        this.availableTools.push({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema,
          serverName
        });
      }
      
      console.log(`Discovered ${tools.tools.length} tools from ${serverName}`);
    } catch (error) {
      console.error(`Error discovering tools from ${serverName}:`, error);
    }
  }

  // Get tools formatted for LLM functions
  public getToolsForLLM(): any[] {
    return this.availableTools.map(tool => {
      // Format for OpenAI function calling
      return {
        name: `mcp_${tool.name}`,
        description: `[MCP: ${tool.serverName}] ${tool.description}`,
        parameters: tool.inputSchema || {
          type: 'object',
          properties: {}
        }
      };
    });
  }

  // Execute tool and return result
  public async executeTool(toolName: string, args: any): Promise<any> {
    // Remove mcp_ prefix if present
    const actualToolName = toolName.startsWith('mcp_') ? 
      toolName.substring(4) : toolName;
    
    const tool = this.availableTools.find(t => t.name === actualToolName);
    if (!tool) {
      throw new Error(`MCP tool ${actualToolName} not found`);
    }

    const client = this.clients.get(tool.serverName);
    if (!client) {
      throw new Error(`MCP server ${tool.serverName} not connected`);
    }

    const result = await (client as any).callTool(actualToolName, args);
    return result;
  }

  // Cleanup on app quit
  public async cleanup() {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error closing MCP client ${name}:`, error);
      }
    }

    for (const [, process] of this.processes.entries()) {
      process.kill();
    }
  }
}

// Singleton instance
let mcpManager: MCPManager | null = null;

export function initMCPManager(): MCPManager {
  if (!mcpManager) {
    mcpManager = new MCPManager();
  }
  return mcpManager;
}

export function getMCPManager(): MCPManager | null {
  return mcpManager;
}