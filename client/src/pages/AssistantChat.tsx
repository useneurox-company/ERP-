import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Send,
  Bot,
  User,
  ArrowLeft,
  X,
  HelpCircle,
  Zap
} from "lucide-react";

// Message types
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

// API response type
interface AssistantResponse {
  message: string;
  buttons?: ChatButton[];
  state: string;
  usedAI: boolean;
  redirect?: string;
}

export default function AssistantChat() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [dialogState, setDialogState] = useState("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Welcome message on mount
  useEffect(() => {
    if (userId) {
      sendToAPI("", "home");
    }
  }, [userId]);

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

    // If button has data, send it along with the action
    if (button.data !== undefined) {
      const dataValue = button.data.value ?? button.data.index ?? button.data;
      sendToAPI(String(dataValue), button.action, button.data);
    } else {
      sendToAPI("", button.action);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Ассистент</h1>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <span>Диалоговый помощник ERP</span>
              {dialogState !== "idle" && (
                <Badge variant="outline" className="text-[10px]">
                  {dialogState}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-4">
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${
                  msg.role === "user" ? "bg-primary" : "bg-muted"
                }`}>
                  {msg.role === "user" ? (
                    <User className="h-4 w-4 text-primary-foreground" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div className="space-y-2">
                  <Card className={msg.role === "user" ? "bg-primary text-primary-foreground" : ""}>
                    <CardContent className="p-3">
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.usedAI && msg.role === "assistant" && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          <span>AI</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {msg.buttons.map((btn, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          onClick={() => handleButtonClick(btn)}
                          className="text-xs"
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
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  <Bot className="h-4 w-4 animate-pulse" />
                </div>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-sm text-muted-foreground">Думаю...</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="pt-4 border-t">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Напиши сообщение..."
            className="flex-1"
            disabled={isLoading}
          />
          <Button onClick={handleSend} disabled={isLoading || !input.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleButtonClick({ text: "⬅️ Назад", action: "back" })}
            disabled={dialogState === "idle" || isLoading}
          >
            <ArrowLeft className="h-3 w-3 mr-1" />
            Назад
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleButtonClick({ text: "❌ Отмена", action: "cancel" })}
            disabled={dialogState === "idle" || isLoading}
          >
            <X className="h-3 w-3 mr-1" />
            Отмена
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleButtonClick({ text: "💬 Помощь", action: "help" })}
            disabled={isLoading}
          >
            <HelpCircle className="h-3 w-3 mr-1" />
            Помощь
          </Button>
        </div>
      </div>
    </div>
  );
}
