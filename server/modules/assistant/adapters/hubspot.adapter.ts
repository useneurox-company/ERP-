/**
 * ChatCRM - HubSpot Adapter
 * Адаптер для работы с HubSpot CRM через REST API
 *
 * Настройка в .env:
 * HUBSPOT_ACCESS_TOKEN=xxxxx (Private App Token)
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

interface HubSpotConfig {
  accessToken: string; // Private App Token
}

interface HubSpotDeal {
  id: string;
  properties: {
    dealname: string;
    amount?: string;
    dealstage: string;
    hubspot_owner_id?: string;
    closedate?: string;
    createdate: string;
    hs_lastmodifieddate?: string;
    notes_last_updated?: string;
    description?: string;
  };
  associations?: {
    contacts?: { results: Array<{ id: string }> };
    companies?: { results: Array<{ id: string }> };
  };
}

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
}

interface HubSpotOwner {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

interface HubSpotPipeline {
  id: string;
  label: string;
  stages: Array<{
    id: string;
    label: string;
    displayOrder: number;
  }>;
}

interface HubSpotProduct {
  id: string;
  properties: {
    name: string;
    price?: string;
    hs_sku?: string;
    description?: string;
  };
}

export class HubSpotAdapter implements CRMAdapter {
  private config: HubSpotConfig;
  private baseUrl = 'https://api.hubapi.com';
  private PAGE_SIZE = 5;

  private stagesCache: UnifiedStage[] | null = null;
  private managersCache: UnifiedManager[] | null = null;
  private cacheExpiry = 5 * 60 * 1000;
  private stagesCacheTime = 0;
  private managersCacheTime = 0;

  constructor(config: HubSpotConfig) {
    this.config = config;
  }

  getName(): string {
    return 'HubSpot';
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callAPI('/crm/v3/objects/deals', { params: { limit: 1 } });
      return 'results' in response;
    } catch (error) {
      console.error('[HubSpotAdapter] Connection test failed:', error);
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
        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
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
      const error = await response.text();
      throw new Error(`HubSpot API error: ${response.status} - ${error}`);
    }

    return await response.json();
  }

  // ========== СДЕЛКИ ==========

  async searchDeals(query: string, page: number = 0, filters?: SearchFilters): Promise<SearchResult<UnifiedDeal>> {
    let deals: HubSpotDeal[] = [];
    let total = 0;

    if (query && query.trim()) {
      // Используем Search API
      const searchBody: any = {
        query,
        limit: this.PAGE_SIZE,
        after: page * this.PAGE_SIZE,
        properties: ['dealname', 'amount', 'dealstage', 'hubspot_owner_id', 'closedate', 'createdate', 'description'],
      };

      if (filters?.managerId) {
        searchBody.filterGroups = [{
          filters: [{
            propertyName: 'hubspot_owner_id',
            operator: 'EQ',
            value: filters.managerId
          }]
        }];
      }

      const response = await this.callAPI('/crm/v3/objects/deals/search', {
        method: 'POST',
        body: searchBody
      });

      deals = response.results || [];
      total = response.total || deals.length;
    } else {
      // Простой список
      const params: Record<string, any> = {
        limit: this.PAGE_SIZE,
        properties: ['dealname', 'amount', 'dealstage', 'hubspot_owner_id', 'closedate', 'createdate', 'description'],
      };

      if (page > 0) {
        params.after = page * this.PAGE_SIZE;
      }

      const response = await this.callAPI('/crm/v3/objects/deals', { params });
      deals = response.results || [];
      total = response.total || deals.length;
    }

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
      const response = await this.callAPI(`/crm/v3/objects/deals/${id}`, {
        params: {
          properties: ['dealname', 'amount', 'dealstage', 'hubspot_owner_id', 'closedate', 'createdate', 'hs_lastmodifieddate', 'description'],
          associations: ['contacts', 'companies']
        }
      });
      return this.mapDealToUnified(response);
    } catch (error) {
      console.error('[HubSpotAdapter] getDealById error:', error);
      return null;
    }
  }

  async createDeal(data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const properties: Record<string, any> = {
      dealname: data.clientName || 'New Deal',
    };

    if (data.amount) properties.amount = String(data.amount);
    if (data.stage) properties.dealstage = data.stage;
    if (data.managerId) properties.hubspot_owner_id = data.managerId;
    if (data.deadline) {
      properties.closedate = data.deadline instanceof Date
        ? data.deadline.toISOString().split('T')[0]
        : data.deadline;
    }
    if (data.notes) properties.description = data.notes;

    const response = await this.callAPI('/crm/v3/objects/deals', {
      method: 'POST',
      body: { properties }
    });

    return this.mapDealToUnified(response);
  }

  async updateDeal(id: string, data: Partial<UnifiedDeal>): Promise<UnifiedDeal> {
    const properties: Record<string, any> = {};

    if (data.clientName !== undefined) properties.dealname = data.clientName;
    if (data.amount !== undefined) properties.amount = String(data.amount);
    if (data.stage !== undefined) properties.dealstage = data.stage;
    if (data.managerId !== undefined) properties.hubspot_owner_id = data.managerId;
    if (data.deadline !== undefined) {
      properties.closedate = data.deadline instanceof Date
        ? data.deadline.toISOString().split('T')[0]
        : data.deadline;
    }
    if (data.notes !== undefined) properties.description = data.notes;

    const response = await this.callAPI(`/crm/v3/objects/deals/${id}`, {
      method: 'PATCH',
      body: { properties }
    });

    return this.mapDealToUnified(response);
  }

  // ========== КЛИЕНТЫ ==========

  async searchClients(query: string): Promise<UnifiedClient[]> {
    let contacts: HubSpotContact[] = [];

    if (query && query.trim()) {
      const response = await this.callAPI('/crm/v3/objects/contacts/search', {
        method: 'POST',
        body: {
          query,
          limit: 10,
          properties: ['firstname', 'lastname', 'email', 'phone', 'company']
        }
      });
      contacts = response.results || [];
    } else {
      const response = await this.callAPI('/crm/v3/objects/contacts', {
        params: {
          limit: 10,
          properties: ['firstname', 'lastname', 'email', 'phone', 'company']
        }
      });
      contacts = response.results || [];
    }

    return contacts.map(c => this.mapContactToUnified(c));
  }

  async getClientById(id: string): Promise<UnifiedClient | null> {
    try {
      const response = await this.callAPI(`/crm/v3/objects/contacts/${id}`, {
        params: {
          properties: ['firstname', 'lastname', 'email', 'phone', 'company']
        }
      });
      return this.mapContactToUnified(response);
    } catch (error) {
      console.error('[HubSpotAdapter] getClientById error:', error);
      return null;
    }
  }

  // ========== СПРАВОЧНИКИ ==========

  async getStages(): Promise<UnifiedStage[]> {
    if (this.stagesCache && Date.now() - this.stagesCacheTime < this.cacheExpiry) {
      return this.stagesCache;
    }

    try {
      const response = await this.callAPI('/crm/v3/pipelines/deals');
      const pipelines: HubSpotPipeline[] = response.results || [];

      // Берём первый pipeline
      const mainPipeline = pipelines[0];
      if (!mainPipeline) return [];

      this.stagesCache = mainPipeline.stages.map(s => ({
        id: s.id,
        name: s.label,
        order: s.displayOrder
      }));

      this.stagesCacheTime = Date.now();
      return this.stagesCache;
    } catch (error) {
      console.error('[HubSpotAdapter] getStages error:', error);
      return [];
    }
  }

  async getManagers(): Promise<UnifiedManager[]> {
    if (this.managersCache && Date.now() - this.managersCacheTime < this.cacheExpiry) {
      return this.managersCache;
    }

    try {
      const response = await this.callAPI('/crm/v3/owners');
      const owners: HubSpotOwner[] = response.results || [];

      this.managersCache = owners.map(o => ({
        id: o.id,
        name: `${o.firstName || ''} ${o.lastName || ''}`.trim() || o.email,
        email: o.email
      }));

      this.managersCacheTime = Date.now();
      return this.managersCache;
    } catch (error) {
      console.error('[HubSpotAdapter] getManagers error:', error);
      return [];
    }
  }

  // ========== ПРОДУКТЫ ==========

  async searchProducts(query: string): Promise<UnifiedProduct[]> {
    try {
      let products: HubSpotProduct[] = [];

      if (query) {
        const response = await this.callAPI('/crm/v3/objects/products/search', {
          method: 'POST',
          body: {
            query,
            limit: 10,
            properties: ['name', 'price', 'hs_sku', 'description']
          }
        });
        products = response.results || [];
      } else {
        const response = await this.callAPI('/crm/v3/objects/products', {
          params: {
            limit: 10,
            properties: ['name', 'price', 'hs_sku', 'description']
          }
        });
        products = response.results || [];
      }

      return products.map(p => ({
        id: p.id,
        name: p.properties.name,
        sku: p.properties.hs_sku,
        price: p.properties.price ? parseFloat(p.properties.price) : undefined
      }));
    } catch (error) {
      console.error('[HubSpotAdapter] searchProducts error:', error);
      return [];
    }
  }

  async getProductById(id: string): Promise<UnifiedProduct | null> {
    try {
      const response = await this.callAPI(`/crm/v3/objects/products/${id}`, {
        params: {
          properties: ['name', 'price', 'hs_sku', 'description']
        }
      });

      return {
        id: response.id,
        name: response.properties.name,
        sku: response.properties.hs_sku,
        price: response.properties.price ? parseFloat(response.properties.price) : undefined
      };
    } catch (error) {
      console.error('[HubSpotAdapter] getProductById error:', error);
      return null;
    }
  }

  // ========== ПРИВАТНЫЕ МЕТОДЫ ==========

  private async mapDealToUnified(deal: HubSpotDeal): Promise<UnifiedDeal> {
    const props = deal.properties;

    // Получаем имя этапа
    let stageName = props.dealstage;
    const stages = await this.getStages();
    const stageInfo = stages.find(s => s.id === props.dealstage);
    if (stageInfo) {
      stageName = stageInfo.name;
    }

    // Получаем имя менеджера
    let managerName: string | undefined;
    if (props.hubspot_owner_id) {
      const managers = await this.getManagers();
      const manager = managers.find(m => m.id === props.hubspot_owner_id);
      if (manager) {
        managerName = manager.name;
      }
    }

    // Пытаемся получить контакт
    let clientPhone: string | undefined;
    let clientEmail: string | undefined;
    const contactId = deal.associations?.contacts?.results?.[0]?.id;
    if (contactId) {
      const contact = await this.getClientById(contactId);
      if (contact) {
        clientPhone = contact.phone;
        clientEmail = contact.email;
      }
    }

    return {
      id: deal.id,
      orderNumber: deal.id,
      clientName: props.dealname,
      clientPhone,
      clientEmail,
      amount: props.amount ? parseFloat(props.amount) : undefined,
      stage: props.dealstage,
      stageName,
      managerId: props.hubspot_owner_id,
      managerName,
      deadline: props.closedate ? new Date(props.closedate) : undefined,
      notes: props.description,
      createdAt: new Date(props.createdate),
      updatedAt: props.hs_lastmodifieddate ? new Date(props.hs_lastmodifieddate) : undefined,
      _raw: deal
    };
  }

  private mapContactToUnified(contact: HubSpotContact): UnifiedClient {
    const props = contact.properties;
    const name = `${props.firstname || ''} ${props.lastname || ''}`.trim() || props.email || 'Unknown';

    return {
      id: contact.id,
      name,
      phone: props.phone,
      email: props.email,
      company: props.company
    };
  }
}
