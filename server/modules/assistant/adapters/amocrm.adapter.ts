/**
 * ChatCRM - AmoCRM Adapter
 * Адаптер для работы с AmoCRM через REST API
 *
 * Настройка в .env:
 * AMOCRM_SUBDOMAIN=yourcompany
 * AMOCRM_ACCESS_TOKEN=xxxxx
 * AMOCRM_REFRESH_TOKEN=xxxxx (опционально для OAuth)
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

interface AmoCRMConfig {
  subdomain: string;     // yourcompany (без .amocrm.ru)
  accessToken: string;   // OAuth токен доступа
  refreshToken?: string; // Для обновления токена
}

interface AmoCRMLead {
  id: number;
  name: string;
  price: number;
  responsible_user_id: number;
  status_id: number;
  pipeline_id: number;
  custom_fields_values?: Array<{
    field_id: number;
    field_name: string;
    values: Array<{ value: string }>;
  }>;
  created_at: number;
  updated_at: number;
  closed_at?: number;
  _embedded?: {
    contacts?: Array<{ id: number }>;
    companies?: Array<{ id: number }>;
  };
}

interface AmoCRMContact {
  id: number;
  name: string;
  custom_fields_values?: Array<{
    field_id: number;
    field_code: string;
    values: Array<{ value: string; enum_code?: string }>;
  }>;
}

interface AmoCRMUser {
  id: number;
  name: string;
  email: string;
}

interface AmoCRMPipelineStatus {
  id: number;
  name: string;
  sort: number;
  color: string;
  is_editable: boolean;
}

interface AmoCRMProduct {
  id: number;
  name: string;
  price: number;
  unit?: string;
  sku?: string;
}

export class AmoCRMAdapter implements CRMAdapter {
  private config: AmoCRMConfig;
  private baseUrl: string;
  private PAGE_SIZE = 5;

  // Кэш
  private stagesCache: UnifiedStage[] | null = null;
  private managersCache: UnifiedManager[] | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 минут
  private stagesCacheTime = 0;
  private managersCacheTime = 0;

  constructor(config: AmoCRMConfig) {
    this.config = config;
    this.baseUrl = `https://${config.subdomain}.amocrm.ru/api/v4`;
  }

  getName(): string {
    return 'AmoCRM';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callAPI('/account');
      return !!response.id;
    } catch (error) {
      console.error('[AmoCRMAdapter] Connection test failed:', error);
      return false;
    }
  }

  // ========== API ВЫЗОВЫ ==========

  private async callAPI(endpoint: string, options: {
    method?: string;
    body?: any;
    params?: Record<string, string | number>;
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
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`AmoCRM API error: ${response.status} ${response.statusText}`);
    }

    // Некоторые эндпоинты возвращают пустой ответ
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  // ========== СДЕЛКИ (LEADS) ==========

  async searchDeals(query: string, page: number = 0, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>> {
    const params: Record<string, string | number> = {
      page: page + 1,
      limit: this.PAGE_SIZE,
      with: 'contacts,companies',
    };

    if (query && query.trim()) {
      params.query = query;
    }

    if (filters?.managerId) {
      params['filter[responsible_user_id]'] = filters.managerId;
    }

    if (filters?.stage) {
      params['filter[statuses][0][status_id]'] = filters.stage;
    }

    const response = await this.callAPI('/leads', { params });

    const leads: AmoCRMLead[] = response._embedded?.leads || [];

    // В AmoCRM нет точного подсчёта, оцениваем по наличию следующей страницы
    const hasMore = leads.length === this.PAGE_SIZE;
    const total = response._total_items || (page * this.PAGE_SIZE + leads.length + (hasMore ? 1 : 0));

    const items = await Promise.all(leads.map(l => this.mapLeadToUnified(l)));

    return {
      items,
      total,
      page,
      pageSize: this.PAGE_SIZE,
      hasMore
    };
  }

  async getDealById(id: string): Promise<UnifiedDeal | null> {
    try {
      const response = await this.callAPI(`/leads/${id}`, {
        params: { with: 'contacts,companies' }
      });
      return this.mapLeadToUnified(response);
    } catch (error) {
      console.error('[AmoCRMAdapter] getDealById error:', error);
      return null;
    }
  }

  async createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const lead = {
      name: data.clientName || 'Новая сделка',
      price: data.amount || 0,
      status_id: data.stage ? parseInt(data.stage) : undefined,
      responsible_user_id: data.managerId ? parseInt(data.managerId) : undefined,
    };

    const response = await this.callAPI('/leads', {
      method: 'POST',
      body: [lead]
    });

    const createdId = response._embedded?.leads?.[0]?.id;
    if (!createdId) {
      throw new Error('Failed to create lead in AmoCRM');
    }

    return await this.getDealById(String(createdId)) as UnifiedDeal;
  }

  async updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const update: any = { id: parseInt(id) };

    if (data.clientName !== undefined) update.name = data.clientName;
    if (data.amount !== undefined) update.price = data.amount;
    if (data.stage !== undefined) update.status_id = parseInt(data.stage);
    if (data.managerId !== undefined) update.responsible_user_id = parseInt(data.managerId);

    await this.callAPI('/leads', {
      method: 'PATCH',
      body: [update]
    });

    return await this.getDealById(id) as UnifiedDeal;
  }

  // ========== КЛИЕНТЫ (CONTACTS) ==========

  async searchClients(query: string): Promise<UnifiedClient[]> {
    const params: Record<string, string | number> = {
      limit: 10,
    };

    if (query && query.trim()) {
      params.query = query;
    }

    const response = await this.callAPI('/contacts', { params });
    const contacts: AmoCRMContact[] = response._embedded?.contacts || [];

    return contacts.map(c => this.mapContactToUnified(c));
  }

  async getClientById(id: string): Promise<UnifiedClient | null> {
    try {
      const response = await this.callAPI(`/contacts/${id}`);
      return this.mapContactToUnified(response);
    } catch (error) {
      console.error('[AmoCRMAdapter] getClientById error:', error);
      return null;
    }
  }

  // ========== СПРАВОЧНИКИ ==========

  async getStages(): Promise<UnifiedStage[]> {
    if (this.stagesCache && Date.now() - this.stagesCacheTime < this.cacheExpiry) {
      return this.stagesCache;
    }

    try {
      const response = await this.callAPI('/leads/pipelines');
      const pipelines = response._embedded?.pipelines || [];

      // Берём первый pipeline (основной)
      const mainPipeline = pipelines[0];
      if (!mainPipeline || !mainPipeline._embedded?.statuses) {
        return [];
      }

      const statuses: AmoCRMPipelineStatus[] = mainPipeline._embedded.statuses;

      this.stagesCache = statuses
        .filter(s => s.is_editable !== false)
        .map(s => ({
          id: String(s.id),
          name: s.name,
          order: s.sort,
          color: s.color
        }));

      this.stagesCacheTime = Date.now();
      return this.stagesCache;
    } catch (error) {
      console.error('[AmoCRMAdapter] getStages error:', error);
      return [];
    }
  }

  async getManagers(): Promise<UnifiedManager[]> {
    if (this.managersCache && Date.now() - this.managersCacheTime < this.cacheExpiry) {
      return this.managersCache;
    }

    try {
      const response = await this.callAPI('/users');
      const users: AmoCRMUser[] = response._embedded?.users || [];

      this.managersCache = users.map(u => ({
        id: String(u.id),
        name: u.name,
        email: u.email
      }));

      this.managersCacheTime = Date.now();
      return this.managersCache;
    } catch (error) {
      console.error('[AmoCRMAdapter] getManagers error:', error);
      return [];
    }
  }

  // ========== ПРОДУКТЫ ==========

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    try {
      const params: Record<string, string | number> = { limit: 10 };
      if (query) params.query = query;

      const response = await this.callAPI('/catalogs/products', { params });
      const products: AmoCRMProduct[] = response._embedded?.products || [];

      return products.map(p => ({
        id: String(p.id),
        name: p.name,
        price: p.price,
        unit: p.unit,
        sku: p.sku
      }));
    } catch (error) {
      console.error('[AmoCRMAdapter] searchProducts error:', error);
      return [];
    }
  }

  async getProductById(id: string): Promise<UnifiedProduct | null> {
    try {
      const response = await this.callAPI(`/catalogs/products/${id}`);
      return {
        id: String(response.id),
        name: response.name,
        price: response.price,
        unit: response.unit,
        sku: response.sku
      };
    } catch (error) {
      console.error('[AmoCRMAdapter] getProductById error:', error);
      return null;
    }
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private async mapLeadToUnified(lead: AmoCRMLead): Promise<UnifiedDeal> {
    // Получаем этапы для имени
    let stageName = String(lead.status_id);
    const stages = await this.getStages();
    const stageInfo = stages.find(s => s.id === String(lead.status_id));
    if (stageInfo) {
      stageName = stageInfo.name;
    }

    // Получаем имя менеджера
    let managerName: string | undefined;
    if (lead.responsible_user_id) {
      const managers = await this.getManagers();
      const manager = managers.find(m => m.id === String(lead.responsible_user_id));
      if (manager) {
        managerName = manager.name;
      }
    }

    // Пытаемся получить контакт
    let clientPhone: string | undefined;
    let clientEmail: string | undefined;
    const contactId = lead._embedded?.contacts?.[0]?.id;
    if (contactId) {
      const contact = await this.getClientById(String(contactId));
      if (contact) {
        clientPhone = contact.phone;
        clientEmail = contact.email;
      }
    }

    return {
      id: String(lead.id),
      orderNumber: String(lead.id),
      clientName: lead.name,
      clientPhone,
      clientEmail,
      amount: lead.price || undefined,
      stage: String(lead.status_id),
      stageName,
      managerId: lead.responsible_user_id ? String(lead.responsible_user_id) : undefined,
      managerName,
      createdAt: new Date(lead.created_at * 1000),
      updatedAt: new Date(lead.updated_at * 1000),
      _raw: lead
    };
  }

  private mapContactToUnified(contact: AmoCRMContact): UnifiedClient {
    let phone: string | undefined;
    let email: string | undefined;

    // Извлекаем телефон и email из custom_fields
    if (contact.custom_fields_values) {
      for (const field of contact.custom_fields_values) {
        if (field.field_code === 'PHONE' && field.values?.length > 0) {
          phone = field.values[0].value;
        }
        if (field.field_code === 'EMAIL' && field.values?.length > 0) {
          email = field.values[0].value;
        }
      }
    }

    return {
      id: String(contact.id),
      name: contact.name,
      phone,
      email
    };
  }
}
