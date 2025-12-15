import { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Phone, Building2, DollarSign, MessageSquare, CheckSquare, Activity, Brain, Plus, FolderOpen, FileText, Trash2, Sparkles, User as UserIcon, Download, Edit2, X, Upload, Calendar, FileSpreadsheet, Receipt, FileSignature, Briefcase, ExternalLink, ChevronDown, ChevronRight, Filter, Copy } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest, queryClient, getCurrentUserId } from "@/lib/queryClient";
import { DocumentFormDialog } from "@/components/DocumentFormDialog";
import { InvoiceFromQuoteDialog } from "@/components/InvoiceFromQuoteDialog";
import { ContractFormDialog } from "@/components/ContractFormDialog";
import { ContractViewDialog } from "@/components/ContractViewDialog";
import { DeleteDealDialog } from "@/components/DeleteDealDialog";
import { CreateProjectDialog } from "@/components/CreateProjectDialog";
import { useToast } from "@/hooks/use-toast";
import type { Deal, DealMessage, InsertDealMessage, DealDocument, User, DealStage, DealAttachment, Project } from "@shared/schema";
import { DealCustomFields } from "@/components/DealCustomFields";
import { AllDocumentsDialog } from "@/components/AllDocumentsDialog";
import { useLocation } from "wouter";
import { AiAssistantDialog } from "@/components/AiAssistantDialog";
import { InlineEditField } from "@/components/InlineEditField";
import { DealContactsList } from "@/components/DealContactsList";
import { ManageCustomFieldsDialog } from "@/components/ManageCustomFieldsDialog";
import { TaskList } from "@/components/TaskList";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { FilePreview } from "@/components/FilePreview";
import { MessageBubble } from "@/components/MessageBubble";
import { ChatInput } from "@/components/ChatInput";
import { TaskBubble } from "@/components/TaskBubble";
import { EventBubble } from "@/components/EventBubble";
import { CreateTaskInlineDialog } from "@/components/CreateTaskInlineDialog";

interface DealCardModalProps {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealCardModal({ dealId, open, onOpenChange }: DealCardModalProps) {
  const { data: deal, isLoading } = useQuery<Deal>({
    queryKey: ['/api/deals', dealId],
    enabled: !!dealId && open,
  });

  const { data: messages = [], isLoading: messagesLoading } = useQuery<DealMessage[]>({
    queryKey: ['/api/deals', dealId, 'messages'],
    enabled: !!dealId && open,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const { data: documents = [], isLoading: documentsLoading } = useQuery<DealDocument[]>({
    queryKey: ['/api/deals', dealId, 'documents'],
    enabled: !!dealId && open,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const { data: stages = [] } = useQuery<DealStage[]>({
    queryKey: ['/api/deal-stages'],
    enabled: open,
  });

  const { data: attachments = [] } = useQuery<DealAttachment[]>({
    queryKey: ['/api/deals', dealId, 'attachments'],
    enabled: !!dealId && open,
  });

  const { data: existingProject } = useQuery<Project>({
    queryKey: [`/api/projects/by-deal/${dealId}`],
    enabled: !!dealId && open,
    retry: false,
    refetchOnWindowFocus: false,
    onError: (error: any) => {
      // Suppress 404 errors - it's normal when no project exists yet
      if (error.response?.status !== 404) {
        console.error('[DealCardModal] Error fetching project:', error);
      }
    },
  });

  const { data: activityLogs = [], isLoading: activityLogsLoading } = useQuery<any[]>({
    queryKey: ['/api/activity-logs', 'deal', dealId],
    queryFn: async () => {
      console.log('[ActivityLogs] Fetching for dealId:', dealId);
      const data = await apiRequest('GET', `/api/activity-logs/deal/${dealId}`);
      console.log('[ActivityLogs] Parsed data:', data);
      console.log('[ActivityLogs] Is Array?', Array.isArray(data));
      console.log('[ActivityLogs] Fetched', Array.isArray(data) ? data.length : 0, 'logs');
      return Array.isArray(data) ? data : [];
    },
    enabled: !!dealId && open,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ['/api/deals', dealId, 'tasks'],
    enabled: !!dealId && open,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: open,
  });

  // Ref для автоскролла в чате
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractViewDialogOpen, setContractViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [allDocumentsDialogOpen, setAllDocumentsDialogOpen] = useState(false);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const [editingQuoteId, setEditingQuoteId] = useState<string | undefined>();
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | undefined>();
  const [editingDocumentId, setEditingDocumentId] = useState<string | undefined>();
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [manageFieldsOpen, setManageFieldsOpen] = useState(false);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [createTaskInlineDialogOpen, setCreateTaskInlineDialogOpen] = useState(false);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'messages' | 'tasks' | 'events'>('all');

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/users', getCurrentUserId()],
    enabled: open,
  });

  // Логика воркфлоу
  const hasQuote = documents.some(doc => doc.document_type === 'quote');
  const hasSignedContract = documents.some(
    doc => doc.document_type === 'contract' && doc.is_signed
  );

  const quotes = documents.filter(doc => doc.document_type === 'quote');
  const invoices = documents.filter(doc => doc.document_type === 'invoice');
  const contracts = documents.filter(doc => doc.document_type === 'contract');

  const createMessage = useMutation({
    mutationFn: async (data: { message_type: "note" | "call" | "email" | "task"; content: string }) => {
      return await apiRequest('POST', `/api/deals/${dealId}/messages`, {
        ...data,
        author_id: getCurrentUserId(),
        direction: 'outgoing', // Исходящее сообщение
      });
    },
    onSuccess: async () => {
      // Real-time обновление timeline - используем refetch для немедленного обновления
      await queryClient.refetchQueries({ queryKey: ['/api/deals', dealId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
    },
  });

  const deleteDeal = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/deals/${dealId}`);
    },
    onSuccess: () => {
      // Close dialogs FIRST to prevent refetch of deleted data
      setDeleteDialogOpen(false);
      onOpenChange(false);

      // Then invalidate queries after modal is closed
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });

      // Show dismissible toast notification
      toast({
        title: "Сделка удалена",
        description: "Сделка успешно удалена",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить сделку",
        variant: "destructive",
      });
    },
  });

  const updateStage = useMutation({
    mutationFn: async (stage: string) => {
      return await apiRequest('PUT', `/api/deals/${dealId}`, { stage });
    },
    onSuccess: () => {
      // Real-time обновление timeline
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'messages'] });
      toast({
        title: "Этап обновлён",
        description: "Этап сделки успешно изменён",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить этап",
        variant: "destructive",
      });
    },
  });

  const cloneDocument = useMutation({
    mutationFn: async (docId: string) => {
      return await apiRequest('POST', `/api/deals/${dealId}/documents/${docId}/clone`);
    },
    onSuccess: (newDoc) => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
      toast({
        title: "КП скопировано",
        description: `Создана копия №${newDoc.document_number}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось скопировать КП",
        variant: "destructive",
      });
    },
  });

  const updateDealField = useMutation({
    mutationFn: async (data: Partial<Deal>) => {
      return await apiRequest('PUT', `/api/deals/${dealId}`, data);
    },
    onSuccess: () => {
      // Real-time обновление timeline
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'messages'] });
      toast({
        title: "Поле обновлено",
        description: "Информация успешно сохранена",
      });
    },
    onError: (error: any) => {
      let description = error.message || "Не удалось обновить поле";

      // Улучшенная обработка ошибок уникальности
      if (error.message?.includes("unique") || error.message?.includes("UNIQUE")) {
        description = "Этот номер заказа уже используется. Выберите другой номер.";
      } else if (error.message?.includes("order_number")) {
        description = "Ошибка при обновлении номера заказа. Проверьте формат.";
      }

      toast({
        title: "Ошибка",
        description,
        variant: "destructive",
      });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      return await apiRequest('DELETE', `/api/deals/${dealId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      // Real-time обновление
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'messages'] });
      toast({
        title: "Файл удалён",
        description: "Файл успешно удалён",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить файл",
        variant: "destructive",
      });
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (documentId: string) => {
      return await apiRequest('DELETE', `/api/deals/${dealId}/documents/${documentId}`);
    },
    onSuccess: () => {
      // Real-time обновление
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'messages'] });
      toast({
        title: "Документ удалён",
        description: "Документ успешно удалён",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить документ",
        variant: "destructive",
      });
    },
  });

  const createProjectFromInvoice = useMutation<Project, Error, { invoiceId: string; selectedPositions: number[]; editedPositions: any[]; positionStagesData: any }>({
    mutationFn: async ({ invoiceId, selectedPositions, editedPositions, positionStagesData }) => {
      return await apiRequest<Project>('POST', '/api/projects/from-invoice', {
        dealId,
        invoiceId,
        selectedPositions,
        editedPositions,
        positionStagesData,
      });
    },
    onSuccess: (project: Project) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/by-deal/${dealId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}/stages`] });
      toast({
        title: "Успешно",
        description: "Проект успешно обновлён",
      });
      setCreateProjectDialogOpen(false);
      onOpenChange(false);
      setLocation(`/projects/${project.id}`);
    },
    onError: (error: any) => {
      let errorMessage = "Не удалось создать проект";

      if (error.message?.includes("Document is not an invoice")) {
        errorMessage = "Выбран не счёт";
      }

      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useState<HTMLInputElement | null>(null)[0];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/objects/upload', {
          method: 'POST',
          headers: {
            'X-User-Id': getCurrentUserId(),
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        const uploadData = await uploadResponse.json();

        // Create attachment metadata
        await apiRequest('POST', `/api/deals/${dealId}/attachments`, {
          deal_id: dealId,
          file_name: file.name,
          file_path: uploadData.objectPath,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          uploaded_by: getCurrentUserId(),
        });
      }

      // Real-time обновление
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'messages'] });
      toast({
        title: "Файлы загружены",
        description: `Загружено ${files.length} файл(ов)`,
      });

      // Reset file input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить файлы",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Обработчик отправки сообщения из ChatInput
  const handleSendMessage = (content: string) => {
    createMessage.mutate({
      message_type: 'note',
      content,
    });
  };

  // Автоскролл к последнему сообщению
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Создаём единый timeline из сообщений, задач и событий
  const timelineItems = useMemo(() => {
    const items: Array<{ type: 'message' | 'task' | 'event'; data: any; timestamp: string }> = [];

    // Добавляем сообщения
    messages.forEach(msg => {
      items.push({
        type: 'message',
        data: msg,
        timestamp: msg.created_at
      });
    });

    // Добавляем задачи
    tasks.forEach(task => {
      items.push({
        type: 'task',
        data: task,
        timestamp: task.created_at
      });
    });

    // Добавляем события
    activityLogs.forEach(log => {
      items.push({
        type: 'event',
        data: log,
        timestamp: log.created_at
      });
    });

    // Сортируем по времени (сначала старые)
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Фильтруем по выбранному типу
    if (timelineFilter === 'all') {
      return items;
    } else if (timelineFilter === 'messages') {
      return items.filter(item => item.type === 'message');
    } else if (timelineFilter === 'tasks') {
      return items.filter(item => item.type === 'task');
    } else if (timelineFilter === 'events') {
      return items.filter(item => item.type === 'event');
    }

    return items;
  }, [messages, tasks, activityLogs, timelineFilter]);

  if (!open || !dealId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] h-[90vh] p-0" data-testid="dialog-deal-card">
        <DialogTitle className="sr-only">
          {deal?.title || deal?.client_name || "Карточка сделки"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          Подробная информация о сделке, сообщения, документы и вложения
        </DialogDescription>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <p>Загрузка...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Заголовок сделки */}
            <div className="border-b px-4 py-3">
              {deal && (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <InlineEditField
                      label=""
                      value={deal.title || deal.client_name}
                      type="text"
                      placeholder="Название сделки"
                      displayClassName="font-semibold text-lg"
                      onSave={(value) => updateDealField.mutate({ title: value || null })}
                      data-testid="text-deal-name"
                    />
                    <p className="text-sm text-muted-foreground" data-testid="text-order-number">
                      Заказ #{deal.order_number || "не присвоен"}
                      {deal.client_name && deal.title && ` • Клиент: ${deal.client_name}`}
                    </p>
                    {(deal as any).manager_user && (
                      <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                        <UserIcon className="w-4 h-4" />
                        <span>
                          Менеджер: <span className="font-medium text-foreground">
                            {(deal as any).manager_user.full_name || (deal as any).manager_user.username}
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManageFieldsOpen(true)}
                    title="Настроить кастомные поля"
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    Поля
                  </Button>
                </div>
              )}
            </div>

            {/* Основной контент */}
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_320px] flex-1 overflow-hidden">
              {/* Левая панель - информация */}
              <div className="border-r p-2 overflow-y-auto max-h-[30vh] lg:max-h-none" data-testid="panel-left-info">
                {deal && (
                  <>
                  {/* Блок: Сумма и заказ */}
                  <div className="mb-2 p-2 bg-muted/30 rounded-lg">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Сумма и заказ</p>

                    <InlineEditField
                      label="Сумма сделки"
                      value={deal.amount}
                      type="number"
                      placeholder="0"
                      icon={<DollarSign className="w-4 h-4" />}
                      formatter={(val) => val ? `${Number(val).toLocaleString('ru-RU')} ₽` : '—'}
                      onSave={(value) => updateDealField.mutate({ amount: value ? parseFloat(value) : null })}
                    />

                    <InlineEditField
                      label="Номер заказа"
                      value={deal.order_number}
                      type="text"
                      placeholder="Не присвоен"
                      formatter={(val) => val || '—'}
                      onSave={(value) => updateDealField.mutate({ order_number: value || null })}
                    />
                  </div>

                  {/* Блок: Контактные лица */}
                  <div className="mb-2 p-2 bg-muted/30 rounded-lg">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Контактные лица</p>
                    <DealContactsList dealId={dealId!} />
                  </div>

                  {/* Блок: Этап и сроки */}
                  <div className="mb-2 p-2 bg-muted/30 rounded-lg">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Этап и сроки</p>

                    <div className="mb-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Этап</p>
                      <Select
                        value={deal.stage}
                        onValueChange={(value) => updateStage.mutate(value)}
                        disabled={updateStage.isPending}
                      >
                        <SelectTrigger className="w-full text-xs h-8" data-testid="select-stage">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stages.map((stage) => (
                            <SelectItem key={stage.id} value={stage.key}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator className="my-2" />

                  {/* Кастомные поля */}
                  <div className="mb-2">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Дополнительные поля</p>
                    <DealCustomFields dealId={dealId} />
                  </div>

                  <Separator className="my-2" />

                  {/* Документы */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase">Документы</p>
                      <div>
                        <input
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          style={{ display: 'none' }}
                          id="file-upload-input"
                          accept="*/*"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => document.getElementById('file-upload-input')?.click()}
                          disabled={isUploading}
                          className="h-6 px-2"
                        >
                          {isUploading ? (
                            <>
                              <Upload className="h-2.5 w-2.5 mr-1 animate-pulse" />
                              <span className="text-[10px]">Загрузка...</span>
                            </>
                          ) : (
                            <>
                              <Plus className="h-2.5 w-2.5 mr-1" />
                              <span className="text-[10px]">Загрузить</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    {attachments.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Нет файлов</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {attachments.map((attachment) => (
                          <FilePreview
                            key={attachment.id}
                            file={{
                              id: attachment.id,
                              file_name: attachment.file_name,
                              file_size: attachment.file_size,
                              mime_type: attachment.mime_type,
                              created_at: attachment.created_at
                            }}
                            downloadUrl={attachment.file_path}
                            onDownload={() => window.open(attachment.file_path, '_blank')}
                            onDelete={() => deleteAttachment.mutate(attachment.id)}
                            compact
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  </>
                )}
              </div>

            {/* Центральная панель - единый Timeline */}
            <div className="flex flex-col min-h-0" data-testid="panel-center-chat">
              {/* Фильтр */}
              <div className="px-3 pt-2 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <Select value={timelineFilter} onValueChange={(value: any) => setTimelineFilter(value)}>
                    <SelectTrigger className="w-full max-w-[200px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все записи</SelectItem>
                      <SelectItem value="messages">Только сообщения</SelectItem>
                      <SelectItem value="tasks">Только задачи</SelectItem>
                      <SelectItem value="events">Только события</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Timeline область (скроллируемая) */}
              <div className="flex-1 min-h-0 px-3 pt-3 pb-3 overflow-y-auto" data-testid="timeline-container">
                {messagesLoading || tasksLoading || activityLogsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">Загрузка...</p>
                  </div>
                ) : timelineItems.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Activity className="w-12 h-12 mx-auto text-muted-foreground/30 mb-2" />
                      <p className="text-sm text-muted-foreground">Нет записей</p>
                      <p className="text-xs text-muted-foreground/70">
                        {timelineFilter === 'all'
                          ? 'Начните с добавления сообщения или создания задачи'
                          : timelineFilter === 'messages'
                          ? 'Нет сообщений'
                          : timelineFilter === 'tasks'
                          ? 'Нет задач'
                          : 'Нет событий'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {timelineItems.map((item, index) => {
                      if (item.type === 'message') {
                        return (
                          <MessageBubble
                            key={`message-${item.data.id}`}
                            message={item.data}
                            currentUserId={getCurrentUserId() || ''}
                          />
                        );
                      } else if (item.type === 'task') {
                        return (
                          <TaskBubble
                            key={`task-${item.data.id}`}
                            task={item.data}
                            onOpenDetails={(taskId) => setTaskDetailId(taskId)}
                          />
                        );
                      } else if (item.type === 'event') {
                        return (
                          <EventBubble
                            key={`event-${item.data.id}`}
                            event={item.data}
                          />
                        );
                      }
                      return null;
                    })}
                    {/* Якорь для автоскролла */}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Нижняя панель - чат и кнопка создания задачи */}
              <div className="border-t">
                {/* Кнопка создания задачи */}
                <div className="px-3 py-2 border-b">
                  <Button
                    onClick={() => setCreateTaskInlineDialogOpen(true)}
                    variant="outline"
                    className="w-full gap-2 h-8 text-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Создать задачу
                  </Button>
                </div>

                {/* Поле ввода сообщения */}
                <ChatInput
                  onSend={handleSendMessage}
                  disabled={createMessage.isPending}
                  placeholder="Добавьте сообщение..."
                  userId={getCurrentUserId()}
                />
              </div>
            </div>

            {/* Правая панель - действия */}
            <div className="border-l p-3 overflow-y-auto flex flex-col max-h-[30vh] lg:max-h-none" data-testid="panel-right-actions">
              <h3 className="font-semibold mb-3 text-sm">Действия</h3>

              {/* Кнопки воркфлоу */}
              <div className="space-y-2 mb-4">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-800"
                  onClick={() => setAiAssistantOpen(true)}
                  data-testid="button-ai-calculate"
                >
                  <Sparkles className="w-4 h-4" />
                  AI Просчёт
                </Button>

                <Button
                  className="w-full justify-start gap-2 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
                  onClick={() => setQuoteDialogOpen(true)}
                  data-testid="button-create-quote"
                >
                  <Plus className="w-4 h-4" />
                  Создать КП
                </Button>

                {hasQuote && (
                  <>
                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      onClick={() => setInvoiceDialogOpen(true)}
                      data-testid="button-create-invoice"
                    >
                      <FileText className="w-4 h-4" />
                      Выставить счёт
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full justify-start gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                      onClick={() => setContractDialogOpen(true)}
                      data-testid="button-create-contract"
                    >
                      <FileText className="w-4 h-4" />
                      Договор
                    </Button>
                  </>
                )}
              </div>

              <Separator className="my-3" />

              {/* Дерево документов */}
              <div className="flex-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">Дерево документов</h4>
                {documentsLoading ? (
                  <p className="text-sm text-muted-foreground">Загрузка...</p>
                ) : documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Документы отсутствуют</p>
                ) : (
                  <div className="space-y-2 text-sm" data-testid="tree-documents">
                    {quotes.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="w-4 h-4 text-blue-500" />
                          <p className="font-medium">КП</p>
                          <Badge variant="secondary" className="ml-auto">{quotes.length}</Badge>
                        </div>
                        <div className="space-y-1.5">
                          {quotes.map(q => (
                            <div
                              key={q.id}
                              className="relative border-l-4 border-blue-500 bg-gradient-to-r from-blue-50/50 to-blue-50/30 dark:from-blue-950/30 dark:to-blue-950/10 hover:shadow-md hover:-translate-y-0.5 rounded-r px-2.5 py-1.5 transition-all duration-200 group"
                              data-testid={`quote-item-${q.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm font-medium truncate">{q.name}</span>
                                    <Badge variant="outline" className="text-xs">v{q.version}</Badge>
                                  </div>
                                </div>
                                <div className="flex gap-0.5 flex-shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 hover:bg-blue-100 dark:hover:bg-blue-900"
                                    onClick={() => window.open(`/api/deals/${dealId}/documents/${q.id}/html`, '_blank')}
                                    data-testid={`button-download-quote-${q.id}`}
                                    title="Просмотр КП"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 hover:bg-blue-100 dark:hover:bg-blue-900"
                                    onClick={() => {
                                      setEditingQuoteId(q.id);
                                      setQuoteDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-quote-${q.id}`}
                                    title="Редактировать"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 hover:bg-blue-100 dark:hover:bg-blue-900"
                                    onClick={() => cloneDocument.mutate(q.id)}
                                    disabled={cloneDocument.isPending}
                                    data-testid={`button-clone-quote-${q.id}`}
                                    title="Создать на основании"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </Button>
                                  {(currentUser?.can_delete_deals || currentUser?.role?.permissions?.some((p: any) => p.module === 'deals' && p.can_delete)) && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-destructive hover:bg-red-100 dark:hover:bg-red-900/20"
                                      onClick={() => {
                                        if (confirm(`Удалить КП "${q.name}"?`)) {
                                          deleteDocument.mutate(q.id);
                                        }
                                      }}
                                      data-testid={`button-delete-quote-${q.id}`}
                                      title="Удалить"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {invoices.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Receipt className="w-4 h-4 text-green-500" />
                          <p className="font-medium">Счета</p>
                          <Badge variant="secondary" className="ml-auto">{invoices.length}</Badge>
                        </div>
                        <div className="space-y-1.5">
                          {invoices.map(i => (
                            <div
                              key={i.id}
                              className="relative border-l-4 border-green-500 bg-gradient-to-r from-green-50/50 to-green-50/30 dark:from-green-950/30 dark:to-green-950/10 hover:shadow-md hover:-translate-y-0.5 rounded-r px-2.5 py-1.5 transition-all duration-200 group"
                              data-testid={`invoice-item-${i.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm font-medium truncate">{i.name}</span>
                                  </div>
                                </div>
                                <div className="flex gap-0.5 flex-shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 hover:bg-green-100 dark:hover:bg-green-900"
                                    onClick={() => window.open(`/api/deals/${dealId}/documents/${i.id}/html`, '_blank')}
                                    data-testid={`button-download-invoice-${i.id}`}
                                    title="Просмотр счёта"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 hover:bg-green-100 dark:hover:bg-green-900"
                                    onClick={() => {
                                      setEditingInvoiceId(i.id);
                                      setInvoiceDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-invoice-${i.id}`}
                                    title="Редактировать"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  {(currentUser?.can_delete_deals || currentUser?.role?.permissions?.some((p: any) => p.module === 'deals' && p.can_delete)) && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-destructive hover:bg-red-100 dark:hover:bg-red-900/20"
                                      onClick={() => {
                                        if (confirm(`Удалить счёт "${i.name}"?`)) {
                                          deleteDocument.mutate(i.id);
                                        }
                                      }}
                                      data-testid={`button-delete-invoice-${i.id}`}
                                      title="Удалить"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {contracts.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <FileSignature className="w-4 h-4 text-purple-500" />
                          <p className="font-medium">Договоры</p>
                          <Badge variant="secondary" className="ml-auto">{contracts.length}</Badge>
                        </div>
                        <div className="space-y-1.5">
                          {contracts.map(c => (
                            <div
                              key={c.id}
                              className="relative border-l-4 border-purple-500 bg-gradient-to-r from-purple-50/50 to-purple-50/30 dark:from-purple-950/30 dark:to-purple-950/10 hover:shadow-md hover:-translate-y-0.5 rounded-r px-2.5 py-1.5 transition-all duration-200 group"
                              data-testid={`contract-item-${c.id}`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm font-medium truncate">{c.name}</span>
                                    {c.is_signed && (
                                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                        Подписан ✓
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-0.5 flex-shrink-0">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 hover:bg-purple-100 dark:hover:bg-purple-900"
                                    onClick={() => window.open(c.file_url, '_blank')}
                                    data-testid={`button-download-contract-${c.id}`}
                                    title="Скачать"
                                  >
                                    <Download className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 hover:bg-purple-100 dark:hover:bg-purple-900"
                                    onClick={() => {
                                      setEditingDocumentId(c.id);
                                      setContractViewDialogOpen(true);
                                    }}
                                    data-testid={`button-edit-contract-${c.id}`}
                                    title="Редактировать"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                  {(currentUser?.can_delete_deals || currentUser?.role?.permissions?.some((p: any) => p.module === 'deals' && p.can_delete)) && (
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-6 w-6 text-destructive hover:bg-red-100 dark:hover:bg-red-900/20"
                                      onClick={() => {
                                        if (confirm(`Удалить договор "${c.name}"?`)) {
                                          deleteDocument.mutate(c.id);
                                        }
                                      }}
                                      data-testid={`button-delete-contract-${c.id}`}
                                      title="Удалить"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Проект */}
                    {existingProject && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-4 h-4 text-orange-500" />
                          <p className="font-medium">Проект</p>
                          <Badge variant="secondary" className="ml-auto">1</Badge>
                        </div>
                        <div
                          className={`relative border-l-4 rounded-r p-4 transition-all duration-200 cursor-pointer ${
                            existingProject.status === 'in_progress'
                              ? 'border-blue-500 bg-blue-50/50 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/30'
                              : existingProject.status === 'completed'
                              ? 'border-green-500 bg-green-50/50 hover:bg-green-50/70 dark:bg-green-950/20 dark:hover:bg-green-950/30'
                              : 'border-gray-400 bg-accent/30 hover:bg-accent/50'
                          }`}
                          onClick={() => setLocation(`/projects/${existingProject.id}`)}
                          data-testid="project-card"
                        >
                          <div className="space-y-3">
                            {/* Заголовок проекта */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Briefcase className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  <h4 className="font-semibold truncate">{existingProject.name}</h4>
                                </div>
                                <p className="text-xs text-muted-foreground">{existingProject.client_name}</p>
                              </div>
                              <Badge
                                variant="outline"
                                className={`flex-shrink-0 ${
                                  existingProject.status === 'in_progress'
                                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                                    : existingProject.status === 'completed'
                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                    : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                                }`}
                              >
                                {existingProject.status === 'in_progress' && '🔵 В работе'}
                                {existingProject.status === 'completed' && '🟢 Завершён'}
                                {existingProject.status === 'pending' && '⚪ Ожидает'}
                              </Badge>
                            </div>

                            {/* Прогресс */}
                            {existingProject.progress !== null && existingProject.progress > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Прогресс</span>
                                  <span className="font-medium">{existingProject.progress}%</span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className={`h-full transition-all duration-300 ${
                                      existingProject.status === 'completed'
                                        ? 'bg-green-500'
                                        : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${existingProject.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Метаданные */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {existingProject.started_at && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  <span>
                                    Начат {new Date(existingProject.started_at).toLocaleDateString('ru-RU')}
                                  </span>
                                </div>
                              )}
                              {existingProject.duration_days && (
                                <div className="flex items-center gap-1">
                                  <span>⏱️ {existingProject.duration_days} дн.</span>
                                </div>
                              )}
                            </div>

                            {/* Кнопка открытия */}
                            <Button
                              variant="default"
                              size="sm"
                              className="w-full gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/projects/${existingProject.id}`);
                              }}
                              data-testid="button-open-project"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Открыть проект
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator className="my-3" />

              {/* Кнопка документы */}
              <Button
                variant="outline"
                className="w-full justify-start gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                onClick={() => setAllDocumentsDialogOpen(true)}
                data-testid="button-all-documents"
              >
                <FolderOpen className="w-4 h-4" />
                Документы
              </Button>

              {/* Кнопка создать проект */}
              {hasSignedContract && invoices.length > 0 && !existingProject && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 mt-2"
                    onClick={() => setCreateProjectDialogOpen(true)}
                    data-testid="button-create-project"
                  >
                    <Plus className="w-4 h-4" />
                    Создать проект
                  </Button>
                </>
              )}

              {/* Кнопка удаления */}
              {currentUser?.can_delete_deals && (
                <>
                  <Separator className="my-3" />
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                    onClick={() => setDeleteDialogOpen(true)}
                    data-testid="button-delete-deal"
                  >
                    <Trash2 className="w-4 h-4" />
                    Удалить сделку
                  </Button>
                </>
              )}
            </div>
          </div>
          </div>
        )}
      </DialogContent>

      <DeleteDealDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => deleteDeal.mutate()}
        dealName={deal?.title || deal?.client_name || "Сделка"}
        isPending={deleteDeal.isPending}
      />

      <DocumentFormDialog
        open={quoteDialogOpen}
        onOpenChange={(open) => {
          setQuoteDialogOpen(open);
          if (!open) setEditingQuoteId(undefined);
        }}
        dealId={dealId}
        documentType="quote"
        documentId={editingQuoteId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
          setEditingQuoteId(undefined);
        }}
      />

      <InvoiceFromQuoteDialog
        open={invoiceDialogOpen}
        onOpenChange={(open) => {
          setInvoiceDialogOpen(open);
          if (!open) setEditingInvoiceId(undefined);
        }}
        dealId={dealId}
        invoiceId={editingInvoiceId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
          setEditingInvoiceId(undefined);
        }}
      />

      <ContractFormDialog
        open={contractDialogOpen}
        onOpenChange={(open) => {
          setContractDialogOpen(open);
          if (!open) setEditingDocumentId(undefined);
        }}
        dealId={dealId}
        contractId={editingDocumentId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
          setEditingDocumentId(undefined);
        }}
      />

      {editingDocumentId && (
        <ContractViewDialog
          open={contractViewDialogOpen}
          onOpenChange={(open) => {
            setContractViewDialogOpen(open);
            if (!open) setEditingDocumentId(undefined);
          }}
          dealId={dealId}
          contractId={editingDocumentId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
            setEditingDocumentId(undefined);
          }}
        />
      )}

      <AllDocumentsDialog
        open={allDocumentsDialogOpen}
        onOpenChange={setAllDocumentsDialogOpen}
        documents={documents}
        attachments={attachments}
        isLoading={documentsLoading}
        dealId={dealId || undefined}
        onCloneDocument={(docId) => cloneDocument.mutate(docId)}
      />

      <CreateProjectDialog
        open={createProjectDialogOpen}
        onOpenChange={setCreateProjectDialogOpen}
        invoicePositions={
          (() => {
            if (invoices.length === 0 || !invoices[0].data) return [];
            try {
              const data = typeof invoices[0].data === 'string'
                ? JSON.parse(invoices[0].data)
                : invoices[0].data;
              return Array.isArray(data?.positions) ? data.positions : [];
            } catch (e) {
              console.error('Failed to parse invoice data:', e);
              return [];
            }
          })()
        }
        onCreateProject={(selectedPositions, editedPositions, positionStagesData) => {
          if (invoices.length > 0) {
            createProjectFromInvoice.mutate({
              invoiceId: invoices[0].id,
              selectedPositions,
              editedPositions,
              positionStagesData,
            });
          }
        }}
        isPending={createProjectFromInvoice.isPending}
        dealName={deal?.title || deal?.client_name || ""}
      />

      {dealId && (
        <AiAssistantDialog
          open={aiAssistantOpen}
          onOpenChange={setAiAssistantOpen}
          dealId={dealId}
          userId={getCurrentUserId()}
          dealName={deal?.title || deal?.client_name}
        />
      )}

      <ManageCustomFieldsDialog
        open={manageFieldsOpen}
        onOpenChange={setManageFieldsOpen}
      />

      <CreateTaskDialog
        open={createTaskDialogOpen}
        onOpenChange={setCreateTaskDialogOpen}
        dealId={dealId || undefined}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/tasks`] });
        }}
      />

      <TaskDetailDialog
        taskId={taskDetailId}
        open={!!taskDetailId}
        onOpenChange={(open) => !open && setTaskDetailId(null)}
      />

      <CreateTaskInlineDialog
        open={createTaskInlineDialogOpen}
        onOpenChange={setCreateTaskInlineDialogOpen}
        dealId={dealId || ''}
      />
    </Dialog>
  );
}
