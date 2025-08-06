import { Eye } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface ReadManyFilesResult {
  content?: string;
  message?: string;
  error?: string;
  markdown?: string;
}

interface ReadManyFilesRendererProps {
  toolCall: ToolCall;
}

export function ReadManyFilesRenderer({ toolCall }: ReadManyFilesRendererProps) {
  const result = (toolCall.result as ReadManyFilesResult) || {};
  
  // Extract file count and file list from input
  const getFileInfo = (): { fileCount: number; files: string[] } => {
    let files: string[] = [];
    
    try {
      if (toolCall.inputJsonRpc) {
        const input = JSON.parse(toolCall.inputJsonRpc);
        const params = input.params || {};
        
        // Try different parameter names
        const patterns = params.patterns || params.files || params.paths || [];
        if (Array.isArray(patterns)) {
          files = patterns.map(String);
        } else if (typeof patterns === 'string') {
          files = [patterns];
        }
      }
    } catch {
      // Ignore parsing errors
    }
    
    // Fallback: check toolCall.parameters directly
    if (files.length === 0 && toolCall.parameters) {
      const patterns = toolCall.parameters.patterns || toolCall.parameters.files || toolCall.parameters.paths || [];
      if (Array.isArray(patterns)) {
        files = patterns.map(String);
      } else if (typeof patterns === 'string') {
        files = [patterns];
      }
    }
    
    return {
      fileCount: files.length,
      files
    };
  };

  // Extract processed files from result
  const getProcessedFiles = (): string[] => {
    if (result.markdown) {
      // Parse the markdown result to extract processed files
      const match = result.markdown.match(/\*\*Processed Files:\*\*\n((?:- `.+`\n?)*)/);
      if (match && match[1]) {
        return match[1]
          .split('\n')
          .map(line => line.replace(/^- `(.+)`$/, '$1'))
          .filter(line => line.trim() && !line.startsWith('- '));
      }
    }
    
    return [];
  };

  // Get status message
  const getStatusMessage = (): string => {
    if (result.error) {
      return `Error: ${result.error}`;
    }
    if (result.markdown) {
      // Extract the file count from the markdown
      const match = result.markdown.match(/Successfully read and concatenated content from \*\*(\d+) file\(s\)\*\*/);
      if (match && match[1]) {
        return `Successfully read ${match[1]} file${match[1] === '1' ? '' : 's'}`;
      }
    }
    if (result.message) {
      return result.message;
    }
    return 'Files read completed';
  };

  const { fileCount, files } = getFileInfo();
  const processedFiles = getProcessedFiles();
  const statusMessage = getStatusMessage();
  
  // Use processed files if available, otherwise fall back to input files
  const displayFiles = processedFiles.length > 0 ? processedFiles : files;
  const displayCount = processedFiles.length > 0 ? processedFiles.length : fileCount;

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 text-sm px-2 py-1">
        <Eye className="h-4 w-4 text-blue-500" />
        <span>Read </span>
        <span className="font-medium">{displayCount}</span>
        <span> file{displayCount === 1 ? '' : 's'}</span>
      </div>
      
      {/* File list */}
      {displayFiles.length > 0 && (
        <div className="ml-8 mt-2 space-y-1">
          {displayFiles.map((file, index) => (
            <div key={index} className="text-sm text-muted-foreground">
              {file}
            </div>
          ))}
        </div>
      )}
      
      <div className="ml-8 mt-2 text-sm text-muted-foreground">
        {statusMessage}
      </div>
    </div>
  );
}