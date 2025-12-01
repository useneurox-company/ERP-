/**
 * ChatCRM - Saby (СБИС) Adapter
 * Адаптер для работы с Saby CRM через REST API
 *
 * Настройка в .env:
 * SABY_URL=https://online.sbis.ru
 * SABY_LOGIN=login
 * SABY_PASSWORD=password
 * SABY_APP_CLIENT_ID=xxxxx (опционально)
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

interface SabyConfig {
  url: string;      // https://online.sbis.ru
  login: string;    // Логин
  password: string; // Пароль
  appClientId?: string; // ID приложения (для OAuth)
}

interface SabyDeal {
  '@Документ': string;
  'Идентификатор': string;
  'Название': string;
  'Сумма': number;
  'Этап': { 'Идентификатор': string; 'Название': string };
  'Ответственный': { 'Идентификатор': string; 'Название': string };
  'Контрагент'?: { 'Идентификатор': string; 'Название': string };
  'ДатаСоздания': string;
  'ДатаИзменения': string;
  'Срок'?: string;
  'Примечание'?: string;
}

interface SabyClient {
  'Идентификатор': string;
  'Название': string;
  'Телефон'?: string;
  'Email'?: string;
  'ИНН'?: string;
}

interface SabyEmployee {
  'Идентификатор': string;
  'ФИО': string;
  'Email'?: string;
  'Должность'?: string;
}

interface SabyStage {
  'Идентификатор': string;
  'Название': string;
  'Порядок': number;
  'Цвет'?: string;
}

export class SabyAdapter implements CRMAdapter {
  private config: SabyConfig;
  private baseUrl: string;
  private sessionId: string | null = null;
  private PAGE_SIZE = 5;

  private stagesCache: UnifiedStage[] | null = null;
  private managersCache: UnifiedManager[] | null = null;
  private cacheExpiry = 5 * 60 * 1000;
  private stagesCacheTime = 0;
  private managersCacheTime = 0;

  constructor(config: SabyConfig) {
    this.config = config;
    this.baseUrl = config.url;
  }

  getName(): string {
    return 'Saby (СБИС)';
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.ensureAuth();
      return !!this.sessionId;
    } catch (error) {
      console.error('[SabyAdapter] Connection test failed:', error);
      return false;
    }
  }

  // ========== АВТОРИЗАЦИЯ ==========

  private async ensureAuth(): Promise<void> {
    if (this.sessionId) return;

    const response = await fetch(`${this.baseUrl}/auth/service/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'СБИС.Аутентифицировать',
        params: {
          'Параметр': {
            'Логин': this.config.login,
            'Пароль': this.config.password,
          }
        },
        id: 1
      })
    });

    const data = await response.json();

    if (data.error) {
      throw new Error(`Saby auth error: ${data.error.message}`);
    }

    this.sessionId = data.result;
  }

  private async callAPI(method: string, params: Record<string, any> = {}): Promise<any> {
    await this.ensureAuth();

    const response = await fetch(`${this.baseUrl}/service/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SBISSessionID': this.sessionId!,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method,
        params,
        id: Date.now()
      })
    });

    const data = await response.json();

    if (data.error) {
      // Если ошибка авторизации - сбрасываем сессию
      if (data.error.code === -32001) {
        this.sessionId = null;
        await this.ensureAuth();
        return this.callAPI(method, params);
      }
      throw new Error(`Saby API error: ${data.error.message}`);
    }

    return data.result;
  }

  // ========== СДЕЛКИ ==========

  async searchDeals(query: string, page: number = 0, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>> {
    const params: Record<string, any> = {
      'Фильтр': {
        'Навигация': {
          'РазмерСтраницы': this.PAGE_SIZE,
          'Страница': page
        }
      }
    };

    if (query && query.trim()) {
      params['Фильтр']['Поиск'] = query;
    }

    if (filters?.managerId) {
      params['Фильтр']['Ответственный'] = filters.managerId;
    }

    if (filters?.stage) {
      params['Фильтр']['Этап'] = filters.stage;
    }

    const response = await this.callAPI('СделкаCRM.Список', params);

    const deals: SabyDeal[] = response?.['Сделка'] || [];
    const total = response?.['Навигация']?.['ВсегоЗаписей'] || deals.length;

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
      const response = await this.callAPI('СделкаCRM.Прочитать', {
        'Идентификатор': id
      });

      if (!response) return null;
      return this.mapDealToUnified(response);
    } catch (error) {
      console.error('[SabyAdapter] getDealById error:', error);
      return null;
    }
  }

  async createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const params: Record<string, any> = {
      'Сделка': {
        'Название': data.clientName || 'Новая сделка',
      }
    };

    if (data.amount) {
      params['Сделка']['Сумма'] = data.amount;
    }

    if (data.stage) {
      params['Сделка']['Этап'] = { 'Идентификатор': data.stage };
    }

    if (data.managerId) {
      params['Сделка']['Ответственный'] = { 'Идентификатор': data.managerId };
    }

    if (data.deadline) {
      params['Сделка']['Срок'] = data.deadline instanceof Date
        ? data.deadline.toISOString()
        : data.deadline;
    }

    if (data.notes) {
      params['Сделка']['Примечание'] = data.notes;
    }

    const response = await this.callAPI('СделкаCRM.Создать', params);

    if (!response?.['Идентификатор']) {
      throw new Error('Failed to create deal in Saby');
    }

    return await this.getDealById(response['Идентификатор']) as UnifiedDeal;
  }

  async updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const params: Record<string, any> = {
      'Сделка': {
        'Идентификатор': id
      }
    };

    if (data.clientName !== undefined) {
      params['Сделка']['Название'] = data.clientName;
    }

    if (data.amount !== undefined) {
      params['Сделка']['Сумма'] = data.amount;
    }

    if (data.stage !== undefined) {
      params['Сделка']['Этап'] = { 'Идентификатор': data.stage };
    }

    if (data.managerId !== undefined) {
      params['Сделка']['Ответственный'] = { 'Идентификатор': data.managerId };
    }

    if (data.deadline !== undefined) {
      params['Сделка']['Срок'] = data.deadline instanceof Date
        ? data.deadline.toISOString()
        : data.deadline;
    }

    if (data.notes !== undefined) {
      params['Сделка']['Примечание'] = data.notes;
    }

    await this.callAPI('СделкаCRM.Записать', params);

    return await this.getDealById(id) as UnifiedDeal;
  }

  // ========== КЛИЕНТЫ (КОНТРАГЕНТЫ) ==========

  async searchClients(query: string): Promise<UnifiedClient[]> {
    const params: Record<string, any> = {
      'Фильтр': {
        'Навигация': {
          'РазмерСтраницы': 10,
          'Страница': 0
        }
      }
    };

    if (query) {
      params['Фильтр']['Поиск'] = query;
    }

    const response = await this.callAPI('Контрагент.Список', params);
    const clients: SabyClient[] = response?.['Контрагент'] || [];

    return clients.map(c => this.mapClientToUnified(c));
  }

  async getClientById(id: string): Promise<UnifiedClient | null> {
    try {
      const response = await this.callAPI('Контрагент.Прочитать', {
        'Идентификатор': id
      });

      if (!response) return null;
      return this.mapClientToUnified(response);
    } catch (error) {
      console.error('[SabyAdapter] getClientById error:', error);
      return null;
    }
  }

  // ========== СПРАВОЧНИКИ ==========

  async getStages(): Promise<UnifiedStage[]> {
    if (this.stagesCache && Date.now() - this.stagesCacheTime < this.cacheExpiry) {
      return this.stagesCache;
    }

    try {
      const response = await this.callAPI('ЭтапСделкиCRM.Список', {
        'Фильтр': {}
      });

      const stages: SabyStage[] = response?.['Этап'] || [];

      this.stagesCache = stages.map(s => ({
        id: s['Идентификатор'],
        name: s['Название'],
        order: s['Порядок'],
        color: s['Цвет']
      }));

      this.stagesCacheTime = Date.now();
      return this.stagesCache;
    } catch (error) {
      console.error('[SabyAdapter] getStages error:', error);
      return [];
    }
  }

  async getManagers(): Promise<UnifiedManager[]> {
    if (this.managersCache && Date.now() - this.managersCacheTime < this.cacheExpiry) {
      return this.managersCache;
    }

    try {
      const response = await this.callAPI('Сотрудник.Список', {
        'Фильтр': {
          'Навигация': {
            'РазмерСтраницы': 50,
            'Страница': 0
          }
        }
      });

      const employees: SabyEmployee[] = response?.['Сотрудник'] || [];

      this.managersCache = employees.map(e => ({
        id: e['Идентификатор'],
        name: e['ФИО'] || 'Unknown',
        email: e['Email']
      }));

      this.managersCacheTime = Date.now();
      return this.managersCache;
    } catch (error) {
      console.error('[SabyAdapter] getManagers error:', error);
      return [];
    }
  }

  // ========== ПРОДУКТЫ ==========

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    try {
      const params: Record<string, any> = {
        'Фильтр': {
          'Навигация': {
            'РазмерСтраницы': 10,
            'Страница': 0
          }
        }
      };

      if (query) {
        params['Фильтр']['Поиск'] = query;
      }

      const response = await this.callAPI('Номенклатура.Список', params);
      const products = response?.['Номенклатура'] || [];

      return products.map((p: any) => ({
        id: p['Идентификатор'],
        name: p['Название'],
        sku: p['Артикул'],
        price: p['Цена'],
        unit: p['ЕдиницаИзмерения']
      }));
    } catch (error) {
      console.error('[SabyAdapter] searchProducts error:', error);
      return [];
    }
  }

  async getProductById(id: string): Promise<UnifiedProduct | null> {
    try {
      const response = await this.callAPI('Номенклатура.Прочитать', {
        'Идентификатор': id
      });

      if (!response) return null;

      return {
        id: response['Идентификатор'],
        name: response['Название'],
        sku: response['Артикул'],
        price: response['Цена'],
        unit: response['ЕдиницаИзмерения']
      };
    } catch (error) {
      console.error('[SabyAdapter] getProductById error:', error);
      return null;
    }
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private async mapDealToUnified(deal: SabyDeal): Promise<UnifiedDeal> {
    return {
      id: deal['Идентификатор'],
      orderNumber: deal['Идентификатор'],
      clientName: deal['Название'],
      clientPhone: undefined,
      clientEmail: undefined,
      company: deal['Контрагент']?.['Название'],
      amount: deal['Сумма'],
      stage: deal['Этап']?.['Идентификатор'] || '',
      stageName: deal['Этап']?.['Название'],
      managerId: deal['Ответственный']?.['Идентификатор'],
      managerName: deal['Ответственный']?.['Название'],
      deadline: deal['Срок'] ? new Date(deal['Срок']) : undefined,
      notes: deal['Примечание'],
      createdAt: new Date(deal['ДатаСоздания']),
      updatedAt: deal['ДатаИзменения'] ? new Date(deal['ДатаИзменения']) : undefined,
      _raw: deal
    };
  }

  private mapClientToUnified(client: SabyClient): UnifiedClient {
    return {
      id: client['Идентификатор'],
      name: client['Название'],
      phone: client['Телефон'],
      email: client['Email'],
      company: client['Название'] // В СБИС контрагент = компания
    };
  }
}
