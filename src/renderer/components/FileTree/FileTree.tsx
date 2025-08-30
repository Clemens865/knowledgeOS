import React, { useState, useEffect } from 'react';
import './FileTree.css';

interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
}

interface FileTreeProps {
  rootPath: string;
  onFileSelect: (filePath: string) => void;
  activeFile: string | null;
}

const FileTree: React.FC<FileTreeProps> = ({ rootPath, onFileSelect, activeFile }) => {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFiles(rootPath);
  }, [rootPath]);

  // Listen for file tree refresh events
  useEffect(() => {
    const handleRefreshFileTree = () => {
      console.log('Refreshing file tree after file operation');
      loadFiles(rootPath);
    };

    window.addEventListener('refresh-file-tree', handleRefreshFileTree);
    
    return () => {
      window.removeEventListener('refresh-file-tree', handleRefreshFileTree);
    };
  }, [rootPath]);

  const loadFiles = async (path: string) => {
    setLoading(true);
    const result = await window.electronAPI.listFiles(path);
    if (result.success && result.files) {
      const fileNodes = await Promise.all(
        result.files
          .filter(file => !file.name.startsWith('.'))
          .map(async (file) => {
            const node: FileNode = {
              name: file.name,
              path: file.path,
              isDirectory: file.isDirectory
            };
            
            // Preserve expanded state and reload children for expanded directories
            if (file.isDirectory && expandedDirs.has(file.path)) {
              const childResult = await window.electronAPI.listFiles(file.path);
              if (childResult.success && childResult.files) {
                node.children = childResult.files
                  .filter(f => !f.name.startsWith('.'))
                  .map(f => ({
                    name: f.name,
                    path: f.path,
                    isDirectory: f.isDirectory
                  }));
              }
            }
            
            return node;
          })
      );
      setFiles(fileNodes);
    }
    setLoading(false);
  };

  const toggleDirectory = async (dirPath: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    
    const newExpanded = new Set(expandedDirs);
    const isCurrentlyExpanded = newExpanded.has(dirPath);
    
    if (isCurrentlyExpanded) {
      newExpanded.delete(dirPath);
      setExpandedDirs(newExpanded);
    } else {
      newExpanded.add(dirPath);
      setExpandedDirs(newExpanded);
      
      // Find the node and load its children if not already loaded
      const findAndLoadNode = async (nodes: FileNode[]): Promise<void> => {
        for (const node of nodes) {
          if (node.path === dirPath && (!node.children || node.children.length === 0)) {
            const childResult = await window.electronAPI.listFiles(dirPath);
            if (childResult.success && childResult.files) {
              node.children = childResult.files
                .filter(f => !f.name.startsWith('.'))
                .map(f => ({
                  name: f.name,
                  path: f.path,
                  isDirectory: f.isDirectory
                }));
              setFiles([...files]); // Force re-render
            }
            return;
          }
          if (node.children) {
            await findAndLoadNode(node.children);
          }
        }
      };
      
      await findAndLoadNode(files);
    }
  };

  const renderFileNode = (node: FileNode, level: number = 0) => {
    const isActive = activeFile === node.path;
    const isExpanded = expandedDirs.has(node.path);

    return (
      <div key={node.path}>
        <div
          className={`file-tree-item ${isActive ? 'active' : ''} ${node.isDirectory ? 'is-folder' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
        >
          <span 
            className="file-tree-icon clickable"
            onClick={(e) => {
              e.stopPropagation();
              if (node.isDirectory) {
                toggleDirectory(node.path, e);
              }
            }}
          >
            {node.isDirectory ? (
              isExpanded ? '📂' : '📁'
            ) : (
              node.name.endsWith('.md') ? '📝' : '📄'
            )}
          </span>
          <span 
            className="file-tree-name"
            onClick={(e) => {
              e.stopPropagation();
              if (!node.isDirectory) {
                onFileSelect(node.path);
                // Emit event for file editor
                window.dispatchEvent(new CustomEvent('open-file', { 
                  detail: { path: node.path } 
                }));
              } else if (node.isDirectory) {
                toggleDirectory(node.path, e);
              }
            }}
          >
            {node.name}
          </span>
        </div>
        
        {node.isDirectory && isExpanded && node.children && (
          <div className="file-tree-children">
            {node.children.map(child => renderFileNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="file-tree-loading">Loading files...</div>;
  }

  return (
    <div className="file-tree">
      {files.length === 0 ? (
        <div className="file-tree-empty">
          <p>No files found</p>
          <small>Open a folder to get started</small>
        </div>
      ) : (
        files.map(file => renderFileNode(file))
      )}
    </div>
  );
};

export default FileTree;