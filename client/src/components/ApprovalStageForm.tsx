import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  MessageSquare,
  RotateCcw,
  CheckCheck,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import type { ProjectStage } from "@shared/schema";
import type { ApprovalStageData, ApprovalDocument, ClientComment, RevisionRequest } from "@/types/approval";
import { nanoid } from "nanoid";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

interface User {
  id: string;
  username: string;
  full_name?: string;
}

interface ApprovalStageFormProps {
  stage: ProjectStage;
  onDataChange: (data: ApprovalStageData) => void;
  readOnly?: boolean;
}

export function ApprovalStageForm({
  stage,
  onDataChange,
  readOnly = false
}: ApprovalStageFormProps) {
  const [formData, setFormData] = useState<ApprovalStageData>(() => {
    try {
      const parsed = stage.type_data ? JSON.parse(stage.type_data as string) : {};
      return {
        documents: parsed.documents || [],
        client_comments: parsed.client_comments || [],
        approval_history: parsed.approval_history || [],
        overall_status: parsed.overall_status || 'pending',
        ...parsed,
      };
    } catch {
      return {
        documents: [],
        client_comments: [],
        approval_history: [],
        overall_status: 'pending',
      };
    }
  });

  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentDocType, setCommentDocType] = useState<string>("general");
  const [revisionReason, setRevisionReason] = useState("");
  const [revisionStageType, setRevisionStageType] = useState<"technical_specification" | "constructor_documentation">("technical_specification");

  // Загружаем список пользователей
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Get current user
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  // Загружаем этапы проекта для автосборки документов
  const { data: projectStages = [] } = useQuery<ProjectStage[]>({
    queryKey: ['/api/projects', stage.project_id, 'stages'],
    enabled: !!stage.project_id,
  });

  // Автосборка документов при первой загрузке
  useEffect(() => {
    if (formData.documents.length === 0 && projectStages.length > 0) {
      const docs: ApprovalDocument[] = [];

      // Ищем этап ТЗ
      const tzStage = projectStages.find(s =>
        s.stage_type_id && s.id !== stage.id // Не текущий этап
      );

      // Ищем этап КД
      const kdStage = projectStages.find(s =>
        s.stage_type_id && s.id !== stage.id && s.id !== tzStage?.id
      );

      if (tzStage) {
        docs.push({
          id: nanoid(),
          type: 'technical_specification',
          name: 'Техническое задание',
          version: '1.0',
          status: 'pending',
          stage_id: tzStage.id,
        });
      }

      if (kdStage) {
        docs.push({
          id: nanoid(),
          type: 'constructor_documentation',
          name: 'Конструкторская документация',
          version: '1.0',
          status: 'pending',
          stage_id: kdStage.id,
        });
      }

      // Всегда добавляем смету
      docs.push({
        id: nanoid(),
        type: 'estimate',
        name: 'Итоговая смета',
        version: '1.0',
        status: 'pending',
      });

      if (docs.length > 0) {
        setFormData(prev => ({
          ...prev,
          documents: docs,
        }));
      }
    }
  }, [projectStages, formData.documents.length, stage.id]);

  const handleDocumentStatusChange = (docId: string, status: 'pending' | 'approved' | 'rejected') => {
    const updatedDocs = formData.documents.map(doc =>
      doc.id === docId ? { ...doc, status } : doc
    );

    const newHistory: any = {
      id: nanoid(),
      action: status === 'approved' ? 'approved' : 'rejected',
      document_type: formData.documents.find(d => d.id === docId)?.type,
      performed_by: user?.id || '',
      performed_by_name: user?.full_name || user?.username || 'Неизвестно',
      performed_at: new Date().toISOString(),
    };

    const updatedData = {
      ...formData,
      documents: updatedDocs,
      approval_history: [...formData.approval_history, newHistory],
    };

    setFormData(updatedData);
    onDataChange(updatedData);
  };

  const handleAddComment = () => {
    if (!newComment.trim() || !user) return;

    const comment: ClientComment = {
      id: nanoid(),
      document_type: commentDocType as any,
      comment: newComment,
      created_at: new Date().toISOString(),
      created_by: user.id,
      created_by_name: user.full_name || user.username,
    };

    const updatedData = {
      ...formData,
      client_comments: [...formData.client_comments, comment],
    };

    setFormData(updatedData);
    onDataChange(updatedData);
    setNewComment("");
    setShowCommentDialog(false);
  };

  const handleRequestRevision = () => {
    if (!revisionReason.trim() || !user) return;

    // Находим ID этапа для доработки
    const targetStage = projectStages.find(s =>
      s.stage_type_id && (
        revisionStageType === 'technical_specification' && s.name.includes('Техническое задание') ||
        revisionStageType === 'constructor_documentation' && s.name.includes('КД')
      )
    );

    const revision: RevisionRequest = {
      stage_type: revisionStageType,
      stage_id: targetStage?.id || '',
      reason: revisionReason,
      requested_at: new Date().toISOString(),
      requested_by: user.id,
      requested_by_name: user.full_name || user.username,
    };

    const newHistory: any = {
      id: nanoid(),
      action: 'revision_requested',
      document_type: revisionStageType,
      performed_by: user.id,
      performed_by_name: user.full_name || user.username,
      performed_at: new Date().toISOString(),
      note: revisionReason,
    };

    const updatedData = {
      ...formData,
      revision_request: revision,
      overall_status: 'requires_revision' as const,
      approval_history: [...formData.approval_history, newHistory],
    };

    setFormData(updatedData);
    onDataChange(updatedData);
    setRevisionReason("");
    setShowRevisionDialog(false);
  };

  const handleApproveAll = () => {
    const updatedDocs = formData.documents.map(doc => ({
      ...doc,
      status: 'approved' as const,
    }));

    const newHistory: any = {
      id: nanoid(),
      action: 'approved',
      document_type: 'all',
      performed_by: user?.id || '',
      performed_by_name: user?.full_name || user?.username || 'Неизвестно',
      performed_at: new Date().toISOString(),
      note: 'Утверждены все документы',
    };

    const updatedData = {
      ...formData,
      documents: updatedDocs,
      overall_status: 'approved' as const,
      approved_at: new Date().toISOString(),
      approved_by: user?.id,
      approved_by_name: user?.full_name || user?.username,
      approval_history: [...formData.approval_history, newHistory],
    };

    setFormData(updatedData);
    onDataChange(updatedData);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800">Согласовано</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-800">Отклонено</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Ожидает</Badge>;
    }
  };

  const allApproved = formData.documents.every(doc => doc.status === 'approved');
  const anyRejected = formData.documents.some(doc => doc.status === 'rejected');

  return (
    <Card className="border-l-4 border-green-500">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <CardTitle className="text-base">Согласование</CardTitle>
          </div>
          {formData.overall_status === 'approved' && (
            <Badge className="bg-green-600">
              <CheckCheck className="w-3 h-3 mr-1" />
              Утверждено
            </Badge>
          )}
          {formData.overall_status === 'requires_revision' && (
            <Badge variant="destructive">
              <AlertCircle className="w-3 h-3 mr-1" />
              Требует доработки
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Исполнитель */}
        <div className="space-y-2">
          <Label htmlFor="assignee" className="text-sm font-medium">
            Ответственный за согласование
          </Label>
          <Select
            value={formData.assignee_id || stage.assignee_id || ""}
            onValueChange={(value) => {
              const updated = { ...formData, assignee_id: value || undefined };
              setFormData(updated);
              onDataChange(updated);
            }}
            disabled={readOnly}
          >
            <SelectTrigger id="assignee" className="text-sm">
              <SelectValue placeholder="Выберите ответственного" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Не назначен</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Список документов */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Документы для согласования</Label>
          <div className="space-y-2">
            {formData.documents.map((doc) => (
              <Card key={doc.id} className="border">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      {getStatusIcon(doc.status)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{doc.name}</p>
                          {doc.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => window.open(doc.url, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">Версия: {doc.version}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(doc.status)}
                      {!readOnly && doc.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => handleDocumentStatusChange(doc.id, 'approved')}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Согласовать
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-600"
                            onClick={() => handleDocumentStatusChange(doc.id, 'rejected')}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Отклонить
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Действия */}
        {!readOnly && (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={handleApproveAll}
              disabled={allApproved}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Согласовать все
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCommentDialog(true)}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Добавить комментарий
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRevisionDialog(true)}
              disabled={formData.overall_status === 'requires_revision'}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Вернуть на доработку
            </Button>
          </div>
        )}

        <Separator />

        {/* Комментарии клиента */}
        {formData.client_comments.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Комментарии</Label>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {formData.client_comments.map((comment) => (
                <Card key={comment.id} className="border-l-4 border-blue-500">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{comment.created_by_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {comment.document_type === 'general' ? 'Общий' : comment.document_type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(comment.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* История согласований */}
        {formData.approval_history.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">История</Label>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {formData.approval_history.map((item) => (
                <div key={item.id} className="text-xs flex items-center gap-2 p-2 bg-accent/30 rounded">
                  <FileText className="w-3 h-3" />
                  <span className="font-medium">{item.performed_by_name}</span>
                  <span>
                    {item.action === 'approved' ? 'согласовал' : item.action === 'rejected' ? 'отклонил' : 'запросил доработку'}
                  </span>
                  {item.document_type && item.document_type !== 'all' && (
                    <span>({item.document_type})</span>
                  )}
                  <span className="text-muted-foreground ml-auto">
                    {format(new Date(item.performed_at), "dd.MM HH:mm", { locale: ru })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {readOnly && (
          <div className="text-xs text-muted-foreground bg-accent p-2 rounded">
            ℹ️ Этап завершен. Редактирование недоступно.
          </div>
        )}
      </CardContent>

      {/* Диалог комментария */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Добавить комментарий</DialogTitle>
            <DialogDescription>
              Оставьте комментарий к документам или общий комментарий
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Тип комментария</Label>
              <Select value={commentDocType} onValueChange={setCommentDocType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Общий</SelectItem>
                  <SelectItem value="technical_specification">Техническое задание</SelectItem>
                  <SelectItem value="constructor_documentation">Конструкторская документация</SelectItem>
                  <SelectItem value="estimate">Смета</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Комментарий</Label>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Введите ваш комментарий..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommentDialog(false)}>
              Отмена
            </Button>
            <Button onClick={handleAddComment} disabled={!newComment.trim()}>
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог возврата на доработку */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вернуть на доработку</DialogTitle>
            <DialogDescription>
              Укажите какой этап требует доработки и причину
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Этап для доработки</Label>
              <Select
                value={revisionStageType}
                onValueChange={(v) => setRevisionStageType(v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technical_specification">Техническое задание</SelectItem>
                  <SelectItem value="constructor_documentation">Конструкторская документация</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Причина</Label>
              <Textarea
                value={revisionReason}
                onChange={(e) => setRevisionReason(e.target.value)}
                placeholder="Укажите что необходимо доработать..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevisionDialog(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleRequestRevision}
              disabled={!revisionReason.trim()}
              variant="destructive"
            >
              Вернуть на доработку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
