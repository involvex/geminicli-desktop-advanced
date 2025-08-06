import { type ToolCall } from "../utils/toolCallParser";
import { DirectoryRenderer } from "./renderers/DirectoryRenderer";
import { SearchRenderer } from "./renderers/SearchRenderer";
import { CommandRenderer } from "./renderers/CommandRenderer";
import { FileRenderer } from "./renderers/FileRenderer";
import { DefaultRenderer } from "./renderers/DefaultRenderer";

interface ToolResultRendererProps {
  toolCall: ToolCall;
}

export function ToolResultRenderer({ toolCall }: ToolResultRendererProps) {
  // Only render if tool call is completed and has results
  if (toolCall.status !== "completed" || !toolCall.result) {
    return null;
  }

  // Route to appropriate renderer based on tool name
  switch (toolCall.name) {
    case "list_directory":
      return <DirectoryRenderer toolCall={toolCall} />;
    case "search_files":
      return <SearchRenderer toolCall={toolCall} />;
    case "execute_command":
      return <CommandRenderer toolCall={toolCall} />;
    case "read_file":
      return <FileRenderer toolCall={toolCall} />;
    default:
      return <DefaultRenderer toolCall={toolCall} />;
  }
}