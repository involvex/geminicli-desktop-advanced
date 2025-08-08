import { useState } from "react";
import { Edit3, Check, X, ChevronDown } from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { DiffViewer } from "../common/DiffViewer";
import { type ToolCall } from "../../utils/toolCallParser";

interface EditResult {
  file_path?: string;
  old_string?: string;
  new_string?: string;
  success?: boolean;
  additions?: number;
  deletions?: number;
  edits?: Array<{
    file_path: string;
    old_string: string;
    new_string: string;
    line_start?: number;
    line_end?: number;
  }>;
  message?: string;
  error?: string;
}

interface EditRendererProps {
  toolCall: ToolCall;
  onConfirm?: (toolCallId: string, outcome: string) => Promise<void>;
}

export function EditRenderer({ toolCall, onConfirm }: EditRendererProps) {
  const [diffStats, setDiffStats] = useState<{
    additions: number;
    deletions: number;
  }>({ additions: 0, deletions: 0 });

  const result = (toolCall.result as EditResult) || {};

  // Extract edit information from parameters, result, and JSON-RPC confirmation request
  const getEditInfo = () => {
    // First, check for JSON-RPC confirmation request (this is the primary source)
    if (toolCall.confirmationRequest?.content?.type === "diff") {
      const content = toolCall.confirmationRequest.content;

      const editInfo = {
        type: "single" as const,
        filePath: content.path || "unknown file",
        oldText: content.oldText || "",
        newText: content.newText || "",
        additions: 0, // Will be calculated by DiffViewer
        deletions: 0, // Will be calculated by DiffViewer
        label: toolCall.confirmationRequest.label,
      };

      return editInfo;
    }

    // For single edit from parameters
    if (toolCall.parameters?.file_path) {
      const editInfo = {
        type: "single" as const,
        filePath: toolCall.parameters.file_path as string,
        oldText: (toolCall.parameters.old_string as string) || "",
        newText: (toolCall.parameters.new_string as string) || "",
        additions: result.additions || 0,
        deletions: result.deletions || 0,
      };

      return editInfo;
    }

    // For multi-edit from parameters
    if (
      toolCall.parameters?.edits &&
      Array.isArray(toolCall.parameters.edits)
    ) {
      const edits = toolCall.parameters.edits as EditResult["edits"];
      return {
        type: "multi" as const,
        edits: edits || [],
        totalAdditions:
          edits?.reduce((sum, _edit) => sum + (result.additions || 0), 0) || 0,
        totalDeletions:
          edits?.reduce((sum, _edit) => sum + (result.deletions || 0), 0) || 0,
      };
    }

    // Fallback - try to extract from result
    if (result.file_path) {
      return {
        type: "single" as const,
        filePath: result.file_path,
        oldText: result.old_string || "",
        newText: result.new_string || "",
        additions: result.additions || 0,
        deletions: result.deletions || 0,
      };
    }

    return null;
  };

  const editInfo = getEditInfo();

  if (!editInfo) {
    return null;
  }

  const isPending = toolCall.status === "pending";
  const isRunning = toolCall.status === "running";
  const isCompleted = toolCall.status === "completed";
  const isFailed = toolCall.status === "failed";

  // Calculate total changes for display
  const getTotalChanges = () => {
    if (editInfo.type === "single") {
      // For JSON-RPC confirmations, we might not have pre-calculated counts
      if (
        editInfo.additions === 0 &&
        editInfo.deletions === 0 &&
        editInfo.oldText &&
        editInfo.newText
      ) {
        // Calculate rough counts based on line differences
        const oldLines = editInfo.oldText.split("\n").length;
        const newLines = editInfo.newText.split("\n").length;
        const additions = Math.max(0, newLines - oldLines);
        const deletions = Math.max(0, oldLines - newLines);
        return { additions, deletions };
      }
      return { additions: editInfo.additions, deletions: editInfo.deletions };
    } else {
      return {
        additions: editInfo.totalAdditions,
        deletions: editInfo.totalDeletions,
      };
    }
  };

  getTotalChanges();

  return (
    <div className="my-4">
      <Card
        className={`${
          isFailed
            ? "border-red-200 dark:border-red-800"
            : isCompleted
              ? "border-green-200 dark:border-green-800"
              : "border-blue-200 dark:border-blue-800"
        }`}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Edit3
                className={`h-4 w-4 ${
                  isFailed
                    ? "text-red-500"
                    : isCompleted
                      ? "text-green-500"
                      : "text-blue-500"
                }`}
              />
              <CardTitle className="text-sm font-mono">
                {editInfo.type === "single"
                  ? editInfo.filePath
                  : "(multiple files)"}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  <span className="text-green-600 dark:text-green-400">
                    +{diffStats.additions}
                  </span>{" "}
                  <span className="text-red-600 dark:text-red-400">
                    -{diffStats.deletions}
                  </span>
                </span>
              </CardTitle>
            </div>

            <div className="flex items-center gap-2">
              {/* Show status indicators */}
              {isRunning && (
                <div className="text-xs text-blue-500 flex items-center gap-1">
                  <div className="animate-spin h-3 w-3 border border-blue-500 border-t-transparent rounded-full"></div>
                  Running...
                </div>
              )}
              {isCompleted && (
                <div className="text-xs text-green-500">✓ Completed</div>
              )}
              {isFailed && <div className="text-xs text-red-500">✗ Failed</div>}

              {/* Show buttons for pending, hide for running */}
              {isPending && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs"
                    onClick={() => {
                      onConfirm?.(toolCall.id, "allow");
                    }}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Accept
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-2 py-1 text-xs"
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem
                        onClick={() => onConfirm?.(toolCall.id, "alwaysAllow")}
                      >
                        Always allow edits from this agent
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          onConfirm?.(toolCall.id, "alwaysAllowTool")
                        }
                      >
                        Always allow this tool
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          onConfirm?.(toolCall.id, "alwaysAllowMcpServer")
                        }
                      >
                        Always allow MCP server
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    size="sm"
                    variant="destructive"
                    className="px-3 py-1 text-xs"
                    onClick={() => onConfirm?.(toolCall.id, "reject")}
                  >
                    <X className="h-3 w-3 mr-1" />
                    Reject
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    className="px-3 py-1 text-xs"
                    onClick={() => onConfirm?.(toolCall.id, "cancel")}
                  >
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <DiffViewer
            oldText={editInfo.type === "single" ? editInfo.oldText : ""}
            newText={editInfo.type === "single" ? editInfo.newText : ""}
            fileName={
              editInfo.type === "single"
                ? editInfo.filePath
                : "(multiple files)"
            }
            onStatsCalculated={setDiffStats}
          />
        </CardContent>
      </Card>
    </div>
  );
}
