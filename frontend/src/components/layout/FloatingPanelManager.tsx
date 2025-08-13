import React, { useEffect, useState } from 'react';
import { PanelConfig } from '../../types/layout';

interface FloatingPanelManagerProps {
  panel: PanelConfig;
  onMove: (id: string, position: 'left' | 'right' | 'bottom' | 'floating', floatingPosition?: { x: number; y: number }) => void;
  children: React.ReactNode;
}

export const FloatingPanelManager: React.FC<FloatingPanelManagerProps> = ({
  panel,
  onMove,
  children
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      };
      
      // Keep panel within viewport bounds
      const maxX = window.innerWidth - panel.size;
      const maxY = window.innerHeight - 200;
      
      newPosition.x = Math.max(0, Math.min(maxX, newPosition.x));
      newPosition.y = Math.max(0, Math.min(maxY, newPosition.y));
      
      onMove(panel.id, 'floating', newPosition);
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
  }, [isDragging, dragOffset, panel.id, panel.size, onMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (panel.position === 'floating') {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
    }
  };

  return (
    <div onMouseDown={handleMouseDown}>
      {children}
    </div>
  );
};