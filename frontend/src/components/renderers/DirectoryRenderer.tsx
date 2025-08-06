import { useState } from "react";
import { ChevronRight, Folder, File, Link, Copy } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";
import { Button } from "../ui/button";

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

type SortKey = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';

interface DirectoryRendererProps {
  toolCall: ToolCall;
}

export function DirectoryRenderer({ toolCall }: DirectoryRendererProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
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

  // Generate breadcrumb from path
  const getBreadcrumbs = (path: string) => {
    if (path === '.') return ['Current Directory'];
    
    const parts = path.split(/[/\\]/);
    const breadcrumbs: string[] = [];
    
    if (path.startsWith('/')) {
      breadcrumbs.push('/');
      breadcrumbs.push(...parts.slice(1));
    } else if (path.match(/^[A-Z]:\\/)) {
      breadcrumbs.push(...parts);
    } else {
      breadcrumbs.push(...parts);
    }
    
    return breadcrumbs.filter(Boolean);
  };

  // Sort entries
  const sortedEntries = [...entries].sort((a, b) => {
    // Always show directories first
    if (a.is_directory && !b.is_directory) return -1;
    if (!a.is_directory && b.is_directory) return 1;
    
    let aVal, bVal;
    switch (sortKey) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'size':
        aVal = a.size || 0;
        bVal = b.size || 0;
        break;
      case 'modified':
        aVal = a.modified || 0;
        bVal = b.modified || 0;
        break;
    }
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Handle sort column click
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Format file size
  const formatSize = (bytes?: number): string => {
    if (!bytes) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  };

  // Format modified time
  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '-';
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  // Copy path to clipboard
  const copyPath = async () => {
    try {
      await navigator.clipboard.writeText(getPath());
    } catch {
      // Fallback for older browsers
    }
  };

  const path = getPath();
  const breadcrumbs = getBreadcrumbs(path);
  const dirCount = entries.filter(e => e.is_directory).length;
  const fileCount = entries.filter(e => !e.is_directory).length;

  return (
    <div className="mt-4 space-y-4">
      {/* Header with breadcrumb and stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span className="font-mono">{crumb}</span>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={copyPath}
          className="text-xs"
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy Path
        </Button>
      </div>

      {/* Stats */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        Listed {entries.length} entries ({dirCount} directories, {fileCount} files)
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th 
                className="text-left px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('name')}
              >
                Name {sortKey === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-left px-4 py-2">Type</th>
              <th 
                className="text-left px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('size')}
              >
                Size {sortKey === 'size' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={() => handleSort('modified')}
              >
                Modified {sortKey === 'modified' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry, i) => (
              <tr key={i} className="border-t hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    {entry.is_symlink ? (
                      <Link className="h-4 w-4 text-cyan-500" />
                    ) : entry.is_directory ? (
                      <Folder className="h-4 w-4 text-blue-500" />
                    ) : (
                      <File className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="font-mono">{entry.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  {entry.is_symlink ? 'Symlink' : entry.is_directory ? 'Directory' : 'File'}
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  {formatSize(entry.size)}
                </td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  {formatTime(entry.modified)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}