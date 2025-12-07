/**
 * Browser Agent Service
 *
 * ЕСЛИ ПОТЕРЯЛ КОНТЕКСТ - ПРОЧИТАЙ BROWSER_AGENT_DEVELOPMENT.md!
 *
 * Этот сервис управляет AI агентом который:
 * 1. Делает скриншоты через ScreenCreate (localhost:3500)
 * 2. Отправляет их в Claude Vision для анализа (через fetch, без SDK)
 * 3. Выполняет действия (клик, ввод текста, скролл)
 * 4. Повторяет пока задача не выполнена
 *
 * ФАЗА 1: Базовый Backend Service ✅
 * - Запуск браузера
 * - Скриншоты
 * - Базовые действия
 *
 * НЕ ОСТАНАВЛИВАЙСЯ ПОКА НЕ ЗАКОНЧИШЬ ВСЕ ФАЗЫ И НЕ ПРОТЕСТИРУЕШЬ!
 */

// ScreenCreate API URL
const SCREEN_CREATE_URL = 'http://localhost:3500';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// Типы для агента
export interface AgentSession {
  id: string;
  task: string;
  status: 'idle' | 'starting' | 'running' | 'paused' | 'completed' | 'error';
  startedAt: Date;
  actions: AgentAction[];
  lastScreenshot: string | null;
  lastThinking: string | null;
  error: string | null;
}

export interface AgentAction {
  type: 'click' | 'type' | 'scroll' | 'wait' | 'navigate' | 'complete';
  params?: Record<string, any>;
  timestamp: Date;
  result?: string;
}

export interface ClaudeResponse {
  thinking: string;
  action: AgentAction;
}

class BrowserAgentService {
  private sessions: Map<string, AgentSession> = new Map();
  private currentSessionId: string | null = null;
  private stopRequested: boolean = false;
  private anthropicApiKey: string | null = null;

  // Callbacks для WebSocket broadcast
  private onScreenshot: ((sessionId: string, screenshot: string) => void) | null = null;
  private onAction: ((sessionId: string, action: AgentAction) => void) | null = null;
  private onThinking: ((sessionId: string, thinking: string) => void) | null = null;
  private onStatusChange: ((sessionId: string, status: string) => void) | null = null;

  constructor() {
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY || null;
    if (this.anthropicApiKey) {
      console.log('[Browser Agent] Anthropic API key configured');
    } else {
      console.log('[Browser Agent] No Anthropic API key - agent will use fallback mode');
    }
  }

  /**
   * Установка callback'ов для WebSocket
   */
  setCallbacks(callbacks: {
    onScreenshot?: (sessionId: string, screenshot: string) => void;
    onAction?: (sessionId: string, action: AgentAction) => void;
    onThinking?: (sessionId: string, thinking: string) => void;
    onStatusChange?: (sessionId: string, status: string) => void;
  }) {
    this.onScreenshot = callbacks.onScreenshot || null;
    this.onAction = callbacks.onAction || null;
    this.onThinking = callbacks.onThinking || null;
    this.onStatusChange = callbacks.onStatusChange || null;
  }

  /**
   * Генерация уникального ID сессии
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Запуск новой сессии агента
   */
  async startSession(task: string): Promise<AgentSession> {
    const sessionId = this.generateSessionId();

    const session: AgentSession = {
      id: sessionId,
      task,
      status: 'starting',
      startedAt: new Date(),
      actions: [],
      lastScreenshot: null,
      lastThinking: null,
      error: null
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    this.stopRequested = false;

    try {
      // Сначала завершаем любую существующую сессию
      try {
        await fetch(`${SCREEN_CREATE_URL}/test/end`, { method: 'POST' });
      } catch (e) {
        // Игнорируем ошибку завершения
      }

      // Небольшая пауза между end и start
      await new Promise(resolve => setTimeout(resolve, 500));

      // Запускаем браузер через ScreenCreate (visible для отладки)
      console.log('[Browser Agent] Starting browser session...');
      const startResponse = await fetch(`${SCREEN_CREATE_URL}/test/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: true })
      });

      const startData = await startResponse.json();
      console.log('[Browser Agent] Start response:', startData);

      if (!startResponse.ok || !startData.success) {
        throw new Error(startData.error || 'Failed to start browser session');
      }

      // Переходим на главную страницу ERP
      const navResponse = await fetch(`${SCREEN_CREATE_URL}/test/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://localhost:5000' })
      });

      if (!navResponse.ok) {
        throw new Error('Failed to navigate to ERP');
      }

      session.status = 'running';
      this.onStatusChange?.(sessionId, 'running');

      // Запускаем основной цикл агента
      this.runAgentLoop(sessionId).catch(err => {
        console.error('Agent loop error:', err);
        session.status = 'error';
        session.error = err.message;
        this.onStatusChange?.(sessionId, 'error');
      });

      return session;

    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      this.onStatusChange?.(sessionId, 'error');
      throw error;
    }
  }

  /**
   * Остановка сессии
   */
  async stopSession(sessionId: string): Promise<void> {
    this.stopRequested = true;

    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'paused';
      this.onStatusChange?.(sessionId, 'paused');
    }

    // Закрываем браузер
    try {
      await fetch(`${SCREEN_CREATE_URL}/test/end`, { method: 'POST' });
    } catch (error) {
      console.error('Error closing browser:', error);
    }
  }

  /**
   * Получить статус сессии
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Получить все сессии
   */
  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Сделать скриншот через ScreenCreate
   */
  private async takeScreenshot(): Promise<string> {
    const response = await fetch(`${SCREEN_CREATE_URL}/test/screenshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullPage: false })
    });

    if (!response.ok) {
      throw new Error('Failed to take screenshot');
    }

    const data = await response.json();
    return data.screenshot; // base64 с data:image/png;base64, префиксом
  }

  /**
   * Получить элементы страницы
   */
  private async getPageElements(): Promise<any> {
    const response = await fetch(`${SCREEN_CREATE_URL}/test/elements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      throw new Error('Failed to get page elements');
    }

    return response.json();
  }

  /**
   * Выполнить действие через ScreenCreate
   */
  private async executeAction(action: AgentAction): Promise<string> {
    let response: Response;

    switch (action.type) {
      case 'click':
        if (action.params?.text) {
          response = await fetch(`${SCREEN_CREATE_URL}/test/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: action.params.text })
          });
        } else if (action.params?.selector) {
          response = await fetch(`${SCREEN_CREATE_URL}/test/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selector: action.params.selector })
          });
        } else {
          throw new Error('Click action requires text or selector');
        }
        break;

      case 'type':
        response = await fetch(`${SCREEN_CREATE_URL}/test/type`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selector: action.params?.selector,
            text: action.params?.text,
            clear: action.params?.clear || false
          })
        });
        break;

      case 'scroll':
        response = await fetch(`${SCREEN_CREATE_URL}/test/scroll`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            selector: action.params?.selector,
            x: action.params?.x,
            y: action.params?.y
          })
        });
        break;

      case 'wait':
        await new Promise(resolve => setTimeout(resolve, action.params?.ms || 1000));
        return 'Waited';

      case 'navigate':
        response = await fetch(`${SCREEN_CREATE_URL}/test/navigate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: action.params?.url })
        });
        break;

      case 'complete':
        return 'Task completed';

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    if (!response!.ok) {
      const error = await response!.json();
      throw new Error(error.error || 'Action failed');
    }

    return 'Action executed successfully';
  }

  /**
   * Отправить скриншот в Claude Vision для анализа (через fetch API)
   */
  private async analyzeWithClaude(
    screenshot: string,
    task: string,
    previousActions: AgentAction[]
  ): Promise<ClaudeResponse> {
    if (!this.anthropicApiKey) {
      // Fallback если нет Claude API - простое тестовое действие
      console.log('[Browser Agent] No API key, using fallback action');
      return {
        thinking: 'Claude API not configured. Using fallback.',
        action: {
          type: 'complete',
          timestamp: new Date(),
          result: 'Fallback - Claude API not configured'
        }
      };
    }

    // Убираем data:image/png;base64, префикс
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');

    // Формируем историю действий
    const actionsHistory = previousActions
      .map(a => `- ${a.type}: ${JSON.stringify(a.params)} → ${a.result || 'pending'}`)
      .join('\n');

    const systemPrompt = `Ты AI агент, управляющий ERP системой Emerald через браузер.
Твоя задача: ${task}

Предыдущие действия:
${actionsHistory || 'Нет предыдущих действий'}

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
- Кликай по видимым кнопкам
- Если задача выполнена - верни type: "complete"
- Если застрял - попробуй другой подход`;

    try {
      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
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
      return {
        thinking: parsed.thinking,
        action: {
          ...parsed.action,
          timestamp: new Date()
        }
      };

    } catch (error) {
      console.error('[Browser Agent] Claude API error:', error);
      return {
        thinking: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        action: {
          type: 'wait',
          params: { ms: 2000 },
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Основной цикл агента
   */
  private async runAgentLoop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    let iterations = 0;
    const MAX_ITERATIONS = 50; // Защита от бесконечного цикла

    while (!this.stopRequested && iterations < MAX_ITERATIONS) {
      iterations++;

      try {
        // 1. Делаем скриншот
        const screenshot = await this.takeScreenshot();
        session.lastScreenshot = screenshot;
        this.onScreenshot?.(sessionId, screenshot);

        // 2. Ждём немного для стабильности
        await new Promise(resolve => setTimeout(resolve, 500));

        // 3. Анализируем с Claude
        const analysis = await this.analyzeWithClaude(
          screenshot,
          session.task,
          session.actions
        );

        session.lastThinking = analysis.thinking;
        this.onThinking?.(sessionId, analysis.thinking);

        // 4. Выполняем действие
        const action = analysis.action;
        session.actions.push(action);
        this.onAction?.(sessionId, action);

        if (action.type === 'complete') {
          session.status = 'completed';
          this.onStatusChange?.(sessionId, 'completed');
          break;
        }

        const result = await this.executeAction(action);
        action.result = result;

        // 5. Ждём после действия
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error('[Browser Agent] Loop iteration error:', error);
        session.actions.push({
          type: 'wait',
          params: { ms: 2000, reason: 'error recovery' },
          timestamp: new Date(),
          result: `Error: ${error instanceof Error ? error.message : 'Unknown'}`
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      session.status = 'error';
      session.error = 'Max iterations reached';
      this.onStatusChange?.(sessionId, 'error');
    }
  }
}

// Singleton instance
export const browserAgentService = new BrowserAgentService();
