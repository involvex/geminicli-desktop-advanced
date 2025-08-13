import React, { createContext, useContext, useState, useCallback } from 'react';
import { DragState } from '../../types/layout';

interface DragDropContextType {
  dragState: DragState;
  startDrag: (panelId: string, offset: { x: number; y: number }) => void;
  updateDrag: (dropZone?: 'left' | 'right' | 'bottom' | 'center') => void;
  endDrag: () => void;
}

const DragDropContext = createContext<DragDropContextType | null>(null);

export const useDragDrop = () => {
  const context = useContext(DragDropContext);
  if (!context) throw new Error('useDragDrop must be used within DragDropProvider');
  return context;
};

export const DragDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dragState, setDragState] = useState<DragState>({ isDragging: false });

  const startDrag = useCallback((panelId: string, offset: { x: number; y: number }) => {
    setDragState({
      isDragging: true,
      draggedPanel: panelId,
      dragOffset: offset
    });
  }, []);

  const updateDrag = useCallback((dropZone?: 'left' | 'right' | 'bottom' | 'center') => {
    setDragState(prev => ({ ...prev, dropZone }));
  }, []);

  const endDrag = useCallback(() => {
    setDragState({ isDragging: false });
  }, []);

  return (
    <DragDropContext.Provider value={{ dragState, startDrag, updateDrag, endDrag }}>
      {children}
    </DragDropContext.Provider>
  );
};