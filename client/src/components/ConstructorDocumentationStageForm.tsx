import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Check, Play, CheckCircle, Link as LinkIcon, Plus, Trash2, Calendar, Package, Scissors } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  ConstructorDocumentationData,
  BasisViewerLink,
  HardwareSpecItem,
  CuttingSpecItem,
  WarehouseComparisonResult,
} from "@/types/constructorDocumentation";
import { getInitialConstructorDocumentationData as getInitialData } from "@/types/constructorDocumentation";
import type { ProjectStage } from "@shared/schema";
import { nanoid } from "nanoid";
import { HardwareSpecTable } from "@/components/HardwareSpecTable";
import { CuttingSpecTable } from "@/components/CuttingSpecTable";

interface ConstructorDocumentationStageFormProps {
  stage?: ProjectStage;
  onDataChange?: (data: ConstructorDocumentationData) => void;
  readOnly?: boolean;
}

type SaveStatus = 'idle' | 'saving' | 'saved';

export function ConstructorDocumentationStageForm({
  stage,
  onDataChange,
  readOnly = false
}: ConstructorDocumentationStageFormProps) {
  const { toast } = useToast();

  // Parse existing type_data if available
  const initialData: ConstructorDocumentationData = stage?.type_data
    ? (typeof stage.type_data === 'string' ? JSON.parse(stage.type_data) : stage.type_data)
    : getInitialData();

  const [formData, setFormData] = useState<ConstructorDocumentationData>(initialData);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(null);
  const [newBasisLink, setNewBasisLink] = useState({ url: "", title: "" });

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
      toast({ description: "Этап КД начат" });
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
      toast({ description: "Этап КД завершен" });
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

      const updatedData: ConstructorDocumentationData = {
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
  const debouncedSave = useCallback((data: ConstructorDocumentationData) => {
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

  // Add basis link
  const handleAddBasisLink = () => {
    if (!newBasisLink.url.trim()) {
      toast({ description: "Введите ссылку", variant: "destructive" });
      return;
    }

    const link: BasisViewerLink = {
      id: nanoid(),
      url: newBasisLink.url,
      title: newBasisLink.title || "Базис документ",
      addedAt: new Date().toISOString(),
      addedBy: user?.id || "unknown",
      addedByName: user?.full_name || user?.username || "Unknown"
    };

    const updatedData = {
      ...formData,
      basisViewerLinks: [...formData.basisViewerLinks, link],
      recentlyAdded: {
        ...formData.recentlyAdded,
        basisLinks: [link.id]
      }
    };

    setFormData(updatedData);
    setNewBasisLink({ url: "", title: "" });

    if (!readOnly) {
      debouncedSave(updatedData);
    }
  };

  // Delete basis link
  const handleDeleteBasisLink = (linkId: string) => {
    if (confirm("Удалить ссылку?")) {
      const updatedData = {
        ...formData,
        basisViewerLinks: formData.basisViewerLinks.filter(link => link.id !== linkId)
      };
      setFormData(updatedData);

      if (!readOnly) {
        debouncedSave(updatedData);
      }
    }
  };

  // Handle hardware spec changes
  const handleHardwareSpecChange = (items: HardwareSpecItem[]) => {
    const updatedData = {
      ...formData,
      hardwareSpec: items
    };
    setFormData(updatedData);
    if (!readOnly) {
      debouncedSave(updatedData);
    }
  };

  // Handle cutting spec changes
  const handleCuttingSpecChange = (items: CuttingSpecItem[]) => {
    const updatedData = {
      ...formData,
      cuttingSpec: items
    };
    setFormData(updatedData);
    if (!readOnly) {
      debouncedSave(updatedData);
    }
  };

  // Handle warehouse comparison completion
  const handleWarehouseComparisonComplete = (comparisonResult: WarehouseComparisonResult) => {
    const updatedData = {
      ...formData,
      warehouseComparison: comparisonResult
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

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card>
        <CardHeader className="pb-2 pt-3">
          <div className="space-y-2">
            {/* Title and Status Row */}
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                📐 Разработка КД
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
                  Начать разработку КД
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
                  Завершить КД
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
                  Переоткрыть КД
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

      {/* Main Content with Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="hardware" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="hardware" className="gap-2">
                <Package className="w-4 h-4" />
                Фурнитура ({formData.hardwareSpec.length})
              </TabsTrigger>
              <TabsTrigger value="cutting" className="gap-2">
                <Scissors className="w-4 h-4" />
                Распил ({formData.cuttingSpec.length})
              </TabsTrigger>
              <TabsTrigger value="basis" className="gap-2">
                <LinkIcon className="w-4 h-4" />
                Базис ({formData.basisViewerLinks.length})
              </TabsTrigger>
            </TabsList>

            {/* Hardware Specification Tab */}
            <TabsContent value="hardware" className="mt-4">
              <HardwareSpecTable
                items={formData.hardwareSpec}
                onChange={handleHardwareSpecChange}
                onComparisonComplete={handleWarehouseComparisonComplete}
                projectId={stage?.project_id}
                readOnly={readOnly}
                userId={user?.id}
                userName={user?.full_name || user?.username}
              />
            </TabsContent>

            {/* Cutting Specification Tab */}
            <TabsContent value="cutting" className="mt-4">
              <CuttingSpecTable
                items={formData.cuttingSpec}
                onChange={handleCuttingSpecChange}
                projectId={stage?.project_id}
                readOnly={readOnly}
                userId={user?.id}
                userName={user?.full_name || user?.username}
              />
            </TabsContent>

            {/* Basis Viewer Links Tab */}
            <TabsContent value="basis" className="mt-4 space-y-4">
              {/* Add new link */}
              {!readOnly && (
                <div className="p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Добавить ссылку на Базис Viewer
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Название (необязательно)"
                      value={newBasisLink.title}
                      onChange={(e) => setNewBasisLink({ ...newBasisLink, title: e.target.value })}
                      className="h-9"
                    />
                    <Input
                      placeholder="https://..."
                      value={newBasisLink.url}
                      onChange={(e) => setNewBasisLink({ ...newBasisLink, url: e.target.value })}
                      className="h-9"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={handleAddBasisLink}
                    className="w-full h-8 gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добавить ссылку
                  </Button>
                </div>
              )}

              {/* Links list */}
              {formData.basisViewerLinks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border rounded-lg">
                  <LinkIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Ссылки не добавлены</p>
                  <p className="text-xs mt-1">Добавьте ссылки на 3D-модели в Базис Viewer</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {formData.basisViewerLinks.map((link) => (
                    <div
                      key={link.id}
                      className={cn(
                        "flex items-center justify-between p-3 border rounded-lg",
                        formData.recentlyAdded.basisLinks.includes(link.id) &&
                          "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-500"
                      )}
                    >
                      <div className="flex-1">
                        <p className="font-medium text-sm">{link.title}</p>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {link.url}
                        </a>
                        <p className="text-xs text-muted-foreground mt-1">
                          Добавлено: {format(new Date(link.addedAt), "dd.MM.yyyy HH:mm", { locale: ru })} - {link.addedByName}
                        </p>
                      </div>
                      {!readOnly && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-2 h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDeleteBasisLink(link.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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
