/**
 * Manager for Python Knowledge Service
 * Handles starting, stopping, and monitoring the Python FastAPI server
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { KnowledgeAPIClient } from './KnowledgeAPIClient';

export class PythonServiceManager {
  private pythonProcess: ChildProcess | null = null;
  private apiClient: KnowledgeAPIClient;
  private isRunning: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 30;
  private pythonPath: string;
  private serverPath: string;

  constructor() {
    this.apiClient = new KnowledgeAPIClient();
    
    // Determine Python executable path
    this.pythonPath = process.platform === 'win32' ? 'python' : 'python3';
    
    // Try enhanced server first, fall back to simple if needed
    const enhancedPath = path.join(__dirname, '..', '..', '..', 'src', 'python', 'enhanced_server.py');
    const simplePath = path.join(__dirname, '..', '..', '..', 'src', 'python', 'simple_server.py');
    
    // Check if enhanced server exists, otherwise use simple
    const fs = require('fs');
    this.serverPath = fs.existsSync(enhancedPath) ? enhancedPath : simplePath;
  }

  /**
   * Start the Python service
   */
  async start(): Promise<boolean> {
    if (this.isRunning) {
      console.log('Python service is already running');
      return true;
    }

    try {
      console.log('Starting Python Knowledge Service...');
      
      // Get workspace path from store
      const { store } = require('electron');
      const workspacePath = store.get('currentWorkspace') || process.cwd();
      
      // Spawn Python process with workspace environment
      this.pythonProcess = spawn(this.pythonPath, [this.serverPath], {
        cwd: path.dirname(this.serverPath),
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1', // Ensure real-time output
          KNOWLEDGE_WORKSPACE: workspacePath, // Pass workspace to Python
        },
      });

      // Handle stdout
      this.pythonProcess.stdout?.on('data', (data) => {
        console.log(`Python service: ${data.toString()}`);
      });

      // Handle stderr
      this.pythonProcess.stderr?.on('data', (data) => {
        console.error(`Python service error: ${data.toString()}`);
      });

      // Handle process exit
      this.pythonProcess.on('exit', (code) => {
        console.log(`Python service exited with code ${code}`);
        this.isRunning = false;
        this.pythonProcess = null;
      });

      // Handle errors
      this.pythonProcess.on('error', (error) => {
        console.error('Failed to start Python service:', error);
        this.isRunning = false;
        this.pythonProcess = null;
      });

      // Wait for service to be ready
      await this.waitForService();
      
      this.isRunning = true;
      console.log('Python Knowledge Service started successfully');
      return true;
      
    } catch (error) {
      console.error('Failed to start Python service:', error);
      this.stop();
      return false;
    }
  }

  /**
   * Wait for the service to be ready
   */
  private async waitForService(): Promise<void> {
    this.retryCount = 0;
    
    while (this.retryCount < this.maxRetries) {
      try {
        const isHealthy = await this.apiClient.checkHealth();
        if (isHealthy) {
          console.log('Python service is healthy');
          return;
        }
      } catch (error) {
        // Service not ready yet
      }
      
      this.retryCount++;
      await this.sleep(1000); // Wait 1 second before retry
    }
    
    throw new Error('Python service failed to start after 30 seconds');
  }

  /**
   * Stop the Python service
   */
  stop(): void {
    if (this.pythonProcess) {
      console.log('Stopping Python Knowledge Service...');
      
      if (process.platform === 'win32') {
        // On Windows, use taskkill
        spawn('taskkill', ['/pid', this.pythonProcess.pid!.toString(), '/f']);
      } else {
        // On Unix-like systems, send SIGTERM
        this.pythonProcess.kill('SIGTERM');
      }
      
      this.pythonProcess = null;
      this.isRunning = false;
      console.log('Python Knowledge Service stopped');
    }
  }

  /**
   * Restart the Python service
   */
  async restart(): Promise<boolean> {
    this.stop();
    await this.sleep(2000); // Wait 2 seconds before restarting
    return this.start();
  }

  /**
   * Check if the service is running
   */
  async checkStatus(): Promise<boolean> {
    try {
      return await this.apiClient.checkHealth();
    } catch {
      return false;
    }
  }

  /**
   * Get the API client
   */
  getAPIClient(): KnowledgeAPIClient {
    return this.apiClient;
  }

  /**
   * Helper function to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Install Python dependencies
   */
  async installDependencies(): Promise<boolean> {
    return new Promise((resolve) => {
      console.log('Installing Python dependencies...');
      
      const requirementsPath = path.join(
        path.dirname(this.serverPath), 
        'requirements.txt'
      );
      
      const pipProcess = spawn(
        this.pythonPath, 
        ['-m', 'pip', 'install', '-r', requirementsPath],
        {
          cwd: path.dirname(this.serverPath),
        }
      );

      pipProcess.stdout?.on('data', (data) => {
        console.log(`pip: ${data.toString()}`);
      });

      pipProcess.stderr?.on('data', (data) => {
        console.error(`pip error: ${data.toString()}`);
      });

      pipProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('Python dependencies installed successfully');
          resolve(true);
        } else {
          console.error(`Failed to install Python dependencies (exit code ${code})`);
          resolve(false);
        }
      });

      pipProcess.on('error', (error) => {
        console.error('Failed to run pip:', error);
        resolve(false);
      });
    });
  }

  /**
   * Clean up on app shutdown
   */
  cleanup(): void {
    this.stop();
  }
}