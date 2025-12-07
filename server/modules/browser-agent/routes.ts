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

/**
 * POST /api/browser-agent/analyze
 * Анализ скриншота через Claude Vision и получение следующего действия
 *
 * Это endpoint для In-Page Agent (работает в текущем окне браузера пользователя)
 *
 * Body: {
 *   screenshot: string (base64),
 *   task: string,
 *   previousActions: AgentAction[],
 *   pageElements: { buttons: [], links: [], inputs: [] }
 * }
 * Response: { thinking: string, action: AgentAction }
 */
router.post("/api/browser-agent/analyze", async (req, res) => {
  try {
    const { screenshot, task, previousActions, pageElements } = req.body;

    if (!screenshot || !task) {
      res.status(400).json({ error: "Screenshot and task are required" });
      return;
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicApiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
      return;
    }

    // Убираем data:image/png;base64, префикс
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');

    // Формируем историю действий
    const actionsHistory = (previousActions || [])
      .map((a: any) => `- ${a.type}: ${JSON.stringify(a.params)} → ${a.result || 'pending'}`)
      .join('\n');

    // Формируем список элементов
    const elementsInfo = `
Кнопки: ${(pageElements?.buttons || []).map((b: any) => `"${b.text}"`).join(', ')}
Ссылки: ${(pageElements?.links || []).slice(0, 10).map((l: any) => `"${l.text}"`).join(', ')}
Поля ввода: ${(pageElements?.inputs || []).map((i: any) => `${i.name || i.placeholder || i.type}`).join(', ')}
    `.trim();

    const systemPrompt = `Ты AI агент, управляющий ERP системой Emerald через браузер пользователя.
Ты работаешь ВНУТРИ текущего окна браузера пользователя (как Comet/Atlas).

Твоя задача: ${task}

Предыдущие действия:
${actionsHistory || 'Нет предыдущих действий'}

Доступные элементы на странице:
${elementsInfo}

Анализируй скриншот и верни ТОЛЬКО JSON в формате:
{
  "thinking": "Описание что ты видишь и что планируешь делать",
  "action": {
    "type": "click|type|scroll|wait|navigate|complete",
    "params": {
      // для click: {"text": "Текст кнопки"} или {"selector": "CSS селектор"}
      // для type: {"selector": "input селектор", "text": "текст для ввода", "clear": true/false}
      // для scroll: {"selector": "элемент"} или {"y": число}
      // для wait: {"ms": миллисекунды}
      // для navigate: {"url": "адрес"}
      // для complete: {} (задача выполнена)
    }
  }
}

Важно:
- Используй русский интерфейс
- Кликай по видимым кнопкам (используй text для поиска по тексту)
- Если задача выполнена - верни type: "complete"
- Если застрял - попробуй другой подход
- Ты работаешь в том же окне что и пользователь, не нужно логиниться`;

    console.log('[Browser Agent] Analyzing screenshot with Claude...');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: base64Data
              }
            },
            {
              type: 'text',
              text: systemPrompt
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Browser Agent] Claude API error:', errorData);
      throw new Error(`Claude API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    // Парсим ответ Claude
    const content = data.content[0];
    if (content.type !== 'text') {
      throw new Error('Expected text response from Claude');
    }

    // Извлекаем JSON из ответа
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    console.log('[Browser Agent] Claude response:', parsed.thinking);

    res.json({
      thinking: parsed.thinking,
      action: {
        ...parsed.action,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error("[Browser Agent] Analyze error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to analyze"
    });
  }
});
