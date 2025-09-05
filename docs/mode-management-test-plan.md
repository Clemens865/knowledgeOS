# Conversation Mode Management Test Plan

## Features to Test

### 1. View Default Modes
- [ ] Open Conversation Modes modal
- [ ] Verify 4 default modes are displayed:
  - Standard Assistant
  - Learning Mode
  - Document Analysis
  - Research Assistant
- [ ] Verify default modes cannot be deleted (no delete button)

### 2. Create New Mode
- [ ] Click "➕ Create New Mode" button
- [ ] Fill in form fields:
  - Name: "Code Review Assistant"
  - Icon: 🔍
  - Description: "Specialized in reviewing code for quality and best practices"
  - System Prompt: "You are a code review expert. Focus on code quality, performance, and best practices."
  - Allow File Upload: Yes
  - Supported File Types: .js, .ts, .jsx, .tsx, .py
- [ ] Click "Create" button
- [ ] Verify new mode appears in the list
- [ ] Verify "Custom" badge is shown

### 3. Edit Custom Mode
- [ ] Click ✏️ button on custom mode
- [ ] Modify some fields
- [ ] Click "Update" button
- [ ] Verify changes are saved

### 4. Select Mode
- [ ] Click "Select" button on a mode
- [ ] Verify mode is activated (active state styling)
- [ ] Close and reopen modal
- [ ] Verify selected mode is still active

### 5. Delete Custom Mode
- [ ] Click 🗑️ button on custom mode
- [ ] Confirm deletion in dialog
- [ ] Verify mode is removed from list

### 6. Export Modes
- [ ] Click "📤 Export" button
- [ ] Verify JSON file is downloaded
- [ ] Check file contains all modes

### 7. Import Modes
- [ ] Click "📥 Import" button
- [ ] Select previously exported JSON file
- [ ] Verify modes are imported
- [ ] Check for duplicate handling

## Expected Results
- All CRUD operations work smoothly
- Default modes are protected from deletion
- Custom modes persist across app restarts
- Import/export functionality works correctly
- UI updates immediately after operations