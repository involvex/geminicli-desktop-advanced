import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Button } from "./components/ui/button";
import { Alert, AlertDescription } from "./components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./components/ui/dialog";
import { MessageContent } from "./components/MessageContent";
import { ToolCallDisplay } from "./components/ToolCallDisplay";
import { ThinkingBlock } from "./components/ThinkingBlock";
import { ConversationList } from "./components/ConversationList";
import { GeminiLogo } from "./components/GeminiLogo";
import { PiebaldLogo } from "./components/PiebaldLogo";
import { MentionInput } from "./components/MentionInput";
import { type ToolCall } from "./utils/toolCallParser";
import { Send, ChevronDown, ImagePlus, Info, Check, X } from "lucide-react";
import "./index.css";
import { SplitrailLogo } from "./components/SplitrailLogo";

interface Message {
  id: string;
  content: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
  toolCalls?: ToolCall[];
  thinking?: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
}

interface CliIO {
  timestamp: Date;
  type: 'input' | 'output';
  data: string;
  conversationId: string;
}

interface ToolCallConfirmationRequest {
  requestId: number;
  sessionId: string;
  label: string;
  icon: string;
  content: {
    type: string;
    path: string;
    oldText: string;
    newText: string;
  };
  confirmation: {
    type: string;
  };
  locations: any[];
}

// Simple character-level diff function
function createCharDiff(oldText: string, newText: string) {
  const oldChars = oldText.split('');
  const newChars = newText.split('');
  
  // Simple LCS-based diff implementation
  const dp: number[][] = [];
  for (let i = 0; i <= oldChars.length; i++) {
    dp[i] = [];
    for (let j = 0; j <= newChars.length; j++) {
      if (i === 0) dp[i][j] = j;
      else if (j === 0) dp[i][j] = i;
      else if (oldChars[i - 1] === newChars[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  // Backtrack to find the diff
  const oldDiff: Array<{char: string, type: 'same' | 'removed'}> = [];
  const newDiff: Array<{char: string, type: 'same' | 'added'}> = [];
  
  let i = oldChars.length;
  let j = newChars.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldChars[i - 1] === newChars[j - 1]) {
      oldDiff.unshift({char: oldChars[i - 1], type: 'same'});
      newDiff.unshift({char: newChars[j - 1], type: 'same'});
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] <= dp[i - 1][j])) {
      newDiff.unshift({char: newChars[j - 1], type: 'added'});
      j--;
    } else if (i > 0) {
      oldDiff.unshift({char: oldChars[i - 1], type: 'removed'});
      i--;
    }
  }
  
  return { oldDiff, newDiff };
}

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isCliInstalled, setIsCliInstalled] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [processStatuses, setProcessStatuses] = useState<any[]>([]);
  const [cliIOLogs, setCliIOLogs] = useState<CliIO[]>([]);
  const [confirmationRequest, setConfirmationRequest] = useState<ToolCallConfirmationRequest | null>(null);
  const currentConversation = conversations.find(c => c.id === activeConversation);

  useEffect(() => {
    checkCliInstallation();
    fetchProcessStatuses();
    
    // Poll for process status updates every 2 seconds
    const interval = setInterval(() => {
      fetchProcessStatuses();
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);


  // Auto-scroll to bottom when new messages arrive (if enabled)
  useEffect(() => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentConversation?.messages, shouldAutoScroll]);

  // Detect manual scrolling to disable auto-scroll
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px threshold
      setShouldAutoScroll(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [currentConversation?.id]);

  const checkCliInstallation = async () => {
    try {
      const installed = await invoke<boolean>('check_cli_installed');
      setIsCliInstalled(installed);
    } catch (error) {
      console.error('Failed to check CLI installation:', error);
      setIsCliInstalled(false);
    }
  };

  const fetchProcessStatuses = async () => {
    try {
      const statuses = await invoke<any[]>('get_process_statuses');
      setProcessStatuses(statuses);
    } catch (error) {
      console.error('Failed to fetch process statuses:', error);
    }
  };


  const setupEventListenerForConversation = async (conversationId: string) => {
    try {
      // Listen for CLI I/O logs
      await listen<{type: 'input' | 'output', data: string}>(`cli-io-${conversationId}`, (event) => {
        const newLog: CliIO = {
          timestamp: new Date(),
          type: event.payload.type,
          data: event.payload.data,
          conversationId
        };
        setCliIOLogs(prev => [...prev, newLog]);
      });

      // Listen for streaming text chunks
      await listen<string>(`gemini-output-${conversationId}`, (event) => {
        console.log('📝 TEXT CHUNK:', conversationId, event.payload);

        // Add the chunk to the conversation (real-time streaming)
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversationId) {
            // Check if the last message is from assistant and append chunk to it
            const lastMessage = conv.messages[conv.messages.length - 1];
            if (lastMessage && lastMessage.sender === 'assistant') {
              return {
                ...conv,
                messages: conv.messages.map((msg, index) =>
                  index === conv.messages.length - 1
                    ? { ...msg, content: msg.content + event.payload }
                    : msg
                ),
                lastUpdated: new Date()
              };
            } else {
              // Create new assistant message
              const newMessage: Message = {
                id: Date.now().toString(),
                content: event.payload,
                sender: 'assistant',
                timestamp: new Date()
              };
              return {
                ...conv,
                messages: [...conv.messages, newMessage],
                lastUpdated: new Date()
              };
            }
          }
          return conv;
        }));
      });

      // Listen for thinking chunks
      await listen<string>(`gemini-thought-${conversationId}`, (event) => {
        console.log('Received gemini thought for conversation:', conversationId, event.payload);

        // Add the thinking to the last assistant message
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversationId) {
            const lastMessage = conv.messages[conv.messages.length - 1];
            if (lastMessage && lastMessage.sender === 'assistant') {
              return {
                ...conv,
                messages: conv.messages.map((msg, index) =>
                  index === conv.messages.length - 1
                    ? { ...msg, thinking: (msg.thinking || '') + event.payload }
                    : msg
                ),
                lastUpdated: new Date()
              };
            } else {
              // Create new assistant message with thinking
              const newMessage: Message = {
                id: Date.now().toString(),
                content: '',
                sender: 'assistant',
                timestamp: new Date(),
                thinking: event.payload
              };
              return {
                ...conv,
                messages: [...conv.messages, newMessage],
                lastUpdated: new Date()
              };
            }
          }
          return conv;
        }));
      });

      // Listen for tool call events
      await listen<any>(`gemini-tool-call-${conversationId}`, (event) => {
        console.log('🔧 TOOL CALL EVENT:', conversationId, event.payload);
        
        // Debug: Log current conversation state
        setConversations(prev => {
          const conv = prev.find(c => c.id === conversationId);
          if (conv) {
            const lastMessage = conv.messages[conv.messages.length - 1];
            console.log('🔧 Current last message:', {
              sender: lastMessage?.sender,
              contentLength: lastMessage?.content?.length || 0,
              content: lastMessage?.content || 'NO CONTENT',
              hasToolCalls: !!lastMessage?.toolCalls?.length
            });
          }
          return prev;
        });
        
        const toolCallData = event.payload;
        const toolCall: ToolCall = {
          id: toolCallData.id.toString(),
          name: toolCallData.name,
          parameters: toolCallData.locations ? { locations: toolCallData.locations } : {},
          status: 'pending'
        };

        // Add tool call to the existing assistant message or create one if needed
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversationId) {
            const lastMessage = conv.messages[conv.messages.length - 1];
            
            // If the last message is from assistant, add the tool call to it
            if (lastMessage && lastMessage.sender === 'assistant') {
              console.log('🔧 Adding tool call to existing assistant message:', toolCall);
              
              return {
                ...conv,
                messages: conv.messages.map((msg, index) =>
                  index === conv.messages.length - 1
                    ? { 
                        ...msg, 
                        toolCalls: [...(msg.toolCalls || []), toolCall] 
                      }
                    : msg
                ),
                lastUpdated: new Date()
              };
            } else {
              // Create new assistant message if the last one isn't from assistant
              const newMessage: Message = {
                id: Date.now().toString(),
                content: '',
                sender: 'assistant',
                timestamp: new Date(),
                toolCalls: [toolCall]
              };
              
              console.log('🔧 Creating new message for tool call:', newMessage);
              
              return {
                ...conv,
                messages: [...conv.messages, newMessage],
                lastUpdated: new Date()
              };
            }
          }
          return conv;
        }));
      });

      // Listen for tool call updates
      await listen<any>(`gemini-tool-call-update-${conversationId}`, (event) => {
        console.log('Received tool call update for conversation:', conversationId, event.payload);
        
        const updateData = event.payload;
        
        // Update the tool call status
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversationId) {
            return {
              ...conv,
              messages: conv.messages.map(msg => {
                if (msg.toolCalls) {
                  return {
                    ...msg,
                    toolCalls: msg.toolCalls.map(tc => 
                      tc.id === updateData.toolCallId.toString()
                        ? {
                          ...tc,
                          status: updateData.status === 'finished' ? 'completed' : updateData.status,
                          result: updateData.content
                        }
                        : tc
                    )
                  };
                }
                return msg;
              }),
              lastUpdated: new Date()
            };
          }
          return conv;
        }));
      });


      // Also listen for errors
      await listen<string>(`gemini-error-${conversationId}`, (event) => {
        console.error('Received gemini error for conversation:', conversationId, event.payload);

        // Add error message to the conversation
        setConversations(prev => prev.map(conv => {
          if (conv.id === conversationId) {
            const errorMessage: Message = {
              id: Date.now().toString(),
              content: `❌ **Error**: ${event.payload}`,
              sender: 'assistant',
              timestamp: new Date()
            };
            return {
              ...conv,
              messages: [...conv.messages, errorMessage],
              lastUpdated: new Date()
            };
          }
          return conv;
        }));
      });

      // Listen for tool call confirmation requests
      await listen<ToolCallConfirmationRequest>(`gemini-tool-call-confirmation-${conversationId}`, (event) => {
        console.log('🔍 Tool call confirmation request for conversation:', conversationId, event.payload);
        setConfirmationRequest(event.payload);
      });
    } catch (error) {
      console.error('Failed to set up event listener for conversation:', conversationId, error);
    }
  };

  const handleInputChange = (_event: any, newValue: string, _newPlainTextValue: string, _mentions: any[]) => {
    setInput(newValue);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !isCliInstalled) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: 'user',
      timestamp: new Date()
    };

    let conversationId = activeConversation;

    if (activeConversation) {
      setConversations(prev => prev.map(conv =>
        conv.id === activeConversation
          ? { ...conv, messages: [...conv.messages, newMessage], lastUpdated: new Date() }
          : conv
      ));
      conversationId = activeConversation;
    } else {
      const newConversation: Conversation = {
        id: Date.now().toString(),
        title: "Generating title...",
        messages: [newMessage],
        lastUpdated: new Date()
      };
      setConversations(prev => [...prev, newConversation]);
      setActiveConversation(newConversation.id);
      conversationId = newConversation.id;

      // Generate title using Gemini CLI flash lite
      try {
        const generatedTitle = await invoke<string>('generate_conversation_title', { message: input });
        setConversations(prev => prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, title: generatedTitle }
            : conv
        ));
      } catch (error) {
        console.error('Failed to generate title:', error);
        // Fallback to truncated input
        setConversations(prev => prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, title: input.slice(0, 50) }
            : conv
        ));
      }

      // Set up event listener for this conversation
      setupEventListenerForConversation(conversationId);
    }

    const messageText = input;
    setInput("");
    setShouldAutoScroll(true);

    try {
      // Send message with conversation context (like claudia does)
      if (conversationId) {
        // Build conversation history for context - only include recent messages to avoid too long prompts
        const recentMessages = currentConversation?.messages.slice(-10) || []; // Last 10 messages
        const history = recentMessages
          .map(msg => `${msg.sender === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n');

        await invoke('send_message', {
          sessionId: conversationId,
          message: messageText,
          conversationHistory: history
        });
        
        // Refresh process statuses after sending message
        await fetchProcessStatuses();
      }
    } catch (error) {
      console.error('Failed to send message:', error);

      // Add error message to conversation
      if (conversationId) {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `Error: ${error}`,
          sender: 'assistant',
          timestamp: new Date()
        };

        setConversations(prev => prev.map(conv =>
          conv.id === conversationId
            ? { ...conv, messages: [...conv.messages, errorMessage], lastUpdated: new Date() }
            : conv
        ));
      }
    }
  };

  const handleConversationSelect = (conversationId: string) => {
    setActiveConversation(conversationId);
    setupEventListenerForConversation(conversationId);
  };

  const handleKillProcess = async (conversationId: string) => {
    try {
      await invoke('kill_process', { conversationId });
      // Refresh process statuses after killing
      await fetchProcessStatuses();
      console.log('Successfully killed process for conversation:', conversationId);
    } catch (error) {
      console.error('Failed to kill process:', error);
    }
  };

  const handleConfirmToolCall = async (confirmed: boolean) => {
    if (!confirmationRequest) return;

    try {
      await invoke('send_tool_call_confirmation_response', {
        sessionId: confirmationRequest.sessionId,
        requestId: confirmationRequest.requestId,
        confirmed
      });
      setConfirmationRequest(null);
    } catch (error) {
      console.error('Failed to send confirmation response:', error);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <ConversationList
        conversations={conversations}
        activeConversation={activeConversation}
        processStatuses={processStatuses}
        onConversationSelect={handleConversationSelect}
        onKillProcess={handleKillProcess}
      />
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        <div className="px-6 py-4">
          <div className="flex items-center w-full">
            {/* Left section - Gemini Desktop Logo */}
            <div className="flex flex-1 items-center gap-0.5">
              <GeminiLogo />
              <span className="text-lg font-medium text-blue-600 pt-2">Desktop</span>
            </div>

            {/* Center section - Buttons and Model Info - Aligned with message container */}
            <div className="max-w-4xl w-full flex items-center justify-between">
              {/* Left - Buttons */}
              <div className="flex items-center gap-2">
                <Button className="flex items-center gap-2 font-medium text-base bg-blue-600 hover:bg-blue-700 text-white">
                  piebald
                  <ChevronDown className="h-4 w-4" />
                </Button>

                <span className="text-gray-400 mx-1">/</span>

                <Button className="flex items-center gap-2 font-medium text-base bg-blue-600 hover:bg-blue-700 text-white">
                  Friendly Greeting
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>

              {/* Right - Model info */}
              <div className="text-gray-500 dark:text-gray-400 font-mono text-sm">
                gemini-2.5-flash-lite
              </div>
            </div>

            {/* Right section - Piebald branding */}
            <div className="flex flex-1 flex-col items-end text-xs text-gray-400">
              <div className="flex items-center gap-1">
                From the creators of <PiebaldLogo />
                and <SplitrailLogo />
              </div>
              <div>Copyright 2025 Piebald LLC</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-background min-h-0">
        {isCliInstalled === false && (
          <Alert className="m-4 border-destructive bg-destructive/10">
            <AlertDescription className="text-destructive">
              <strong>⚠️ Gemini CLI not found!</strong> Please install the gemini CLI and make sure it's available in your PATH. You can install it from{' '}
              <a href="https://github.com/google/generative-ai-go/tree/main/genai/cli" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">
                the official repository
              </a>.
            </AlertDescription>
          </Alert>
        )}
        {currentConversation ? (
          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-6 relative">
            <div className="space-y-4 pb-4 max-w-4xl mx-auto">
              {currentConversation.messages.map(message => (
                <div key={message.id} className={`w-full ${message.sender === 'user' ? 'flex justify-end' : ''}`}>
                  {message.sender === 'assistant' && (
                    <div className="w-full">
                      {/* Header with logo and timestamp */}
                      <div className="flex items-center gap-2 mb-1 pb-2">
                        <div className="pb-2">
                          <GeminiLogo />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Thinking Block */}
                      {message.thinking && (
                        <ThinkingBlock thinking={message.thinking} />
                      )}

                      {/* Message Content */}
                      <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                        <MessageContent content={message.content} sender={message.sender} />
                        {message.content.length === 0 && (
                          <div className="text-gray-400 italic text-xs">
                            <span className="animate-pulse">●</span> Streaming...
                          </div>
                        )}
                      </div>

                      {/* Render tool calls if present */}
                      {message.toolCalls && message.toolCalls.map(toolCall => (
                        <ToolCallDisplay key={toolCall.id} toolCall={toolCall} />
                      ))}

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
                  )}

                  {message.sender === 'user' && (
                    <div className="max-w-[70%]">
                      <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl px-4 py-2 text-sm text-gray-900 dark:text-gray-100 mb-1">
                        <MessageContent content={message.content} sender={message.sender} />
                      </div>
                      <div className="flex justify-end">
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            {/* Auto-scroll indicator */}
            {!shouldAutoScroll && (
              <div className="absolute bottom-20 right-4">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setShouldAutoScroll(true);
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="shadow-lg"
                >
                  ↓ Scroll to bottom
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
            <h1 className="text-3xl font-bold text-foreground mb-4">Welcome to Gemini Desktop</h1>
            <p className="text-muted-foreground">Start a new conversation to begin chatting with Gemini.</p>
          </div>
        )}

        <div className="sticky bottom-0 bg-white dark:bg-gray-900">

          {/* Input area */}
          <div className="px-6 pb-6">
            <div className="max-w-4xl mx-auto">
              <form className="flex gap-3 items-end" onSubmit={handleSendMessage}>
                <div className="flex-1 relative">
                  <MentionInput
                    value={input}
                    onChange={handleInputChange}
                    placeholder={isCliInstalled === false ? "Gemini CLI not found" : "Type @ to mention files..."}
                    disabled={isCliInstalled === false}
                    className="h-8"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isCliInstalled === false || !input.trim()}
                  size="icon"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send />
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      title="View CLI Input/Output"
                    >
                      <Info />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>CLI Input/Output Log</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {cliIOLogs
                        .filter(log => !activeConversation || log.conversationId === activeConversation)
                        .map((log, index) => (
                        <div key={index} className={`p-3 rounded-lg border ${
                          log.type === 'input' 
                            ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' 
                            : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`text-xs font-mono px-2 py-1 rounded ${
                              log.type === 'input' 
                                ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' 
                                : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            }`}>
                              {log.type === 'input' ? 'IN' : 'OUT'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {log.timestamp.toLocaleTimeString()}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {log.conversationId}
                            </span>
                          </div>
                          <pre className="text-xs whitespace-pre-wrap break-all font-mono bg-white dark:bg-gray-900 p-2 rounded border">
                            {log.data}
                          </pre>
                        </div>
                      ))}
                      {cliIOLogs.filter(log => !activeConversation || log.conversationId === activeConversation).length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                          No CLI I/O logs available yet. Start a conversation to see the raw communication.
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
                <Button
                  type="button"
                  disabled={true}
                  size="icon"
                  variant="outline"
                >
                  <ImagePlus />
                </Button>
              </form>
            </div>
          </div>
        </div>
        </div>
      </div>

      {/* Tool Call Confirmation Dialog */}
      {confirmationRequest && (
        <Dialog open={!!confirmationRequest} onOpenChange={() => setConfirmationRequest(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                {confirmationRequest.label}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                The assistant wants to {confirmationRequest.content.type === 'diff' ? 'write to' : 'modify'} the following file:
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg">
                <div className="font-mono text-sm font-medium text-blue-600 dark:text-blue-400">
                  {confirmationRequest.content.path}
                </div>
              </div>

              {confirmationRequest.content.type === 'diff' && (
                <div className="space-y-3">
                  <div className="text-sm font-medium">Changes:</div>
                  
                  {(() => {
                    const { oldDiff, newDiff } = createCharDiff(
                      confirmationRequest.content.oldText, 
                      confirmationRequest.content.newText
                    );
                    
                    return (
                      <>
                        {/* Old content with character-level diff */}
                        {confirmationRequest.content.oldText && (
                          <div>
                            <div className="text-xs text-red-600 dark:text-red-400 font-medium mb-1">- Removed:</div>
                            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                              <pre className="text-xs whitespace-pre-wrap break-all font-mono text-red-700 dark:text-red-300">
                                {oldDiff.map((item, index) => (
                                  <span
                                    key={index}
                                    className={item.type === 'removed' ? 'bg-red-200 dark:bg-red-800/50' : ''}
                                  >
                                    {item.char}
                                  </span>
                                ))}
                              </pre>
                            </div>
                          </div>
                        )}
                        
                        {/* New content with character-level diff */}
                        <div>
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium mb-1">+ Added:</div>
                          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 max-h-96 overflow-y-auto">
                            <pre className="text-xs whitespace-pre-wrap break-all font-mono text-green-700 dark:text-green-300">
                              {newDiff.map((item, index) => (
                                <span
                                  key={index}
                                  className={item.type === 'added' ? 'bg-green-200 dark:bg-green-800/50' : ''}
                                >
                                  {item.char}
                                </span>
                              ))}
                            </pre>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleConfirmToolCall(false)}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Deny
                </Button>
                <Button
                  onClick={() => handleConfirmToolCall(true)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4" />
                  Confirm
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default App;
