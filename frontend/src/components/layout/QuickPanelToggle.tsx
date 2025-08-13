import React from 'react';
import { useLayoutConfig } from '../../hooks/useLayoutConfig';
import { Button } from '../ui/button';
import { 
  MessageSquare, 
  Package, 
  FolderOpen, 
  Terminal, 
  FileText
} from 'lucide-react';

const panelIcons = {
  conversations: MessageSquare,
  extensions: Package,
  files: FolderOpen,
  terminal: Terminal,
  output: FileText
};

export const QuickPanelToggle: React.FC = () => {
  const { layout, togglePanel } = useLayoutConfig();

  return (
    <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-md">
        {layout.panels.map(panel => {
          const Icon = panelIcons[panel.id as keyof typeof panelIcons] || FileText;
          
          return (
            <Button
              key={panel.id}
              variant={panel.visible ? "default" : "ghost"}
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => togglePanel(panel.id)}
              title={`${panel.visible ? 'Hide' : 'Show'} ${panel.title}`}
            >
              <Icon className="h-4 w-4" />
            </Button>
          );
        })}
      </div>
  );
};