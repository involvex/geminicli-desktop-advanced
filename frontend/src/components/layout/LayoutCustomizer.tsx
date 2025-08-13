import React from 'react';
import { useLayoutConfig } from '../../hooks/useLayoutConfig';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { Settings, Layout, Sidebar } from 'lucide-react';

export const LayoutCustomizer: React.FC = () => {
  const { layout, togglePanel, setSidebarPosition } = useLayoutConfig();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Layout className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Layout Customization</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sidebar Position */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sidebar className="w-5 h-5" />
              Sidebar Position
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={layout.sidebarPosition === 'left' ? 'default' : 'outline'}
                onClick={() => setSidebarPosition('left')}
              >
                Left
              </Button>
              <Button
                variant={layout.sidebarPosition === 'right' ? 'default' : 'outline'}
                onClick={() => setSidebarPosition('right')}
              >
                Right
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Panel Visibility */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Panel Visibility
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {layout.panels.map(panel => (
              <div key={panel.id} className="flex items-center justify-between">
                <Label htmlFor={panel.id}>{panel.title}</Label>
                <Switch
                  id={panel.id}
                  checked={panel.visible}
                  onCheckedChange={() => togglePanel(panel.id)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Panel Layout Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Layout Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-lg p-4 bg-muted/20">
            <div className="flex h-32">
              {/* Left Panels */}
              <div className="flex">
                {layout.panels
                  .filter(p => p.position === 'left' && p.visible)
                  .map(panel => (
                    <div key={panel.id} className="w-8 bg-blue-200 dark:bg-blue-800 mr-1 rounded text-xs p-1">
                      {panel.title.slice(0, 3)}
                    </div>
                  ))}
              </div>

              {/* Main Content */}
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 mx-2 rounded flex items-center justify-center text-sm">
                Main Content
              </div>

              {/* Right Panels */}
              <div className="flex">
                {layout.panels
                  .filter(p => p.position === 'right' && p.visible)
                  .map(panel => (
                    <div key={panel.id} className="w-8 bg-green-200 dark:bg-green-800 ml-1 rounded text-xs p-1">
                      {panel.title.slice(0, 3)}
                    </div>
                  ))}
              </div>
            </div>

            {/* Bottom Panels */}
            {layout.panels.some(p => p.position === 'bottom' && p.visible) && (
              <div className="mt-2 h-6 bg-yellow-200 dark:bg-yellow-800 rounded flex items-center justify-center text-xs">
                Bottom Panels
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};