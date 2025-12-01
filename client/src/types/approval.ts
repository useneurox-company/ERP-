// Types for Approval Stage (Согласование)

export interface ApprovalDocument {
  id: string;
  type: 'technical_specification' | 'constructor_documentation' | 'estimate';
  name: string;
  version: string;
  status: 'pending' | 'approved' | 'rejected';
  url?: string;
  stage_id?: string; // ID этапа откуда взят документ
}

export interface ClientComment {
  id: string;
  document_type: 'technical_specification' | 'constructor_documentation' | 'estimate' | 'general';
  comment: string;
  created_at: string;
  created_by: string;
  created_by_name: string;
}

export interface RevisionRequest {
  stage_type: 'technical_specification' | 'constructor_documentation';
  stage_id: string;
  reason: string;
  requested_at: string;
  requested_by: string;
  requested_by_name: string;
}

export interface ApprovalHistory {
  id: string;
  action: 'approved' | 'rejected' | 'revision_requested';
  document_type?: string;
  performed_by: string;
  performed_by_name: string;
  performed_at: string;
  note?: string;
}

export interface ApprovalStageData {
  assignee_id?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  notes?: string;

  // Пакет документов для согласования
  documents: ApprovalDocument[];

  // Статус общего согласования
  overall_status?: 'pending' | 'in_review' | 'approved' | 'requires_revision';

  // Комментарии клиента
  client_comments: ClientComment[];

  // Запрос на доработку
  revision_request?: RevisionRequest;

  // История согласований
  approval_history: ApprovalHistory[];

  // Дата согласования
  approved_at?: string;
  approved_by?: string;
  approved_by_name?: string;
}
