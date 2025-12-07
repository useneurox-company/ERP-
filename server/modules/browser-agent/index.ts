/**
 * Browser Agent Module
 *
 * ЕСЛИ ПОТЕРЯЛ КОНТЕКСТ - ПРОЧИТАЙ BROWSER_AGENT_DEVELOPMENT.md!
 *
 * Экспорты модуля:
 * - router - Express роутер с API endpoints
 * - browserAgentService - сервис для управления агентом
 * - browserAgentWebSocket - WebSocket handler для real-time
 *
 * ФАЗА 1: Базовый Backend Service ✅
 * ФАЗА 2: WebSocket для Real-time ✅
 */

export { router } from "./routes";
export { browserAgentService, type AgentSession, type AgentAction } from "./service";
export { browserAgentWebSocket } from "./websocket";
