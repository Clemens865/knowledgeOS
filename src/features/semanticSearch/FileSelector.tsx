import React, { useState, useEffect } from 'react';
import './fileSelector.css';

interface FileNode {
  path: string;
  name: string;
  isDirectory: boolean;
  children?: FileNode[];
  size?: number;
  extension?: string;
  checked?: boolean;
  indeterminate?: boolean;
}

interface FileSelectorProps {
  workspacePath: string;
  onSelectionChange: (selectedPaths: string[]) => void;
  supportedExtensions?: string[];
}

const DEFAULT_EXTENSIONS = [
  '.md', '.txt', '.pdf', '.docx', '.doc',
  '.js', '.ts', '.jsx', '.tsx', '.py', '.java', 
  '.cpp', '.c', '.h', '.cs', '.rb', '.go', '.rs',
  '.html', '.css', '.json', '.xml', '.yaml', '.yml'
];

const FileSelector: React.FC<FileSelectorProps> = ({
  workspacePath,
  onSelectionChange,
  supportedExtensions = DEFAULT_EXTENSIONS
}) => {
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFileTree();
  }, [workspacePath]);

  const loadFileTree = async () => {
    if (!window.electronAPI?.listFiles) return;
    
    setLoading(true);
    try {
      const tree = await buildFileTree(workspacePath);
      setFileTree(tree);
      // Auto-expand first level
      tree.forEach(node => {
        if (node.isDirectory) {
          setExpandedPaths(prev => new Set(prev).add(node.path));
        }
      });
    } catch (error) {
      console.error('Failed to load file tree:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildFileTree = async (dirPath: string): Promise<FileNode[]> => {
    const result = await window.electronAPI!.listFiles(dirPath);
    if (!result.success || !result.files) return [];

    const nodes: FileNode[] = [];
    
    for (const file of result.files) {
      const node: FileNode = {
        path: file.path,
        name: file.name,
        isDirectory: file.isDirectory,
        size: file.size,
        extension: file.name.includes('.') ? '.' + file.name.split('.').pop() : undefined
      };

      // Skip hidden files and common non-content directories
      if (file.name.startsWith('.') || 
          ['node_modules', 'dist', 'build', '.git', '__pycache__'].includes(file.name)) {
        continue;
      }

      if (file.isDirectory) {
        node.children = await buildFileTree(file.path);
      } else {
        // Only include supported file types
        if (!node.extension || !supportedExtensions.includes(node.extension)) {
          continue;
        }
      }

      nodes.push(node);
    }

    return nodes.sort((a, b) => {
      // Directories first, then files
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  };

  const toggleExpanded = (path: string) => {
    setExpandedPaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const toggleSelected = (node: FileNode, checked: boolean) => {
    const newSelected = new Set(selectedPaths);
    
    const updateNode = (n: FileNode, isChecked: boolean) => {
      if (isChecked) {
        if (!n.isDirectory || (n.children && n.children.length === 0)) {
          newSelected.add(n.path);
        }
      } else {
        newSelected.delete(n.path);
      }
      
      if (n.children) {
        n.children.forEach(child => updateNode(child, isChecked));
      }
    };
    
    updateNode(node, checked);
    setSelectedPaths(newSelected);
    onSelectionChange(Array.from(newSelected));
  };

  const isNodeChecked = (node: FileNode): boolean => {
    if (!node.isDirectory) {
      return selectedPaths.has(node.path);
    }
    
    if (!node.children || node.children.length === 0) {
      return selectedPaths.has(node.path);
    }
    
    return node.children.every(child => isNodeChecked(child));
  };

  const isNodeIndeterminate = (node: FileNode): boolean => {
    if (!node.isDirectory || !node.children || node.children.length === 0) {
      return false;
    }
    
    const checkedChildren = node.children.filter(child => isNodeChecked(child));
    return checkedChildren.length > 0 && checkedChildren.length < node.children.length;
  };

  const filterNodes = (nodes: FileNode[]): FileNode[] => {
    if (filter === 'all' && !searchTerm) return nodes;
    
    return nodes.filter(node => {
      // Search filter
      if (searchTerm && !node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        if (node.children) {
          const filteredChildren = filterNodes(node.children);
          if (filteredChildren.length === 0) return false;
        } else {
          return false;
        }
      }
      
      // Type filter
      if (filter !== 'all') {
        if (node.isDirectory) return true;
        
        switch (filter) {
          case 'markdown':
            return node.extension === '.md';
          case 'code':
            return ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.rb', '.go', '.rs'].includes(node.extension || '');
          case 'documents':
            return ['.pdf', '.docx', '.doc', '.txt'].includes(node.extension || '');
          case 'data':
            return ['.json', '.xml', '.yaml', '.yml', '.csv'].includes(node.extension || '');
        }
      }
      
      return true;
    });
  };

  const renderFileNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isChecked = isNodeChecked(node);
    const isIndeterminate = isNodeIndeterminate(node);
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.path} className="file-node">
        <div 
          className={`file-node-content ${isChecked ? 'selected' : ''}`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          {node.isDirectory && (
            <button
              className="expand-btn"
              onClick={() => toggleExpanded(node.path)}
            >
              {hasChildren ? (isExpanded ? '▼' : '▶') : '•'}
            </button>
          )}
          
          <input
            type="checkbox"
            checked={isChecked}
            ref={input => {
              if (input) input.indeterminate = isIndeterminate;
            }}
            onChange={(e) => toggleSelected(node, e.target.checked)}
          />
          
          <span className="file-icon">
            {node.isDirectory ? '📁' : getFileIcon(node.extension)}
          </span>
          
          <span className="file-name">{node.name}</span>
          
          {!node.isDirectory && node.size && (
            <span className="file-size">{formatFileSize(node.size)}</span>
          )}
        </div>
        
        {node.isDirectory && isExpanded && node.children && (
          <div className="file-children">
            {filterNodes(node.children).map(child => renderFileNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const getFileIcon = (extension?: string): string => {
    if (!extension) return '📄';
    
    const iconMap: Record<string, string> = {
      '.md': '📝',
      '.txt': '📄',
      '.pdf': '📕',
      '.docx': '📘',
      '.doc': '📘',
      '.js': '🟨',
      '.ts': '🔷',
      '.jsx': '⚛️',
      '.tsx': '⚛️',
      '.py': '🐍',
      '.java': '☕',
      '.html': '🌐',
      '.css': '🎨',
      '.json': '📊',
      '.xml': '📋',
      '.yaml': '⚙️',
      '.yml': '⚙️'
    };
    
    return iconMap[extension] || '📄';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const selectAll = () => {
    const allPaths = new Set<string>();
    
    const collectPaths = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        if (!node.isDirectory || (node.children && node.children.length === 0)) {
          allPaths.add(node.path);
        }
        if (node.children) {
          collectPaths(node.children);
        }
      });
    };
    
    collectPaths(filterNodes(fileTree));
    setSelectedPaths(allPaths);
    onSelectionChange(Array.from(allPaths));
  };

  const clearSelection = () => {
    setSelectedPaths(new Set());
    onSelectionChange([]);
  };

  return (
    <div className="file-selector">
      <div className="file-selector-header">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-buttons">
          <button 
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All Files
          </button>
          <button 
            className={`filter-btn ${filter === 'markdown' ? 'active' : ''}`}
            onClick={() => setFilter('markdown')}
          >
            Markdown
          </button>
          <button 
            className={`filter-btn ${filter === 'code' ? 'active' : ''}`}
            onClick={() => setFilter('code')}
          >
            Code
          </button>
          <button 
            className={`filter-btn ${filter === 'documents' ? 'active' : ''}`}
            onClick={() => setFilter('documents')}
          >
            Documents
          </button>
          <button 
            className={`filter-btn ${filter === 'data' ? 'active' : ''}`}
            onClick={() => setFilter('data')}
          >
            Data
          </button>
        </div>
        
        <div className="selection-actions">
          <button onClick={selectAll} className="action-btn">
            Select All
          </button>
          <button onClick={clearSelection} className="action-btn">
            Clear
          </button>
          <span className="selection-count">
            {selectedPaths.size} files selected
          </span>
        </div>
      </div>
      
      <div className="file-tree">
        {loading ? (
          <div className="loading">Loading files...</div>
        ) : (
          filterNodes(fileTree).map(node => renderFileNode(node))
        )}
      </div>
    </div>
  );
};

export default FileSelector;