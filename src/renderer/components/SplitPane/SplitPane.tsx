import React, { useState, useRef, useEffect } from 'react';
import './SplitPane.css';

interface SplitPaneProps {
  split: 'vertical' | 'horizontal';
  minSize?: number;
  maxSize?: number;
  defaultSize?: string;
  onSplitChange?: (size: number) => void;
  children: [React.ReactNode, React.ReactNode];
}

const SplitPane: React.FC<SplitPaneProps> = ({
  split = 'vertical',
  minSize = 200,
  maxSize,
  defaultSize = '50%',
  onSplitChange,
  children
}) => {
  const [paneSize, setPaneSize] = useState<string>(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const splitPaneRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<number>(0);
  const startSizeRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    if (split === 'vertical') {
      startPosRef.current = e.clientX;
    } else {
      startPosRef.current = e.clientY;
    }
    
    const currentSize = parseInt(paneSize);
    startSizeRef.current = isNaN(currentSize) ? 50 : currentSize;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!splitPaneRef.current) return;

      const container = splitPaneRef.current;
      const containerRect = container.getBoundingClientRect();
      
      let newSize: number;
      
      if (split === 'vertical') {
        const containerWidth = containerRect.width;
        const delta = e.clientX - startPosRef.current;
        newSize = startSizeRef.current + (delta / containerWidth) * 100;
      } else {
        const containerHeight = containerRect.height;
        const delta = e.clientY - startPosRef.current;
        newSize = startSizeRef.current + (delta / containerHeight) * 100;
      }
      
      // Apply min/max constraints
      const dimension = split === 'vertical' ? containerRect.width : containerRect.height;
      const minPercent = (minSize / dimension) * 100;
      const maxPercent = maxSize ? (maxSize / dimension) * 100 : 80;
      
      newSize = Math.max(minPercent, Math.min(maxPercent, newSize));
      
      setPaneSize(`${newSize}%`);
      onSplitChange?.(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, split, minSize, maxSize, onSplitChange]);

  const splitClass = split === 'vertical' ? 'split-vertical' : 'split-horizontal';
  const paneStyle = split === 'vertical' 
    ? { width: paneSize } 
    : { height: paneSize };

  return (
    <div 
      ref={splitPaneRef}
      className={`split-pane ${splitClass} ${isDragging ? 'dragging' : ''}`}
    >
      <div className="pane pane-first" style={paneStyle}>
        {children[0]}
      </div>
      
      <div 
        className="split-divider"
        onMouseDown={handleMouseDown}
      >
        <div className="divider-handle">
          {split === 'vertical' ? '⋮' : '⋯'}
        </div>
      </div>
      
      <div className="pane pane-second">
        {children[1]}
      </div>
    </div>
  );
};

export default SplitPane;