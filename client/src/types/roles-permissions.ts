import type { UserRole, StagePermission, ActionAuditLog } from "@shared/schema";

// Предопределенные роли в системе
export type ProjectRole =
  | 'project_manager'    // Руководитель проекта - полный доступ
  | 'measurer'           // Замерщик - доступ к этапу Замер
  | 'constructor'        // Конструктор - доступ к этапам ТЗ и КД
  | 'procurement'        // Снабженец - доступ к этапу Снабжение
  | 'production'         // Производство - доступ к этапу Производство
  | 'installer'          // Монтажник - доступ к этапу Монтаж
  | 'client';            // Клиент - просмотр проекта, согласование

// Действия, которые можно выполнять с этапами
export type PermissionAction = 'read' | 'write' | 'delete' | 'start' | 'complete';

// Информация о роли с описанием
export interface RoleInfo {
  role: ProjectRole;
  name: string;
  description: string;
  icon?: string;
  color?: string;
}

// Роли с описаниями для UI
export const ROLE_DEFINITIONS: Record<ProjectRole, RoleInfo> = {
  project_manager: {
    role: 'project_manager',
    name: 'Руководитель проекта',
    description: 'Полный доступ ко всем этапам и действиям проекта',
    icon: '👔',
    color: 'blue',
  },
  measurer: {
    role: 'measurer',
    name: 'Замерщик',
    description: 'Выполняет замеры на объекте и загружает данные',
    icon: '📏',
    color: 'green',
  },
  constructor: {
    role: 'constructor',
    name: 'Конструктор',
    description: 'Создает техническое задание и конструкторскую документацию',
    icon: '📐',
    color: 'purple',
  },
  procurement: {
    role: 'procurement',
    name: 'Снабженец',
    description: 'Закупает материалы и комплектующие',
    icon: '📦',
    color: 'orange',
  },
  production: {
    role: 'production',
    name: 'Производство',
    description: 'Выполняет производственные задачи и изготовление',
    icon: '🔧',
    color: 'red',
  },
  installer: {
    role: 'installer',
    name: 'Монтажник',
    description: 'Выполняет монтаж на объекте',
    icon: '🛠️',
    color: 'cyan',
  },
  client: {
    role: 'client',
    name: 'Клиент',
    description: 'Просматривает проект и согласовывает документы',
    icon: '👤',
    color: 'gray',
  },
};

// Матрица разрешений по умолчанию: role × stage_type_code
export interface DefaultPermissionMatrix {
  [role: string]: {
    [stageTypeCode: string]: {
      can_read: boolean;
      can_write: boolean;
      can_delete: boolean;
      can_start: boolean;
      can_complete: boolean;
    };
  };
}

// Дефолтная матрица разрешений
export const DEFAULT_PERMISSIONS: DefaultPermissionMatrix = {
  project_manager: {
    // Руководитель проекта - полный доступ ко всем этапам
    measurement: { can_read: true, can_write: true, can_delete: true, can_start: true, can_complete: true },
    tz: { can_read: true, can_write: true, can_delete: true, can_start: true, can_complete: true },
    kd: { can_read: true, can_write: true, can_delete: true, can_start: true, can_complete: true },
    approval: { can_read: true, can_write: true, can_delete: true, can_start: true, can_complete: true },
    procurement: { can_read: true, can_write: true, can_delete: true, can_start: true, can_complete: true },
    production: { can_read: true, can_write: true, can_delete: true, can_start: true, can_complete: true },
    installation: { can_read: true, can_write: true, can_delete: true, can_start: true, can_complete: true },
  },
  measurer: {
    // Замерщик - полный доступ только к этапу Замер
    measurement: { can_read: true, can_write: true, can_delete: false, can_start: true, can_complete: true },
    tz: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    kd: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    approval: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    procurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    production: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    installation: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
  },
  constructor: {
    // Конструктор - полный доступ к ТЗ и КД
    measurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    tz: { can_read: true, can_write: true, can_delete: false, can_start: true, can_complete: true },
    kd: { can_read: true, can_write: true, can_delete: false, can_start: true, can_complete: true },
    approval: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    procurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    production: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    installation: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
  },
  procurement: {
    // Снабженец - полный доступ к этапу Снабжение
    measurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    tz: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    kd: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    approval: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    procurement: { can_read: true, can_write: true, can_delete: false, can_start: true, can_complete: true },
    production: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    installation: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
  },
  production: {
    // Производство - полный доступ к этапу Производство
    measurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    tz: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    kd: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    approval: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    procurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    production: { can_read: true, can_write: true, can_delete: false, can_start: true, can_complete: true },
    installation: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
  },
  installer: {
    // Монтажник - полный доступ к этапу Монтаж
    measurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    tz: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    kd: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    approval: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    procurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    production: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    installation: { can_read: true, can_write: true, can_delete: false, can_start: true, can_complete: true },
  },
  client: {
    // Клиент - только чтение, плюс согласование документов
    measurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    tz: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    kd: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    approval: { can_read: true, can_write: true, can_delete: false, can_start: false, can_complete: false }, // может согласовывать
    procurement: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    production: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
    installation: { can_read: true, can_write: false, can_delete: false, can_start: false, can_complete: false },
  },
};

// Интерфейс для назначения роли пользователю
export interface UserRoleAssignment {
  userId: string;
  userName: string;
  role: ProjectRole;
  projectId?: string; // undefined = глобальная роль
  projectName?: string;
  assignedAt: string;
}

// Проверка прав доступа
export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string; // причина отказа
}

// Контекст проверки прав
export interface PermissionContext {
  userId: string;
  stageId?: string;
  stageTypeCode?: string;
  projectId?: string;
  action: PermissionAction;
}

// Результат аудита действия
export interface AuditLogEntry {
  id: string;
  userId: string;
  userName?: string;
  action: PermissionAction;
  entityType: string;
  entityId: string;
  success: boolean;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Статистика по правам пользователя
export interface UserPermissionStats {
  userId: string;
  userName: string;
  roles: UserRoleAssignment[];
  totalActions: number;
  successfulActions: number;
  deniedActions: number;
  lastActivity?: string;
}

// Фильтры для логов аудита
export interface AuditLogFilters {
  userId?: string;
  action?: PermissionAction;
  entityType?: string;
  success?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

// Хелпер для получения информации о роли
export function getRoleInfo(role: ProjectRole): RoleInfo {
  return ROLE_DEFINITIONS[role];
}

// Хелпер для получения всех ролей
export function getAllRoles(): RoleInfo[] {
  return Object.values(ROLE_DEFINITIONS);
}

// Хелпер для получения цвета роли
export function getRoleColor(role: ProjectRole): string {
  return ROLE_DEFINITIONS[role].color || 'gray';
}

// Хелпер для получения иконки роли
export function getRoleIcon(role: ProjectRole): string {
  return ROLE_DEFINITIONS[role].icon || '👤';
}

// Хелпер для форматирования действия
export function formatAction(action: PermissionAction): string {
  const actionNames: Record<PermissionAction, string> = {
    read: 'Просмотр',
    write: 'Редактирование',
    delete: 'Удаление',
    start: 'Запуск',
    complete: 'Завершение',
  };
  return actionNames[action];
}
