import { useCallback } from "react";
import { api } from "../lib/api";
import { getWebSocketManager } from "../lib/webApi";
import { 
  Conversation, 
  Message, 
  CliIO, 
  ToolCallConfirmationRequest,
  ToolCallEvent,
  ToolCallUpdateEvent 
} from "../types";
import { type ToolCall } from "../utils/toolCallParser";
import { isErrorResult } from "../utils/helpers";

export const useConversationEvents = (
  setCliIOLogs: React.Dispatch<React.SetStateAction<CliIO[]>>,
  setConfirmationRequests: React.Dispatch<React.SetStateAction<Map<string, ToolCallConfirmationRequest>>>,
  updateConversation: (
    conversationId: string,
    updateFn: (conv: Conversation, lastMsg: Message) => void
  ) => void
) => {
  const setupEventListenerForConversation = useCallback(async (
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
        ({ payload: { id, name, locations, label, icon } }) => {
          updateConversation(conversationId, (conv, lastMsg) => {
            const newToolCall: ToolCall = {
              id: id.toString(),
              name,
              parameters: locations ? { locations } : {},
              status: "pending",
              ...(label && { label }),
              ...(icon && { icon }),
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
                    msgPart.toolCall.status = isErrorResult(content) ? "failed" : "completed";
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
  }, [setCliIOLogs, setConfirmationRequests, updateConversation]);

  return { setupEventListenerForConversation };
};