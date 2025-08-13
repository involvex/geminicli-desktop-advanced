import React, { useState } from 'react';
import { PanelConfig } from '../../types/layout';
import { Button } from '../ui/button';
import { X, Pin, Move, ChevronLeft, ChevronRight } from 'lucide-react';

interface PanelContainerProps {
  panel: PanelConfig;
  onMove: (id: string, position: 'left' | 'right' | 'bottom' | 'floating') => void;
  onToggle: (id: string) => void;
  children?: React.ReactNode;
}

export const PanelContainer: React.FC<PanelContainerProps> = ({
  panel,
  onMove,
  onToggle,
  children
}) => {
  const [isResizing, setIsResizing] = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const handleMove = (position: 'left' | 'right' | 'bottom' | 'floating') => {
    onMove(panel.id, position);
    setShowMoveMenu(false);
  };

  return (
    <div 
      className="bg-background border-r border-border flex flex-col"
      style={{ width: panel.position === 'bottom' ? '100%' : panel.size }}
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between p-2 border-b border-border bg-muted/50">
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
                </div>
              </div>
            )}
          </div>

          {/* Pin Button */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 w-6 p-0 ${panel.pinned ? 'text-blue-500' : ''}`}
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
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Resize Handle */}
      {panel.position !== 'bottom' && (
        <div
          className="w-1 bg-border hover:bg-blue-500 cursor-col-resize absolute right-0 top-0 bottom-0"
          onMouseDown={() => setIsResizing(true)}
        />
      )}
    </div>
  );
};