export type NotificationType =
  | 'deadline_change'
  | 'stage_unblocked'
  | 'new_document'
  | 'comment'
  | 'budget_exceeded'
  | 'deadline_overdue'
  | 'stage_completed'
  | 'stage_started';

export type NotificationEntityType = 'project' | 'stage' | 'document';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  entity_type: NotificationEntityType;
  entity_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;

  // Дополнительные данные для навигации
  project_id?: string;
  stage_id?: string;
  document_id?: string;
}

export interface NotificationSettings {
  deadline_change: boolean;
  stage_unblocked: boolean;
  new_document: boolean;
  comment: boolean;
  budget_exceeded: boolean;
  deadline_overdue: boolean;
  stage_completed: boolean;
  stage_started: boolean;
}
