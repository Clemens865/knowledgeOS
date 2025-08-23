/**
 * PluginAPI Implementation - Bridge between plugins and the application
 */

import {
  PluginAPI,
  FileAPI,
  EditorAPI,
  UIAPI,
  StorageAPI,
  EventAPI,
  CommandAPI,
  ICommand,
  IUIComponent
} from '../../core/interfaces';
import { BrowserEventEmitter } from '../../core/BrowserEventEmitter';

export class PluginAPIImpl implements PluginAPI {
  files: FileAPI;
  editor: EditorAPI;
  ui: UIAPI;
  storage: StorageAPI;
  events: EventAPI;
  commands: CommandAPI;

  private eventEmitter: BrowserEventEmitter;
  private commandRegistry: Map<string, ICommand> = new Map();
  private localStorage: Map<string, any> = new Map();
  private editorInstance: any; // Monaco editor instance
  private setFileContent?: (content: string) => void;
  private openFile?: (path: string) => void;

  constructor() {
    this.eventEmitter = new BrowserEventEmitter();
    
    // Initialize FileAPI
    this.files = {
      read: async (path: string): Promise<string> => {
        const result = await window.electronAPI.readFile(path);
        if (result.success && result.content) {
          return result.content;
        }
        throw new Error(result.error || 'Failed to read file');
      },
      
      write: async (path: string, content: string): Promise<void> => {
        await window.electronAPI.writeFile(path, content);
        this.eventEmitter.emit('file:saved', path);
      },
      
      append: async (path: string, content: string): Promise<void> => {
        const existing = await this.files.read(path).catch(() => '');
        await this.files.write(path, existing + content);
      },
      
      exists: async (path: string): Promise<boolean> => {
        try {
          await window.electronAPI.readFile(path);
          return true;
        } catch {
          return false;
        }
      },
      
      list: async (_directory: string): Promise<string[]> => {
        // This would need IPC implementation
        return [];
      },
      
      watch: (path: string, callback: (event: string, filename: string) => void) => {
        // This would need file watcher implementation
        this.eventEmitter.on(`file:change:${path}`, callback);
      }
    };
    
    // Initialize EditorAPI
    this.editor = {
      open: async (path: string): Promise<void> => {
        if (this.openFile) {
          this.openFile(path);
        }
      },
      
      getContent: (): string => {
        if (this.editorInstance) {
          return this.editorInstance.getValue();
        }
        return '';
      },
      
      setContent: (content: string): void => {
        if (this.setFileContent) {
          this.setFileContent(content);
        }
      },
      
      getSelection: (): string => {
        if (this.editorInstance) {
          const selection = this.editorInstance.getSelection();
          if (selection) {
            return this.editorInstance.getModel().getValueInRange(selection);
          }
        }
        return '';
      },
      
      insertAtCursor: (text: string): void => {
        if (this.editorInstance) {
          const position = this.editorInstance.getPosition();
          this.editorInstance.executeEdits('plugin', [{
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            text: text
          }]);
        }
      },
      
      executeCommand: (commandId: string): void => {
        if (this.editorInstance) {
          this.editorInstance.trigger('plugin', commandId);
        }
      }
    };
    
    // Initialize UIAPI
    this.ui = {
      showMessage: (message: string, type?: 'info' | 'warning' | 'error'): void => {
        // For now, use console - could integrate with a toast system
        switch (type) {
          case 'error':
            console.error(message);
            break;
          case 'warning':
            console.warn(message);
            break;
          default:
            console.log(message);
        }
      },
      
      showInputBox: async (prompt: string, defaultValue?: string): Promise<string | undefined> => {
        // Simple prompt for now - could be replaced with a modal
        return window.prompt(prompt, defaultValue) || undefined;
      },
      
      showQuickPick: async (items: string[], placeholder?: string): Promise<string | undefined> => {
        // For now, use first item - should be replaced with proper UI
        console.log('Quick pick:', placeholder, items);
        return items[0];
      },
      
      addPanel: (component: IUIComponent): void => {
        this.eventEmitter.emit('ui:panel:add', component);
      },
      
      removePanel: (id: string): void => {
        this.eventEmitter.emit('ui:panel:remove', id);
      }
    };
    
    // Initialize StorageAPI
    this.storage = {
      get: (key: string): any => {
        return this.localStorage.get(key);
      },
      
      set: (key: string, value: any): void => {
        this.localStorage.set(key, value);
        this.eventEmitter.emit('storage:changed', key, value);
      },
      
      delete: (key: string): void => {
        this.localStorage.delete(key);
        this.eventEmitter.emit('storage:deleted', key);
      },
      
      clear: (): void => {
        this.localStorage.clear();
        this.eventEmitter.emit('storage:cleared');
      }
    };
    
    // Initialize EventAPI
    this.events = {
      on: (event: string, handler: (...args: any[]) => void): void => {
        this.eventEmitter.on(event, handler);
      },
      
      off: (event: string, handler: (...args: any[]) => void): void => {
        this.eventEmitter.off(event, handler);
      },
      
      emit: (event: string, ...args: any[]): void => {
        this.eventEmitter.emit(event, ...args);
      }
    };
    
    // Initialize CommandAPI
    this.commands = {
      register: (command: ICommand): void => {
        this.commandRegistry.set(command.id, command);
        this.eventEmitter.emit('command:registered', command);
      },
      
      unregister: (commandId: string): void => {
        this.commandRegistry.delete(commandId);
        this.eventEmitter.emit('command:unregistered', commandId);
      },
      
      execute: async (commandId: string, ...args: any[]): Promise<any> => {
        const command = this.commandRegistry.get(commandId);
        if (command) {
          return await command.action(args[0]);
        }
        throw new Error(`Command ${commandId} not found`);
      }
    };
  }
  
  // Set the editor instance for editor API
  setEditorInstance(editor: any): void {
    this.editorInstance = editor;
  }
  
  // Set file content setter function
  setFileContentSetter(setter: (content: string) => void): void {
    this.setFileContent = setter;
  }
  
  // Set file opener function
  setFileOpener(opener: (path: string) => void): void {
    this.openFile = opener;
  }
  
  // Get registered commands for UI
  getCommands(): ICommand[] {
    return Array.from(this.commandRegistry.values());
  }
  
  // Emit file save event
  emitFileSaved(path: string): void {
    this.eventEmitter.emit('file:saved', path);
  }
}