import React, { useRef } from 'react';
import MonacoEditor from '@monaco-editor/react';
import './Editor.css';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  fileName?: string;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, fileName = 'Untitled' }) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    
    // Configure Monaco
    monaco.languages.registerCompletionItemProvider('markdown', {
      provideCompletionItems: () => {
        return {
          suggestions: [
            {
              label: '[[',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '[[$1]]',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Wiki link'
            },
            {
              label: '#',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: '# $1',
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Heading 1'
            }
          ]
        };
      }
    });

    // Focus editor
    editor.focus();
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  return (
    <div className="editor-container">
      <div className="editor-header glass-morphism">
        <span className="editor-filename">{fileName}</span>
        <div className="editor-actions">
          <button className="editor-action" title="Preview">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3C4.5 3 1.5 5.5 1.5 8s3 5 6.5 5 6.5-2.5 6.5-5-3-5-6.5-5zm0 8c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3z"/>
            </svg>
          </button>
          <button className="editor-action" title="Split">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 2v12h2V2H7zM3 2v12h2V2H3zm8 0v12h2V2h-2z"/>
            </svg>
          </button>
        </div>
      </div>
      
      <div className="editor-content">
        <MonacoEditor
          value={content}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          language="markdown"
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineHeight: 22,
            fontFamily: "'SF Mono', Monaco, 'Courier New', monospace",
            wordWrap: 'on',
            lineNumbers: 'off',
            folding: true,
            glyphMargin: false,
            lineDecorationsWidth: 0,
            lineNumbersMinChars: 0,
            renderLineHighlight: 'none',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 20, bottom: 20 },
            suggest: {
              showWords: false
            }
          }}
        />
      </div>
    </div>
  );
};

export default Editor;