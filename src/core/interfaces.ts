/**
 * Core interfaces for the KnowledgeOS plugin system
 */

export interface Context {
  filePath?: string;
  fileName?: string;
  fileContent?: string;
  workspace?: string;
  useAI?: boolean;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export interface ProcessResult {
  content: string;
  operations?: FileOperation[];
  suggestions?: Suggestion[];
  metadata?: Record<string, any>;
}

export interface FileOperation {
  type: 'create' | 'update' | 'append' | 'delete';
  path: string;
  content?: string;
  position?: 'start' | 'end' | number;
}

export interface Suggestion {
  type: string;
  description: string;
  action: () => void | Promise<void>;
  confidence?: number;
}

export interface Enhancement {
  type: string;
  content: string;
  position?: { line: number; column: number };
  metadata?: Record<string, any>;
}

export interface SearchIndex {
  id: string;
  title: string;
  content: string;
  path: string;
  tags?: string[];
  links?: string[];
  metadata?: Record<string, any>;
}

export interface IProcessor {
  name: string;
  canProcess(content: string, context: Context): boolean;
  process(content: string, context: Context): Promise<ProcessResult>;
  priority?: number;
}

export interface IOrganizer {
  name: string;
  canOrganize(content: ProcessResult): boolean;
  organize(content: ProcessResult): Promise<FileOperation[]>;
}

export interface IEnhancer {
  name: string;
  enhance(content: string, context: Context): Promise<Enhancement[]>;
}

export interface IUIComponent {
  id: string;
  type: 'panel' | 'sidebar' | 'toolbar' | 'statusbar';
  render(): React.ReactElement;
}

export interface ICommand {
  id: string;
  title: string;
  description?: string;
  keybinding?: string;
  action: (context: Context) => void | Promise<void>;
}

export interface KnowledgePlugin {
  name: string;
  version: string;
  description?: string;
  author?: string;
  
  // Core functionality
  processor?: IProcessor;
  organizer?: IOrganizer;
  enhancer?: IEnhancer;
  
  // UI extensions
  uiComponents?: IUIComponent[];
  commands?: ICommand[];
  
  // Lifecycle hooks
  onActivate?(): void | Promise<void>;
  onDeactivate?(): void | Promise<void>;
  
  // Dependencies
  dependencies?: string[];
}

export interface PluginAPI {
  files: FileAPI;
  editor: EditorAPI;
  ui: UIAPI;
  storage: StorageAPI;
  events: EventAPI;
  commands: CommandAPI;
}

export interface FileAPI {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  append(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(directory: string): Promise<string[]>;
  watch(path: string, callback: (event: string, filename: string) => void): void;
}

export interface EditorAPI {
  open(path: string): Promise<void>;
  getContent(): string;
  setContent(content: string): void;
  getSelection(): string;
  insertAtCursor(text: string): void;
  executeCommand(commandId: string): void;
}

export interface UIAPI {
  showMessage(message: string, type?: 'info' | 'warning' | 'error'): void;
  showInputBox(prompt: string, defaultValue?: string): Promise<string | undefined>;
  showQuickPick(items: string[], placeholder?: string): Promise<string | undefined>;
  addPanel(component: IUIComponent): void;
  removePanel(id: string): void;
}

export interface StorageAPI {
  get(key: string): any;
  set(key: string, value: any): void;
  delete(key: string): void;
  clear(): void;
}

export interface EventAPI {
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
}

export interface CommandAPI {
  register(command: ICommand): void;
  unregister(commandId: string): void;
  execute(commandId: string, ...args: any[]): Promise<any>;
}