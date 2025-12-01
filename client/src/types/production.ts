// Типы соответствуют существующей схеме БД production_tasks
export type ProductionTaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

// Интерфейс соответствует существующей таблице production_tasks
export interface ProductionTaskInfo {
  id: string;
  project_id: string;
  item_name: string; // Название изделия
  worker_id?: string;
  worker_name?: string;
  payment?: number;
  deadline?: string;
  progress: number; // 0-100
  qr_code?: string;
  status: ProductionTaskStatus;
  created_at?: string;
  updated_at?: string;
}

// Подэтапы производства (соответствует production_stages)
export interface ProductionSubStage {
  id: string;
  task_id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  order: number;
}

// Материал выделенный для производства (из этапа Снабжение)
export interface AllocatedMaterial {
  id: string;
  material_name: string;
  quantity: number;
  unit: string;
  procurement_item_id?: string; // Связь с этапом Снабжение
  allocated_date?: string;
}

// Фото с производства
export interface ProductionPhoto {
  id: string;
  url: string;
  description?: string;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string;
}

// Деталь из спецификации на распил (из КД)
export interface CuttingSpecItem {
  id: string;
  part_name: string; // Название детали
  material: string; // Материал
  dimensions: string; // Размеры (например "600x400x18")
  quantity: number;
  edge_banding?: string; // Кромка
  completed: boolean; // Отметка о выполнении
  notes?: string;
}

// Контроль качества
export interface QualityCheck {
  id: string;
  check_date: string;
  checked_by: string;
  checked_by_name: string;
  status: 'passed' | 'failed' | 'pending';
  notes?: string;
  issues?: string[];
}

// Данные этапа Производство
export interface ProductionStageData {
  // Базовые поля (совместимость с BasicStageForm)
  assignee_id?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  notes?: string;

  // Связанные производственные задачи
  // (хранятся в БД production_tasks, здесь только ID для связи)
  linked_task_ids: string[];

  // Спецификация на распил (импортируется из этапа КД)
  cutting_specification: CuttingSpecItem[];
  specification_imported: boolean;
  specification_progress: number; // 0-100%

  // Материалы (связь с этапом Снабжение)
  allocated_materials: AllocatedMaterial[];
  materials_allocated: boolean;

  // Фотодокументация
  production_photos: ProductionPhoto[];

  // Контроль качества
  quality_checks: QualityCheck[];
  quality_approved: boolean;

  // Общий прогресс
  overall_progress: number; // 0-100%
  actual_start_date?: string;
  actual_completion_date?: string;

  // Готовность к монтажу
  production_completed: boolean;
  ready_for_installation: boolean;
  installation_notified: boolean;
  installation_notified_at?: string;

  // Дополнительная информация
  workshop_location?: string;
  special_requirements?: string;
  estimated_completion_date?: string;
}
