import React, { useState, useRef, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";
import { ArrowLeft, Send, Terminal, FileText, Download, Trash2, Paperclip } from "lucide-react";
import { NavigationMenu } from "../components/navigation/NavigationMenu";
import { ProjectLearning } from "../components/project/ProjectLearning";
import { FileUpload } from "../components/chat/FileUpload";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import { SettingsDialog } from "../components/chat/SettingsDialog";
import { useScreenshot } from "../hooks/useScreenshot";

interface ChatMessage {
  id: string;
  type: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  files?: FileItem[];
  image?: string;
}

interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
}

interface LogEntry {
  timestamp: Date;
  level: "info" | "error" | "debug";
  message: string;
}

interface ChatSettings {
  model: string;
  temperature: number;
  maxTokens: number;
  customModel: string;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [input, setInput] = useState("");
  const [workingDir, setWorkingDir] = useState(searchParams.get("path") || "");
  const [sessionId] = useState(() => Date.now().toString());
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "logs" | "learning">("chat");
  const [projectName] = useState(searchParams.get("project") || "");
  const [settings, setSettings] = useState<ChatSettings>({
    model: "gemini-2.5-flash",
    temperature: 0.7,
    maxTokens: 2048,
    customModel: ""
  });
  const [attachedFiles, setAttachedFiles] = useState<FileItem[]>([]);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [appSettings, setAppSettings] = useState({ enableDragDrop: true, enableScreenshot: true, enablePaste: true });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom(activeTab === "chat" ? messagesEndRef : logsEndRef);
  }, [messages, logs, activeTab]);

  useEffect(() => {
    const saved = localStorage.getItem('gemini-desktop-settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      setAppSettings({
        enableDragDrop: parsed.enableDragDrop ?? true,
        enableScreenshot: parsed.enableScreenshot ?? true,
        enablePaste: parsed.enablePaste ?? true
      });
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;

    const setupEventListeners = async () => {
      try {
        // Listen for Gemini output
        const unsubscribeOutput = await api.listen(`gemini-output-${sessionId}`, (event: { payload: { text: string } }) => {
          const response: ChatMessage = {
            id: Date.now().toString(),
            type: "assistant",
            content: event.payload.text,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, response]);
          addLog("info", `Received: ${event.payload.text.substring(0, 50)}...`);
        });

        // Listen for errors
        const unsubscribeError = await api.listen(`gemini-error-${sessionId}`, (event: { payload: { error: string } }) => {
          addLog("error", event.payload.error);
        });

        return () => {
          unsubscribeOutput();
          unsubscribeError();
        };
      } catch (error) {
        addLog("error", `Failed to setup event listeners: ${error}`);
      }
    };

    setupEventListeners();
  }, [isConnected, sessionId]);

  const addLog = (level: LogEntry["level"], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), level, message }]);
  };

  const startSession = async () => {
    try {
      const modelToUse = settings.model === "custom" ? settings.customModel : settings.model;
      await api.invoke("start_session", {
        sessionId,
        workingDirectory: workingDir || undefined,
        model: modelToUse
      });
      setIsConnected(true);
      addLog("info", `Started session with model ${modelToUse}`);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: "system",
        content: `Session started with ${modelToUse}${workingDir ? ` in ${workingDir}` : ""}`,
        timestamp: new Date()
      }]);
    } catch (error) {
      addLog("error", `Failed to start session: ${error}`);
    }
  };

  const sendMessage = async () => {
    if ((!input.trim() && attachedFiles.length === 0) || !isConnected) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setAttachedFiles([]);
    setShowFileUpload(false);
    addLog("info", `Sent: ${input}${attachedFiles.length > 0 ? ` (${attachedFiles.length} files)` : ''}`);

    try {
      let messageContent = input;
      if (attachedFiles.length > 0) {
        const fileContext = attachedFiles.map(f => 
          `File: ${f.name}${f.content ? `\n${f.content}` : ''}`
        ).join('\n\n');
        messageContent = `${input}\n\nAttached files:\n${fileContext}`;
      }

      await api.invoke("send_message", {
        sessionId,
        message: messageContent,
        conversationHistory: "",
        model: settings.model === "custom" ? settings.customModel : settings.model
      });
      
      const thinkingMessage: ChatMessage = {
        id: `thinking-${Date.now()}`,
        type: "system",
        content: "Thinking...",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, thinkingMessage]);
    } catch (error) {
      addLog("error", `Failed to send message: ${error}`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const exportLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp.toISOString()}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gemini-chat-logs-${sessionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setLogs([]);
    addLog("info", "Logs cleared");
  };

  const handleFilesAdded = (files: FileItem[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
    addLog("info", `Added ${files.length} file(s)`);
  };

  const handleFileRemoved = (fileId: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== fileId));
    addLog("info", "File removed");
  };

  const handleScreenshot = (imageData: string) => {
    const screenshotMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: "Screenshot captured",
      timestamp: new Date(),
      image: imageData
    };
    setMessages(prev => [...prev, screenshotMessage]);
    addLog("info", "Screenshot added to chat");
  };

  useScreenshot({
    onScreenshot: handleScreenshot,
    enabled: appSettings.enableScreenshot && appSettings.enablePaste
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 h-full flex flex-col">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span>Back to Home</span>
          </button>

          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <NavigationMenu />
              <div>
                <h1 className="text-3xl font-semibold tracking-tight">CLI Chat</h1>
                {projectName && <p className="text-sm text-muted-foreground">Project: {projectName}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? "default" : "secondary"}>
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <SettingsDialog
                settings={settings}
                onSettingsChange={setSettings}
                disabled={isConnected}
              />
            </div>
          </div>

          {/* Settings Panel */}
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Session Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Model</label>
                  <Input
                    value={settings.model === "custom" ? settings.customModel : settings.model}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Working Directory</label>
                  <Input
                    value={workingDir}
                    onChange={(e) => setWorkingDir(e.target.value)}
                    placeholder="/path/to/project"
                    disabled={isConnected}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={startSession} disabled={isConnected} className="w-full">
                    {isConnected ? "Session Active" : "Start Session"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4">
            <Button
              variant={activeTab === "chat" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("chat")}
            >
              <Terminal className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <Button
              variant={activeTab === "logs" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("logs")}
            >
              <FileText className="h-4 w-4 mr-2" />
              Logs ({logs.length})
            </Button>
            
            {projectName && (
              <Button
                variant={activeTab === "learning" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveTab("learning")}
              >
                <Terminal className="h-4 w-4 mr-2" />
                Learning
              </Button>
            )}
            
            {activeTab === "logs" && (
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={exportLogs} disabled={logs.length === 0}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={clearLogs} disabled={logs.length === 0}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Content Area */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardContent className="flex-1 flex flex-col p-4 min-h-0">
              {activeTab === "chat" ? (
                <>
                  <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-lg p-3 ${
                          message.type === "user" 
                            ? "bg-blue-500 text-white" 
                            : message.type === "system"
                            ? "bg-gray-100 text-gray-800"
                            : "bg-gray-50 text-gray-900"
                        }`}>
                          <div className="text-sm">{message.content}</div>
                          {message.image && (
                            <img src={message.image} alt="Screenshot" className="mt-2 max-w-full rounded" />
                          )}
                          {message.files && message.files.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {message.files.map(file => (
                                <div key={file.id} className="text-xs opacity-70 flex items-center gap-1">
                                  <Paperclip className="h-3 w-3" />
                                  {file.name}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  
                  <div className="space-y-2">
                    {showFileUpload && appSettings.enableDragDrop && (
                      <FileUpload
                        files={attachedFiles}
                        onFilesAdded={handleFilesAdded}
                        onFileRemoved={handleFileRemoved}
                        disabled={!isConnected}
                      />
                    )}
                    
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <Textarea
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Type your message... (Print Screen for screenshots, Ctrl+V to paste images)"
                          className="min-h-[60px] max-h-[120px] resize-none"
                          disabled={!isConnected}
                        />
                        {attachedFiles.length > 0 && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {attachedFiles.length} file(s) attached
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {appSettings.enableDragDrop && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowFileUpload(!showFileUpload)}
                            disabled={!isConnected}
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                        )}
                        <Button 
                          onClick={sendMessage} 
                          disabled={!isConnected || (!input.trim() && attachedFiles.length === 0)}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              ) : activeTab === "logs" ? (
                <div className="flex-1 overflow-y-auto">
                  <div className="space-y-2">
                    {logs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm font-mono">
                        <span className="text-xs text-muted-foreground min-w-[80px]">
                          {log.timestamp.toLocaleTimeString()}
                        </span>
                        <Badge 
                          variant={log.level === "error" ? "destructive" : log.level === "info" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {log.level}
                        </Badge>
                        <span className="flex-1">{log.message}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-4">
                  <ProjectLearning projectPath={workingDir} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}