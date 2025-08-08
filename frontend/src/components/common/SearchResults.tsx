import { Card, CardHeader, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { SearchResult } from "@/lib/webApi";
import { Clock, Hash, ChevronRight, Search } from "lucide-react";
import { useState, useCallback, useMemo } from "react";

interface SearchResultsProps {
  results: SearchResult[];
  isSearching?: boolean;
  onConversationSelect: (conversationId: string) => void;
  query?: string;
}

export function SearchResults({
  results,
  isSearching = false,
  onConversationSelect,
  query = "",
}: SearchResultsProps) {
  const [expandedResults, setExpandedResults] = useState<Set<string>>(
    new Set()
  );

  const toggleExpanded = useCallback((chatId: string) => {
    setExpandedResults((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(chatId)) {
        newSet.delete(chatId);
      } else {
        newSet.add(chatId);
      }
      return newSet;
    });
  }, []);

  const formatLastUpdated = useCallback((dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }, []);

  const highlightText = useCallback((text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded text-black dark:text-white"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, []);

  // Memoize the loading skeleton to prevent re-renders
  const loadingSkeleton = useMemo(
    () => (
      <div className="space-y-2">
        <div className="text-sm text-gray-500 dark:text-gray-400 px-1 flex items-center gap-2">
          <Search className="h-4 w-4 animate-pulse" />
          Searching...
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="p-3 pb-2">
              <Skeleton className="h-4 w-3/4" />
              <div className="flex items-center gap-2 mt-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3 mt-1" />
            </CardContent>
          </Card>
        ))}
      </div>
    ),
    []
  );

  // Memoize the empty state
  const emptyState = useMemo(
    () => (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No conversations found</p>
        <p className="text-xs mt-1">Try different search terms</p>
      </div>
    ),
    []
  );

  if (isSearching) {
    return loadingSkeleton;
  }

  if (results.length === 0) {
    return emptyState;
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-500 dark:text-gray-400 px-1">
        {results.length} result{results.length !== 1 ? "s" : ""} found
      </div>

      {results.map((result) => {
        const isExpanded = expandedResults.has(result.chat.id);
        const projectHash = result.chat.id.split(":")[0];

        return (
          <Card
            key={result.chat.id}
            className="cursor-pointer transition-all hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <CardHeader
              className="p-3 pb-2"
              onClick={() => onConversationSelect(result.chat.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                    {highlightText(result.chat.title, query)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {/* Project Badge */}
                    <Badge
                      variant="secondary"
                      className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs px-2 py-0.5"
                    >
                      <Hash className="h-3 w-3 mr-1" />
                      {projectHash.slice(0, 8)}...
                    </Badge>

                    {/* Relevance Score */}
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0.5"
                    >
                      {result.relevance_score.toFixed(1)} score
                    </Badge>

                    {/* Time */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatLastUpdated(result.chat.started_at_iso)}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(result.chat.id);
                  }}
                >
                  <ChevronRight
                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                  />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-3 pt-0">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>
                  {result.chat.message_count} messages • {result.matches.length}{" "}
                  matches
                </span>
                <span>Click to view conversation</span>
              </div>

              {/* Expanded Matches */}
              {isExpanded && result.matches.length > 0 && (
                <div className="mt-3 space-y-2 border-t pt-3">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Matching Messages:
                  </div>
                  {result.matches.slice(0, 3).map((match, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 dark:bg-gray-800 rounded p-2 space-y-1"
                    >
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Line {match.line_number}
                      </div>
                      <div className="text-sm">
                        {highlightText(match.content_snippet, query)}
                      </div>
                      {match.context_before && (
                        <div className="text-xs text-gray-400 border-l-2 border-gray-300 pl-2">
                          Context: {match.context_before.slice(0, 100)}...
                        </div>
                      )}
                    </div>
                  ))}
                  {result.matches.length > 3 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      +{result.matches.length - 3} more matches...
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
