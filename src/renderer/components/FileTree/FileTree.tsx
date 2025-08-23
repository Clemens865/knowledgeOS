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

  const toggleDirectory = async (dirPath: string) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(dirPath)) {
      newExpanded.delete(dirPath);
    } else {
      newExpanded.add(dirPath);
    }
    setExpandedDirs(newExpanded);
    await loadFiles(rootPath);
  };

  const renderFileNode = (node: FileNode, level: number = 0) => {
    const isActive = activeFile === node.path;
    const isExpanded = expandedDirs.has(node.path);

    return (
      <div key={node.path}>
        <div
          className={`file-tree-item ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.isDirectory) {
              toggleDirectory(node.path);
            } else if (node.name.endsWith('.md')) {
              onFileSelect(node.path);
            }
          }}
        >
          <span className="file-tree-icon">
            {node.isDirectory ? (
              isExpanded ? '📂' : '📁'
            ) : (
              node.name.endsWith('.md') ? '📝' : '📄'
            )}
          </span>
          <span className="file-tree-name">{node.name}</span>
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