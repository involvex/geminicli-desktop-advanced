import { useState, useCallback } from "react";
import { Conversation, Message } from "../types";

export const useConversationManager = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(
    null
  );

  const currentConversation = conversations.find(
    (c) => c.id === activeConversation
  );

  const updateConversation = useCallback(
    (
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
    },
    []
  );

  const createNewConversation = useCallback(
    (
      id: string,
      title: string,
      messages: Message[] = [],
      isStreaming = false
    ) => {
      const newConversation: Conversation = {
        id,
        title,
        messages,
        lastUpdated: new Date(),
        isStreaming,
      };
      setConversations((prev) => [newConversation, ...prev]);
      // Note: Don't set active conversation here, let the caller do it
      return newConversation;
    },
    []
  );

  return {
    conversations,
    activeConversation,
    currentConversation,
    setActiveConversation,
    updateConversation,
    createNewConversation,
    setConversations,
  };
};
