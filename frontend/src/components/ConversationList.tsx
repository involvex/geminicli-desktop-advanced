import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardHeader, CardContent } from "./ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "./ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  X,
  MessageCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useState, useCallback } from "react";
import { webApi, SearchResult, SearchFilters } from "../lib/webApi";
import { SearchInput } from "./SearchInput";
import { SearchResults } from "./SearchResults";

interface ProcessStatus {
  conversation_id: string;
  pid: number | null;
  created_at: number;
  is_alive: boolean;
}

interface Message {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeConversation: string | null;
  processStatuses: ProcessStatus[];
  onConversationSelect: (conversationId: string) => void;
  onKillProcess: (conversationId: string) => void;
  onModelChange?: (model: string) => void;
}

export function ConversationList({
  conversations,
  activeConversation,
  processStatuses,
  onConversationSelect,
  onKillProcess,
  onModelChange,
}: ConversationListProps) {
  const [selectedConversationForEnd, setSelectedConversationForEnd] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const getProcessStatus = (conversationId: string) => {
    return processStatuses.find(
      (status) => status.conversation_id === conversationId
    );
  };


  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const handleSearch = useCallback(async (query: string, filters?: SearchFilters) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = __WEB__ 
        ? await webApi.search_chats({ query, filters })
        : await (async () => {
            const { invoke } = await import("@tauri-apps/api/core");
            return await invoke<SearchResult[]>("search_chats", { query, filters });
          })();
      setSearchResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []); // Empty dependency array since this function doesn't depend on any props or state

  return (
    <div className="w-80 bg-neutral-50 dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-700 h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Conversations
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {searchQuery.trim() ? `Searching in ${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}` : 
           `${conversations.length} conversation${conversations.length !== 1 ? "s" : ""}`}
        </p>

        {/* Search Input */}
        <div className="mt-3">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onSearch={handleSearch}
            isSearching={isSearching}
          />
        </div>

        {/* Model Selector */}
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
            Model
          </label>
          <Select
            value={selectedModel}
            onValueChange={(value) => {
              console.log("Model changed to:", value);
              setSelectedModel(value);
              onModelChange?.(value);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
              <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
              <SelectItem value="gemini-2.5-flash-lite">
                <div className="flex items-center gap-2">
                  <span>Gemini 2.5 Flash-Lite</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Still waitin'...</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      {/* Search Results or Conversation List */}
      <div className="p-3 space-y-2">
        {searchQuery.trim() ? (
          <SearchResults 
            results={searchResults}
            isSearching={isSearching}
            onConversationSelect={onConversationSelect}
            query={searchQuery}
          />
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-xs mt-1">Start a new chat to begin</p>
          </div>
        ) : (
          conversations
            .sort((a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime())
            .map((conversation) => {
              const processStatus = getProcessStatus(conversation.id);
              const isActive = processStatus?.is_alive ?? false;
              const isSelected = activeConversation === conversation.id;

              return (
                <Card
                  key={conversation.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected
                      ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  onClick={async () =>
                    await onConversationSelect(conversation.id)
                  }
                >
                  <CardHeader className="p-3 pb-2 py-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate wrap-normal">
                          {conversation.title.length > 20
                            ? conversation.title.slice(0, 35) + "..."
                            : conversation.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 justify-between">
                          {/* Process Status Badge */}
                          <div className="flex items-center gap-1">
                            {isActive ? (
                              <Badge
                                variant="secondary"
                                className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs px-2 py-0.5"
                              >
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1" />
                                {processStatus?.pid
                                  ? `PID: ${processStatus.pid}`
                                  : "Active"}
                                {/* End Chat Button */}
                                {isActive && (
                                  <Dialog
                                    open={
                                      selectedConversationForEnd?.id ===
                                      conversation.id
                                    }
                                    onOpenChange={(open) => {
                                      if (!open)
                                        setSelectedConversationForEnd(null);
                                    }}
                                  >
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-4 w-4 p-0 ml-2 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-950/70"
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent conversation selection
                                          setSelectedConversationForEnd({
                                            id: conversation.id,
                                            title: conversation.title,
                                          });
                                        }}
                                        title="End chat"
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>End Chat</DialogTitle>
                                        <DialogDescription>
                                          Are you sure you want to end the chat
                                          "{conversation.title}"? This will
                                          terminate the active session.
                                        </DialogDescription>
                                      </DialogHeader>
                                      <DialogFooter>
                                        <Button
                                          variant="outline"
                                          onClick={() =>
                                            setSelectedConversationForEnd(null)
                                          }
                                        >
                                          Cancel
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          onClick={() => {
                                            onKillProcess(conversation.id);
                                            setSelectedConversationForEnd(null);
                                          }}
                                        >
                                          End Chat
                                        </Button>
                                      </DialogFooter>
                                    </DialogContent>
                                  </Dialog>
                                )}
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 text-xs px-2 py-0.5"
                              >
                                <div className="w-2 h-2 bg-gray-400 rounded-full mr-1" />
                                Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-gray-400" />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {formatLastUpdated(conversation.lastUpdated)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="p-3 pb-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {conversation.messages.length} message
                          {conversation.messages.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
        )}
      </div>

    </div>
  );
}
