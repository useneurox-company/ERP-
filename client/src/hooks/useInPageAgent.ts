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
import { domToPng } from 'modern-screenshot';
// modern-screenshot - better CSS support than html2canvas

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
  // Backtracking & Exploration
  triedActions: Set<string>; // Действия которые уже пробовали
  urlBeforeAction: string; // URL до действия для отката
  explorationStack: ExplorationState[]; // Стек состояний для backtracking
  currentExplorationIndex: number; // Какой вариант сейчас пробуем
}

// Состояние для backtracking
export interface ExplorationState {
  url: string;
  dialogOpen: boolean;
  availableActions: string[]; // Список возможных действий
  triedActions: string[]; // Уже испробованные
  successfulPath?: string[]; // Если нашли успешный путь
}

// Результат успешного выполнения задачи для обучения
export interface LearnedPath {
  task: string;
  taskKeywords: string[];
  actions: { type: string; selector?: string; text?: string }[];
  successRate: number;
  lastUsed: number;
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

/**
 * Проверяет валидность CSS селектора
 * Radix UI генерирует невалидные ID типа :ro:-form-item, :r1:-form-item
 */
function isValidSelector(selector: string): boolean {
  if (!selector) return false;

  // Паттерны невалидных Radix UI ID
  const invalidPatterns = [
    /^#:r[0-9a-z]+:/i,      // #:ro:, #:r1:, etc
    /^#-/,                   // ID начинающийся с дефиса
    /^#[0-9]/,              // ID начинающийся с цифры
    /^\[\s*\]/,             // Пустые атрибуты []
  ];

  for (const pattern of invalidPatterns) {
    if (pattern.test(selector)) {
      console.warn(`[Agent] Invalid selector detected: ${selector}`);
      return false;
    }
  }

  // Пробуем валидировать через DOM API
  try {
    document.querySelector(selector);
    return true;
  } catch (e) {
    console.warn(`[Agent] Selector validation failed: ${selector}`, e);
    return false;
  }
}

/**
 * Очищает/исправляет селектор или возвращает null если невозможно
 */
function sanitizeSelector(selector: string): string | null {
  if (!selector) return null;

  // Если это текстовый селектор - пропускаем
  if (selector.includes(':has-text(')) {
    return selector;
  }

  // Проверяем валидность
  if (!isValidSelector(selector)) {
    return null; // Используем fallback метод поиска
  }

  return selector;
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

/**
 * Capture screenshot using modern-screenshot library
 * Better CSS support than html2canvas - handles color() and other modern CSS
 */
async function captureScreenshot(): Promise<string | null> {
  try {
    // Скрываем floating indicator перед скриншотом
    const indicator = document.getElementById('agent-floating-indicator');
    if (indicator) indicator.style.display = 'none';

    // Определяем что снимать - диалог или всю страницу
    const dialog = document.querySelector('[role="dialog"], [data-radix-dialog-content]') as HTMLElement;
    const targetElement = dialog || document.body;

    console.log('[Agent] Taking screenshot with modern-screenshot...');

    // modern-screenshot с настройками
    const dataUrl = await domToPng(targetElement, {
      scale: 0.5, // Уменьшаем для компактности
      backgroundColor: '#0f172a',
      width: dialog ? dialog.offsetWidth : Math.min(window.innerWidth, 1200),
      height: dialog ? dialog.offsetHeight : Math.min(window.innerHeight, 800),
      style: {
        // Фиксируем позиционирование для корректного захвата
        transform: 'none',
        transformOrigin: 'top left'
      },
      filter: (node: Node) => {
        // Пропускаем элементы агента
        if (node instanceof HTMLElement) {
          if (node.id === 'agent-floating-indicator') return false;
          if (node.id === 'agent-click-animation') return false;
          if (node.classList?.contains('agent-indicator-spinner')) return false;
        }
        return true;
      }
    });

    // Возвращаем indicator
    if (indicator) indicator.style.display = 'flex';

    if (dataUrl) {
      console.log('[Agent] Screenshot captured:', dataUrl.length, 'bytes');
      return dataUrl;
    }

    console.warn('[Agent] modern-screenshot returned empty');
    return createFallbackScreenshot();

  } catch (err) {
    console.warn('[Agent] modern-screenshot failed, using fallback:', err);

    // Возвращаем indicator
    const indicator = document.getElementById('agent-floating-indicator');
    if (indicator) indicator.style.display = 'flex';

    // Fallback: простое текстовое описание страницы
    return createFallbackScreenshot();
  }
}

// Fallback скриншот если html2canvas не работает
function createFallbackScreenshot(): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Фон
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 400, 300);

    // Заголовок
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`URL: ${window.location.pathname}`, 10, 25);

    // Диалог?
    const dialog = document.querySelector('[role="dialog"], [data-radix-dialog-content]');
    if (dialog) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('📋 ДИАЛОГ ОТКРЫТ', 10, 50);
      const title = dialog.querySelector('h1, h2, h3')?.textContent?.trim() || 'Форма';
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px sans-serif';
      ctx.fillText(`Заголовок: ${title}`, 10, 70);

      // Поля формы
      const inputs = dialog.querySelectorAll('input, textarea, select');
      let y = 95;
      ctx.fillStyle = '#94a3b8';
      inputs.forEach((input, i) => {
        if (i < 6) {
          const name = (input as HTMLInputElement).name || (input as HTMLInputElement).placeholder || `field${i}`;
          const value = (input as HTMLInputElement).value || '(пусто)';
          ctx.fillText(`• ${name}: ${value.substring(0, 30)}`, 15, y);
          y += 18;
        }
      });

      // Кнопки
      const buttons = dialog.querySelectorAll('button');
      y += 10;
      ctx.fillStyle = '#10b981';
      ctx.fillText('Кнопки:', 10, y);
      y += 18;
      buttons.forEach((btn, i) => {
        if (i < 4) {
          const text = (btn as HTMLElement).innerText?.trim() || 'button';
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(15, y - 12, text.length * 7 + 20, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, 25, y);
          y += 22;
        }
      });
    } else {
      // Страница
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';

      // Навигация
      const sidebar = document.querySelector('aside, nav, [data-sidebar]');
      if (sidebar) {
        const links = sidebar.querySelectorAll('a[href]');
        ctx.fillText(`Навигация: ${links.length} ссылок`, 10, 50);
        let y = 70;
        links.forEach((link, i) => {
          if (i < 8) {
            const text = (link as HTMLElement).innerText?.trim() || '';
            const href = link.getAttribute('href') || '';
            if (text) {
              ctx.fillStyle = href === window.location.pathname ? '#10b981' : '#64748b';
              ctx.fillText(`• ${text} → ${href}`, 15, y);
              y += 16;
            }
          }
        });
      }

      // Кнопки на странице
      const main = document.querySelector('main') || document.body;
      const buttons = main.querySelectorAll('button:not([disabled])');
      let y = 200;
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`Кнопки (${buttons.length}):`, 10, y);
      y += 18;
      let btnCount = 0;
      buttons.forEach((btn) => {
        const text = (btn as HTMLElement).innerText?.trim();
        if (text && text.length > 1 && text.length < 25 && btnCount < 4) {
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(15, y - 12, text.length * 7 + 10, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(text, 20, y);
          y += 20;
          btnCount++;
        }
      });
    }

    return canvas.toDataURL('image/png', 0.9);
  } catch (err) {
    console.warn('[Agent] Fallback screenshot failed:', err);
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
      // Приоритет 3: селектор (с валидацией для Radix UI)
      else if (action.params?.selector) {
        const safeSelector = sanitizeSelector(action.params.selector);
        if (safeSelector) {
          try {
            element = document.querySelector(safeSelector);
            if (element) {
              const rect = element.getBoundingClientRect();
              clickX = rect.x + rect.width / 2;
              clickY = rect.y + rect.height / 2;
            }
          } catch (selectorError) {
            console.warn(`[Agent] Selector error: ${safeSelector}`, selectorError);
          }
        } else {
          console.warn(`[Agent] Skipping invalid Radix UI selector: ${action.params.selector}`);
          // Fallback: попробуем найти по тексту если есть
          if (action.params?.text) {
            const searchText = action.params.text.toLowerCase();
            const buttons = Array.from(document.querySelectorAll('button, [role="button"], a'));
            for (const btn of buttons) {
              const text = (btn as HTMLElement).innerText?.trim().toLowerCase();
              if (text && text.includes(searchText)) {
                element = btn;
                const rect = btn.getBoundingClientRect();
                clickX = rect.x + rect.width / 2;
                clickY = rect.y + rect.height / 2;
                console.log(`[Agent] Fallback: found element by text "${searchText}"`);
                break;
              }
            }
          }
        }
      }

      // Если элемент не найден - пробуем умный поиск
      if (!element) {
        const searchText = action.params?.text?.toLowerCase() || '';
        const selectorText = action.params?.selector?.toLowerCase() || '';

        // Определяем что ищем по селектору
        let targetText = searchText;
        if (!targetText && selectorText) {
          // Извлекаем текст из селектора типа data-testid="link-проекты"
          const match = selectorText.match(/link-(\w+)|проект|клиент|поставщик|склад|монтаж|продаж|финанс|задач|настройк/i);
          if (match) {
            targetText = match[1] || match[0];
          }
        }

        // 1. Ищем навигационные ссылки в sidebar
        const sidebar = document.querySelector('aside, nav, [data-sidebar], [class*="sidebar"], [class*="Sidebar"]');
        if (sidebar && targetText) {
          const links = Array.from(sidebar.querySelectorAll('a[href]'));
          for (const link of links) {
            const linkText = (link as HTMLElement).innerText?.trim().toLowerCase();
            const href = link.getAttribute('href')?.toLowerCase() || '';

            if (linkText.includes(targetText) || href.includes(targetText)) {
              element = link;
              const rect = link.getBoundingClientRect();
              clickX = rect.x + rect.width / 2;
              clickY = rect.y + rect.height / 2;
              console.log(`[Agent] Found sidebar link: "${linkText}" -> ${href}`);
              break;
            }
          }
        }

        // 2. Ищем по всему документу если не нашли в sidebar
        if (!element && targetText) {
          const allLinks = Array.from(document.querySelectorAll('a[href]'));
          for (const link of allLinks) {
            const linkText = (link as HTMLElement).innerText?.trim().toLowerCase();
            const href = link.getAttribute('href')?.toLowerCase() || '';

            if (linkText.includes(targetText) || href.includes(targetText)) {
              element = link;
              const rect = link.getBoundingClientRect();
              clickX = rect.x + rect.width / 2;
              clickY = rect.y + rect.height / 2;
              console.log(`[Agent] Found link: "${linkText}" -> ${href}`);
              break;
            }
          }
        }

        const mainContent = document.querySelector('main') || document.body;
        const allButtons = Array.from(mainContent.querySelectorAll('button, [role="button"], a[href]'));

        // 3. Ищем кнопку "+" для добавления
        if (!element && (searchText.includes('+') || searchText.includes('добав') || searchText.includes('новый') || searchText.includes('создать') || searchText.includes('new') || searchText.includes('add') || selectorText.includes('create') || selectorText.includes('add') || selectorText.includes('new'))) {
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

        // 4. Ищем по SVG иконке (Plus icon)
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

      // Поиск по разным критериям С ВАЛИДАЦИЕЙ селектора
      if (action.params?.selector) {
        const safeSelector = sanitizeSelector(action.params.selector);
        if (safeSelector) {
          element = document.querySelector(safeSelector);
        }
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
    triedActions: Array.from(memory.triedActions),
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
      dialogActionsCount: state.dialogActionsCount || 0,
      // Backtracking & Exploration
      triedActions: new Set(state.triedActions || []),
      urlBeforeAction: state.urlBeforeAction || window.location.pathname,
      explorationStack: state.explorationStack || [],
      currentExplorationIndex: state.currentExplorationIndex || 0
    };
  } catch {
    return null;
  }
}

function clearAgentState() {
  sessionStorage.removeItem(AGENT_STATE_KEY);
}

// ============= LEARNING SYSTEM =============

const LEARNED_PATHS_KEY = 'emerald_agent_learned_paths';

function extractTaskKeywords(task: string): string[] {
  const words = task.toLowerCase().split(/\s+/);
  const keywords: string[] = [];

  // Извлекаем ключевые слова
  const actionWords = ['открой', 'открыть', 'создай', 'создать', 'добавь', 'добавить', 'перейди', 'зайди', 'найди'];
  const targetWords = ['проект', 'клиент', 'поставщик', 'позиц', 'монтаж', 'задач', 'склад', 'финанс'];

  for (const word of words) {
    for (const kw of [...actionWords, ...targetWords]) {
      if (word.includes(kw)) {
        keywords.push(kw);
      }
    }
  }

  return Array.from(new Set(keywords));
}

function saveLearnedPath(task: string, actions: AgentAction[]) {
  try {
    const existing = localStorage.getItem(LEARNED_PATHS_KEY);
    const paths: LearnedPath[] = existing ? JSON.parse(existing) : [];

    const keywords = extractTaskKeywords(task);
    const simplifiedActions = actions
      .filter(a => a.type !== 'complete' && a.type !== 'observe')
      .map(a => ({
        type: a.type,
        selector: a.params?.selector,
        text: a.params?.text
      }));

    // Проверяем есть ли похожий путь
    const existingIndex = paths.findIndex(p => {
      const commonKeywords = p.taskKeywords.filter(k => keywords.includes(k));
      return commonKeywords.length >= Math.min(2, keywords.length);
    });

    if (existingIndex >= 0) {
      // Обновляем существующий
      paths[existingIndex].successRate = (paths[existingIndex].successRate + 1) / 2 + 0.5;
      paths[existingIndex].lastUsed = Date.now();
      paths[existingIndex].actions = simplifiedActions;
    } else {
      // Добавляем новый
      paths.push({
        task,
        taskKeywords: keywords,
        actions: simplifiedActions,
        successRate: 1,
        lastUsed: Date.now()
      });
    }

    // Храним только последние 50 путей
    const sorted = paths.sort((a, b) => b.lastUsed - a.lastUsed).slice(0, 50);
    localStorage.setItem(LEARNED_PATHS_KEY, JSON.stringify(sorted));

    console.log('[Agent] Learned path saved:', task, simplifiedActions.length, 'actions');
  } catch (err) {
    console.warn('[Agent] Failed to save learned path:', err);
  }
}

function findLearnedPath(task: string): LearnedPath | null {
  try {
    const existing = localStorage.getItem(LEARNED_PATHS_KEY);
    if (!existing) return null;

    const paths: LearnedPath[] = JSON.parse(existing);
    const keywords = extractTaskKeywords(task);

    // Ищем путь с максимальным совпадением ключевых слов
    let bestMatch: LearnedPath | null = null;
    let bestScore = 0;

    for (const path of paths) {
      const commonKeywords = path.taskKeywords.filter(k => keywords.includes(k));
      const score = commonKeywords.length * path.successRate;

      if (score > bestScore && commonKeywords.length >= 2) {
        bestScore = score;
        bestMatch = path;
      }
    }

    if (bestMatch) {
      console.log('[Agent] Found learned path:', bestMatch.task, 'score:', bestScore);
    }

    return bestMatch;
  } catch {
    return null;
  }
}

// ============= BACKTRACKING & EXPLORATION =============

function goBack(): boolean {
  // Если есть диалог - закрываем его
  const dialog = document.querySelector('[role="dialog"], [data-radix-dialog-content]');
  if (dialog) {
    const closeBtn = dialog.querySelector('button[aria-label="Close"], button:has(svg[class*="x"]), [data-dismiss]');
    if (closeBtn) {
      (closeBtn as HTMLElement).click();
      console.log('[Agent] Closed dialog via close button');
      return true;
    }

    // Пробуем ESC
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    console.log('[Agent] Sent Escape to close dialog');
    return true;
  }

  // Иначе используем history.back()
  if (window.history.length > 1) {
    window.history.back();
    console.log('[Agent] Navigated back in history');
    return true;
  }

  return false;
}

function getAlternativeActions(pageState: PageState, triedActions: Set<string>): { type: string; params: any }[] {
  const alternatives: { type: string; params: any; priority: number }[] = [];

  // Собираем все возможные действия
  const allElements = [
    ...pageState.elements.navigation,
    ...pageState.elements.actions,
    ...pageState.elements.forms
  ];

  for (const elem of allElements) {
    const actionKey = `click:${elem.text || elem.selector}`;

    // Пропускаем уже испробованные
    if (triedActions.has(actionKey)) continue;

    // Пропускаем отключённые
    if (!elem.enabled) continue;

    let priority = 0;

    // Приоритизация по типу
    if (elem.type === 'button') priority += 10;
    if (elem.type === 'link') priority += 5;

    // Приоритизация по тексту
    const text = elem.text.toLowerCase();
    if (text.includes('создать') || text.includes('добавить') || text.includes('новый')) priority += 20;
    if (text.includes('открыть') || text.includes('перейти')) priority += 15;
    if (text === '+' || text === '＋') priority += 25;

    // Приоритизация по расположению
    if (elem.location === 'dialog') priority += 30; // В диалоге - высший приоритет
    if (elem.location === 'main') priority += 5;

    alternatives.push({
      type: 'click',
      params: { text: elem.text, selector: elem.selector, x: elem.x, y: elem.y },
      priority
    });
  }

  // Сортируем по приоритету
  return alternatives
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10)
    .map(a => ({ type: a.type, params: a.params }));
}

function shouldBacktrack(memory: AgentMemory, pageState: PageState, lastActionSuccess: boolean): boolean {
  // 1. Если последнее действие не удалось
  if (!lastActionSuccess) return true;

  // 2. Если URL сильно изменился в неожиданном направлении
  const currentUrl = window.location.pathname;
  const recentPages = memory.pageHistory.slice(-3);

  // Проверяем уходим ли мы от цели (например, были на /projects, ушли на /settings)
  if (recentPages.length >= 2) {
    const previousUrl = recentPages[recentPages.length - 2];
    // Если вернулись на главную без причины - возможно ошиблись
    if (currentUrl === '/' && previousUrl !== '/') {
      console.log('[Agent] Unexpectedly returned to home, should backtrack');
      return true;
    }
  }

  // 3. Если мы уже пробовали это состояние много раз
  const stateKey = `${currentUrl}:${pageState.hasDialog}`;
  const attempts = memory.failedAttempts.get(stateKey) || 0;
  if (attempts >= 3) {
    console.log('[Agent] Too many attempts in this state, should backtrack');
    return true;
  }

  return false;
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

  // Анализ задачи через API (с поддержкой скриншота)
  const analyzeWithAI = async (
    pageState: PageState,
    memory: AgentMemory,
    screenshot: string | null = null  // Теперь принимаем скриншот
  ): Promise<{ thinking: string; action: AgentAction; plan?: TaskStep[] }> => {
    // Извлекаем base64 данные из data URL
    let screenshotBase64: string | null = null;
    if (screenshot && screenshot.startsWith('data:image')) {
      const base64Match = screenshot.match(/base64,(.+)/);
      screenshotBase64 = base64Match ? base64Match[1] : null;
    }

    const response = await fetch('/api/browser-agent/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot: screenshotBase64, // Передаём скриншот для Vision mode
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
    let backtrackCount = 0;
    const MAX_BACKTRACKS = 5;

    // Определяем тип задачи для auto-completion
    const taskType = analyzeTaskType(memory.task);
    console.log('[Agent] Task type:', taskType);

    // Проверяем есть ли выученный путь для похожей задачи
    // ОТКЛЮЧЕНО: learnedPath матчит по ключевым словам и применяет путь от ДРУГОЙ задачи
    const learnedPath: LearnedPath | null = null; // findLearnedPath(memory.task);
    let learnedPathIndex = 0;

    if (learnedPath) {
      console.log('[Agent] Found learned path with', learnedPath.actions.length, 'actions');
      setThinking(`Использую знания из похожей задачи: "${learnedPath.task}"`);
      showFloatingIndicator('Применяю изученный путь...', 'thinking');
    } else {
      setThinking('Анализирую задачу...');
      showFloatingIndicator('Анализирую задачу...', 'thinking');
    }

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
          // LEARNING: Сохраняем успешный путь
          saveLearnedPath(memory.task, memory.actions);
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
                // LEARNING: Сохраняем успешный путь
                saveLearnedPath(memory.task, memory.actions);
                setSession(prev => prev ? { ...prev, status: 'completed' } : null);
                clearAgentState();
                break;
              }
            }
          }
        }

        // 4. ДЕЛАЕМ СКРИНШОТ ДО АНАЛИЗА - агент должен видеть экран!
        updateFloatingIndicator('Делаю скриншот...', 'read');
        const currentScreenshot = await captureScreenshot();

        // Обновляем state для отображения в панели
        if (currentScreenshot) {
          setScreenshot(currentScreenshot);
          console.log(`[Agent] Screenshot captured: ${currentScreenshot.length} bytes`);
        } else {
          console.warn('[Agent] Screenshot failed, using DOM-only mode');
        }

        // Ждём небольшую задержку для стабилизации
        await shortDelay(300);

        // 5. Показываем что думаем
        updateFloatingIndicator('Думаю...', 'thinking');

        // 6. Получаем следующее действие - сначала проверяем learned path
        let analysis: { thinking: string; action: AgentAction; plan?: TaskStep[] };

        if (learnedPath && learnedPathIndex < learnedPath.actions.length) {
          // Используем действие из выученного пути
          const learnedAction = learnedPath.actions[learnedPathIndex];
          analysis = {
            thinking: `Использую изученный путь (шаг ${learnedPathIndex + 1}/${learnedPath.actions.length})`,
            action: {
              type: learnedAction.type as AgentAction['type'],
              params: { text: learnedAction.text, selector: learnedAction.selector },
              timestamp: new Date()
            }
          };
          learnedPathIndex++;
          console.log(`[Agent] Using learned action ${learnedPathIndex}: ${learnedAction.type}`);
        } else {
          // Получаем следующее действие от AI СО СКРИНШОТОМ
          analysis = await analyzeWithAI(pageState, memory, currentScreenshot);
        }

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

        // 7. Создаём действие с thinking и РАНЕЕ захваченным скриншотом
        const action: AgentAction = {
          ...analysis.action,
          timestamp: new Date(),
          stepNumber: iteration,
          thinking: analysis.thinking,
          screenshot: currentScreenshot || undefined
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
          // LEARNING: Сохраняем успешный путь
          saveLearnedPath(memory.task, memory.actions);
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

          // Отмечаем это действие как неудачное
          const actionKey = `${action.type}:${action.params?.text || action.params?.selector || ''}`;
          memory.triedActions.add(actionKey);

          const attemptKey = `${memory.currentStep}:${action.type}:${action.params?.text || ''}`;
          const attempts = (memory.failedAttempts.get(attemptKey) || 0) + 1;
          memory.failedAttempts.set(attemptKey, attempts);

          // BACKTRACKING: Если действие не удалось - пробуем вернуться и попробовать другое
          if (attempts >= 2 && backtrackCount < MAX_BACKTRACKS) {
            console.log(`[Agent] Action failed ${attempts} times, trying backtracking...`);
            setThinking('Это не сработало, пробую другой вариант...');
            updateFloatingIndicator('Возвращаюсь назад...', 'navigate');

            // EXPLORATION: Ищем альтернативные действия
            const alternatives = getAlternativeActions(pageState, memory.triedActions);

            if (alternatives.length > 0) {
              console.log(`[Agent] Found ${alternatives.length} alternative actions`);
              // Берём следующее альтернативное действие
              const altAction = alternatives[0];
              memory.triedActions.add(`${altAction.type}:${altAction.params?.text || altAction.params?.selector || ''}`);

              // Выполняем альтернативное действие вместо backtrack
              setThinking(`Пробую: ${altAction.params?.text || 'альтернативное действие'}`);
              updateFloatingIndicator(`Пробую: ${altAction.params?.text?.substring(0, 20) || 'другой вариант'}`, 'click');

              const altResult = await executeAction({
                type: altAction.type as AgentAction['type'],
                params: altAction.params,
                timestamp: new Date()
              }, pageState);

              if (altResult.success && altResult.verified) {
                console.log('[Agent] Alternative action succeeded!');
                consecutiveErrors = 0;
                backtrackCount = 0;
              } else {
                backtrackCount++;
              }
            } else {
              // Нет альтернатив - используем goBack
              if (goBack()) {
                backtrackCount++;
                console.log(`[Agent] Backtracked (${backtrackCount}/${MAX_BACKTRACKS})`);
                await shortDelay(500);
              }
            }
          }

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
      dialogActionsCount: 0,
      // Backtracking & Exploration
      triedActions: new Set(),
      urlBeforeAction: window.location.pathname,
      explorationStack: [],
      currentExplorationIndex: 0
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
