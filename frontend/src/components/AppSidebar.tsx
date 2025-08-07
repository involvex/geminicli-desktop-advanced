import React from "react"
import { ConversationList } from "./ConversationList"
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarTrigger,
} from "./ui/sidebar"

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

interface AppSidebarProps {
  conversations: Conversation[];
  activeConversation: string | null;
  processStatuses: ProcessStatus[];
  onConversationSelect: (conversationId: string) => void;
  onKillProcess: (conversationId: string) => void;
  onModelChange?: (model: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function AppSidebar({
  conversations,
  activeConversation,
  processStatuses,
  onConversationSelect,
  onKillProcess,
  onModelChange,
  open,
  onOpenChange,
  children,
}: AppSidebarProps) {
  return (
    <SidebarProvider defaultOpen={true} open={open} onOpenChange={onOpenChange}>
      <Sidebar side="left" collapsible="offcanvas">
        <SidebarContent className="p-0">
          <ConversationList
            conversations={conversations}
            activeConversation={activeConversation}
            processStatuses={processStatuses}
            onConversationSelect={onConversationSelect}
            onKillProcess={onKillProcess}
            onModelChange={onModelChange}
          />
        </SidebarContent>
      </Sidebar>
      {children}
    </SidebarProvider>
  );
}

export { SidebarTrigger };