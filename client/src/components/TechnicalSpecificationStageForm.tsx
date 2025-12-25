import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, Play, CheckCircle, Link as LinkIcon, FileText, Calendar, Image, Video, Mic } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TechnicalSpecOriginalPositionCard } from "./TechnicalSpecOriginalPositionCard";
import { TechnicalSpecAddonsTable } from "./TechnicalSpecAddonsTable";
import { TechnicalSpecComparison } from "./TechnicalSpecComparison";
import { StageMediaGallery } from "./StageMediaGallery";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TechnicalSpecificationData, TechSpecAddon } from "@/types/technicalSpecification";
import type { ProjectStage } from "@shared/schema";

interface TechnicalSpecificationStageFormProps {
  stage?: ProjectStage;
  onDataChange?: (data: TechnicalSpecificationData) => void;
  readOnly?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function TechnicalSpecificationStageForm({
  stage,
  onDataChange,
  readOnly = false
}: TechnicalSpecificationStageFormProps) {
  const { toast } = useToast();

  // Parse existing type_data if available
  const initialData: TechnicalSpecificationData = stage?.type_data
    ? (typeof stage.type_data === 'string' ? JSON.parse(stage.type_data) : stage.type_data)
    : {
        projectItemId: stage?.item_id || "",
        originalPosition: {
          itemId: stage?.item_id || "",
          name: "",
          price: 0,
          quantity: 0,
          unit: "шт",
          total: 0
        },
        addons: [],
        history: [],
        recentlyAdded: { addons: [], files: [] },
        reopenHistory: []
      };

  const [formData, setFormData] = useState<TechnicalSpecificationData>(initialData);
  const [googleDriveUrl, setGoogleDriveUrl] = useState(initialData.googleDriveUrl || "");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);

  // Planned dates state
  const [plannedStartDate, setPlannedStartDate] = useState<string>(
    stage?.planned_start_date ? format(new Date(stage.planned_start_date), "yyyy-MM-dd") : ""
  );
  const [plannedEndDate, setPlannedEndDate] = useState<string>(
    stage?.planned_end_date ? format(new Date(stage.planned_end_date), "yyyy-MM-dd") : ""
  );

  // Get current user
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  // Fetch original position data from project_items if not cached
  const { data: projectItem, isLoading: isLoadingItem } = useQuery({
    queryKey: ['/api/projects/items', stage?.item_id],
    queryFn: async () => {
      if (!stage?.item_id) return null;
      return await apiRequest('GET', `/api/projects/items/${stage.item_id}`);
    },
    enabled: !!stage?.item_id && !initialData.originalPosition.name
  });

  // Fetch measurement stage for the same item to display media
  const { data: measurementStage } = useQuery<ProjectStage>({
    queryKey: [`/api/projects/${stage?.project_id}/stages`, 'measurement', stage?.item_id],
    queryFn: async () => {
      if (!stage?.project_id || !stage?.item_id) return null;
      const stages = await apiRequest('GET', `/api/projects/${stage.project_id}/stages`);
      // Find measurement stage for the same item
      return stages.find((s: ProjectStage) =>
        s.stage_type_id === 'measurement' && s.item_id === stage.item_id
      ) || null;
    },
    enabled: !!stage?.project_id && !!stage?.item_id
  });

  // Initialize original position from project item if needed
  useEffect(() => {
    if (projectItem && !formData.originalPosition.name) {
      const originalPosition = {
        itemId: projectItem.id,
        name: projectItem.name,
        article: projectItem.article,
        price: projectItem.price || 0,
        quantity: projectItem.quantity || 0,
        unit: projectItem.unit || "шт",
        total: (projectItem.price || 0) * (projectItem.quantity || 0),
        imageUrl: projectItem.image_url
      };

      setFormData(prev => ({
        ...prev,
        projectItemId: projectItem.id,
        originalPosition
      }));
    }
  }, [projectItem, formData.originalPosition.name]);

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
      toast({ description: "Этап ТЗ начат" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка при начале этапа",
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
      toast({ description: "Этап ТЗ завершен" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка при завершении этапа",
        variant: "destructive"
      });
    }
  });

  // Reopen stage mutation
  const reopenStageMutation = useMutation({
    mutationFn: async () => {
      if (!stage?.id) throw new Error("Stage ID is required");

      // Add to reopen history
      const updatedData: TechnicalSpecificationData = {
        ...formData,
        reopenHistory: [
          ...formData.reopenHistory,
          {
            reopenedAt: new Date().toISOString(),
            reopenedBy: user?.id || "unknown",
            reopenedByName: user?.full_name || user?.username || "Unknown"
          }
        ]
      };

      return await apiRequest("PUT", `/api/projects/stages/${stage.id}`, {
        status: "in_progress",
        user_id: user?.id,
        type_data: JSON.stringify(updatedData)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages"] });
      toast({ description: "Этап переоткрыт" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка при переоткрытии этапа",
        variant: "destructive"
      });
    }
  });

  // Update planned dates mutation
  const updatePlannedDatesMutation = useMutation({
    mutationFn: async ({ startDate, endDate }: { startDate?: string; endDate?: string }) => {
      if (!stage?.id) throw new Error("Stage ID is required");

      return await apiRequest("PUT", `/api/projects/stages/${stage.id}`, {
        planned_start_date: startDate ? new Date(startDate).toISOString() : stage.planned_start_date,
        planned_end_date: endDate ? new Date(endDate).toISOString() : stage.planned_end_date,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages"] });
      toast({ description: "Плановые даты обновлены" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка при обновлении дат",
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
  const debouncedSave = useCallback((data: TechnicalSpecificationData) => {
    if (saveTimeoutId) {
      clearTimeout(saveTimeoutId);
    }

    setSaveStatus('saving');

    const timeoutId = setTimeout(() => {
      onDataChange?.(data);
      setSaveStatus('saved');

      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);
    }, 1000);

    setSaveTimeoutId(timeoutId);
  }, [onDataChange, saveTimeoutId]);

  const handleAddonsChange = (addons: TechSpecAddon[]) => {
    const updatedData = {
      ...formData,
      addons
    };
    setFormData(updatedData);

    if (!readOnly) {
      debouncedSave(updatedData);
    }
  };

  const handleGoogleDriveUrlChange = (url: string) => {
    setGoogleDriveUrl(url);
    const updatedData = {
      ...formData,
      googleDriveUrl: url
    };
    setFormData(updatedData);

    if (!readOnly) {
      debouncedSave(updatedData);
    }
  };

  // Handle planned date changes
  const handlePlannedStartDateChange = (date: string) => {
    setPlannedStartDate(date);
    updatePlannedDatesMutation.mutate({ startDate: date });
  };

  const handlePlannedEndDateChange = (date: string) => {
    setPlannedEndDate(date);
    updatePlannedDatesMutation.mutate({ endDate: date });
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId);
      }
    };
  }, [saveTimeoutId]);

  if (isLoadingItem) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="space-y-2">
            {/* Title and Status Row */}
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                📋 Техническое задание
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
                  Начать работу над ТЗ
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
                  Завершить ТЗ
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
                  Переоткрыть ТЗ
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
      </Card>

      {/* Planned Dates Editor */}
      <Card>
        <CardHeader className="pb-3 pt-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Плановые сроки
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="plannedStartDate" className="text-xs text-muted-foreground">
                Планируемое начало
              </Label>
              <Input
                id="plannedStartDate"
                type="date"
                value={plannedStartDate}
                onChange={(e) => handlePlannedStartDateChange(e.target.value)}
                disabled={readOnly}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedEndDate" className="text-xs text-muted-foreground">
                Планируемое окончание
              </Label>
              <Input
                id="plannedEndDate"
                type="date"
                value={plannedEndDate}
                onChange={(e) => handlePlannedEndDateChange(e.target.value)}
                disabled={readOnly}
                className="h-9"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Original Position Card */}
      {formData.originalPosition.name && (
        <TechnicalSpecOriginalPositionCard originalPosition={formData.originalPosition} />
      )}

      {/* Measurement Media (Photos/Videos/Audio from Measurement Stage) */}
      {measurementStage && (
        <Card>
          <CardHeader className="pb-2 pt-3">
            <CardTitle className="text-sm flex items-center gap-2">
              📸 Медиафайлы из замера
            </CardTitle>
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
                  stageId={measurementStage.id}
                  mediaType="photo"
                  title="Фотографии с замера"
                  icon={<Image className="h-4 w-4" />}
                  acceptedTypes="image/*"
                  readOnly={true}
                />
              </TabsContent>
              <TabsContent value="videos" className="mt-2">
                <StageMediaGallery
                  stageId={measurementStage.id}
                  mediaType="video"
                  title="Видео с замера"
                  icon={<Video className="h-4 w-4" />}
                  acceptedTypes="video/*"
                  readOnly={true}
                />
              </TabsContent>
              <TabsContent value="audio" className="mt-2">
                <StageMediaGallery
                  stageId={measurementStage.id}
                  mediaType="audio"
                  title="Аудио с замера"
                  icon={<Mic className="h-4 w-4" />}
                  acceptedTypes="audio/*"
                  readOnly={true}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Google Drive Link */}
      <Card>
        <CardHeader className="pb-3 pt-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <LinkIcon className="w-4 h-4" />
            Ссылка на Google Drive
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="space-y-2">
            <Label htmlFor="googleDriveUrl" className="text-xs text-muted-foreground">
              Ссылка на файлы в Google Drive
            </Label>
            <Input
              id="googleDriveUrl"
              type="url"
              value={googleDriveUrl}
              onChange={(e) => handleGoogleDriveUrlChange(e.target.value)}
              placeholder="https://drive.google.com/..."
              disabled={readOnly}
              className="h-9"
            />
            {googleDriveUrl && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-full gap-2"
                onClick={() => window.open(googleDriveUrl, '_blank')}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                Открыть в Google Drive
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Addons Table */}
      <TechnicalSpecAddonsTable
        addons={formData.addons}
        recentlyAdded={formData.recentlyAdded}
        onAddonsChange={handleAddonsChange}
        readOnly={readOnly}
      />

      {/* Comparison View (if there are addons) */}
      {formData.addons.length > 0 && formData.originalPosition.name && (
        <TechnicalSpecComparison techSpecData={formData} />
      )}

      {/* Reopen History */}
      {formData.reopenHistory.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-3">
            <CardTitle className="text-sm">История переоткрытий</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="space-y-2">
              {formData.reopenHistory.map((entry, index) => (
                <div key={index} className="text-xs text-muted-foreground">
                  {format(new Date(entry.reopenedAt), "dd.MM.yyyy HH:mm", { locale: ru })} - {entry.reopenedByName}
                  {entry.reason && ` (${entry.reason})`}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
