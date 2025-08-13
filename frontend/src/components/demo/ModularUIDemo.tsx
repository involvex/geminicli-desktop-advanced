import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { useLayoutConfig } from '../../hooks/useLayoutConfig';

export const ModularUIDemo: React.FC = () => {
  const { layout, togglePanel, movePanel } = useLayoutConfig();

  const demoActions = [
    {
      title: 'Show Extensions Panel',
      action: () => togglePanel('extensions'),
      description: 'Toggle the extensions panel visibility'
    },
    {
      title: 'Show Files Panel',
      action: () => togglePanel('files'),
      description: 'Toggle the file explorer panel'
    },
    {
      title: 'Show Terminal',
      action: () => togglePanel('terminal'),
      description: 'Toggle the terminal panel at bottom'
    },
    {
      title: 'Float Conversations',
      action: () => movePanel('conversations', 'floating', { x: 300, y: 100 }),
      description: 'Make conversations panel floating'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Modular UI System</CardTitle>
          <CardDescription>
            VSCode-like panel management with drag & drop, pinning, and floating windows
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {demoActions.map((demo, index) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-4 flex flex-col items-start"
                onClick={demo.action}
              >
                <span className="font-medium">{demo.title}</span>
                <span className="text-sm text-muted-foreground mt-1">
                  {demo.description}
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Panel Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2">
            {layout.panels.map(panel => (
              <div key={panel.id} className="flex items-center justify-between p-2 border rounded">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{panel.title}</span>
                  <Badge variant={panel.visible ? 'default' : 'secondary'}>
                    {panel.visible ? 'Visible' : 'Hidden'}
                  </Badge>
                  <Badge variant="outline">{panel.position}</Badge>
                  {panel.pinned && <Badge variant="secondary">Pinned</Badge>}
                  {panel.minimized && <Badge variant="secondary">Minimized</Badge>}
                </div>
                <span className="text-sm text-muted-foreground">
                  {panel.size}px
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>• <strong>Drag & Drop:</strong> Drag panel headers to reposition</li>
            <li>• <strong>Floating Panels:</strong> Detach panels to float anywhere</li>
            <li>• <strong>Pin/Unpin:</strong> Keep important panels always visible</li>
            <li>• <strong>Minimize:</strong> Collapse panels to save space</li>
            <li>• <strong>Resize:</strong> Drag panel edges to resize</li>
            <li>• <strong>Quick Toggle:</strong> Use toolbar buttons for instant access</li>
            <li>• <strong>Persistent State:</strong> Layout saved automatically</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};