import { useState, useCallback, ClipboardEvent, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Calendar, DollarSign, Send, Paperclip, FileText, Download, Play, CheckCircle, Upload, Image, FileSpreadsheet, File, Link2, TrendingUp, AlertCircle, Lock, Plus, X } from "lucide-react";
import type { ProjectStage } from "@shared/schema";
import { MeasurementStageForm, type MeasurementStageData } from "./MeasurementStageForm";
import { TechnicalSpecificationStageForm } from "./TechnicalSpecificationStageForm";
import type { TechnicalSpecificationData } from "@/types/technicalSpecification";
import { ConstructorDocumentationStageForm } from "./ConstructorDocumentationStageForm";
import type { ConstructorDocumentationData } from "@/types/constructorDocumentation";
import { ApprovalStageForm } from "./ApprovalStageForm";
import type { ApprovalStageData } from "@/types/approval";
import { ProcurementStageForm } from "./ProcurementStageForm";
import type { ProcurementStageData } from "@/types/procurement";
import { ExcelComparisonView } from "./procurement/ExcelComparisonView";
import { ProductionStageForm } from "./ProductionStageForm";
import type { ProductionStageData } from "@/types/production";
import { InstallationStageForm } from "./InstallationStageForm";
import type { InstallationStageData } from "@/types/installation";
import { BasicStageForm } from "./BasicStageForm";
import { TaskList } from "./TaskList";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { FilePreview } from "./FilePreview";

interface StageDetailViewProps {
  stageId: string;
  stageName: string;
  stageStatus?: string;
  stageDescription?: string;
  stageDeadline?: string;
  stageCost?: string;
  projectId?: string;
  onStatusChange?: () => void;
}

export function StageDetailView({ 
  stageId, 
  stageName, 
  stageStatus,
  stageDescription,
  stageDeadline,
  stageCost,
  projectId,
  onStatusChange
}: StageDetailViewProps) {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(stageStatus || "pending");
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  const { data: messages = [] } = useQuery<any[]>({
    queryKey: ["/api/stages", stageId, "messages"],
    enabled: !!stageId,
  });

  const { data: documents = [] } = useQuery<any[]>({
    queryKey: ["/api/stages", stageId, "documents"],
    enabled: !!stageId,
  });

  const { data: allProjectDocuments = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", projectId, "documents"],
    enabled: !!projectId,
  });

  // Получаем зависимости этапов
  const { data: dependencies = [] } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'dependencies'],
    enabled: !!projectId,
  });

  // Получаем все этапы проекта для отображения названий
  const { data: allStages = [] } = useQuery<ProjectStage[]>({
    queryKey: ['/api/projects', projectId, 'stages'],
    enabled: !!projectId,
  });

  // Находим зависимости текущего этапа
  const stageDependencies = dependencies.filter(d => d.stage_id === stageId);
  const dependentStages = dependencies.filter(d => d.depends_on_stage_id === stageId);

  // Функция для получения названия этапа по ID
  const getStageName = (id: string) => {
    const stage = allStages.find(s => s.id === id);
    return stage?.name || 'Неизвестный этап';
  };

  // Проверка блокировок этапа
  const { data: blockerInfo } = useQuery<{ isBlocked: boolean; blockers: Array<{ id: string; name: string; status: string }> }>({
    queryKey: ['/api/stages', stageId, 'blockers'],
    enabled: !!stageId,
    refetchInterval: 10000, // Обновляем каждые 10 секунд для актуальности
  });

  // Запрос задач для этапа
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ['/api/stages', stageId, 'tasks'],
    enabled: !!stageId,
  });

  // Запрос пользователей
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Состояние для диалога создания задачи
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);

  const createMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      await apiRequest(
        "POST",
        `/api/stages/${stageId}/messages`,
        { message, user_id: user.id }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stageId, "messages"] });
      setNewMessage("");
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка отправки", variant: "destructive" });
    },
  });

  const { data: stage } = useQuery<ProjectStage>({
    queryKey: ["/api/projects/stages", stageId],
    enabled: !!stageId,
  });

  // Fetch stage type information to determine which form to show
  const { data: stageType } = useQuery<{id: string, code: string, name: string}>({
    queryKey: ["/api/stage-types", stage?.stage_type_id],
    enabled: !!stage?.stage_type_id,
  });

  // Проверка типа этапа для специального layout
  const isProcurement = stageType?.code === 'procurement';

  const startStageMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/stages/${stageId}/start`, {});
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "timeline"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      onStatusChange?.();
      toast({ description: "Этап начат" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка начала этапа", variant: "destructive" });
    },
  });

  const completeStageMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/stages/${stageId}/complete`, {});
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "timeline"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      onStatusChange?.();
      toast({ description: "Этап завершен" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка завершения этапа", variant: "destructive" });
    },
  });

  const updateMeasurementDataMutation = useMutation({
    mutationFn: async (data: MeasurementStageData) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, {
        type_data: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка сохранения данных", variant: "destructive" });
    },
  });

  const updateTechnicalSpecDataMutation = useMutation({
    mutationFn: async (data: TechnicalSpecificationData) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, {
        type_data: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка сохранения данных ТЗ", variant: "destructive" });
    },
  });

  const updateConstructorDocDataMutation = useMutation({
    mutationFn: async (data: ConstructorDocumentationData) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, {
        type_data: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка сохранения данных КД", variant: "destructive" });
    },
  });

  const updateApprovalDataMutation = useMutation({
    mutationFn: async (data: ApprovalStageData) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, {
        type_data: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
      toast({ description: "Данные согласования сохранены" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка сохранения данных согласования", variant: "destructive" });
    },
  });

  const updateProcurementDataMutation = useMutation({
    mutationFn: async (data: ProcurementStageData) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, {
        type_data: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
      toast({ description: "Данные снабжения сохранены" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка сохранения данных снабжения", variant: "destructive" });
    },
  });

  const updateProductionDataMutation = useMutation({
    mutationFn: async (data: ProductionStageData) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, {
        type_data: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
      toast({ description: "Данные производства сохранены" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка сохранения данных производства", variant: "destructive" });
    },
  });

  const updateInstallationDataMutation = useMutation({
    mutationFn: async (data: InstallationStageData) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, {
        type_data: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
      toast({ description: "Данные монтажа сохранены" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка сохранения данных монтажа", variant: "destructive" });
    },
  });

  const updateBasicStageDataMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, {
        type_data: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
      }
      toast({ description: "Данные сохранены" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка сохранения данных", variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, { status });
      
      if (user?.id) {
        const statusText = status === 'pending' ? 'Ожидает' : status === 'in_progress' ? 'В работе' : 'Завершён';
        await apiRequest("POST", `/api/stages/${stageId}/messages`, {
          message: `Изменён статус на: ${statusText}`,
          user_id: user.id,
        });
      }
    },
    onSuccess: () => {
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "stages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stageId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages", stageId] });
      onStatusChange?.();
      toast({ description: "Статус обновлен" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка обновления статуса", variant: "destructive" });
    },
  });

  const handleStatusChange = (status: string) => {
    setCurrentStatus(status);
    updateStatusMutation.mutate(status);
  };

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: {
        'x-user-id': user?.id || '',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Ошибка загрузки изображения');
    }

    const data = await response.json();
    return data.objectPath;
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !pastedImage) || !user?.id) return;

    let messageToSend = newMessage.trim();

    // Upload image if present
    if (pastedImage) {
      try {
        const imageUrl = await uploadImage(pastedImage);
        messageToSend = messageToSend
          ? `${messageToSend}\n[img]${imageUrl}[/img]`
          : `[img]${imageUrl}[/img]`;
        setPastedImage(null);
        setImagePreview(null);
      } catch (error) {
        toast({
          description: "Ошибка загрузки изображения",
          variant: "destructive"
        });
        return;
      }
    }

    createMessageMutation.mutate(messageToSend);
  };

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPastedImage(file);
          const reader = new FileReader();
          reader.onload = (event) => {
            setImagePreview(event.target?.result as string);
          };
          reader.readAsDataURL(file);
          toast({ description: "Изображение добавлено. Нажмите отправить." });
        }
        break;
      }
    }
  }, [toast]);

  const handleRemoveImage = useCallback(() => {
    setPastedImage(null);
    setImagePreview(null);
  }, []);

  const uploadFiles = async (files: FileList) => {
    if (!user?.id) {
      toast({ description: "Требуется авторизация", variant: "destructive" });
      return;
    }
    
    setUploadingFile(true);
    try {
      const uploadPromises = Array.from(files).map(file =>
        apiRequest("POST", "/api/documents", {
          name: file.name,
          type: "other",
          file_path: "",
          project_stage_id: stageId,
          uploaded_by: user.id,
        })
      );
      
      await Promise.all(uploadPromises);
      
      await apiRequest("POST", `/api/stages/${stageId}/messages`, {
        message: `Загружено файлов: ${Array.from(files).map(f => f.name).join(', ')}`,
        user_id: user.id,
      });
      
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stageId, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stages", stageId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "documents"] });
      toast({ description: `Загружено файлов: ${files.length}` });
    } catch (error) {
      toast({ description: "Ошибка загрузки файлов", variant: "destructive" });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFiles(files);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Определение иконки файла по расширению
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'svg':
        return <Image className="w-4 h-4 text-blue-500" />;
      case 'pdf':
        return <FileText className="w-4 h-4 text-red-500" />;
      case 'xlsx':
      case 'xls':
      case 'csv':
        return <FileSpreadsheet className="w-4 h-4 text-green-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-4 h-4 text-blue-600" />;
      default:
        return <File className="w-4 h-4 text-muted-foreground" />;
    }
  };

  // Специальный layout для Снабжения
  if (isProcurement && stage && projectId) {
    return (
      <div className="grid gap-2 grid-cols-[2fr_1fr]">
        {/* Левая колонка: только Excel сравнение */}
        <div>
          <ExcelComparisonView stageId={stageId} projectId={projectId} />
        </div>

        {/* Правая колонка: статус + чат */}
        <div className="space-y-2">
          {/* Компактный статус */}
          <div className="flex items-center justify-end gap-2">
            <Select value={currentStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-32 h-8" data-testid="select-stage-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">⚪ Ожидает</SelectItem>
                <SelectItem value="in_progress">🔵 В работе</SelectItem>
                <SelectItem value="completed">🟢 Завершён</SelectItem>
              </SelectContent>
            </Select>
            {currentStatus === 'completed' && stage.actual_end_date && (
              <span className="text-xs text-muted-foreground">
                {new Date(stage.actual_end_date).toLocaleDateString('ru-RU')}
              </span>
            )}
          </div>

          {/* Чат этапа */}
          <Card>
            <CardHeader className="pb-2 pt-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Чат этапа</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {messages.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 pb-2">
              <ScrollArea className="h-[280px] pr-4">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center py-4">
                      <Send className="w-8 h-8 mx-auto text-muted-foreground/50 mb-1" />
                      <p className="text-xs text-muted-foreground">Нет сообщений</p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <Card
                        key={msg.id}
                        className="border-l-4 border-primary bg-primary/5 dark:bg-primary/10"
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {msg.user_name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">{msg.user_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(msg.created_at).toLocaleString('ru-RU', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                              <div className="text-sm whitespace-pre-wrap break-words">
                                {msg.message.split(/(\[img\][^\[]+\[\/img\])/g).map((part: string, idx: number) => {
                                  const imgMatch = part.match(/\[img\]([^\[]+)\[\/img\]/);
                                  if (imgMatch) {
                                    const imgUrl = imgMatch[1].startsWith('/objects/') ? imgMatch[1] : `/objects/${imgMatch[1]}`;
                                    return (
                                      <img
                                        key={idx}
                                        src={imgUrl}
                                        alt="Изображение"
                                        className="max-h-16 rounded border cursor-pointer hover:opacity-80 transition-all inline-block"
                                        onClick={() => window.open(imgUrl, '_blank')}
                                      />
                                    );
                                  }
                                  return part ? <span key={idx}>{part}</span> : null;
                                })}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>

              {imagePreview && (
                <div className="relative inline-block mb-2">
                  <img src={imagePreview} alt="Preview" className="max-h-32 rounded-lg border" />
                  <Button
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemoveImage}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Textarea
                  ref={textareaRef}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onPaste={handlePaste}
                  placeholder="Сообщение... (Ctrl+V для фото)"
                  className="min-h-[50px] text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  size="icon"
                  onClick={handleSendMessage}
                  disabled={(!newMessage.trim() && !pastedImage) || createMessageMutation.isPending}
                  className="h-auto"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2">
      {/* Left column: Basic info + Measurement form */}
      <div className="space-y-4">
        <Card className={`border-l-4 ${
        currentStatus === 'completed' ? 'border-green-500 bg-green-50/30 dark:bg-green-950/20' :
        currentStatus === 'in_progress' ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20' :
        'border-gray-400 bg-accent/30'
      }`}>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">{stageName}</CardTitle>
            <div className="flex items-center gap-2">
              {!stage?.actual_start_date && stage?.status !== 'in_progress' && (
                <Button
                  onClick={() => startStageMutation.mutate()}
                  disabled={startStageMutation.isPending || blockerInfo?.isBlocked}
                  size="sm"
                  variant="outline"
                  className="h-8"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Начать
                </Button>
              )}
              {stage?.status === 'in_progress' && !stage?.actual_end_date && (
                <Button
                  onClick={() => completeStageMutation.mutate()}
                  disabled={completeStageMutation.isPending}
                  size="sm"
                  variant="outline"
                  className="h-8"
                >
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Завершить
                </Button>
              )}
              <Select value={currentStatus} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-32 h-8" data-testid="select-stage-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⚪ Ожидает</SelectItem>
                  <SelectItem value="in_progress">🔵 В работе</SelectItem>
                  <SelectItem value="completed">🟢 Завершён</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-3">
          <div className="flex gap-3 text-sm text-muted-foreground">
            {stageDeadline && (
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(stageDeadline).toLocaleDateString('ru-RU')}
              </div>
            )}
            {stageCost && !isNaN(parseFloat(stageCost)) && (
              <div className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {parseFloat(stageCost).toLocaleString('ru-RU')} ₽
              </div>
            )}
          </div>

          {stage && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                {stage.planned_start_date && (
                  <div>
                    <p className="text-muted-foreground">План начала</p>
                    <p className="font-medium">{new Date(stage.planned_start_date).toLocaleDateString('ru-RU')}</p>
                  </div>
                )}
                {stage.planned_end_date && (
                  <div>
                    <p className="text-muted-foreground">План окончания</p>
                    <p className="font-medium">{new Date(stage.planned_end_date).toLocaleDateString('ru-RU')}</p>
                  </div>
                )}
                {stage.actual_start_date && (
                  <div>
                    <p className="text-muted-foreground">Фактически начат</p>
                    <p className="font-medium">{new Date(stage.actual_start_date).toLocaleDateString('ru-RU')}</p>
                  </div>
                )}
                {stage.actual_end_date && (
                  <div>
                    <p className="text-muted-foreground">Фактически завершен</p>
                    <p className="font-medium">{new Date(stage.actual_end_date).toLocaleDateString('ru-RU')}</p>
                  </div>
                )}
              </div>

              {stage.status === 'in_progress' && stage.planned_end_date && (
                <div className="pt-2">
                  {(() => {
                    const now = new Date();
                    const deadline = new Date(stage.planned_end_date);
                    const diffTime = deadline.getTime() - now.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isOverdue = diffDays < 0;
                    
                    return (
                      <div className={`p-3 rounded-md ${isOverdue ? 'bg-destructive/10' : 'bg-primary/10'}`}>
                        <p className="text-sm font-medium">
                          {isOverdue ? (
                            <>Просрочка: {Math.abs(diffDays)} дн.</>
                          ) : (
                            <>Осталось: {diffDays} дн.</>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Крайний срок: {deadline.toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Предупреждение о блокировке этапа */}
              {blockerInfo?.isBlocked && stage.status !== 'in_progress' && stage.status !== 'completed' && (
                <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30 space-y-2 mt-2">
                  <div className="flex items-start gap-2">
                    <Lock className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-destructive mb-1">Этап заблокирован</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        Для начала этапа необходимо завершить следующие этапы:
                      </p>
                      <div className="space-y-1">
                        {blockerInfo.blockers.map((blocker) => (
                          <div key={blocker.id} className="flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 text-destructive" />
                            <span className="font-medium">{blocker.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {blocker.status === 'pending' ? 'Ожидает' : 'В работе'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              
              {/* Зависимости этапов */}
              {(stageDependencies.length > 0 || dependentStages.length > 0) && (
                <div className="space-y-3 pt-4 border-t mt-4">
                  {stageDependencies.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Link2 className="w-4 h-4 text-primary" />
                        <span>Этот этап зависит от:</span>
                      </div>
                      <div className="flex flex-wrap gap-2 ml-6">
                        {stageDependencies.map(dep => (
                          <Badge key={dep.id} variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/20">
                            {getStageName(dep.depends_on_stage_id)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {dependentStages.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <TrendingUp className="w-4 h-4 text-orange-500" />
                        <span>От этого этапа зависят:</span>
                      </div>
                      <div className="flex flex-wrap gap-2 ml-6">
                        {dependentStages.map(dep => (
                          <Badge key={dep.id} variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950/20">
                            {getStageName(dep.dependent_stage_id)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
        </Card>

        {/* Specialized stage forms based on stage type */}
        {stage && stage.stage_type_id && stageType && (
          <>
            {stageType.code === 'measurement' && (
              <MeasurementStageForm
                stage={stage}
                onDataChange={(data) => updateMeasurementDataMutation.mutate(data)}
                readOnly={stage.status === 'completed'}
              />
            )}
            {stageType.code === 'technical_specification' && (
              <TechnicalSpecificationStageForm
                stage={stage}
                onDataChange={(data) => updateTechnicalSpecDataMutation.mutate(data)}
                readOnly={stage.status === 'completed'}
              />
            )}
            {stageType.code === 'constructor_documentation' && (
              <ConstructorDocumentationStageForm
                stage={stage}
                onDataChange={(data) => updateConstructorDocDataMutation.mutate(data)}
                readOnly={stage.status === 'completed'}
              />
            )}
            {stageType.code === 'approval' && (
              <ApprovalStageForm
                stage={stage}
                onDataChange={(data) => updateApprovalDataMutation.mutate(data)}
                readOnly={stage.status === 'completed'}
              />
            )}
            {stageType.code === 'procurement' && (
              <ProcurementStageForm
                stage={stage}
                onDataChange={(data) => updateProcurementDataMutation.mutate(data)}
                readOnly={stage.status === 'completed'}
              />
            )}
            {stageType.code === 'production' && projectId && (
              <ProductionStageForm
                stage={stage}
                projectId={projectId}
                onDataChange={(data) => updateProductionDataMutation.mutate(data)}
                readOnly={stage.status === 'completed'}
              />
            )}
            {stageType.code === 'installation' && projectId && (
              <InstallationStageForm
                stage={stage}
                projectId={projectId}
                onDataChange={(data) => updateInstallationDataMutation.mutate(data)}
                readOnly={stage.status === 'completed'}
              />
            )}
          </>
        )}
      </div>

      {/* Right column: Documents + Chat */}
      <div className="space-y-4">
        {/* Документы этапа - скрываем для Снабжения */}
        {!isProcurement && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Документы этапа</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {documents.length}
            </Badge>
          </div>
        </CardHeader>
          <CardContent className="space-y-2 pb-3">
            {documents.length === 0 ? (
              <div className="text-center py-6">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Нет документов</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {documents.map((doc: any) => (
                  <FilePreview
                    key={doc.id}
                    file={{
                      id: doc.id,
                      file_name: doc.file_name || doc.name,
                      file_size: doc.file_size || 0,
                      mime_type: doc.mime_type,
                      created_at: doc.created_at || new Date().toISOString()
                    }}
                    downloadUrl={doc.file_url}
                    compact
                  />
                ))}
              </div>
            )}
            <div
              className={`relative border-2 border-dashed rounded-lg p-6 transition-all duration-200 ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.02]'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <div className="flex flex-col items-center gap-2">
                <Upload className={`w-8 h-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {uploadingFile ? "Загрузка..." : "Перетащите файлы сюда"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    или нажмите для выбора
                  </p>
                </div>
                <Input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  disabled={uploadingFile}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  data-testid="input-file-upload"
                />
              </div>
            </div>
          </CardContent>
        </Card>
        )}

      {/* Все документы проекта - скрываем для Снабжения */}
      {!isProcurement && projectId && allProjectDocuments.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Все документы проекта</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {allProjectDocuments.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <ScrollArea className="h-[300px]">
              <div className="grid grid-cols-2 gap-3 pr-4">
                {allProjectDocuments.map((doc: any) => (
                  <FilePreview
                    key={doc.id}
                    file={{
                      id: doc.id,
                      file_name: doc.file_name || doc.name,
                      file_size: doc.file_size || 0,
                      mime_type: doc.mime_type,
                      created_at: doc.created_at || new Date().toISOString()
                    }}
                    downloadUrl={doc.file_url}
                    compact
                  />
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Чат этапа</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {messages.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-3">
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-6">
                  <Send className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">Нет сообщений</p>
                  <p className="text-xs text-muted-foreground mt-1">Начните обсуждение этапа</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <Card
                    key={msg.id}
                    className="border-l-4 border-primary bg-primary/5 dark:bg-primary/10"
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {msg.user_name?.charAt(0)?.toUpperCase() || '?'}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">{msg.user_name}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(msg.created_at).toLocaleString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <div className="text-sm whitespace-pre-wrap break-words">
                            {msg.message.split(/(\[img\][^\[]+\[\/img\])/g).map((part: string, idx: number) => {
                              const imgMatch = part.match(/\[img\]([^\[]+)\[\/img\]/);
                              if (imgMatch) {
                                // imgUrl может быть /objects/uuid.ext или просто uuid.ext
                                // Формируем корректный URL для endpoint /objects/:objectPath
                                const imgUrl = imgMatch[1].startsWith('/objects/') ? imgMatch[1] : `/objects/${imgMatch[1]}`;
                                const fullUrl = imgUrl;
                                return (
                                  <img
                                    key={idx}
                                    src={fullUrl}
                                    alt="Изображение"
                                    className="max-h-16 rounded border cursor-pointer hover:opacity-80 hover:shadow-md transition-all inline-block"
                                    title="Нажмите для увеличения"
                                    onClick={() => window.open(fullUrl, '_blank')}
                                  />
                                );
                              }
                              return part ? <span key={idx}>{part}</span> : null;
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Image preview */}
          {imagePreview && (
            <div className="relative inline-block mb-2">
              <img
                src={imagePreview}
                alt="Preview"
                className="max-h-32 rounded-lg border"
              />
              <Button
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={handleRemoveImage}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onPaste={handlePaste}
              placeholder="Написать сообщение... (Ctrl+V для фото)"
              className="min-h-[80px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              data-testid="textarea-stage-message"
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={(!newMessage.trim() && !pastedImage) || createMessageMutation.isPending}
              data-testid="button-send-message"
              className="h-auto"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Card - скрываем для Снабжения */}
      {!isProcurement && (
      <>
        <Card>
          <CardHeader className="pb-2 pt-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Задачи этапа</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {tasks.length}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setCreateTaskDialogOpen(true)}
                  className="h-7 text-xs"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Добавить
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <TaskList
              stageId={stageId}
              onTaskClick={(taskId) => setTaskDetailId(taskId)}
            />
          </CardContent>
        </Card>

        <CreateTaskDialog
          open={createTaskDialogOpen}
          onOpenChange={setCreateTaskDialogOpen}
          projectId={projectId}
          stageId={stageId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'tasks'] });
          }}
        />

        <TaskDetailDialog
          taskId={taskDetailId}
          open={!!taskDetailId}
          onOpenChange={(open) => !open && setTaskDetailId(null)}
        />
      </>
      )}
      </div>
    </div>
  );
}
