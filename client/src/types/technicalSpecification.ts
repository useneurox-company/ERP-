/**
 * Type definitions for Technical Specification (TZ) Stage
 * Linked to project positions via project_stages.item_id
 */

export interface OriginalPosition {
  /** ID of the project item this TZ is based on */
  itemId: string;
  /** Position name from project_items */
  name: string;
  /** Article/SKU from project_items */
  article?: string;
  /** Base price per unit */
  price: number;
  /** Quantity */
  quantity: number;
  /** Unit of measurement (шт, м², м.п., м, кг, л, уп) */
  unit: string;
  /** Total = price * quantity */
  total: number;
  /** Optional image URL */
  imageUrl?: string;
}

export interface TechSpecAddon {
  /** Unique identifier */
  id: string;
  /** Addon name/title */
  name: string;
  /** Detailed description */
  description?: string;
  /** Price change (can be negative for deductions) */
  priceChange: number;
  /** Quantity */
  quantity: number;
  /** Unit of measurement */
  unit: string;
  /** Total impact = priceChange * quantity */
  total: number;
  /** Optional category for grouping */
  category?: string;
  /** When this addon was added */
  addedAt: string;
  /** User ID who added this */
  addedBy: string;
  /** User full name for display */
  addedByName: string;
  /** Optional image URL */
  imageUrl?: string;
}

export interface TechSpecFile {
  /** Original filename */
  fileName: string;
  /** Server path to file */
  filePath: string;
  /** File size in bytes */
  fileSize: number;
  /** Upload timestamp */
  uploadedAt: string;
  /** User ID who uploaded */
  uploadedBy: string;
  /** User full name for display */
  uploadedByName: string;
  /** MIME type */
  mimeType?: string;
}

export type HistoryAction =
  | 'addon_added'
  | 'addon_removed'
  | 'addon_modified'
  | 'file_uploaded'
  | 'file_removed'
  | 'stage_reopened'
  | 'drive_link_updated';

export interface HistoryChange {
  /** Field that changed */
  field: string;
  /** Previous value */
  oldValue: any;
  /** New value */
  newValue: any;
}

export interface TechSpecHistoryEntry {
  /** Timestamp of the action */
  timestamp: string;
  /** User ID who performed action */
  userId: string;
  /** User full name */
  userName: string;
  /** Type of action */
  action: HistoryAction;
  /** List of changes made */
  changes: HistoryChange[];
  /** Optional reason/comment */
  reason?: string;
}

export interface ReopenHistoryEntry {
  /** When the stage was reopened */
  reopenedAt: string;
  /** User ID who reopened */
  reopenedBy: string;
  /** User full name */
  reopenedByName: string;
  /** Optional reason for reopening */
  reason?: string;
}

export interface GeneratedDocument {
  /** When document was generated */
  generatedAt: string;
  /** User ID who generated */
  generatedBy: string;
  /** User full name */
  generatedByName: string;
  /** Document ID (quote/invoice) */
  documentId: string;
  /** Original position total */
  originalTotal: number;
  /** Sum of all addons */
  addonsTotal: number;
  /** Final total (original + addons) */
  finalTotal: number;
  /** Document type */
  documentType: 'quote' | 'invoice';
}

export interface RecentlyAdded {
  /** Addon IDs added in last 24 hours */
  addons: string[];
  /** File paths uploaded in last 24 hours */
  files: string[];
}

/**
 * Main data structure stored in project_stages.type_data
 * for technical_specification stage type
 */
export interface TechnicalSpecificationData {
  /** ID of the project item this TZ is linked to */
  projectItemId: string;

  /** Cached original position data (read-only) */
  originalPosition: OriginalPosition;

  /** Google Drive link for external files */
  googleDriveUrl?: string;

  /** Attached TZ file (PDF/Word/Excel) */
  attachedFile?: TechSpecFile;

  /** List of price additions/deductions */
  addons: TechSpecAddon[];

  /** Audit trail of all changes */
  history: TechSpecHistoryEntry[];

  /** Information about generated final document */
  finalDocumentGenerated?: GeneratedDocument;

  /** Recently added items for highlighting (last 24h) */
  recentlyAdded: RecentlyAdded;

  /** History of stage reopenings */
  reopenHistory: ReopenHistoryEntry[];
}

/**
 * Utility type for creating new addons
 */
export type NewTechSpecAddon = Omit<TechSpecAddon, 'id' | 'addedAt' | 'addedBy' | 'addedByName' | 'total'>;

/**
 * Props for TechnicalSpecificationStageForm component
 */
export interface TechnicalSpecificationStageFormProps {
  /** Current stage data */
  stage?: any; // ProjectStage type
  /** Callback when data changes */
  onDataChange?: (data: TechnicalSpecificationData) => void;
  /** Read-only mode (e.g., when stage is completed) */
  readOnly?: boolean;
}

/**
 * Calculate total impact of all addons
 */
export function calculateAddonsTotal(addons: TechSpecAddon[]): number {
  return addons.reduce((sum, addon) => sum + addon.total, 0);
}

/**
 * Calculate final total (original + addons)
 */
export function calculateFinalTotal(data: TechnicalSpecificationData): number {
  return data.originalPosition.total + calculateAddonsTotal(data.addons);
}

/**
 * Check if an addon was recently added (within 24 hours)
 */
export function isRecentlyAdded(addonId: string, recentlyAdded: RecentlyAdded): boolean {
  return recentlyAdded.addons.includes(addonId);
}

/**
 * Check if a file was recently uploaded (within 24 hours)
 */
export function isFileRecentlyAdded(filePath: string, recentlyAdded: RecentlyAdded): boolean {
  return recentlyAdded.files.includes(filePath);
}

/**
 * Update recently added items by removing entries older than 24 hours
 */
export function updateRecentlyAdded(
  currentRecentlyAdded: RecentlyAdded,
  addons: TechSpecAddon[],
  files: TechSpecFile[]
): RecentlyAdded {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  return {
    addons: currentRecentlyAdded.addons.filter(id => {
      const addon = addons.find(a => a.id === id);
      return addon && addon.addedAt > twentyFourHoursAgo;
    }),
    files: currentRecentlyAdded.files.filter(path => {
      const file = files.find(f => f.filePath === path);
      return file && file.uploadedAt > twentyFourHoursAgo;
    })
  };
}
