import React from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageContentProps {
  content: string;
  sender: "user" | "assistant";
  isStreaming?: boolean;
}

export const MessageContent = React.memo(
  ({ content, isStreaming = false }: MessageContentProps) => {
    return (
      <MarkdownRenderer isStreaming={isStreaming}>{content}</MarkdownRenderer>
    );
  }
);

MessageContent.displayName = "MessageContent";
