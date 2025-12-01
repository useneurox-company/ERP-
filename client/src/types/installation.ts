// Типы соответствуют существующей схеме БД installations
export type InstallationStatus =
  | 'not_started'      // Не начат
  | 'scheduled'        // Запланирован
  | 'in_transit'       // Выезд на объект
  | 'in_progress'      // Монтаж в процессе
  | 'completed'        // Завершен
  | 'accepted';        // Принято клиентом

// Интерфейс соответствует существующей таблице installations
export interface InstallationInfo {
  id: string;
  project_id: string;
  client_name: string;
  address: string;
  installer_id?: string | null;
  installer_name?: string;
  phone?: string | null;
  date?: string | null;
  status: InstallationStatus;
  payment?: number | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

// Отгрузка со склада
export interface ShipmentInfo {
  id: string;
  shipment_date: string;
  received_by: string; // ID монтажника
  received_by_name: string;
  items: ShipmentItem[];
  warehouse_confirmed: boolean;
  warehouse_confirmed_by?: string;
  warehouse_confirmed_at?: string;
}

export interface ShipmentItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  notes?: string;
}

// Фото монтажа
export interface InstallationPhoto {
  id: string;
  type: 'before' | 'during' | 'after';
  url: string;
  description?: string;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
  geolocation?: {
    lat: number;
    lng: number;
  };
}

// Дефект при монтаже
export interface InstallationDefect {
  id: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  photo_urls: string[];
  reported_at: string;
  reported_by: string;
  reported_by_name: string;
  status: 'reported' | 'returned_to_production' | 'fixed' | 'closed';
  resolution?: string;
  resolved_at?: string;
}

// Акт выполненных работ
export interface WorkAcceptanceAct {
  id: string;
  act_number: string;
  act_date: string;
  work_description: string;
  client_acceptance_date?: string;
  client_signature?: string; // URL скана подписи
  client_comments?: string;
  installer_signature?: string;
  total_payment: number;
  status: 'draft' | 'sent_to_client' | 'signed' | 'rejected';
  pdf_url?: string;
}

// Данные этапа Монтаж
export interface InstallationStageData {
  // Базовые поля (совместимость с BasicStageForm)
  assignee_id?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  notes?: string;

  // Связанный монтаж (хранится в БД installations, здесь ID для связи)
  linked_installation_id?: string;

  // Отгрузка со склада
  shipment?: ShipmentInfo;
  shipment_completed: boolean;

  // Статус монтажа (расширенный)
  installation_status: InstallationStatus;
  actual_start_date?: string;
  actual_completion_date?: string;

  // Фотодокументация
  photos: InstallationPhoto[];
  photos_before_count: number;
  photos_after_count: number;

  // Дефекты
  defects: InstallationDefect[];
  has_critical_defects: boolean;

  // Акт выполненных работ
  work_acceptance_act?: WorkAcceptanceAct;
  client_accepted: boolean;
  client_acceptance_date?: string;

  // Геолокация
  installation_location?: {
    lat: number;
    lng: number;
    address: string;
  };

  // Дополнительная информация
  estimated_duration_hours?: number;
  actual_duration_hours?: number;
  installer_feedback?: string;
  client_feedback?: string;
  client_rating?: number; // 1-5
}
