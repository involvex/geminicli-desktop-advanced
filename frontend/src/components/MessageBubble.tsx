import React from "react";
import { MessageHeader } from "./MessageHeader";
import { MessageContent } from "./MessageContent";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallsList } from "./ToolCallsList";
import { MessageActions } from "./MessageActions";
import { type ToolCall } from "../utils/toolCallParser";

interface Message {
  id: string;
  content: string;
  sender: "user" | "assistant";
  timestamp: Date;
  toolCalls?: ToolCall[];
  thinking?: string;
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  isLastMessage?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isStreaming = false,
  isLastMessage = false,
}) => {
  return (
    <div
      key={message.id}
      className={`w-full ${
        message.sender === "user" ? "flex justify-start" : ""
      }`}
    >
      {message.sender === "assistant" && (
        <div className="w-full">
          <MessageHeader
            sender={message.sender}
            timestamp={message.timestamp}
          />

          {message.thinking && <ThinkingBlock thinking={message.thinking} />}

          <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
            <MessageContent content={message.content} sender={message.sender} />
            {message.content.length === 0 && isStreaming && isLastMessage && (
              <div className="text-gray-400 italic text-xs">
                <span className="animate-pulse">●</span> Streaming...
              </div>
            )}
            {isStreaming && isLastMessage && message.content.length > 0 && (
              <span className="animate-pulse text-blue-500 ml-2">●</span>
            )}
          </div>

          {/* 
            Show tool calls if they exist and there's at least one.
            TODO 08/01/2025: I think there will always be a `toolCalls` object...
          */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <ToolCallsList toolCalls={message.toolCalls} />
          )}

          <MessageActions message={message} />
        </div>
      )}

      {message.sender === "user" && (
        <div className="w-full">
          <MessageHeader
            sender={message.sender}
            timestamp={message.timestamp}
          />

          <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
            <MessageContent content={message.content} sender={message.sender} />
            {message.content.length === 0 && (
              <div className="text-gray-400 italic text-xs">
                <span className="animate-pulse">●</span>{" "}
                Streaming...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};