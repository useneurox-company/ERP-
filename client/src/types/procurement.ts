// Types for Procurement Stage (Снабжение)

export type ProcurementItemStatus = 'not_ordered' | 'ordered' | 'in_transit' | 'received';

export interface ProcurementItem {
  id: string;
  material_name: string;
  quantity: number;
  unit: string; // шт, м, кг, л и т.д.
  status: ProcurementItemStatus;
  supplier?: string;
  order_date?: string;
  expected_delivery?: string;
  actual_delivery?: string;
  cost?: number;
  invoice_url?: string;
  notes?: string;
}

export interface BudgetInfo {
  planned_budget?: number; // Плановый бюджет на материалы
  actual_expenses: number; // Фактические расходы
  remaining: number; // Остаток
  is_over_budget: boolean; // Превышение бюджета
}

export interface ProcurementStageData {
  assignee_id?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  notes?: string;

  // Позиции для закупки
  procurement_items: ProcurementItem[];

  // Бюджет
  budget_info: BudgetInfo;

  // Все материалы получены?
  all_materials_received: boolean;

  // Уведомление отправлено производству
  production_notified: boolean;
  production_notified_at?: string;
}
