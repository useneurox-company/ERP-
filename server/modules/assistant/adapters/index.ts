/**
 * ChatCRM - Адаптеры CRM
 * Фабрика для создания адаптеров различных CRM систем
 *
 * Поддерживаемые CRM:
 * - local: Локальная база данных (ERP)
 * - bitrix24: Bitrix24 CRM
 * - amocrm: AmoCRM
 * - megaplan: Мегаплан
 * - retailcrm: RetailCRM
 * - yclients: YClients (для услуг)
 * - saby: Saby (СБИС)
 * - hubspot: HubSpot
 */

import { CRMAdapter } from './types';
import { LocalDBAdapter } from './local-db.adapter';
import { Bitrix24Adapter } from './bitrix24.adapter';
import { AmoCRMAdapter } from './amocrm.adapter';
import { MegaplanAdapter } from './megaplan.adapter';
import { RetailCRMAdapter } from './retailcrm.adapter';
import { YClientsAdapter } from './yclients.adapter';
import { SabyAdapter } from './saby.adapter';
import { HubSpotAdapter } from './hubspot.adapter';

export type AdapterType =
  | 'local'
  | 'bitrix24'
  | 'amocrm'
  | 'megaplan'
  | 'retailcrm'
  | 'yclients'
  | 'saby'
  | 'hubspot';

// Singleton для текущего адаптера
let currentAdapter: CRMAdapter | null = null;

/**
 * Получить текущий адаптер CRM
 * Создаёт адаптер при первом вызове на основе CRM_TYPE из .env
 */
export function getAdapter(): CRMAdapter {
  if (!currentAdapter) {
    const type = (process.env.CRM_TYPE || 'local') as AdapterType;
    currentAdapter = createAdapter(type);
    console.log(`[CRM Adapter] Initialized: ${currentAdapter.getName()}`);
  }
  return currentAdapter;
}

/**
 * Создать адаптер по типу
 */
export function createAdapter(type: AdapterType): CRMAdapter {
  switch (type) {
    case 'local':
      return new LocalDBAdapter();

    case 'bitrix24':
      if (!process.env.BITRIX24_DOMAIN || !process.env.BITRIX24_WEBHOOK_TOKEN) {
        console.warn('[CRM Adapter] Bitrix24 credentials not configured, falling back to local');
        return new LocalDBAdapter();
      }
      return new Bitrix24Adapter({
        domain: process.env.BITRIX24_DOMAIN,
        userId: process.env.BITRIX24_USER_ID || '1',
        webhookToken: process.env.BITRIX24_WEBHOOK_TOKEN,
      });

    case 'amocrm':
      if (!process.env.AMOCRM_SUBDOMAIN || !process.env.AMOCRM_ACCESS_TOKEN) {
        console.warn('[CRM Adapter] AmoCRM credentials not configured, falling back to local');
        return new LocalDBAdapter();
      }
      return new AmoCRMAdapter({
        subdomain: process.env.AMOCRM_SUBDOMAIN,
        accessToken: process.env.AMOCRM_ACCESS_TOKEN,
        refreshToken: process.env.AMOCRM_REFRESH_TOKEN,
      });

    case 'megaplan':
      if (!process.env.MEGAPLAN_DOMAIN || !process.env.MEGAPLAN_ACCESS_TOKEN) {
        console.warn('[CRM Adapter] Megaplan credentials not configured, falling back to local');
        return new LocalDBAdapter();
      }
      return new MegaplanAdapter({
        domain: process.env.MEGAPLAN_DOMAIN,
        accessToken: process.env.MEGAPLAN_ACCESS_TOKEN,
      });

    case 'retailcrm':
      if (!process.env.RETAILCRM_URL || !process.env.RETAILCRM_API_KEY) {
        console.warn('[CRM Adapter] RetailCRM credentials not configured, falling back to local');
        return new LocalDBAdapter();
      }
      return new RetailCRMAdapter({
        url: process.env.RETAILCRM_URL,
        apiKey: process.env.RETAILCRM_API_KEY,
      });

    case 'yclients':
      if (!process.env.YCLIENTS_TOKEN || !process.env.YCLIENTS_COMPANY_ID) {
        console.warn('[CRM Adapter] YClients credentials not configured, falling back to local');
        return new LocalDBAdapter();
      }
      return new YClientsAdapter({
        token: process.env.YCLIENTS_TOKEN,
        companyId: process.env.YCLIENTS_COMPANY_ID,
      });

    case 'saby':
      if (!process.env.SABY_URL || !process.env.SABY_LOGIN || !process.env.SABY_PASSWORD) {
        console.warn('[CRM Adapter] Saby credentials not configured, falling back to local');
        return new LocalDBAdapter();
      }
      return new SabyAdapter({
        url: process.env.SABY_URL,
        login: process.env.SABY_LOGIN,
        password: process.env.SABY_PASSWORD,
        appClientId: process.env.SABY_APP_CLIENT_ID,
      });

    case 'hubspot':
      if (!process.env.HUBSPOT_ACCESS_TOKEN) {
        console.warn('[CRM Adapter] HubSpot credentials not configured, falling back to local');
        return new LocalDBAdapter();
      }
      return new HubSpotAdapter({
        accessToken: process.env.HUBSPOT_ACCESS_TOKEN,
      });

    default:
      console.warn(`[CRM Adapter] Unknown type "${type}", falling back to local`);
      return new LocalDBAdapter();
  }
}

/**
 * Получить информацию о доступных адаптерах
 */
export function getAvailableAdapters(): Array<{
  type: AdapterType;
  name: string;
  configured: boolean;
  description: string;
}> {
  return [
    {
      type: 'local',
      name: 'Local DB',
      configured: true,
      description: 'Локальная PostgreSQL база данных (ERP)'
    },
    {
      type: 'bitrix24',
      name: 'Bitrix24',
      configured: !!(process.env.BITRIX24_DOMAIN && process.env.BITRIX24_WEBHOOK_TOKEN),
      description: 'Bitrix24 CRM (через Webhook API)'
    },
    {
      type: 'amocrm',
      name: 'AmoCRM',
      configured: !!(process.env.AMOCRM_SUBDOMAIN && process.env.AMOCRM_ACCESS_TOKEN),
      description: 'AmoCRM (через OAuth API)'
    },
    {
      type: 'megaplan',
      name: 'Мегаплан',
      configured: !!(process.env.MEGAPLAN_DOMAIN && process.env.MEGAPLAN_ACCESS_TOKEN),
      description: 'Мегаплан CRM (через REST API v3)'
    },
    {
      type: 'retailcrm',
      name: 'RetailCRM',
      configured: !!(process.env.RETAILCRM_URL && process.env.RETAILCRM_API_KEY),
      description: 'RetailCRM для e-commerce'
    },
    {
      type: 'yclients',
      name: 'YClients',
      configured: !!(process.env.YCLIENTS_TOKEN && process.env.YCLIENTS_COMPANY_ID),
      description: 'YClients для сферы услуг'
    },
    {
      type: 'saby',
      name: 'Saby (СБИС)',
      configured: !!(process.env.SABY_URL && process.env.SABY_LOGIN && process.env.SABY_PASSWORD),
      description: 'Saby CRM (СБИС)'
    },
    {
      type: 'hubspot',
      name: 'HubSpot',
      configured: !!process.env.HUBSPOT_ACCESS_TOKEN,
      description: 'HubSpot CRM (международный)'
    },
  ];
}

/**
 * Установить адаптер вручную (для тестов)
 */
export function setAdapter(adapter: CRMAdapter): void {
  currentAdapter = adapter;
  console.log(`[CRM Adapter] Set manually: ${adapter.getName()}`);
}

/**
 * Сбросить адаптер (для тестов)
 */
export function resetAdapter(): void {
  currentAdapter = null;
}

/**
 * Получить текущий тип адаптера
 */
export function getCurrentAdapterType(): AdapterType {
  return (process.env.CRM_TYPE || 'local') as AdapterType;
}

// Re-export types
export * from './types';
