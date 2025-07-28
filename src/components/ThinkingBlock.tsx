import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ThinkingBlockProps {
  thinking: string;
}

export function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!thinking || thinking.trim().length === 0) {
    return null;
  }

  return (
    <div className="mb-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400">
          <Brain className="w-4 h-4" />
          <span>Thinking</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 border-t border-gray-200 dark:border-gray-600 mt-2 pt-3">
          <div className="prose prose-sm max-w-none dark:prose-invert text-xs text-gray-600 dark:text-gray-400">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {thinking}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
