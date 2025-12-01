import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Plus, Loader2, Trash2, Lock, CheckCircle2, FileText, User as UserIcon } from "lucide-react";
import { insertProjectSchema, type Project, type User, type Deal, type ProjectStage, type ProjectItem, type StageDependency } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { StageDetailView } from "./StageDetailView";

interface ProjectDetailSheetProps {
  project: Project | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailSheet({ project, open, onOpenChange }: ProjectDetailSheetProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [selectedStage, setSelectedStage] = useState<ProjectStage | null>(null);
  const [stageDetailOpen, setStageDetailOpen] = useState(false);
  const [documentsDialogOpen, setDocumentsDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<ProjectStage[]>({
    queryKey: ["/api/projects", project?.id, "stages"],
    enabled: !!project?.id,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<ProjectItem[]>({
    queryKey: ["/api/projects", project?.id, "items"],
    enabled: !!project?.id,
  });

  const { data: dependencies = [], isLoading: dependenciesLoading } = useQuery<StageDependency[]>({
    queryKey: ["/api/projects", project?.id, "dependencies"],
    enabled: !!project?.id,
  });

  const { data: allDocuments = [] } = useQuery<any[]>({
    queryKey: ["/api/projects", project?.id, "documents"],
    enabled: !!project?.id && documentsDialogOpen,
  });

  const form = useForm({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: project?.name || "",
      client_name: project?.client_name || "",
      deal_id: project?.deal_id || "",
      status: project?.status || "pending",
      progress: project?.progress || 0,
      duration_days: project?.duration_days || 0,
      manager_id: project?.manager_id || "",
    },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name || "",
        client_name: project.client_name || "",
        deal_id: project.deal_id || "",
        status: project.status || "pending",
        progress: project.progress || 0,
        duration_days: project.duration_days || 0,
        manager_id: project.manager_id || "",
      });
    }
  }, [project, form]);

  // Функции для работы с зависимостями
  const getStageDependencies = (stageId: string): StageDependency[] => {
    return dependencies.filter(dep => dep.stage_id === stageId);
  };

  const getIncompleteRequiredStages = (stageId: string): ProjectStage[] => {
    const currentStage = stages.find(s => s.id === stageId);
    if (!currentStage) return [];

    const stageDeps = getStageDependencies(stageId);
    
    // Фильтруем только зависимости в пределах одной позиции
    return stageDeps
      .map(dep => stages.find(s => s.id === dep.depends_on_stage_id))
      .filter((s): s is ProjectStage => 
        !!s && 
        s.item_id === currentStage.item_id && 
        s.status !== "completed"
      );
  };

  const canStartStage = (stageId: string): boolean => {
    const incompleteStages = getIncompleteRequiredStages(stageId);
    return incompleteStages.length === 0;
  };

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const projectData = {
        ...data,
        deal_id: data.deal_id || null,
        manager_id: data.manager_id || null,
      };
      await apiRequest("PUT", `/api/projects/${project?.id}`, projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Успешно",
        description: "Проект обновлен",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/projects/${project?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Успешно",
        description: "Проект удален",
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const addStageMutation = useMutation({
    mutationFn: async (stageName: string) => {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.order)) : -1;
      await apiRequest("POST", `/api/projects/${project?.id}/stages`, {
        name: stageName,
        status: "pending",
        order: maxOrder + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Успешно",
        description: "Стадия добавлена",
      });
      setNewStageName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ stageId, status }: { stageId: string; status: string }) => {
      // Проверяем зависимости перед изменением статуса на "in_progress" или "completed"
      if (status !== "pending") {
        const incompleteStages = getIncompleteRequiredStages(stageId);
        if (incompleteStages.length > 0) {
          const stageNames = incompleteStages.map(s => s.name).join(", ");
          throw new Error(`Нельзя запустить этап. Сначала завершите: ${stageNames}`);
        }
      }
      await apiRequest("PUT", `/api/projects/stages/${stageId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Успешно",
        description: "Статус стадии обновлен",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      await apiRequest("DELETE", `/api/projects/stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Успешно",
        description: "Стадия удалена",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    updateMutation.mutate(data);
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const handleAddStage = () => {
    if (newStageName.trim()) {
      addStageMutation.mutate(newStageName.trim());
    }
  };

  const statusLabels: Record<string, string> = {
    pending: "В ожидании",
    in_progress: "В работе",
    completed: "Завершен",
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle data-testid="text-project-sheet-title">Детали проекта</SheetTitle>
            <SheetDescription data-testid="text-project-sheet-description">
              Редактирование информации о проекте
            </SheetDescription>
            {project && (project as any).manager_user && (
              <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                <UserIcon className="h-4 w-4" />
                <span>
                  Менеджер: <span className="font-medium text-foreground">
                    {(project as any).manager_user.full_name || (project as any).manager_user.username}
                  </span>
                </span>
              </div>
            )}
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название проекта</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Название проекта" 
                        data-testid="input-project-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Клиент</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Имя клиента" 
                        data-testid="input-project-client-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deal_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сделка</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project-deal">
                          <SelectValue placeholder="Выберите сделку (опционально)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="option-project-deal-none">
                          Без сделки
                        </SelectItem>
                        {deals.map((deal) => (
                          <SelectItem 
                            key={deal.id} 
                            value={deal.id}
                            data-testid={`option-project-deal-${deal.id}`}
                          >
                            {deal.client_name} - {deal.company || "Нет компании"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Статус</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project-status">
                          <SelectValue placeholder="Выберите статус" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending" data-testid="option-project-status-pending">
                          {statusLabels.pending}
                        </SelectItem>
                        <SelectItem value="in_progress" data-testid="option-project-status-in_progress">
                          {statusLabels.in_progress}
                        </SelectItem>
                        <SelectItem value="completed" data-testid="option-project-status-completed">
                          {statusLabels.completed}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="progress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Прогресс: {field.value}%</FormLabel>
                    <FormControl>
                      <Slider 
                        value={[field.value || 0]} 
                        onValueChange={(value) => field.onChange(value[0])}
                        max={100}
                        step={5}
                        data-testid="slider-project-progress"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Длительность (дней)</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        value={field.value || 0}
                        type="number"
                        disabled
                        data-testid="input-project-duration"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manager_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>РОП</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project-manager">
                          <SelectValue placeholder="Выберите менеджера" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem 
                            key={user.id} 
                            value={user.id}
                            data-testid={`option-project-manager-${user.id}`}
                          >
                            {user.full_name || user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-project"
                >
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-project"
                >
                  Удалить
                </Button>
              </div>
            </form>
          </Form>

          <Card className="mt-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base">Позиции и этапы</CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setDocumentsDialogOpen(true)}
                data-testid="button-project-documents"
              >
                <FileText className="w-4 h-4 mr-2" />
                Документы
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {itemsLoading || stagesLoading || dependenciesLoading ? (
                <div className="text-sm text-muted-foreground" data-testid="text-loading">
                  Загрузка...
                </div>
              ) : items.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="text-no-items">
                  Нет позиций в проекте
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((item, itemIndex) => {
                    const itemStages = stages.filter(s => s.item_id === item.id).sort((a, b) => a.order - b.order);
                    
                    return (
                      <div key={item.id} className="border rounded-lg p-3" data-testid={`item-${itemIndex}`}>
                        <div className="flex gap-4">
                          {/* Позиция слева */}
                          <div className="flex-1 min-w-0 space-y-1">
                            <h4 className="font-medium text-sm" data-testid={`item-name-${itemIndex}`}>
                              {item.name}
                            </h4>
                            {item.article && (
                              <p className="text-xs text-muted-foreground" data-testid={`item-article-${itemIndex}`}>
                                Артикул: {item.article}
                              </p>
                            )}
                            <div className="flex gap-3 text-xs text-muted-foreground">
                              <span data-testid={`item-quantity-${itemIndex}`}>{item.quantity} шт.</span>
                              {item.price && (
                                <span data-testid={`item-price-${itemIndex}`}>
                                  {parseFloat(item.price).toLocaleString('ru-RU')} ₽
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Этапы справа */}
                          <div className="flex-1 space-y-2">
                            {itemStages.length === 0 ? (
                              <p className="text-xs text-muted-foreground" data-testid={`item-no-stages-${itemIndex}`}>
                                Нет этапов
                              </p>
                            ) : (
                              itemStages.map((stage, stageIndex) => {
                                const stageDeps = getStageDependencies(stage.id);
                                const incompleteStages = getIncompleteRequiredStages(stage.id);
                                const isBlocked = incompleteStages.length > 0 && stage.status === "pending";

                                return (
                                  <div 
                                    key={stage.id} 
                                    className="space-y-1"
                                    data-testid={`stage-${itemIndex}-${stageIndex}`}
                                  >
                                    <div className="flex items-center gap-2">
                                      {/* Индикатор статуса */}
                                      {stage.status === "completed" ? (
                                        <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                                      ) : isBlocked ? (
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p className="text-xs">
                                                Сначала завершите: {incompleteStages.map(s => s.name).join(", ")}
                                              </p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      ) : (
                                        <div className="w-4 h-4 shrink-0" />
                                      )}

                                      <div 
                                        className="flex-1 min-w-0 cursor-pointer hover-elevate active-elevate-2 rounded px-2 py-1" 
                                        onClick={() => {
                                          setSelectedStage(stage);
                                          setStageDetailOpen(true);
                                        }}
                                      >
                                        <span className="text-sm font-medium truncate" data-testid={`stage-name-${itemIndex}-${stageIndex}`}>
                                          {stage.name}
                                        </span>
                                      </div>

                                      <Select 
                                        value={stage.status} 
                                        onValueChange={(value) => updateStageMutation.mutate({ 
                                          stageId: stage.id, 
                                          status: value 
                                        })}
                                        disabled={isBlocked}
                                      >
                                        <SelectTrigger className="w-32 h-8 text-xs" data-testid={`select-stage-status-${itemIndex}-${stageIndex}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="pending">
                                            {statusLabels.pending}
                                          </SelectItem>
                                          <SelectItem value="in_progress">
                                            {statusLabels.in_progress}
                                          </SelectItem>
                                          <SelectItem value="completed">
                                            {statusLabels.completed}
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {/* Зависимости */}
                                    {stageDeps.length > 0 && (
                                      <div className="ml-6 text-xs text-muted-foreground" data-testid={`stage-deps-${itemIndex}-${stageIndex}`}>
                                        Зависит от:{" "}
                                        {stageDeps.map(dep => {
                                          const depStage = stages.find(s => s.id === dep.depends_on_stage_id);
                                          return depStage?.name;
                                        }).filter(Boolean).join(", ")}
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-project-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-project-delete-title">
              Подтвердите удаление
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-project-delete-description">
              Вы уверены, что хотите удалить этот проект? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-project-delete">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-project-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={stageDetailOpen} onOpenChange={setStageDetailOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Детали этапа</SheetTitle>
            <SheetDescription>
              Параметры, документы и чат этапа
            </SheetDescription>
          </SheetHeader>
          {selectedStage && (
            <div className="mt-6">
              <StageDetailView
                stageId={selectedStage.id}
                stageName={selectedStage.name}
                stageStatus={selectedStage.status}
                stageDescription={selectedStage.description || undefined}
                stageDeadline={selectedStage.planned_end_date ? new Date(selectedStage.planned_end_date).toISOString() : undefined}
                stageCost={selectedStage.cost || undefined}
                projectId={project?.id}
                onStatusChange={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/projects", project?.id, "stages"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={documentsDialogOpen} onOpenChange={setDocumentsDialogOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Документы проекта</SheetTitle>
            <SheetDescription>
              Все документы по этапам проекта
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {allDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center">Нет документов</p>
            ) : (
              <>
                {stages.map((stage) => {
                  const stageDocs = allDocuments.filter(doc => doc.project_stage_id === stage.id);
                  if (stageDocs.length === 0) return null;
                  
                  return (
                    <Card key={stage.id}>
                      <CardHeader>
                        <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {stageDocs.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-2 border rounded-md">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">{doc.name}</span>
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
