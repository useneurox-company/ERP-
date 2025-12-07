/**
 * Browser Agent WebSocket Handler
 *
 * ЕСЛИ ПОТЕРЯЛ КОНТЕКСТ - ПРОЧИТАЙ BROWSER_AGENT_DEVELOPMENT.md!
 *
 * WebSocket события:
 * - agent:screenshot - новый скриншот (base64)
 * - agent:action - текущее действие
 * - agent:thinking - мысли агента
 * - agent:status - статус (running/stopped/error)
 *
 * ФАЗА 2: WebSocket для Real-time
 */

import { Server as HttpServer } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { browserAgentService, AgentAction } from "./service";

interface BrowserAgentClient {
  ws: WebSocket;
  sessionId: string | null;
}

class BrowserAgentWebSocket {
  private wss: WebSocketServer | null = null;
  private clients: Set<BrowserAgentClient> = new Set();

  /**
   * Инициализация WebSocket сервера
   */
  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: "/ws/browser-agent"
    });

    console.log("[Browser Agent WebSocket] Initialized on /ws/browser-agent");

    this.wss.on("connection", (ws: WebSocket) => {
      console.log("[Browser Agent WebSocket] Client connected");

      const client: BrowserAgentClient = {
        ws,
        sessionId: null
      };
      this.clients.add(client);

      // Отправляем приветствие
      this.sendToClient(ws, {
        type: "connected",
        message: "Connected to Browser Agent WebSocket"
      });

      // Обработка сообщений от клиента
      ws.on("message", (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(client, message);
        } catch (error) {
          console.error("[Browser Agent WebSocket] Invalid message:", error);
        }
      });

      // Обработка закрытия соединения
      ws.on("close", () => {
        console.log("[Browser Agent WebSocket] Client disconnected");
        this.clients.delete(client);
      });

      // Обработка ошибок
      ws.on("error", (error) => {
        console.error("[Browser Agent WebSocket] Client error:", error);
        this.clients.delete(client);
      });
    });

    // Настраиваем callbacks в сервисе
    this.setupServiceCallbacks();
  }

  /**
   * Настройка callbacks для сервиса
   */
  private setupServiceCallbacks(): void {
    browserAgentService.setCallbacks({
      onScreenshot: (sessionId: string, screenshot: string) => {
        this.broadcast(sessionId, {
          type: "agent:screenshot",
          sessionId,
          screenshot,
          timestamp: new Date().toISOString()
        });
      },
      onAction: (sessionId: string, action: AgentAction) => {
        this.broadcast(sessionId, {
          type: "agent:action",
          sessionId,
          action,
          timestamp: new Date().toISOString()
        });
      },
      onThinking: (sessionId: string, thinking: string) => {
        this.broadcast(sessionId, {
          type: "agent:thinking",
          sessionId,
          thinking,
          timestamp: new Date().toISOString()
        });
      },
      onStatusChange: (sessionId: string, status: string) => {
        this.broadcast(sessionId, {
          type: "agent:status",
          sessionId,
          status,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Обработка сообщений от клиента
   */
  private handleClientMessage(client: BrowserAgentClient, message: any): void {
    switch (message.type) {
      case "subscribe":
        // Подписка на сессию
        client.sessionId = message.sessionId;
        console.log(`[Browser Agent WebSocket] Client subscribed to session: ${message.sessionId}`);
        break;

      case "unsubscribe":
        // Отписка от сессии
        client.sessionId = null;
        console.log("[Browser Agent WebSocket] Client unsubscribed");
        break;

      case "start":
        // Запуск новой сессии
        this.handleStartSession(client, message.task);
        break;

      case "stop":
        // Остановка сессии
        this.handleStopSession(client, message.sessionId);
        break;

      default:
        console.log(`[Browser Agent WebSocket] Unknown message type: ${message.type}`);
    }
  }

  /**
   * Запуск сессии через WebSocket
   */
  private async handleStartSession(client: BrowserAgentClient, task: string): Promise<void> {
    try {
      const session = await browserAgentService.startSession(task);
      client.sessionId = session.id;

      this.sendToClient(client.ws, {
        type: "session:started",
        sessionId: session.id,
        session
      });
    } catch (error) {
      this.sendToClient(client.ws, {
        type: "session:error",
        error: error instanceof Error ? error.message : "Failed to start session"
      });
    }
  }

  /**
   * Остановка сессии через WebSocket
   */
  private async handleStopSession(client: BrowserAgentClient, sessionId: string): Promise<void> {
    try {
      await browserAgentService.stopSession(sessionId);

      this.sendToClient(client.ws, {
        type: "session:stopped",
        sessionId
      });
    } catch (error) {
      this.sendToClient(client.ws, {
        type: "session:error",
        error: error instanceof Error ? error.message : "Failed to stop session"
      });
    }
  }

  /**
   * Отправка сообщения конкретному клиенту
   */
  private sendToClient(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }

  /**
   * Broadcast сообщения всем клиентам, подписанным на сессию
   */
  private broadcast(sessionId: string, data: any): void {
    for (const client of this.clients) {
      // Отправляем всем подписанным на эту сессию или без подписки (получают всё)
      if (client.sessionId === sessionId || client.sessionId === null) {
        this.sendToClient(client.ws, data);
      }
    }
  }

  /**
   * Broadcast всем клиентам
   */
  broadcastToAll(data: any): void {
    for (const client of this.clients) {
      this.sendToClient(client.ws, data);
    }
  }

  /**
   * Получить количество подключенных клиентов
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton instance
export const browserAgentWebSocket = new BrowserAgentWebSocket();
