import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Image, Video, Mic, Loader2, Check, Play, CheckCircle, Package } from "lucide-react";
import type { ProjectStage, ProjectItem, Project } from "@shared/schema";
import { StageMediaGallery } from "./StageMediaGallery";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface MeasurementStageData {
  address?: string;
  cost?: number;
  measurement_date?: string;
  notes?: string;
  photos?: string[];
  videos?: string[];
  audio_files?: string[];
  // Support for multiple furniture positions in one measurement
  item_ids?: string[]; // List of project item IDs
}

interface MeasurementStageFormProps {
  stage?: ProjectStage;
  onDataChange?: (data: MeasurementStageData) => void;
  readOnly?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function MeasurementStageForm({ stage, onDataChange, readOnly = false }: MeasurementStageFormProps) {
  const { toast } = useToast();

  // Parse existing type_data if available
  const initialData: MeasurementStageData = stage?.type_data
    ? (typeof stage.type_data === 'string' ? JSON.parse(stage.type_data) : stage.type_data)
    : {};

  const [formData, setFormData] = useState<MeasurementStageData>(initialData);
  const [measurementDate, setMeasurementDate] = useState<Date | undefined>(
    initialData.measurement_date ? new Date(initialData.measurement_date) : undefined
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Get current user
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  // Get all item IDs (from type_data.item_ids or fallback to stage.item_id)
  const itemIds = formData.item_ids || (stage?.item_id ? [stage.item_id] : []);

  // Fetch all project items for this measurement
  const { data: projectItems = [] } = useQuery<ProjectItem[]>({
    queryKey: ['/api/projects/items', 'multiple', itemIds.join(',')],
    queryFn: async () => {
      if (itemIds.length === 0) return [];
      // Fetch each item separately and combine
      const items = await Promise.all(
        itemIds.map(id => apiRequest('GET', `/api/projects/items/${id}`))
      );
      return items.filter(Boolean);
    },
    enabled: itemIds.length > 0,
  });

  // Fetch project data for address
  const { data: project } = useQuery<Project>({
    queryKey: ['/api/projects', stage?.project_id],
    enabled: !!stage?.project_id,
  });

  // Initialize item_ids from stage.item_id if not already set
  useEffect(() => {
    if (stage?.item_id && !formData.item_ids) {
      const updatedData = {
        ...formData,
        item_ids: [stage.item_id]
      };
      setFormData(updatedData);
      if (!readOnly) {
        onDataChange?.(updatedData);
      }
    }
  }, [stage?.item_id, formData.item_ids]);

  // Start stage mutation
  const startStageMutation = useMutation({
    mutationFn: async () => {
      if (!stage?.id) throw new Error("Stage ID is required");
      return await apiRequest("POST", `/api/projects/stages/${stage.id}/start`, {
        user_id: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-measurement-tasks"] });
      toast({ description: "Замер начат" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка при начале замера",
        variant: "destructive"
      });
    }
  });

  // Complete stage mutation
  const completeStageMutation = useMutation({
    mutationFn: async () => {
      if (!stage?.id) throw new Error("Stage ID is required");
      return await apiRequest("POST", `/api/projects/stages/${stage.id}/complete`, {
        user_id: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-measurement-tasks"] });
      toast({ description: "Замер завершен" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка при завершении замера",
        variant: "destructive"
      });
    }
  });

  // Reopen stage mutation
  const reopenStageMutation = useMutation({
    mutationFn: async () => {
      if (!stage?.id) throw new Error("Stage ID is required");
      return await apiRequest("PUT", `/api/projects/stages/${stage.id}`, {
        status: "in_progress",
        user_id: user?.id
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-measurement-tasks"] });
      toast({ description: "Замер переоткрыт" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка при переоткрытии замера",
        variant: "destructive"
      });
    }
  });

  // Helper function to get status badge
  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 text-white">Завершено</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500 text-white">В работе</Badge>;
      case "pending":
        return <Badge variant="secondary">Ожидает</Badge>;
      case "blocked":
        return <Badge variant="destructive">Заблокировано</Badge>;
      default:
        return <Badge variant="outline">{status || "Не указан"}</Badge>;
    }
  };

  // Debounced save function
  const debouncedSave = useCallback((data: MeasurementStageData) => {
    // Clear existing timeout
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }

    setSaveStatus('saving');

    // Set new timeout
    const timeoutId = setTimeout(() => {
      onDataChange?.(data);
      setSaveStatus('saved');

      // Reset to idle after showing "saved" status
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }, 1000); // Wait 1 second after last change

    setSaveTimeoutId(timeoutId);
  }, [onDataChange, saveTimeoutId]);

  const handleFieldChange = (field: keyof MeasurementStageData, value: any) => {
    const updatedData = {
      ...formData,
      [field]: value,
    };
    setFormData(updatedData);

    if (!readOnly) {
      debouncedSave(updatedData);
    }
  };

  const handleDateChange = (date: Date | undefined) => {
    setMeasurementDate(date);
    handleFieldChange('measurement_date', date?.toISOString());
  };

  const handleSaveNow = () => {
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }
    setSaveStatus('saving');
    onDataChange?.(formData);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 300);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
      }
    };
  }, [saveTimeoutId]);

  // Format currency helper
  const formatCurrency = (amount: string | null) => {
    if (!amount) return "0 ₽";
    return `${parseFloat(amount).toLocaleString("ru-RU")} ₽`;
  };

  return (
    <div className="space-y-2">
      {/* Информация о позициях мебели для замера */}
      {projectItems.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              {projectItems.length === 1
                ? 'Позиция мебели для замера'
                : `Позиции мебели для замера (${projectItems.length})`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pb-3">
            {projectItems.map((projectItem, index) => (
              <div key={projectItem.id} className={cn(
                "flex gap-3 pb-3",
                index < projectItems.length - 1 && "border-b"
              )}>
                {projectItem.image_url ? (
                  <img
                    src={projectItem.image_url}
                    alt={projectItem.name}
                    className="w-20 h-20 object-cover rounded border flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 flex items-center justify-center bg-muted rounded border flex-shrink-0">
                    <Package className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 space-y-1">
                  <p className="font-semibold text-base">{projectItem.name}</p>
                  {projectItem.article && (
                    <p className="text-xs text-muted-foreground">Арт: {projectItem.article}</p>
                  )}
                  <div className="flex items-center gap-3 text-sm flex-wrap">
                    <span className="text-muted-foreground">
                      Количество: <span className="font-medium text-foreground">{projectItem.quantity} {projectItem.unit || 'шт'}</span>
                    </span>
                    {projectItem.price && (
                      <span className="text-muted-foreground">
                        Цена: <span className="font-medium text-foreground">{formatCurrency(projectItem.price)}</span>
                      </span>
                    )}
                  </div>
                  {projectItem.price && (
                    <div className="pt-1 border-t">
                      <span className="text-xs text-muted-foreground">
                        Итого: <span className="font-semibold text-sm text-foreground">
                          {formatCurrency((parseFloat(projectItem.price) * projectItem.quantity).toString())}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Основная информация */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="space-y-2">
            {/* Title and Status Row */}
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                📏 Замер
              </CardTitle>
              <div className="flex items-center gap-2">
                {getStatusBadge(stage?.status)}
                {saveStatus !== 'idle' && (
                  <Badge
                    variant={saveStatus === 'saved' ? "default" : "secondary"}
                    className={cn("gap-1 text-xs", saveStatus === 'saved' && "bg-green-500")}
                  >
                    {saveStatus === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    {saveStatus === 'saving' ? 'Сохранение...' : 'Сохранено'}
                  </Badge>
                )}
              </div>
            </div>

            {/* Status Control Buttons */}
            <div className="flex items-center gap-2">
              {stage?.status === "pending" && (
                <Button
                  size="sm"
                  variant="default"
                  className="w-full h-9 gap-2"
                  onClick={() => startStageMutation.mutate()}
                  disabled={startStageMutation.isPending}
                >
                  {startStageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Начать замер
                </Button>
              )}
              {stage?.status === "in_progress" && (
                <Button
                  size="sm"
                  variant="default"
                  className="w-full h-9 gap-2 bg-green-600 hover:bg-green-700"
                  onClick={() => completeStageMutation.mutate()}
                  disabled={completeStageMutation.isPending}
                >
                  {completeStageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Завершить замер
                </Button>
              )}
              {stage?.status === "completed" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-9 gap-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                  onClick={() => reopenStageMutation.mutate()}
                  disabled={reopenStageMutation.isPending}
                >
                  {reopenStageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Переоткрыть замер
                </Button>
              )}
            </div>

            {/* Dates Display */}
            {(stage?.actual_start_date || stage?.actual_end_date || stage?.planned_start_date) && (
              <div className="text-xs text-muted-foreground space-y-1">
                {stage?.actual_start_date && (
                  <div>Начато: {format(new Date(stage.actual_start_date), "dd MMMM yyyy, HH:mm", { locale: ru })}</div>
                )}
                {stage?.actual_end_date && (
                  <div>Завершено: {format(new Date(stage.actual_end_date), "dd MMMM yyyy, HH:mm", { locale: ru })}</div>
                )}
                {stage?.planned_start_date && !stage?.actual_start_date && (
                  <div>Планируемое начало: {format(new Date(stage.planned_start_date), "dd MMMM yyyy", { locale: ru })}</div>
                )}
                {stage?.planned_end_date && !stage?.actual_end_date && (
                  <div>Планируемое окончание: {format(new Date(stage.planned_end_date), "dd MMMM yyyy", { locale: ru })}</div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-3">
          {/* Адрес + Стоимость (read-only, auto-filled from project) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="address" className="text-xs text-muted-foreground">Адрес объекта</Label>
              <Input
                id="address"
                value={(project as any)?.address || formData.address || "Не указан"}
                readOnly
                disabled
                className="h-9 text-sm bg-muted/30"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cost" className="text-xs text-muted-foreground">Стоимость замера</Label>
              <Input
                id="cost"
                value={formData.cost ? `${formData.cost} ₽` : "Не указана"}
                readOnly
                disabled
                className="h-9 text-sm bg-muted/30"
              />
            </div>
          </div>

          {/* Дата замера (editable) */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Дата замера</Label>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                    !measurementDate && "text-muted-foreground"
                  )}
                  disabled={readOnly}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {measurementDate ? format(measurementDate, "dd.MM.yyyy") : "Выберите дату замера"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={measurementDate}
                  onSelect={handleDateChange}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Примечания (read-only, но хорошо видимые) */}
          <div className="space-y-1">
            <Label htmlFor="notes" className="text-xs text-muted-foreground">Примечания для замерщика</Label>
            <Textarea
              id="notes"
              value={formData.notes || "Нет примечаний"}
              readOnly
              disabled
              rows={3}
              className="resize-none text-sm bg-muted/30 min-h-[80px] leading-relaxed"
            />
          </div>
        </CardContent>
      </Card>

      {/* Медиафайлы */}
      {stage && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm">Медиафайлы</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <Tabs defaultValue="photos" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-8">
                <TabsTrigger value="photos" className="gap-1 text-xs">
                  <Image className="h-3.5 w-3.5" />
                  Фото
                </TabsTrigger>
                <TabsTrigger value="videos" className="gap-1 text-xs">
                  <Video className="h-3.5 w-3.5" />
                  Видео
                </TabsTrigger>
                <TabsTrigger value="audio" className="gap-1 text-xs">
                  <Mic className="h-3.5 w-3.5" />
                  Аудио
                </TabsTrigger>
              </TabsList>
              <TabsContent value="photos" className="mt-2">
                <StageMediaGallery
                  stageId={stage.id}
                  mediaType="photo"
                  title="Фотографии"
                  icon={<Image className="h-4 w-4" />}
                  acceptedTypes="image/*"
                  readOnly={readOnly}
                />
              </TabsContent>
              <TabsContent value="videos" className="mt-2">
                <StageMediaGallery
                  stageId={stage.id}
                  mediaType="video"
                  title="Видеозаписи"
                  icon={<Video className="h-4 w-4" />}
                  acceptedTypes="video/*"
                  readOnly={readOnly}
                />
              </TabsContent>
              <TabsContent value="audio" className="mt-2">
                <StageMediaGallery
                  stageId={stage.id}
                  mediaType="audio"
                  title="Аудиозаписи"
                  icon={<Mic className="h-4 w-4" />}
                  acceptedTypes="audio/*"
                  readOnly={readOnly}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
