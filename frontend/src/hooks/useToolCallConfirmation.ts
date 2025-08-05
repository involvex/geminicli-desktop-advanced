import { useState, useCallback } from "react";
import { api } from "../lib/api";
import { ToolCallConfirmationRequest, Conversation, Message } from "../types";

interface UseToolCallConfirmationProps {
  activeConversation: string | null;
  updateConversation: (
    conversationId: string,
    updateFn: (conv: Conversation, lastMsg: Message) => void
  ) => void;
}

export const useToolCallConfirmation = ({
  activeConversation,
  updateConversation,
}: UseToolCallConfirmationProps) => {
  const [confirmationRequests, setConfirmationRequests] = useState<
    Map<string, ToolCallConfirmationRequest>
  >(new Map());

  const handleConfirmToolCall = useCallback(async (
    toolCallId: string,
    outcome: string
  ) => {
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
  }, [confirmationRequests, activeConversation, updateConversation]);

  return {
    confirmationRequests,
    setConfirmationRequests,
    handleConfirmToolCall,
  };
};