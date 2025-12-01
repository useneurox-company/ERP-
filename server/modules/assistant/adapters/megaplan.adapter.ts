/**
 * ChatCRM - Megaplan Adapter
 * Адаптер для работы с Megaplan CRM через REST API
 *
 * Настройка в .env:
 * MEGAPLAN_DOMAIN=yourcompany.megaplan.ru
 * MEGAPLAN_ACCESS_TOKEN=xxxxx
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

interface MegaplanConfig {
  domain: string;      // yourcompany.megaplan.ru
  accessToken: string; // API токен
}

interface MegaplanDeal {
  Id: number;
  Name: string;
  Cost: { Value: number; Currency: string };
  Status: { Id: number; Name: string };
  Program: { Id: number; Name: string };
  Responsible: { Id: number; Name: string };
  Client?: { Id: number; Name: string };
  TimeCreated: string;
  TimeUpdated: string;
  Deadline?: string;
}

interface MegaplanClient {
  Id: number;
  FirstName: string;
  LastName: string;
  MiddleName?: string;
  Phone?: string;
  Email?: string;
  Company?: { Id: number; Name: string };
}

interface MegaplanEmployee {
  Id: number;
  FirstName: string;
  LastName: string;
  Email?: string;
}

interface MegaplanStatus {
  Id: number;
  Name: string;
  Color?: string;
  SortOrder: number;
}

export class MegaplanAdapter implements CRMAdapter {
  private config: MegaplanConfig;
  private baseUrl: string;
  private PAGE_SIZE = 5;

  private stagesCache: UnifiedStage[] | null = null;
  private managersCache: UnifiedManager[] | null = null;
  private cacheExpiry = 5 * 60 * 1000;
  private stagesCacheTime = 0;
  private managersCacheTime = 0;

  constructor(config: MegaplanConfig) {
    this.config = config;
    this.baseUrl = `https://${config.domain}/api/v3`;
  }

  getName(): string {
    return 'Megaplan';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callAPI('/me');
      return !!response.data?.Id;
    } catch (error) {
      console.error('[MegaplanAdapter] Connection test failed:', error);
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
        if (typeof value === 'object') {
          searchParams.append(key, JSON.stringify(value));
        } else {
          searchParams.append(key, String(value));
        }
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
      throw new Error(`Megaplan API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // ========== СДЕЛКИ ==========

  async searchDeals(query: string, page: number = 0, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>> {
    const params: Record<string, any> = {
      limit: this.PAGE_SIZE,
      offset: page * this.PAGE_SIZE,
    };

    if (query && query.trim()) {
      params.search = query;
    }

    if (filters?.managerId) {
      params['filter[Responsible]'] = filters.managerId;
    }

    if (filters?.stage) {
      params['filter[Status]'] = filters.stage;
    }

    const response = await this.callAPI('/deal', { params });

    const deals: MegaplanDeal[] = response.data || [];
    const total = response.meta?.totalCount || deals.length;

    const items = await Promise.all(deals.map(d => this.mapDealToUnified(d)));

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
      const response = await this.callAPI(`/deal/${id}`);
      if (!response.data) return null;
      return this.mapDealToUnified(response.data);
    } catch (error) {
      console.error('[MegaplanAdapter] getDealById error:', error);
      return null;
    }
  }

  async createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const body: any = {
      Model: {
        Name: data.clientName || 'Новая сделка',
      }
    };

    if (data.amount) {
      body.Model.Cost = { Value: data.amount };
    }

    if (data.stage) {
      body.Model.Status = { Id: parseInt(data.stage) };
    }

    if (data.managerId) {
      body.Model.Responsible = { Id: parseInt(data.managerId) };
    }

    if (data.deadline) {
      body.Model.Deadline = data.deadline instanceof Date
        ? data.deadline.toISOString()
        : data.deadline;
    }

    const response = await this.callAPI('/deal', {
      method: 'POST',
      body
    });

    if (!response.data?.Id) {
      throw new Error('Failed to create deal in Megaplan');
    }

    return await this.getDealById(String(response.data.Id)) as UnifiedDeal;
  }

  async updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const model: any = {};

    if (data.clientName !== undefined) model.Name = data.clientName;
    if (data.amount !== undefined) model.Cost = { Value: data.amount };
    if (data.stage !== undefined) model.Status = { Id: parseInt(data.stage) };
    if (data.managerId !== undefined) model.Responsible = { Id: parseInt(data.managerId) };
    if (data.deadline !== undefined) {
      model.Deadline = data.deadline instanceof Date
        ? data.deadline.toISOString()
        : data.deadline;
    }

    await this.callAPI(`/deal/${id}`, {
      method: 'POST',
      body: { Model: model }
    });

    return await this.getDealById(id) as UnifiedDeal;
  }

  // ========== КЛИЕНТЫ ==========

  async searchClients(query: string): Promise<UnifiedClient[]> {
    const params: Record<string, any> = { limit: 10 };
    if (query) params.search = query;

    const response = await this.callAPI('/contractor', { params });
    const clients: MegaplanClient[] = response.data || [];

    return clients.map(c => this.mapClientToUnified(c));
  }

  async getClientById(id: string): Promise<UnifiedClient | null> {
    try {
      const response = await this.callAPI(`/contractor/${id}`);
      if (!response.data) return null;
      return this.mapClientToUnified(response.data);
    } catch (error) {
      console.error('[MegaplanAdapter] getClientById error:', error);
      return null;
    }
  }

  // ========== СПРАВОЧНИКИ ==========

  async getStages(): Promise<UnifiedStage[]> {
    if (this.stagesCache && Date.now() - this.stagesCacheTime < this.cacheExpiry) {
      return this.stagesCache;
    }

    try {
      // Получаем программы сделок (pipelines) и их статусы
      const response = await this.callAPI('/dealStatus', {
        params: { limit: 100 }
      });

      const statuses: MegaplanStatus[] = response.data || [];

      this.stagesCache = statuses.map(s => ({
        id: String(s.Id),
        name: s.Name,
        order: s.SortOrder,
        color: s.Color
      }));

      this.stagesCacheTime = Date.now();
      return this.stagesCache;
    } catch (error) {
      console.error('[MegaplanAdapter] getStages error:', error);
      return [];
    }
  }

  async getManagers(): Promise<UnifiedManager[]> {
    if (this.managersCache && Date.now() - this.managersCacheTime < this.cacheExpiry) {
      return this.managersCache;
    }

    try {
      const response = await this.callAPI('/employee', {
        params: { limit: 50 }
      });

      const employees: MegaplanEmployee[] = response.data || [];

      this.managersCache = employees.map(e => ({
        id: String(e.Id),
        name: `${e.FirstName || ''} ${e.LastName || ''}`.trim() || 'Unknown',
        email: e.Email
      }));

      this.managersCacheTime = Date.now();
      return this.managersCache;
    } catch (error) {
      console.error('[MegaplanAdapter] getManagers error:', error);
      return [];
    }
  }

  // ========== ПРОДУКТЫ (не реализовано в базовом API) ==========

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    // Megaplan не имеет стандартного каталога продуктов в API
    return [];
  }

  async getProductById(id: string): Promise<UnifiedProduct | null> {
    return null;
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private async mapDealToUnified(deal: MegaplanDeal): Promise<UnifiedDeal> {
    return {
      id: String(deal.Id),
      orderNumber: String(deal.Id),
      clientName: deal.Name,
      clientPhone: undefined, // Нужно получить из контакта
      clientEmail: undefined,
      company: deal.Client?.Name,
      amount: deal.Cost?.Value,
      stage: String(deal.Status?.Id || ''),
      stageName: deal.Status?.Name,
      managerId: deal.Responsible?.Id ? String(deal.Responsible.Id) : undefined,
      managerName: deal.Responsible?.Name,
      deadline: deal.Deadline ? new Date(deal.Deadline) : undefined,
      createdAt: new Date(deal.TimeCreated),
      updatedAt: deal.TimeUpdated ? new Date(deal.TimeUpdated) : undefined,
      _raw: deal
    };
  }

  private mapClientToUnified(client: MegaplanClient): UnifiedClient {
    const name = [client.FirstName, client.MiddleName, client.LastName]
      .filter(Boolean)
      .join(' ') || 'Unknown';

    return {
      id: String(client.Id),
      name,
      phone: client.Phone,
      email: client.Email,
      company: client.Company?.Name
    };
  }
}
