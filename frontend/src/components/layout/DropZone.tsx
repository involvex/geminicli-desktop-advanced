import React from 'react';
import { useDragDrop } from './DragDropProvider';

interface DropZoneProps {
  zone: 'left' | 'right' | 'bottom' | 'center';
  onDrop: (panelId: string, zone: 'left' | 'right' | 'bottom' | 'center') => void;
  className?: string;
}

export const DropZone: React.FC<DropZoneProps> = ({ zone, onDrop, className = '' }) => {
  const { dragState, updateDrag, endDrag } = useDragDrop();

  if (!dragState.isDragging) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    updateDrag(zone);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragState.draggedPanel) {
      onDrop(dragState.draggedPanel, zone);
    }
    endDrag();
  };

  const isActive = dragState.dropZone === zone;

  return (
    <div
      className={`absolute transition-all duration-200 ${
        isActive ? 'bg-blue-500/30 border-2 border-blue-500' : 'bg-transparent'
      } ${className}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    />
  );
};