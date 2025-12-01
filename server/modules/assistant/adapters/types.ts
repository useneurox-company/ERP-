// Унифицированные типы данных (независимые от CRM)

export interface UnifiedDeal {
  id: string;
  orderNumber?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  company?: string;
  amount?: number;
  stage: string;
  stageName?: string;
  managerId?: string;
  managerName?: string;
  deadline?: Date | null;
  tags?: string[];
  notes?: string;
  productionDaysCount?: number;
  createdAt: Date;
  updatedAt?: Date;
  // Оригинальные данные CRM (для специфичных операций)
  _raw?: any;
}

export interface UnifiedClient {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
}

export interface UnifiedStage {
  id: string;
  name: string;
  color?: string;
  order?: number;
}

export interface UnifiedManager {
  id: string;
  name: string;
  email?: string;
}

export interface UnifiedProduct {
  id: string;
  name: string;
  sku?: string;
  price?: number;
  unit?: string;
}

// Задачи (Tasks)
export interface UnifiedTask {
  id: string;
  title: string;
  description?: string;
  status: 'new' | 'in_progress' | 'pending_review' | 'pending' | 'completed' | 'rejected' | 'cancelled' | 'on_hold';
  priority: 'urgent' | 'high' | 'normal' | 'low';
  deadline?: Date | null;
  startDate?: Date | null;
  estimatedHours?: number;
  actualHours?: number;
  assigneeId?: string;
  assigneeName?: string;
  createdById?: string;
  createdByName?: string;
  dealId?: string;
  dealInfo?: { clientName: string; orderNumber?: string; amount?: number };
  projectId?: string;
  projectName?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt?: Date;
  // Вычисляемые поля
  score?: number; // для приоритизации
  isOverdue?: boolean;
  hoursLeft?: number;
}

export interface TaskFilter {
  status?: string | string[];
  priority?: string | string[];
  assigneeId?: string;
  dealId?: string;
  projectId?: string;
  deadlineFrom?: Date;
  deadlineTo?: Date;
  isOverdue?: boolean;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: 'urgent' | 'high' | 'normal' | 'low';
  deadline?: Date;
  startDate?: Date;
  estimatedHours?: number;
  assigneeId?: string;
  dealId?: string;
  projectId?: string;
  tags?: string[];
}

export interface TasksNeedingAttention {
  urgent: UnifiedTask[];      // priority=urgent или deadline < 24h
  soon: UnifiedTask[];        // deadline < 3 дней
  longRunning: UnifiedTask[]; // estimated_hours > 8 и не начаты
  overdue: UnifiedTask[];     // просроченные
}

export interface SearchResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchFilters {
  managerId?: string;
  stage?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

// Главный интерфейс адаптера
export interface CRMAdapter {
  // Мета
  getName(): string;                    // "LocalDB", "AmoCRM", "Bitrix24"
  testConnection(): Promise<boolean>;   // проверка связи

  // Сделки
  searchDeals(query: string, page?: number, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>>;
  getDealById(id: string): Promise<UnifiedDeal | null>;
  createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal>;
  updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal>;

  // Клиенты
  searchClients(query: string): Promise<UnifiedClient[]>;
  getClientById(id: string): Promise<UnifiedClient | null>;

  // Справочники
  getStages(): Promise<UnifiedStage[]>;
  getManagers(): Promise<UnifiedManager[]>;

  // Продукты (опционально)
  searchProducts?(query: string): Promise<UnifiedProduct[]>;
  getProductById?(id: string): Promise<UnifiedProduct | null>;

  // Задачи
  getMyTasks?(userId: string, filter?: TaskFilter): Promise<UnifiedTask[]>;
  getTodayTasks?(userId: string): Promise<UnifiedTask[]>;
  getUrgentTasks?(userId: string): Promise<UnifiedTask[]>;
  getUpcomingDeadlines?(userId: string, days: number): Promise<UnifiedTask[]>;
  getTasksNeedingAttention?(userId: string): Promise<TasksNeedingAttention>;
  getTaskById?(id: string): Promise<UnifiedTask | null>;
  createTask?(data: CreateTaskData, createdById?: string): Promise<UnifiedTask>;
  updateTask?(id: string, data: Partial<UnifiedTask>): Promise<UnifiedTask>;
  completeTask?(id: string): Promise<UnifiedTask>;
  searchTasks?(query: string, userId?: string): Promise<UnifiedTask[]>;
}

// Конфигурация адаптера
export interface AdapterConfig {
  type: 'local' | 'amocrm' | 'bitrix24' | 'hubspot';
  // AmoCRM
  amocrmSubdomain?: string;
  amocrmClientId?: string;
  amocrmClientSecret?: string;
  amocrmAccessToken?: string;
  amocrmRefreshToken?: string;
  // Bitrix24
  bitrix24Domain?: string;
  bitrix24WebhookToken?: string;
  // HubSpot
  hubspotApiKey?: string;
}
