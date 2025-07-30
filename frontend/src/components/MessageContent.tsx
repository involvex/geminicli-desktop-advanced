import React from "react";
import { MarkdownRenderer } from "./MarkdownRenderer";

interface MessageContentProps {
  content: string;
  sender: "user" | "assistant";
}

export const MessageContent = React.memo(({ content }: MessageContentProps) => {
  return <MarkdownRenderer>{content}</MarkdownRenderer>;
});

MessageContent.displayName = "MessageContent";
