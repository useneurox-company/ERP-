/**
 * ChatCRM - RetailCRM Adapter
 * Адаптер для работы с RetailCRM (для e-commerce)
 *
 * Настройка в .env:
 * RETAILCRM_URL=https://yourcompany.retailcrm.ru
 * RETAILCRM_API_KEY=xxxxx
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

interface RetailCRMConfig {
  url: string;    // https://yourcompany.retailcrm.ru
  apiKey: string; // API ключ
}

interface RetailCRMOrder {
  id: number;
  number: string;
  customer: {
    id: number;
    firstName: string;
    lastName: string;
    patronymic?: string;
    email?: string;
    phones?: Array<{ number: string }>;
  };
  status: string;
  statusComment?: string;
  managerId?: number;
  managerComment?: string;
  totalSumm: number;
  createdAt: string;
  statusUpdatedAt?: string;
  deliveryDate?: string;
  items?: Array<{
    id: number;
    productName: string;
    quantity: number;
    initialPrice: number;
  }>;
}

interface RetailCRMCustomer {
  id: number;
  firstName: string;
  lastName: string;
  patronymic?: string;
  email?: string;
  phones?: Array<{ number: string }>;
  companies?: Array<{ company: { name: string } }>;
}

interface RetailCRMUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  active: boolean;
}

interface RetailCRMStatus {
  code: string;
  name: string;
  ordering: number;
  group: string;
}

interface RetailCRMProduct {
  id: number;
  name: string;
  article?: string;
  price?: number;
  unit?: { code: string; name: string };
}

export class RetailCRMAdapter implements CRMAdapter {
  private config: RetailCRMConfig;
  private baseUrl: string;
  private PAGE_SIZE = 5;

  private stagesCache: UnifiedStage[] | null = null;
  private managersCache: UnifiedManager[] | null = null;
  private cacheExpiry = 5 * 60 * 1000;
  private stagesCacheTime = 0;
  private managersCacheTime = 0;

  constructor(config: RetailCRMConfig) {
    this.config = config;
    this.baseUrl = `${config.url}/api/v5`;
  }

  getName(): string {
    return 'RetailCRM';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callAPI('/credentials');
      return !!response.credentials;
    } catch (error) {
      console.error('[RetailCRMAdapter] Connection test failed:', error);
      return false;
    }
  }

  private async callAPI(endpoint: string, options: {
    method?: string;
    body?: Record<string, any>;
    params?: Record<string, any>;
  } = {}): Promise<any> {
    const { method = 'GET', body, params } = options;

    const searchParams = new URLSearchParams();
    searchParams.append('apiKey', this.config.apiKey);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (typeof value === 'object') {
          // RetailCRM использует специфичный формат для фильтров
          Object.entries(value as Record<string, any>).forEach(([subKey, subValue]) => {
            searchParams.append(`${key}[${subKey}]`, String(subValue));
          });
        } else {
          searchParams.append(key, String(value));
        }
      });
    }

    let url = `${this.baseUrl}${endpoint}`;

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    };

    if (method === 'GET') {
      url += `?${searchParams.toString()}`;
    } else {
      if (body) {
        Object.entries(body).forEach(([key, value]) => {
          if (typeof value === 'object') {
            searchParams.append(key, JSON.stringify(value));
          } else {
            searchParams.append(key, String(value));
          }
        });
      }
      fetchOptions.body = searchParams.toString();
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      throw new Error(`RetailCRM API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  // ========== СДЕЛКИ (ORDERS) ==========

  async searchDeals(query: string, page: number = 0, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>> {
    const params: Record<string, any> = {
      limit: this.PAGE_SIZE,
      page: page + 1,
    };

    if (query && query.trim()) {
      // Поиск по номеру или имени клиента
      if (/^\d+$/.test(query)) {
        params.filter = { numbers: [query] };
      } else {
        params.filter = { customerName: query };
      }
    }

    if (filters?.managerId) {
      params.filter = params.filter || {};
      params.filter.managers = [filters.managerId];
    }

    if (filters?.stage) {
      params.filter = params.filter || {};
      params.filter.statuses = [filters.stage];
    }

    const response = await this.callAPI('/orders', { params });

    const orders: RetailCRMOrder[] = response.orders || [];
    const total = response.pagination?.totalCount || orders.length;

    const items = await Promise.all(orders.map(o => this.mapOrderToUnified(o)));

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
      const response = await this.callAPI(`/orders/${id}`);
      if (!response.order) return null;
      return this.mapOrderToUnified(response.order);
    } catch (error) {
      console.error('[RetailCRMAdapter] getDealById error:', error);
      return null;
    }
  }

  async createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const order: any = {};

    if (data.clientName) {
      order.firstName = data.clientName;
    }

    if (data.clientPhone) {
      order.phone = data.clientPhone;
    }

    if (data.clientEmail) {
      order.email = data.clientEmail;
    }

    if (data.stage) {
      order.status = data.stage;
    }

    if (data.managerId) {
      order.managerId = parseInt(data.managerId);
    }

    const response = await this.callAPI('/orders/create', {
      method: 'POST',
      body: { order: JSON.stringify(order) }
    });

    if (!response.id) {
      throw new Error('Failed to create order in RetailCRM');
    }

    return await this.getDealById(String(response.id)) as UnifiedDeal;
  }

  async updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const order: any = { id: parseInt(id) };

    if (data.stage !== undefined) order.status = data.stage;
    if (data.managerId !== undefined) order.managerId = parseInt(data.managerId);

    await this.callAPI(`/orders/${id}/edit`, {
      method: 'POST',
      body: { order: JSON.stringify(order) }
    });

    return await this.getDealById(id) as UnifiedDeal;
  }

  // ========== КЛИЕНТЫ ==========

  async searchClients(query: string): Promise<UnifiedClient[]> {
    const params: Record<string, any> = { limit: 10 };

    if (query) {
      params.filter = { name: query };
    }

    const response = await this.callAPI('/customers', { params });
    const customers: RetailCRMCustomer[] = response.customers || [];

    return customers.map(c => this.mapCustomerToUnified(c));
  }

  async getClientById(id: string): Promise<UnifiedClient | null> {
    try {
      const response = await this.callAPI(`/customers/${id}`);
      if (!response.customer) return null;
      return this.mapCustomerToUnified(response.customer);
    } catch (error) {
      console.error('[RetailCRMAdapter] getClientById error:', error);
      return null;
    }
  }

  // ========== СПРАВОЧНИКИ ==========

  async getStages(): Promise<UnifiedStage[]> {
    if (this.stagesCache && Date.now() - this.stagesCacheTime < this.cacheExpiry) {
      return this.stagesCache;
    }

    try {
      const response = await this.callAPI('/reference/statuses');
      const statuses: Record<string, RetailCRMStatus> = response.statuses || {};

      this.stagesCache = Object.values(statuses).map(s => ({
        id: s.code,
        name: s.name,
        order: s.ordering,
        color: this.getStatusColor(s.group)
      }));

      this.stagesCacheTime = Date.now();
      return this.stagesCache;
    } catch (error) {
      console.error('[RetailCRMAdapter] getStages error:', error);
      return [];
    }
  }

  async getManagers(): Promise<UnifiedManager[]> {
    if (this.managersCache && Date.now() - this.managersCacheTime < this.cacheExpiry) {
      return this.managersCache;
    }

    try {
      const response = await this.callAPI('/users', {
        params: { filter: { status: 'activate' } }
      });

      const users: RetailCRMUser[] = response.users || [];

      this.managersCache = users.map(u => ({
        id: String(u.id),
        name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || 'Unknown',
        email: u.email
      }));

      this.managersCacheTime = Date.now();
      return this.managersCache;
    } catch (error) {
      console.error('[RetailCRMAdapter] getManagers error:', error);
      return [];
    }
  }

  // ========== ПРОДУКТЫ ==========

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    try {
      const params: Record<string, any> = { limit: 10 };
      if (query) {
        params.filter = { name: query };
      }

      const response = await this.callAPI('/store/products', { params });
      const products: RetailCRMProduct[] = response.products || [];

      return products.map(p => ({
        id: String(p.id),
        name: p.name,
        sku: p.article,
        price: p.price,
        unit: p.unit?.name
      }));
    } catch (error) {
      console.error('[RetailCRMAdapter] searchProducts error:', error);
      return [];
    }
  }

  async getProductById(id: string): Promise<UnifiedProduct | null> {
    try {
      const response = await this.callAPI(`/store/products/${id}`);
      const p = response.product;
      if (!p) return null;

      return {
        id: String(p.id),
        name: p.name,
        sku: p.article,
        price: p.price,
        unit: p.unit?.name
      };
    } catch (error) {
      console.error('[RetailCRMAdapter] getProductById error:', error);
      return null;
    }
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private async mapOrderToUnified(order: RetailCRMOrder): Promise<UnifiedDeal> {
    // Получаем имя статуса
    let stageName = order.status;
    const stages = await this.getStages();
    const stageInfo = stages.find(s => s.id === order.status);
    if (stageInfo) {
      stageName = stageInfo.name;
    }

    // Получаем имя менеджера
    let managerName: string | undefined;
    if (order.managerId) {
      const managers = await this.getManagers();
      const manager = managers.find(m => m.id === String(order.managerId));
      if (manager) {
        managerName = manager.name;
      }
    }

    const customer = order.customer;
    const clientName = [customer?.firstName, customer?.lastName]
      .filter(Boolean)
      .join(' ') || order.number;

    return {
      id: String(order.id),
      orderNumber: order.number,
      clientName,
      clientPhone: customer?.phones?.[0]?.number,
      clientEmail: customer?.email,
      amount: order.totalSumm,
      stage: order.status,
      stageName,
      managerId: order.managerId ? String(order.managerId) : undefined,
      managerName,
      deadline: order.deliveryDate ? new Date(order.deliveryDate) : undefined,
      notes: order.managerComment,
      createdAt: new Date(order.createdAt),
      updatedAt: order.statusUpdatedAt ? new Date(order.statusUpdatedAt) : undefined,
      _raw: order
    };
  }

  private mapCustomerToUnified(customer: RetailCRMCustomer): UnifiedClient {
    const name = [customer.firstName, customer.patronymic, customer.lastName]
      .filter(Boolean)
      .join(' ') || 'Unknown';

    return {
      id: String(customer.id),
      name,
      phone: customer.phones?.[0]?.number,
      email: customer.email,
      company: customer.companies?.[0]?.company?.name
    };
  }

  private getStatusColor(group: string): string {
    switch (group) {
      case 'new': return '#3b82f6';      // blue
      case 'approval': return '#f59e0b'; // amber
      case 'assembling': return '#8b5cf6'; // violet
      case 'delivery': return '#06b6d4'; // cyan
      case 'complete': return '#22c55e'; // green
      case 'cancel': return '#ef4444';   // red
      default: return '#6b7280';         // gray
    }
  }
}
