import React from 'react';
import { Button } from '../ui/button';
import { FolderOpen, File, ChevronRight, ChevronDown } from 'lucide-react';

export const FileExplorer: React.FC = () => {
  const files = [
    { name: 'src', type: 'folder', expanded: true },
    { name: 'components', type: 'folder', expanded: false, level: 1 },
    { name: 'hooks', type: 'folder', expanded: false, level: 1 },
    { name: 'App.tsx', type: 'file', level: 1 },
    { name: 'main.tsx', type: 'file', level: 1 },
    { name: 'package.json', type: 'file' },
    { name: 'README.md', type: 'file' }
  ];

  return (
    <div className="p-2">
      <div className="flex items-center justify-between p-2 mb-2">
        <h3 className="font-semibold text-sm">Explorer</h3>
        <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
          <FolderOpen className="h-3 w-3" />
        </Button>
      </div>
      
      <div className="space-y-1">
        {files.map((item, index) => (
          <div 
            key={index} 
            className="flex items-center gap-1 p-1 hover:bg-muted rounded text-sm cursor-pointer"
            style={{ paddingLeft: `${(item.level || 0) * 12 + 4}px` }}
          >
            {item.type === 'folder' ? (
              <>
                {item.expanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                <FolderOpen className="h-3 w-3 text-blue-500" />
              </>
            ) : (
              <>
                <div className="w-3" />
                <File className="h-3 w-3 text-muted-foreground" />
              </>
            )}
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};