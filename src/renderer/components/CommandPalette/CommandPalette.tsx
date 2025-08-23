import React, { useState, useEffect, useRef } from 'react';
import './CommandPalette.css';

interface CommandPaletteProps {
  onClose: () => void;
}

const CommandPalette: React.FC<CommandPaletteProps> = ({ onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = [
    { id: 'new-note', label: 'New Note', shortcut: 'Cmd+N' },
    { id: 'open-file', label: 'Open File', shortcut: 'Cmd+O' },
    { id: 'save-file', label: 'Save File', shortcut: 'Cmd+S' },
    { id: 'toggle-sidebar', label: 'Toggle Sidebar', shortcut: 'Cmd+B' },
    { id: 'toggle-chat', label: 'Toggle AI Chat', shortcut: 'Cmd+Shift+C' },
    { id: 'search', label: 'Search in Files', shortcut: 'Cmd+Shift+F' },
    { id: 'preferences', label: 'Preferences', shortcut: 'Cmd+,' },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleCommand(filteredCommands[selectedIndex].id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredCommands, selectedIndex]);

  const handleCommand = (commandId: string) => {
    // TODO: Implement command execution
    console.log('Executing command:', commandId);
    onClose();
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette glass-morphism" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder="Type a command or search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
        />
        
        <div className="command-palette-results">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">No commands found</div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <div
                key={cmd.id}
                className={`command-palette-item ${index === selectedIndex ? 'selected' : ''}`}
                onClick={() => handleCommand(cmd.id)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className="command-palette-label">{cmd.label}</span>
                <span className="command-palette-shortcut">{cmd.shortcut}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;