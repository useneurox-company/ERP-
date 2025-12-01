/**
 * ChatCRM - Bitrix24 Adapter
 * Адаптер для работы с Bitrix24 CRM через REST API (webhooks)
 *
 * Настройка в .env:
 * BITRIX24_DOMAIN=yourcompany.bitrix24.ru
 * BITRIX24_USER_ID=1
 * BITRIX24_WEBHOOK_TOKEN=xxxxxxxxxxxx
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

interface Bitrix24Config {
  domain: string;      // yourcompany.bitrix24.ru
  userId: string;      // ID пользователя (обычно 1)
  webhookToken: string; // токен webhook
}

interface Bitrix24Deal {
  ID: string;
  TITLE: string;
  OPPORTUNITY: string;
  CURRENCY_ID: string;
  STAGE_ID: string;
  CATEGORY_ID: string;
  ASSIGNED_BY_ID: string;
  CONTACT_ID: string;
  COMPANY_ID: string;
  COMMENTS: string;
  DATE_CREATE: string;
  DATE_MODIFY: string;
  CLOSEDATE: string;
  UF_CRM_1234567890?: string; // Кастомные поля UF_*
}

interface Bitrix24Contact {
  ID: string;
  NAME: string;
  LAST_NAME: string;
  PHONE: Array<{ VALUE: string; VALUE_TYPE: string }>;
  EMAIL: Array<{ VALUE: string; VALUE_TYPE: string }>;
  COMPANY_ID: string;
}

interface Bitrix24User {
  ID: string;
  NAME: string;
  LAST_NAME: string;
  EMAIL: string;
  ACTIVE: boolean;
}

interface Bitrix24Stage {
  STATUS_ID: string;
  NAME: string;
  SORT: string;
  SEMANTICS: string;
}

interface Bitrix24Product {
  ID: string;
  NAME: string;
  PRICE: string;
  CURRENCY_ID: string;
  MEASURE: string;
}

export class Bitrix24Adapter implements CRMAdapter {
  private config: Bitrix24Config;
  private baseUrl: string;
  private PAGE_SIZE = 5;

  // Кэш для этапов и пользователей
  private stagesCache: UnifiedStage[] | null = null;
  private managersCache: UnifiedManager[] | null = null;
  private cacheExpiry = 5 * 60 * 1000; // 5 минут
  private stagesCacheTime = 0;
  private managersCacheTime = 0;

  constructor(config: Bitrix24Config) {
    this.config = config;
    // Формат URL: https://domain/rest/userId/webhookToken/method/
    this.baseUrl = `https://${config.domain}/rest/${config.userId}/${config.webhookToken}`;
  }

  getName(): string {
    return 'Bitrix24';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callAPI('profile');
      return !!response.result;
    } catch (error) {
      console.error('[Bitrix24Adapter] Connection test failed:', error);
      return false;
    }
  }

  // ========== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ==========

  private async callAPI(method: string, params: Record<string, any> = {}): Promise<any> {
    const url = `${this.baseUrl}/${method}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        throw new Error(`Bitrix24 API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[Bitrix24Adapter] API call failed: ${method}`, error);
      throw error;
    }
  }

  // ========== СДЕЛКИ ==========

  async searchDeals(query: string, page: number = 0, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>> {
    const start = page * this.PAGE_SIZE;

    // Строим фильтр для Bitrix24
    const filter: Record<string, any> = {};

    if (query && query.trim()) {
      // Поиск по названию сделки или ID
      if (/^\d+$/.test(query)) {
        filter['ID'] = query;
      } else {
        filter['%TITLE'] = query;
      }
    }

    if (filters?.managerId) {
      filter['ASSIGNED_BY_ID'] = filters.managerId;
    }

    if (filters?.stage) {
      filter['STAGE_ID'] = filters.stage;
    }

    if (filters?.dateFrom) {
      filter['>=DATE_CREATE'] = filters.dateFrom.toISOString();
    }

    if (filters?.dateTo) {
      filter['<=DATE_CREATE'] = filters.dateTo.toISOString();
    }

    const response = await this.callAPI('crm.deal.list', {
      filter,
      order: { DATE_CREATE: 'DESC' },
      start,
      select: [
        'ID', 'TITLE', 'OPPORTUNITY', 'CURRENCY_ID',
        'STAGE_ID', 'CATEGORY_ID', 'ASSIGNED_BY_ID',
        'CONTACT_ID', 'COMPANY_ID', 'COMMENTS',
        'DATE_CREATE', 'DATE_MODIFY', 'CLOSEDATE'
      ]
    });

    const deals: Bitrix24Deal[] = response.result || [];
    const total = response.total || deals.length;

    // Преобразуем сделки
    const items = await Promise.all(deals.map(d => this.mapDealToUnified(d)));

    return {
      items,
      total,
      page,
      pageSize: this.PAGE_SIZE,
      hasMore: start + deals.length < total
    };
  }

  async getDealById(id: string): Promise<UnifiedDeal | null> {
    try {
      const response = await this.callAPI('crm.deal.get', { id });

      if (!response.result) {
        return null;
      }

      return this.mapDealToUnified(response.result);
    } catch (error) {
      console.error('[Bitrix24Adapter] getDealById error:', error);
      return null;
    }
  }

  async createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const fields: Record<string, any> = {
      TITLE: data.clientName || 'Новая сделка',
      COMMENTS: data.notes || '',
    };

    if (data.amount) {
      fields.OPPORTUNITY = String(data.amount);
    }

    if (data.stage) {
      fields.STAGE_ID = data.stage;
    }

    if (data.managerId) {
      fields.ASSIGNED_BY_ID = data.managerId;
    }

    if (data.deadline) {
      fields.CLOSEDATE = data.deadline instanceof Date
        ? data.deadline.toISOString()
        : data.deadline;
    }

    const response = await this.callAPI('crm.deal.add', { fields });

    if (!response.result) {
      throw new Error('Failed to create deal in Bitrix24');
    }

    // Получаем созданную сделку
    return await this.getDealById(response.result) as UnifiedDeal;
  }

  async updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const fields: Record<string, any> = {};

    if (data.clientName !== undefined) {
      fields.TITLE = data.clientName;
    }

    if (data.amount !== undefined) {
      fields.OPPORTUNITY = String(data.amount);
    }

    if (data.stage !== undefined) {
      fields.STAGE_ID = data.stage;
    }

    if (data.managerId !== undefined) {
      fields.ASSIGNED_BY_ID = data.managerId;
    }

    if (data.deadline !== undefined) {
      fields.CLOSEDATE = data.deadline instanceof Date
        ? data.deadline.toISOString()
        : data.deadline;
    }

    if (data.notes !== undefined) {
      fields.COMMENTS = data.notes;
    }

    await this.callAPI('crm.deal.update', { id, fields });

    // Получаем обновлённую сделку
    return await this.getDealById(id) as UnifiedDeal;
  }

  // ========== КЛИЕНТЫ (КОНТАКТЫ) ==========

  async searchClients(query: string): Promise<UnifiedClient[]> {
    const filter: Record<string, any> = {};

    if (query && query.trim()) {
      // Поиск по имени, фамилии или телефону
      filter['LOGIC'] = 'OR';
      filter['%NAME'] = query;
      filter['%LAST_NAME'] = query;
      filter['%PHONE'] = query;
    }

    const response = await this.callAPI('crm.contact.list', {
      filter,
      order: { DATE_CREATE: 'DESC' },
      select: ['ID', 'NAME', 'LAST_NAME', 'PHONE', 'EMAIL', 'COMPANY_ID'],
      start: 0
    });

    const contacts: Bitrix24Contact[] = response.result || [];

    return contacts.slice(0, 10).map(c => this.mapContactToUnified(c));
  }

  async getClientById(id: string): Promise<UnifiedClient | null> {
    try {
      const response = await this.callAPI('crm.contact.get', { id });

      if (!response.result) {
        return null;
      }

      return this.mapContactToUnified(response.result);
    } catch (error) {
      console.error('[Bitrix24Adapter] getClientById error:', error);
      return null;
    }
  }

  // ========== СПРАВОЧНИКИ ==========

  async getStages(): Promise<UnifiedStage[]> {
    // Проверяем кэш
    if (this.stagesCache && Date.now() - this.stagesCacheTime < this.cacheExpiry) {
      return this.stagesCache;
    }

    try {
      // Получаем этапы для категории 0 (общая воронка)
      const response = await this.callAPI('crm.dealcategory.stage.list', {
        id: 0 // Общая воронка
      });

      const stages: Bitrix24Stage[] = response.result || [];

      this.stagesCache = stages.map((s, index) => ({
        id: s.STATUS_ID,
        name: s.NAME,
        order: parseInt(s.SORT) || index,
        color: this.getStageColor(s.SEMANTICS)
      }));

      this.stagesCacheTime = Date.now();
      return this.stagesCache;
    } catch (error) {
      console.error('[Bitrix24Adapter] getStages error:', error);
      return [];
    }
  }

  async getManagers(): Promise<UnifiedManager[]> {
    // Проверяем кэш
    if (this.managersCache && Date.now() - this.managersCacheTime < this.cacheExpiry) {
      return this.managersCache;
    }

    try {
      const response = await this.callAPI('user.get', {
        filter: { ACTIVE: true },
        select: ['ID', 'NAME', 'LAST_NAME', 'EMAIL']
      });

      const users: Bitrix24User[] = response.result || [];

      this.managersCache = users.slice(0, 50).map(u => ({
        id: u.ID,
        name: `${u.NAME || ''} ${u.LAST_NAME || ''}`.trim() || 'Unknown',
        email: u.EMAIL || undefined
      }));

      this.managersCacheTime = Date.now();
      return this.managersCache;
    } catch (error) {
      console.error('[Bitrix24Adapter] getManagers error:', error);
      return [];
    }
  }

  // ========== ПРОДУКТЫ ==========

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    const filter: Record<string, any> = {};

    if (query && query.trim()) {
      filter['%NAME'] = query;
    }

    try {
      const response = await this.callAPI('crm.product.list', {
        filter,
        order: { NAME: 'ASC' },
        select: ['ID', 'NAME', 'PRICE', 'CURRENCY_ID', 'MEASURE'],
        start: 0
      });

      const products: Bitrix24Product[] = response.result || [];

      return products.slice(0, 10).map(p => ({
        id: p.ID,
        name: p.NAME,
        price: p.PRICE ? parseFloat(p.PRICE) : undefined,
        unit: p.MEASURE || undefined
      }));
    } catch (error) {
      console.error('[Bitrix24Adapter] searchProducts error:', error);
      return [];
    }
  }

  async getProductById(id: string): Promise<UnifiedProduct | null> {
    try {
      const response = await this.callAPI('crm.product.get', { id });

      if (!response.result) {
        return null;
      }

      const p = response.result;
      return {
        id: p.ID,
        name: p.NAME,
        price: p.PRICE ? parseFloat(p.PRICE) : undefined,
        unit: p.MEASURE || undefined
      };
    } catch (error) {
      console.error('[Bitrix24Adapter] getProductById error:', error);
      return null;
    }
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private async mapDealToUnified(deal: Bitrix24Deal): Promise<UnifiedDeal> {
    // Получаем имя этапа
    let stageName = deal.STAGE_ID;
    const stages = await this.getStages();
    const stageInfo = stages.find(s => s.id === deal.STAGE_ID);
    if (stageInfo) {
      stageName = stageInfo.name;
    }

    // Получаем имя менеджера
    let managerName: string | undefined;
    if (deal.ASSIGNED_BY_ID) {
      const managers = await this.getManagers();
      const manager = managers.find(m => m.id === deal.ASSIGNED_BY_ID);
      if (manager) {
        managerName = manager.name;
      }
    }

    // Получаем данные контакта если есть
    let clientName = deal.TITLE || '';
    let clientPhone: string | undefined;
    let clientEmail: string | undefined;

    if (deal.CONTACT_ID) {
      const contact = await this.getClientById(deal.CONTACT_ID);
      if (contact) {
        clientName = contact.name || deal.TITLE;
        clientPhone = contact.phone;
        clientEmail = contact.email;
      }
    }

    return {
      id: deal.ID,
      orderNumber: deal.ID, // В Bitrix24 ID = номер сделки
      clientName,
      clientPhone,
      clientEmail,
      company: undefined, // Можно получить через COMPANY_ID если нужно
      amount: deal.OPPORTUNITY ? parseFloat(deal.OPPORTUNITY) : undefined,
      stage: deal.STAGE_ID,
      stageName,
      managerId: deal.ASSIGNED_BY_ID || undefined,
      managerName,
      deadline: deal.CLOSEDATE ? new Date(deal.CLOSEDATE) : undefined,
      notes: deal.COMMENTS || undefined,
      createdAt: new Date(deal.DATE_CREATE),
      updatedAt: deal.DATE_MODIFY ? new Date(deal.DATE_MODIFY) : undefined,
      _raw: deal
    };
  }

  private mapContactToUnified(contact: Bitrix24Contact): UnifiedClient {
    const name = `${contact.NAME || ''} ${contact.LAST_NAME || ''}`.trim() || 'Unknown';

    // Получаем первый телефон и email
    const phone = contact.PHONE && contact.PHONE.length > 0
      ? contact.PHONE[0].VALUE
      : undefined;
    const email = contact.EMAIL && contact.EMAIL.length > 0
      ? contact.EMAIL[0].VALUE
      : undefined;

    return {
      id: contact.ID,
      name,
      phone,
      email,
      company: undefined // Можно получить через COMPANY_ID
    };
  }

  private getStageColor(semantics: string): string | undefined {
    // Bitrix24 использует семантику для этапов:
    // P - process (в работе)
    // S - success (успех)
    // F - fail (провал)
    switch (semantics) {
      case 'P': return '#3b82f6'; // blue
      case 'S': return '#22c55e'; // green
      case 'F': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  }
}
