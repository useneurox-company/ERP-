/**
 * ChatCRM - YClients Adapter
 * Адаптер для работы с YClients (CRM для услуг)
 *
 * Настройка в .env:
 * YCLIENTS_TOKEN=xxxxx (Bearer токен)
 * YCLIENTS_COMPANY_ID=123456
 */

import {
  CRMAdapter,
  UnifiedDeal,
  UnifiedClient,
  UnifiedStage,
  UnifiedManager,
  UnifiedProduct,
  SearchResult,
  SearchFilters
} from './types';

interface YClientsConfig {
  token: string;     // Bearer токен
  companyId: string; // ID компании
}

interface YClientsRecord {
  id: number;
  company_id: number;
  services: Array<{
    id: number;
    title: string;
    cost: number;
  }>;
  staff: {
    id: number;
    name: string;
  };
  client?: {
    id: number;
    name: string;
    phone: string;
    email?: string;
  };
  datetime: string;
  created_date: string;
  comment?: string;
  visit_attendance: number; // 0 - не пришёл, 1 - пришёл, 2 - подтверждён
  paid_full: number;
  prepaid: number;
}

interface YClientsClient {
  id: number;
  name: string;
  phone: string;
  email?: string;
  comment?: string;
}

interface YClientsStaff {
  id: number;
  name: string;
  specialization?: string;
  position?: { title: string };
}

interface YClientsService {
  id: number;
  title: string;
  price_min: number;
  price_max: number;
  duration: number;
}

export class YClientsAdapter implements CRMAdapter {
  private config: YClientsConfig;
  private baseUrl = 'https://api.yclients.com/api/v1';
  private PAGE_SIZE = 5;

  private stagesCache: UnifiedStage[] | null = null;
  private managersCache: UnifiedManager[] | null = null;
  private cacheExpiry = 5 * 60 * 1000;
  private stagesCacheTime = 0;
  private managersCacheTime = 0;

  constructor(config: YClientsConfig) {
    this.config = config;
  }

  getName(): string {
    return 'YClients';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callAPI(`/company/${this.config.companyId}`);
      return !!response.data?.id;
    } catch (error) {
      console.error('[YClientsAdapter] Connection test failed:', error);
      return false;
    }
  }

  private async callAPI(endpoint: string, options: {
    method?: string;
    body?: any;
    params?: Record<string, any>;
  } = {}): Promise<any> {
    const { method = 'GET', body, params } = options;

    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${this.config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.yclients.v2+json',
      },
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`YClients API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // ========== СДЕЛКИ (RECORDS/BOOKINGS) ==========

  async searchDeals(query: string, page: number = 0, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>> {
    const params: Record<string, any> = {
      page: page + 1,
      count: this.PAGE_SIZE,
    };

    // YClients ищет записи по дате, не по тексту
    // Используем фильтр по клиенту если есть
    if (filters?.managerId) {
      params.staff_id = filters.managerId;
    }

    // Получаем записи за последний месяц
    const now = new Date();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    params.start_date = monthAgo.toISOString().split('T')[0];
    params.end_date = now.toISOString().split('T')[0];

    const response = await this.callAPI(`/records/${this.config.companyId}`, { params });

    let records: YClientsRecord[] = response.data || [];

    // Фильтруем по имени клиента если есть запрос
    if (query && query.trim()) {
      const lowerQuery = query.toLowerCase();
      records = records.filter(r =>
        r.client?.name?.toLowerCase().includes(lowerQuery) ||
        r.client?.phone?.includes(query) ||
        String(r.id).includes(query)
      );
    }

    const total = response.meta?.total_count || records.length;
    const items = await Promise.all(records.slice(0, this.PAGE_SIZE).map(r => this.mapRecordToUnified(r)));

    return {
      items,
      total,
      page,
      pageSize: this.PAGE_SIZE,
      hasMore: (page + 1) * this.PAGE_SIZE < total
    };
  }

  async getDealById(id: string): Promise<UnifiedDeal | null> {
    try {
      const response = await this.callAPI(`/record/${this.config.companyId}/${id}`);
      if (!response.data) return null;
      return this.mapRecordToUnified(response.data);
    } catch (error) {
      console.error('[YClientsAdapter] getDealById error:', error);
      return null;
    }
  }

  async createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    // В YClients создание записи требует конкретную дату и услугу
    const body: any = {
      phone: data.clientPhone || '',
      fullname: data.clientName || '',
      comment: data.notes || '',
    };

    if (data.managerId) {
      body.staff_id = parseInt(data.managerId);
    }

    // Дата записи (если не указана - сегодня)
    if (data.deadline) {
      const date = data.deadline instanceof Date ? data.deadline : new Date(data.deadline);
      body.datetime = date.toISOString();
    } else {
      body.datetime = new Date().toISOString();
    }

    const response = await this.callAPI(`/records/${this.config.companyId}`, {
      method: 'POST',
      body
    });

    if (!response.data?.id) {
      throw new Error('Failed to create record in YClients');
    }

    return await this.getDealById(String(response.data.id)) as UnifiedDeal;
  }

  async updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const body: any = {};

    if (data.notes !== undefined) body.comment = data.notes;
    if (data.managerId !== undefined) body.staff_id = parseInt(data.managerId);

    // Статус посещения
    if (data.stage !== undefined) {
      const stageNum = parseInt(data.stage);
      if (!isNaN(stageNum)) {
        body.visit_attendance = stageNum;
      }
    }

    await this.callAPI(`/record/${this.config.companyId}/${id}`, {
      method: 'PUT',
      body
    });

    return await this.getDealById(id) as UnifiedDeal;
  }

  // ========== КЛИЕНТЫ ==========

  async searchClients(query: string): Promise<UnifiedClient[]> {
    const params: Record<string, any> = {
      count: 10,
    };

    if (query) {
      params.fullname = query;
    }

    const response = await this.callAPI(`/clients/${this.config.companyId}`, { params });
    const clients: YClientsClient[] = response.data || [];

    return clients.map(c => ({
      id: String(c.id),
      name: c.name,
      phone: c.phone,
      email: c.email
    }));
  }

  async getClientById(id: string): Promise<UnifiedClient | null> {
    try {
      const response = await this.callAPI(`/client/${this.config.companyId}/${id}`);
      const c = response.data;
      if (!c) return null;

      return {
        id: String(c.id),
        name: c.name,
        phone: c.phone,
        email: c.email
      };
    } catch (error) {
      console.error('[YClientsAdapter] getClientById error:', error);
      return null;
    }
  }

  // ========== СПРАВОЧНИКИ ==========

  async getStages(): Promise<UnifiedStage[]> {
    // В YClients статусы записей фиксированные
    if (!this.stagesCache) {
      this.stagesCache = [
        { id: '0', name: 'Ожидание', order: 0, color: '#f59e0b' },
        { id: '2', name: 'Подтверждён', order: 1, color: '#3b82f6' },
        { id: '1', name: 'Клиент пришёл', order: 2, color: '#22c55e' },
        { id: '-1', name: 'Клиент не пришёл', order: 3, color: '#ef4444' },
      ];
    }
    return this.stagesCache;
  }

  async getManagers(): Promise<UnifiedManager[]> {
    if (this.managersCache && Date.now() - this.managersCacheTime < this.cacheExpiry) {
      return this.managersCache;
    }

    try {
      const response = await this.callAPI(`/staff/${this.config.companyId}`);
      const staff: YClientsStaff[] = response.data || [];

      this.managersCache = staff.map(s => ({
        id: String(s.id),
        name: s.name,
        email: undefined // YClients не возвращает email сотрудников
      }));

      this.managersCacheTime = Date.now();
      return this.managersCache;
    } catch (error) {
      console.error('[YClientsAdapter] getManagers error:', error);
      return [];
    }
  }

  // ========== УСЛУГИ (PRODUCTS) ==========

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    try {
      const response = await this.callAPI(`/services/${this.config.companyId}`);
      let services: YClientsService[] = response.data || [];

      if (query) {
        const lowerQuery = query.toLowerCase();
        services = services.filter(s =>
          s.title.toLowerCase().includes(lowerQuery)
        );
      }

      return services.slice(0, 10).map(s => ({
        id: String(s.id),
        name: s.title,
        price: s.price_min || s.price_max,
        unit: `${s.duration} мин`
      }));
    } catch (error) {
      console.error('[YClientsAdapter] searchProducts error:', error);
      return [];
    }
  }

  async getProductById(id: string): Promise<UnifiedProduct | null> {
    try {
      const response = await this.callAPI(`/services/${this.config.companyId}`);
      const services: YClientsService[] = response.data || [];
      const service = services.find(s => String(s.id) === id);

      if (!service) return null;

      return {
        id: String(service.id),
        name: service.title,
        price: service.price_min || service.price_max,
        unit: `${service.duration} мин`
      };
    } catch (error) {
      console.error('[YClientsAdapter] getProductById error:', error);
      return null;
    }
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private async mapRecordToUnified(record: YClientsRecord): Promise<UnifiedDeal> {
    // Получаем статус
    const stages = await this.getStages();
    const stageId = String(record.visit_attendance);
    const stageInfo = stages.find(s => s.id === stageId);

    // Сумма услуг
    const amount = record.services?.reduce((sum, s) => sum + s.cost, 0) || 0;

    // Название услуг
    const servicesNames = record.services?.map(s => s.title).join(', ') || '';

    return {
      id: String(record.id),
      orderNumber: String(record.id),
      clientName: record.client?.name || 'Без имени',
      clientPhone: record.client?.phone,
      clientEmail: record.client?.email,
      amount: amount || undefined,
      stage: stageId,
      stageName: stageInfo?.name || 'Ожидание',
      managerId: record.staff?.id ? String(record.staff.id) : undefined,
      managerName: record.staff?.name,
      deadline: new Date(record.datetime),
      notes: [servicesNames, record.comment].filter(Boolean).join('\n'),
      createdAt: new Date(record.created_date),
      _raw: record
    };
  }
}
