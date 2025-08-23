/**
 * KnowledgeEngine - Core plugin orchestrator for KnowledgeOS
 */

import {
  KnowledgePlugin,
  IProcessor,
  IOrganizer,
  IEnhancer,
  ICommand,
  IUIComponent,
  Context,
  ProcessResult,
  FileOperation,
  Enhancement,
  PluginAPI
} from './interfaces';
import { EventEmitter } from 'events';

export class KnowledgeEngine extends EventEmitter {
  private plugins: Map<string, KnowledgePlugin> = new Map();
  private processors: IProcessor[] = [];
  private organizers: IOrganizer[] = [];
  private enhancers: IEnhancer[] = [];
  private commands: Map<string, ICommand> = new Map();
  private uiComponents: Map<string, IUIComponent> = new Map();
  private api: PluginAPI;
  private enabled: boolean = true;

  constructor(api: PluginAPI) {
    super();
    this.api = api;
  }

  /**
   * Register a plugin with the engine
   */
  async use(plugin: KnowledgePlugin): Promise<this> {
    if (this.plugins.has(plugin.name)) {
      console.warn(`Plugin ${plugin.name} is already registered`);
      return this;
    }

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin ${plugin.name} depends on ${dep} which is not loaded`);
        }
      }
    }

    // Register plugin components
    if (plugin.processor) {
      this.processors.push(plugin.processor);
      this.processors.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    }

    if (plugin.organizer) {
      this.organizers.push(plugin.organizer);
    }

    if (plugin.enhancer) {
      this.enhancers.push(plugin.enhancer);
    }

    if (plugin.commands) {
      for (const command of plugin.commands) {
        this.commands.set(command.id, command);
        this.api.commands.register(command);
      }
    }

    if (plugin.uiComponents) {
      for (const component of plugin.uiComponents) {
        this.uiComponents.set(component.id, component);
        this.api.ui.addPanel(component);
      }
    }

    // Store plugin
    this.plugins.set(plugin.name, plugin);

    // Activate plugin
    if (plugin.onActivate) {
      await plugin.onActivate();
    }

    this.emit('plugin:loaded', plugin.name);
    console.log(`Plugin ${plugin.name} loaded successfully`);

    return this;
  }

  /**
   * Unregister a plugin
   */
  async unuse(pluginName: string): Promise<this> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      console.warn(`Plugin ${pluginName} is not registered`);
      return this;
    }

    // Check if other plugins depend on this one
    for (const [name, p] of this.plugins) {
      if (p.dependencies?.includes(pluginName)) {
        throw new Error(`Cannot unload ${pluginName}: ${name} depends on it`);
      }
    }

    // Deactivate plugin
    if (plugin.onDeactivate) {
      await plugin.onDeactivate();
    }

    // Remove plugin components
    if (plugin.processor) {
      const index = this.processors.indexOf(plugin.processor);
      if (index > -1) this.processors.splice(index, 1);
    }

    if (plugin.organizer) {
      const index = this.organizers.indexOf(plugin.organizer);
      if (index > -1) this.organizers.splice(index, 1);
    }

    if (plugin.enhancer) {
      const index = this.enhancers.indexOf(plugin.enhancer);
      if (index > -1) this.enhancers.splice(index, 1);
    }

    if (plugin.commands) {
      for (const command of plugin.commands) {
        this.commands.delete(command.id);
        this.api.commands.unregister(command.id);
      }
    }

    if (plugin.uiComponents) {
      for (const component of plugin.uiComponents) {
        this.uiComponents.delete(component.id);
        this.api.ui.removePanel(component.id);
      }
    }

    this.plugins.delete(pluginName);
    this.emit('plugin:unloaded', pluginName);
    console.log(`Plugin ${pluginName} unloaded successfully`);

    return this;
  }

  /**
   * Process content through all registered processors
   */
  async process(content: string, context: Context = {}): Promise<ProcessResult> {
    if (!this.enabled) {
      return { content, operations: [], suggestions: [] };
    }

    let result: ProcessResult = { 
      content, 
      operations: [], 
      suggestions: [],
      metadata: {}
    };

    // Run through each processor
    for (const processor of this.processors) {
      try {
        if (processor.canProcess(result.content, context)) {
          const processorResult = await processor.process(result.content, context);
          
          // Merge results
          result.content = processorResult.content;
          
          if (processorResult.operations) {
            result.operations = [...(result.operations || []), ...processorResult.operations];
          }
          
          if (processorResult.suggestions) {
            result.suggestions = [...(result.suggestions || []), ...processorResult.suggestions];
          }
          
          if (processorResult.metadata) {
            result.metadata = { ...result.metadata, ...processorResult.metadata };
          }

          this.emit('processor:executed', processor.name, result);
        }
      } catch (error) {
        console.error(`Error in processor ${processor.name}:`, error);
        this.emit('processor:error', processor.name, error);
      }
    }

    // Run organizers on the processed content
    for (const organizer of this.organizers) {
      try {
        if (organizer.canOrganize(result)) {
          const operations = await organizer.organize(result);
          result.operations = [...(result.operations || []), ...operations];
          this.emit('organizer:executed', organizer.name, operations);
        }
      } catch (error) {
        console.error(`Error in organizer ${organizer.name}:`, error);
        this.emit('organizer:error', organizer.name, error);
      }
    }

    this.emit('process:complete', result);
    return result;
  }

  /**
   * Enhance content with all registered enhancers
   */
  async enhance(content: string, context: Context = {}): Promise<Enhancement[]> {
    if (!this.enabled) {
      return [];
    }

    const enhancements: Enhancement[] = [];

    for (const enhancer of this.enhancers) {
      try {
        const results = await enhancer.enhance(content, context);
        enhancements.push(...results);
        this.emit('enhancer:executed', enhancer.name, results);
      } catch (error) {
        console.error(`Error in enhancer ${enhancer.name}:`, error);
        this.emit('enhancer:error', enhancer.name, error);
      }
    }

    this.emit('enhance:complete', enhancements);
    return enhancements;
  }

  /**
   * Execute file operations
   */
  async executeOperations(operations: FileOperation[]): Promise<void> {
    for (const op of operations) {
      try {
        switch (op.type) {
          case 'create':
          case 'update':
            if (op.content !== undefined) {
              await this.api.files.write(op.path, op.content);
            }
            break;
          
          case 'append':
            if (op.content !== undefined) {
              await this.api.files.append(op.path, op.content);
            }
            break;
          
          case 'delete':
            // Not implemented in basic FileAPI
            console.warn('Delete operation not yet supported');
            break;
        }
        
        this.emit('operation:executed', op);
      } catch (error) {
        console.error(`Error executing operation ${op.type} on ${op.path}:`, error);
        this.emit('operation:error', op, error);
      }
    }
  }

  /**
   * Get list of loaded plugins
   */
  getPlugins(): KnowledgePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin by name
   */
  getPlugin(name: string): KnowledgePlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Check if plugin is loaded
   */
  hasPlugin(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Enable/disable the engine
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.emit('engine:enabled', enabled);
  }

  /**
   * Get engine status
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get registered commands
   */
  getCommands(): ICommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get UI components
   */
  getUIComponents(): IUIComponent[] {
    return Array.from(this.uiComponents.values());
  }

  /**
   * Reload all plugins
   */
  async reload(): Promise<void> {
    const pluginList = Array.from(this.plugins.values());
    
    // Unload all plugins
    for (const plugin of pluginList) {
      await this.unuse(plugin.name);
    }
    
    // Reload all plugins
    for (const plugin of pluginList) {
      await this.use(plugin);
    }
    
    this.emit('engine:reloaded');
  }
}