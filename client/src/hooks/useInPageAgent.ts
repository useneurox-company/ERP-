/**
 * useInPageAgent Hook v3.0 - Comet-style Visual Agent
 *
 * Архитектура как у Comet:
 * 1. Vision Mode - скриншоты + AI анализ (опционально)
 * 2. SmartPageAnalyzer - DOM анализ с контекстом
 * 3. ActionExecutor - выполнение с визуальным фидбеком
 * 4. Floating Indicator - показывает что делает агент на странице
 * 5. Step History - история со скриншотами для отображения в панели
 *
 * Поддержка до 100 шагов с сохранением состояния
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ============= ТИПЫ =============

export interface AgentAction {
  type: "click" | "type" | "scroll" | "wait" | "navigate" | "complete" | "verify" | "observe" | "read" | "search";
  params?: Record<string, any>;
  timestamp: Date;
  result?: string;
  verified?: boolean;
  stepNumber?: number;
  screenshot?: string; // Base64 миниатюра скриншота
  thinking?: string;   // Что думал агент перед действием
}

export interface TaskStep {
  id: number;
  description: string;
  expectedAction: string;
  completed: boolean;
  attempts: number;
}

export interface PageElement {
  text: string;
  type: 'button' | 'link' | 'input' | 'select' | 'checkbox' | 'other';
  category: 'navigation' | 'action' | 'form' | 'info';
  location: 'sidebar' | 'header' | 'main' | 'dialog' | 'footer';
  selector: string;
  x: number;
  y: number;
  enabled: boolean;
  attributes?: Record<string, string>;
}

export interface PageState {
  url: string;
  route: string;
  title: string;
  hasDialog: boolean;
  dialogTitle?: string;
  visibleText: string;
  elements: {
    navigation: PageElement[];
    actions: PageElement[];
    forms: PageElement[];
  };
  viewport: { width: number; height: number };
}

export interface AgentMemory {
  task: string;
  plan: TaskStep[];
  currentStep: number;
  actions: AgentAction[];
  pageHistory: string[];
  failedAttempts: Map<string, number>;
  startTime: number;
  filledFields: Set<string>; // Отслеживание заполненных полей
  dialogActionsCount: number; // Счётчик действий в диалоге
}

export interface AgentSession {
  id: string;
  task: string;
  status: "idle" | "planning" | "running" | "paused" | "completed" | "error";
  startedAt: Date;
  actions: AgentAction[];
  currentStep?: TaskStep;
  totalSteps?: number;
  error: string | null;
}

export interface UseInPageAgentReturn {
  session: AgentSession | null;
  screenshot: string | null;
  thinking: string | null;
  actions: AgentAction[];
  error: string | null;
  isRunning: boolean;
  currentStep: TaskStep | null;
  totalSteps: number;
  startAgent: (task: string) => Promise<void>;
  stopAgent: () => void;
}

// ============= КОНСТАНТЫ =============

const MAX_ITERATIONS = 100; // До 100 шагов
const AGENT_STATE_KEY = 'emerald_agent_state'; // Должен совпадать с App.tsx и AssistantPanel.tsx
const HUMAN_DELAY_MIN = 300;
const HUMAN_DELAY_MAX = 800;
const MAX_RETRIES_PER_STEP = 3;

// ============= УТИЛИТЫ =============

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

// Человеческая задержка (случайная)
function humanDelay(): Promise<void> {
  const delay = HUMAN_DELAY_MIN + Math.random() * (HUMAN_DELAY_MAX - HUMAN_DELAY_MIN);
  return new Promise(r => setTimeout(r, delay));
}

// Короткая задержка для реакции
function shortDelay(ms: number = 200): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ============= SMART PAGE ANALYZER =============

function getElementLocation(el: Element): 'sidebar' | 'header' | 'main' | 'dialog' | 'footer' {
  // Проверяем диалог
  if (el.closest('[role="dialog"], [data-radix-dialog-content], .modal')) {
    return 'dialog';
  }
  // Проверяем сайдбар
  if (el.closest('aside, [data-sidebar], nav, [class*="sidebar"], [class*="Sidebar"]')) {
    return 'sidebar';
  }
  // Проверяем хедер
  if (el.closest('header, [class*="header"], [class*="Header"], [class*="topbar"], [class*="TopBar"]')) {
    return 'header';
  }
  // Проверяем футер
  if (el.closest('footer, [class*="footer"], [class*="Footer"]')) {
    return 'footer';
  }
  return 'main';
}

function getElementCategory(el: Element, location: string): 'navigation' | 'action' | 'form' | 'info' {
  const tagName = el.tagName.toLowerCase();

  // Навигационные ссылки в сайдбаре
  if (location === 'sidebar' && tagName === 'a') {
    return 'navigation';
  }

  // Формы
  if (['input', 'textarea', 'select'].includes(tagName) || el.getAttribute('role') === 'combobox') {
    return 'form';
  }

  // Кнопки действий
  if (tagName === 'button' || el.getAttribute('role') === 'button') {
    return 'action';
  }

  // Ссылки
  if (tagName === 'a') {
    const href = el.getAttribute('href');
    if (href && href.startsWith('/')) {
      return 'navigation';
    }
    return 'action';
  }

  return 'info';
}

function getUniqueSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const htmlEl = el as HTMLElement;
  if (htmlEl.dataset?.testid) return `[data-testid="${htmlEl.dataset.testid}"]`;

  const name = (el as HTMLInputElement).name;
  if (name) return `[name="${name}"]`;

  // Для кнопок и ссылок - по тексту
  const text = htmlEl.innerText?.trim();
  if (text && text.length < 50) {
    const tagName = el.tagName.toLowerCase();
    if (['button', 'a'].includes(tagName)) {
      return `${tagName}:has-text("${text.substring(0, 30)}")`;
    }
  }

  // Fallback: путь по DOM
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

function analyzePageState(): PageState {
  const result: PageState = {
    url: window.location.href,
    route: window.location.pathname,
    title: document.title,
    hasDialog: false,
    visibleText: '',
    elements: {
      navigation: [],
      actions: [],
      forms: []
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };

  // Проверяем диалоги
  const dialogs = document.querySelectorAll('[role="dialog"], [data-radix-dialog-content], .modal, [class*="Dialog"]:not([class*="trigger"])');
  if (dialogs.length > 0) {
    result.hasDialog = true;
    const firstDialog = dialogs[0];
    result.dialogTitle = firstDialog.querySelector('h1, h2, h3, [class*="title"], [class*="Title"]')?.textContent?.trim() || 'Диалог';
  }

  // Собираем видимый текст (компактно)
  const mainContent = result.hasDialog
    ? document.querySelector('[role="dialog"], [data-radix-dialog-content]') || document.body
    : document.querySelector('main') || document.body;

  const texts: string[] = [];
  const walker = document.createTreeWalker(mainContent, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const style = window.getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  let node;
  while (node = walker.nextNode()) {
    const text = node.textContent?.trim();
    if (text && text.length > 2) texts.push(text);
  }
  result.visibleText = texts.slice(0, 30).join(' | ').substring(0, 500);

  // Собираем элементы с категоризацией
  const processElement = (el: Element, type: PageElement['type']) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || rect.top > window.innerHeight || rect.bottom < 0) {
      return null;
    }

    const htmlEl = el as HTMLElement;
    const location = getElementLocation(el);
    const category = getElementCategory(el, location);

    // Если диалог открыт, игнорируем элементы вне диалога
    if (result.hasDialog && location !== 'dialog') {
      return null;
    }

    const text = htmlEl.innerText?.trim() ||
                 (el as HTMLInputElement).value ||
                 htmlEl.getAttribute('aria-label') ||
                 htmlEl.getAttribute('placeholder') ||
                 '';

    const element: PageElement = {
      text: text.substring(0, 100),
      type,
      category,
      location,
      selector: getUniqueSelector(el),
      x: Math.round(rect.x + rect.width / 2),
      y: Math.round(rect.y + rect.height / 2),
      enabled: !(el as HTMLButtonElement).disabled && htmlEl.getAttribute('aria-disabled') !== 'true'
    };

    // Дополнительные атрибуты для форм
    if (type === 'input' || type === 'select') {
      element.attributes = {
        name: (el as HTMLInputElement).name || '',
        type: (el as HTMLInputElement).type || '',
        placeholder: (el as HTMLInputElement).placeholder || '',
        required: String((el as HTMLInputElement).required || false)
      };

      // Ищем label
      const label = document.querySelector(`label[for="${(el as HTMLInputElement).id}"]`);
      if (label) {
        element.attributes.label = label.textContent?.trim() || '';
      }
    }

    return element;
  };

  // Кнопки
  document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(el => {
    const elem = processElement(el, 'button');
    if (elem) {
      if (elem.category === 'navigation') {
        result.elements.navigation.push(elem);
      } else {
        result.elements.actions.push(elem);
      }
    }
  });

  // Ссылки
  document.querySelectorAll('a[href]').forEach(el => {
    const elem = processElement(el, 'link');
    if (elem) {
      if (elem.category === 'navigation') {
        result.elements.navigation.push(elem);
      } else {
        result.elements.actions.push(elem);
      }
    }
  });

  // Поля ввода
  document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea, select, [role="combobox"]').forEach(el => {
    const type = el.tagName.toLowerCase() === 'select' ? 'select' : 'input';
    const elem = processElement(el, type);
    if (elem) {
      result.elements.forms.push(elem);
    }
  });

  return result;
}

// ============= VISUAL INDICATORS =============

function showClickIndicator(x: number, y: number) {
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    left: ${x}px;
    top: ${y}px;
    width: 40px;
    height: 40px;
    margin: -20px 0 0 -20px;
    border-radius: 50%;
    background: rgba(59, 130, 246, 0.4);
    border: 3px solid #3b82f6;
    pointer-events: none;
    z-index: 999999;
    animation: agentPulse 0.6s ease-out forwards;
  `;

  if (!document.getElementById('agent-click-animation')) {
    const style = document.createElement('style');
    style.id = 'agent-click-animation';
    style.textContent = `
      @keyframes agentPulse {
        0% { transform: scale(0.3); opacity: 1; }
        100% { transform: scale(2); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(indicator);
  setTimeout(() => indicator.remove(), 600);
}

function showTypeIndicator(element: Element) {
  const rect = element.getBoundingClientRect();
  const indicator = document.createElement('div');
  indicator.style.cssText = `
    position: fixed;
    left: ${rect.left - 3}px;
    top: ${rect.top - 3}px;
    width: ${rect.width + 6}px;
    height: ${rect.height + 6}px;
    border: 2px solid #10b981;
    border-radius: 4px;
    pointer-events: none;
    z-index: 999999;
    animation: agentTyping 0.3s ease-out forwards;
  `;

  if (!document.getElementById('agent-typing-animation')) {
    const style = document.createElement('style');
    style.id = 'agent-typing-animation';
    style.textContent = `
      @keyframes agentTyping {
        0% { opacity: 0; }
        50% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(indicator);
  setTimeout(() => indicator.remove(), 300);
}

// ============= FLOATING ACTION INDICATOR (как у Comet) =============

let floatingIndicator: HTMLDivElement | null = null;

function showFloatingIndicator(text: string, type: 'click' | 'type' | 'navigate' | 'search' | 'read' | 'thinking' = 'thinking') {
  // Удаляем предыдущий
  hideFloatingIndicator();

  const icons: Record<string, string> = {
    click: '🖱️',
    type: '⌨️',
    navigate: '🔗',
    search: '🔍',
    read: '📖',
    thinking: '💭'
  };

  floatingIndicator = document.createElement('div');
  floatingIndicator.id = 'agent-floating-indicator';
  floatingIndicator.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    color: white;
    padding: 12px 24px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideUp 0.3s ease-out;
    backdrop-filter: blur(8px);
  `;

  // Добавляем стили анимации
  if (!document.getElementById('agent-floating-animation')) {
    const style = document.createElement('style');
    style.id = 'agent-floating-animation';
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(20px); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      .agent-indicator-spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  floatingIndicator.innerHTML = `
    <div class="agent-indicator-spinner"></div>
    <span>${icons[type] || '✨'}</span>
    <span>${text}</span>
  `;

  document.body.appendChild(floatingIndicator);
}

function hideFloatingIndicator() {
  if (floatingIndicator) {
    floatingIndicator.remove();
    floatingIndicator = null;
  }
}

function updateFloatingIndicator(text: string, type?: 'click' | 'type' | 'navigate' | 'search' | 'read' | 'thinking') {
  if (floatingIndicator) {
    const icons: Record<string, string> = {
      click: '🖱️',
      type: '⌨️',
      navigate: '🔗',
      search: '🔍',
      read: '📖',
      thinking: '💭'
    };
    const icon = type ? (icons[type] || '✨') : '';
    floatingIndicator.innerHTML = `
      <div class="agent-indicator-spinner"></div>
      <span>${icon}</span>
      <span>${text}</span>
    `;
  } else {
    showFloatingIndicator(text, type);
  }
}

// ============= SCREENSHOT CAPTURE =============

// Создаём информативную DOM-карту страницы (без html2canvas - он не поддерживает modern CSS)
async function captureScreenshot(): Promise<string | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 220;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Фон
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 320, 220);

    // Сайдбар
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 50, 220);

    // Хедер
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(50, 0, 270, 28);

    // URL в хедере
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px sans-serif';
    const path = window.location.pathname;
    ctx.fillText(path.length > 35 ? path.substring(0, 35) + '...' : path, 55, 18);

    // Контент
    ctx.fillStyle = '#334155';
    ctx.fillRect(55, 33, 260, 182);

    // Проверяем есть ли диалог
    const dialog = document.querySelector('[role="dialog"], [data-radix-dialog-content]');
    if (dialog) {
      // Overlay
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(50, 28, 270, 192);

      // Диалог
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(90, 55, 180, 130, 8);
      ctx.fill();

      // Граница диалога
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Заголовок диалога
      const dialogTitle = dialog.querySelector('h1, h2, h3, [class*="title"], [class*="Title"]')?.textContent?.trim() || 'Диалог';
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(dialogTitle.substring(0, 25), 100, 75);

      // Количество полей в диалоге
      const inputs = dialog.querySelectorAll('input, textarea, select');
      const buttons = dialog.querySelectorAll('button');
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.fillText(`Полей: ${inputs.length} | Кнопок: ${buttons.length}`, 100, 95);

      // Кнопки диалога
      let btnY = 110;
      buttons.forEach((btn, i) => {
        if (i < 3) {
          const text = (btn as HTMLElement).innerText?.trim().substring(0, 20) || 'Кнопка';
          ctx.fillStyle = '#475569';
          ctx.fillRect(100, btnY, 120, 18);
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '9px sans-serif';
          ctx.fillText(text, 105, btnY + 13);
          btnY += 22;
        }
      });
    } else {
      // Показываем основные элементы страницы
      const mainContent = document.querySelector('main') || document.body;

      // Заголовок страницы
      const pageTitle = document.querySelector('h1, h2, [class*="title"]')?.textContent?.trim() || 'Страница';
      ctx.fillStyle = '#f1f5f9';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(pageTitle.substring(0, 35), 60, 50);

      // Кнопки на странице
      const buttons = mainContent.querySelectorAll('button:not([disabled])');
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px sans-serif';
      ctx.fillText(`Кнопок: ${buttons.length}`, 60, 70);

      // Отображаем первые кнопки
      let btnY = 85;
      let btnCount = 0;
      buttons.forEach((btn) => {
        const text = (btn as HTMLElement).innerText?.trim();
        if (text && text.length > 0 && text.length < 30 && btnCount < 5) {
          ctx.fillStyle = '#10b981';
          ctx.fillRect(60, btnY, Math.min(text.length * 6 + 10, 200), 16);
          ctx.fillStyle = '#ffffff';
          ctx.font = '9px sans-serif';
          ctx.fillText(text.substring(0, 30), 65, btnY + 12);
          btnY += 20;
          btnCount++;
        }
      });

      // Формы
      const inputs = mainContent.querySelectorAll('input:not([type="hidden"]), textarea');
      if (inputs.length > 0) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px sans-serif';
        ctx.fillText(`Полей ввода: ${inputs.length}`, 60, btnY + 15);
      }
    }

    // Метка что это DOM Preview
    ctx.fillStyle = '#3b82f6';
    ctx.font = '8px sans-serif';
    ctx.fillText('DOM Preview', 255, 215);

    return canvas.toDataURL('image/png', 0.9);
  } catch (err) {
    console.warn('[Agent] Screenshot capture failed:', err);
    return null;
  }
}

// ============= ACTION EXECUTOR =============

async function executeAction(action: AgentAction, pageState: PageState): Promise<{ success: boolean; result: string; verified: boolean }> {
  let verified = false;

  switch (action.type) {
    case 'click': {
      let element: Element | null = null;
      let clickX: number | undefined;
      let clickY: number | undefined;

      const dialogsBefore = document.querySelectorAll('[role="dialog"], [data-radix-dialog-content]').length;
      const urlBefore = window.location.pathname;

      // Приоритет 1: координаты
      if (typeof action.params?.x === 'number' && typeof action.params?.y === 'number') {
        clickX = action.params.x;
        clickY = action.params.y;
        element = document.elementFromPoint(clickX, clickY);
      }
      // Приоритет 2: текст
      else if (action.params?.text) {
        const searchText = action.params.text.toLowerCase();

        // Если диалог открыт, ищем только в диалоге
        const searchContainer = pageState.hasDialog
          ? document.querySelector('[role="dialog"], [data-radix-dialog-content]') || document.body
          : document.body;

        // Точное совпадение
        const buttons = Array.from(searchContainer.querySelectorAll('button, [role="button"], input[type="submit"], a'));
        for (const el of buttons) {
          const text = (el as HTMLElement).innerText?.trim().toLowerCase();
          if (text === searchText) {
            element = el;
            const rect = el.getBoundingClientRect();
            clickX = rect.x + rect.width / 2;
            clickY = rect.y + rect.height / 2;
            break;
          }
        }

        // Частичное совпадение
        if (!element) {
          for (const el of buttons) {
            const text = (el as HTMLElement).innerText?.trim().toLowerCase();
            if (text && text.includes(searchText)) {
              element = el;
              const rect = el.getBoundingClientRect();
              clickX = rect.x + rect.width / 2;
              clickY = rect.y + rect.height / 2;
              break;
            }
          }
        }
      }
      // Приоритет 3: селектор
      else if (action.params?.selector) {
        try {
          element = document.querySelector(action.params.selector);
          if (element) {
            const rect = element.getBoundingClientRect();
            clickX = rect.x + rect.width / 2;
            clickY = rect.y + rect.height / 2;
          }
        } catch (selectorError) {
          console.warn(`[Agent] Invalid selector: ${action.params.selector}`, selectorError);
        }
      }

      // Если элемент не найден - пробуем умный поиск
      if (!element) {
        const searchText = action.params?.text?.toLowerCase() || '';
        const mainContent = document.querySelector('main') || document.body;
        const allButtons = Array.from(mainContent.querySelectorAll('button, [role="button"], a[href]'));

        // Ищем кнопку "+" для добавления
        if (searchText.includes('+') || searchText.includes('добав') || searchText.includes('новый') || searchText.includes('создать') || searchText.includes('new') || searchText.includes('add')) {
          for (const btn of allButtons) {
            const text = (btn as HTMLElement).innerText?.trim();
            const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
            // Ищем кнопку с "+" или иконкой добавления
            if (text === '+' || text === '＋' || ariaLabel.includes('добав') || ariaLabel.includes('add') || ariaLabel.includes('new')) {
              element = btn;
              const rect = btn.getBoundingClientRect();
              clickX = rect.x + rect.width / 2;
              clickY = rect.y + rect.height / 2;
              console.log(`[Agent] Found add button: "${text || ariaLabel}"`);
              break;
            }
          }
        }

        // Ищем по SVG иконке (Plus icon)
        if (!element) {
          const svgButtons = Array.from(mainContent.querySelectorAll('button svg, [role="button"] svg'));
          for (const svg of svgButtons) {
            const paths = Array.from(svg.querySelectorAll('path, line'));
            const isPlus = paths.some((p: Element) => {
              const d = p.getAttribute('d') || '';
              return d.includes('M12 5v14') || d.includes('M5 12h14'); // Lucide plus icon
            });
            if (isPlus) {
              element = svg.closest('button, [role="button"]');
              if (element) {
                const rect = element.getBoundingClientRect();
                clickX = rect.x + rect.width / 2;
                clickY = rect.y + rect.height / 2;
                console.log('[Agent] Found button with Plus icon');
                break;
              }
            }
          }
        }
      }

      if (!element) {
        return { success: false, result: `Element not found: ${JSON.stringify(action.params)}`, verified: false };
      }

      // Визуальный индикатор
      if (clickX !== undefined && clickY !== undefined) {
        showClickIndicator(clickX, clickY);
      }

      // Проверяем на навигационную ссылку
      const linkElement = element.closest('a');
      if (linkElement) {
        const href = linkElement.getAttribute('href');
        if (href && href.startsWith('/')) {
          console.log(`[Agent] Navigating to: ${href}`);
          window.location.assign(href);
          await shortDelay(800);
          return {
            success: true,
            result: `Navigated to ${href}`,
            verified: window.location.pathname !== urlBefore
          };
        }
      }

      // Клик по элементу
      const htmlElement = element as HTMLElement;
      htmlElement.focus?.();
      htmlElement.click();

      await shortDelay(300);

      // Верификация: появился диалог?
      const dialogsAfter = document.querySelectorAll('[role="dialog"], [data-radix-dialog-content]').length;
      if (dialogsAfter > dialogsBefore) {
        return { success: true, result: `Clicked "${action.params?.text}" - dialog opened`, verified: true };
      }

      // Верификация: изменился URL?
      if (window.location.pathname !== urlBefore) {
        return { success: true, result: `Clicked "${action.params?.text}" - navigated`, verified: true };
      }

      // Дополнительные методы клика
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await shortDelay(50);
      element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      await shortDelay(500);

      // Финальная верификация
      const dialogsFinal = document.querySelectorAll('[role="dialog"], [data-radix-dialog-content]').length;
      verified = dialogsFinal > dialogsBefore || window.location.pathname !== urlBefore;

      return {
        success: true,
        result: `Clicked: ${action.params?.text || action.params?.selector || 'element'}`,
        verified
      };
    }

    case 'type': {
      let element: HTMLInputElement | HTMLTextAreaElement | null = null;

      // Поиск по разным критериям
      if (action.params?.selector) {
        element = document.querySelector(action.params.selector);
      }
      if (!element && action.params?.name) {
        element = document.querySelector(`[name="${action.params.name}"]`);
      }
      if (!element && action.params?.placeholder) {
        element = document.querySelector(`[placeholder*="${action.params.placeholder}"]`);
      }
      if (!element && action.params?.label) {
        const labels = Array.from(document.querySelectorAll('label'));
        for (const label of labels) {
          if (label.textContent?.toLowerCase().includes(action.params.label.toLowerCase())) {
            const forId = label.getAttribute('for');
            if (forId) element = document.getElementById(forId) as HTMLInputElement;
            else element = label.querySelector('input, textarea') as HTMLInputElement;
            if (element) break;
          }
        }
      }

      if (!element) {
        return { success: false, result: `Input not found: ${JSON.stringify(action.params)}`, verified: false };
      }

      showTypeIndicator(element);

      element.focus();
      element.value = action.params?.text || '';
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      // Верификация: значение установлено
      verified = element.value === action.params?.text;

      return {
        success: true,
        result: `Typed: "${action.params?.text}"`,
        verified
      };
    }

    case 'scroll': {
      if (action.params?.selector) {
        const element = document.querySelector(action.params.selector);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        window.scrollBy({ top: action.params?.y || 300, behavior: 'smooth' });
      }
      await shortDelay(500);
      return { success: true, result: 'Scrolled', verified: true };
    }

    case 'wait': {
      await new Promise(r => setTimeout(r, action.params?.ms || 1000));
      return { success: true, result: `Waited ${action.params?.ms || 1000}ms`, verified: true };
    }

    case 'navigate': {
      const url = action.params?.url;
      if (!url) {
        return { success: false, result: 'Navigate action missing URL', verified: false };
      }

      const urlBefore = window.location.pathname;

      if (url.startsWith('/')) {
        window.location.assign(url);
        await shortDelay(800);
        return { success: true, result: `Navigated to ${url}`, verified: window.location.pathname !== urlBefore };
      }

      window.location.href = url;
      return { success: true, result: `Navigating to ${url}`, verified: true };
    }

    case 'observe': {
      // Агент "смотрит" на страницу без действий
      await humanDelay();
      return { success: true, result: 'Observed page state', verified: true };
    }

    case 'verify': {
      // Проверяем условие
      const condition = action.params?.condition;
      if (condition === 'dialog_open') {
        verified = document.querySelectorAll('[role="dialog"]').length > 0;
        return { success: true, result: `Dialog ${verified ? 'is' : 'not'} open`, verified };
      }
      if (condition === 'url_contains') {
        verified = window.location.pathname.includes(action.params?.value || '');
        return { success: true, result: `URL ${verified ? 'contains' : 'does not contain'} ${action.params?.value}`, verified };
      }
      return { success: true, result: 'Verification complete', verified: true };
    }

    case 'complete': {
      return { success: true, result: 'Task completed', verified: true };
    }

    default:
      return { success: false, result: `Unknown action type: ${action.type}`, verified: false };
  }
}

// ============= STATE MANAGEMENT =============

function saveAgentState(memory: AgentMemory) {
  sessionStorage.setItem(AGENT_STATE_KEY, JSON.stringify({
    ...memory,
    failedAttempts: Array.from(memory.failedAttempts.entries()),
    filledFields: Array.from(memory.filledFields),
    timestamp: Date.now()
  }));
}

function loadAgentState(): AgentMemory | null {
  try {
    const saved = sessionStorage.getItem(AGENT_STATE_KEY);
    if (!saved) return null;

    const state = JSON.parse(saved);
    if (Date.now() - state.timestamp > 10 * 60 * 1000) { // 10 минут timeout
      sessionStorage.removeItem(AGENT_STATE_KEY);
      return null;
    }

    return {
      ...state,
      failedAttempts: new Map(state.failedAttempts || []),
      filledFields: new Set(state.filledFields || []),
      dialogActionsCount: state.dialogActionsCount || 0
    };
  } catch {
    return null;
  }
}

function clearAgentState() {
  sessionStorage.removeItem(AGENT_STATE_KEY);
}

// ============= MAIN HOOK =============

export function useInPageAgent(): UseInPageAgentReturn {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [thinking, setThinking] = useState<string | null>(null);
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<TaskStep | null>(null);
  const [totalSteps, setTotalSteps] = useState<number>(0);

  const stopRequestedRef = useRef(false);
  const isRunning = session?.status === 'running' || session?.status === 'planning';
  const hasResumedRef = useRef(false);
  const memoryRef = useRef<AgentMemory | null>(null);

  // Восстановление после навигации
  useEffect(() => {
    if (hasResumedRef.current) return;

    const savedState = loadAgentState();
    if (savedState) {
      hasResumedRef.current = true;
      console.log('[Agent] Resuming from saved state:', savedState.task);

      memoryRef.current = savedState;

      const resumedSession: AgentSession = {
        id: `resumed_${Date.now()}`,
        task: savedState.task,
        status: 'running',
        startedAt: new Date(savedState.startTime),
        actions: savedState.actions,
        error: null
      };

      setSession(resumedSession);
      setActions(savedState.actions);
      setTotalSteps(savedState.plan.length);
      setCurrentStep(savedState.plan[savedState.currentStep] || null);

      runAgentLoop(savedState).catch(err => {
        console.error('[Agent] Resume error:', err);
        setSession(prev => prev ? { ...prev, status: 'error', error: err.message } : null);
      });
    }
  }, []);

  // Анализ задачи через API
  const analyzeWithAI = async (
    pageState: PageState,
    memory: AgentMemory
  ): Promise<{ thinking: string; action: AgentAction; plan?: TaskStep[] }> => {
    const response = await fetch('/api/browser-agent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot: null, // DOM-only mode
        pageContext: {
          url: pageState.url,
          currentRoute: pageState.route,
          title: pageState.title,
          visibleText: pageState.visibleText,
          viewportSize: pageState.viewport
        },
        task: memory.task,
        previousActions: memory.actions.slice(-10), // Последние 10 действий
        pageElements: {
          // Структурированные элементы для модели
          navigation: pageState.elements.navigation.slice(0, 15),
          actions: pageState.elements.actions.slice(0, 15),
          forms: pageState.elements.forms.slice(0, 10),
          dialogs: pageState.hasDialog ? [{ isOpen: true, title: pageState.dialogTitle }] : []
        },
        // Дополнительный контекст
        agentContext: {
          currentStep: memory.currentStep,
          totalSteps: memory.plan.length,
          stepDescription: memory.plan[memory.currentStep]?.description || '',
          pagesVisited: memory.pageHistory.slice(-5),
          hasDialog: pageState.hasDialog,
          dialogTitle: pageState.dialogTitle
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze');
    }

    return response.json();
  };

  // Определяет тип задачи
  const analyzeTaskType = (task: string) => {
    const taskLower = task.toLowerCase();
    const isNavigate = /открой|открыть|перейди|перейти|go to|navigate|показ/i.test(taskLower);
    const isCreate = /создай|создать|добавь|добавить|новый|new|create|add/i.test(taskLower);

    let targetPage = '';
    if (/проект/i.test(taskLower)) targetPage = 'projects';
    else if (/клиент/i.test(taskLower)) targetPage = 'clients';
    else if (/поставщик/i.test(taskLower)) targetPage = 'suppliers';
    else if (/закупк/i.test(taskLower)) targetPage = 'procurement';
    else if (/монтаж/i.test(taskLower)) targetPage = 'montage';
    else if (/настройк/i.test(taskLower)) targetPage = 'settings';
    else if (/финанс/i.test(taskLower)) targetPage = 'finance';
    else if (/склад/i.test(taskLower)) targetPage = 'warehouse';

    return { isNavigate, isCreate, targetPage };
  };

  // Основной цикл агента
  const runAgentLoop = async (initialMemory: AgentMemory) => {
    const memory = initialMemory;
    memoryRef.current = memory;

    let iteration = memory.actions.length;
    let consecutiveErrors = 0;
    let lastActionKey = '';
    let sameActionCount = 0;

    // Определяем тип задачи для auto-completion
    const taskType = analyzeTaskType(memory.task);
    console.log('[Agent] Task type:', taskType);

    setThinking('Анализирую задачу...');
    showFloatingIndicator('Анализирую задачу...', 'thinking');

    while (!stopRequestedRef.current && iteration < MAX_ITERATIONS) {
      iteration++;

      try {
        // 1. Человеческая пауза перед анализом
        await humanDelay();

        // 2. Показываем что анализируем
        updateFloatingIndicator(`Шаг ${iteration}: Анализирую страницу...`, 'read');

        // 3. Анализируем страницу
        const pageState = analyzePageState();

        // Добавляем в историю
        if (!memory.pageHistory.includes(pageState.route)) {
          memory.pageHistory.push(pageState.route);
        }

        // AUTO-COMPLETION: Для навигационных задач - завершаем автоматически
        if (taskType.isNavigate && !taskType.isCreate && taskType.targetPage && pageState.route.includes(taskType.targetPage)) {
          console.log(`[Agent] AUTO-COMPLETE: Navigation task done. Target "${taskType.targetPage}" reached at "${pageState.route}"`);
          setThinking(`Готово! Мы на странице ${pageState.route}`);
          updateFloatingIndicator('Задача выполнена!', 'navigate');

          const completeAction: AgentAction = {
            type: 'complete',
            params: {},
            timestamp: new Date(),
            result: `Navigated to ${pageState.route}`,
            verified: true,
            stepNumber: iteration,
            thinking: `Задача навигации выполнена: мы на странице ${pageState.route}`
          };

          memory.actions.push(completeAction);
          setActions(prev => [...prev, completeAction]);

          await shortDelay(500);
          hideFloatingIndicator();
          setSession(prev => prev ? { ...prev, status: 'completed' } : null);
          clearAgentState();
          break;
        }

        // Отслеживаем действия в диалоге
        if (pageState.hasDialog) {
          memory.dialogActionsCount++;
          console.log(`[Agent] Dialog action #${memory.dialogActionsCount}`);
        } else {
          memory.dialogActionsCount = 0;
          memory.filledFields.clear(); // Очищаем при выходе из диалога
        }

        // AUTO-SUBMIT: После нескольких действий в диалоге - ищем кнопку подтверждения
        if (pageState.hasDialog && memory.dialogActionsCount >= 3) {
          console.log(`[Agent] Dialog has ${memory.dialogActionsCount} actions, looking for submit button...`);

          // Ищем кнопку создания/сохранения
          const dialogEl = document.querySelector('[role="dialog"], [data-radix-dialog-content]');
          if (dialogEl) {
            const buttons = Array.from(dialogEl.querySelectorAll('button'));
            const submitButton = buttons.find(btn => {
              const text = btn.innerText?.trim().toLowerCase() || '';
              return text.includes('создать') || text.includes('сохранить') ||
                     text.includes('добавить') || text.includes('create') ||
                     text.includes('save') || text.includes('submit');
            });

            if (submitButton && !(submitButton as HTMLButtonElement).disabled) {
              console.log(`[Agent] Found submit button: "${submitButton.innerText?.trim()}"`);
              setThinking(`Нажимаю кнопку "${submitButton.innerText?.trim()}"...`);
              updateFloatingIndicator(`Нажимаю: ${submitButton.innerText?.trim()}`, 'click');

              const rect = submitButton.getBoundingClientRect();
              showClickIndicator(rect.x + rect.width / 2, rect.y + rect.height / 2);

              (submitButton as HTMLElement).click();
              await shortDelay(500);

              // Проверяем закрылся ли диалог
              const dialogStillOpen = document.querySelector('[role="dialog"], [data-radix-dialog-content]');
              if (!dialogStillOpen) {
                console.log('[Agent] Dialog closed after submit - task completed!');

                const completeAction: AgentAction = {
                  type: 'complete',
                  params: {},
                  timestamp: new Date(),
                  result: 'Form submitted successfully',
                  verified: true,
                  stepNumber: iteration,
                  thinking: 'Форма отправлена, диалог закрыт'
                };
                memory.actions.push(completeAction);
                setActions(prev => [...prev, completeAction]);

                hideFloatingIndicator();
                setSession(prev => prev ? { ...prev, status: 'completed' } : null);
                clearAgentState();
                break;
              }
            }
          }
        }

        // 4. Показываем что думаем
        updateFloatingIndicator('Думаю...', 'thinking');

        // 5. Получаем следующее действие от AI
        const analysis = await analyzeWithAI(pageState, memory);

        setThinking(analysis.thinking);
        updateFloatingIndicator(analysis.thinking?.substring(0, 50) + '...', 'thinking');

        // Проверяем на зацикливание
        const currentActionKey = `${analysis.action.type}:${analysis.action.params?.text || analysis.action.params?.selector || ''}:${pageState.route}`;

        // Если это действие type и поле уже заполнено - пропускаем
        if (analysis.action.type === 'type') {
          const fieldKey = analysis.action.params?.selector || analysis.action.params?.name || analysis.action.params?.placeholder || '';
          if (fieldKey && memory.filledFields.has(fieldKey)) {
            console.log(`[Agent] Field "${fieldKey}" already filled, skipping...`);
            sameActionCount++;
            if (sameActionCount >= 2) {
              // Пробуем нажать кнопку submit
              memory.dialogActionsCount = 10; // Форсируем auto-submit на следующей итерации
            }
            continue;
          }
          // Отмечаем поле как заполненное
          if (fieldKey) {
            memory.filledFields.add(fieldKey);
          }
        }

        if (currentActionKey === lastActionKey) {
          sameActionCount++;
          console.log(`[Agent] Same action detected: ${sameActionCount} times - ${currentActionKey}`);

          if (sameActionCount >= 2) {
            // Если диалог открыт - форсируем auto-submit
            if (pageState.hasDialog) {
              console.log('[Agent] Stuck in dialog, forcing auto-submit...');
              memory.dialogActionsCount = 10;
              continue;
            } else {
              console.log('[Agent] Stuck after 2 same actions, completing');
              setThinking('Задача завершена - не могу продолжить без новых действий');
              hideFloatingIndicator();

              const completeAction: AgentAction = {
                type: 'complete',
                params: {},
                timestamp: new Date(),
                result: 'Auto-completed due to loop detection',
                verified: true,
                stepNumber: iteration,
                thinking: 'Обнаружено зацикливание - задача завершена автоматически'
              };
              memory.actions.push(completeAction);
              setActions(prev => [...prev, completeAction]);

              setSession(prev => prev ? { ...prev, status: 'completed' } : null);
              clearAgentState();
              break;
            }
          }
        } else {
          sameActionCount = 0;
          lastActionKey = currentActionKey;
        }

        // 6. Создаём действие с thinking и скриншотом
        const screenshot = await captureScreenshot();
        const action: AgentAction = {
          ...analysis.action,
          timestamp: new Date(),
          stepNumber: iteration,
          thinking: analysis.thinking,
          screenshot: screenshot || undefined
        };

        // Показываем индикатор действия
        const actionText = action.type === 'click'
          ? `Clicking: ${action.params?.text || action.params?.selector || 'element'}`
          : action.type === 'type'
          ? `Typing: "${action.params?.text?.substring(0, 20)}..."`
          : action.type === 'navigate'
          ? `Navigating to: ${action.params?.url}`
          : action.type === 'complete'
          ? 'Task completed!'
          : `Action: ${action.type}`;

        updateFloatingIndicator(actionText, action.type as any);

        // Сохраняем состояние перед выполнением
        memory.actions.push(action);
        setActions(prev => [...prev, action]);
        saveAgentState(memory);

        // 7. Проверяем завершение
        if (action.type === 'complete') {
          hideFloatingIndicator();
          setSession(prev => prev ? { ...prev, status: 'completed' } : null);
          clearAgentState();
          break;
        }

        // 8. Выполняем действие
        const execResult = await executeAction(action, pageState);
        action.result = execResult.result;
        action.verified = execResult.verified;

        console.log(`[Agent] Action ${iteration}: ${action.type} -> ${execResult.result} (verified: ${execResult.verified})`);

        if (execResult.success) {
          consecutiveErrors = 0;

          // Переходим к следующему шагу если текущий выполнен
          if (execResult.verified && memory.currentStep < memory.plan.length - 1) {
            memory.plan[memory.currentStep].completed = true;
            memory.currentStep++;
            setCurrentStep(memory.plan[memory.currentStep]);
          }
        } else {
          consecutiveErrors++;

          const attemptKey = `${memory.currentStep}:${action.type}:${action.params?.text || ''}`;
          const attempts = (memory.failedAttempts.get(attemptKey) || 0) + 1;
          memory.failedAttempts.set(attemptKey, attempts);

          if (attempts >= MAX_RETRIES_PER_STEP) {
            console.log(`[Agent] Step ${memory.currentStep} failed after ${MAX_RETRIES_PER_STEP} attempts`);
            // Пробуем следующий шаг
            if (memory.currentStep < memory.plan.length - 1) {
              memory.currentStep++;
              setCurrentStep(memory.plan[memory.currentStep]);
            }
          }
        }

        // 9. Проверяем на слишком много ошибок
        if (consecutiveErrors >= 5) {
          hideFloatingIndicator();
          setThinking('Слишком много ошибок. Останавливаюсь.');
          setSession(prev => prev ? { ...prev, status: 'error', error: 'Too many consecutive errors' } : null);
          break;
        }

        // 10. Пауза перед следующей итерацией
        await shortDelay(300);

      } catch (err) {
        console.error('[Agent] Error:', err);
        consecutiveErrors++;
        setError(err instanceof Error ? err.message : 'Unknown error');
        updateFloatingIndicator(`Ошибка: ${err instanceof Error ? err.message : 'Unknown'}`, 'thinking');

        if (consecutiveErrors >= 5) {
          hideFloatingIndicator();
          setSession(prev => prev ? { ...prev, status: 'error', error: 'Too many errors' } : null);
          break;
        }

        await shortDelay(1000);
      }
    }

    // Скрываем индикатор при завершении
    hideFloatingIndicator();

    if (iteration >= MAX_ITERATIONS) {
      setThinking('Достигнут лимит итераций');
      setSession(prev => prev ? { ...prev, status: 'completed' } : null);
    }

    clearAgentState();
  };

  // Запуск агента
  const startAgent = useCallback(async (task: string) => {
    clearAgentState();
    hasResumedRef.current = false;
    stopRequestedRef.current = false;

    const sessionId = generateSessionId();

    // Инициализируем память
    const memory: AgentMemory = {
      task,
      plan: [{
        id: 0,
        description: task,
        expectedAction: 'complete',
        completed: false,
        attempts: 0
      }],
      currentStep: 0,
      actions: [],
      pageHistory: [window.location.pathname],
      failedAttempts: new Map(),
      startTime: Date.now(),
      filledFields: new Set(),
      dialogActionsCount: 0
    };

    memoryRef.current = memory;

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
    setThinking('Начинаю выполнение задачи...');
    setError(null);
    setCurrentStep(memory.plan[0]);
    setTotalSteps(memory.plan.length);

    runAgentLoop(memory).catch(err => {
      console.error('[Agent] Loop error:', err);
      setSession(prev => prev ? { ...prev, status: 'error', error: err.message } : null);
    });
  }, []);

  // Остановка агента
  const stopAgent = useCallback(() => {
    stopRequestedRef.current = true;
    clearAgentState();
    hideFloatingIndicator();
    setSession(prev => prev ? { ...prev, status: 'paused' } : null);
    setThinking('Остановлено пользователем');
  }, []);

  return {
    session,
    screenshot,
    thinking,
    actions,
    error,
    isRunning,
    currentStep,
    totalSteps,
    startAgent,
    stopAgent
  };
}
