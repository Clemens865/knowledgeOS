# Conversation Modes Feature

## Overview
The Conversation Modes feature allows users to create, edit, and delete custom conversation modes that define how the AI assistant behaves. Each mode includes a system prompt that sets the assistant's behavior, capabilities, and focus areas.

## Implementation Details

### Architecture
The feature follows Electron's IPC architecture:
- **Main Process**: Handles mode persistence via electron-store
- **Renderer Process**: Provides UI for mode management
- **IPC Bridge**: Secure communication via preload script

### Key Components

#### 1. Backend (`/src/main/conversationModesHandlers.ts`)
- Manages mode storage in electron-store
- Merges default and custom modes
- Handles CRUD operations
- Provides import/export functionality

#### 2. Frontend (`/src/renderer/components/ConversationModesModal/`)
- Modal UI for mode management
- Create/Edit dialog with form validation
- Delete confirmation dialog
- Import/Export buttons

#### 3. Default Modes (`/src/core/ConversationModes.ts`)
```typescript
- standard: General-purpose assistant
- learning: Educational focus
- document-analysis: Document processing
- research: Research assistance
```

### API Methods

#### IPC Channels
```typescript
conversationModes: {
  getAll(): Promise<{ modes: ConversationMode[] }>
  create(mode: ConversationMode): Promise<{ success: boolean }>
  update(mode: ConversationMode): Promise<{ success: boolean }>
  delete(modeId: string): Promise<{ success: boolean }>
  export(): Promise<{ modes: ConversationMode[] }>
  import(modes: ConversationMode[]): Promise<{ importedCount: number }>
}
```

### Data Structure

```typescript
interface ConversationMode {
  id: string;                    // Unique identifier
  name: string;                   // Display name
  icon: string;                   // Emoji icon
  description: string;            // Brief description
  systemPrompt: string;           // AI behavior instructions
  allowFileUpload?: boolean;      // Enable file uploads
  supportedFileTypes?: string[];  // Allowed file extensions
  isCustom?: boolean;            // Custom vs default flag
}
```

## User Features

### Creating a Mode
1. Click "➕ Create New Mode" button
2. Fill in required fields (name, system prompt)
3. Optionally enable file upload and specify types
4. Click "Create" to save

### Editing a Mode
1. Click ✏️ button on any mode
2. Modify fields in the edit dialog
3. Click "Update" to save changes

### Deleting a Mode
1. Click 🗑️ button on custom modes only
2. Confirm deletion in the dialog
3. Mode is permanently removed

### Import/Export
- **Export**: Downloads all modes as JSON file
- **Import**: Loads modes from JSON file, merging with existing

## Storage

Custom modes are persisted in electron-store at:
- **macOS**: `~/Library/Application Support/KnowledgeOS/config.json`
- **Windows**: `%APPDATA%/KnowledgeOS/config.json`
- **Linux**: `~/.config/KnowledgeOS/config.json`

Key: `customConversationModes`

## Safety Features

1. **Default Mode Protection**: Cannot delete built-in modes
2. **Validation**: Required fields enforced
3. **Duplicate Prevention**: Modes with same ID are merged
4. **Graceful Fallback**: Returns defaults if store fails

## Future Enhancements

- Mode templates library
- Sharing modes between users
- Mode version history
- Advanced prompt engineering tools
- Mode-specific settings (temperature, etc.)