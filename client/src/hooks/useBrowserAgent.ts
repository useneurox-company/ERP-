/**
 * useBrowserAgent Hook
 *
 * ЕСЛИ ПОТЕРЯЛ КОНТЕКСТ - ПРОЧИТАЙ BROWSER_AGENT_DEVELOPMENT.md!
 *
 * React hook для управления Browser Agent через WebSocket
 *
 * ФАЗА 5: Frontend Overlay
 */

import { useState, useEffect, useCallback, useRef } from "react";

// Типы
export interface AgentAction {
  type: "click" | "type" | "scroll" | "wait" | "navigate" | "complete";
  params?: Record<string, any>;
  timestamp: string;
  result?: string;
}

export interface AgentSession {
  id: string;
  task: string;
  status: "idle" | "starting" | "running" | "paused" | "completed" | "error";
  startedAt: string;
  actions: AgentAction[];
  lastScreenshot: string | null;
  lastThinking: string | null;
  error: string | null;
}

interface WebSocketMessage {
  type: string;
  sessionId?: string;
  screenshot?: string;
  action?: AgentAction;
  thinking?: string;
  status?: string;
  session?: AgentSession;
  error?: string;
  timestamp?: string;
}

export interface UseBrowserAgentReturn {
  // Состояние
  isConnected: boolean;
  session: AgentSession | null;
  screenshot: string | null;
  thinking: string | null;
  actions: AgentAction[];
  error: string | null;

  // Методы
  startAgent: (task: string) => void;
  stopAgent: () => void;
  connect: () => void;
  disconnect: () => void;
}

export function useBrowserAgent(): UseBrowserAgentReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Подключение к WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/browser-agent`;

    console.log("[BrowserAgent] Connecting to:", wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[BrowserAgent] Connected");
      setIsConnected(true);
      setError(null);
    };

    ws.onclose = () => {
      console.log("[BrowserAgent] Disconnected");
      setIsConnected(false);

      // Автоматическое переподключение через 3 секунды
      reconnectTimeoutRef.current = setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connect();
        }
      }, 3000);
    };

    ws.onerror = (event) => {
      console.error("[BrowserAgent] WebSocket error:", event);
      setError("WebSocket connection error");
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        console.error("[BrowserAgent] Failed to parse message:", err);
      }
    };

    wsRef.current = ws;
  }, []);

  // Отключение
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Обработка входящих сообщений
  const handleMessage = useCallback((message: WebSocketMessage) => {
    console.log("[BrowserAgent] Message:", message.type);

    switch (message.type) {
      case "connected":
        console.log("[BrowserAgent] Server confirmed connection");
        break;

      case "session:started":
        if (message.session) {
          setSession(message.session);
          setActions([]);
          setScreenshot(null);
          setThinking(null);
          setError(null);
        }
        break;

      case "session:stopped":
        if (session) {
          setSession({ ...session, status: "paused" });
        }
        break;

      case "session:error":
        setError(message.error || "Unknown error");
        break;

      case "agent:screenshot":
        if (message.screenshot) {
          setScreenshot(message.screenshot);
        }
        break;

      case "agent:action":
        if (message.action) {
          setActions((prev) => [...prev, message.action!]);
        }
        break;

      case "agent:thinking":
        if (message.thinking) {
          setThinking(message.thinking);
        }
        break;

      case "agent:status":
        if (session && message.status) {
          setSession({
            ...session,
            status: message.status as AgentSession["status"],
          });
        }
        break;
    }
  }, [session]);

  // Запуск агента
  const startAgent = useCallback((task: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected");
      return;
    }

    setError(null);
    setActions([]);
    setScreenshot(null);
    setThinking(null);

    wsRef.current.send(
      JSON.stringify({
        type: "start",
        task,
      })
    );
  }, []);

  // Остановка агента
  const stopAgent = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    if (session?.id) {
      wsRef.current.send(
        JSON.stringify({
          type: "stop",
          sessionId: session.id,
        })
      );
    }
  }, [session]);

  // Автоподключение при монтировании
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    session,
    screenshot,
    thinking,
    actions,
    error,
    startAgent,
    stopAgent,
    connect,
    disconnect,
  };
}
