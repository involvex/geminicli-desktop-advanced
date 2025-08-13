import React from 'react';
import { Button } from '../ui/button';
import { Terminal as TerminalIcon, Plus, X } from 'lucide-react';

export const Terminal: React.FC = () => {
  const terminalLines = [
    '$ npm run dev',
    'Starting development server...',
    'Local:   http://localhost:5173/',
    'Network: http://192.168.1.100:5173/',
    'ready in 1.2s',
    '$ '
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-2 border-b">
        <div className="flex items-center gap-2">
          <TerminalIcon className="h-4 w-4" />
          <span className="text-sm font-medium">Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
            <Plus className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 p-2 bg-black text-green-400 font-mono text-sm overflow-auto">
        {terminalLines.map((line, index) => (
          <div key={index} className="whitespace-pre">
            {line}
            {index === terminalLines.length - 1 && (
              <span className="animate-pulse">█</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};