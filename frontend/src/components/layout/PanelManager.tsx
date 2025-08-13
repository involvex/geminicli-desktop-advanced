import React, { useState } from 'react';
import { useLayoutConfig } from '../../hooks/useLayoutConfig';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { Settings, Pin, Minimize2 } from 'lucide-react';

export const PanelManager: React.FC = () => {
  const { layout, togglePanel, pinPanel, minimizePanel } = useLayoutConfig();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <Button variant="ghost" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Panel Manager</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {layout.panels.map(panel => (
            <div key={panel.id} className="flex items-center justify-between p-2 border rounded">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{panel.title}</span>
                <span className="text-xs text-muted-foreground">
                  {panel.position}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-6 w-6 p-0 ${panel.pinned ? 'text-blue-500' : ''}`}
                  onClick={() => pinPanel(panel.id)}
                >
                  <Pin className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => minimizePanel(panel.id)}
                >
                  <Minimize2 className="h-3 w-3" />
                </Button>
                <Switch
                  checked={panel.visible}
                  onCheckedChange={() => togglePanel(panel.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};