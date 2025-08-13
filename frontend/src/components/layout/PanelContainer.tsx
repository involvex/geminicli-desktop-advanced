import React, { useState, useRef } from 'react';
import { PanelConfig } from '../../types/layout';
import { Button } from '../ui/button';
import { X, Pin, Move, ChevronLeft, ChevronRight, Minimize2, Maximize2 } from 'lucide-react';
import { useDragDrop } from './DragDropProvider';

interface PanelContainerProps {
  panel: PanelConfig;
  onMove: (id: string, position: 'left' | 'right' | 'bottom' | 'floating') => void;
  onToggle: (id: string) => void;
  onPin: (id: string) => void;
  onMinimize: (id: string) => void;
  onResize: (id: string, size: number) => void;
  children?: React.ReactNode;
}

export const PanelContainer: React.FC<PanelContainerProps> = ({
  panel,
  onMove,
  onToggle,
  onPin,
  onMinimize,
  onResize,
  children
}) => {
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { startDrag } = useDragDrop();

  const handleMove = (position: 'left' | 'right' | 'bottom' | 'floating') => {
    onMove(panel.id, position);
    setShowMoveMenu(false);
  };

  const handleDragStart = (e: React.MouseEvent) => {
    if (panel.position === 'floating') {
      const rect = panelRef.current?.getBoundingClientRect();
      if (rect) {
        const offset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        startDrag(panel.id, offset);
      }
    }
  };

  const handleResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startSize = panel.size;

    const handleMouseMove = (e: MouseEvent) => {
      const diff = e.clientX - startX;
      const newSize = Math.max(200, Math.min(800, startSize + diff));
      onResize(panel.id, newSize);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const containerStyle = panel.position === 'floating' ? {
    position: 'fixed' as const,
    left: panel.floatingPosition?.x || 100,
    top: panel.floatingPosition?.y || 100,
    width: panel.size,
    height: panel.minimized ? 'auto' : 400,
    zIndex: panel.zIndex || 1000
  } : {
    width: panel.position === 'bottom' ? '100%' : panel.size,
    height: panel.position === 'bottom' ? (panel.minimized ? 'auto' : panel.size) : '100%'
  };

  return (
    <div 
      ref={panelRef}
      className={`bg-background border border-border flex flex-col shadow-lg ${
        panel.position === 'floating' ? 'rounded-lg' : 'border-r'
      }`}
      style={containerStyle}
    >
      {/* Panel Header */}
      <div 
        className={`flex items-center justify-between p-2 border-b border-border bg-muted/50 ${
          panel.position === 'floating' ? 'cursor-move' : ''
        }`}
        onMouseDown={panel.position === 'floating' ? handleDragStart : undefined}
      >
        <span className="text-sm font-medium">{panel.title}</span>
        <div className="flex items-center gap-1">
          {/* Move Button */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setShowMoveMenu(!showMoveMenu)}
            >
              <Move className="h-3 w-3" />
            </Button>
            
            {showMoveMenu && (
              <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-md z-50">
                <div className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => handleMove('left')}
                  >
                    <ChevronLeft className="h-3 w-3 mr-1" />
                    Move Left
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => handleMove('right')}
                  >
                    <ChevronRight className="h-3 w-3 mr-1" />
                    Move Right
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => handleMove('bottom')}
                  >
                    Bottom
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => handleMove('floating')}
                  >
                    Float
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Minimize Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onMinimize(panel.id)}
          >
            {panel.minimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>

          {/* Pin Button */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 ${panel.pinned ? 'text-blue-500' : ''}`}
            onClick={() => onPin(panel.id)}
          >
            <Pin className="h-3 w-3" />
          </Button>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onToggle(panel.id)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Panel Content */}
      {!panel.minimized && (
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      )}

      {/* Resize Handle */}
      {panel.position !== 'bottom' && panel.position !== 'floating' && !panel.minimized && (
        <div
          className="w-1 bg-border hover:bg-blue-500 cursor-col-resize absolute right-0 top-0 bottom-0"
          onMouseDown={handleResize}
        />
      )}
    </div>
  );
};