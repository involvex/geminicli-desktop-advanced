import { useState, useRef, useCallback } from "react";
import { Routes, Route, Outlet, Navigate } from "react-router-dom";
import { api } from "./lib/api";
import { AppSidebar } from "./components/layout/AppSidebar";
import { MessageInputBar } from "./components/conversation/MessageInputBar";
import { AppHeader } from "./components/layout/AppHeader";
import { AppFooter } from "./components/layout/AppFooter";
import { CliWarnings } from "./components/common/CliWarnings";
import { SidebarInset } from "./components/ui/sidebar";
import { ConversationContext } from "./contexts/ConversationContext";
import { HomeDashboard } from "./pages/HomeDashboard";
import ProjectsPage from "./pages/Projects";
import ProjectDetailPage from "./pages/ProjectDetail";
import ServersPage from "./pages/Servers";
import ExtensionsPage from "./pages/Extensions";
import CommandBuilderPage from "./pages/CommandBuilder";
import ChatPage from "./pages/Chat";
import FileBrowserPage from "./pages/FileBrowser";
import SettingsPage from "./pages/Settings";
import ProjectBuilderPage from "./pages/ProjectBuilder";
import McpBrowserPage from "./pages/McpBrowser";
import ThemeBuilderPage from "./pages/ThemeBuilder";
import ModelManagerPage from "./pages/ModelManager";
import MarketplacePage from "./pages/Marketplace";
import AWSToolkitPage from "./pages/AwsToolkit";
import SystemMonitorPage from "./pages/SystemMonitor";
import LayoutCustomizerPage from "./pages/LayoutCustomizer";
import TaskManagerPage from "./pages/TaskManager";
import { PersistentChat } from "./components/chat/PersistentChat";

// Hooks
import { useConversationManager } from "./hooks/useConversationManager";
import { useProcessManager } from "./hooks/useProcessManager";
import { useMessageHandler } from "./hooks/useMessageHandler";
import { useToolCallConfirmation } from "./hooks/useToolCallConfirmation";
import { useConversationEvents } from "./hooks/useConversationEvents";
import { useCliInstallation } from "./hooks/useCliInstallation";
import { CliIO } from "./types";
import "./index.css";
import "./styles/themes.css";

function RootLayout() {
  const [selectedModel, setSelectedModel] =
    useState<string>("gemini-2.5-flash");
  const [cliIOLogs, setCliIOLogs] = useState<CliIO[]>([]);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Custom hooks for cleaner code
  const isCliInstalled = useCliInstallation();

  const {
    conversations,
    activeConversation,
    currentConversation,
    setActiveConversation,
    updateConversation,
    createNewConversation,
  } = useConversationManager();

  const { processStatuses, fetchProcessStatuses, handleKillProcess } =
    useProcessManager();

  const {
    confirmationRequests,
    setConfirmationRequests,
    handleConfirmToolCall,
  } = useToolCallConfirmation({
    activeConversation,
    updateConversation,
  });

  const { setupEventListenerForConversation } = useConversationEvents(
    setCliIOLogs,
    setConfirmationRequests,
    updateConversation
  );

  const { input, handleInputChange, handleSendMessage } = useMessageHandler({
    activeConversation,
    currentConversation,
    conversations,
    selectedModel,
    isCliInstalled,
    updateConversation,
    createNewConversation,
    setActiveConversation,
    setupEventListenerForConversation,
    fetchProcessStatuses,
  });

  const handleConversationSelect = useCallback(
    (conversationId: string) => {
      setActiveConversation(conversationId);
      setupEventListenerForConversation(conversationId);
    },
    [setActiveConversation, setupEventListenerForConversation]
  );

  const handleModelChange = useCallback((model: string) => {
    setSelectedModel(model);
  }, []);

  const startNewConversation = useCallback(
    async (title: string, workingDirectory?: string): Promise<string> => {
      const convId = Date.now().toString();
      createNewConversation(convId, title, [], false);
      setActiveConversation(convId);

      if (workingDirectory) {
        await api.invoke("start_session", {
          sessionId: convId,
          workingDirectory,
          model: selectedModel,
        });
      }

      await setupEventListenerForConversation(convId);
      return convId;
    },
    [
      selectedModel,
      createNewConversation,
      setActiveConversation,
      setupEventListenerForConversation,
    ]
  );

  return (
    <AppSidebar
      conversations={conversations}
      activeConversation={activeConversation}
      processStatuses={processStatuses}
      onConversationSelect={handleConversationSelect}
      onKillProcess={handleKillProcess}
      onModelChange={handleModelChange}
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
    >
      <SidebarInset>
        <AppHeader />

        <div className="flex-1 flex flex-col bg-background min-h-0 pb-12">
          <CliWarnings
            selectedModel={selectedModel}
            isCliInstalled={isCliInstalled}
          />

          <ConversationContext.Provider
            value={{
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
            }}
          >
            <Outlet />
          </ConversationContext.Provider>

          {activeConversation &&
            processStatuses.find(
              (status) =>
                status.conversation_id === activeConversation && status.is_alive
            ) && (
              <MessageInputBar
                input={input}
                isCliInstalled={isCliInstalled}
                cliIOLogs={cliIOLogs}
                handleInputChange={handleInputChange}
                handleSendMessage={handleSendMessage}
                selectedModel={selectedModel}
              />
            )}
        </div>
        <AppFooter />
      </SidebarInset>
      <PersistentChat />
    </AppSidebar>
  );
}

function App() {
  return (
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomeDashboard />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="servers" element={<ServersPage />} />
        <Route path="extensions" element={<ExtensionsPage />} />
        <Route path="command-builder" element={<CommandBuilderPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="files" element={<FileBrowserPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="project-builder" element={<ProjectBuilderPage />} />
        <Route path="mcp-browser" element={<McpBrowserPage />} />
        <Route path="theme-builder" element={<ThemeBuilderPage />} />
        <Route path="model-manager" element={<ModelManagerPage />} />
        <Route path="marketplace" element={<MarketplacePage />} />
        <Route path="aws-toolkit" element={<AWSToolkitPage />} />
        <Route path="system-monitor" element={<SystemMonitorPage />} />
        <Route path="layout-customizer" element={<LayoutCustomizerPage />} />
        <Route path="task-manager" element={<TaskManagerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
