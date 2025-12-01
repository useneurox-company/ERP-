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
import { Plus, Loader2, Trash2, QrCode } from "lucide-react";
import { insertProductionTaskSchema, type ProductionTask, type User, type Project, type ProductionStage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProductionTaskDetailSheetProps {
  task: ProductionTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductionTaskDetailSheet({ task, open, onOpenChange }: ProductionTaskDetailSheetProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<ProductionStage[]>({
    queryKey: ["/api/production", task?.id, "stages"],
    enabled: !!task?.id,
  });

  const form = useForm({
    resolver: zodResolver(insertProductionTaskSchema),
    defaultValues: {
      item_name: task?.item_name || "",
      project_id: task?.project_id || "",
      worker_id: task?.worker_id || "",
      payment: task?.payment || "",
      deadline: task?.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "",
      progress: task?.progress || 0,
      status: task?.status || "pending",
    },
  });

  useEffect(() => {
    if (task) {
      form.reset({
        item_name: task.item_name || "",
        project_id: task.project_id || "",
        worker_id: task.worker_id || "",
        payment: task.payment || "",
        deadline: task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "",
        progress: task.progress || 0,
        status: task.status || "pending",
      });
    }
  }, [task, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const taskData = {
        ...data,
        project_id: data.project_id || null,
        worker_id: data.worker_id || null,
        payment: data.payment || null,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      };
      await apiRequest("PUT", `/api/production/${task?.id}`, taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production"] });
      toast({
        title: "Успешно",
        description: "Задача обновлена",
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
      await apiRequest("DELETE", `/api/production/${task?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production"] });
      toast({
        title: "Успешно",
        description: "Задача удалена",
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

  const generateQRMutation = useMutation({
    mutationFn: async () => {
      const qrCode = `QR: ${task?.id}`;
      await apiRequest("PUT", `/api/production/${task?.id}`, { qr_code: qrCode });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production"] });
      toast({
        title: "Успешно",
        description: "QR код сгенерирован",
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

  const addStageMutation = useMutation({
    mutationFn: async (stageName: string) => {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.order)) : -1;
      await apiRequest("POST", `/api/production/${task?.id}/stages`, {
        name: stageName,
        status: "pending",
        order: maxOrder + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production", task?.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production"] });
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
      await apiRequest("PUT", `/api/production/stages/${stageId}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production", task?.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production"] });
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
      await apiRequest("DELETE", `/api/production/stages/${stageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production", task?.id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/production"] });
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

  const handleGenerateQR = () => {
    generateQRMutation.mutate();
  };

  const statusLabels: Record<string, string> = {
    pending: "В ожидании",
    in_progress: "В работе",
    completed: "Завершено",
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle data-testid="text-production-sheet-title">Детали задачи</SheetTitle>
            <SheetDescription data-testid="text-production-sheet-description">
              Редактирование производственной задачи
            </SheetDescription>
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <FormField
                control={form.control}
                name="item_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название изделия</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Название изделия" 
                        data-testid="input-production-item-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Проект</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-production-project">
                          <SelectValue placeholder="Выберите проект (опционально)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="option-production-project-none">
                          Без проекта
                        </SelectItem>
                        {projects.map((project) => (
                          <SelectItem 
                            key={project.id} 
                            value={project.id}
                            data-testid={`option-production-project-${project.id}`}
                          >
                            {project.name}
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
                name="worker_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Работник</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger data-testid="select-production-worker">
                          <SelectValue placeholder="Выберите работника" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem 
                            key={user.id} 
                            value={user.id}
                            data-testid={`option-production-worker-${user.id}`}
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

              <FormField
                control={form.control}
                name="payment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Оплата</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        placeholder="0.00" 
                        data-testid="input-production-payment"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Срок</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="datetime-local" 
                        data-testid="input-production-deadline"
                      />
                    </FormControl>
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
                        data-testid="slider-production-progress"
                      />
                    </FormControl>
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
                        <SelectTrigger data-testid="select-production-status">
                          <SelectValue placeholder="Выберите статус" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending" data-testid="option-production-status-pending">
                          {statusLabels.pending}
                        </SelectItem>
                        <SelectItem value="in_progress" data-testid="option-production-status-in_progress">
                          {statusLabels.in_progress}
                        </SelectItem>
                        <SelectItem value="completed" data-testid="option-production-status-completed">
                          {statusLabels.completed}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>QR код изделия</FormLabel>
                {task?.qr_code ? (
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                    <QrCode className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium" data-testid="text-qr-code">{task.qr_code}</p>
                      <p className="text-xs text-muted-foreground">QR код сгенерирован</p>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerateQR}
                    disabled={generateQRMutation.isPending}
                    className="w-full"
                    data-testid="button-generate-qr"
                  >
                    {generateQRMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <QrCode className="mr-2 h-4 w-4" />
                    Сгенерировать QR код
                  </Button>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-production"
                >
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-production"
                >
                  Удалить
                </Button>
              </div>
            </form>
          </Form>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base">Стадии производства</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={newStageName}
                  onChange={(e) => setNewStageName(e.target.value)}
                  placeholder="Название стадии"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddStage();
                    }
                  }}
                  data-testid="input-new-production-stage-name"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddStage}
                  disabled={addStageMutation.isPending || !newStageName.trim()}
                  data-testid="button-add-production-stage"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {stagesLoading ? (
                <div className="text-sm text-muted-foreground" data-testid="text-production-stages-loading">
                  Загрузка стадий...
                </div>
              ) : stages.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="text-no-production-stages">
                  Нет стадий
                </div>
              ) : (
                <div className="space-y-2">
                  {stages
                    .sort((a, b) => a.order - b.order)
                    .map((stage, index) => (
                      <div 
                        key={stage.id} 
                        className="flex items-center gap-2 p-2 border rounded-md"
                        data-testid={`production-stage-item-${index}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate" data-testid={`production-stage-name-${index}`}>
                            {stage.name}
                          </div>
                        </div>
                        <Select 
                          value={stage.status} 
                          onValueChange={(value) => updateStageMutation.mutate({ 
                            stageId: stage.id, 
                            status: value 
                          })}
                        >
                          <SelectTrigger className="w-36" data-testid={`select-production-stage-status-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending" data-testid={`option-production-stage-status-pending-${index}`}>
                              {statusLabels.pending}
                            </SelectItem>
                            <SelectItem value="in_progress" data-testid={`option-production-stage-status-in_progress-${index}`}>
                              {statusLabels.in_progress}
                            </SelectItem>
                            <SelectItem value="completed" data-testid={`option-production-stage-status-completed-${index}`}>
                              {statusLabels.completed}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteStageMutation.mutate(stage.id)}
                          disabled={deleteStageMutation.isPending}
                          data-testid={`button-delete-production-stage-${index}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-production-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-production-delete-title">
              Подтвердите удаление
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-production-delete-description">
              Вы уверены, что хотите удалить эту задачу? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-production-delete">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-production-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
