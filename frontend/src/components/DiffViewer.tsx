import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'context';
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffViewerProps {
  oldText: string;
  newText: string;
  fileName?: string;
  maxLines?: number;
  className?: string;
  onStatsCalculated?: (stats: { additions: number; deletions: number }) => void;
}

export function DiffViewer({ 
  oldText, 
  newText, 
  fileName, 
  maxLines = 20,
  className,
  onStatsCalculated 
}: DiffViewerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Simple diff algorithm - split into lines and compare
  const generateDiff = (old: string, newer: string): DiffLine[] => {
    const oldLines = old.split('\n');
    const newLines = newer.split('\n');
    const diff: DiffLine[] = [];
    
    let oldIndex = 0;
    let newIndex = 0;
    
    // Simple line-by-line comparison
    // This is a basic implementation - in a real app you might want to use a proper diff library
    while (oldIndex < oldLines.length || newIndex < newLines.length) {
      const oldLine = oldLines[oldIndex];
      const newLine = newLines[newIndex];
      
      if (oldIndex >= oldLines.length) {
        // Only new lines remaining
        diff.push({
          type: 'added',
          content: newLine,
          newLineNumber: newIndex + 1
        });
        newIndex++;
      } else if (newIndex >= newLines.length) {
        // Only old lines remaining
        diff.push({
          type: 'removed',
          content: oldLine,
          oldLineNumber: oldIndex + 1
        });
        oldIndex++;
      } else if (oldLine === newLine) {
        // Lines match
        diff.push({
          type: 'unchanged',
          content: oldLine,
          oldLineNumber: oldIndex + 1,
          newLineNumber: newIndex + 1
        });
        oldIndex++;
        newIndex++;
      } else {
        // Lines differ - this is a simplified approach
        // Check if the new line appears later in old lines (deletion)
        const nextOldMatch = oldLines.slice(oldIndex + 1).findIndex(line => line === newLine);
        // Check if the old line appears later in new lines (addition)
        const nextNewMatch = newLines.slice(newIndex + 1).findIndex(line => line === oldLine);
        
        if (nextOldMatch !== -1 && (nextNewMatch === -1 || nextOldMatch < nextNewMatch)) {
          // Likely a deletion
          diff.push({
            type: 'removed',
            content: oldLine,
            oldLineNumber: oldIndex + 1
          });
          oldIndex++;
        } else if (nextNewMatch !== -1) {
          // Likely an addition
          diff.push({
            type: 'added',
            content: newLine,
            newLineNumber: newIndex + 1
          });
          newIndex++;
        } else {
          // Modified line - show as removal + addition
          diff.push({
            type: 'removed',
            content: oldLine,
            oldLineNumber: oldIndex + 1
          });
          diff.push({
            type: 'added',
            content: newLine,
            newLineNumber: newIndex + 1
          });
          oldIndex++;
          newIndex++;
        }
      }
    }
    
    return diff;
  };

  const diffLines = generateDiff(oldText, newText);
  const visibleLines = isExpanded ? diffLines : diffLines.slice(0, maxLines);
  const hasMoreLines = diffLines.length > maxLines;
  
  // Calculate stats
  const additions = diffLines.filter(line => line.type === 'added').length;
  const deletions = diffLines.filter(line => line.type === 'removed').length;

  // Call the callback with calculated stats
  React.useEffect(() => {
    if (onStatsCalculated) {
      onStatsCalculated({ additions, deletions });
    }
  }, [additions, deletions, onStatsCalculated]);

  const getLineClassName = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500';
      case 'removed':
        return 'bg-red-50 dark:bg-red-900/20 border-l-2 border-red-500';
      case 'unchanged':
        return 'bg-gray-50/50 dark:bg-gray-800/20';
      default:
        return '';
    }
  };

  const getLinePrefix = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return '+';
      case 'removed':
        return '-';
      case 'unchanged':
        return ' ';
      default:
        return '';
    }
  };

  const getLineTextColor = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'text-green-700 dark:text-green-300';
      case 'removed':
        return 'text-red-700 dark:text-red-300';
      case 'unchanged':
        return 'text-muted-foreground';
      default:
        return '';
    }
  };

  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      {fileName && (
        <div className="bg-muted/50 px-3 py-2 border-b flex items-center justify-between">
          <div className="font-mono text-sm">{fileName}</div>
          <div className="text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">+{additions}</span>
            {' '}
            <span className="text-red-600 dark:text-red-400">-{deletions}</span>
          </div>
        </div>
      )}
      
      <div className="max-h-96 overflow-auto">
        {visibleLines.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex text-xs font-mono",
              getLineClassName(line.type)
            )}
          >
            <div className="px-2 py-1 text-muted-foreground min-w-8 text-right select-none">
              {line.oldLineNumber || line.newLineNumber || ''}
            </div>
            <div className="px-1 py-1 text-muted-foreground select-none">
              {getLinePrefix(line.type)}
            </div>
            <div className={cn("px-2 py-1 flex-1", getLineTextColor(line.type))}>
              {line.content || ' '}
            </div>
          </div>
        ))}
      </div>
      
      {hasMoreLines && (
        <div 
          className="bg-muted/30 px-3 py-2 border-t cursor-pointer hover:bg-muted/50 transition-colors flex items-center gap-2"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <span className="text-xs text-muted-foreground">
            {isExpanded 
              ? 'Show less' 
              : `Show ${diffLines.length - maxLines} more lines`
            }
          </span>
        </div>
      )}
    </div>
  );
}