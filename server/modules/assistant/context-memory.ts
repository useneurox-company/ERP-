/**
 * ChatCRM - Context Memory Service
 * Управление контекстной памятью для персонализации диалога
 *
 * Функции:
 * - Запоминание упомянутых сделок, клиентов, товаров
 * - История последних действий
 * - Предпочтения пользователя
 * - Умные подсказки на основе контекста
 */

// Типы контекста
export interface DealMention {
  id: string;
  orderNumber?: string;
  clientName: string;
  amount?: number;
  stage?: string;
  mentionedAt: Date;
}

export interface ClientMention {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  mentionedAt: Date;
}

export interface ProductMention {
  id?: string;
  name: string;
  quantity?: number;
  price?: number;
  mentionedAt: Date;
}

export interface ActionHistory {
  action: string;
  target?: string; // deal ID, client name, etc.
  timestamp: Date;
  success: boolean;
}

// Стиль общения с пользователем
export type CommunicationStyle = 'friendly' | 'formal' | 'motivating';

export interface UserPreferences {
  preferredMode: 'text' | 'steps' | 'form' | null;
  defaultStage?: string;
  language: 'ru' | 'en';
  showButtons: boolean;
  communicationStyle: CommunicationStyle;
}

export interface ContextMemory {
  // Последние упомянутые сущности
  recentDeals: DealMention[];
  recentClients: ClientMention[];
  recentProducts: ProductMention[];

  // История действий
  actionHistory: ActionHistory[];

  // Текущий фокус диалога
  currentFocus: 'deal' | 'client' | 'product' | 'general';
  focusId?: string;

  // Предпочтения
  preferences: UserPreferences;

  // Время последней активности
  lastActivityAt: Date;

  // Краткое резюме контекста для AI
  summary: string;
}

// Хранилище контекста по пользователям
const contextStore = new Map<string, ContextMemory>();

// Настройки
const MAX_RECENT_ITEMS = 5;
const MAX_ACTION_HISTORY = 20;
const CONTEXT_EXPIRY = 24 * 60 * 60 * 1000; // 24 часа

/**
 * Получить или создать контекст для пользователя
 */
export function getContext(userId: string): ContextMemory {
  let context = contextStore.get(userId);

  if (!context) {
    context = createEmptyContext();
    contextStore.set(userId, context);
  }

  // Проверяем не истёк ли контекст
  if (Date.now() - context.lastActivityAt.getTime() > CONTEXT_EXPIRY) {
    context = createEmptyContext();
    contextStore.set(userId, context);
  }

  return context;
}

/**
 * Создать пустой контекст
 */
function createEmptyContext(): ContextMemory {
  return {
    recentDeals: [],
    recentClients: [],
    recentProducts: [],
    actionHistory: [],
    currentFocus: 'general',
    focusId: undefined,
    preferences: {
      preferredMode: null,
      language: 'ru',
      showButtons: true,
      communicationStyle: 'friendly',
    },
    lastActivityAt: new Date(),
    summary: '',
  };
}

/**
 * Обновить время активности
 */
export function touchContext(userId: string): void {
  const context = getContext(userId);
  context.lastActivityAt = new Date();
}

/**
 * Добавить упоминание сделки
 */
export function rememberDeal(userId: string, deal: Omit<DealMention, 'mentionedAt'>): void {
  const context = getContext(userId);

  // Удаляем старое упоминание этой же сделки
  context.recentDeals = context.recentDeals.filter(d => d.id !== deal.id);

  // Добавляем новое в начало
  context.recentDeals.unshift({
    ...deal,
    mentionedAt: new Date(),
  });

  // Ограничиваем количество
  if (context.recentDeals.length > MAX_RECENT_ITEMS) {
    context.recentDeals = context.recentDeals.slice(0, MAX_RECENT_ITEMS);
  }

  // Обновляем фокус
  context.currentFocus = 'deal';
  context.focusId = deal.id;

  updateSummary(userId);
}

/**
 * Добавить упоминание клиента
 */
export function rememberClient(userId: string, client: Omit<ClientMention, 'mentionedAt'>): void {
  const context = getContext(userId);

  // Удаляем дубликат
  context.recentClients = context.recentClients.filter(
    c => c.name.toLowerCase() !== client.name.toLowerCase()
  );

  context.recentClients.unshift({
    ...client,
    mentionedAt: new Date(),
  });

  if (context.recentClients.length > MAX_RECENT_ITEMS) {
    context.recentClients = context.recentClients.slice(0, MAX_RECENT_ITEMS);
  }

  context.currentFocus = 'client';

  updateSummary(userId);
}

/**
 * Добавить упоминание товара
 */
export function rememberProduct(userId: string, product: Omit<ProductMention, 'mentionedAt'>): void {
  const context = getContext(userId);

  context.recentProducts = context.recentProducts.filter(
    p => p.name.toLowerCase() !== product.name.toLowerCase()
  );

  context.recentProducts.unshift({
    ...product,
    mentionedAt: new Date(),
  });

  if (context.recentProducts.length > MAX_RECENT_ITEMS) {
    context.recentProducts = context.recentProducts.slice(0, MAX_RECENT_ITEMS);
  }

  context.currentFocus = 'product';

  updateSummary(userId);
}

/**
 * Записать действие
 */
export function recordAction(userId: string, action: string, target?: string, success: boolean = true): void {
  const context = getContext(userId);

  context.actionHistory.unshift({
    action,
    target,
    timestamp: new Date(),
    success,
  });

  if (context.actionHistory.length > MAX_ACTION_HISTORY) {
    context.actionHistory = context.actionHistory.slice(0, MAX_ACTION_HISTORY);
  }

  updateSummary(userId);
}

/**
 * Установить предпочтение режима
 */
export function setPreferredMode(userId: string, mode: 'text' | 'steps' | 'form'): void {
  const context = getContext(userId);
  context.preferences.preferredMode = mode;
}

/**
 * Установить стиль общения
 */
export function setCommunicationStyle(userId: string, style: CommunicationStyle): void {
  const context = getContext(userId);
  context.preferences.communicationStyle = style;
}

/**
 * Получить стиль общения
 */
export function getCommunicationStyle(userId: string): CommunicationStyle {
  const context = getContext(userId);
  return context.preferences.communicationStyle || 'friendly';
}

/**
 * Получить последнюю упомянутую сделку
 */
export function getLastDeal(userId: string): DealMention | undefined {
  const context = getContext(userId);
  return context.recentDeals[0];
}

/**
 * Получить последнего упомянутого клиента
 */
export function getLastClient(userId: string): ClientMention | undefined {
  const context = getContext(userId);
  return context.recentClients[0];
}

/**
 * Получить последний упомянутый товар
 */
export function getLastProduct(userId: string): ProductMention | undefined {
  const context = getContext(userId);
  return context.recentProducts[0];
}

/**
 * Сбросить фокус
 */
export function resetFocus(userId: string): void {
  const context = getContext(userId);
  context.currentFocus = 'general';
  context.focusId = undefined;
}

/**
 * Получить краткое резюме контекста для AI
 */
export function getContextSummary(userId: string): string {
  const context = getContext(userId);
  return context.summary;
}

/**
 * Обновить резюме контекста
 */
function updateSummary(userId: string): void {
  const context = getContext(userId);
  const parts: string[] = [];

  // Последняя сделка
  if (context.recentDeals.length > 0) {
    const deal = context.recentDeals[0];
    parts.push(`Последняя сделка: #${deal.orderNumber || deal.id} (${deal.clientName})`);
  }

  // Последний клиент
  if (context.recentClients.length > 0) {
    const client = context.recentClients[0];
    parts.push(`Последний клиент: ${client.name}`);
  }

  // Последний товар
  if (context.recentProducts.length > 0) {
    const product = context.recentProducts[0];
    parts.push(`Последний товар: ${product.name}${product.quantity ? ` x${product.quantity}` : ''}`);
  }

  // Текущий фокус
  if (context.currentFocus !== 'general') {
    parts.push(`Фокус: ${context.currentFocus}`);
  }

  // Последние действия
  const recentActions = context.actionHistory.slice(0, 3);
  if (recentActions.length > 0) {
    const actionNames = recentActions.map(a => a.action).join(', ');
    parts.push(`Последние действия: ${actionNames}`);
  }

  context.summary = parts.join('. ');
}

/**
 * Получить подсказки на основе контекста
 */
export function getContextualSuggestions(userId: string): string[] {
  const context = getContext(userId);
  const suggestions: string[] = [];

  // Если есть последняя сделка - предлагаем действия с ней
  if (context.recentDeals.length > 0) {
    const deal = context.recentDeals[0];
    suggestions.push(`Открыть сделку #${deal.orderNumber || deal.id}`);
    suggestions.push(`Изменить этап сделки #${deal.orderNumber || deal.id}`);
  }

  // Если работали с клиентом - предлагаем создать сделку
  if (context.recentClients.length > 0 && context.recentDeals.length === 0) {
    const client = context.recentClients[0];
    suggestions.push(`Создать сделку для ${client.name}`);
  }

  // Если часто используют определённый режим
  if (context.preferences.preferredMode) {
    suggestions.push(`Продолжить в режиме "${context.preferences.preferredMode}"`);
  }

  return suggestions;
}

/**
 * Очистить контекст пользователя
 */
export function clearContext(userId: string): void {
  contextStore.delete(userId);
}

/**
 * Получить статистику контекста (для отладки)
 */
export function getContextStats(): {
  totalUsers: number;
  activeUsers: number;
} {
  const now = Date.now();
  let activeUsers = 0;

  contextStore.forEach((context) => {
    if (now - context.lastActivityAt.getTime() < 30 * 60 * 1000) { // 30 минут
      activeUsers++;
    }
  });

  return {
    totalUsers: contextStore.size,
    activeUsers,
  };
}

/**
 * Экспорт сервиса
 */
export const contextMemory = {
  getContext,
  touchContext,
  rememberDeal,
  rememberClient,
  rememberProduct,
  recordAction,
  setPreferredMode,
  setCommunicationStyle,
  getCommunicationStyle,
  getLastDeal,
  getLastClient,
  getLastProduct,
  resetFocus,
  getContextSummary,
  getContextualSuggestions,
  clearContext,
  getContextStats,
};
