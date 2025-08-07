import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { type ToolCall } from "../../utils/toolCallParser";

interface GrepGlobResult {
  markdown?: string;
  message?: string;
}

interface GrepGlobRendererProps {
  toolCall: ToolCall;
}

export function GrepGlobRenderer({ toolCall }: GrepGlobRendererProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const result = toolCall.result as GrepGlobResult;

  // Extract search pattern from tool call label
  const getSearchPattern = (): string => {
    // First try the label field (this should have the search pattern like '**/Cargo.toml')
    if (toolCall.label && toolCall.label.trim()) {
      const cleanLabel = toolCall.label.replace(/['"]/g, '');
      return cleanLabel;
    }
    
    // Fallback to generic "files"
    return "files";
  };

  // Get the summary message from the result
  const getSummary = (): string => {
    if (typeof result === 'string') {
      return result;
    }
    if (result && typeof result === 'object') {
      if ('markdown' in result && result.markdown) {
        return result.markdown;
      }
      if ('message' in result && result.message) {
        return result.message;
      }
    }
    
    // Handle case where there's no result (empty search)
    if (!result) {
      return 'No matches found';
    }
    
    return 'Search completed';
  };

  const searchPattern = getSearchPattern();
  const summary = getSummary();

  return (
    <div className="mt-4">
      <div 
        className="flex items-center gap-2 text-sm px-2 py-1 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Search className="h-4 w-4 text-blue-500" />
        <span>Searched </span>
        <span className="text-muted-foreground">{searchPattern}</span>
        <ChevronRight 
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            isExpanded ? 'rotate-90' : ''
          }`}
        />
      </div>
      {isExpanded && (
        <div className="ml-8 text-sm text-muted-foreground">
          {summary}
        </div>
      )}
    </div>
  );
}