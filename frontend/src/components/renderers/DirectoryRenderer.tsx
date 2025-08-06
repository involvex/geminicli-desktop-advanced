import { useState } from "react";
import { ChevronRight, FolderClosed, FolderOpen, File } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface DirectoryEntry {
  name: string;
  is_directory: boolean;
  full_path: string;
  size?: number;
  modified?: number;
  is_symlink?: boolean;
  symlink_target?: string;
}

interface DirectoryResult {
  entries?: DirectoryEntry[];
  files?: Array<{name: string, type: string, length?: number}>; // Legacy format
}

interface DirectoryRendererProps {
  toolCall: ToolCall;
}

export function DirectoryRenderer({ toolCall }: DirectoryRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const result = toolCall.result as DirectoryResult;
  
  // Handle both new format (entries) and legacy format (files)
  let entries: DirectoryEntry[] = [];
  if (result.entries) {
    entries = result.entries;
  } else if (result.files) {
    // Convert legacy format
    entries = result.files.map(file => ({
      name: file.name,
      is_directory: file.type === 'directory',
      full_path: file.name,
      size: file.length,
    }));
  }

  // Extract path from input JSON-RPC
  const getPath = (): string => {
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        return input.params?.path || input.params?.locations?.[0] || '.';
      }
    } catch {}
    return '.';
  };

  // Sort entries (directories first, then files, both alphabetically)
  const sortedEntries = [...entries].sort((a, b) => {
    // Always show directories first
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    
    // Then sort alphabetically
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });

  const path = getPath();
  const displayPath = path === '.' ? 'current directory' : path;

  return (
    <div className="mt-4">
      {/* Compact summary with click to expand */}
      <div 
        className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 p-2 rounded transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <FolderClosed className="h-4 w-4 text-blue-500" />
        <span>Listed </span>
        <span className="text-muted-foreground font-mono">{displayPath}</span>
        <ChevronRight 
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`} 
        />
      </div>

      {/* Expanded file/folder list */}
      {isExpanded && (
        <div className="ml-6 mt-2 space-y-1 border-l border-gray-200 dark:border-gray-700 pl-4">
          {sortedEntries.map((entry, i) => (
            <div key={i} className="flex items-center gap-2 text-sm py-1">
              {entry.is_directory ? (
                <FolderClosed className="h-4 w-4 text-blue-500" />
              ) : (
                <File className="h-4 w-4 text-gray-500" />
              )}
              <span className="font-mono">{entry.name}</span>
            </div>
          ))}
          
          {entries.length === 0 && (
            <div className="text-sm text-muted-foreground py-2">
              Directory is empty
            </div>
          )}
        </div>
      )}
    </div>
  );
}