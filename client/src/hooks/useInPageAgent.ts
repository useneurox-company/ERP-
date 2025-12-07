/**
 * useInPageAgent Hook
 *
 * Агент работает ВНУТРИ текущего окна браузера (как Comet):
 * - Делает скриншоты через html2canvas
 * - Отправляет их на бекенд для анализа Claude
 * - Выполняет действия через DOM API
 *
 * НЕ открывает отдельный браузер!
 */

import { useState, useCallback, useRef } from "react";
import html2canvas from "html2canvas";

// Типы
export interface AgentAction {
  type: "click" | "type" | "scroll" | "wait" | "navigate" | "complete";
  params?: Record<string, any>;
  timestamp: Date;
  result?: string;
}

export interface AgentSession {
  id: string;
  task: string;
  status: "idle" | "running" | "paused" | "completed" | "error";
  startedAt: Date;
  actions: AgentAction[];
  error: string | null;
}

export interface UseInPageAgentReturn {
  // Состояние
  session: AgentSession | null;
  screenshot: string | null;
  thinking: string | null;
  actions: AgentAction[];
  error: string | null;
  isRunning: boolean;

  // Методы
  startAgent: (task: string) => Promise<void>;
  stopAgent: () => void;
}

// Генерация ID сессии
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Захват скриншота текущей страницы (без overlay)
async function captureScreenshot(): Promise<string> {
  // Временно скрываем overlay
  const overlay = document.querySelector('[data-agent-overlay]');
  if (overlay) {
    (overlay as HTMLElement).style.display = 'none';
  }

  try {
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: true,
      scale: 1,
      logging: false,
      // Игнорируем overlay
      ignoreElements: (element) => {
        return element.hasAttribute('data-agent-overlay');
      }
    });

    return canvas.toDataURL('image/png');
  } finally {
    // Восстанавливаем overlay
    if (overlay) {
      (overlay as HTMLElement).style.display = '';
    }
  }
}

// Получить все интерактивные элементы на странице
function getPageElements(): any {
  const elements = {
    buttons: [] as any[],
    links: [] as any[],
    inputs: [] as any[],
    text: [] as any[]
  };

  // Кнопки
  document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach((el, idx) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      elements.buttons.push({
        index: idx,
        text: (el as HTMLElement).innerText?.trim() || (el as HTMLInputElement).value || '',
        selector: getUniqueSelector(el),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      });
    }
  });

  // Ссылки
  document.querySelectorAll('a[href]').forEach((el, idx) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      elements.links.push({
        index: idx,
        text: (el as HTMLElement).innerText?.trim() || '',
        href: (el as HTMLAnchorElement).href,
        selector: getUniqueSelector(el),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      });
    }
  });

  // Поля ввода
  document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select').forEach((el, idx) => {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      elements.inputs.push({
        index: idx,
        type: (el as HTMLInputElement).type || 'text',
        name: (el as HTMLInputElement).name || '',
        placeholder: (el as HTMLInputElement).placeholder || '',
        selector: getUniqueSelector(el),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      });
    }
  });

  return elements;
}

// Получить уникальный селектор для элемента
function getUniqueSelector(el: Element): string {
  if (el.id) return `#${el.id}`;
  if ((el as HTMLElement).dataset?.testid) return `[data-testid="${(el as HTMLElement).dataset.testid}"]`;

  const name = (el as HTMLInputElement).name;
  if (name) return `[name="${name}"]`;

  // Fallback to path
  const path: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    }
    const siblings = current.parentElement?.children;
    if (siblings && siblings.length > 1) {
      const index = Array.from(siblings).indexOf(current);
      selector += `:nth-child(${index + 1})`;
    }
    path.unshift(selector);
    current = current.parentElement;
  }
  return path.join(' > ');
}

// Показать визуальный индикатор клика
function showClickIndicator(x: number, y: number) {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    width: 30px;
    height: 30px;
    margin: -15px 0 0 -15px;
    border-radius: 50%;
    background: rgba(255, 0, 0, 0.5);
    border: 3px solid red;
    pointer-events: none;
    z-index: 999999;
    animation: pulse 0.5s ease-out;
  `;

  // Добавляем стиль анимации если его нет
  if (!document.getElementById('agent-click-animation')) {
    const style = document.createElement('style');
    style.id = 'agent-click-animation';
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(0.5); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(indicator);
  setTimeout(() => indicator.remove(), 500);
}

// Выполнить действие на странице
async function executeAction(action: AgentAction): Promise<string> {
  switch (action.type) {
    case 'click': {
      let element: Element | null = null;

      if (action.params?.text) {
        // Поиск по тексту
        const allElements = document.querySelectorAll('button, a, [role="button"], input[type="submit"], span, div');
        for (const el of allElements) {
          if ((el as HTMLElement).innerText?.includes(action.params.text)) {
            element = el;
            break;
          }
        }
      } else if (action.params?.selector) {
        element = document.querySelector(action.params.selector);
      }

      if (!element) {
        throw new Error(`Element not found: ${action.params?.text || action.params?.selector}`);
      }

      const rect = element.getBoundingClientRect();
      showClickIndicator(rect.x + rect.width / 2, rect.y + rect.height / 2);

      (element as HTMLElement).click();
      await new Promise(r => setTimeout(r, 300));
      return `Clicked: ${action.params?.text || action.params?.selector}`;
    }

    case 'type': {
      const element = document.querySelector(action.params?.selector) as HTMLInputElement | HTMLTextAreaElement;
      if (!element) {
        throw new Error(`Input not found: ${action.params?.selector}`);
      }

      if (action.params?.clear) {
        element.value = '';
      }

      // Симулируем ввод с фокусом
      element.focus();
      element.value = action.params?.text || '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return `Typed: "${action.params?.text}"`;
    }

    case 'scroll': {
      if (action.params?.selector) {
        const element = document.querySelector(action.params.selector);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollBy({
          top: action.params?.y || 300,
          behavior: 'smooth'
        });
      }
      await new Promise(r => setTimeout(r, 500));
      return 'Scrolled';
    }

    case 'wait': {
      await new Promise(r => setTimeout(r, action.params?.ms || 1000));
      return `Waited ${action.params?.ms || 1000}ms`;
    }

    case 'navigate': {
      window.location.href = action.params?.url;
      return `Navigating to ${action.params?.url}`;
    }

    case 'complete': {
      return 'Task completed';
    }

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

export function useInPageAgent(): UseInPageAgentReturn {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [error, setError] = useState<string | null>(null);

  const stopRequestedRef = useRef(false);
  const isRunning = session?.status === 'running';

  // Отправить скриншот на бекенд для анализа Claude
  const analyzeWithClaude = async (
    screenshotData: string,
    task: string,
    previousActions: AgentAction[],
    pageElements: any
  ): Promise<{ thinking: string; action: AgentAction }> => {
    const response = await fetch('/api/browser-agent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot: screenshotData,
        task,
        previousActions,
        pageElements
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze');
    }

    return response.json();
  };

  // Основной цикл агента
  const runAgentLoop = async (task: string, sessionId: string) => {
    let iterations = 0;
    const MAX_ITERATIONS = 30;

    while (!stopRequestedRef.current && iterations < MAX_ITERATIONS) {
      iterations++;

      try {
        // 1. Делаем скриншот текущей страницы
        const screenshotData = await captureScreenshot();
        setScreenshot(screenshotData);

        // 2. Получаем элементы страницы
        const pageElements = getPageElements();

        // 3. Отправляем на анализ Claude
        const currentActions = actions;
        const analysis = await analyzeWithClaude(
          screenshotData,
          task,
          currentActions,
          pageElements
        );

        setThinking(analysis.thinking);

        // 4. Выполняем действие
        const action = {
          ...analysis.action,
          timestamp: new Date()
        };

        setActions(prev => [...prev, action]);

        if (action.type === 'complete') {
          setSession(prev => prev ? { ...prev, status: 'completed' } : null);
          break;
        }

        const result = await executeAction(action);
        action.result = result;

        // 5. Ждём после действия
        await new Promise(r => setTimeout(r, 1000));

      } catch (err) {
        console.error('[InPageAgent] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');

        // Пауза перед retry
        await new Promise(r => setTimeout(r, 2000));
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      setSession(prev => prev ? { ...prev, status: 'error', error: 'Max iterations reached' } : null);
    }
  };

  // Запуск агента
  const startAgent = useCallback(async (task: string) => {
    const sessionId = generateSessionId();

    const newSession: AgentSession = {
      id: sessionId,
      task,
      status: 'running',
      startedAt: new Date(),
      actions: [],
      error: null
    };

    setSession(newSession);
    setActions([]);
    setScreenshot(null);
    setThinking(null);
    setError(null);
    stopRequestedRef.current = false;

    // Запускаем цикл агента
    runAgentLoop(task, sessionId).catch(err => {
      console.error('[InPageAgent] Loop error:', err);
      setSession(prev => prev ? { ...prev, status: 'error', error: err.message } : null);
    });
  }, []);

  // Остановка агента
  const stopAgent = useCallback(() => {
    stopRequestedRef.current = true;
    setSession(prev => prev ? { ...prev, status: 'paused' } : null);
  }, []);

  return {
    session,
    screenshot,
    thinking,
    actions,
    error,
    isRunning,
    startAgent,
    stopAgent
  };
}
