/**
 * IPC handlers for Python Knowledge Agent Service
 */

import { ipcMain } from 'electron';
import { PythonServiceManager } from './services/PythonServiceManager';
import { KnowledgeAPIClient } from './services/KnowledgeAPIClient';

let pythonService: PythonServiceManager | null = null;
let apiClient: KnowledgeAPIClient | null = null;

export function setupKnowledgeAgentHandlers(service: PythonServiceManager) {
  pythonService = service;
  apiClient = service.getAPIClient();

  // Process text to extract entities
  ipcMain.handle('knowledge:processText', async (_, text: string, source?: string) => {
    if (!apiClient) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const result = await apiClient.processText({ text, source });
      return { success: true, data: result };
    } catch (error: any) {
      console.error('Error processing text:', error);
      return { success: false, error: error.message };
    }
  });

  // Query knowledge graph
  ipcMain.handle('knowledge:query', async (_, query: string, options?: any) => {
    if (!apiClient) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const result = await apiClient.query({
        query,
        ...options
      });
      return { success: true, data: result };
    } catch (error: any) {
      console.error('Error querying knowledge:', error);
      return { success: false, error: error.message };
    }
  });

  // Get entities
  ipcMain.handle('knowledge:getEntities', async (_, entityType?: string) => {
    if (!apiClient) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const entities = await apiClient.getEntities(entityType);
      return { success: true, data: entities };
    } catch (error: any) {
      console.error('Error getting entities:', error);
      return { success: false, error: error.message };
    }
  });

  // Get specific entity
  ipcMain.handle('knowledge:getEntity', async (_, entityId: string) => {
    if (!apiClient) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const result = await apiClient.getEntity(entityId);
      return { success: true, data: result };
    } catch (error: any) {
      console.error('Error getting entity:', error);
      return { success: false, error: error.message };
    }
  });

  // Update entity
  ipcMain.handle('knowledge:updateEntity', async (_, entityId: string, attributes: any, source?: string) => {
    if (!apiClient) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const entity = await apiClient.updateEntity(entityId, attributes, source);
      return { success: true, data: entity };
    } catch (error: any) {
      console.error('Error updating entity:', error);
      return { success: false, error: error.message };
    }
  });

  // Get canonical locations
  ipcMain.handle('knowledge:getCanonicalLocations', async (_, entityIds: string[]) => {
    if (!apiClient) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const mappings = await apiClient.getCanonicalLocations(entityIds);
      return { success: true, data: mappings };
    } catch (error: any) {
      console.error('Error getting canonical locations:', error);
      return { success: false, error: error.message };
    }
  });

  // Resolve conflicts
  ipcMain.handle('knowledge:resolveConflicts', async (_, entityId: string) => {
    if (!apiClient) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const entity = await apiClient.resolveConflicts(entityId);
      return { success: true, data: entity };
    } catch (error: any) {
      console.error('Error resolving conflicts:', error);
      return { success: false, error: error.message };
    }
  });

  // Service status
  ipcMain.handle('knowledge:checkStatus', async () => {
    if (!pythonService) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const isRunning = await pythonService.checkStatus();
      return { success: true, data: { isRunning } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Restart service
  ipcMain.handle('knowledge:restartService', async () => {
    if (!pythonService) {
      return { success: false, error: 'Python service not initialized' };
    }

    try {
      const success = await pythonService.restart();
      return { success, data: { restarted: success } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  console.log('✅ Knowledge Agent IPC handlers registered');
}