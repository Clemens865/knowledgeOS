import React, { useRef, useEffect } from 'react';
import './Editor.css';

interface SimpleEditorProps {
  content: string;
  onChange: (value: string) => void;
  fileName?: string;
  onEditorMount?: (editor: any) => void;
}

const SimpleEditor: React.FC<SimpleEditorProps> = ({ content, onChange, fileName = 'Untitled', onEditorMount }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.value = content;
      if (onEditorMount) {
        onEditorMount(textareaRef.current);
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
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
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          style={{
            width: '100%',
            height: '100%',
            padding: '20px',
            fontSize: '14px',
            lineHeight: '1.6',
            fontFamily: "'SF Mono', Monaco, 'Courier New', monospace",
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: 'none',
            outline: 'none',
            resize: 'none'
          }}
          placeholder="Start typing..."
        />
      </div>
    </div>
  );
};

export default SimpleEditor;