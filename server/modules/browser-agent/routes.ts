/**
 * Browser Agent Routes
 *
 * ЕСЛИ ПОТЕРЯЛ КОНТЕКСТ - ПРОЧИТАЙ BROWSER_AGENT_DEVELOPMENT.md!
 *
 * API Endpoints для управления Browser Agent:
 * - POST /api/browser-agent/start - запустить агента с задачей
 * - POST /api/browser-agent/stop - остановить агента
 * - GET /api/browser-agent/status - получить статус
 * - GET /api/browser-agent/sessions - список всех сессий
 *
 * ФАЗА 1: Базовый Backend Service ✅
 */

import { Router } from "express";
import { browserAgentService } from "./service";

export const router = Router();

/**
 * POST /api/browser-agent/start
 * Запустить новую сессию агента с задачей
 *
 * Body: { task: string }
 * Response: { status: "started", sessionId: string, session: AgentSession }
 */
router.post("/api/browser-agent/start", async (req, res) => {
  try {
    const { task } = req.body;

    if (!task || typeof task !== "string") {
      res.status(400).json({ error: "Task is required" });
      return;
    }

    console.log(`[Browser Agent] Starting session with task: ${task}`);

    const session = await browserAgentService.startSession(task);

    res.json({
      status: "started",
      sessionId: session.id,
      session
    });
  } catch (error) {
    console.error("[Browser Agent] Start error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to start agent"
    });
  }
});

/**
 * POST /api/browser-agent/stop
 * Остановить сессию агента
 *
 * Body: { sessionId: string }
 * Response: { status: "stopped" }
 */
router.post("/api/browser-agent/stop", async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      res.status(400).json({ error: "Session ID is required" });
      return;
    }

    console.log(`[Browser Agent] Stopping session: ${sessionId}`);

    await browserAgentService.stopSession(sessionId);

    res.json({ status: "stopped", sessionId });
  } catch (error) {
    console.error("[Browser Agent] Stop error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to stop agent"
    });
  }
});

/**
 * GET /api/browser-agent/status/:sessionId
 * Получить статус конкретной сессии
 *
 * Response: { session: AgentSession } или { error: "Session not found" }
 */
router.get("/api/browser-agent/status/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = browserAgentService.getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    res.json({ session });
  } catch (error) {
    console.error("[Browser Agent] Status error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get status"
    });
  }
});

/**
 * GET /api/browser-agent/sessions
 * Получить список всех сессий
 *
 * Response: { sessions: AgentSession[] }
 */
router.get("/api/browser-agent/sessions", async (req, res) => {
  try {
    const sessions = browserAgentService.getAllSessions();
    res.json({ sessions });
  } catch (error) {
    console.error("[Browser Agent] Sessions error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get sessions"
    });
  }
});

/**
 * GET /api/browser-agent/health
 * Проверка что сервис работает
 *
 * Response: { status: "ok", service: "browser-agent" }
 */
router.get("/api/browser-agent/health", (req, res) => {
  res.json({
    status: "ok",
    service: "browser-agent",
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY
  });
});
