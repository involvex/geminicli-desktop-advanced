import React from 'react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Package, Download, Settings } from 'lucide-react';

export const ExtensionPanel: React.FC = () => {
  const extensions = [
    { name: 'AWS Toolkit', version: '1.2.0', enabled: true },
    { name: 'Git Integration', version: '2.1.0', enabled: true },
    { name: 'Theme Builder', version: '1.0.0', enabled: false },
    { name: 'Code Formatter', version: '1.5.0', enabled: true }
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Extensions</h3>
        <Button size="sm" variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Browse
        </Button>
      </div>
      
      <div className="space-y-2">
        {extensions.map((ext, index) => (
          <Card key={index} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                <div>
                  <div className="font-medium text-sm">{ext.name}</div>
                  <div className="text-xs text-muted-foreground">v{ext.version}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={ext.enabled ? 'default' : 'secondary'}>
                  {ext.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
                <Button size="sm" variant="ghost">
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};