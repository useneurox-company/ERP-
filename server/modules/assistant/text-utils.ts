/**
 * ChatCRM - Text Understanding Utilities
 * Умный парсинг текста: синонимы, опечатки, fuzzy matching
 */

// ============ СЛОВАРЬ СИНОНИМОВ ============

// Синонимы для основных понятий (RU + EN)
export const SYNONYMS: Record<string, string[]> = {
  // Сделка / Deal
  'сделка': ['заказ', 'ордер', 'продажа', 'лид', 'deal', 'order', 'sale'],
  // Клиент / Client
  'клиент': ['покупатель', 'заказчик', 'контрагент', 'customer', 'client', 'buyer'],
  // Этап / Stage
  'этап': ['стадия', 'статус', 'фаза', 'stage', 'status', 'phase'],
  // Сумма / Amount
  'сумма': ['цена', 'стоимость', 'total', 'amount', 'price', 'cost'],
  // Менеджер / Manager
  'менеджер': ['ответственный', 'исполнитель', 'manager', 'assigned', 'owner'],
  // Дата / Deadline
  'дедлайн': ['срок', 'deadline', 'дата', 'до', 'due', 'date'],
  // Действия / Actions
  'создать': ['новая', 'новый', 'добавить', 'create', 'add', 'make', 'start'],
  'найти': ['поиск', 'искать', 'покажи', 'где', 'search', 'find', 'показать', 'show', 'get', 'list'],
  'изменить': ['редактировать', 'поменять', 'обновить', 'edit', 'update', 'change', 'modify', 'set'],
  'удалить': ['убрать', 'delete', 'remove'],
  // Этапы сделок / Deal stages
  'новая': ['новый', 'new', 'входящая', 'входящий', 'incoming'],
  'в работе': ['работа', 'working', 'processing', 'обрабатывается', 'in progress', 'active'],
  'оплачено': ['оплата', 'paid', 'оплачен', 'payment'],
  'завершено': ['закрыто', 'done', 'completed', 'closed', 'завершён', 'finished'],
  'отменено': ['отказ', 'cancelled', 'canceled', 'отмена', 'rejected'],
  // Приветствия / Greetings
  'привет': ['hello', 'hi', 'hey', 'здравствуй', 'здравствуйте', 'добрый день', 'good morning', 'good day'],
  // Подтверждения / Confirmations
  'да': ['yes', 'yep', 'yeah', 'sure', 'ok', 'okay', 'верно', 'точно', 'согласен'],
  'нет': ['no', 'nope', 'отмена', 'cancel', 'back'],
  // Задачи / Tasks
  'задача': ['задание', 'таск', 'task', 'todo', 'to-do', 'напоминание', 'reminder'],
  'выполнено': ['сделано', 'готово', 'done', 'complete', 'finished', 'выполнил', 'сделал'],
  'срочно': ['urgent', 'важно', 'горит', 'asap', 'немедленно'],
};

// Частые опечатки
export const TYPOS: Record<string, string> = {
  // Сделка
  'сдлека': 'сделка',
  'сделак': 'сделка',
  'здлека': 'сделка',
  'сделкa': 'сделка', // латинская a
  'сдеока': 'сделка',
  // Клиент
  'клинет': 'клиент',
  'клеинт': 'клиент',
  'клиен': 'клиент',
  // Заказ
  'зкааз': 'заказ',
  'заакз': 'заказ',
  'закза': 'заказ',
  // Найти
  'найит': 'найти',
  'наийти': 'найти',
  'нати': 'найти',
  // Создать
  'создатб': 'создать',
  'созадть': 'создать',
  // Изменить
  'изменитб': 'изменить',
  'именить': 'изменить',
  'изменитть': 'изменить',
  // Показать
  'покзаать': 'показать',
  'покзать': 'показать',
  'показатб': 'показать',
  // Этап
  'этпа': 'этап',
  'этпа': 'этап',
  // Сумма
  'суума': 'сумма',
  'сумам': 'сумма',
  // Помощь
  'помошь': 'помощь',
  'помощб': 'помощь',
};

// ============ НОРМАЛИЗАЦИЯ ТЕКСТА ============

/**
 * Исправляет частые опечатки
 */
export function fixTypos(text: string): string {
  let result = text.toLowerCase();

  for (const [typo, correct] of Object.entries(TYPOS)) {
    result = result.replace(new RegExp(typo, 'gi'), correct);
  }

  return result;
}

/**
 * Заменяет синонимы на каноничные формы
 */
export function normalizeSynonyms(text: string): string {
  let result = text.toLowerCase();

  for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
    for (const syn of synonyms) {
      // Заменяем только полные слова
      const regex = new RegExp(`\\b${syn}\\b`, 'gi');
      result = result.replace(regex, canonical);
    }
  }

  return result;
}

/**
 * Полная нормализация текста
 */
export function normalizeText(text: string): string {
  let result = text.trim().toLowerCase();

  // 1. Исправляем опечатки
  result = fixTypos(result);

  // 2. Заменяем синонимы
  result = normalizeSynonyms(result);

  // 3. Убираем лишние пробелы
  result = result.replace(/\s+/g, ' ');

  return result;
}

// ============ FUZZY MATCHING ============

/**
 * Расстояние Левенштейна между строками
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // замена
          matrix[i][j - 1] + 1,     // вставка
          matrix[i - 1][j] + 1      // удаление
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Процент схожести строк (0-100)
 */
export function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 100;

  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Fuzzy поиск в списке строк
 */
export function fuzzyFind(query: string, items: string[], threshold: number = 60): Array<{ item: string; score: number }> {
  const results: Array<{ item: string; score: number }> = [];
  const normalizedQuery = query.toLowerCase();

  for (const item of items) {
    const normalizedItem = item.toLowerCase();

    // Точное вхождение
    if (normalizedItem.includes(normalizedQuery)) {
      results.push({ item, score: 100 });
      continue;
    }

    // Fuzzy match
    const score = similarity(normalizedQuery, normalizedItem);
    if (score >= threshold) {
      results.push({ item, score });
    }
  }

  // Сортируем по score
  return results.sort((a, b) => b.score - a.score);
}

/**
 * Fuzzy поиск клиента
 */
export function fuzzyFindClient(query: string, clients: Array<{ name: string; [key: string]: any }>, threshold: number = 50): Array<{ client: any; score: number }> {
  const results: Array<{ client: any; score: number }> = [];
  const normalizedQuery = query.toLowerCase();

  for (const client of clients) {
    const name = (client.name || '').toLowerCase();

    // Точное вхождение
    if (name.includes(normalizedQuery)) {
      results.push({ client, score: 100 });
      continue;
    }

    // Проверяем начало имени
    if (name.startsWith(normalizedQuery.slice(0, 3))) {
      results.push({ client, score: 80 });
      continue;
    }

    // Fuzzy match
    const score = similarity(normalizedQuery, name);
    if (score >= threshold) {
      results.push({ client, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

// ============ ИЗВЛЕЧЕНИЕ ДАННЫХ ============

/**
 * Извлекает число из текста
 */
export function extractNumber(text: string): number | null {
  // Убираем пробелы между цифрами (50 000 -> 50000)
  const cleaned = text.replace(/(\d)\s+(\d)/g, '$1$2');

  // Ищем число
  const match = cleaned.match(/(\d+[.,]?\d*)/);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }

  return null;
}

/**
 * Извлекает номер сделки/заказа из текста
 */
export function extractOrderNumber(text: string): string | null {
  // #275, №275, номер 275, сделка 275
  const match = text.match(/[#№]?\s*(\d{1,5})\b/);
  return match ? match[1] : null;
}

/**
 * Извлекает имя клиента из текста
 * Паттерны: "сделки Иванова", "клиент Петров", "для Сидорова"
 */
export function extractClientName(text: string): string | null {
  const patterns = [
    /(?:сделк[иа]|заказ[ыа]|клиент[аы]?)\s+([А-ЯЁа-яё]+)/i,
    /(?:для|у)\s+([А-ЯЁа-яё]+)/i,
    /([А-ЯЁа-яё]{3,})\s+(?:сделк|заказ)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Извлекает этап из текста
 */
export function extractStage(text: string): string | null {
  const normalizedText = normalizeText(text);

  // Паттерны для извлечения этапа
  const patterns = [
    /(?:на\s+этап|в\s+этап|этап)\s+[«"]?([^»"]+)[»"]?/i,
    /переведи?\s+(?:на|в)\s+([а-яё\s]+)/i,
    /(?:статус|стадия)\s+[«"]?([^»"]+)[»"]?/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Извлекает дату из текста
 */
export function extractDate(text: string): Date | null {
  const now = new Date();
  const normalizedText = text.toLowerCase();

  // Относительные даты
  if (normalizedText.includes('сегодня')) {
    return now;
  }
  if (normalizedText.includes('завтра')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  if (normalizedText.includes('послезавтра')) {
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter;
  }

  // Через N дней
  const daysMatch = normalizedText.match(/через\s+(\d+)\s+дн/);
  if (daysMatch) {
    const future = new Date(now);
    future.setDate(future.getDate() + parseInt(daysMatch[1]));
    return future;
  }

  // Конкретная дата: 25.12, 25.12.2024, 25/12
  const dateMatch = text.match(/(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    const year = dateMatch[3] ? parseInt(dateMatch[3]) : now.getFullYear();
    return new Date(year < 100 ? year + 2000 : year, month, day);
  }

  return null;
}

// ============ КОНТЕКСТНЫЕ ССЫЛКИ ============

/**
 * Проверяет, содержит ли текст ссылку на текущий контекст
 */
export function hasContextReference(text: string): boolean {
  const normalizedText = text.toLowerCase();

  const contextWords = [
    'эту', 'этой', 'этого', 'это',
    'её', 'ее', 'его', 'их',
    'там', 'тут', 'туда', 'оттуда',
    'ту', 'тот', 'та', 'те',
    'данную', 'данной', 'данного',
    'текущую', 'текущей', 'текущего',
    'последнюю', 'последней', 'последнего',
  ];

  return contextWords.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(normalizedText);
  });
}

/**
 * Определяет тип контекстной ссылки
 */
export function getContextReferenceType(text: string): 'deal' | 'client' | 'product' | null {
  const normalizedText = text.toLowerCase();

  // Ссылки на сделку
  if (/(?:эту|ту|данную|текущую|последнюю)\s*сделку/.test(normalizedText)) {
    return 'deal';
  }
  if (/(?:её|ее|его)\s*(?:сумму|этап|статус|менеджера)/.test(normalizedText)) {
    return 'deal';
  }

  // Ссылки на клиента
  if (/(?:этому|этого|данному|ему)\s*клиенту/.test(normalizedText)) {
    return 'client';
  }

  // Общие контекстные слова - предполагаем сделку
  if (hasContextReference(normalizedText)) {
    return 'deal';
  }

  return null;
}

// ============ ОПРЕДЕЛЕНИЕ НАМЕРЕНИЯ ============

export interface ParsedIntent {
  action: 'create' | 'search' | 'view' | 'edit' | 'delete' | 'report' | 'bulk' | 'help' | 'cancel' | 'confirm' | 'greeting' |
          'task_briefing' | 'task_list' | 'task_create' | 'task_complete' | 'task_view' | 'unknown';
  target?: 'deal' | 'client' | 'product' | 'task' | 'document';
  data?: {
    orderNumber?: string;
    clientName?: string;
    amount?: number;
    stage?: string;
    date?: Date;
    field?: string;
    value?: any;
    query?: string;
    // Task-specific data
    taskTitle?: string;
    taskDeadline?: Date;
    taskPriority?: 'urgent' | 'high' | 'normal' | 'low';
    isReminder?: boolean;
  };
  useContext?: boolean; // использовать ли контекст (эту сделку, там и т.д.)
  confidence: number; // 0-100
}

/**
 * Умный парсинг намерения пользователя
 */
export function parseIntent(text: string): ParsedIntent {
  const normalizedText = normalizeText(text);
  const originalText = text.trim();
  const lowerText = text.toLowerCase().trim();

  // 0. Приветствия (RU + EN)
  if (/^(привет|hello|hi|hey|здравствуй|здравствуйте|добрый день|добрый вечер|доброе утро|good morning|good day|good evening|здрасте|приветствую)!?$/i.test(lowerText)) {
    return { action: 'greeting', confidence: 100 };
  }

  // ========== TASK PATTERNS ==========

  // T1. Утренний брифинг / Task Briefing (RU)
  if (/(?:что\s+(?:у\s+нас\s+)?(?:на\s+)?сегодня|план\s+на\s+(?:сегодня|день)|давай\s+(?:работать|начнём|начнем)|что\s+делаем|чем\s+заняться|что\s+надо\s+(?:сделать|делать))/i.test(lowerText)) {
    return { action: 'task_briefing', target: 'task', confidence: 95 };
  }

  // T1b. Утренний брифинг / Task Briefing (EN)
  if (/(?:what(?:'s|\s+is)?\s+(?:for\s+)?today|today(?:'s)?\s+plan|let(?:'s)?\s+(?:start|work|begin)|what\s+(?:do\s+we\s+do|should\s+i\s+do|to\s+do)|daily\s+briefing|morning\s+briefing)/i.test(lowerText)) {
    return { action: 'task_briefing', target: 'task', confidence: 95 };
  }

  // T2. Мои задачи / My Tasks (RU)
  if (/(?:мои\s+задач|покажи\s+(?:мои\s+)?задач|список\s+задач|все\s+задачи|открытые\s+задач|активные\s+задач)/i.test(lowerText)) {
    return { action: 'task_list', target: 'task', confidence: 95 };
  }

  // T2b. Мои задачи / My Tasks (EN)
  if (/(?:my\s+tasks?|show\s+(?:my\s+)?tasks?|task\s+list|all\s+tasks?|open\s+tasks?|active\s+tasks?|pending\s+tasks?)/i.test(lowerText)) {
    return { action: 'task_list', target: 'task', confidence: 95 };
  }

  // T3. Срочные задачи / Urgent Tasks (RU)
  if (/(?:срочн(?:ые|ое)|горящ(?:ие|ее)|важн(?:ые|ое))\s*(?:задач|дела)?|(?:что|какие)\s+горит/i.test(lowerText)) {
    return {
      action: 'task_list',
      target: 'task',
      data: { taskPriority: 'urgent' },
      confidence: 90
    };
  }

  // T3b. Срочные задачи / Urgent Tasks (EN)
  if (/(?:urgent|important|priority|critical)\s*tasks?|what(?:'s)?\s+urgent|deadlines?\s+(?:today|soon)/i.test(lowerText)) {
    return {
      action: 'task_list',
      target: 'task',
      data: { taskPriority: 'urgent' },
      confidence: 90
    };
  }

  // T4. Выполнение задачи / Task Complete (RU)
  if (/^(?:сделал|выполнил|готово|закончил|завершил|done|выполнено|сделано)!?$/i.test(lowerText) ||
      /(?:задач[ау]?\s+)?(?:готов[ао]?|сделан[ао]?|выполнен[ао]?|завершен[ао]?)/i.test(lowerText) ||
      /(?:закрой|закрыть|завершить|отметить)\s+(?:задачу|как\s+выполнен)/i.test(lowerText)) {
    return { action: 'task_complete', target: 'task', confidence: 90 };
  }

  // T4b. Выполнение задачи / Task Complete (EN)
  if (/(?:task\s+)?(?:done|complete|finished)|mark\s+(?:as\s+)?(?:done|complete)|close\s+task/i.test(lowerText)) {
    return { action: 'task_complete', target: 'task', confidence: 90 };
  }

  // T5. Создание задачи / Напоминание (RU)
  if (/(?:напомни|напоминание|создай\s+задач|добавь\s+задач|новая?\s+задач)/i.test(lowerText)) {
    // Извлекаем название задачи
    let taskTitle: string | undefined;
    const titleMatch = lowerText.match(/(?:напомни|задач[уа]?)\s+(.+?)(?:\s+(?:завтра|сегодня|через|до\s+\d)|$)/i);
    if (titleMatch) {
      taskTitle = titleMatch[1].trim();
    }

    // Извлекаем дедлайн
    const taskDeadline = extractDate(originalText);

    // Проверяем приоритет
    let taskPriority: 'urgent' | 'high' | 'normal' | 'low' | undefined;
    if (/(?:срочн|важн|urgent|asap)/i.test(lowerText)) {
      taskPriority = 'urgent';
    }

    return {
      action: 'task_create',
      target: 'task',
      data: {
        taskTitle,
        taskDeadline: taskDeadline || undefined,
        taskPriority,
        isReminder: /напомни/i.test(lowerText),
      },
      confidence: 90
    };
  }

  // T5b. Создание задачи (EN)
  if (/(?:remind\s+me|create\s+(?:a\s+)?task|add\s+(?:a\s+)?task|new\s+task)/i.test(lowerText)) {
    let taskTitle: string | undefined;
    const titleMatch = lowerText.match(/(?:remind\s+me\s+to|task)\s+(.+?)(?:\s+(?:tomorrow|today|in\s+\d|by\s+\d)|$)/i);
    if (titleMatch) {
      taskTitle = titleMatch[1].trim();
    }

    const taskDeadline = extractDate(originalText);

    let taskPriority: 'urgent' | 'high' | 'normal' | 'low' | undefined;
    if (/(?:urgent|asap|important|priority)/i.test(lowerText)) {
      taskPriority = 'urgent';
    }

    return {
      action: 'task_create',
      target: 'task',
      data: {
        taskTitle,
        taskDeadline: taskDeadline || undefined,
        taskPriority,
        isReminder: /remind/i.test(lowerText),
      },
      confidence: 90
    };
  }

  // T6. Просмотр конкретной задачи (RU)
  if (/(?:покажи|открой)\s+задач[уа]/i.test(lowerText)) {
    const taskTitle = lowerText.replace(/(?:покажи|открой)\s+задач[уа]\s*/i, '').trim();
    return {
      action: 'task_view',
      target: 'task',
      data: { query: taskTitle || undefined },
      confidence: 85
    };
  }

  // T6b. Просмотр конкретной задачи (EN)
  if (/(?:show|open|view)\s+task/i.test(lowerText)) {
    const taskTitle = lowerText.replace(/(?:show|open|view)\s+task\s*/i, '').trim();
    return {
      action: 'task_view',
      target: 'task',
      data: { query: taskTitle || undefined },
      confidence: 85
    };
  }

  // ========== END TASK PATTERNS ==========

  // 1. Отмена (RU + EN)
  if (/^(отмена|отменить|стоп|назад|cancel|back|stop|нет|no)$/i.test(normalizedText)) {
    return { action: 'cancel', confidence: 100 };
  }

  // 2. Подтверждение (RU + EN) - расширено для "да новый" и т.д.
  if (/^(да|верно|ок|ok|okay|yes|yep|yeah|sure|подтверждаю|создать|сохранить|давай|proceed|confirm|go|create|save)(\s|$)/i.test(lowerText)) {
    return { action: 'confirm', confidence: 100 };
  }

  // 3. Помощь (RU + EN)
  if (/^(помощь|help|\?|помоги|что умеешь|what can you do|commands|команды)$/i.test(normalizedText)) {
    return { action: 'help', confidence: 100 };
  }

  // 4. Создание сделки (RU) - расширенный паттерн для всех падежей
  if (/(?:создать|создай|новая|новый|новую|добавить|добавь|давай)\s*(?:сделк|заказ|ордер)/i.test(normalizedText) ||
      /(?:создать|создай|новая|новый|новую|добавить|добавь|давай)\s*(?:сделк|заказ|ордер)/i.test(lowerText)) {
    return { action: 'create', target: 'deal', confidence: 95 };
  }

  // 4b. Создание сделки (EN)
  if (/(?:create|new|add|make|start)\s*(?:a\s+)?(?:deal|order|sale)/i.test(lowerText)) {
    return { action: 'create', target: 'deal', confidence: 95 };
  }

  // 4c. Простые команды создания
  if (/^(новая|новый|создать|create)$/i.test(lowerText.trim())) {
    return { action: 'create', target: 'deal', confidence: 85 };
  }

  // 5. Поиск сделок (RU)
  if (/(?:найти|поиск|покажи|где|мои|все)\s*(?:сделк|заказ)/i.test(normalizedText)) {
    const clientName = extractClientName(originalText);
    const orderNumber = extractOrderNumber(originalText);

    return {
      action: 'search',
      target: 'deal',
      data: {
        clientName: clientName || undefined,
        orderNumber: orderNumber || undefined,
        query: clientName || orderNumber || undefined,
      },
      confidence: 90
    };
  }

  // 5b. Поиск сделок (EN)
  if (/(?:find|search|show|list|get|my|all)\s*(?:deals?|orders?|sales?)/i.test(lowerText)) {
    const clientName = extractClientName(originalText);
    const orderNumber = extractOrderNumber(originalText);

    return {
      action: 'search',
      target: 'deal',
      data: {
        clientName: clientName || undefined,
        orderNumber: orderNumber || undefined,
        query: clientName || orderNumber || undefined,
      },
      confidence: 90
    };
  }

  // 6. Поиск по номеру сделки
  const orderNumber = extractOrderNumber(originalText);
  if (orderNumber && /(?:сделка|заказ|#|№|\d{2,})/i.test(normalizedText)) {
    return {
      action: 'view',
      target: 'deal',
      data: { orderNumber },
      confidence: 95
    };
  }

  // 7. Редактирование с контекстом
  if (/(?:изменить|поменять|редактировать|обновить)/i.test(normalizedText)) {
    const useContext = hasContextReference(normalizedText);
    const amount = extractNumber(originalText);
    const stage = extractStage(originalText);

    // Определяем поле для редактирования
    let field: string | undefined;
    if (/сумм/i.test(normalizedText)) field = 'amount';
    else if (/этап|статус|стади/i.test(normalizedText)) field = 'stage';
    else if (/клиент|имя/i.test(normalizedText)) field = 'client_name';
    else if (/телефон/i.test(normalizedText)) field = 'contact_phone';
    else if (/email|почт/i.test(normalizedText)) field = 'contact_email';
    else if (/менеджер|ответствен/i.test(normalizedText)) field = 'manager_id';
    else if (/дедлайн|срок/i.test(normalizedText)) field = 'deadline';

    return {
      action: 'edit',
      target: 'deal',
      data: {
        orderNumber: extractOrderNumber(originalText) || undefined,
        field,
        value: amount || stage || undefined,
        amount: amount || undefined,
        stage: stage || undefined,
      },
      useContext,
      confidence: 85
    };
  }

  // 8. Смена этапа
  if (/(?:переведи|перенеси|смени|в\s+этап|на\s+этап)/i.test(normalizedText)) {
    const stage = extractStage(originalText);
    const useContext = hasContextReference(normalizedText);

    return {
      action: 'edit',
      target: 'deal',
      data: {
        orderNumber: extractOrderNumber(originalText) || undefined,
        field: 'stage',
        stage: stage || undefined,
      },
      useContext: useContext || !extractOrderNumber(originalText),
      confidence: 85
    };
  }

  // 9. Отчёты (RU)
  if (/(?:сколько|статистика|отчёт|отчет|итого|всего)/i.test(normalizedText)) {
    return {
      action: 'report',
      target: 'deal',
      data: {
        stage: extractStage(originalText) || undefined,
      },
      confidence: 80
    };
  }

  // 9b. Отчёты (EN)
  if (/(?:how many|statistics|stats|report|total|count)/i.test(lowerText)) {
    return {
      action: 'report',
      target: 'deal',
      data: {
        stage: extractStage(originalText) || undefined,
      },
      confidence: 80
    };
  }

  // 10. Массовые операции
  if (/(?:все|всех)\s+(?:сделк|заказ)/i.test(normalizedText)) {
    return {
      action: 'bulk',
      target: 'deal',
      data: {
        stage: extractStage(originalText) || undefined,
      },
      confidence: 75
    };
  }

  // 11. Контекстные команды без явного действия
  if (hasContextReference(normalizedText)) {
    const amount = extractNumber(originalText);
    const stage = extractStage(originalText);

    if (amount) {
      return {
        action: 'edit',
        target: 'deal',
        data: { field: 'amount', amount },
        useContext: true,
        confidence: 70
      };
    }

    if (stage) {
      return {
        action: 'edit',
        target: 'deal',
        data: { field: 'stage', stage },
        useContext: true,
        confidence: 70
      };
    }
  }

  // Не распознано - низкая уверенность
  return {
    action: 'unknown',
    data: { query: originalText },
    confidence: 20
  };
}

// ============ ЭКСПОРТ ============

export const textUtils = {
  // Нормализация
  normalizeText,
  fixTypos,
  normalizeSynonyms,

  // Fuzzy
  levenshteinDistance,
  similarity,
  fuzzyFind,
  fuzzyFindClient,

  // Извлечение данных
  extractNumber,
  extractOrderNumber,
  extractClientName,
  extractStage,
  extractDate,

  // Контекст
  hasContextReference,
  getContextReferenceType,

  // Парсинг
  parseIntent,

  // Константы
  SYNONYMS,
  TYPOS,
};
