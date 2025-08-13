import React from 'react';
import { Button } from '../ui/button';
import { FileText, Trash2, Copy } from 'lucide-react';

export const Output: React.FC = () => {
  const outputLines = [
    '[INFO] Starting build process...',
    '[INFO] Compiling TypeScript files...',
    '[WARN] Unused import in App.tsx:15',
    '[INFO] Build completed successfully',
    '[INFO] Assets generated in /dist',
    '[INFO] Ready for deployment'
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="text-sm font-medium">Output</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
            <Copy className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 p-2 bg-muted/20 font-mono text-xs overflow-auto">
        {outputLines.map((line, index) => (
          <div key={index} className="py-0.5">
            <span className="text-muted-foreground mr-2">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className={
              line.includes('[WARN]') ? 'text-yellow-500' :
              line.includes('[ERROR]') ? 'text-red-500' :
              line.includes('[INFO]') ? 'text-blue-500' : ''
            }>
              {line}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};