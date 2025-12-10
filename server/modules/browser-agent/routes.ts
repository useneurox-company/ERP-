/**
 * Browser Agent Routes v2.0 - Professional Human-like Agent
 *
 * API Endpoints для Browser Agent:
 * - POST /api/browser-agent/analyze - анализ через AI
 * - GET /api/browser-agent/health - проверка здоровья
 *
 * Модель: google/gemini-2.0-flash-001 или openai/gpt-4o-mini
 */

import { Router } from "express";
import { browserAgentService } from "./service";
import * as fs from "fs";
import * as path from "path";

export const router = Router();

// Читаем ключ напрямую из .env файла
function getOpenRouterKey(): string | null {
  try {
    const envPath = path.join(process.cwd(), '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/OPENROUTER_API_KEY=(.+)/);
    return match ? match[1].trim() : null;
  } catch (e) {
    return process.env.OPENROUTER_API_KEY || null;
  }
}

/**
 * POST /api/browser-agent/analyze
 * Анализ страницы через AI модель
 *
 * Принимает структурированные данные о странице:
 * - pageContext: URL, route, title, visibleText
 * - pageElements: navigation[], actions[], forms[], dialogs[]
 * - agentContext: currentStep, pagesVisited, hasDialog
 * - previousActions: последние действия агента
 */
router.post("/api/browser-agent/analyze", async (req, res) => {
  try {
    const { screenshot, pageContext, task, previousActions, pageElements, agentContext } = req.body;

    if (!task) {
      res.status(400).json({ error: "Task is required" });
      return;
    }

    const openRouterKey = getOpenRouterKey();
    if (!openRouterKey) {
      res.status(500).json({ error: "OPENROUTER_API_KEY not configured" });
      return;
    }

    // Формируем историю действий (компактно)
    const actionsHistory = (previousActions || [])
      .slice(-8)
      .map((a: any, i: number) => `${i + 1}. ${a.type}(${a.params?.text || a.params?.url || a.params?.selector || ''}) → ${a.result || '?'}`)
      .join('\n');

    // Анализируем повторяющиеся действия
    const recentActions = (previousActions || []).slice(-5);
    const actionCounts = new Map<string, number>();
    for (const a of recentActions) {
      const key = `${a.type}:${a.params?.text || ''}`;
      actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
    }
    const isStuck = Array.from(actionCounts.values()).some(count => count >= 3);

    // Извлекаем структурированные элементы
    const navigation = (pageElements?.navigation || [])
      .filter((n: any) => n.enabled !== false)
      .slice(0, 12)
      .map((n: any) => `• "${n.text}" [${n.location}] → ${n.selector}`)
      .join('\n');

    const actions = (pageElements?.actions || [])
      .filter((a: any) => a.enabled !== false)
      .slice(0, 12)
      .map((a: any) => `• "${a.text}" [${a.location}]`)
      .join('\n');

    const forms = (pageElements?.forms || [])
      .slice(0, 8)
      .map((f: any) => `• ${f.attributes?.label || f.attributes?.placeholder || f.attributes?.name || f.type} [${f.selector}]`)
      .join('\n');

    const hasDialog = agentContext?.hasDialog || pageElements?.dialogs?.length > 0;
    const dialogTitle = agentContext?.dialogTitle || pageElements?.dialogs?.[0]?.title || '';

    // Определяем контекст задачи
    const currentRoute = pageContext?.currentRoute || '/';
    const taskLower = task.toLowerCase();

    // Эвристики для понимания задачи
    const isCreateTask = /создай|создать|добавь|добавить|новый|new|create|add/i.test(taskLower);
    const isNavigateTask = /открой|открыть|перейди|перейти|go to|navigate|показ/i.test(taskLower);
    const isEditTask = /измени|изменить|редактир|edit|update|обнови/i.test(taskLower);
    const isDeleteTask = /удали|удалить|delete|remove/i.test(taskLower);

    // Определяем целевую страницу
    let targetPage = '';
    if (/проект/i.test(taskLower)) targetPage = '/projects';
    else if (/клиент/i.test(taskLower)) targetPage = '/clients';
    else if (/поставщик/i.test(taskLower)) targetPage = '/suppliers';
    else if (/закупк/i.test(taskLower)) targetPage = '/procurement';
    else if (/монтаж/i.test(taskLower)) targetPage = '/montage';
    else if (/настройк/i.test(taskLower)) targetPage = '/settings';
    else if (/финанс/i.test(taskLower)) targetPage = '/finance';
    else if (/склад/i.test(taskLower)) targetPage = '/warehouse';

    const isOnTargetPage = targetPage && currentRoute.includes(targetPage.replace('/', ''));

    // Выбор модели - Haiku для скорости
    const model = 'anthropic/claude-3.5-haiku';

    // Формируем промпт
    let systemPrompt: string;
    let messages: any[];

    if (screenshot) {
      // VISION MODE
      systemPrompt = buildVisionPrompt(task, pageContext, actionsHistory, navigation, actions, forms, hasDialog, dialogTitle, isStuck, isOnTargetPage, targetPage);
      messages = [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/png;base64,${screenshot}` } },
          { type: 'text', text: systemPrompt }
        ]
      }];
    } else {
      // DOM MODE
      systemPrompt = buildDOMPrompt(
        task, pageContext, actionsHistory, navigation, actions, forms,
        hasDialog, dialogTitle, isStuck, isOnTargetPage, targetPage,
        isCreateTask, isNavigateTask, agentContext, previousActions || []
      );
      messages = [{ role: 'user', content: systemPrompt }];
    }

    console.log(`[Browser Agent] Analyzing with ${model}...`);
    console.log(`[Browser Agent] Route: ${currentRoute} | Dialog: ${hasDialog} | Target: ${targetPage} | OnTarget: ${isOnTargetPage}`);

    // OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterKey}`,
        'HTTP-Referer': 'http://localhost:5000',
        'X-Title': 'Emerald ERP Browser Agent'
      },
      body: JSON.stringify({
        model,
        max_tokens: 500,
        temperature: 0.1, // Низкая температура для стабильности
        messages
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[Browser Agent] OpenRouter error:', errorData);
      throw new Error(`OpenRouter error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    console.log('[Browser Agent] Raw response:', content?.substring(0, 300));

    if (!content) {
      throw new Error('No content in response');
    }

    // Парсим JSON ответ
    const parsed = parseAIResponse(content);

    // Нормализуем action
    const action = normalizeAction(parsed.action);

    console.log('[Browser Agent] Thinking:', parsed.thinking);
    console.log('[Browser Agent] Action:', action.type, action.params);

    // Логируем стоимость
    const usage = data.usage;
    if (usage) {
      let cost = 0;
      if (model.includes('gemini')) {
        cost = usage.prompt_tokens * 0.000000075 + usage.completion_tokens * 0.0000003;
      } else if (model.includes('claude')) {
        cost = usage.prompt_tokens * 0.00000025 + usage.completion_tokens * 0.00000125; // Haiku pricing
      } else {
        cost = usage.prompt_tokens * 0.00000015 + usage.completion_tokens * 0.0000006;
      }
      console.log(`[Browser Agent] Cost: $${cost.toFixed(6)} (${usage.prompt_tokens}+${usage.completion_tokens} tokens)`);
    }

    res.json({
      thinking: parsed.thinking,
      action: { ...action, timestamp: new Date() },
      model,
      usage
    });

  } catch (error) {
    console.error("[Browser Agent] Analyze error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to analyze"
    });
  }
});

/**
 * Строит промпт для Vision Mode
 */
function buildVisionPrompt(
  task: string,
  pageContext: any,
  actionsHistory: string,
  navigation: string,
  actions: string,
  forms: string,
  hasDialog: boolean,
  dialogTitle: string,
  isStuck: boolean,
  isOnTargetPage: boolean,
  targetPage: string
): string {
  return `Ты AI-агент управляющий ERP системой Emerald. Смотри на скриншот и выполни задачу.

ЗАДАЧА: ${task}

ТЕКУЩЕЕ СОСТОЯНИЕ:
- Страница: ${pageContext?.currentRoute || '/'}
- ${hasDialog ? `🔔 ДИАЛОГ ОТКРЫТ: "${dialogTitle}"` : 'Диалогов нет'}
- ${isOnTargetPage ? '✅ Ты на нужной странице' : targetPage ? `❌ Нужно перейти на ${targetPage}` : ''}

${actionsHistory ? `ИСТОРИЯ (последние действия):\n${actionsHistory}` : ''}

${isStuck ? '⚠️ ВНИМАНИЕ: Ты повторяешь одно действие! Попробуй ДРУГОЙ подход!' : ''}

ЭЛЕМЕНТЫ НА СТРАНИЦЕ:
${hasDialog ? '(В диалоге)' : ''}
${navigation ? `Навигация:\n${navigation}` : ''}
${actions ? `Кнопки действий:\n${actions}` : ''}
${forms ? `Поля формы:\n${forms}` : ''}

ПРАВИЛА:
1. Если диалог открыт - работай ТОЛЬКО с диалогом
2. Используй координаты x,y для кликов (надёжнее)
3. Не повторяй одно действие больше 2 раз
4. Если задача выполнена - верни complete

JSON ответ:
{"thinking":"краткое описание","action":{"type":"click","params":{"text":"Текст кнопки"}}}

Типы действий:
- click: {text:"кнопка"} или {x:100,y:200}
- type: {selector:"input[name=x]",text:"значение"} или {label:"Название",text:"значение"}
- navigate: {url:"/путь"}
- complete: {}`;
}

/**
 * Строит промпт для DOM Mode (без скриншота)
 */
function buildDOMPrompt(
  task: string,
  pageContext: any,
  actionsHistory: string,
  navigation: string,
  actions: string,
  forms: string,
  hasDialog: boolean,
  dialogTitle: string,
  isStuck: boolean,
  isOnTargetPage: boolean,
  targetPage: string,
  isCreateTask: boolean,
  isNavigateTask: boolean,
  agentContext: any,
  previousActions: any[]
): string {
  const currentRoute = pageContext?.currentRoute || '/';

  // Определяем что делать дальше
  let nextStepHint = '';
  let shouldComplete = false;

  if (hasDialog) {
    nextStepHint = `🔔 ДИАЛОГ "${dialogTitle}" ОТКРЫТ!\n→ Заполни поля формы и нажми кнопку подтверждения (Создать/Сохранить)`;
  } else if (!isOnTargetPage && targetPage) {
    nextStepHint = `📍 Ты на "${currentRoute}", нужно на "${targetPage}"\n→ Найди в навигации (sidebar) ссылку на нужный раздел и кликни`;
  } else if (isOnTargetPage && isCreateTask) {
    // Проверяем: если мы уже кликали на создание, но диалога нет - возможно задача выполнена
    const clickedCreate = (previousActions || []).some((a: any) =>
      a.type === 'click' && /создать|новый|добавить|\+|create|add/i.test(a.params?.text || '')
    );
    if (clickedCreate) {
      nextStepHint = `⚠️ Кнопка создания уже нажата. Если диалог не появился - задача может быть выполнена.\n→ Верни complete или попробуй другой подход`;
    } else {
      nextStepHint = `✅ Ты на нужной странице "${currentRoute}"\n→ Найди кнопку создания (Новый/Создать/+) и кликни по ней`;
    }
  } else if (isOnTargetPage && isNavigateTask) {
    nextStepHint = `✅ ЗАДАЧА ВЫПОЛНЕНА! Навигация на "${currentRoute}" успешна.\n→ ОБЯЗАТЕЛЬНО верни complete`;
    shouldComplete = true;
  }

  // Анализируем историю для определения завершения
  const lastActions = (previousActions || []).slice(-5);
  const navigatedToTarget = lastActions.some((a: any) =>
    a.type === 'navigate' || (a.result && a.result.includes('Navigated'))
  ) && isOnTargetPage;

  if (isNavigateTask && navigatedToTarget && !hasDialog) {
    shouldComplete = true;
    nextStepHint = `🎉 ЗАДАЧА НАВИГАЦИИ ВЫПОЛНЕНА! Мы на "${currentRoute}".\n→ НЕМЕДЛЕННО верни {"action":{"type":"complete"}}`;
  }

  return `Ты AI-агент ERP Emerald. Веди себя как человек: анализируй, думай, действуй.

═══════════════════════════════════════
ЗАДАЧА: ${task}
═══════════════════════════════════════
${shouldComplete ? `
🏁 ЗАДАЧА ВЫПОЛНЕНА! Верни НЕМЕДЛЕННО:
{"thinking":"Задача выполнена","action":{"type":"complete","params":{}}}
` : ''}
ТЕКУЩЕЕ СОСТОЯНИЕ:
• URL: ${currentRoute}
• Диалог: ${hasDialog ? `ДА - "${dialogTitle}"` : 'НЕТ'}
• Посещённые страницы: ${agentContext?.pagesVisited?.join(' → ') || currentRoute}

${nextStepHint ? `\n💡 ПОДСКАЗКА:\n${nextStepHint}\n` : ''}

${isStuck ? '\n⚠️ ЗАСТРЯЛ! Не повторяй то же действие. Попробуй другой элемент или подход!\n' : ''}

${actionsHistory ? `\nИСТОРИЯ ДЕЙСТВИЙ:\n${actionsHistory}\n` : ''}

═══════════════════════════════════════
ЭЛЕМЕНТЫ СТРАНИЦЫ:
═══════════════════════════════════════

${hasDialog ? '>>> ДИАЛОГ (работай только с ним!) <<<\n' : ''}

${navigation ? `🧭 НАВИГАЦИЯ (sidebar):\n${navigation}\n` : ''}
${actions ? `🔘 КНОПКИ ДЕЙСТВИЙ:\n${actions}\n` : ''}
${forms ? `📝 ПОЛЯ ФОРМЫ:\n${forms}\n` : ''}

═══════════════════════════════════════
АЛГОРИТМ:
═══════════════════════════════════════

ЕСЛИ диалог открыт:
  → Заполни все обязательные поля
  → Нажми кнопку подтверждения

ЕСЛИ нужно перейти на другую страницу:
  → Найди ссылку в НАВИГАЦИИ (не в кнопках!)
  → Кликни по ней ОДИН раз
  → После перехода - продолжай задачу

ЕСЛИ на нужной странице и нужно создать объект:
  → Найди кнопку "Новый"/"Создать"/"+"/etc в КНОПКАХ ДЕЙСТВИЙ
  → Кликни по ней

ЕСЛИ задача выполнена:
  → Верни complete

═══════════════════════════════════════
ФОРМАТ ОТВЕТА (строго JSON):
═══════════════════════════════════════

{"thinking":"что вижу и делаю","action":{"type":"ТИП","params":{...}}}

Типы действий:
• click: {"text":"текст кнопки"} - клик по кнопке/ссылке
• type: {"selector":"[name=field]","text":"значение"} или {"label":"Имя поля","text":"значение"}
• navigate: {"url":"/путь"} - прямой переход
• complete: {} - задача выполнена

ВАЖНО: Отвечай ТОЛЬКО JSON, без markdown!`;
}

/**
 * Парсит ответ от AI модели (v3 - исправлен баг с одинарными кавычками)
 *
 * ВАЖНО: Claude возвращает валидный JSON с одинарными кавычками ВНУТРИ строк
 * Например: {"selector":"[data-testid='link-проекты']"}
 *
 * Нельзя делать .replace(/'/g, '"') - это ломает такие строки!
 */
function parseAIResponse(content: string): { thinking: string; action: any } {
  console.log('[Browser Agent] Parsing response:', content.substring(0, 500));

  // Извлекаем JSON из ответа
  let jsonStr = extractJsonFromResponse(content);

  if (!jsonStr) {
    console.error('[Browser Agent] Could not extract JSON from:', content);
    return {
      thinking: content.substring(0, 200),
      action: { type: 'observe', params: {} }
    };
  }

  // ВАЖНО: Сначала пробуем парсить КАК ЕСТЬ (Claude обычно возвращает валидный JSON)
  try {
    const parsed = JSON.parse(jsonStr);
    console.log('[Browser Agent] Parsed successfully on first try');
    return {
      thinking: parsed.thinking || '',
      action: parsed.action || { type: 'observe', params: {} }
    };
  } catch (firstError) {
    console.log('[Browser Agent] First parse failed, trying to fix JSON...');
  }

  // Если не получилось - пробуем исправить типичные проблемы
  // НО НЕ трогаем одинарные кавычки внутри строк!
  const fixedJson = fixMalformedJson(jsonStr);

  try {
    const parsed = JSON.parse(fixedJson);
    console.log('[Browser Agent] Parsed successfully after fixing');
    return {
      thinking: parsed.thinking || '',
      action: parsed.action || { type: 'observe', params: {} }
    };
  } catch (secondError) {
    console.error('[Browser Agent] JSON parse error after fix:', secondError);
    console.error('[Browser Agent] Original:', jsonStr.substring(0, 300));
    console.error('[Browser Agent] Fixed:', fixedJson.substring(0, 300));
  }

  // Последняя попытка - извлекаем данные регулярками
  return extractActionManually(jsonStr);
}

/**
 * Извлекает JSON строку из ответа модели
 */
function extractJsonFromResponse(content: string): string | null {
  // 1. Ищем ```json ... ```
  let match = content.match(/```json\s*([\s\S]*?)```/);
  if (match) return match[1].trim();

  // 2. Ищем ``` ... ``` без json
  match = content.match(/```\s*([\s\S]*?)```/);
  if (match && match[1].includes('{')) return match[1].trim();

  // 3. Ищем полный JSON объект с thinking и action
  match = content.match(/\{\s*"thinking"\s*:\s*"(?:[^"\\]|\\.)*"\s*,\s*"action"\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}\s*\}/);
  if (match) return match[0];

  // 4. Более простой паттерн - от первой до последней скобки
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return content.substring(firstBrace, lastBrace + 1);
  }

  return null;
}

/**
 * Исправляет типичные проблемы JSON БЕЗ замены одинарных кавычек
 */
function fixMalformedJson(jsonStr: string): string {
  return jsonStr
    .replace(/,\s*}/g, '}')   // Убираем trailing commas перед }
    .replace(/,\s*]/g, ']')   // Убираем trailing commas перед ]
    .replace(/""+/g, '"')     // Убираем двойные кавычки ""
    // НЕ делаем .replace(/'/g, '"') - это ломает селекторы!
    // НЕ делаем .replace(/(\w+):/g, '"$1":') - Claude уже возвращает правильные ключи
    .trim();
}

/**
 * Извлекает action вручную через регулярки (fallback)
 */
function extractActionManually(jsonStr: string): { thinking: string; action: any } {
  // Извлекаем thinking
  const thinkingMatch = jsonStr.match(/"thinking"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const thinking = thinkingMatch ? thinkingMatch[1].replace(/\\"/g, '"') : 'Парсинг частичный';

  // Извлекаем type
  const typeMatch = jsonStr.match(/"type"\s*:\s*"(\w+)"/);
  const type = typeMatch ? typeMatch[1] : 'observe';

  // Извлекаем параметры
  const params: any = {};

  // text параметр
  const textMatch = jsonStr.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (textMatch) params.text = textMatch[1].replace(/\\"/g, '"');

  // selector параметр (может содержать одинарные кавычки!)
  const selectorMatch = jsonStr.match(/"selector"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (selectorMatch) params.selector = selectorMatch[1].replace(/\\"/g, '"');

  // url параметр
  const urlMatch = jsonStr.match(/"url"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (urlMatch) params.url = urlMatch[1];

  // label параметр
  const labelMatch = jsonStr.match(/"label"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (labelMatch) params.label = labelMatch[1].replace(/\\"/g, '"');

  console.log('[Browser Agent] Extracted manually:', { type, params });

  return {
    thinking,
    action: { type, params }
  };
}

/**
 * Нормализует action - убеждаемся что params существует
 */
function normalizeAction(action: any): any {
  const normalized: any = {
    type: action?.type || 'complete',
    params: action?.params || {}
  };

  // Модель может вернуть параметры напрямую в action
  if (action?.url && !normalized.params.url) {
    normalized.params.url = action.url;
  }
  if (action?.text && !normalized.params.text) {
    normalized.params.text = action.text;
  }
  if (action?.selector && !normalized.params.selector) {
    normalized.params.selector = action.selector;
  }
  if (action?.label && !normalized.params.label) {
    normalized.params.label = action.label;
  }
  if (action?.x !== undefined && normalized.params.x === undefined) {
    normalized.params.x = action.x;
  }
  if (action?.y !== undefined && normalized.params.y === undefined) {
    normalized.params.y = action.y;
  }

  return normalized;
}

/**
 * POST /api/browser-agent/start
 */
router.post("/api/browser-agent/start", async (req, res) => {
  try {
    const { task } = req.body;
    if (!task) {
      res.status(400).json({ error: "Task is required" });
      return;
    }
    const session = await browserAgentService.startSession(task);
    res.json({ status: "started", sessionId: session.id, session });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * POST /api/browser-agent/stop
 */
router.post("/api/browser-agent/stop", async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      res.status(400).json({ error: "Session ID required" });
      return;
    }
    await browserAgentService.stopSession(sessionId);
    res.json({ status: "stopped", sessionId });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/browser-agent/status/:sessionId
 */
router.get("/api/browser-agent/status/:sessionId", async (req, res) => {
  try {
    const session = browserAgentService.getSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json({ session });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/browser-agent/sessions
 */
router.get("/api/browser-agent/sessions", async (req, res) => {
  try {
    res.json({ sessions: browserAgentService.getAllSessions() });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed" });
  }
});

/**
 * GET /api/browser-agent/health
 */
router.get("/api/browser-agent/health", (req, res) => {
  const key = getOpenRouterKey();
  res.json({
    status: "ok",
    service: "browser-agent",
    version: "3.0-opus",
    mode: "vision-first",  // Теперь используем скриншоты!
    models: {
      primary: "anthropic/claude-opus-4"  // Claude Opus 4.5 - самая умная модель
    },
    hasOpenRouterKey: !!key,
    keyPrefix: key?.substring(0, 20) + '...'
  });
});
