import React from "react";
import { useNavigate } from "react-router-dom";
import { useConversation } from "../contexts/ConversationContext";
import { MessageContent } from "../components/conversation/MessageContent";
import { ThinkingBlock } from "../components/conversation/ThinkingBlock";
import { ToolCallDisplay } from "../components/common/ToolCallDisplay";
import { GeminiLogo } from "../components/branding/GeminiLogo";
import { GeminiIcon } from "../components/branding/GeminiIcon";
import { GeminiText } from "../components/branding/GeminiText";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { Info, UserRound, FolderKanban, Puzzle, Terminal, MessageSquare, FolderPlus, Palette, Cpu, Search, Store, Cloud, Activity, Layout, Zap } from "lucide-react";
import { ModelContextProtocol } from "@/components/common/ModelContextProtocol";
import { ToolCallConfirmationRequest } from "../utils/toolCallParser";

export const HomeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentConversation,
    messagesContainerRef,
    handleConfirmToolCall,
    confirmationRequests,
  } = useConversation();

  return (
    <>
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
                          isStreaming={
                            currentConversation?.isStreaming &&
                            index === currentConversation.messages.length - 1
                          }
                        />
                      </div>
                    ) : msgPart.type === "toolCall" ? (
                      <>
                        {(() => {
                          const hasConfirmation = confirmationRequests.has(
                            msgPart.toolCall.id
                          );
                          const confirmationRequest = confirmationRequests.get(
                            msgPart.toolCall.id
                          );

                          // Force type assertion to debug the issue
                          const confirmationRequestTyped =
                            confirmationRequest as
                              | ToolCallConfirmationRequest
                              | undefined;
                          console.log(
                            "🎨 Rendering tool call in HomeDashboard:",
                            {
                              toolCallId: msgPart.toolCall.id,
                              toolCallName: msgPart.toolCall.name,
                              hasConfirmation,
                              confirmationRequestExists: !!confirmationRequest,
                              confirmationMapSize: confirmationRequests.size,
                              confirmationMapKeys: Array.from(
                                confirmationRequests.keys()
                              ),
                              confirmationType:
                                confirmationRequest?.confirmation?.type,
                              // Debug the actual confirmation request object
                              confirmationRequestRaw: confirmationRequest,
                              confirmationContentExists:
                                !!confirmationRequest?.content,
                              confirmationContentType:
                                confirmationRequest?.content?.type,
                            }
                          );

                          console.log(
                            "🔥 About to pass confirmationRequest to ToolCallDisplay:",
                            confirmationRequest
                          );
                          console.log(
                            "🔥 Typed version:",
                            confirmationRequestTyped
                          );

                          // Try with explicit undefined check
                          const finalConfirmationRequest = confirmationRequest
                            ? confirmationRequest
                            : undefined;
                          console.log(
                            "🔥 Final confirmation request:",
                            finalConfirmationRequest
                          );

                          return (
                            <ToolCallDisplay
                              key={`${msgPart.toolCall.id}-${hasConfirmation}-${Date.now()}`}
                              toolCall={msgPart.toolCall}
                              hasConfirmationRequest={hasConfirmation}
                              confirmationRequest={finalConfirmationRequest}
                              confirmationRequests={confirmationRequests}
                              onConfirm={handleConfirmToolCall}
                            />
                          );
                        })()}
                      </>
                    ) : null
                  )}

                  {currentConversation.isStreaming &&
                    index === currentConversation.messages.length - 1 && (
                      <div className="text-gray-400 italic text-xs">
                        <span className="animate-pulse">●</span> Generating...
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl">
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
                  <CardDescription>
                    Manage your projects, view past discussions.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/servers")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <ModelContextProtocol className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">ACP Servers</CardTitle>
                  <CardDescription>
                    Manage your Agent Communication Protocol (ACP) server
                    configurations.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Extensions Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/extensions")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Puzzle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Extensions & Tools</CardTitle>
                  <CardDescription>
                    Browse and manage available extensions and tools.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Command Builder Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/command-builder")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Terminal className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Command Builder</CardTitle>
                  <CardDescription>
                    Build and customize Gemini CLI commands with templates.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* CLI Chat Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/chat")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">CLI Chat</CardTitle>
                  <CardDescription>
                    Interactive chat with Gemini CLI, logs, and settings.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* File Browser Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/files")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">File Browser</CardTitle>
                  <CardDescription>
                    Navigate and explore files and directories.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Project Builder Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/project-builder")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <FolderPlus className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Project Builder</CardTitle>
                  <CardDescription>
                    AI-powered project initialization and development.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Model Manager Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/model-manager")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Cpu className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Model Manager</CardTitle>
                  <CardDescription>
                    Discover and manage AI models from various sources.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* MCP Browser Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/mcp-browser")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">MCP Browser</CardTitle>
                  <CardDescription>
                    Discover and explore Model Context Protocol servers.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Theme Builder Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/theme-builder")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Palette className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Theme Builder</CardTitle>
                  <CardDescription>
                    Create and customize your own themes with live preview.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Marketplace Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/marketplace")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Store className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Marketplace</CardTitle>
                  <CardDescription>
                    Browse and install extensions, themes, and commands.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* AWS Toolkit Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/aws-toolkit")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Cloud className="h-5 w-5 text-orange-500" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">AWS Toolkit</CardTitle>
                  <CardDescription>
                    Integrated AWS development tools and services.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* System Monitor Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/system-monitor")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">System Monitor</CardTitle>
                  <CardDescription>
                    Monitor model performance, resource usage, and throttling.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Layout Customizer Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/layout-customizer")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Layout className="h-5 w-5 text-purple-500" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Layout Customizer</CardTitle>
                  <CardDescription>
                    Customize UI layout, move panels, and personalize workspace.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Task Manager Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/task-manager")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-red-500" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Task Manager</CardTitle>
                  <CardDescription>
                    Kill stuck processes and discover network agents.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
            
            {/* Settings Card */}
            <Card
              className="cursor-pointer transition-colors hover:bg-accent w-full"
              onClick={() => navigate("/settings")}
            >
              <CardHeader className="flex flex-row items-center gap-3">
                <div className="shrink-0 h-6 w-6 flex items-center justify-center">
                  <Terminal className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">Settings</CardTitle>
                  <CardDescription>
                    Configure application settings and preferences.
                  </CardDescription>
                </div>
              </CardHeader>
            </Card>
          </div>
        </div>
      )}
    </>
  );
};
