// ChatCRM - Универсальный CRM ассистент
// Работает через адаптеры: LocalDB, AmoCRM, Bitrix24, HubSpot и др.
// LLM вызывается ТОЛЬКО для парсинга сложного текста

import { db } from "../../db";
import { deals, warehouse_items, deal_contacts, users, dealStages } from "@shared/schema";
import { like, eq, or, sql, asc } from "drizzle-orm";
import { parseUserMessage, ParsedDealIntent } from "./openrouter";
import { nanoid } from "nanoid";
import { getAdapter, UnifiedDeal, UnifiedTask } from "./adapters";
import { contextMemory, getContextSummary } from "./context-memory";
import type { TasksNeedingAttention, CreateTaskData } from "./adapters/types";
import {
  normalizeText,
  parseIntent,
  extractNumber,
  extractOrderNumber,
  extractClientName,
  extractStage,
  hasContextReference,
  fuzzyFindClient,
  ParsedIntent
} from "./text-utils";

// Типы состояний диалога
type DialogState =
  | 'idle'
  | 'mode_select'
  | 'deal_client'
  | 'deal_client_confirm'
  | 'deal_product'
  | 'deal_product_confirm'
  | 'deal_quantity'
  | 'deal_stage'
  | 'deal_confirm'
  // Новые состояния для работы с существующими сделками
  | 'deal_search'        // ввод поиска
  | 'deal_search_result' // выбор из результатов
  | 'deal_view'          // просмотр сделки
  | 'deal_edit_select'   // выбор что редактировать
  | 'deal_edit_field'    // редактирование поля
  | 'deal_edit_confirm'  // подтверждение изменений
  // Состояния для задач
  | 'task_briefing'      // утренний брифинг
  | 'task_list'          // список задач
  | 'task_view'          // просмотр задачи
  | 'task_create'        // создание задачи
  | 'task_create_title'  // ввод названия
  | 'task_create_deadline' // ввод дедлайна
  | 'task_create_priority' // ввод приоритета
  | 'task_complete_select'; // выбор задачи для завершения

// Редактируемые поля сделки
const EDITABLE_FIELDS = [
  { key: 'client_name', label: '👤 Клиента', type: 'text' },
  { key: 'contact_phone', label: '📞 Телефон', type: 'phone' },
  { key: 'contact_email', label: '📧 Email', type: 'email' },
  { key: 'company', label: '🏢 Компанию', type: 'text' },
  { key: 'amount', label: '💰 Сумму', type: 'number' },
  { key: 'stage', label: '📊 Этап', type: 'select' },
  { key: 'deadline', label: '📅 Дедлайн', type: 'date' },
  { key: 'tags', label: '🏷️ Теги', type: 'tags' },
  { key: 'manager_id', label: '👷 Менеджера', type: 'select' },
  { key: 'production_days_count', label: '🏭 Дней производства', type: 'number' },
];

// Сообщение в истории
interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Контекст диалога
interface DialogContext {
  lastMentionedDeal?: string;    // ID последней упомянутой сделки
  lastMentionedClient?: string;  // имя последнего упомянутого клиента
  lastAction?: string;           // последнее действие
}

// Текущая сделка для просмотра/редактирования
interface CurrentDeal {
  id: string;
  order_number?: string;
  client_name?: string;
  contact_phone?: string;
  contact_email?: string;
  company?: string;
  amount?: number | null;
  stage?: string;
  stageName?: string;
  manager_id?: string;
  manager_name?: string;
  deadline?: Date | null;
  tags?: string[];
  production_days_count?: number | null;
  created_at?: Date;
}

// Сессия пользователя (в памяти, позже можно в Redis)
interface UserSession {
  userId: string;
  state: DialogState;
  mode: 'text' | 'steps' | 'form' | null;
  dealData: {
    clientName?: string;
    clientPhone?: string;
    clientId?: string;
    productName?: string;
    productId?: string;
    quantity?: number;
    stage?: string;
    stageName?: string;
    note?: string;
  };
  // Для работы с существующими сделками
  currentDeal?: CurrentDeal;
  editField?: string;          // какое поле редактируем
  editValue?: any;             // новое значение
  // Для работы с задачами
  currentTask?: UnifiedTask;
  taskData: {
    title?: string;
    description?: string;
    deadline?: Date;
    priority?: 'urgent' | 'high' | 'normal' | 'low';
    dealId?: string;
    isReminder?: boolean;
  };
  tasksCache?: UnifiedTask[];  // кэш найденных задач
  // Контекст диалога
  context: DialogContext;
  messageHistory: HistoryMessage[];
  // Результаты поиска
  searchResults: {
    clients?: any[];
    products?: any[];
    deals?: any[];             // результаты поиска сделок
    tasks?: UnifiedTask[];     // результаты поиска задач
  };
  // Пагинация
  searchPage: number;
  searchTotal: number;
}

// Хранилище сессий (в памяти)
const sessions = new Map<string, UserSession>();

function getSession(userId: string): UserSession {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      userId,
      state: 'idle',
      mode: null,
      dealData: {},
      currentDeal: undefined,
      editField: undefined,
      editValue: undefined,
      currentTask: undefined,
      taskData: {},
      tasksCache: undefined,
      context: {},
      messageHistory: [],
      searchResults: {},
      searchPage: 0,
      searchTotal: 0
    });
  }
  return sessions.get(userId)!;
}

// Добавление в историю сообщений
function addToHistory(session: UserSession, role: 'user' | 'assistant', content: string) {
  session.messageHistory.push({
    role,
    content,
    timestamp: new Date()
  });
  // Ограничиваем историю 50 сообщениями
  if (session.messageHistory.length > 50) {
    session.messageHistory.shift();
  }
}

// Ответ ассистента
interface AssistantResponse {
  message: string;
  buttons?: Array<{
    text: string;
    action: string;
    data?: any;
  }>;
  state: DialogState;
  usedAI: boolean; // флаг использования LLM
  redirect?: string; // URL для редиректа (например, открыть форму)
}

// Локальный парсинг (без LLM) для простых команд
// Использует умный парсер с синонимами, опечатками и контекстом
function parseLocalIntent(text: string, session?: UserSession): { type: string; data?: any } | null {
  const normalizedText = normalizeText(text);
  const lowerText = text.toLowerCase().trim();

  // Используем умный парсер из text-utils
  const intent = parseIntent(text);

  // Приветствия (без AI)
  if (intent.action === 'greeting' && intent.confidence >= 90) {
    return { type: 'greeting' };
  }

  // Команды отмены (высокая уверенность)
  if (intent.action === 'cancel' && intent.confidence >= 90) {
    return { type: 'cancel' };
  }

  // Помощь
  if (intent.action === 'help' && intent.confidence >= 90) {
    return { type: 'help' };
  }

  // Подтверждение
  if (intent.action === 'confirm' && intent.confidence >= 90) {
    return { type: 'confirm' };
  }

  // Явные команды новой сделки
  if (intent.action === 'create' && intent.target === 'deal' && intent.confidence >= 80) {
    return { type: 'start_deal' };
  }

  // Команды поиска сделок
  if (intent.action === 'search' && intent.target === 'deal' && intent.confidence >= 70) {
    // Если есть конкретный номер - ищем по номеру
    if (intent.data?.orderNumber) {
      return { type: 'search_deal_by_number', data: { orderNumber: intent.data.orderNumber } };
    }
    // Если есть имя клиента - ищем по клиенту
    if (intent.data?.clientName) {
      return { type: 'search_deals_by_client', data: { clientName: intent.data.clientName } };
    }
    return { type: 'search_deals' };
  }

  // Просмотр сделки по номеру
  if (intent.action === 'view' && intent.target === 'deal' && intent.data?.orderNumber) {
    return { type: 'search_deal_by_number', data: { orderNumber: intent.data.orderNumber } };
  }

  // Отчёты
  if (intent.action === 'report' && intent.confidence >= 70) {
    return { type: 'report_deals', data: intent.data };
  }

  // Массовые операции
  if (intent.action === 'bulk' && intent.confidence >= 70) {
    return { type: 'bulk_operation', data: intent.data };
  }

  // ========== TASK INTENTS ==========

  // Утренний брифинг
  if (intent.action === 'task_briefing' && intent.confidence >= 80) {
    return { type: 'task_briefing' };
  }

  // Список задач
  if (intent.action === 'task_list' && intent.confidence >= 80) {
    return {
      type: 'task_list',
      data: { priority: intent.data?.taskPriority }
    };
  }

  // Создание задачи / напоминание
  if (intent.action === 'task_create' && intent.confidence >= 80) {
    return {
      type: 'task_create',
      data: {
        title: intent.data?.taskTitle,
        deadline: intent.data?.taskDeadline,
        priority: intent.data?.taskPriority,
        isReminder: intent.data?.isReminder
      }
    };
  }

  // Выполнение задачи
  if (intent.action === 'task_complete' && intent.confidence >= 80) {
    return { type: 'task_complete' };
  }

  // Просмотр задачи
  if (intent.action === 'task_view' && intent.confidence >= 80) {
    return { type: 'task_view', data: { query: intent.data?.query } };
  }

  // Редактирование с контекстом
  if (intent.action === 'edit' && intent.target === 'deal') {
    // Если используется контекст и есть текущая сделка в сессии
    if (intent.useContext && session?.currentDeal) {
      return {
        type: 'edit_current_deal',
        data: {
          field: intent.data?.field,
          value: intent.data?.amount || intent.data?.stage || intent.data?.value,
          dealId: session.currentDeal.id
        }
      };
    }
    // Если указан номер сделки
    if (intent.data?.orderNumber) {
      return {
        type: 'edit_deal_by_number',
        data: {
          orderNumber: intent.data.orderNumber,
          field: intent.data?.field,
          value: intent.data?.amount || intent.data?.stage
        }
      };
    }
    // Контекстная ссылка без текущей сделки - спросим
    if (intent.useContext) {
      return { type: 'need_deal_context' };
    }
  }

  // Выбор режима
  if (['текстом', 'текст', 'свободно'].some(cmd => normalizedText.includes(cmd))) {
    return { type: 'mode_text' };
  }
  if (['по шагам', 'шаги', 'пошагово'].some(cmd => normalizedText.includes(cmd))) {
    return { type: 'mode_steps' };
  }
  if (['форма', 'форму'].some(cmd => normalizedText.includes(cmd))) {
    return { type: 'mode_form' };
  }

  // Числа (для количества) - только если в контексте ввода количества
  const number = extractNumber(text);
  if (number !== null && number > 0 && number < 10000) {
    return { type: 'number', data: { value: number } };
  }

  // Поиск по номеру сделки: "сделка #275", "сделка 275", "#275"
  const orderNumber = extractOrderNumber(text);
  if (orderNumber) {
    return { type: 'search_deal_by_number', data: { orderNumber } };
  }

  // Низкая уверенность - возвращаем null для передачи в LLM
  if (intent.confidence < 50) {
    return null;
  }

  return null;
}

// Поиск клиентов в базе (без LLM)
async function searchClients(query: string): Promise<any[]> {
  // Ищем по имени в сделках (client_name)
  const results = await db
    .select({
      client_name: deals.client_name,
      client_phone: deals.contact_phone,
      client_email: deals.contact_email,
    })
    .from(deals)
    .where(
      or(
        like(deals.client_name, `%${query}%`),
        like(deals.contact_phone, `%${query}%`)
      )
    )
    .limit(5);

  // Убираем дубликаты по имени
  const unique = new Map();
  for (const r of results) {
    if (r.client_name && !unique.has(r.client_name)) {
      unique.set(r.client_name, r);
    }
  }

  return Array.from(unique.values());
}

// Поиск товаров на складе (без LLM)
async function searchProducts(query: string): Promise<any[]> {
  const results = await db
    .select({
      id: warehouse_items.id,
      name: warehouse_items.name,
      sku: warehouse_items.sku,
      quantity: warehouse_items.quantity,
      price: warehouse_items.price,
    })
    .from(warehouse_items)
    .where(
      or(
        like(warehouse_items.name, `%${query}%`),
        like(warehouse_items.sku, `%${query}%`)
      )
    )
    .limit(5);

  return results;
}

// ChatCRM: Поиск сделок через адаптер
async function searchDeals(query: string, page: number = 0, managerId?: string): Promise<{ deals: any[], total: number }> {
  const adapter = getAdapter();
  const result = await adapter.searchDeals(query, page, managerId ? { managerId } : undefined);

  // Преобразуем UnifiedDeal обратно в формат совместимый со старым кодом
  const deals = result.items.map(d => ({
    id: d.id,
    order_number: d.orderNumber,
    client_name: d.clientName,
    contact_phone: d.clientPhone,
    contact_email: d.clientEmail,
    company: d.company,
    amount: d.amount,
    stage: d.stage,
    stageName: d.stageName,
    manager_id: d.managerId,
    manager_name: d.managerName,
    deadline: d.deadline,
    tags: d.tags,
    production_days_count: d.productionDaysCount,
    created_at: d.createdAt,
  }));

  return { deals, total: result.total };
}

// ChatCRM: Получить сделку по ID через адаптер
async function getDealById(id: string): Promise<CurrentDeal | null> {
  const adapter = getAdapter();
  const deal = await adapter.getDealById(id);

  if (!deal) return null;

  // Преобразуем UnifiedDeal в CurrentDeal
  return {
    id: deal.id,
    order_number: deal.orderNumber,
    client_name: deal.clientName,
    contact_phone: deal.clientPhone,
    contact_email: deal.clientEmail,
    company: deal.company,
    amount: deal.amount,
    stage: deal.stage,
    stageName: deal.stageName,
    manager_id: deal.managerId,
    manager_name: deal.managerName,
    deadline: deal.deadline,
    tags: deal.tags,
    production_days_count: deal.productionDaysCount,
    created_at: deal.createdAt,
  };
}

// ChatCRM: Обновить сделку через адаптер
async function updateDeal(id: string, data: Partial<{
  client_name: string;
  contact_phone: string;
  contact_email: string;
  company: string;
  amount: number;
  stage: string;
  deadline: Date;
  tags: string[];
  manager_id: string;
  production_days_count: number;
}>): Promise<any> {
  const adapter = getAdapter();

  // Преобразуем формат полей в UnifiedDeal
  const unifiedData: Partial<UnifiedDeal> = {};
  if (data.client_name !== undefined) unifiedData.clientName = data.client_name;
  if (data.contact_phone !== undefined) unifiedData.clientPhone = data.contact_phone;
  if (data.contact_email !== undefined) unifiedData.clientEmail = data.contact_email;
  if (data.company !== undefined) unifiedData.company = data.company;
  if (data.amount !== undefined) unifiedData.amount = data.amount;
  if (data.stage !== undefined) unifiedData.stage = data.stage;
  if (data.deadline !== undefined) unifiedData.deadline = data.deadline;
  if (data.tags !== undefined) unifiedData.tags = data.tags;
  if (data.manager_id !== undefined) unifiedData.managerId = data.manager_id;
  if (data.production_days_count !== undefined) unifiedData.productionDaysCount = data.production_days_count;

  const updated = await adapter.updateDeal(id, unifiedData);

  // Возвращаем в старом формате для совместимости
  return {
    id: updated.id,
    order_number: updated.orderNumber,
    client_name: updated.clientName,
    contact_phone: updated.clientPhone,
    contact_email: updated.clientEmail,
    company: updated.company,
    amount: updated.amount,
    stage: updated.stage,
    manager_id: updated.managerId,
    deadline: updated.deadline,
    tags: updated.tags,
    production_days_count: updated.productionDaysCount,
    created_at: updated.createdAt,
    updated_at: updated.updatedAt,
  };
}

// Построить сообщение просмотра сделки
function buildDealViewMessage(deal: CurrentDeal): AssistantResponse {
  const amount = deal.amount ? `${deal.amount.toLocaleString('ru-RU')} ₽` : '—';
  const deadline = deal.deadline ? new Date(deal.deadline).toLocaleDateString('ru-RU') : '—';
  const created = deal.created_at ? new Date(deal.created_at).toLocaleDateString('ru-RU') : '—';

  const message = `📋 Сделка #${deal.order_number || '—'}\n\n` +
    `👤 Клиент: ${deal.client_name || '—'}\n` +
    `📞 Телефон: ${deal.contact_phone || '—'}\n` +
    `📧 Email: ${deal.contact_email || '—'}\n` +
    `🏢 Компания: ${deal.company || '—'}\n` +
    `💰 Сумма: ${amount}\n` +
    `📊 Этап: ${deal.stageName || deal.stage || '—'}\n` +
    `👷 Менеджер: ${deal.manager_name || '—'}\n` +
    `📅 Дедлайн: ${deadline}\n` +
    `🕐 Создана: ${created}`;

  return {
    message,
    buttons: [
      { text: '✏️ Изменить', action: 'edit_deal_menu' },
      { text: '📊 Сменить этап', action: 'edit_stage' },
      { text: '📋 Открыть', action: 'open_deal', data: { id: deal.id } },
      { text: '🏠 В начало', action: 'home' }
    ],
    state: 'deal_view',
    usedAI: false
  };
}

// Построить сообщение редактирования
function buildDealEditMenu(deal: CurrentDeal): AssistantResponse {
  return {
    message: `✏️ Что изменить в сделке #${deal.order_number}?`,
    buttons: EDITABLE_FIELDS.slice(0, 6).map(f => ({
      text: f.label,
      action: 'select_edit_field',
      data: { field: f.key }
    })),
    state: 'deal_edit_select',
    usedAI: false
  };
}

// Построить сообщение с результатами поиска сделок
function buildDealSearchResults(session: UserSession): AssistantResponse {
  const dealsFound = session.searchResults.deals || [];
  const total = session.searchTotal;
  const page = session.searchPage;
  const pageSize = 5;
  const start = page * pageSize + 1;
  const end = Math.min(start + dealsFound.length - 1, total);

  if (dealsFound.length === 0) {
    return {
      message: '❌ Сделки не найдены',
      buttons: [
        { text: '🔍 Новый поиск', action: 'search_deals' },
        { text: '📦 Новая сделка', action: 'start_deal' },
        { text: '🏠 В начало', action: 'home' }
      ],
      state: 'idle',
      usedAI: false
    };
  }

  // Формируем список сделок
  const dealsList = dealsFound.map((d, i) => {
    const amount = d.amount ? `${d.amount.toLocaleString('ru-RU')} ₽` : '—';
    return `${start + i}. #${d.order_number || '—'} - ${d.client_name || '—'} - ${amount}`;
  }).join('\n');

  const message = `🔍 Найдено ${total} сделок (${start}-${end}):\n\n${dealsList}`;

  // Кнопки выбора сделок
  const buttons = dealsFound.map((d, i) => ({
    text: `#${d.order_number || i + 1}`,
    action: 'select_deal',
    data: { id: d.id, index: i }
  }));

  // Пагинация
  if (page > 0) {
    buttons.push({ text: '⬅️ Назад', action: 'deals_prev_page', data: {} });
  }
  if (end < total) {
    buttons.push({ text: '➡️ Ещё', action: 'deals_next_page', data: {} });
  }
  buttons.push({ text: '🔍 Уточнить', action: 'search_deals', data: {} });
  buttons.push({ text: '🏠 В начало', action: 'home', data: {} });

  return {
    message,
    buttons,
    state: 'deal_search_result',
    usedAI: false
  };
}

// Получить этапы сделок (без LLM)
async function getStages(): Promise<any[]> {
  const results = await db
    .select({
      id: dealStages.id,
      key: dealStages.key,
      name: dealStages.name,
      color: dealStages.color,
      order: dealStages.order,
    })
    .from(dealStages)
    .orderBy(asc(dealStages.order));

  return results;
}

// Создание сделки в базе
async function createDeal(data: {
  clientName: string;
  clientPhone?: string;
  productName?: string;
  quantity?: number;
  stage?: string;
  note?: string;
  userId: string;
}): Promise<any> {
  // Получаем следующий номер заказа
  const allDeals = await db.select({ order_number: deals.order_number }).from(deals);
  const allNumbers = allDeals
    .map(d => d.order_number)
    .filter(n => n && !isNaN(parseInt(n)))
    .map(n => parseInt(n!))
    .filter(n => !isNaN(n));
  const maxNumber = allNumbers.length > 0 ? Math.max(...allNumbers, 268) : 268;
  const orderNumber = String(maxNumber + 1);

  // Формируем заметку с товаром и количеством
  let notes = data.note || '';
  if (data.productName) {
    notes = `Товар: ${data.productName}` + (data.quantity ? ` x ${data.quantity} шт` : '') + (notes ? `\n${notes}` : '');
  }

  const newDeal = await db.insert(deals).values({
    id: nanoid(),
    order_number: orderNumber,
    client_name: data.clientName,
    client_phone: data.clientPhone || null,
    status: 'new',
    stage: data.stage || 'new',
    pipeline_id: null,
    stage_id: null,
    manager_id: data.userId,
    total_amount: 0,
    notes: notes || null,
  }).returning();

  return newDeal[0];
}

// ========== ОТЧЁТЫ ==========

// Построить отчёт по сделкам
async function buildDealReport(userId: string, stageFilter?: string): Promise<AssistantResponse> {
  try {
    const adapter = getAdapter();

    // Получаем все этапы
    const stages = await getStages();

    // Получаем статистику по каждому этапу
    const stats: Array<{ stage: string; stageName: string; count: number; totalAmount: number }> = [];

    for (const stage of stages) {
      const result = await adapter.searchDeals('', 0, { stage: stage.key });
      const stageDeals = result.items;
      const totalAmount = stageDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

      stats.push({
        stage: stage.key,
        stageName: stage.name,
        count: result.total,
        totalAmount
      });
    }

    // Общая статистика
    const totalDeals = stats.reduce((sum, s) => sum + s.count, 0);
    const totalAmount = stats.reduce((sum, s) => sum + s.totalAmount, 0);

    // Формируем сообщение
    let message = `📊 **Отчёт по сделкам**\n\n`;

    if (stageFilter) {
      // Фильтр по конкретному этапу
      const filtered = stats.find(s => s.stage === stageFilter || s.stageName.toLowerCase().includes(stageFilter.toLowerCase()));
      if (filtered) {
        message += `📈 Этап: ${filtered.stageName}\n`;
        message += `📦 Сделок: ${filtered.count}\n`;
        message += `💰 Сумма: ${filtered.totalAmount.toLocaleString('ru-RU')} ₽`;
      } else {
        message += `❌ Этап "${stageFilter}" не найден`;
      }
    } else {
      // Все этапы
      message += `📦 Всего сделок: ${totalDeals}\n`;
      message += `💰 Общая сумма: ${totalAmount.toLocaleString('ru-RU')} ₽\n\n`;
      message += `**По этапам:**\n`;

      for (const s of stats) {
        if (s.count > 0) {
          message += `• ${s.stageName}: ${s.count} шт (${s.totalAmount.toLocaleString('ru-RU')} ₽)\n`;
        }
      }
    }

    // Кнопки для детализации
    const buttons = stages.slice(0, 4).map(s => ({
      text: `📊 ${s.name}`,
      action: 'report_by_stage',
      data: { stage: s.key }
    }));
    buttons.push({ text: '🏠 В начало', action: 'home', data: {} });

    return {
      message,
      buttons,
      state: 'idle',
      usedAI: false
    };
  } catch (error) {
    console.error('[Assistant] Report error:', error);
    return {
      message: '❌ Ошибка при получении отчёта',
      buttons: [{ text: '🏠 В начало', action: 'home' }],
      state: 'idle',
      usedAI: false
    };
  }
}

// ========== МАССОВЫЕ ОПЕРАЦИИ ==========

// Построить подтверждение массовой операции
async function buildBulkOperationConfirm(session: UserSession, data: any): Promise<AssistantResponse> {
  const stages = await getStages();

  if (data?.stage) {
    // Уже указан целевой этап
    const targetStage = stages.find(s =>
      s.key === data.stage ||
      s.name.toLowerCase().includes(data.stage.toLowerCase())
    );

    if (targetStage) {
      // Считаем сколько сделок будет затронуто
      const adapter = getAdapter();

      // Получаем все сделки не в этом этапе
      const result = await adapter.searchDeals('', 0);
      const dealsToChange = result.items.filter(d => d.stage !== targetStage.key);

      return {
        message: `⚠️ **Массовое изменение этапа**\n\n` +
          `Целевой этап: ${targetStage.name}\n` +
          `Сделок будет изменено: ${dealsToChange.length}\n\n` +
          `Выполнить операцию?`,
        buttons: [
          { text: '✅ Да, изменить', action: 'bulk_change_stage_confirm', data: { stage: targetStage.key, count: dealsToChange.length } },
          { text: '❌ Отмена', action: 'home' }
        ],
        state: 'idle',
        usedAI: false
      };
    }
  }

  // Не указан этап - показываем выбор
  return {
    message: '🔄 **Массовые операции**\n\nВыбери действие:',
    buttons: [
      ...stages.slice(0, 4).map(s => ({
        text: `📊 Все в "${s.name}"`,
        action: 'bulk_change_stage_preview',
        data: { stage: s.key }
      })),
      { text: '🏠 В начало', action: 'home', data: {} }
    ],
    state: 'idle',
    usedAI: false
  };
}

// ========== КОНЕЦ ОТЧЁТОВ И МАССОВЫХ ОПЕРАЦИЙ ==========

// ========== ЗАДАЧИ ==========

// Стили общения для задач
const COMMUNICATION_STYLES = {
  friendly: {
    greeting: 'Привет! 👋',
    morningBriefing: '🌅 Доброе утро! Вот план на сегодня:',
    urgentLabel: '🔥 СРОЧНО',
    soonLabel: '📋 Скоро',
    completedMessage: 'Отлично! Так держать! 💪',
    emptyTasks: 'Всё сделано, отдыхай! 🎉',
    taskCreated: '✅ Задача создана!',
  },
  formal: {
    greeting: 'Добрый день.',
    morningBriefing: 'Ваши задачи на сегодня:',
    urgentLabel: 'Требует немедленного внимания',
    soonLabel: 'В ближайшее время',
    completedMessage: 'Задача выполнена.',
    emptyTasks: 'Активных задач нет.',
    taskCreated: 'Задача добавлена.',
  },
  motivating: {
    greeting: 'Новый день - новые победы! 🚀',
    morningBriefing: '💪 Время показать себя! Вот твои задачи:',
    urgentLabel: '🎯 Цель #1',
    soonLabel: '🏃 На подходе',
    completedMessage: 'Ты лучший! Следующая цель ждёт! 🎯',
    emptyTasks: 'Всё чисто! Ты - машина! 💪',
    taskCreated: '🎯 Цель добавлена! Вперёд!',
  }
};

// Построить утренний брифинг
async function buildTaskBriefing(userId: string, style: 'friendly' | 'formal' | 'motivating' = 'friendly'): Promise<AssistantResponse> {
  try {
    const adapter = getAdapter();
    const styleText = COMMUNICATION_STYLES[style];

    // Получаем задачи, требующие внимания
    const attention = await adapter.getTasksNeedingAttention?.(userId);

    if (!attention) {
      return {
        message: '❌ Функция задач не доступна',
        buttons: [{ text: '🏠 В начало', action: 'home' }],
        state: 'idle',
        usedAI: false
      };
    }

    const { urgent, soon, longRunning, overdue } = attention;
    const totalTasks = urgent.length + soon.length + longRunning.length + overdue.length;

    // Если нет задач
    if (totalTasks === 0) {
      return {
        message: `${styleText.morningBriefing}\n\n${styleText.emptyTasks}`,
        buttons: [
          { text: '➕ Создать задачу', action: 'task_create_start' },
          { text: '📋 Все задачи', action: 'task_list_all' },
          { text: '🏠 В начало', action: 'home' }
        ],
        state: 'task_briefing',
        usedAI: false
      };
    }

    let message = `${styleText.morningBriefing}\n\n`;

    // Просроченные (если есть)
    if (overdue.length > 0) {
      message += `⚠️ **ПРОСРОЧЕНО (${overdue.length}):**\n`;
      for (const t of overdue.slice(0, 3)) {
        message += `• ${t.title}${t.deadline ? ` (было: ${formatDate(t.deadline)})` : ''}\n`;
      }
      if (overdue.length > 3) message += `  ... и ещё ${overdue.length - 3}\n`;
      message += '\n';
    }

    // Срочные
    if (urgent.length > 0) {
      message += `${styleText.urgentLabel} (${urgent.length}):\n`;
      for (const t of urgent.slice(0, 3)) {
        message += `• ${t.title}${t.deadline ? ` (до ${formatDate(t.deadline)})` : ''}\n`;
      }
      if (urgent.length > 3) message += `  ... и ещё ${urgent.length - 3}\n`;
      message += '\n';
    }

    // Скоро
    if (soon.length > 0) {
      message += `${styleText.soonLabel} (${soon.length}):\n`;
      for (const t of soon.slice(0, 3)) {
        message += `• ${t.title}${t.deadline ? ` (${formatDate(t.deadline)})` : ''}\n`;
      }
      if (soon.length > 3) message += `  ... и ещё ${soon.length - 3}\n`;
      message += '\n';
    }

    // Длинные задачи
    if (longRunning.length > 0) {
      message += `⏳ Требуют времени (${longRunning.length}):\n`;
      for (const t of longRunning.slice(0, 2)) {
        message += `• ${t.title} (~${t.estimatedHours}ч)\n`;
      }
      message += '\n';
    }

    // Подсказка
    if (urgent.length > 0 || overdue.length > 0) {
      message += '💡 Начни с первой - она горит!';
    }

    // Формируем кнопки
    const buttons: Array<{ text: string; action: string; data?: any }> = [];

    if (urgent.length > 0 || overdue.length > 0) {
      buttons.push({ text: '🔥 Срочные', action: 'task_list_urgent' });
    }
    buttons.push({ text: '📋 Все задачи', action: 'task_list_all' });
    buttons.push({ text: '✅ Отметить', action: 'task_complete_start' });
    buttons.push({ text: '➕ Создать', action: 'task_create_start' });

    return {
      message,
      buttons,
      state: 'task_briefing',
      usedAI: false
    };
  } catch (error) {
    console.error('[Assistant] Task briefing error:', error);
    return {
      message: '❌ Ошибка при получении задач',
      buttons: [{ text: '🏠 В начало', action: 'home' }],
      state: 'idle',
      usedAI: false
    };
  }
}

// Построить список задач
async function buildTaskList(userId: string, filter?: { priority?: string }): Promise<AssistantResponse> {
  try {
    const adapter = getAdapter();
    let tasks: UnifiedTask[] = [];

    if (filter?.priority === 'urgent') {
      tasks = await adapter.getUrgentTasks?.(userId) || [];
    } else {
      tasks = await adapter.getMyTasks?.(userId) || [];
    }

    if (tasks.length === 0) {
      return {
        message: '📋 Активных задач нет',
        buttons: [
          { text: '➕ Создать задачу', action: 'task_create_start' },
          { text: '🏠 В начало', action: 'home' }
        ],
        state: 'task_list',
        usedAI: false
      };
    }

    // Сортируем по score
    tasks.sort((a, b) => (b.score || 0) - (a.score || 0));

    let message = filter?.priority === 'urgent'
      ? `🔥 Срочные задачи (${tasks.length}):\n\n`
      : `📋 Мои задачи (${tasks.length}):\n\n`;

    tasks.slice(0, 5).forEach((t, i) => {
      const priorityIcon = t.priority === 'urgent' ? '🔥' : t.priority === 'high' ? '❗' : '';
      const deadlineStr = t.deadline ? ` (до ${formatDate(t.deadline)})` : '';
      const overdueStr = t.isOverdue ? ' ⚠️' : '';
      message += `${i + 1}. ${priorityIcon} ${t.title}${deadlineStr}${overdueStr}\n`;
    });

    if (tasks.length > 5) {
      message += `\n... и ещё ${tasks.length - 5} задач`;
    }

    // Кнопки для выбора задач
    const buttons = tasks.slice(0, 5).map((t, i) => ({
      text: `${i + 1}`,
      action: 'task_select',
      data: { id: t.id, index: i }
    }));

    buttons.push({ text: '✅ Выполнить', action: 'task_complete_start' });
    buttons.push({ text: '➕ Создать', action: 'task_create_start' });
    buttons.push({ text: '🏠 В начало', action: 'home' });

    return {
      message,
      buttons,
      state: 'task_list',
      usedAI: false
    };
  } catch (error) {
    console.error('[Assistant] Task list error:', error);
    return {
      message: '❌ Ошибка при получении задач',
      buttons: [{ text: '🏠 В начало', action: 'home' }],
      state: 'idle',
      usedAI: false
    };
  }
}

// Построить просмотр задачи
function buildTaskViewMessage(task: UnifiedTask): AssistantResponse {
  const statusLabels: Record<string, string> = {
    'new': 'Новая',
    'in_progress': 'В работе',
    'pending_review': 'На проверке',
    'pending': 'Ожидание',
    'completed': 'Выполнена',
    'cancelled': 'Отменена',
    'on_hold': 'На паузе',
  };

  const priorityLabels: Record<string, string> = {
    'urgent': '🔥 Срочный',
    'high': '❗ Высокий',
    'normal': '📋 Обычный',
    'low': '📉 Низкий',
  };

  const deadlineStr = task.deadline ? formatDate(task.deadline) : '—';
  const dealStr = task.dealInfo
    ? `#${task.dealInfo.orderNumber || '—'} (${task.dealInfo.clientName})`
    : '—';

  const message = `📋 **${task.title}**\n\n` +
    `📊 Статус: ${statusLabels[task.status] || task.status}\n` +
    `${priorityLabels[task.priority] || task.priority}\n` +
    `📅 Дедлайн: ${deadlineStr}${task.isOverdue ? ' ⚠️ Просрочен!' : ''}\n` +
    `🔗 Сделка: ${dealStr}\n` +
    (task.description ? `\n📝 ${task.description}\n` : '') +
    (task.estimatedHours ? `⏱️ Оценка: ${task.estimatedHours}ч\n` : '');

  return {
    message,
    buttons: [
      { text: '✅ Выполнить', action: 'task_complete_one', data: { id: task.id } },
      { text: '📝 Изменить', action: 'task_edit', data: { id: task.id } },
      task.dealId ? { text: '🔗 К сделке', action: 'select_deal', data: { id: task.dealId } } : null,
      { text: '📋 Все задачи', action: 'task_list_all' },
      { text: '🏠 В начало', action: 'home' }
    ].filter(Boolean) as any[],
    state: 'task_view',
    usedAI: false
  };
}

// Построить выбор задачи для завершения
async function buildTaskCompleteSelect(userId: string, session: UserSession): Promise<AssistantResponse> {
  try {
    const adapter = getAdapter();
    const tasks = await adapter.getMyTasks?.(userId) || [];

    if (tasks.length === 0) {
      return {
        message: '📋 Нет активных задач для завершения',
        buttons: [
          { text: '➕ Создать задачу', action: 'task_create_start' },
          { text: '🏠 В начало', action: 'home' }
        ],
        state: 'idle',
        usedAI: false
      };
    }

    // Сортируем по score
    tasks.sort((a, b) => (b.score || 0) - (a.score || 0));
    session.tasksCache = tasks;

    let message = '✅ Какую задачу закрыть?\n\n';
    tasks.slice(0, 5).forEach((t, i) => {
      const priorityIcon = t.priority === 'urgent' ? '🔥' : t.priority === 'high' ? '❗' : '';
      message += `${i + 1}. ${priorityIcon} ${t.title}\n`;
    });

    const buttons = tasks.slice(0, 5).map((t, i) => ({
      text: `${i + 1}`,
      action: 'task_complete_one',
      data: { id: t.id, index: i }
    }));

    buttons.push({ text: '🔍 Другую', action: 'task_search' });
    buttons.push({ text: '❌ Отмена', action: 'home' });

    return {
      message,
      buttons,
      state: 'task_complete_select',
      usedAI: false
    };
  } catch (error) {
    console.error('[Assistant] Task complete select error:', error);
    return {
      message: '❌ Ошибка при получении задач',
      buttons: [{ text: '🏠 В начало', action: 'home' }],
      state: 'idle',
      usedAI: false
    };
  }
}

// Форматирование даты
function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'сегодня';
  if (diffDays === 1) return 'завтра';
  if (diffDays === -1) return 'вчера';
  if (diffDays < -1) return `${Math.abs(diffDays)} дн. назад`;

  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

// ========== КОНЕЦ ЗАДАЧ ==========

// Главная функция обработки сообщения
export async function processMessage(
  userId: string,
  text: string,
  action?: string
): Promise<AssistantResponse> {
  const session = getSession(userId);
  let usedAI = false;

  // Обновляем время активности в контекстной памяти
  contextMemory.touchContext(userId);

  // Обработка action (callback от кнопок)
  if (action) {
    return handleAction(userId, action, text);
  }

  // Сначала пробуем локальный парсинг (без LLM)
  // Передаём session для контекстных команд
  const localIntent = parseLocalIntent(text, session);

  if (localIntent) {
    switch (localIntent.type) {
      case 'greeting':
        // Приветствие - отвечаем без AI
        return {
          message: 'Привет! 👋 Я помощник ERP.\n\nЧем могу помочь?',
          buttons: [
            { text: '📦 Новая сделка', action: 'start_deal' },
            { text: '🔍 Найти сделку', action: 'search_deals' },
            { text: '📊 Статистика', action: 'report_deals' },
            { text: '💬 Помощь', action: 'help' }
          ],
          state: 'idle',
          usedAI: false
        };

      case 'cancel':
        session.state = 'idle';
        session.dealData = {};
        session.searchResults = {};
        return {
          message: '❌ Отменено. Чем могу помочь?',
          buttons: [
            { text: '📦 Новая сделка', action: 'start_deal' },
            { text: '🔍 Найти клиента', action: 'search_client' },
            { text: '📋 Мои задачи', action: 'my_tasks' }
          ],
          state: 'idle',
          usedAI: false
        };

      case 'help':
        return {
          message: '💬 Я помогу работать с ERP!\n\n' +
            'Могу:\n' +
            '• Создать сделку\n' +
            '• Найти клиента\n' +
            '• Показать товары\n\n' +
            'Просто напиши что нужно или используй кнопки.',
          buttons: [
            { text: '📦 Новая сделка', action: 'start_deal' },
            { text: '💬 Помощь', action: 'help' }
          ],
          state: session.state,
          usedAI: false
        };

      case 'start_deal':
        session.state = 'mode_select';
        return {
          message: '📦 Создаём сделку!\n\nКак удобнее?',
          buttons: [
            { text: '💬 Текстом', action: 'mode_text' },
            { text: '📝 По шагам', action: 'mode_steps' },
            { text: '📋 Форма', action: 'mode_form' }
          ],
          state: 'mode_select',
          usedAI: false
        };

      case 'search_deals':
        session.state = 'deal_search';
        return {
          message: '🔍 Поиск сделок\n\nВведи имя клиента, номер или телефон:',
          buttons: [
            { text: '📋 Мои сделки', action: 'my_deals' },
            { text: '📋 Все сделки', action: 'all_deals' },
            { text: '❌ Отмена', action: 'cancel' }
          ],
          state: 'deal_search',
          usedAI: false
        };

      case 'search_deal_by_number':
        // Поиск по номеру сделки
        const orderNum = localIntent.data.orderNumber;
        const searchResult = await searchDeals(orderNum);
        if (searchResult.deals.length === 1) {
          // Нашли одну сделку - показываем её
          const deal = await getDealById(searchResult.deals[0].id);
          if (deal) {
            session.currentDeal = deal;
            session.context.lastMentionedDeal = deal.id;
            session.state = 'deal_view';
            // Запоминаем сделку в контекстной памяти
            contextMemory.rememberDeal(userId, {
              id: deal.id,
              orderNumber: deal.order_number,
              clientName: deal.client_name || '',
              amount: deal.amount || undefined,
              stage: deal.stage,
            });
            contextMemory.recordAction(userId, 'view_deal', deal.id);
            return buildDealViewMessage(deal);
          }
        } else if (searchResult.deals.length > 1) {
          // Нашли несколько - показываем список
          session.searchResults.deals = searchResult.deals;
          session.searchTotal = searchResult.total;
          session.searchPage = 0;
          session.state = 'deal_search_result';
          return buildDealSearchResults(session);
        }
        // Не нашли
        return {
          message: `❌ Сделка #${orderNum} не найдена`,
          buttons: [
            { text: '🔍 Искать', action: 'search_deals' },
            { text: '📦 Новая сделка', action: 'start_deal' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'idle',
          usedAI: false
        };

      case 'number':
        if (session.state === 'deal_quantity') {
          session.dealData.quantity = localIntent.data.value;
          session.state = 'deal_confirm';
          return buildConfirmMessage(session);
        }
        break;

      case 'confirm':
        // Подтверждение в разных состояниях
        if (session.state === 'deal_confirm') {
          return await finalizeDeal(session);
        }
        // Подтверждение клиента - "да", "да новый", "yes" и т.д.
        if (session.state === 'deal_client_confirm') {
          const firstClient = session.searchResults.clients?.[0];
          if (firstClient) {
            session.dealData.clientName = firstClient.client_name;
            session.dealData.clientPhone = firstClient.client_phone;
            session.state = 'deal_product';
            return {
              message: `✅ Клиент: ${firstClient.client_name}\n\n📦 Что продаём? (или пропусти)`,
              buttons: [
                { text: '🔍 Найти товар', action: 'product_search' },
                { text: '➡️ Без товара', action: 'skip_product' },
                { text: '❌ Отмена', action: 'cancel' }
              ],
              state: 'deal_product',
              usedAI: false
            };
          }
        }
        // Подтверждение товара
        if (session.state === 'deal_product_confirm') {
          const firstProduct = session.searchResults.products?.[0];
          if (firstProduct) {
            session.dealData.productName = firstProduct.name;
            session.dealData.productId = firstProduct.id;
            session.state = 'deal_quantity';
            return {
              message: `✅ Товар: ${firstProduct.name}\n\n🔢 Сколько штук?`,
              buttons: [
                { text: '1', action: 'qty', data: { value: 1 } },
                { text: '2', action: 'qty', data: { value: 2 } },
                { text: '5', action: 'qty', data: { value: 5 } },
                { text: '10', action: 'qty', data: { value: 10 } },
                { text: '➡️ Пропустить', action: 'skip_quantity' }
              ],
              state: 'deal_quantity',
              usedAI: false
            };
          }
        }
        break;

      // ========== НОВЫЕ ТИПЫ INTENT ==========

      case 'search_deals_by_client':
        // Поиск сделок по имени клиента
        const clientSearchResult = await searchDeals(localIntent.data.clientName);
        session.searchResults.deals = clientSearchResult.deals;
        session.searchTotal = clientSearchResult.total;
        session.searchPage = 0;
        session.context.lastMentionedClient = localIntent.data.clientName;
        session.state = 'deal_search_result';
        contextMemory.rememberClient(userId, { name: localIntent.data.clientName });
        return buildDealSearchResults(session);

      case 'report_deals':
        // Отчёт по сделкам
        return await buildDealReport(userId, localIntent.data?.stage);

      case 'bulk_operation':
        // Массовые операции
        return await buildBulkOperationConfirm(session, localIntent.data);

      case 'edit_current_deal':
        // Редактирование текущей сделки (контекстная команда)
        if (session.currentDeal) {
          const { field, value } = localIntent.data;

          // Если указано поле и значение - сразу редактируем
          if (field && value !== undefined) {
            session.editField = field;
            // Прямо сохраняем
            return await handleAction(userId, 'save_edit', JSON.stringify({ value }));
          }

          // Если указано только поле - запрашиваем значение
          if (field) {
            session.editField = field;
            session.state = 'deal_edit_field';
            const fieldInfo = EDITABLE_FIELDS.find(f => f.key === field);

            if (field === 'stage') {
              const stages = await getStages();
              return {
                message: `📊 Сделка #${session.currentDeal.order_number}\nТекущий этап: ${session.currentDeal.stageName || session.currentDeal.stage}\n\nВыбери новый этап:`,
                buttons: stages.map(s => ({
                  text: s.name,
                  action: 'save_edit',
                  data: { value: s.key, display: s.name }
                })),
                state: 'deal_edit_field',
                usedAI: false
              };
            }

            return {
              message: `✏️ ${fieldInfo?.label || field}\n\nТекущее значение: ${(session.currentDeal as any)[field] || '—'}\n\nВведи новое значение:`,
              buttons: [{ text: '❌ Отмена', action: 'cancel_edit' }],
              state: 'deal_edit_field',
              usedAI: false
            };
          }

          // Иначе - меню редактирования
          session.state = 'deal_edit_select';
          return buildDealEditMenu(session.currentDeal);
        }
        // Нет текущей сделки
        return {
          message: '❓ Какую сделку изменить?\nВведи номер или найди:',
          buttons: [
            { text: '🔍 Найти сделку', action: 'search_deals' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'deal_search',
          usedAI: false
        };

      case 'edit_deal_by_number':
        // Редактирование сделки по номеру
        const editSearchResult = await searchDeals(localIntent.data.orderNumber);
        if (editSearchResult.deals.length === 1) {
          const dealToEdit = await getDealById(editSearchResult.deals[0].id);
          if (dealToEdit) {
            session.currentDeal = dealToEdit;
            session.context.lastMentionedDeal = dealToEdit.id;
            contextMemory.rememberDeal(userId, {
              id: dealToEdit.id,
              orderNumber: dealToEdit.order_number,
              clientName: dealToEdit.client_name || '',
              stage: dealToEdit.stage,
            });

            const { field, value } = localIntent.data;
            if (field) {
              session.editField = field;
              session.state = 'deal_edit_field';

              if (field === 'stage' && value) {
                // Сразу меняем этап
                return await handleAction(userId, 'save_edit', JSON.stringify({ value }));
              }

              if (field === 'stage') {
                const stages = await getStages();
                return {
                  message: `📊 Сделка #${dealToEdit.order_number}\nТекущий этап: ${dealToEdit.stageName || dealToEdit.stage}\n\nВыбери новый этап:`,
                  buttons: stages.map(s => ({
                    text: s.name,
                    action: 'save_edit',
                    data: { value: s.key, display: s.name }
                  })),
                  state: 'deal_edit_field',
                  usedAI: false
                };
              }
            }

            session.state = 'deal_edit_select';
            return buildDealEditMenu(dealToEdit);
          }
        }
        return {
          message: `❌ Сделка #${localIntent.data.orderNumber} не найдена`,
          buttons: [
            { text: '🔍 Искать', action: 'search_deals' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'idle',
          usedAI: false
        };

      case 'need_deal_context':
        // Пользователь хочет редактировать, но не указал какую сделку
        // Проверим контекстную память
        const lastDeal = contextMemory.getLastDeal(userId);
        if (lastDeal) {
          // Предлагаем использовать последнюю
          return {
            message: `❓ Ты имеешь в виду сделку #${lastDeal.orderNumber} (${lastDeal.clientName})?`,
            buttons: [
              { text: `✅ Да, #${lastDeal.orderNumber}`, action: 'select_deal', data: { id: lastDeal.id } },
              { text: '🔍 Найти другую', action: 'search_deals' },
              { text: '🏠 В начало', action: 'home' }
            ],
            state: 'idle',
            usedAI: false
          };
        }
        return {
          message: '❓ Какую сделку изменить?\nВведи номер или найди:',
          buttons: [
            { text: '🔍 Найти сделку', action: 'search_deals' },
            { text: '📋 Последние сделки', action: 'all_deals' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'deal_search',
          usedAI: false
        };

      // ========== TASK MANAGER INTENTS ==========

      case 'task_briefing':
        // Утренний брифинг "что на сегодня?"
        return await buildTaskBriefing(userId, contextMemory.getCommunicationStyle(userId));

      case 'task_list':
        // Показать список задач
        return await buildTaskList(userId, localIntent.data?.priority ? { priority: localIntent.data.priority } : undefined);

      case 'task_create':
        // Начать создание задачи
        session.state = 'task_create_title';
        session.taskData = {};
        if (localIntent.data?.title) {
          session.taskData.title = localIntent.data.title;
          session.state = 'task_create_deadline';
          return {
            message: `📝 Задача: "${localIntent.data.title}"\n\n📅 Когда дедлайн?`,
            buttons: [
              { text: 'Сегодня', action: 'task_deadline', data: { days: 0 } },
              { text: 'Завтра', action: 'task_deadline', data: { days: 1 } },
              { text: 'Через неделю', action: 'task_deadline', data: { days: 7 } },
              { text: '➡️ Без дедлайна', action: 'task_deadline', data: { days: null } },
              { text: '❌ Отмена', action: 'home' }
            ],
            state: 'task_create_deadline',
            usedAI: false
          };
        }
        return {
          message: '📝 Создаём задачу\n\nНапиши название задачи:',
          buttons: [{ text: '❌ Отмена', action: 'home' }],
          state: 'task_create_title',
          usedAI: false
        };

      case 'task_complete':
        // Завершить задачу
        if (localIntent.data?.taskId) {
          // Конкретная задача указана
          return await handleAction(userId, 'task_complete_one', JSON.stringify({ id: localIntent.data.taskId }));
        }
        // Показать выбор задачи
        return await buildTaskCompleteSelect(userId, session);

      case 'task_view':
        // Просмотр задачи
        if (localIntent.data?.taskId) {
          const adapter = getAdapter();
          const task = await adapter.getTaskById?.(localIntent.data.taskId);
          if (task) {
            session.currentTask = task;
            return buildTaskViewMessage(task);
          }
        }
        return {
          message: '❌ Задача не найдена',
          buttons: [
            { text: '📋 Все задачи', action: 'task_list_all' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'idle',
          usedAI: false
        };
    }
  }

  // Обработка по состоянию диалога
  switch (session.state) {
    case 'idle':
      // Пробуем AI парсинг для определения намерения
      const parsed = await parseUserMessage(text);
      usedAI = true;

      if (parsed.type === 'deal') {
        // Пользователь хочет создать сделку
        session.dealData = {
          clientName: parsed.client_name,
          clientPhone: parsed.client_phone,
          productName: parsed.product_name,
          quantity: parsed.quantity,
          note: parsed.note
        };

        if (parsed.client_name) {
          // Ищем клиента в базе
          const clients = await searchClients(parsed.client_name);
          if (clients.length > 0) {
            session.searchResults.clients = clients;
            session.state = 'deal_client_confirm';
            return {
              message: `Нашёл клиента "${clients[0].client_name}"\nЭто он?`,
              buttons: [
                { text: '✅ Да', action: 'client_confirm', data: { index: 0 } },
                { text: '🔍 Другой', action: 'client_search' },
                { text: '➕ Новый', action: 'client_new' }
              ],
              state: 'deal_client_confirm',
              usedAI: true
            };
          }
        }

        session.state = 'deal_client';
        return {
          message: '👤 Кто клиент?\nВведи имя или телефон:',
          buttons: [
            { text: '🔍 Найти', action: 'client_search' },
            { text: '❌ Отмена', action: 'cancel' }
          ],
          state: 'deal_client',
          usedAI: true
        };
      }

      // Если не поняли - предлагаем выбор
      return {
        message: 'Привет! 👋\n\nЧем могу помочь?',
        buttons: [
          { text: '📦 Новая сделка', action: 'start_deal' },
          { text: '🔍 Найти клиента', action: 'search_client' },
          { text: '📋 Мои задачи', action: 'my_tasks' }
        ],
        state: 'idle',
        usedAI
      };

    case 'mode_select':
      return handleModeSelect(session, text);

    case 'deal_client':
      return await handleClientInput(session, text);

    case 'deal_product':
      return await handleProductInput(session, text);

    case 'deal_quantity':
      return await handleQuantityInput(session, text);

    case 'deal_stage':
      // Пользователь вручную ввёл этап - ищем похожий
      const stages = await getStages();
      const matchingStage = stages.find(s =>
        s.name.toLowerCase().includes(text.toLowerCase()) ||
        s.key.toLowerCase().includes(text.toLowerCase())
      );
      if (matchingStage) {
        session.dealData.stage = matchingStage.key;
        session.dealData.stageName = matchingStage.name;
        session.state = 'deal_confirm';
        return buildConfirmMessage(session);
      }
      // Не нашли - показываем список
      return await buildStageSelectMessage(session);

    case 'deal_search':
      // Пользователь вводит поисковый запрос
      if (text.trim()) {
        const searchRes = await searchDeals(text.trim());
        session.searchResults.deals = searchRes.deals;
        session.searchTotal = searchRes.total;
        session.searchPage = 0;
        session.context.lastMentionedClient = text.trim();
        session.state = 'deal_search_result';
        return buildDealSearchResults(session);
      }
      return {
        message: '🔍 Введи имя клиента, номер сделки или телефон:',
        buttons: [
          { text: '📋 Все сделки', action: 'all_deals' },
          { text: '❌ Отмена', action: 'cancel' }
        ],
        state: 'deal_search',
        usedAI: false
      };

    case 'deal_edit_field':
      // Пользователь вводит новое значение поля
      if (!session.currentDeal || !session.editField) {
        return {
          message: '❌ Нет данных для редактирования',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      }
      // Передаём на сохранение
      return await handleAction(userId, 'save_edit', text);

    // ========== TASK STATE HANDLERS ==========

    case 'task_create_title':
      // Пользователь ввёл название задачи
      session.taskData.title = text.trim();
      session.state = 'task_create_deadline';
      return {
        message: `📝 Задача: "${session.taskData.title}"\n\n📅 Когда дедлайн?`,
        buttons: [
          { text: 'Сегодня', action: 'task_deadline', data: { days: 0 } },
          { text: 'Завтра', action: 'task_deadline', data: { days: 1 } },
          { text: 'Через 3 дня', action: 'task_deadline', data: { days: 3 } },
          { text: 'Через неделю', action: 'task_deadline', data: { days: 7 } },
          { text: '➡️ Без дедлайна', action: 'task_deadline', data: { days: null } },
          { text: '❌ Отмена', action: 'home' }
        ],
        state: 'task_create_deadline',
        usedAI: false
      };

    case 'task_create_deadline':
      // Пользователь ввёл дедлайн текстом (можно ввести число дней или пропустить)
      const deadlineText = text.toLowerCase().trim();
      if (deadlineText === 'нет' || deadlineText === 'без' || deadlineText === 'пропустить' || deadlineText === 'skip') {
        // Без дедлайна
        session.state = 'task_create_priority';
      } else {
        // Пробуем распарсить как число дней
        const daysMatch = deadlineText.match(/(\d+)/);
        if (daysMatch) {
          const days = parseInt(daysMatch[1]);
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + days);
          session.taskData.deadline = deadline;
        }
        session.state = 'task_create_priority';
      }
      return {
        message: `📝 Задача: "${session.taskData.title}"\n${session.taskData.deadline ? `📅 Дедлайн: ${formatDate(session.taskData.deadline)}` : '📅 Без дедлайна'}\n\n⚡ Приоритет?`,
        buttons: [
          { text: '🔥 Срочный', action: 'task_priority', data: { priority: 'urgent' } },
          { text: '❗ Высокий', action: 'task_priority', data: { priority: 'high' } },
          { text: '📋 Обычный', action: 'task_priority', data: { priority: 'normal' } },
          { text: '📉 Низкий', action: 'task_priority', data: { priority: 'low' } },
          { text: '❌ Отмена', action: 'home' }
        ],
        state: 'task_create_priority',
        usedAI: false
      };

    case 'task_create_priority':
      // Пользователь ввёл приоритет текстом
      const priorityText = text.toLowerCase().trim();
      let priority: 'urgent' | 'high' | 'normal' | 'low' = 'normal';
      if (priorityText.includes('срочн') || priorityText.includes('urgent')) {
        priority = 'urgent';
      } else if (priorityText.includes('высок') || priorityText.includes('high')) {
        priority = 'high';
      } else if (priorityText.includes('низк') || priorityText.includes('low')) {
        priority = 'low';
      }
      // Создаём задачу
      return await handleAction(userId, 'task_priority', JSON.stringify({ priority }));

    case 'task_complete_select':
      // Пользователь ввёл номер задачи для завершения
      const taskNum = parseInt(text);
      if (!isNaN(taskNum) && session.tasksCache && session.tasksCache[taskNum - 1]) {
        const taskToComplete = session.tasksCache[taskNum - 1];
        return await handleAction(userId, 'task_complete_one', JSON.stringify({ id: taskToComplete.id }));
      }
      // Попробуем найти по тексту
      if (session.tasksCache) {
        const found = session.tasksCache.find(t => t.title.toLowerCase().includes(text.toLowerCase()));
        if (found) {
          return await handleAction(userId, 'task_complete_one', JSON.stringify({ id: found.id }));
        }
      }
      return {
        message: '❌ Задача не найдена. Выбери номер из списка:',
        buttons: session.tasksCache?.slice(0, 5).map((t, i) => ({
          text: `${i + 1}`,
          action: 'task_complete_one',
          data: { id: t.id }
        })) || [{ text: '🏠 В начало', action: 'home' }],
        state: 'task_complete_select',
        usedAI: false
      };

    default:
      return {
        message: 'Что-то пошло не так. Начнём сначала?',
        buttons: [
          { text: '📦 Новая сделка', action: 'start_deal' },
          { text: '🔍 Найти сделку', action: 'search_deals' },
          { text: '❌ Отмена', action: 'cancel' }
        ],
        state: 'idle',
        usedAI: false
      };
  }
}

// Обработка выбора режима
function handleModeSelect(session: UserSession, text: string): AssistantResponse {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('текст') || lowerText.includes('свобод')) {
    session.mode = 'text';
    session.state = 'deal_client';
    return {
      message: '💬 Хорошо! Расскажи про сделку своими словами.\n\n' +
        'Например: "Иванов хочет 3 кресла офисных"',
      buttons: [
        { text: '❌ Отмена', action: 'cancel' }
      ],
      state: 'deal_client',
      usedAI: false
    };
  }

  if (lowerText.includes('шаг')) {
    session.mode = 'steps';
    session.state = 'deal_client';
    return {
      message: '📝 Пошли по шагам!\n\n👤 Кто клиент?\nВведи имя или телефон:',
      buttons: [
        { text: '🔍 Найти', action: 'client_search' },
        { text: '❌ Отмена', action: 'cancel' }
      ],
      state: 'deal_client',
      usedAI: false
    };
  }

  if (lowerText.includes('форм')) {
    session.mode = 'form';
    session.state = 'idle';
    session.dealData = {};
    return {
      message: '📋 Открываю форму создания сделки...',
      buttons: [],
      state: 'idle',
      usedAI: false,
      redirect: '/sales?create=true'
    };
  }

  return {
    message: 'Выбери режим:',
    buttons: [
      { text: '💬 Текстом', action: 'mode_text' },
      { text: '📝 По шагам', action: 'mode_steps' },
      { text: '📋 Форма', action: 'mode_form' }
    ],
    state: 'mode_select',
    usedAI: false
  };
}

// Обработка ввода клиента
async function handleClientInput(session: UserSession, text: string): Promise<AssistantResponse> {
  // Ищем клиента в базе
  const clients = await searchClients(text);

  if (clients.length > 0) {
    session.searchResults.clients = clients;
    session.state = 'deal_client_confirm';

    const buttons = clients.slice(0, 3).map((c, i) => ({
      text: `${c.client_name}${c.client_phone ? ' ' + c.client_phone : ''}`,
      action: 'client_select',
      data: { index: i }
    }));
    buttons.push({ text: '➕ Новый клиент', action: 'client_new', data: { name: text } });

    return {
      message: `🔍 Нашёл ${clients.length} клиентов:`,
      buttons,
      state: 'deal_client_confirm',
      usedAI: false
    };
  }

  // Клиент не найден - создаём нового
  session.dealData.clientName = text;
  session.state = 'deal_product';
  return {
    message: `✅ Клиент: ${text}\n\n📦 Что продаём? (или пропусти)`,
    buttons: [
      { text: '🔍 Найти товар', action: 'product_search' },
      { text: '➡️ Без товара', action: 'skip_product' },
      { text: '❌ Отмена', action: 'cancel' }
    ],
    state: 'deal_product',
    usedAI: false
  };
}

// Обработка ввода товара
async function handleProductInput(session: UserSession, text: string): Promise<AssistantResponse> {
  const products = await searchProducts(text);

  if (products.length > 0) {
    session.searchResults.products = products;
    session.state = 'deal_product_confirm';

    const buttons = products.slice(0, 3).map((p, i) => ({
      text: `${p.name} (${p.quantity} шт)`,
      action: 'product_select',
      data: { index: i }
    }));
    buttons.push({ text: '✏️ Другой товар', action: 'product_custom', data: { name: text } });

    return {
      message: '🔍 Нашёл товары:',
      buttons,
      state: 'deal_product_confirm',
      usedAI: false
    };
  }

  session.dealData.productName = text;
  session.state = 'deal_quantity';
  return {
    message: `✅ Товар: ${text}\n\n🔢 Сколько штук?`,
    buttons: [
      { text: '1', action: 'qty', data: { value: 1 } },
      { text: '2', action: 'qty', data: { value: 2 } },
      { text: '5', action: 'qty', data: { value: 5 } },
      { text: '10', action: 'qty', data: { value: 10 } },
      { text: '➡️ Пропустить', action: 'skip_quantity' }
    ],
    state: 'deal_quantity',
    usedAI: false
  };
}

// Обработка ввода количества
async function handleQuantityInput(session: UserSession, text: string): Promise<AssistantResponse> {
  const qty = parseInt(text);
  if (isNaN(qty) || qty <= 0) {
    return {
      message: '❌ Введи число (больше 0)',
      buttons: [
        { text: '1', action: 'qty', data: { value: 1 } },
        { text: '5', action: 'qty', data: { value: 5 } },
        { text: '10', action: 'qty', data: { value: 10 } }
      ],
      state: 'deal_quantity',
      usedAI: false
    };
  }

  session.dealData.quantity = qty;
  session.state = 'deal_stage';
  return await buildStageSelectMessage(session);
}

// Построение выбора этапа
async function buildStageSelectMessage(session: UserSession): Promise<AssistantResponse> {
  const stages = await getStages();

  // Если нет этапов, сразу к подтверждению
  if (stages.length === 0) {
    session.dealData.stage = 'new';
    session.dealData.stageName = 'Новая';
    session.state = 'deal_confirm';
    return buildConfirmMessage(session);
  }

  const buttons = stages.slice(0, 5).map((s, i) => ({
    text: s.name,
    action: 'stage_select',
    data: { key: s.key, name: s.name }
  }));

  // Формируем сообщение в зависимости от заполненных данных
  let statusLine = '';
  if (session.dealData.productName && session.dealData.quantity) {
    statusLine = `✅ ${session.dealData.productName}: ${session.dealData.quantity} шт\n\n`;
  } else if (session.dealData.productName) {
    statusLine = `✅ Товар: ${session.dealData.productName}\n\n`;
  } else if (session.dealData.quantity) {
    statusLine = `✅ Количество: ${session.dealData.quantity} шт\n\n`;
  }

  return {
    message: `${statusLine}📊 На каком этапе создать сделку?`,
    buttons: [
      ...buttons,
      { text: '⏩ Пропустить (первый)', action: 'stage_skip' }
    ],
    state: 'deal_stage',
    usedAI: false
  };
}

// Построение сообщения подтверждения
function buildConfirmMessage(session: UserSession): AssistantResponse {
  const { clientName, productName, quantity, stageName } = session.dealData;
  return {
    message: `📋 Проверь данные:\n\n` +
      `👤 Клиент: ${clientName || '—'}\n` +
      `📦 Товар: ${productName || '—'}\n` +
      `🔢 Количество: ${quantity || '—'}\n` +
      `📊 Этап: ${stageName || 'Новая'}\n\n` +
      `Всё верно?`,
    buttons: [
      { text: '✅ Создать', action: 'create_deal' },
      { text: '✏️ Изменить', action: 'edit_deal' },
      { text: '❌ Отмена', action: 'cancel' }
    ],
    state: 'deal_confirm',
    usedAI: false
  };
}

// Финализация сделки
async function finalizeDeal(session: UserSession): Promise<AssistantResponse> {
  try {
    // Сохраняем данные до очистки
    const dealInfo = {
      productName: session.dealData.productName,
      quantity: session.dealData.quantity,
      stageName: session.dealData.stageName || 'Новая'
    };

    const deal = await createDeal({
      clientName: session.dealData.clientName || 'Без имени',
      clientPhone: session.dealData.clientPhone,
      productName: session.dealData.productName,
      quantity: session.dealData.quantity,
      stage: session.dealData.stage,
      note: session.dealData.note,
      userId: session.userId
    });

    // Очищаем сессию
    session.state = 'idle';
    session.dealData = {};
    session.searchResults = {};

    // Запоминаем созданную сделку в контекстной памяти
    contextMemory.rememberDeal(session.userId, {
      id: deal.id,
      orderNumber: deal.order_number,
      clientName: deal.client_name || '',
      stage: deal.stage,
    });
    contextMemory.recordAction(session.userId, 'create_deal', deal.id);

    // Формируем детальное сообщение
    let details = `👤 ${deal.client_name}`;
    if (dealInfo.productName) {
      details += `\n📦 ${dealInfo.productName}`;
      if (dealInfo.quantity) details += ` × ${dealInfo.quantity}`;
    }
    details += `\n📊 Этап: ${dealInfo.stageName}`;

    return {
      message: `✅ Сделка #${deal.order_number} создана!\n\n${details}\n\nЧто дальше?`,
      buttons: [
        { text: '📦 Ещё сделка', action: 'start_deal' },
        { text: '📋 К сделке', action: 'open_deal', data: { id: deal.id } },
        { text: '🏠 В начало', action: 'home' }
      ],
      state: 'idle',
      usedAI: false
    };
  } catch (error) {
    console.error('[Assistant] Create deal error:', error);
    return {
      message: '❌ Ошибка при создании сделки. Попробуй ещё раз.',
      buttons: [
        { text: '🔄 Повторить', action: 'create_deal' },
        { text: '❌ Отмена', action: 'cancel' }
      ],
      state: 'deal_confirm',
      usedAI: false
    };
  }
}

// Обработка actions (callback от кнопок)
async function handleAction(userId: string, action: string, text: string): Promise<AssistantResponse> {
  const session = getSession(userId);

  switch (action) {
    case 'start_deal':
      session.state = 'mode_select';
      session.dealData = {};
      return {
        message: '📦 Создаём сделку!\n\nКак удобнее?',
        buttons: [
          { text: '💬 Текстом', action: 'mode_text' },
          { text: '📝 По шагам', action: 'mode_steps' },
          { text: '📋 Форма', action: 'mode_form' }
        ],
        state: 'mode_select',
        usedAI: false
      };

    case 'mode_text':
      session.mode = 'text';
      session.state = 'deal_client';
      return {
        message: '💬 Расскажи про сделку своими словами.\n\n' +
          'Например: "Иванов хочет 3 кресла"',
        buttons: [{ text: '❌ Отмена', action: 'cancel' }],
        state: 'deal_client',
        usedAI: false
      };

    case 'mode_steps':
      session.mode = 'steps';
      session.state = 'deal_client';
      return {
        message: '📝 Шаг 1: Клиент\n\n👤 Введи имя или телефон:',
        buttons: [
          { text: '🔍 Найти', action: 'client_search' },
          { text: '❌ Отмена', action: 'cancel' }
        ],
        state: 'deal_client',
        usedAI: false
      };

    case 'mode_form':
      session.mode = 'form';
      session.state = 'idle';
      session.dealData = {};
      return {
        message: '📋 Открываю форму создания сделки...',
        buttons: [],
        state: 'idle',
        usedAI: false,
        redirect: '/sales?create=true'
      };

    case 'cancel':
      session.state = 'idle';
      session.dealData = {};
      session.searchResults = {};
      return {
        message: '❌ Отменено',
        buttons: [
          { text: '📦 Новая сделка', action: 'start_deal' },
          { text: '🔍 Найти клиента', action: 'search_client' }
        ],
        state: 'idle',
        usedAI: false
      };

    case 'back':
      // Возврат на предыдущий шаг
      if (session.state === 'deal_confirm') {
        session.state = 'deal_stage';
        return await buildStageSelectMessage(session);
      }
      if (session.state === 'deal_stage') {
        session.state = 'deal_quantity';
        return {
          message: `🔢 Сколько штук?`,
          buttons: [
            { text: '1', action: 'qty', data: { value: 1 } },
            { text: '2', action: 'qty', data: { value: 2 } },
            { text: '5', action: 'qty', data: { value: 5 } }
          ],
          state: 'deal_quantity',
          usedAI: false
        };
      }
      if (session.state === 'deal_quantity' || session.state === 'deal_product_confirm') {
        session.state = 'deal_product';
        return {
          message: `📦 Что продаём?`,
          buttons: [
            { text: '🔍 Найти товар', action: 'product_search' },
            { text: '❌ Отмена', action: 'cancel' }
          ],
          state: 'deal_product',
          usedAI: false
        };
      }
      if (session.state === 'deal_product' || session.state === 'deal_client_confirm') {
        session.state = 'deal_client';
        return {
          message: `👤 Кто клиент?`,
          buttons: [
            { text: '🔍 Найти', action: 'client_search' },
            { text: '❌ Отмена', action: 'cancel' }
          ],
          state: 'deal_client',
          usedAI: false
        };
      }
      if (session.state === 'deal_client' || session.state === 'mode_select') {
        session.state = 'idle';
        session.dealData = {};
        return {
          message: 'Чем могу помочь?',
          buttons: [
            { text: '📦 Новая сделка', action: 'start_deal' },
            { text: '🔍 Найти клиента', action: 'search_client' }
          ],
          state: 'idle',
          usedAI: false
        };
      }
      // По умолчанию - в начало
      session.state = 'idle';
      session.dealData = {};
      return {
        message: 'Чем могу помочь?',
        buttons: [
          { text: '📦 Новая сделка', action: 'start_deal' },
          { text: '🔍 Найти клиента', action: 'search_client' }
        ],
        state: 'idle',
        usedAI: false
      };

    case 'help':
      return {
        message: '💬 Я помогу работать с ERP!\n\n' +
          'Могу:\n' +
          '• Создать сделку\n' +
          '• Найти клиента\n' +
          '• Показать товары\n\n' +
          'Просто напиши что нужно или используй кнопки.',
        buttons: [
          { text: '📦 Новая сделка', action: 'start_deal' },
          { text: '🏠 В начало', action: 'home' }
        ],
        state: session.state,
        usedAI: false
      };

    case 'client_select':
      const clientIndex = parseInt(text) || 0;
      const selectedClient = session.searchResults.clients?.[clientIndex];
      if (selectedClient) {
        session.dealData.clientName = selectedClient.client_name;
        session.dealData.clientPhone = selectedClient.client_phone;
      }
      session.state = 'deal_product';
      return {
        message: `✅ Клиент: ${session.dealData.clientName}\n\n📦 Что продаём? (или пропусти)`,
        buttons: [
          { text: '🔍 Найти товар', action: 'product_search' },
          { text: '➡️ Без товара', action: 'skip_product' },
          { text: '❌ Отмена', action: 'cancel' }
        ],
        state: 'deal_product',
        usedAI: false
      };

    case 'product_select':
      const productIndex = parseInt(text) || 0;
      const selectedProduct = session.searchResults.products?.[productIndex];
      if (selectedProduct) {
        session.dealData.productName = selectedProduct.name;
        session.dealData.productId = selectedProduct.id;
      }
      session.state = 'deal_quantity';
      return {
        message: `✅ Товар: ${session.dealData.productName}\n\n🔢 Сколько штук?`,
        buttons: [
          { text: '1', action: 'qty', data: { value: 1 } },
          { text: '2', action: 'qty', data: { value: 2 } },
          { text: '5', action: 'qty', data: { value: 5 } },
          { text: '10', action: 'qty', data: { value: 10 } },
          { text: '➡️ Пропустить', action: 'skip_quantity' }
        ],
        state: 'deal_quantity',
        usedAI: false
      };

    case 'qty':
      const qtyValue = parseInt(text) || 1;
      session.dealData.quantity = qtyValue;
      session.state = 'deal_stage';
      return await buildStageSelectMessage(session);

    case 'stage_select':
      // text может быть JSON или просто key
      try {
        const stageData = JSON.parse(text);
        session.dealData.stage = stageData.key;
        session.dealData.stageName = stageData.name;
      } catch {
        session.dealData.stage = text;
        session.dealData.stageName = text;
      }
      session.state = 'deal_confirm';
      return buildConfirmMessage(session);

    case 'stage_skip':
      // Используем первый этап из списка
      const allStages = await getStages();
      if (allStages.length > 0) {
        session.dealData.stage = allStages[0].key;
        session.dealData.stageName = allStages[0].name;
      } else {
        session.dealData.stage = 'new';
        session.dealData.stageName = 'Новая';
      }
      session.state = 'deal_confirm';
      return buildConfirmMessage(session);

    case 'skip_product':
      // Пропускаем товар - сразу к выбору этапа
      session.state = 'deal_stage';
      return await buildStageSelectMessage(session);

    case 'skip_quantity':
      // Пропускаем количество - к выбору этапа
      session.state = 'deal_stage';
      return await buildStageSelectMessage(session);

    case 'create_deal':
      return await finalizeDeal(session);

    // ========== ПОИСК И РАБОТА СО СДЕЛКАМИ ==========

    case 'search_deals':
      session.state = 'deal_search';
      session.searchResults.deals = [];
      session.searchPage = 0;
      return {
        message: '🔍 Поиск сделок\n\nВведи имя клиента, номер или телефон:',
        buttons: [
          { text: '📋 Мои сделки', action: 'my_deals' },
          { text: '📋 Все сделки', action: 'all_deals' },
          { text: '❌ Отмена', action: 'cancel' }
        ],
        state: 'deal_search',
        usedAI: false
      };

    case 'my_deals':
      // Поиск сделок текущего пользователя
      const myDealsResult = await searchDeals('', 0, userId);
      session.searchResults.deals = myDealsResult.deals;
      session.searchTotal = myDealsResult.total;
      session.searchPage = 0;
      session.state = 'deal_search_result';
      return buildDealSearchResults(session);

    case 'all_deals':
      // Показать все сделки (последние)
      const allDealsResult = await searchDeals('', 0);
      session.searchResults.deals = allDealsResult.deals;
      session.searchTotal = allDealsResult.total;
      session.searchPage = 0;
      session.state = 'deal_search_result';
      return buildDealSearchResults(session);

    case 'select_deal':
      // Выбор сделки из списка результатов
      try {
        const selectData = JSON.parse(text);
        const selectedDeal = await getDealById(selectData.id);
        if (selectedDeal) {
          session.currentDeal = selectedDeal;
          session.context.lastMentionedDeal = selectedDeal.id;
          session.context.lastMentionedClient = selectedDeal.client_name;
          session.state = 'deal_view';
          // Запоминаем в контекстной памяти
          contextMemory.rememberDeal(userId, {
            id: selectedDeal.id,
            orderNumber: selectedDeal.order_number,
            clientName: selectedDeal.client_name || '',
            amount: selectedDeal.amount || undefined,
            stage: selectedDeal.stage,
          });
          contextMemory.recordAction(userId, 'select_deal', selectedDeal.id);
          return buildDealViewMessage(selectedDeal);
        }
      } catch {
        // Попробуем как ID напрямую
        const directDeal = await getDealById(text);
        if (directDeal) {
          session.currentDeal = directDeal;
          session.context.lastMentionedDeal = directDeal.id;
          session.state = 'deal_view';
          // Запоминаем в контекстной памяти
          contextMemory.rememberDeal(userId, {
            id: directDeal.id,
            orderNumber: directDeal.order_number,
            clientName: directDeal.client_name || '',
            amount: directDeal.amount || undefined,
            stage: directDeal.stage,
          });
          contextMemory.recordAction(userId, 'select_deal', directDeal.id);
          return buildDealViewMessage(directDeal);
        }
      }
      return {
        message: '❌ Сделка не найдена',
        buttons: [
          { text: '🔍 Искать', action: 'search_deals' },
          { text: '🏠 В начало', action: 'home' }
        ],
        state: 'idle',
        usedAI: false
      };

    case 'deals_next_page':
      session.searchPage++;
      // Загрузить следующую страницу
      const nextPageResult = await searchDeals(session.context.lastMentionedClient || '', session.searchPage);
      session.searchResults.deals = nextPageResult.deals;
      return buildDealSearchResults(session);

    case 'deals_prev_page':
      session.searchPage = Math.max(0, session.searchPage - 1);
      const prevPageResult = await searchDeals(session.context.lastMentionedClient || '', session.searchPage);
      session.searchResults.deals = prevPageResult.deals;
      return buildDealSearchResults(session);

    case 'edit_deal_menu':
      if (session.currentDeal) {
        session.state = 'deal_edit_select';
        return buildDealEditMenu(session.currentDeal);
      }
      return {
        message: '❌ Сделка не выбрана',
        buttons: [
          { text: '🔍 Найти сделку', action: 'search_deals' },
          { text: '🏠 В начало', action: 'home' }
        ],
        state: 'idle',
        usedAI: false
      };

    case 'select_edit_field':
      // Выбор поля для редактирования
      try {
        const fieldData = JSON.parse(text);
        session.editField = fieldData.field;
        session.state = 'deal_edit_field';

        const fieldInfo = EDITABLE_FIELDS.find(f => f.key === fieldData.field);
        const currentValue = session.currentDeal ? (session.currentDeal as any)[fieldData.field] : '—';

        // Для этапа - показываем выбор из списка
        if (fieldData.field === 'stage') {
          const stages = await getStages();
          return {
            message: `📊 Текущий этап: ${session.currentDeal?.stageName || currentValue}\n\nВыбери новый этап:`,
            buttons: stages.map(s => ({
              text: s.name,
              action: 'save_edit',
              data: { value: s.key, display: s.name }
            })),
            state: 'deal_edit_field',
            usedAI: false
          };
        }

        return {
          message: `✏️ ${fieldInfo?.label || fieldData.field}\n\nТекущее значение: ${currentValue || '—'}\n\nВведи новое значение:`,
          buttons: [
            { text: '❌ Отмена', action: 'cancel_edit' }
          ],
          state: 'deal_edit_field',
          usedAI: false
        };
      } catch {
        return {
          message: '❌ Ошибка выбора поля',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      }

    case 'save_edit':
      // Сохранение изменения
      if (!session.currentDeal || !session.editField) {
        return {
          message: '❌ Нет данных для сохранения',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      }

      try {
        let valueToSave: any = text;
        let displayValue = text;

        // Парсим JSON если передан
        try {
          const parsed = JSON.parse(text);
          valueToSave = parsed.value || parsed;
          displayValue = parsed.display || valueToSave;
        } catch {}

        // Преобразуем тип для числовых полей
        if (['amount', 'production_days_count'].includes(session.editField)) {
          valueToSave = parseInt(valueToSave) || 0;
          displayValue = valueToSave.toLocaleString('ru-RU');
        }

        // Обновляем в БД
        await updateDeal(session.currentDeal.id, {
          [session.editField]: valueToSave
        });

        const fieldInfo = EDITABLE_FIELDS.find(f => f.key === session.editField);
        const oldValue = (session.currentDeal as any)[session.editField] || '—';

        // Обновляем локальную копию
        (session.currentDeal as any)[session.editField] = valueToSave;
        if (session.editField === 'stage') {
          session.currentDeal.stageName = displayValue;
        }

        session.editField = undefined;
        session.state = 'deal_view';

        // Записываем действие редактирования в контекстную память
        contextMemory.recordAction(userId, 'edit_deal', session.currentDeal.id);

        return {
          message: `✅ ${fieldInfo?.label || 'Поле'} изменено!\n\n${oldValue} → ${displayValue}`,
          buttons: [
            { text: '📋 К сделке', action: 'view_current_deal' },
            { text: '✏️ Ещё изменить', action: 'edit_deal_menu' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'deal_view',
          usedAI: false
        };
      } catch (error) {
        console.error('[Assistant] Save edit error:', error);
        return {
          message: '❌ Ошибка сохранения',
          buttons: [
            { text: '🔄 Повторить', action: 'edit_deal_menu' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'deal_view',
          usedAI: false
        };
      }

    case 'cancel_edit':
      session.editField = undefined;
      if (session.currentDeal) {
        session.state = 'deal_view';
        return buildDealViewMessage(session.currentDeal);
      }
      return {
        message: '❌ Отменено',
        buttons: [
          { text: '🔍 Найти сделку', action: 'search_deals' },
          { text: '🏠 В начало', action: 'home' }
        ],
        state: 'idle',
        usedAI: false
      };

    case 'view_current_deal':
      if (session.currentDeal) {
        // Перезагрузим данные сделки
        const refreshedDeal = await getDealById(session.currentDeal.id);
        if (refreshedDeal) {
          session.currentDeal = refreshedDeal;
          return buildDealViewMessage(refreshedDeal);
        }
      }
      return {
        message: '❌ Сделка не найдена',
        buttons: [
          { text: '🔍 Найти сделку', action: 'search_deals' },
          { text: '🏠 В начало', action: 'home' }
        ],
        state: 'idle',
        usedAI: false
      };

    case 'edit_stage':
      // Быстрая смена этапа
      if (!session.currentDeal) {
        return {
          message: '❌ Сделка не выбрана',
          buttons: [{ text: '🔍 Найти', action: 'search_deals' }],
          state: 'idle',
          usedAI: false
        };
      }
      session.editField = 'stage';
      session.state = 'deal_edit_field';
      const stagesList = await getStages();
      return {
        message: `📊 Сделка #${session.currentDeal.order_number}\nТекущий этап: ${session.currentDeal.stageName || session.currentDeal.stage}\n\nВыбери новый этап:`,
        buttons: stagesList.map(s => ({
          text: s.name,
          action: 'save_edit',
          data: { value: s.key, display: s.name }
        })),
        state: 'deal_edit_field',
        usedAI: false
      };

    // ========== ОТЧЁТЫ ==========

    case 'report_by_stage':
      // Отчёт по конкретному этапу
      try {
        const reportData = JSON.parse(text);
        return await buildDealReport(userId, reportData.stage);
      } catch {
        return await buildDealReport(userId, text);
      }

    // ========== МАССОВЫЕ ОПЕРАЦИИ ==========

    case 'bulk_change_stage_preview':
      // Предпросмотр массовой смены этапа
      try {
        const bulkData = JSON.parse(text);
        return await buildBulkOperationConfirm(session, bulkData);
      } catch {
        return await buildBulkOperationConfirm(session, { stage: text });
      }

    case 'bulk_change_stage_confirm':
      // Выполнение массовой смены этапа
      try {
        const confirmData = JSON.parse(text);
        const targetStage = confirmData.stage;

        // Получаем все сделки и меняем их этап
        const adapter = getAdapter();
        const allDealsRes = await adapter.searchDeals('', 0);
        let changedCount = 0;

        for (const deal of allDealsRes.items) {
          if (deal.stage !== targetStage) {
            await adapter.updateDeal(deal.id, { stage: targetStage });
            changedCount++;
          }
        }

        // Получаем название этапа
        const stagesForName = await getStages();
        const targetStageName = stagesForName.find(s => s.key === targetStage)?.name || targetStage;

        contextMemory.recordAction(userId, 'bulk_change_stage', `${changedCount} deals`);

        return {
          message: `✅ Массовое изменение выполнено!\n\n📊 Этап: ${targetStageName}\n📦 Изменено сделок: ${changedCount}`,
          buttons: [
            { text: '📊 Отчёт', action: 'report_deals', data: {} },
            { text: '📋 Все сделки', action: 'all_deals', data: {} },
            { text: '🏠 В начало', action: 'home', data: {} }
          ],
          state: 'idle',
          usedAI: false
        };
      } catch (error) {
        console.error('[Assistant] Bulk change error:', error);
        return {
          message: '❌ Ошибка при массовом изменении',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      }

    case 'report_deals':
      // Показать общий отчёт
      return await buildDealReport(userId);

    // ========== КОНЕЦ ПОИСКА И РАБОТЫ СО СДЕЛКАМИ ==========

    case 'home':
      session.state = 'idle';
      session.currentDeal = undefined;
      session.editField = undefined;
      return {
        message: 'Чем могу помочь?',
        buttons: [
          { text: '📦 Новая сделка', action: 'start_deal' },
          { text: '🔍 Найти сделку', action: 'search_deals' }
        ],
        state: 'idle',
        usedAI: false
      };

    case 'open_deal':
      // text содержит ID сделки
      const dealId = text;
      session.state = 'idle';
      return {
        message: '📋 Открываю сделку...',
        buttons: [],
        state: 'idle',
        usedAI: false,
        redirect: `/sales?dealId=${dealId}`
      };

    // ========== TASK MANAGER ACTIONS ==========

    case 'task_briefing':
      // Утренний брифинг
      return await buildTaskBriefing(userId, contextMemory.getCommunicationStyle(userId));

    case 'task_list_all':
      // Все задачи
      return await buildTaskList(userId);

    case 'task_list_urgent':
      // Срочные задачи
      return await buildTaskList(userId, { priority: 'urgent' });

    case 'task_create_start':
      // Начать создание задачи
      session.state = 'task_create_title';
      session.taskData = {};
      return {
        message: '📝 Создаём задачу\n\nНапиши название задачи:',
        buttons: [{ text: '❌ Отмена', action: 'home' }],
        state: 'task_create_title',
        usedAI: false
      };

    case 'task_deadline':
      // Выбор дедлайна
      try {
        const taskData = JSON.parse(text);
        if (taskData.days !== null && taskData.days !== undefined) {
          const deadline = new Date();
          deadline.setDate(deadline.getDate() + taskData.days);
          session.taskData.deadline = deadline;
        }
        session.state = 'task_create_priority';
        return {
          message: `📝 Задача: "${session.taskData.title}"\n${session.taskData.deadline ? `📅 Дедлайн: ${formatDate(session.taskData.deadline)}` : '📅 Без дедлайна'}\n\n⚡ Приоритет?`,
          buttons: [
            { text: '🔥 Срочный', action: 'task_priority', data: { priority: 'urgent' } },
            { text: '❗ Высокий', action: 'task_priority', data: { priority: 'high' } },
            { text: '📋 Обычный', action: 'task_priority', data: { priority: 'normal' } },
            { text: '📉 Низкий', action: 'task_priority', data: { priority: 'low' } },
            { text: '❌ Отмена', action: 'home' }
          ],
          state: 'task_create_priority',
          usedAI: false
        };
      } catch {
        return {
          message: '❌ Ошибка',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      }

    case 'task_priority':
      // Выбор приоритета и создание задачи
      try {
        const priorityData = JSON.parse(text);
        session.taskData.priority = priorityData.priority || 'normal';

        // Создаём задачу
        const adapter = getAdapter();
        const newTask = await adapter.createTask?.({
          title: session.taskData.title || 'Новая задача',
          priority: session.taskData.priority,
          deadline: session.taskData.deadline,
          dealId: session.taskData.dealId
        }, userId);

        if (newTask) {
          session.state = 'task_view';
          session.currentTask = newTask;
          session.taskData = {};
          return {
            message: `✅ Задача создана!\n\n📋 **${newTask.title}**\n⚡ ${newTask.priority === 'urgent' ? '🔥 Срочный' : newTask.priority === 'high' ? '❗ Высокий' : newTask.priority === 'low' ? '📉 Низкий' : '📋 Обычный'}${newTask.deadline ? `\n📅 До ${formatDate(newTask.deadline)}` : ''}`,
            buttons: [
              { text: '📋 Все задачи', action: 'task_list_all' },
              { text: '➕ Ещё задачу', action: 'task_create_start' },
              { text: '🏠 В начало', action: 'home' }
            ],
            state: 'task_view',
            usedAI: false
          };
        }

        return {
          message: '❌ Не удалось создать задачу',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      } catch (error) {
        console.error('[Assistant] Task create error:', error);
        return {
          message: '❌ Ошибка при создании задачи',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      }

    case 'task_complete_start':
      // Показать выбор задачи для завершения
      return await buildTaskCompleteSelect(userId, session);

    case 'task_complete_one':
      // Завершить конкретную задачу
      try {
        const completeData = JSON.parse(text);
        const taskIdToComplete = completeData.id;

        const adapter = getAdapter();
        const completedTask = await adapter.completeTask?.(taskIdToComplete);

        if (completedTask) {
          return {
            message: `✅ Задача выполнена!\n\n"${completedTask.title}"`,
            buttons: [
              { text: '📋 Все задачи', action: 'task_list_all' },
              { text: '✅ Ещё одну', action: 'task_complete_start' },
              { text: '📊 Брифинг', action: 'task_briefing' },
              { text: '🏠 В начало', action: 'home' }
            ],
            state: 'idle',
            usedAI: false
          };
        }

        return {
          message: '❌ Не удалось завершить задачу',
          buttons: [
            { text: '📋 Все задачи', action: 'task_list_all' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'idle',
          usedAI: false
        };
      } catch (error) {
        console.error('[Assistant] Task complete error:', error);
        return {
          message: '❌ Ошибка',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      }

    case 'task_select':
      // Выбор задачи из списка
      try {
        const selectData = JSON.parse(text);
        const taskId = selectData.id;

        const adapter = getAdapter();
        const selectedTask = await adapter.getTaskById?.(taskId);

        if (selectedTask) {
          session.currentTask = selectedTask;
          return buildTaskViewMessage(selectedTask);
        }

        return {
          message: '❌ Задача не найдена',
          buttons: [
            { text: '📋 Все задачи', action: 'task_list_all' },
            { text: '🏠 В начало', action: 'home' }
          ],
          state: 'idle',
          usedAI: false
        };
      } catch (error) {
        console.error('[Assistant] Task select error:', error);
        return {
          message: '❌ Ошибка',
          buttons: [{ text: '🏠 В начало', action: 'home' }],
          state: 'idle',
          usedAI: false
        };
      }

    case 'my_tasks':
      // Мои задачи (альтернативный action)
      return await buildTaskList(userId);

    default:
      return {
        message: 'Выбери действие:',
        buttons: [
          { text: '📦 Новая сделка', action: 'start_deal' },
          { text: '❌ Отмена', action: 'cancel' }
        ],
        state: session.state,
        usedAI: false
      };
  }
}

export const assistantService = {
  processMessage
};
