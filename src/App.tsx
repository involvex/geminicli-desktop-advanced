import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
import { ToolCallDisplay } from "./components/ToolCallDisplay";
import { ThinkingBlock } from "./components/ThinkingBlock";
import { ConversationList } from "./components/ConversationList";
import { GeminiLogo } from "./components/GeminiLogo";
import { PiebaldLogo } from "./components/PiebaldLogo";
import { MentionInput } from "./components/MentionInput";
import { type ToolCall } from "./utils/toolCallParser";
import { Send, ImagePlus, Info, Check, X, AlertCircleIcon } from "lucide-react";
import "./index.css";

interface Message {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
  toolCalls?: ToolCall[];
  thinking?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
}

interface CliIO {
  timestamp: Date;
  type: "input" | "output";
  data: string;
  conversationId: string;
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
  locations: any[];
  inputJsonRpc?: string;
}

// Helper function to detect if a tool call result indicates an error
function isErrorResult(content: any): boolean {
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

  // If content has markdown field (like in the example)
  if (content.markdown) {
    const markdown = content.markdown.toLowerCase();
    return errorIndicators.some((indicator) => markdown.includes(indicator));
  }

  // If content is a string
  if (typeof content === "string") {
    const contentStr = content.toLowerCase();
    return errorIndicators.some((indicator) => contentStr.includes(indicator));
  }

  // If content has an error field
  if (content.error || content.stderr) {
    return true;
  }

  return false;
}

// Simple character-level diff function
function createCharDiff(oldText: string, newText: string) {
  const oldChars = oldText.split("");
  const newChars = newText.split("");

  // Simple LCS-based diff implementation
  const dp: number[][] = [];
  for (let i = 0; i <= oldChars.length; i++) {
    dp[i] = [];
    for (let j = 0; j <= newChars.length; j++) {
      if (i === 0) dp[i][j] = j;
      else if (j === 0) dp[i][j] = i;
      else if (oldChars[i - 1] === newChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  // Backtrack to find the diff
  const oldDiff: Array<{ char: string; type: "same" | "removed" }> = [];
  const newDiff: Array<{ char: string; type: "same" | "added" }> = [];

  let i = oldChars.length;
  let j = newChars.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
      oldDiff.unshift({ char: oldChars[i - 1], type: "same" });
      newDiff.unshift({ char: newChars[j - 1], type: "same" });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
      newDiff.unshift({ char: newChars[j - 1], type: "added" });
      j--;
    } else if (i > 0) {
      oldDiff.unshift({ char: oldChars[i - 1], type: "removed" });
      i--;
    }
  }

  return { oldDiff, newDiff };
}

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null
  );
  const [input, setInput] = useState("");
  const [isCliInstalled, setIsCliInstalled] = useState<boolean | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [processStatuses, setProcessStatuses] = useState<any[]>([]);
  const [cliIOLogs, setCliIOLogs] = useState<CliIO[]>([]);
  const [confirmationRequest, setConfirmationRequest] =
    useState<ToolCallConfirmationRequest | null>(null);
  const [workingDirectory, setWorkingDirectory] = useState<string>("");
  const [isWorkingDirectoryValid, setIsWorkingDirectoryValid] =
    useState<boolean>(false);
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");
  const currentConversation = conversations.find(
    (c) => c.id === activeConversation
  );

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
      const installed = await invoke<boolean>("check_cli_installed");
      setIsCliInstalled(installed);
    } catch (error) {
      console.error("Failed to check CLI installation:", error);
      setIsCliInstalled(false);
    }
  };

  const fetchProcessStatuses = async () => {
    try {
      const statuses = await invoke<any[]>("get_process_statuses");
      setProcessStatuses(statuses);
    } catch (error) {
      console.error("Failed to fetch process statuses:", error);
    }
  };

  const setupEventListenerForConversation = async (conversationId: string) => {
    try {
      // Listen for CLI I/O logs
      await listen<{ type: "input" | "output"; data: string }>(
        `cli-io-${conversationId}`,
        (event) => {
          const newLog: CliIO = {
            timestamp: new Date(),
            type: event.payload.type,
            data: event.payload.data,
            conversationId,
          };
          setCliIOLogs((prev) => [...prev, newLog]);

          // Check if this is a tool call related JSON-RPC message
          try {
            const jsonData = JSON.parse(event.payload.data);

            // If it's a requestToolCallConfirmation input, store it for when the tool call is created
            if (
              event.payload.type === "output" &&
              jsonData.method === "requestToolCallConfirmation"
            ) {
              console.log("📥 Storing input JSON-RPC for tool call:", jsonData);
              // Store the input JSON-RPC data temporarily - we'll associate it with the tool call when it's created
              (window as any).pendingToolCallInput = event.payload.data;
            }

            // If it's an updateToolCall input, store it for updating the tool call
            if (
              event.payload.type === "output" &&
              jsonData.method === "updateToolCall"
            ) {
              console.log(
                "📤 Storing output JSON-RPC for tool call:",
                jsonData
              );
              // Update tool calls with output JSON-RPC data
              const toolCallId = jsonData.params?.toolCallId;
              if (toolCallId) {
                setConversations((prev) =>
                  prev.map((conv) => {
                    if (conv.id === conversationId) {
                      return {
                        ...conv,
                        messages: conv.messages.map((msg) => {
                          if (msg.toolCalls) {
                            const updatedToolCalls = msg.toolCalls.map((tc) => {
                              if (tc.id === toolCallId.toString()) {
                                return {
                                  ...tc,
                                  outputJsonRpc: event.payload.data,
                                };
                              }
                              return tc;
                            });

                            return {
                              ...msg,
                              toolCalls: updatedToolCalls,
                            };
                          }
                          return msg;
                        }),
                      };
                    }
                    return conv;
                  })
                );
              }
            }
          } catch (e) {
            // Not JSON, ignore
          }
        }
      );

      // Listen for streaming text chunks
      await listen<string>(`gemini-output-${conversationId}`, (event) => {
        console.log("📝 TEXT CHUNK:", conversationId, event.payload);

        // Add the chunk to the conversation (real-time streaming)
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === conversationId) {
              // Check if the last message is from assistant and append chunk to it
              const lastMessage = conv.messages[conv.messages.length - 1];
              if (lastMessage && lastMessage.sender === "assistant") {
                return {
                  ...conv,
                  messages: conv.messages.map((msg, index) =>
                    index === conv.messages.length - 1
                      ? { ...msg, content: msg.content + event.payload }
                      : msg
                  ),
                  lastUpdated: new Date(),
                };
              } else {
                // Create new assistant message
                const newMessage: Message = {
                  id: Date.now().toString(),
                  content: event.payload,
                  sender: "assistant",
                  timestamp: new Date(),
                };
                return {
                  ...conv,
                  messages: [...conv.messages, newMessage],
                  lastUpdated: new Date(),
                };
              }
            }
            return conv;
          })
        );
      });

      // Listen for thinking chunks
      await listen<string>(`gemini-thought-${conversationId}`, (event) => {
        console.log(
          "Received gemini thought for conversation:",
          conversationId,
          event.payload
        );

        // Add the thinking to the last assistant message
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === conversationId) {
              const lastMessage = conv.messages[conv.messages.length - 1];
              if (lastMessage && lastMessage.sender === "assistant") {
                return {
                  ...conv,
                  messages: conv.messages.map((msg, index) =>
                    index === conv.messages.length - 1
                      ? {
                          ...msg,
                          thinking: (msg.thinking || "") + event.payload,
                        }
                      : msg
                  ),
                  lastUpdated: new Date(),
                };
              } else {
                // Create new assistant message with thinking
                const newMessage: Message = {
                  id: Date.now().toString(),
                  content: "",
                  sender: "assistant",
                  timestamp: new Date(),
                  thinking: event.payload,
                };
                return {
                  ...conv,
                  messages: [...conv.messages, newMessage],
                  lastUpdated: new Date(),
                };
              }
            }
            return conv;
          })
        );
      });

      // Listen for tool call events
      await listen<any>(`gemini-tool-call-${conversationId}`, (event) => {
        console.log("🔧 TOOL CALL EVENT:", conversationId, event.payload);

        // Debug: Log current conversation state
        setConversations((prev) => {
          const conv = prev.find((c) => c.id === conversationId);
          if (conv) {
            const lastMessage = conv.messages[conv.messages.length - 1];
            console.log("🔧 Current last message:", {
              sender: lastMessage?.sender,
              contentLength: lastMessage?.content?.length || 0,
              content: lastMessage?.content || "NO CONTENT",
              hasToolCalls: !!lastMessage?.toolCalls?.length,
            });
          }
          return prev;
        });

        const toolCallData = event.payload;
        const toolCall: ToolCall = {
          id: toolCallData.id.toString(),
          name: toolCallData.name,
          parameters: toolCallData.locations
            ? { locations: toolCallData.locations }
            : {},
          status: "pending",
        };

        // Add tool call to the existing assistant message or create one if needed
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === conversationId) {
              const lastMessage = conv.messages[conv.messages.length - 1];

              // If the last message is from assistant, add the tool call to it
              if (lastMessage && lastMessage.sender === "assistant") {
                console.log(
                  "🔧 Adding tool call to existing assistant message:",
                  toolCall
                );

                return {
                  ...conv,
                  messages: conv.messages.map((msg, index) =>
                    index === conv.messages.length - 1
                      ? {
                          ...msg,
                          toolCalls: [...(msg.toolCalls || []), toolCall],
                        }
                      : msg
                  ),
                  lastUpdated: new Date(),
                };
              } else {
                // Create new assistant message if the last one isn't from assistant
                const newMessage: Message = {
                  id: Date.now().toString(),
                  content: "",
                  sender: "assistant",
                  timestamp: new Date(),
                  toolCalls: [toolCall],
                };

                console.log(
                  "🔧 Creating new message for tool call:",
                  newMessage
                );

                return {
                  ...conv,
                  messages: [...conv.messages, newMessage],
                  lastUpdated: new Date(),
                };
              }
            }
            return conv;
          })
        );
      });

      // Listen for tool call updates
      await listen<any>(
        `gemini-tool-call-update-${conversationId}`,
        (event) => {
          console.log("🔄 TOOL CALL UPDATE:", conversationId, event.payload);

          const updateData = event.payload;

          // Update the tool call status
          setConversations((prev) =>
            prev.map((conv) => {
              if (conv.id === conversationId) {
                return {
                  ...conv,
                  messages: conv.messages.map((msg) => {
                    if (msg.toolCalls) {
                      const updatedToolCalls = msg.toolCalls.map((tc) => {
                        // Match by ID, or if no exact match, match the first running tool call
                        const shouldUpdate =
                          tc.id === updateData.toolCallId.toString() ||
                          (updateData.toolCallId === "unknown" &&
                            tc.status === "running") ||
                          tc.status === "running"; // Fallback: update any running tool call

                        console.log("🔍 Tool call matching:", {
                          tcId: tc.id,
                          updateId: updateData.toolCallId.toString(),
                          tcStatus: tc.status,
                          shouldUpdate,
                        });

                        if (shouldUpdate) {
                          const newStatus =
                            updateData.status === "finished"
                              ? isErrorResult(updateData.content)
                                ? "failed"
                                : "completed"
                              : updateData.status;

                          console.log("🔧 Updating tool call:", {
                            from: tc.status,
                            to: newStatus,
                            content: updateData.content,
                          });

                          return {
                            ...tc,
                            status: newStatus,
                            result: updateData.content,
                          };
                        }

                        return tc;
                      });

                      return {
                        ...msg,
                        toolCalls: updatedToolCalls,
                      };
                    }
                    return msg;
                  }),
                  lastUpdated: new Date(),
                };
              }
              return conv;
            })
          );
        }
      );

      // Also listen for errors
      await listen<string>(`gemini-error-${conversationId}`, (event) => {
        console.error(
          "Received gemini error for conversation:",
          conversationId,
          event.payload
        );

        // Add error message to the conversation
        setConversations((prev) =>
          prev.map((conv) => {
            if (conv.id === conversationId) {
              const errorMessage: Message = {
                id: Date.now().toString(),
                content: `❌ **Error**: ${event.payload}`,
                sender: "assistant",
                timestamp: new Date(),
              };
              return {
                ...conv,
                messages: [...conv.messages, errorMessage],
                lastUpdated: new Date(),
              };
            }
            return conv;
          })
        );
      });

      // Listen for tool call confirmation requests
      await listen<ToolCallConfirmationRequest>(
        `gemini-tool-call-confirmation-${conversationId}`,
        (event) => {
          console.log(
            "🔍 Tool call confirmation request for conversation:",
            conversationId,
            event.payload
          );
          // Associate the pending input JSON-RPC with this confirmation request
          const confirmationWithInput = {
            ...event.payload,
            inputJsonRpc: (window as any).pendingToolCallInput,
          };
          setConfirmationRequest(confirmationWithInput);
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
    _event: any,
    newValue: string,
    _newPlainTextValue: string,
    _mentions: any[]
  ) => {
    setInput(newValue);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isCliInstalled) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };

    let conversationId = activeConversation;

    if (activeConversation) {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === activeConversation
            ? {
                ...conv,
                messages: [...conv.messages, newMessage],
                lastUpdated: new Date(),
              }
            : conv
        )
      );
      conversationId = activeConversation;

      // Check if this is the 3rd user message and generate title
      const currentConv = conversations.find(
        (c) => c.id === activeConversation
      );
      if (currentConv) {
        const userMessageCount = [...currentConv.messages, newMessage].filter(
          (msg) => msg.sender === "user"
        ).length;

        if (userMessageCount === 3) {
          // Generate title using all 3 user messages
          const userMessages = [...currentConv.messages, newMessage]
            .filter((msg) => msg.sender === "user")
            .map((msg) => msg.content)
            .join(" | ");

          try {
            const generatedTitle = await invoke<string>(
              "generate_conversation_title",
              {
                message: userMessages,
                model: selectedModel,
              }
            );

            setConversations((prev) =>
              prev.map((conv) =>
                conv.id === activeConversation
                  ? { ...conv, title: generatedTitle }
                  : conv
              )
            );
          } catch (error) {}
        } else {
        }
      } else {
      }
    } else {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: input.slice(0, 50),
        messages: [newMessage],
        lastUpdated: new Date(),
      };
      setConversations((prev) => [...prev, newConversation]);
      setActiveConversation(newConversation.id);
      conversationId = newConversation.id;

      // Set up event listener for this conversation
      setupEventListenerForConversation(conversationId);
    }

    const messageText = input;
    setInput("");

    try {
      // Send message with conversation context (like claudia does)
      if (conversationId) {
        // Build conversation history for context - only include recent messages to avoid too long prompts
        const recentMessages = currentConversation?.messages.slice(-10) || []; // Last 10 messages
        const history = recentMessages
          .map(
            (msg) =>
              `${msg.sender === "user" ? "User" : "Assistant"}: ${msg.content}`
          )
          .join("\n");

        await invoke("send_message", {
          sessionId: conversationId,
          message: messageText,
          conversationHistory: history,
          workingDirectory: isWorkingDirectoryValid ? workingDirectory : null,
          model: selectedModel,
        });

        // Refresh process statuses after sending message
        await fetchProcessStatuses();
      }
    } catch (error) {
      console.error("Failed to send message:", error);

      // Add error message to conversation
      if (conversationId) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `Error: ${error}`,
          sender: "assistant",
          timestamp: new Date(),
        };

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === conversationId
              ? {
                  ...conv,
                  messages: [...conv.messages, errorMessage],
                  lastUpdated: new Date(),
                }
              : conv
          )
        );
      }
    }
  };

  const handleConversationSelect = (conversationId: string) => {
    setActiveConversation(conversationId);
    setupEventListenerForConversation(conversationId);
  };

  const handleKillProcess = async (conversationId: string) => {
    try {
      await invoke("kill_process", { conversationId });
      // Refresh process statuses after killing
      await fetchProcessStatuses();
      console.log(
        "Successfully killed process for conversation:",
        conversationId
      );
    } catch (error) {
      console.error("Failed to kill process:", error);
    }
  };

  const handleWorkingDirectoryChange = (
    directory: string,
    isValid: boolean
  ) => {
    setWorkingDirectory(directory);
    setIsWorkingDirectoryValid(isValid);
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
  };

  const handleConfirmToolCall = async (outcome: string) => {
    if (!confirmationRequest) return;

    const toolCallId =
      confirmationRequest.toolCallId ||
      confirmationRequest.requestId.toString();

    console.log("🔄 Sending confirmation response:", {
      sessionId: confirmationRequest.sessionId,
      requestId: confirmationRequest.requestId,
      toolCallId: toolCallId,
      outcome,
      originalRequest: confirmationRequest,
    });

    try {
      await invoke("send_tool_call_confirmation_response", {
        sessionId: confirmationRequest.sessionId,
        requestId: confirmationRequest.requestId,
        toolCallId: toolCallId,
        outcome,
      });

      // If approved, create a tool call in the UI to show it's running
      if (outcome === "allow" || outcome.startsWith("alwaysAllow")) {
        const toolCall: ToolCall = {
          id: toolCallId,
          name: confirmationRequest.confirmation.command
            ? "execute_command"
            : "unknown_tool",
          parameters: {
            command: confirmationRequest.confirmation.command,
          },
          status: "running",
          inputJsonRpc: confirmationRequest.inputJsonRpc || undefined,
        };

        console.log(
          "✅ Creating tool call with ID:",
          toolCallId,
          "for command:",
          confirmationRequest.confirmation.command
        );

        // Add tool call to the current conversation
        setConversations((prev) => {
          const updatedConversations = prev.map((conv) => {
            if (conv.id === confirmationRequest.sessionId) {
              const lastMessage = conv.messages[conv.messages.length - 1];

              console.log("📝 Last message before adding tool call:", {
                sender: lastMessage?.sender,
                hasToolCalls: !!lastMessage?.toolCalls,
                toolCallsCount: lastMessage?.toolCalls?.length || 0,
              });

              // If the last message is from assistant, add the tool call to it
              if (lastMessage && lastMessage.sender === "assistant") {
                const updatedConv = {
                  ...conv,
                  messages: conv.messages.map((msg, index) =>
                    index === conv.messages.length - 1
                      ? {
                          ...msg,
                          toolCalls: [...(msg.toolCalls || []), toolCall],
                        }
                      : msg
                  ),
                  lastUpdated: new Date(),
                };

                console.log(
                  "📝 Added tool call to existing message. New tool calls count:",
                  updatedConv.messages[updatedConv.messages.length - 1]
                    .toolCalls?.length
                );

                return updatedConv;
              } else {
                // Create new assistant message with the tool call
                const newMessage: Message = {
                  id: Date.now().toString(),
                  content: "",
                  sender: "assistant",
                  timestamp: new Date(),
                  toolCalls: [toolCall],
                };

                console.log(
                  "📝 Created new message with tool call:",
                  newMessage
                );

                return {
                  ...conv,
                  messages: [...conv.messages, newMessage],
                  lastUpdated: new Date(),
                };
              }
            }
            return conv;
          });

          console.log(
            "📝 Updated conversations:",
            updatedConversations
              .find((c) => c.id === confirmationRequest.sessionId)
              ?.messages.slice(-1)
          );
          return updatedConversations;
        });
      }

      setConfirmationRequest(null);
    } catch (error) {
      console.error("Failed to send confirmation response:", error);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <ConversationList
        conversations={conversations}
        activeConversation={activeConversation}
        processStatuses={processStatuses}
        onConversationSelect={handleConversationSelect}
        onKillProcess={handleKillProcess}
        onWorkingDirectoryChange={handleWorkingDirectoryChange}
        onModelChange={handleModelChange}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          <div className="px-6 py-4">
            <div className="flex items-center w-full">
              {/* Left section - Gemini Desktop Logo */}
              <div className="flex flex-1 items-center gap-0.5">
                <GeminiLogo />
                <span className="text-lg font-medium text-blue-600 pt-2">
                  Desktop
                </span>
              </div>

              {/* Right section - Piebald branding */}
              <div className="flex flex-1 flex-col items-end text-xs text-gray-400">
                <p>From the creators of</p> <PiebaldLogo />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-background min-h-0">
          {isCliInstalled === true && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircleIcon />
                <AlertTitle>Gemini CLI not found</AlertTitle>
                <AlertDescription className="text-destructive">
                  <div className="flex flex-row">
                    <div className="mr-1">
                      Please install the Gemini CLI and make sure it's available
                      in your PATH. You can install it from
                    </div>
                    <a
                      href="https://github.com/google-gemini/gemini-cli"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-4"
                    >
                      the official repository
                    </a>
                    .
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          )}
          {currentConversation ? (
            <div
              ref={messagesContainerRef}
              className="flex-1 min-h-0 overflow-y-auto p-6 relative"
            >
              <div className="space-y-4 pb-4 max-w-4xl mx-auto">
                {currentConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`w-full ${
                      message.sender === "user" ? "flex justify-end" : ""
                    }`}
                  >
                    {message.sender === "assistant" && (
                      <div className="w-full">
                        {/* Header with logo and timestamp */}
                        <div className="flex items-center gap-2 mb-1 pb-2">
                          <div className="pb-2">
                            <GeminiLogo />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {/* Thinking Block */}
                        {message.thinking && (
                          <ThinkingBlock thinking={message.thinking} />
                        )}

                        {/* Message Content */}
                        <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                          <MessageContent
                            content={message.content}
                            sender={message.sender}
                          />
                          {message.content.length === 0 && (
                            <div className="text-gray-400 italic text-xs">
                              <span className="animate-pulse">●</span>{" "}
                              Streaming...
                            </div>
                          )}
                        </div>

                        {/* Render tool calls if present */}
                        {message.toolCalls &&
                          message.toolCalls.map((toolCall) => (
                            <ToolCallDisplay
                              key={toolCall.id}
                              toolCall={toolCall}
                            />
                          ))}

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
                    )}

                    {message.sender === "user" && (
                      <div className="max-w-[70%]">
                        <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-2 text-sm text-gray-900 dark:text-gray-100 mb-1">
                          <MessageContent
                            content={message.content}
                            sender={message.sender}
                          />
                        </div>
                        <div className="flex justify-end">
                          <span className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <h1 className="text-3xl font-bold text-foreground mb-4">
                Welcome to Gemini Desktop
              </h1>
              <p className="text-muted-foreground">
                Start a new conversation to begin chatting with Gemini.
              </p>
            </div>
          )}

          <div className="sticky bottom-0 bg-white dark:bg-gray-900">
            {/* Input area */}
            <div className="px-6 pb-6">
              <div className="max-w-4xl mx-auto">
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
                      className="h-8"
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
                    disabled={isCliInstalled === false || !input.trim()}
                    size="icon"
                    className="bg-blue-600 hover:bg-blue-700"
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
                        <Info />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>CLI Input/Output Log</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                        {cliIOLogs
                          .filter(
                            (log) =>
                              !activeConversation ||
                              log.conversationId === activeConversation
                          )
                          .map((log, index) => (
                            <div
                              key={index}
                              className={`p-3 rounded-lg border ${
                                log.type === "input"
                                  ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
                                  : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
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
                        {cliIOLogs.filter(
                          (log) =>
                            !activeConversation ||
                            log.conversationId === activeConversation
                        ).length === 0 && (
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
        </div>
      </div>

      {/* Tool Call Confirmation Dialog */}
      {confirmationRequest && (
        <Dialog
          open={!!confirmationRequest}
          onOpenChange={() => setConfirmationRequest(null)}
        >
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                {confirmationRequest.label}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {confirmationRequest.confirmation.type === "execute" ? (
                <div>
                  <div className="text-sm text-muted-foreground mb-3">
                    The assistant wants to execute the following terminal
                    command:
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    <div className="font-mono text-sm font-medium text-green-600 dark:text-green-400">
                      {confirmationRequest.confirmation.command}
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>⚠️ Security Notice:</strong> Only commands from a
                      predefined safe list can be executed. Dangerous operations
                      like file deletion, system modification, or network
                      requests are blocked.
                    </div>
                  </div>
                </div>
              ) : confirmationRequest.content ? (
                <div>
                  <div className="text-sm text-muted-foreground">
                    The assistant wants to{" "}
                    {confirmationRequest.content.type === "diff"
                      ? "write to"
                      : "modify"}{" "}
                    the following file:
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                    <div className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                      {confirmationRequest.content.path}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  The assistant wants to perform an action.
                </div>
              )}

              {confirmationRequest.content &&
                confirmationRequest.content.type === "diff" &&
                confirmationRequest.confirmation.type !== "execute" && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Changes:</div>

                    {(() => {
                      const { oldDiff, newDiff } = createCharDiff(
                        confirmationRequest.content.oldText || "",
                        confirmationRequest.content.newText || ""
                      );

                      return (
                        <>
                          {/* Old content with character-level diff */}
                          {confirmationRequest.content.oldText &&
                            confirmationRequest.content.oldText.length > 0 && (
                              <div>
                                <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">
                                  - Removed:
                                </div>
                                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                                  <pre className="text-xs whitespace-pre-wrap break-all font-mono text-red-700 dark:text-red-300">
                                    {oldDiff.map((item, index) => (
                                      <span
                                        key={index}
                                        className={
                                          item.type === "removed"
                                            ? "bg-red-200 dark:bg-red-800/50"
                                            : ""
                                        }
                                      >
                                        {item.char}
                                      </span>
                                    ))}
                                  </pre>
                                </div>
                              </div>
                            )}

                          {/* New content with character-level diff */}
                          <div>
                            <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">
                              + Added:
                            </div>
                            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                              <pre className="text-xs whitespace-pre-wrap break-all font-mono text-green-700 dark:text-green-300">
                                {newDiff.map((item, index) => (
                                  <span
                                    key={index}
                                    className={
                                      item.type === "added"
                                        ? "bg-green-200 dark:bg-green-800/50"
                                        : ""
                                    }
                                  >
                                    {item.char}
                                  </span>
                                ))}
                              </pre>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

              <div className="flex flex-col gap-3 pt-4">
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => handleConfirmToolCall("reject")}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Deny
                  </Button>
                  <Button
                    onClick={() => handleConfirmToolCall("allow")}
                    className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4" />
                    Allow Once
                  </Button>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleConfirmToolCall("alwaysAllow")}
                    className="text-xs"
                  >
                    Always Allow (Session)
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleConfirmToolCall("alwaysAllowTool")}
                    className="text-xs"
                  >
                    Always Allow Tool
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default App;
