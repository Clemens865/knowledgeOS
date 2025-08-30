import { ipcMain } from 'electron';
import Store from 'electron-store';
import { ConversationMode, DEFAULT_MODES } from '../core/ConversationModes';
import { getDefaultKnowledgeRules } from './llmHandlers';

const store = new Store();
const CUSTOM_MODES_KEY = 'customConversationModes';

/**
 * Get all conversation modes (default + custom)
 */
function getAllModes(): ConversationMode[] {
  const customModes = (store as any).get(CUSTOM_MODES_KEY, []) as ConversationMode[];
  // Merge default modes with custom modes, custom modes can override defaults
  const modeMap = new Map<string, ConversationMode>();
  
  // Add default modes first
  DEFAULT_MODES.forEach(mode => {
    modeMap.set(mode.id, mode);
  });
  
  // Add/override with custom modes
  customModes.forEach(mode => {
    modeMap.set(mode.id, mode);
  });
  
  return Array.from(modeMap.values());
}

/**
 * Save custom modes to storage
 */
function saveCustomModes(modes: ConversationMode[]): void {
  (store as any).set(CUSTOM_MODES_KEY, modes);
}

/**
 * Get only custom modes
 */
function getCustomModes(): ConversationMode[] {
  return (store as any).get(CUSTOM_MODES_KEY, []) as ConversationMode[];
}

export function setupConversationModesHandlers() {
  // Get all modes
  ipcMain.handle('modes:getAll', async () => {
    try {
      const modes = getAllModes();
      return { success: true, modes };
    } catch (error) {
      console.error('Error getting conversation modes:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Create a new mode
  ipcMain.handle('modes:create', async (_, mode: ConversationMode) => {
    try {
      // Validate mode
      if (!mode.id || !mode.name || !mode.systemPrompt) {
        return { success: false, error: 'Mode must have id, name, and systemPrompt' };
      }
      
      // Check if mode ID already exists
      const existingModes = getAllModes();
      if (existingModes.some(m => m.id === mode.id)) {
        return { success: false, error: `Mode with id "${mode.id}" already exists` };
      }
      
      // Add to custom modes
      const customModes = getCustomModes();
      customModes.push(mode);
      saveCustomModes(customModes);
      
      console.log(`✅ Created new conversation mode: ${mode.name}`);
      return { success: true, mode };
    } catch (error) {
      console.error('Error creating conversation mode:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Update an existing mode
  ipcMain.handle('modes:update', async (_, mode: ConversationMode) => {
    try {
      const customModes = getCustomModes();
      const index = customModes.findIndex(m => m.id === mode.id);
      
      if (index === -1) {
        // If not in custom modes, add it (this allows overriding default modes)
        customModes.push(mode);
      } else {
        // Update existing custom mode
        customModes[index] = mode;
      }
      
      saveCustomModes(customModes);
      console.log(`✅ Updated conversation mode: ${mode.name}`);
      return { success: true, mode };
    } catch (error) {
      console.error('Error updating conversation mode:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Delete a mode
  ipcMain.handle('modes:delete', async (_, modeId: string) => {
    try {
      // Check if it's a default mode
      if (DEFAULT_MODES.some(m => m.id === modeId)) {
        return { success: false, error: 'Cannot delete default modes' };
      }
      
      // Remove from custom modes
      const customModes = getCustomModes();
      const filteredModes = customModes.filter(m => m.id !== modeId);
      
      if (filteredModes.length === customModes.length) {
        return { success: false, error: 'Mode not found' };
      }
      
      saveCustomModes(filteredModes);
      console.log(`✅ Deleted conversation mode: ${modeId}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting conversation mode:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Reset to default modes
  ipcMain.handle('modes:reset', async () => {
    try {
      saveCustomModes([]);
      console.log('✅ Reset to default conversation modes');
      return { success: true };
    } catch (error) {
      console.error('Error resetting conversation modes:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Export modes
  ipcMain.handle('modes:export', async () => {
    try {
      const modes = getAllModes();
      return { success: true, modes };
    } catch (error) {
      console.error('Error exporting conversation modes:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Get default knowledge rules
  ipcMain.handle('modes:getDefaultRules', async () => {
    try {
      return { success: true, rules: getDefaultKnowledgeRules() };
    } catch (error) {
      console.error('Error getting default rules:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Import modes
  ipcMain.handle('modes:import', async (_, modes: ConversationMode[]) => {
    try {
      // Validate all modes
      for (const mode of modes) {
        if (!mode.id || !mode.name || !mode.systemPrompt) {
          return { success: false, error: 'All modes must have id, name, and systemPrompt' };
        }
      }
      
      // Merge with existing custom modes
      const existingCustomModes = getCustomModes();
      const modeMap = new Map<string, ConversationMode>();
      
      // Add existing custom modes
      existingCustomModes.forEach(mode => {
        modeMap.set(mode.id, mode);
      });
      
      // Add/override with imported modes
      modes.forEach(mode => {
        // Skip default mode IDs to prevent overriding built-in modes
        if (!DEFAULT_MODES.some(dm => dm.id === mode.id)) {
          modeMap.set(mode.id, mode);
        }
      });
      
      const mergedModes = Array.from(modeMap.values());
      saveCustomModes(mergedModes);
      
      console.log(`✅ Imported ${modes.length} conversation modes`);
      return { success: true, importedCount: modes.length };
    } catch (error) {
      console.error('Error importing conversation modes:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });
}