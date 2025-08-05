import { Check, X } from "lucide-react";
import { Button } from "./ui/button";
import type { ToolCall } from "../utils/toolCallParser";

interface ToolCallDisplayProps {
  toolCall: ToolCall;
  onConfirm?: (toolCallId: string, outcome: string) => void;
  hasConfirmationRequest?: boolean;
}

export function ToolCallDisplay({ toolCall, onConfirm, hasConfirmationRequest }: ToolCallDisplayProps) {
  // Convert snake_case to PascalCase
  const formatToolName = (name: string): string => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  };
  // const getToolIcon = (toolName: string) => {
  //   // Common Gemini CLI tools
  //   switch (toolName.toLowerCase()) {
  //     case 'list_files':
  //     case 'list_directory':
  //     case 'ls':
  //       return <FolderOpen className="size-4" />;
  //     case 'search_files':
  //     case 'find_files':
  //     case 'grep':
  //       return <Search className="size-4" />;
  //     case 'search':
  //     case 'search_web':
  //     case 'web_search':
  //       return <Globe className="size-4" />;
  //     case 'read':
  //     case 'read_file':
  //     case 'file_read':
  //       return <FileText className="size-4" />;
  //     case 'write':
  //     case 'write_file':
  //     case 'file_write':
  //       return <File className="size-4" />;
  //     case 'shell':
  //     case 'execute':
  //     case 'run':
  //     case 'bash':
  //       return <Terminal className="size-4" />;
  //     case 'code':
  //     case 'python':
  //     case 'javascript':
  //       return <Code className="size-4" />;
  //     case 'weather':
  //     case 'get_weather':
  //       return <CloudRain className="size-4" />;
  //     case 'database':
  //     case 'sql':
  //       return <Database className="size-4" />;
  //     case 'config':
  //     case 'settings':
  //       return <Settings className="size-4" />;
  //     case 'api':
  //     case 'fetch':
  //       return <Zap className="size-4" />;
  //     default:
  //       return <Wrench className="size-4" />;
  //   }
  // };

  // const getToolDescription = (toolCall: ToolCall) => {
  //   const params = toolCall.parameters;
  //   const name = toolCall.name.toLowerCase();
  //
  //   // Handle specific tool types
  //   if (name === 'list_files' || name === 'list_directory') {
  //     return `Listing files in: ${params.path || '.'}`;
  //   }
  //   if (name === 'search_files' || name === 'find_files') {
  //     return `Searching for "${params.pattern || params.query}" in ${params.path || '.'}`;
  //   }
  //   if (params.query) return `Searching for "${params.query}"`;
  //   if (params.file || params.path) return `Reading file: ${params.file || params.path}`;
  //   if (params.content && (name.includes('write') || name.includes('create'))) return `Writing to file`;
  //   if (params.command) return `Running: ${params.command}`;
  //   if (params.code) return `Executing code`;
  //   if (params.location) return `Getting weather for ${params.location}`;
  //   if (params.url) return `Fetching: ${params.url}`;
  //
  //   return `Using tool: ${toolCall.name}`;
  // };

  // const renderToolResult = (result: any) => {
  //   if (!result) return null;

  //   // Handle file listing results
  //   if (result.files && Array.isArray(result.files)) {
  //     return (
  //       <div className="space-y-1">
  //         {result.files.map((file: any, index: number) => (
  //           <div key={index} className="flex items-center gap-2 text-sm p-1 hover:bg-muted/50 rounded">
  //             {file.type === 'directory' ? (
  //               <FolderOpen className="size-3 text-blue-500" />
  //             ) : (
  //               <File className="size-3 text-gray-500" />
  //             )}
  //             <span className="font-mono">{file.name}</span>
  //             <span className="text-xs text-muted-foreground">({file.type})</span>
  //           </div>
  //         ))}
  //       </div>
  //     );
  //   }

  //   // Handle search results
  //   if (result.matches && Array.isArray(result.matches)) {
  //     return (
  //       <div className="space-y-2">
  //         <div className="text-xs text-muted-foreground">Found {result.total} matches</div>
  //         {result.matches.map((match: any, index: number) => (
  //           <div key={index} className="border-l-2 border-blue-500 pl-3 py-1">
  //             <div className="font-mono text-sm">{match.file}</div>
  //             <div className="text-xs text-muted-foreground">
  //               Lines: {match.lines.join(', ')}
  //             </div>
  //           </div>
  //         ))}
  //       </div>
  //     );
  //   }

  //   // Handle different result formats from Gemini CLI
  //   if (typeof result === 'string') {
  //     return (
  //       <pre className="bg-muted p-2 rounded text-sm overflow-x-auto whitespace-pre-wrap">
  //         <code>{result}</code>
  //       </pre>
  //     );
  //   }

  //   if (result.message) {
  //     return (
  //       <div className="text-sm p-2 bg-muted rounded">
  //         {result.message}
  //       </div>
  //     );
  //   }

  //   if (result.output) {
  //     return (
  //       <pre className="bg-muted p-2 rounded text-sm overflow-x-auto whitespace-pre-wrap">
  //         <code>{result.output}</code>
  //       </pre>
  //     );
  //   }

  //   if (result.content) {
  //     return (
  //       <div className="text-sm p-2 bg-muted rounded whitespace-pre-wrap">
  //         {result.content}
  //       </div>
  //     );
  //   }

  //   // Default: show as JSON
  //   return (
  //     <pre className="bg-muted p-2 rounded text-sm overflow-x-auto">
  //       <code>{JSON.stringify(result, null, 2)}</code>
  //     </pre>
  //   );
  // };

  const getResultSummary = (toolCall: ToolCall): string | null => {
    if (!toolCall.result) return null;

    const name = toolCall.name.toLowerCase();
    const result = toolCall.result;

    if (typeof result === "string") {
      return result.substring(0, 50) + (result.length > 50 ? "..." : "");
    }

    if (name === "list_files" && result.files) {
      return `Listed ${result.files.length} files.`;
    }
    if (name === "search_files" && result.matches) {
      return `Found ${result.total || result.matches.length} matches.`;
    }
    if (result.message) {
      return result.message;
    }

    return "Completed successfully.";
  };

  const getErrorSummary = (toolCall: ToolCall): string => {
    if (!toolCall.result) return "Failed to execute.";

    const result = toolCall.result;

    // If result is a string
    if (typeof result === "string") {
      const firstLine = result.trim().split("\n")[0];
      return firstLine.length > 60
        ? firstLine.substring(0, 60) + "..."
        : firstLine;
    }

    // If result has markdown field (like in the error example)
    if (result.markdown) {
      const error = result.markdown.trim();
      // Return first line of error, truncated if needed
      const firstLine = error.split("\n")[0];
      return firstLine.length > 60
        ? firstLine.substring(0, 60) + "..."
        : firstLine;
    }

    // If result has error field
    if (result.error) {
      return result.error.length > 60
        ? result.error.substring(0, 60) + "..."
        : result.error;
    }

    return "Command failed.";
  };

  const getRunningDescription = (toolCall: ToolCall): string => {
    const params = toolCall.parameters;
    const name = toolCall.name.toLowerCase();

    if (name === "write_file" || name === "writefile") {
      return `Writing to ${params.file || params.path || "file"}`;
    }
    if (name === "list_files") {
      return `Listing files in ${params.path || "."}`;
    }
    if (name === "search_files") {
      return `Searching for "${params.pattern || params.query}"`;
    }
    if (name === "read_file") {
      return `Reading ${params.file || params.path}`;
    }

    return "Running...";
  };


  return (
    <div className="my-4 w-full">
      {/* Pending State */}
      {toolCall.status === "pending" && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="mb-3">
            <span className="font-medium text-base text-black dark:text-white font-mono">
              {formatToolName(toolCall.name)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              Pending approval...
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span className="animate-pulse">●</span>
            Waiting for user approval
          </div>

          {/* Input JSON-RPC */}
          {toolCall.inputJsonRpc && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Input:
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto border">
                <code>{toolCall.inputJsonRpc}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Running State */}
      {toolCall.status === "running" && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="mb-3">
            <span className="font-medium text-base text-black dark:text-white font-mono">
              {formatToolName(toolCall.name)}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
              {getRunningDescription(toolCall)}
            </span>
          </div>

          {/* Approval Buttons - Only show if there's a confirmation request */}
          {hasConfirmationRequest && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Approve?
              </span>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs"
                onClick={() => onConfirm?.(toolCall.id, "allow")}
              >
                <Check className="h-3 w-3 mr-1" />
                Yes
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="px-3 py-1 text-xs"
                onClick={() => onConfirm?.(toolCall.id, "reject")}
              >
                <X className="h-3 w-3 mr-1" />
                No
              </Button>
            </div>
          )}

          {/* Input JSON-RPC */}
          {toolCall.inputJsonRpc && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Input:
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto border">
                <code>{toolCall.inputJsonRpc}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Failed State */}
      {toolCall.status === "failed" && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-md px-4 py-3">
          <div className="font-medium text-sm text-black dark:text-white mb-1 font-mono">
            {formatToolName(toolCall.name)}
          </div>
          <div className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
            <X className="size-3" />
            {getErrorSummary(toolCall)}
          </div>

          {/* Input JSON-RPC */}
          {toolCall.inputJsonRpc && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Input:
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto border">
                <code>{toolCall.inputJsonRpc}</code>
              </pre>
            </div>
          )}

          {/* Output JSON-RPC */}
          {toolCall.outputJsonRpc && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Output:
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto border">
                <code>{toolCall.outputJsonRpc}</code>
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Completed State */}
      {toolCall.result && toolCall.status === "completed" && (
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-md px-4 py-3">
          <div className="font-medium text-sm text-black dark:text-white mb-1 font-mono">
            {formatToolName(toolCall.name)}
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
            <Check className="size-3" />
            {getResultSummary(toolCall)}
          </div>

          {/* Input JSON-RPC */}
          {toolCall.inputJsonRpc && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Input:
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto border">
                <code>{toolCall.inputJsonRpc}</code>
              </pre>
            </div>
          )}

          {/* Output JSON-RPC */}
          {toolCall.outputJsonRpc && (
            <div className="mt-4">
              <div className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-2">
                Output:
              </div>
              <pre className="bg-gray-100 dark:bg-gray-900 p-3 rounded text-xs overflow-x-auto border">
                <code>{toolCall.outputJsonRpc}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
