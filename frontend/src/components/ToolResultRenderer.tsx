import { type ToolCall } from "../utils/toolCallParser";
import { DirectoryRenderer } from "./renderers/DirectoryRenderer";
import { SearchRenderer } from "./renderers/SearchRenderer";
import { CommandRenderer } from "./renderers/CommandRenderer";
import { ReadFileRenderer } from "./renderers/ReadFileRenderer";
import { ReadManyFilesRenderer } from "./renderers/ReadManyFilesRenderer";
import { DefaultRenderer } from "./renderers/DefaultRenderer";

interface ToolResultRendererProps {
  toolCall: ToolCall;
}

export function ToolResultRenderer({ toolCall }: ToolResultRendererProps) {
  // Always render read_file, even with no result
  if (toolCall.name === "read_file" && toolCall.status === "completed") {
    // Don't check for result - render anyway
  }
  // For other tools, only render if completed and has results
  else if (toolCall.status !== "completed" || !toolCall.result) {
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
      return <ReadFileRenderer toolCall={toolCall} />;
    case "read_many_files":
    case "ReadManyFiles":
      return <ReadManyFilesRenderer toolCall={toolCall} />;
    default:
      return <DefaultRenderer toolCall={toolCall} />;
  }
}