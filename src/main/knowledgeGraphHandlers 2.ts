import { ipcMain } from 'electron';
import { KnowledgeGraphService } from '../features/knowledgeGraph/KnowledgeGraphService';

export function setupKnowledgeGraphHandlers() {
  // Build knowledge graph
  ipcMain.handle('knowledgeGraph:build', async (_, workspacePath: string) => {
    try {
      console.log('Building knowledge graph for:', workspacePath);
      const service = new KnowledgeGraphService(workspacePath);
      const graph = await service.buildGraph();
      
      console.log(`✅ Knowledge graph built: ${graph.nodes.length} nodes, ${graph.links.length} links`);
      return { success: true, graph };
    } catch (error) {
      console.error('Error building knowledge graph:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  // Get node details
  ipcMain.handle('knowledgeGraph:getNodeDetails', async (_, workspacePath: string, nodeId: string) => {
    try {
      const service = new KnowledgeGraphService(workspacePath);
      await service.buildGraph(); // Need to build first to populate nodeMap
      const node = await service.getNodeDetails(nodeId);
      
      if (node) {
        return { success: true, node };
      } else {
        return { success: false, error: 'Node not found' };
      }
    } catch (error) {
      console.error('Error getting node details:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });
}