import React, { useState, useEffect, useRef, createContext, useContext } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Routes, Route, Outlet, Navigate, useNavigate } from "react-router-dom";
import { webApi, webListen, getWebSocketManager } from "./lib/webApi";
import { Button } from "./components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import { MessageContent } from "./components/MessageContent";
import { ThinkingBlock } from "./components/ThinkingBlock";
import { ConversationList } from "./components/ConversationList";
import { MentionInput } from "./components/MentionInput";
import { GeminiLogo } from "./components/GeminiLogo";
import { PiebaldLogo } from "./components/PiebaldLogo";
import { type ToolCall, type ToolCallResult } from "./utils/toolCallParser";
import {
  Info,
  AlertCircleIcon,
  AlertTriangle,
  UserRound,
  FolderKanban,
  Send,
  ImagePlus,
} from "lucide-react";
import "./index.css";
import { ToolCallDisplay } from "./components/ToolCallDisplay";
import { Card, CardHeader, CardTitle, CardDescription } from "./components/ui/card";
import ProjectsPage from "./pages/Projects";
import ProjectDetailPage from "./pages/ProjectDetail";
import { GeminiIcon } from "./components/GeminiIcon";
import { GeminiText } from "./components/GeminiText";

interface ThinkingMessagePart {
  type: "thinking";
  thinking: string;
}

interface TextMessagePart {
  type: "text";
  text: string;
}

interface ToolCallMessagePart {
  type: "toolCall";
  toolCall: ToolCall;
}

type GeminiMessagePart =
  | ThinkingMessagePart
  | TextMessagePart
  | ToolCallMessagePart;
type UserMessagePart = TextMessagePart;

type Message = {
  id: string;
  timestamp: Date;
} & (
  | {
      sender: "user";
      parts: UserMessagePart[];
    }
  | {
      sender: "assistant";
      parts: GeminiMessagePart[];
    }
);

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
  isStreaming: boolean;
}

interface CliIO {
  timestamp: Date;
  type: "input" | "output";
  data: string;
  conversationId: string;
}

interface Location {
  path: string;
  line?: number;
  column?: number;
}

interface ToolCallConfirmationRequest {
  requestId: number;
  sessionId: string;
  toolCallId?: string | null;
  label: string;
  icon: string;
  content?: {
    type: string;
    path?: string;
    oldText?: string;
    newText?: string;
  } | null;
  confirmation: {
    type: string;
    rootCommand?: string;
    command?: string;
  };
  locations: Location[];
  inputJsonRpc?: string;
}

interface ProcessStatus {
  conversation_id: string;
  pid: number | null;
  created_at: number;
  is_alive: boolean;
}

interface ToolCallEvent {
  id: number;
  name: string;
  locations?: Location[];
}

interface ToolCallUpdateEvent {
  toolCallId: string | number;
  status: string;
  content?: ToolCallResult;
}

type ErrorContent = ToolCallResult | string | null | undefined;

declare global {
  interface Window {
    pendingToolCallInput?: string;
  }
}

// Abstraction layer for API calls
export const api = {
  async invoke<T>(command: string, args?: any): Promise<T> {
    if (__WEB__) {
      switch (command) {
        case "check_cli_installed":
          return webApi.check_cli_installed() as Promise<T>;
        case "send_message":
          return webApi.send_message(args) as Promise<T>;
        case "get_process_statuses":
          return webApi.get_process_statuses() as Promise<T>;
        case "kill_process":
          return webApi.kill_process(args) as Promise<T>;
        case "send_tool_call_confirmation_response":
          return webApi.send_tool_call_confirmation_response(
            args
          ) as Promise<T>;
        case "execute_confirmed_command":
          return webApi.execute_confirmed_command(args) as Promise<T>;
        case "generate_conversation_title":
          return webApi.generate_conversation_title(args) as Promise<T>;
        case "validate_directory":
          return webApi.validate_directory(args) as Promise<T>;
        case "is_home_directory":
          return webApi.is_home_directory(args) as Promise<T>;
        case "list_projects":
          return webApi.list_projects(args) as Promise<T>;
        case "get_project_discussions":
          return webApi.get_project_discussions(args) as Promise<T>;
        case "list_enriched_projects":
          return webApi.list_projects_enriched() as Promise<T>;
        case "start_session":
          return webApi.start_session(args.sessionId, args.workingDirectory, args.model) as Promise<T>;
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } else {
      return invoke<T>(command, args);
    }
  },

  async listen<T>(
    event: string,
    callback: (event: { payload: T }) => void
  ): Promise<() => void> {
    if (__WEB__) {
      return webListen<T>(event, callback);
    } else {
      return listen<T>(event, callback);
    }
  },
};

// Helper function to detect if a tool call result indicates an error
function isErrorResult(content: ErrorContent): boolean {
  if (!content) return false;

  // Check for common error patterns
  const errorIndicators = [
    "is not recognized as an internal or external command",
    "command not found",
    "no such file or directory",
    "permission denied",
    "access denied",
    "error:",
    "failed:",
    "exception:",
  ];

  // If content is a ToolCallResult with markdown field
  if (typeof content === "object" && content !== null && content.markdown) {
    const markdown = content.markdown.toLowerCase();
    return errorIndicators.some((indicator) => markdown.includes(indicator));
  }

  // If content is a string
  if (typeof content === "string") {
    const contentStr = content.toLowerCase();
    return errorIndicators.some((indicator) => contentStr.includes(indicator));
  }

  // If content has an error field
  if (
    typeof content === "object" &&
    content !== null &&
    (content.error || content.stderr)
  ) {
    return true;
  }

  return false;
}


// Context for sharing conversation state with child routes
interface ConversationContextType {
  conversations: Conversation[];
  activeConversation: string | null;
  currentConversation: Conversation | undefined;
  input: string;
  isCliInstalled: boolean | null;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  cliIOLogs: CliIO[];
  handleInputChange: (
    _event: React.ChangeEvent<HTMLInputElement> | null,
    newValue: string,
    _newPlainTextValue: string,
    _mentions: unknown[]
  ) => void;
  handleSendMessage: (e: React.FormEvent) => Promise<void>;
  selectedModel: string;
  startNewConversation: (title: string, workingDirectory?: string) => Promise<string>;
  handleConfirmToolCall: (toolCallId: string, outcome: string) => Promise<void>;
  confirmationRequests: Map<string, ToolCallConfirmationRequest>;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export const useConversation = () => {
  const context = useContext(ConversationContext);
  if (context === undefined) {
    throw new Error('useConversation must be used within a ConversationProvider');
  }
  return context;
};

function RootLayout() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null
  );
  const [input, setInput] = useState("");
  const [isCliInstalled, setIsCliInstalled] = useState<boolean | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [processStatuses, setProcessStatuses] = useState<ProcessStatus[]>([]);
  const [cliIOLogs, setCliIOLogs] = useState<CliIO[]>([]);
  const [confirmationRequests, setConfirmationRequests] =
    useState<Map<string, ToolCallConfirmationRequest>>(new Map());
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");

  const currentConversation = conversations.find(
    (c) => c.id === activeConversation
  );

  const updateConversation = (
    conversationId: string,
    updateFn: (conv: Conversation, lastMsg: Message) => void
  ) => {
    setConversations((prev) => {
      const clone: Conversation[] = structuredClone(prev);
      const curConv = clone.find((c) => c.id === conversationId);
      if (!curConv) {
        console.error(`Conversation with ID ${conversationId} not found.`);
        return prev;
      }
      const lastMsg = curConv.messages[curConv.messages.length - 1];
      updateFn(curConv, lastMsg);
      curConv.lastUpdated = new Date();
      return clone;
    });
  };

  useEffect(() => {
    checkCliInstallation();
    fetchProcessStatuses();

    // Poll for process status updates every 2 seconds
    const interval = setInterval(() => {
      fetchProcessStatuses();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const checkCliInstallation = async () => {
    try {
      const installed = await api.invoke<boolean>("check_cli_installed");
      setIsCliInstalled(installed);
    } catch (error) {
      console.error("Failed to check CLI installation:", error);
      setIsCliInstalled(false);
    }
  };

  const fetchProcessStatuses = async () => {
    try {
      const statuses = await api.invoke<ProcessStatus[]>(
        "get_process_statuses"
      );
      setProcessStatuses((prev) => {
        // Only update if statuses actually changed
        if (JSON.stringify(prev) !== JSON.stringify(statuses)) {
          return statuses;
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to fetch process statuses:", error);
    }
  };

  const setupEventListenerForConversation = async (
    conversationId: string
  ): Promise<void> => {
    // In web mode, ensure WebSocket connection is ready before registering listeners
    if (__WEB__) {
      const wsManager = getWebSocketManager();
      await wsManager.waitForConnection();
    }

    try {
      await api.listen<{ type: "input" | "output"; data: string }>(
        `cli-io-${conversationId}`,
        (event) => {
          setCliIOLogs((prev) => [
            ...prev,
            {
              timestamp: new Date(),
              type: event.payload.type,
              data: event.payload.data,
              conversationId,
            },
          ]);

          // Check if this is a tool call related JSON-RPC message
          try {
            const jsonData = JSON.parse(event.payload.data);

            if (event.payload.type === "output") {
              // If it's a requestToolCallConfirmation input, store it for when the tool call is created
              if (jsonData.method === "requestToolCallConfirmation") {
                window.pendingToolCallInput = event.payload.data;
              }

              // If it's an updateToolCall input, store it for updating the tool call
              if (jsonData.method === "updateToolCall") {
                updateConversation(conversationId, (conv) => {
                  for (const msg of conv.messages) {
                    for (const msgPart of msg.parts) {
                      if (
                        msgPart.type === "toolCall" &&
                        msgPart.toolCall.id === jsonData.params!.toolCallId
                      ) {
                        msgPart.toolCall.outputJsonRpc = event.payload.data;
                      }
                    }
                  }
                });
              }
            }
          } catch {
            // Not JSON, ignore
          }
        }
      );

      // Listen for streaming text chunks.
      await api.listen<string>(`gemini-output-${conversationId}`, (event) => {
        updateConversation(conversationId, (conv, lastMsg) => {
          conv.isStreaming = true;
          if (lastMsg.sender === "assistant") {
            // There's an existing AI message.
            const lastPart = lastMsg.parts[lastMsg.parts.length - 1];
            if (lastPart?.type === "text") {
              lastPart.text += event.payload;
            } else {
              // Create a new text part.
              lastMsg.parts.push({
                type: "text",
                text: event.payload,
              });
            }
          } else {
            conv.messages.push({
              id: Date.now().toString(),
              sender: "assistant",
              timestamp: new Date(),
              parts: [
                {
                  type: "text",
                  text: event.payload,
                },
              ],
            });
          }
        });
      });

      // Listen for thinking chunks.
      await api.listen<string>(`gemini-thought-${conversationId}`, (event) => {
        updateConversation(conversationId, (conv, lastMsg) => {
          conv.isStreaming = true;
          if (lastMsg.sender === "assistant") {
            const lastPart = lastMsg.parts[lastMsg.parts.length - 1];
            if (lastPart?.type === "thinking") {
              lastPart.thinking += event.payload;
            } else {
              // Create a new text part.
              lastMsg.parts.push({
                type: "thinking",
                thinking: event.payload,
              });
            }
          } else {
            conv.messages.push({
              id: Date.now().toString(),
              sender: "assistant",
              timestamp: new Date(),
              parts: [
                {
                  type: "thinking",
                  thinking: event.payload,
                },
              ],
            });
          }
        });
      });

      // Listen for new tool calls being sent.
      await api.listen<ToolCallEvent>(
        `gemini-tool-call-${conversationId}`,
        ({ payload: { id, name, locations } }) => {
          updateConversation(conversationId, (conv, lastMsg) => {
            const newToolCall: ToolCall = {
              id: id.toString(),
              name,
              parameters: locations ? { locations } : {},
              status: "pending",
            };

            // Add tool call to the existing assistant message or create one if needed
            if (lastMsg.sender === "assistant") {
              lastMsg.parts.push({
                type: "toolCall",
                toolCall: newToolCall,
              });
            } else {
              conv.messages.push({
                id: Date.now().toString(),
                sender: "assistant",
                timestamp: new Date(),
                parts: [
                  {
                    type: "toolCall",
                    toolCall: newToolCall,
                  },
                ],
              });
            }
          });
        }
      );

      // Listen for updates to existing tool calls.
      await api.listen<ToolCallUpdateEvent>(
        `gemini-tool-call-update-${conversationId}`,
        ({ payload: { toolCallId, status, content } }) => {
          updateConversation(conversationId, (conv) => {
            for (const msg of conv.messages) {
              for (const msgPart of msg.parts) {
                if (
                  msgPart.type === "toolCall" &&
                  msgPart.toolCall.id === toolCallId.toString()
                ) {
                  // Split "finished" into "failed" or "completed".
                  if (status === "finished") {
                    msgPart.toolCall.status = isErrorResult(content)
                      ? "failed"
                      : "completed";
                    // Store the result content
                    if (content) {
                      msgPart.toolCall.result = content;
                    }
                  } else {
                    // Use the status directly.
                    msgPart.toolCall.status = status as ToolCall["status"];
                  }
                  return;
                }
              }
            }
          });
        }
      );

      // Also listen for errors
      await api.listen<string>(`gemini-error-${conversationId}`, (event) => {
        updateConversation(conversationId, (conv) => {
          conv.isStreaming = false;
          conv.messages.push({
            id: Date.now().toString(),
            parts: [
              {
                type: "text",
                text: `❌ **Error**: ${event.payload}`,
              },
            ],
            sender: "assistant",
            timestamp: new Date(),
          });
        });
      });

      // Listen for tool call confirmation requests
      await api.listen<ToolCallConfirmationRequest>(
        `gemini-tool-call-confirmation-${conversationId}`,
        (event) => {
          const toolCallId = event.payload.toolCallId || event.payload.requestId.toString();
          setConfirmationRequests(prev => {
            const newMap = new Map(prev);
            newMap.set(toolCallId, {
              ...event.payload,
              inputJsonRpc: window.pendingToolCallInput,
            });
            return newMap;
          });
        }
      );

      // Listen for turn finished events to stop streaming indicator
      await api.listen<boolean>(
        `gemini-turn-finished-${conversationId}`,
        () => {
          updateConversation(conversationId, (conv) => {
            conv.isStreaming = false;
          });
        }
      );
    } catch (error) {
      console.error(
        "Failed to set up event listener for conversation:",
        conversationId,
        error
      );
    }
  };

  const handleInputChange = (
    _event: React.ChangeEvent<HTMLInputElement> | null,
    newValue: string,
    _newPlainTextValue: string,
    _mentions: unknown[]
  ) => {
    setInput(newValue);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isCliInstalled) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      parts: [
        {
          type: "text",
          text: input,
        },
      ],
      sender: "user",
      timestamp: new Date(),
    };

    let convId: string;
    if (activeConversation) {
      convId = activeConversation;

      updateConversation(activeConversation, (conv) => {
        conv.messages.push(newMessage);
      });

      // Check if this is the 3rd user message and generate title
      const currentConv = conversations.find(
        (c) => c.id === activeConversation
      );
      if (currentConv) {
        const userMessageCount = currentConv.messages.filter(
          (msg) => msg.sender === "user"
        ).length;

        if (userMessageCount === 3) {
          // Generate title using all 3 user messages
          const userMessages = currentConv.messages
            .filter((msg) => msg.sender === "user")
            .map((msg) => msg.parts[0].text)
            .join(" | ");

          try {
            const generatedTitle = await api.invoke<string>(
              "generate_conversation_title",
              {
                message: userMessages,
                model: selectedModel,
              }
            );
            updateConversation(activeConversation, (conv) => {
              conv.title = generatedTitle;
            });
          } catch (error) {
            console.error("Failed to generate conversation title:", error);
          }
        }
      }
    } else {
      // Create a new conversation with this message.
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: input.slice(0, 50),
        messages: [newMessage],
        lastUpdated: new Date(),
        isStreaming: true,
      };
      setConversations((prev) => [...prev, newConversation]);
      setActiveConversation(newConversation.id);
      convId = newConversation.id;

      setupEventListenerForConversation(newConversation.id);
    }

    const messageText = input;
    setInput("");

    // Check if user is trying to use the disabled model.
    if (selectedModel === "gemini-2.5-flash-lite") {
      updateConversation(convId, (conv) => {
        conv.messages.push({
          id: (Date.now() + 1).toString(),
          parts: [
            {
              type: "text",
              text: "Unfortunately, Gemini 2.5 Flash-Lite isn't usable due to thinking issues. See issues [#1953](https://github.com/google-gemini/gemini-cli/issues/1953) and [#4548](https://github.com/google-gemini/gemini-cli/issues/4548) on the Gemini CLI repository for more details.  PRs [#3033](https://github.com/google-gemini/gemini-cli/pull/3033) and [#4652](https://github.com/google-gemini/gemini-cli/pull/4652) resolve this issue.",
            },
          ],
          sender: "assistant",
          timestamp: new Date(),
        });
      });
      return;
    }

    try {
      // Build conversation history for context - only include recent messages to avoid too long prompts.
      // TODO 08/01/2025: Fix this conversation history stuff.
      const recentMessages = currentConversation?.messages.slice(-10) || []; // Last 10 messages
      const history = recentMessages
        .map(
          (msg) =>
            `${msg.sender === "user" ? "User" : "Assistant"}: ${
              msg.parts[0]?.type === "text" ? msg.parts[0].text : ""
            }`
        )
        .join("\n");

      await api.invoke("send_message", {
        sessionId: convId,
        message: messageText,
        conversationHistory: history,
        model: selectedModel,
      });

      // Refresh process statuses after sending message
      await fetchProcessStatuses();
    } catch (error) {
      console.error("Failed to send message:", error);

      updateConversation(convId, (conv) => {
        conv.messages.push({
          id: (Date.now() + 1).toString(),
          parts: [{ type: "text", text: `❌ **Error:** ${error}` }],
          sender: "assistant",
          timestamp: new Date(),
        });
      });
    }
  };

  const handleConversationSelect = (conversationId: string) => {
    setActiveConversation(conversationId);
    setupEventListenerForConversation(conversationId);
  };

  const handleKillProcess = async (conversationId: string) => {
    try {
      await api.invoke("kill_process", { conversationId });
      // Refresh process statuses after killing
      await fetchProcessStatuses();
    } catch (error) {
      console.error("Failed to kill process:", error);
    }
  };

  const startNewConversation = async (title: string, workingDirectory?: string): Promise<string> => {
    const convId = Date.now().toString();
    
    // Create conversation in UI
    const newConversation: Conversation = {
      id: convId,
      title,
      messages: [],
      lastUpdated: new Date(),
      isStreaming: false,
    };
    
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversation(convId);
    
    // Initialize session with working directory if provided
    if (workingDirectory) {
      await api.invoke("start_session", { 
        sessionId: convId, 
        workingDirectory, 
        model: selectedModel 
      });
    }
    
    // Set up event listeners
    await setupEventListenerForConversation(convId);
    
    return convId;
  };



  const handleModelChange = (model: string) => {
    setSelectedModel(model);
  };

  const handleConfirmToolCall = async (toolCallId: string, outcome: string) => {
    const confirmationRequest = confirmationRequests.get(toolCallId);
    if (!confirmationRequest) return;

    try {
      await api.invoke("send_tool_call_confirmation_response", {
        sessionId: confirmationRequest.sessionId,
        requestId: confirmationRequest.requestId,
        toolCallId: toolCallId,
        outcome,
      });

      // If approved, update the tool call status in the UI
      if (outcome === "allow" || outcome.startsWith("alwaysAllow")) {
        updateConversation(activeConversation!, (conv) => {
          for (const msg of conv.messages) {
            for (const msgPart of msg.parts) {
              if (
                msgPart.type === "toolCall" &&
                msgPart.toolCall.id === toolCallId
              ) {
                msgPart.toolCall.status = "running";
                return;
              }
            }
          }
        });
      } else {
        // If rejected, mark as failed
        updateConversation(activeConversation!, (conv) => {
          for (const msg of conv.messages) {
            for (const msgPart of msg.parts) {
              if (
                msgPart.type === "toolCall" &&
                msgPart.toolCall.id === toolCallId
              ) {
                msgPart.toolCall.status = "failed";
                msgPart.toolCall.result = { markdown: "Tool call rejected by user" };
                return;
              }
            }
          }
        });
      }

      // Remove the confirmation request from the map
      setConfirmationRequests(prev => {
        const newMap = new Map(prev);
        newMap.delete(toolCallId);
        return newMap;
      });
    } catch (error) {
      console.error("Failed to send confirmation response:", error);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <ConversationList
        conversations={conversations as any}
        activeConversation={activeConversation}
        processStatuses={processStatuses}
        onConversationSelect={handleConversationSelect}
        onKillProcess={handleKillProcess}
        onModelChange={handleModelChange}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <div className="border-b border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 flex-shrink-0">
          <div className="px-6 py-4">
            <div className="flex items-center w-full">
              {/* Left section - Gemini Desktop Logo */}
              <div className="flex flex-1 items-center gap-1">
                <GeminiLogo />
                <span className="text-lg font-medium gradient-text-desktop">
                  Desktop
                </span>
              </div>

              {/* Right section - Piebald branding */}
              <div className="flex flex-1 flex-col items-end text-xs text-neutral-400">
                <p>From the creators of</p> <PiebaldLogo />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-background min-h-0">
          {selectedModel === "gemini-2.5-flash-lite" && (
            <div className="p-4">
              <Alert className="bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-700">
                <AlertTriangle className="!text-yellow-500 dark:!text-yellow-300" />
                <AlertTitle className="text-yellow-800 dark:text-yellow-300">
                  Model unavailable
                </AlertTitle>
                <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                  <p>
                    Unfortunately, Gemini 2.5 Flash-Lite isn't usable, due to
                    thinking issues. See here for more details:{" "}
                    <a
                      href="https://github.com/google-gemini/gemini-cli/issues/1953"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      #1953
                    </a>{" "}
                    and{" "}
                    <a
                      href="https://github.com/google-gemini/gemini-cli/issues/4548"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      #4548
                    </a>
                    . Waiting on PR{" "}
                    <a
                      href="https://github.com/google-gemini/gemini-cli/pull/3033"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      #3033
                    </a>
                    /
                    <a
                      href="https://github.com/google-gemini/gemini-cli/pull/4652"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      #4652
                    </a>
                    .
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          )}
          <ConversationContext.Provider value={{
            conversations,
            activeConversation,
            currentConversation,
            input,
            isCliInstalled,
            messagesContainerRef,
            cliIOLogs,
            handleInputChange,
            handleSendMessage,
            selectedModel,
            startNewConversation,
            handleConfirmToolCall,
            confirmationRequests,
          }}>
            <Outlet />
          </ConversationContext.Provider>
          
          {/* Message Input Bar - Only show when there's an active conversation with a running process */}
          {activeConversation && processStatuses.find(status => status.conversation_id === activeConversation && status.is_alive) && (
            <div className="sticky bottom-0 bg-white dark:bg-neutral-900 flex items-center border-t border-gray-200 dark:border-neutral-700">
              <div className="px-6 py-2 w-full">
                <div className="mx-auto">
                  <form
                    className="flex gap-3 items-end"
                    onSubmit={handleSendMessage}
                  >
                    <div className="flex-1 relative">
                    <MentionInput
                      value={input}
                      onChange={handleInputChange}
                      placeholder={
                        isCliInstalled === false
                          ? "Gemini CLI not found"
                          : "Type @ to mention files..."
                      }
                      disabled={isCliInstalled === false}
                      className="h-9 w-full"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      isCliInstalled === false ||
                      !input.trim()
                    }
                    size="icon"
                  >
                    <Send />
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        title="View CLI Input/Output"
                      >
                        <Info className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>CLI Input/Output Logs</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {cliIOLogs.map((log, index) => (
                            <div key={index} className="border rounded p-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span
                                  className={`text-xs font-mono px-2 py-1 rounded ${
                                    log.type === "input"
                                      ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                                      : "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                                  }`}
                                >
                                  {log.type === "input" ? "IN" : "OUT"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {log.timestamp.toLocaleTimeString()}
                                </span>
                                <span className="text-xs text-muted-foreground font-mono">
                                  {log.conversationId}
                                </span>
                              </div>
                              <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                                {log.data}
                              </pre>
                            </div>
                          ))}
                        {cliIOLogs.length === 0 && (
                          <div className="text-center text-muted-foreground py-8">
                            No CLI I/O logs available yet. Start a conversation
                            to see the raw communication.
                          </div>
                        )}
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    type="button"
                    disabled={true}
                    size="icon"
                    variant="outline"
                  >
                    <ImagePlus />
                  </Button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

function HomeDashboard() {
  const navigate = useNavigate();
  const {
    currentConversation,
    isCliInstalled,
    messagesContainerRef,
    handleConfirmToolCall,
    confirmationRequests,
  } = useConversation();

  return (
    <>
      {isCliInstalled === false && (
        <div className="p-4">
          <Alert
            variant="destructive"
            className="bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-700 text-red-300"
          >
            <AlertCircleIcon />
            <AlertTitle>Gemini CLI not found</AlertTitle>
            <AlertDescription className="dark:text-red-300">
              <p>
                <span>
                  Please install the Gemini CLI and make sure it's available
                  in your PATH. You can install it from{" "}
                </span>
                <a
                  href="https://github.com/google-gemini/gemini-cli"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  the official repository
                </a>
                .
              </p>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {currentConversation ? (
        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 overflow-y-auto p-6 relative"
        >
          <div className="space-y-8 pb-4 max-w-4xl mx-auto">
            {currentConversation.messages.map((message, index) => (
              <div
                key={message.id}
                className={`w-full ${
                  message.sender === "user" ? "flex justify-start" : ""
                }`}
              >
                <div className="w-full">
                  {/* Header with logo and timestamp */}
                  <div className="flex items-center gap-2 mb-4">
                    {message.sender === "assistant" ? (
                      <div>
                        <GeminiLogo />
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <div
                            className="size-5.5 flex items-center justify-center overflow-hidden rounded-full"
                            style={{
                              background:
                                "radial-gradient(circle, #346bf1 0%, #3186ff 50%, #4fa0ff 100%)",
                            }}
                          >
                            <UserRound className="size-4" />
                          </div>
                          User
                        </div>
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {message.parts.map((msgPart) =>
                    msgPart.type === "thinking" ? (
                      <ThinkingBlock thinking={msgPart.thinking} />
                    ) : msgPart.type === "text" ? (
                      /* Message Content */
                      <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                        <MessageContent
                          content={msgPart.text}
                          sender={message.sender}
                        />
                      </div>
                    ) : msgPart.type === "toolCall" ? (
                      <ToolCallDisplay 
                        toolCall={msgPart.toolCall}
                        hasConfirmationRequest={confirmationRequests.has(msgPart.toolCall.id)}
                        onConfirm={handleConfirmToolCall}
                      />
                    ) : null
                  )}

                  {currentConversation.isStreaming &&
                    index === currentConversation.messages.length - 1 && (
                      <div className="text-gray-400 italic text-xs">
                        <span className="animate-pulse">●</span>{" "}
                        Generating...
                      </div>
                    )}

                  {/* Info button for raw JSON */}
                  <div className="mt-2 flex justify-start">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Info className="h-3 w-3 mr-1" />
                          Raw JSON
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Message Raw JSON</DialogTitle>
                        </DialogHeader>
                        <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                          <pre className="text-xs whitespace-pre-wrap break-all font-mono">
                            {JSON.stringify(message, null, 2)}
                          </pre>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
          <div className="flex flex-row items-center mb-4 gap-2">
            <div className="flex flex-row items-center gap-2">
              <GeminiIcon />
              <GeminiText />
            </div>
            <span className="text-4xl font-medium gradient-text-desktop">
              Desktop
            </span>
          </div>

          <p className="text-muted-foreground mb-6">
            Your ideas for the future are just a click away.
          </p>

          {/* Dashboard tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
            {/* Gemini CLI Projects Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/projects")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Projects</CardTitle>
                  <CardDescription>Manage your projects, view past discussions.</CardDescription>
                </div>
              </CardHeader>
            </Card>
            <Card
              className="w-full opacity-60 cursor-not-allowed select-none"
              aria-disabled="true"
              onClick={(e) => e.preventDefault()}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <img src="modelcontextprotocol.svg" alt="Model Context Protocol" className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">MCP Servers</CardTitle>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">
                      Coming soon
                    </span>
                  </div>
                  <CardDescription>Manage MCP configuration and settings.</CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomeDashboard />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
