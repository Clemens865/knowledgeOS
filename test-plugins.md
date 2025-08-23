# Plugin Functionality Test Document

This document demonstrates the various features of the KnowledgeOS plugin system.

## Wiki Links

Let's create some [[wiki-links]] to other documents. 
You can link to [[ideas/brainstorm]] or [[projects/knowledgeos]].
These links will be parsed and made clickable by the WikiLinksPlugin.

## Pattern Extraction

TODO: Test the task extraction feature
TODO: Build a better UI for displaying extracted patterns
TODO: Add support for recurring tasks

Meeting with John Smith about Project Architecture

I love working with TypeScript and React!

Decided: We will use a plugin-based architecture for maximum extensibility

TIL: Monaco Editor has excellent TypeScript support built-in

Idea: Add a graph visualization of all wiki-links

Question: How should we handle real-time collaboration?

Project KnowledgeOS: Successfully implemented the core plugin architecture with extensible processors

## Code Snippets

```typescript
// Example TypeScript code
interface Plugin {
  name: string;
  version: string;
  process(content: string): string;
}
```

```python
# Example Python code
def process_knowledge(content):
    patterns = extract_patterns(content)
    return organize_knowledge(patterns)
```

## Notes

When you save this file, the KnowledgeEngine will:
1. Extract all TODO items to `tasks/inbox.md`
2. Create a meeting note in `meetings/`
3. Record your preferences in `personal/preferences.md`
4. Save decisions in `decisions/`
5. Track learnings in `learning/til.md`
6. Store ideas in `ideas/brainstorm.md`
7. Save questions in `questions/open.md`
8. Extract code snippets to `code/snippets/`
9. Add project notes to `projects/KnowledgeOS/notes.md`

All of this happens automatically through the plugin system!