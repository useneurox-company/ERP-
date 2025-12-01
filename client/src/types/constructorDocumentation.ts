// Constructor Documentation (Разработка КД) Stage Types

/**
 * Ссылка на документ в Базис Viewer
 */
export interface BasisViewerLink {
  id: string;
  url: string;
  title?: string;
  description?: string;
  addedAt: string;
  addedBy: string;
  addedByName: string;
}

/**
 * Документ из предыдущего этапа (для отображения)
 */
export interface ReferencedDocument {
  id: string;
  fileName: string;
  filePath: string;
  mediaType: 'image' | 'video' | 'document' | 'other';
  uploadedAt: string;
  uploadedBy: string;
  uploadedByName: string;
  stageId: string;
  stageName: string; // "Замер" или "Техническое задание"
  stageType: string; // "measurement" или "technical_specification"
}

/**
 * История изменений этапа КД
 */
export interface CDHistoryEntry {
  timestamp: string;
  action: string;
  userId: string;
  userName: string;
  details?: string;
}

/**
 * Недавно добавленные элементы (для подсветки)
 */
export interface RecentlyAddedCD {
  basisLinks: string[]; // IDs of recently added basis links
  documents: string[]; // IDs of recently added documents
}

/**
 * Запись о переоткрытии этапа
 */
export interface CDReopenHistoryEntry {
  reopenedAt: string;
  reopenedBy: string;
  reopenedByName: string;
  reason?: string;
}

/**
 * Позиция спецификации на фурнитуру
 */
export interface HardwareSpecItem {
  id: string;
  name: string;            // Название
  article: string;         // Артикул
  quantity: number;        // Количество
  unit: string;            // Единица измерения (шт, м, кг и т.д.)
  warehouseAvailable?: number; // Доступно на складе (после сравнения)
  warehouseItemId?: string;    // ID позиции на складе (если найдено)
  needsToProcure?: boolean;    // Нужно закупить?
  alternativeUsed?: boolean;   // Использован аналог?
  alternativeItemId?: string;  // ID аналога со склада
  notes?: string;              // Примечания
  addedAt: string;
  addedBy: string;
  addedByName: string;
}

/**
 * Позиция спецификации на распил
 */
export interface CuttingSpecItem {
  id: string;
  partName: string;        // Название детали
  dimensions: string;      // Размеры (например "2000x600x18")
  material: string;        // Материал (ЛДСП, МДФ и т.д.)
  quantity: number;        // Количество
  edgeBanding?: string;    // Кромкование (например "0-0-2-2")
  notes?: string;          // Примечания
  addedAt: string;
  addedBy: string;
  addedByName: string;
}

/**
 * Результат сравнения со складом
 */
export interface WarehouseComparisonResult {
  comparedAt?: string;
  comparedBy?: string;
  comparedByName?: string;
  totalItems: number;
  foundInWarehouse: number;
  needsToProcure: number;
  alternativesUsed: number;
}

/**
 * Основная структура данных для этапа "Разработка КД"
 */
export interface ConstructorDocumentationData {
  // Ссылки на Базис Viewer (добавляет конструктор)
  basisViewerLinks: BasisViewerLink[];

  // Документы из предыдущих этапов (только для отображения, read-only)
  referencedDocuments: ReferencedDocument[];

  // Спецификация на фурнитуру
  hardwareSpec: HardwareSpecItem[];

  // Спецификация на распил
  cuttingSpec: CuttingSpecItem[];

  // Результат сравнения со складом
  warehouseComparison?: WarehouseComparisonResult;

  // Плановые даты (редактируемые конструктором)
  plannedStartDate?: string;
  plannedEndDate?: string;

  // История изменений
  history: CDHistoryEntry[];

  // Недавно добавленные элементы
  recentlyAdded: RecentlyAddedCD;

  // История переоткрытий
  reopenHistory: CDReopenHistoryEntry[];
}

/**
 * Вспомогательная функция для инициализации пустых данных КД
 */
export function getInitialConstructorDocumentationData(): ConstructorDocumentationData {
  return {
    basisViewerLinks: [],
    referencedDocuments: [],
    hardwareSpec: [],
    cuttingSpec: [],
    history: [],
    recentlyAdded: { basisLinks: [], documents: [] },
    reopenHistory: []
  };
}
