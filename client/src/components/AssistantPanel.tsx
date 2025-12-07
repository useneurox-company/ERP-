import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send,
  Bot,
  User,
  X,
  Zap,
  Minus,
  History,
  Trash2,
  Monitor
} from "lucide-react";
import { AgentOverlay } from "./AgentOverlay";
import { cn } from "@/lib/utils";

const STORAGE_KEY_MESSAGES = "assistant_chat_history";
const STORAGE_KEY_STATE = "assistant_dialog_state";
const STORAGE_KEY_SAVE_ENABLED = "assistant_save_history";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  buttons?: ChatButton[];
  timestamp: Date;
  usedAI?: boolean;
}

interface ChatButton {
  text: string;
  action: string;
  data?: any;
}

interface AssistantResponse {
  message: string;
  buttons?: ChatButton[];
  state: string;
  usedAI: boolean;
  redirect?: string;
}

interface AssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  isMinimized: boolean;
  onMinimize: () => void;
}

export function AssistantPanel({ isOpen, onClose, isMinimized, onMinimize }: AssistantPanelProps) {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [dialogState, setDialogState] = useState("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [saveHistory, setSaveHistory] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SAVE_ENABLED);
    return saved === "true";
  });
  const [isAgentOverlayOpen, setIsAgentOverlayOpen] = useState(false);

  // Get user ID from localStorage
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      try {
        const userData = JSON.parse(user);
        setUserId(userData.id || "anonymous");
      } catch {
        setUserId("anonymous");
      }
    } else {
      setUserId("anonymous");
    }
  }, []);

  // Load saved messages and state on mount if history saving is enabled
  useEffect(() => {
    if (!userId) return;

    if (saveHistory) {
      const savedMessages = localStorage.getItem(`${STORAGE_KEY_MESSAGES}_${userId}`);
      const savedState = localStorage.getItem(`${STORAGE_KEY_STATE}_${userId}`);

      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          // Restore Date objects
          const restored = parsed.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(restored);

          // Restore dialog state
          if (savedState) {
            setDialogState(savedState);
          }
        } catch (e) {
          console.error("Failed to load chat history:", e);
        }
      }
    }

    // Mark history as loaded (even if empty)
    setHistoryLoaded(true);
  }, [userId, saveHistory]);

  // Save messages to localStorage when they change (if enabled)
  useEffect(() => {
    if (saveHistory && userId && messages.length > 0 && historyLoaded) {
      localStorage.setItem(`${STORAGE_KEY_MESSAGES}_${userId}`, JSON.stringify(messages));
    }
  }, [messages, saveHistory, userId, historyLoaded]);

  // Save dialog state to localStorage when it changes (if enabled)
  useEffect(() => {
    if (saveHistory && userId && historyLoaded) {
      localStorage.setItem(`${STORAGE_KEY_STATE}_${userId}`, dialogState);
    }
  }, [dialogState, saveHistory, userId, historyLoaded]);

  // Handle save history toggle
  const handleSaveHistoryToggle = useCallback((enabled: boolean) => {
    setSaveHistory(enabled);
    localStorage.setItem(STORAGE_KEY_SAVE_ENABLED, String(enabled));
    if (!enabled && userId) {
      // If disabled, clear saved history
      localStorage.removeItem(`${STORAGE_KEY_MESSAGES}_${userId}`);
      localStorage.removeItem(`${STORAGE_KEY_STATE}_${userId}`);
    }
  }, [userId]);

  // Clear chat history
  const handleClearHistory = useCallback(() => {
    setMessages([]);
    setDialogState("idle");
    if (userId) {
      localStorage.removeItem(`${STORAGE_KEY_MESSAGES}_${userId}`);
      localStorage.removeItem(`${STORAGE_KEY_STATE}_${userId}`);
    }
  }, [userId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Welcome message on first open (only if no history was loaded)
  useEffect(() => {
    if (userId && isOpen && historyLoaded && messages.length === 0) {
      sendToAPI("", "home");
    }
  }, [userId, isOpen, historyLoaded, messages.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const addMessage = (role: "user" | "assistant", content: string, buttons?: ChatButton[], usedAI?: boolean) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      buttons,
      timestamp: new Date(),
      usedAI
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const sendToAPI = async (message: string, action?: string, actionData?: any) => {
    if (!userId) return;

    setIsLoading(true);

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": userId
        },
        body: JSON.stringify({
          userId,
          message,
          action,
          actionData
        })
      });

      if (!response.ok) {
        throw new Error("API error");
      }

      const data: AssistantResponse = await response.json();

      setDialogState(data.state);
      addMessage("assistant", data.message, data.buttons, data.usedAI);

      // Handle redirect if present
      if (data.redirect) {
        setTimeout(() => {
          setLocation(data.redirect!);
          // Close panel after redirect
          onClose();
        }, 500);
      }

    } catch (error) {
      console.error("Assistant API error:", error);
      addMessage("assistant", "Ошибка соединения. Попробуй ещё раз.", [
        { text: "🏠 В начало", action: "home" }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => {
    if (!input.trim() || isLoading) return;

    const text = input.trim();
    setInput("");
    addMessage("user", text);
    sendToAPI(text);
  };

  const handleButtonClick = (button: ChatButton) => {
    addMessage("user", button.text);

    if (button.data !== undefined) {
      const dataValue = button.data.value ?? button.data.index ?? button.data;
      sendToAPI(String(dataValue), button.action, button.data);
    } else {
      sendToAPI("", button.action);
    }
  };

  if (!isOpen) return null;

  // Minimized state - just show a small bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={onMinimize}
          className="gap-2 shadow-lg"
          data-testid="button-expand-assistant"
        >
          <Bot className="h-4 w-4" />
          <span>Ассистент</span>
          {dialogState !== "idle" && (
            <Badge variant="secondary" className="text-[10px] px-1">
              {dialogState}
            </Badge>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "fixed top-16 right-0 bottom-0 w-80 lg:w-96 bg-background border-l shadow-lg z-40",
        "flex flex-col transition-transform duration-200 ease-in-out"
      )}
      data-testid="assistant-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Ассистент</h2>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span>ERP помощник</span>
              {dialogState !== "idle" && (
                <Badge variant="outline" className="text-[9px] px-1 py-0">
                  {dialogState}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Agent Mode button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsAgentOverlayOpen(true)}
                data-testid="button-agent-mode"
              >
                <Monitor className="h-3.5 w-3.5 text-primary" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">AI Agent Mode</p>
            </TooltipContent>
          </Tooltip>
          {/* History toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-1">
                <History className={cn("h-3 w-3", saveHistory ? "text-primary" : "text-muted-foreground")} />
                <Switch
                  checked={saveHistory}
                  onCheckedChange={handleSaveHistoryToggle}
                  className="h-4 w-7 data-[state=checked]:bg-primary"
                  data-testid="switch-save-history"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{saveHistory ? "История сохраняется" : "История не сохраняется"}</p>
            </TooltipContent>
          </Tooltip>
          {/* Clear history */}
          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleClearHistory}
                  data-testid="button-clear-history"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs">Очистить историю</p>
              </TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onMinimize}
            data-testid="button-minimize-assistant"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            data-testid="button-close-assistant"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-2 max-w-[90%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 ${
                  msg.role === "user" ? "bg-primary" : "bg-muted"
                }`}>
                  {msg.role === "user" ? (
                    <User className="h-3 w-3 text-primary-foreground" />
                  ) : (
                    <Bot className="h-3 w-3" />
                  )}
                </div>
                <div className="space-y-1">
                  <Card className={cn(
                    "shadow-sm",
                    msg.role === "user" ? "bg-primary text-primary-foreground" : ""
                  )}>
                    <CardContent className="p-2">
                      <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                      {msg.usedAI && msg.role === "assistant" && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <Zap className="h-2 w-2" />
                          <span>AI</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {msg.buttons.map((btn, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => handleButtonClick(btn)}
                          className="text-[10px] h-6 px-2"
                        >
                          {btn.text}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
                  <Bot className="h-3 w-3 animate-pulse" />
                </div>
                <Card className="shadow-sm">
                  <CardContent className="p-2">
                    <p className="text-xs text-muted-foreground">Думаю...</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Напиши сообщение..."
            className="flex-1 text-xs h-8"
            disabled={isLoading}
            data-testid="input-assistant-message"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="h-8 w-8 p-0"
            data-testid="button-send-message"
          >
            <Send className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Agent Overlay */}
      <AgentOverlay
        isOpen={isAgentOverlayOpen}
        onClose={() => setIsAgentOverlayOpen(false)}
      />
    </div>
  );
}
