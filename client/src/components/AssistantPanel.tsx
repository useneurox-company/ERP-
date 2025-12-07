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
  Play,
  Square,
  MousePointer
} from "lucide-react";
import { useInPageAgent } from "@/hooks/useInPageAgent";
import { cn } from "@/lib/utils";

const STORAGE_KEY_MESSAGES = "assistant_chat_history";
const STORAGE_KEY_STATE = "assistant_dialog_state";
const STORAGE_KEY_SAVE_ENABLED = "assistant_save_history";
const AGENT_STATE_KEY = 'emerald_agent_state';

// Глобальный счётчик для уникальных ID сообщений
let messageIdCounter = 0;

// Рендерим сообщение с поддержкой markdown-like синтаксиса
function renderMessageContent(content: string) {
  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  // Паттерн для изображений: ![alt](src)
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  // Паттерн для bold: **text**
  const boldRegex = /\*\*([^*]+)\*\*/g;

  // Сначала ищем изображения
  const parts = content.split(imageRegex);

  for (let i = 0; i < parts.length; i++) {
    if (i % 3 === 0) {
      // Обычный текст - обрабатываем bold
      const textPart = parts[i];
      if (textPart) {
        const boldParts = textPart.split(boldRegex);
        for (let j = 0; j < boldParts.length; j++) {
          if (j % 2 === 0) {
            // Обычный текст
            if (boldParts[j]) {
              elements.push(<span key={`${currentIndex}-text-${j}`}>{boldParts[j]}</span>);
            }
          } else {
            // Bold текст
            elements.push(<strong key={`${currentIndex}-bold-${j}`} className="font-semibold">{boldParts[j]}</strong>);
          }
        }
      }
    } else if (i % 3 === 1) {
      // Alt текст изображения (пропускаем)
    } else if (i % 3 === 2) {
      // URL изображения
      const src = parts[i];
      if (src) {
        elements.push(
          <img
            key={`${currentIndex}-img-${i}`}
            src={src}
            alt="Скриншот"
            className="mt-2 rounded-md border max-w-full h-auto"
            style={{ maxHeight: '120px' }}
          />
        );
      }
    }
    currentIndex++;
  }

  return elements.length > 0 ? elements : content;
}

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
  // Автовключаем agentMode если есть сохранённое состояние агента
  const [agentMode, setAgentMode] = useState(() => {
    try {
      const agentState = sessionStorage.getItem(AGENT_STATE_KEY);
      if (agentState) {
        const state = JSON.parse(agentState);
        if (Date.now() - state.timestamp < 5 * 60 * 1000) {
          console.log('[AssistantPanel] Agent state found, enabling agent mode');
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  });
  // Трекер показанных действий чтобы избежать дублей
  const shownActionsRef = useRef<Set<string>>(new Set());

  // Agent hook
  const {
    isRunning: agentRunning,
    thinking: agentThinking,
    actions: agentActions,
    error: agentError,
    startAgent,
    stopAgent
  } = useInPageAgent();

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
          // Restore Date objects and regenerate IDs to avoid duplicates
          const restored = parsed.map((msg: any, index: number) => {
            messageIdCounter++;
            return {
              ...msg,
              id: `msg_${Date.now()}_${messageIdCounter}_${index}_${Math.random().toString(36).substring(2, 7)}`,
              timestamp: new Date(msg.timestamp)
            };
          });
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

  // Show agent thinking as messages
  useEffect(() => {
    if (agentThinking && agentMode) {
      // Don't add duplicate thinking messages
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.content !== `🤔 ${agentThinking}`) {
        addMessage("assistant", `🤔 ${agentThinking}`);
      }
    }
  }, [agentThinking, agentMode]);

  // Show agent actions as messages with screenshots (Comet-style)
  useEffect(() => {
    if (agentActions.length > 0 && agentMode) {
      const lastAction = agentActions[agentActions.length - 1];

      // Создаём уникальный ключ для действия
      const actionKey = `${lastAction.type}_${lastAction.timestamp}_${JSON.stringify(lastAction.params || {}).substring(0, 50)}`;

      // Проверяем, показывали ли мы уже это действие
      if (shownActionsRef.current.has(actionKey)) {
        return;
      }
      shownActionsRef.current.add(actionKey);

      // Показываем thinking если есть (перед действием)
      if (lastAction.thinking && lastAction.thinking !== agentThinking) {
        addMessage("assistant", `💭 ${lastAction.thinking}`);
      }

      // Формируем текст действия
      let actionIcon = '🔧';
      let actionText = '';
      if (lastAction.type === 'click') {
        actionIcon = '🖱️';
        actionText = `Клик: ${lastAction.params?.text || lastAction.params?.selector || `(${lastAction.params?.x}, ${lastAction.params?.y})`}`;
      } else if (lastAction.type === 'type') {
        actionIcon = '⌨️';
        actionText = `Ввод: "${lastAction.params?.text}"`;
      } else if (lastAction.type === 'navigate') {
        actionIcon = '🔗';
        const url = lastAction.params?.url || (lastAction as any).url || lastAction.result?.replace('Navigated to ', '') || 'неизвестно';
        actionText = `Переход: ${url}`;
      } else if (lastAction.type === 'complete') {
        actionIcon = '✅';
        actionText = 'Задача выполнена';
      } else if (lastAction.type === 'read') {
        actionIcon = '📖';
        actionText = 'Чтение страницы';
      } else if (lastAction.type === 'search') {
        actionIcon = '🔍';
        actionText = `Поиск: ${lastAction.params?.query || ''}`;
      } else {
        actionText = lastAction.type;
      }

      // Формируем полное сообщение с скриншотом (если есть)
      const stepNum = lastAction.stepNumber || agentActions.length;
      let fullMessage = `${actionIcon} **Шаг ${stepNum}**: ${actionText}`;

      // Добавляем миниатюру скриншота если есть
      if (lastAction.screenshot) {
        fullMessage += `\n\n![Скриншот](${lastAction.screenshot})`;
      }

      addMessage("assistant", fullMessage);
    }
  }, [agentActions.length, agentMode, agentThinking]);

  // Show agent error
  useEffect(() => {
    if (agentError && agentMode) {
      addMessage("assistant", `❌ Ошибка: ${agentError}`);
    }
  }, [agentError, agentMode]);

  // Agent finished
  useEffect(() => {
    if (!agentRunning && agentMode && agentActions.length > 0) {
      const lastAction = agentActions[agentActions.length - 1];
      if (lastAction?.type === 'complete') {
        addMessage("assistant", "🎉 Агент завершил задачу!");
      }
    }
  }, [agentRunning, agentMode, agentActions.length]);

  const addMessage = (role: "user" | "assistant", content: string, buttons?: ChatButton[], usedAI?: boolean) => {
    messageIdCounter++;
    const newMessage: Message = {
      id: `msg_${Date.now()}_${messageIdCounter}_${Math.random().toString(36).substring(2, 7)}`,
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
    if (!input.trim() || isLoading || agentRunning) return;

    const text = input.trim();
    setInput("");
    addMessage("user", text);

    if (agentMode) {
      // Agent mode - запускаем агента
      addMessage("assistant", `🤖 Запускаю агента: "${text}"`, undefined, true);
      startAgent(text);
    } else {
      // Normal chat mode
      sendToAPI(text);
    }
  };

  const handleStopAgent = () => {
    stopAgent();
    addMessage("assistant", "⏹️ Агент остановлен");
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
              {agentMode && agentRunning ? (
                <>
                  <span className="text-green-600 font-medium animate-pulse">
                    {agentActions.length} шагов выполнено
                  </span>
                </>
              ) : agentMode && agentActions.length > 0 ? (
                <span className="text-green-600">
                  {agentActions.length} шагов выполнено
                </span>
              ) : (
                <>
                  <span>ERP помощник</span>
                  {dialogState !== "idle" && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                      {dialogState}
                    </Badge>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {/* Agent Mode toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-1">
                <MousePointer className={cn("h-3 w-3", agentMode ? "text-green-500" : "text-muted-foreground")} />
                <Switch
                  checked={agentMode}
                  onCheckedChange={setAgentMode}
                  disabled={agentRunning}
                  className="h-4 w-7 data-[state=checked]:bg-green-500"
                  data-testid="switch-agent-mode"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">{agentMode ? "Режим агента включен" : "Включить режим агента"}</p>
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
                      <div className="text-xs whitespace-pre-wrap">
                        {renderMessageContent(msg.content)}
                      </div>
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
        {agentMode && (
          <div className="flex items-center gap-2 mb-2 text-[10px] text-green-600">
            <MousePointer className="h-3 w-3" />
            <span>Режим агента: команды выполняются автоматически</span>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder={agentMode ? "Опиши задачу, например: открой проекты" : "Напиши сообщение..."}
            className={cn("flex-1 text-xs h-8", agentMode && "border-green-500/50")}
            disabled={isLoading || agentRunning}
            data-testid="input-assistant-message"
          />
          {agentRunning ? (
            <Button
              onClick={handleStopAgent}
              size="sm"
              variant="destructive"
              className="h-8 w-8 p-0"
              data-testid="button-stop-agent"
            >
              <Square className="h-3 w-3" />
            </Button>
          ) : (
            <Button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              size="sm"
              className={cn("h-8 w-8 p-0", agentMode && "bg-green-600 hover:bg-green-700")}
              data-testid="button-send-message"
            >
              {agentMode ? <Play className="h-3 w-3" /> : <Send className="h-3 w-3" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
