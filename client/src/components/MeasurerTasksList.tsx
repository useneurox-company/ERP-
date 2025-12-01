import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, Calendar, MapPin, Building2, MessageSquare, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MeasurementStageForm, MeasurementStageData } from "./MeasurementStageForm";
import { StageChat } from "./StageChat";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProjectStage } from "@shared/schema";

interface MeasurerTask {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  stage_name: string;
  status: string;
  deadline: Date | null;
  address: string;
}

export function MeasurerTasksList() {
  const { toast } = useToast();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  // Fetch measurer tasks
  const { data: tasks = [], isLoading } = useQuery<MeasurerTask[]>({
    queryKey: ["/api/my-measurement-tasks", user?.id],
    queryFn: async () => {
      const result = await apiRequest("GET", `/api/my-measurement-tasks/${user?.id}`);
      return result;
    },
    enabled: !!user?.id,
  });

  // Fetch selected stage details
  const { data: selectedStage, isLoading: isLoadingStage } = useQuery<ProjectStage>({
    queryKey: ["/api/projects/stages", selectedTaskId],
    queryFn: async () => {
      const result = await apiRequest("GET", `/api/projects/stages/${selectedTaskId}`);
      return result;
    },
    enabled: !!selectedTaskId,
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ stageId, data }: { stageId: string; data: Partial<ProjectStage> }) => {
      return await apiRequest("PUT", `/api/projects/stages/${stageId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-measurement-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects/stages"] });
      toast({ description: "Данные сохранены" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка сохранения",
        variant: "destructive",
      });
    },
  });

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseDialog = () => {
    setSelectedTaskId(null);
  };

  const handleDataChange = (data: MeasurementStageData) => {
    if (selectedTaskId) {
      updateStageMutation.mutate({
        stageId: selectedTaskId,
        data: {
          type_data: JSON.stringify(data),
        },
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Завершено</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500">В работе</Badge>;
      case "pending":
        return <Badge variant="secondary">Ожидает</Badge>;
      case "blocked":
        return <Badge variant="destructive">Заблокировано</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <Building2 className="w-16 h-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Нет активных задач</h3>
        <p className="text-sm text-muted-foreground">
          У вас пока нет назначенных задач по замерам
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Заголовок */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-1">Мои задачи</h1>
        <p className="text-sm text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? "задача" : "задач"}
        </p>
      </div>

      {/* Список всех задач */}
      <div className="space-y-2">
        <div className="grid gap-3">
          {tasks.map((task) => (
          <Card
            key={task.id}
            className="cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => handleTaskClick(task.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base leading-tight mb-1">
                    {task.stage_name}
                  </h3>
                  <p className="text-sm text-muted-foreground truncate">
                    Проект №{task.project_name}
                  </p>
                </div>
                {getStatusBadge(task.status)}
              </div>

              {/* Дедлайн - показываем заметно */}
              {task.deadline && (
                <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950 rounded-md px-3 py-2">
                  <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Срок замера:</p>
                    <p className="font-semibold text-blue-600 dark:text-blue-400">
                      {format(new Date(task.deadline), "dd MMMM yyyy", { locale: ru })}
                    </p>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="space-y-2 text-sm">
                {/* Клиент */}
                {task.client_name && (
                  <div className="flex items-start gap-2">
                    <Building2 className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{task.client_name}</span>
                  </div>
                )}

                {/* Адрес */}
                {task.address && (
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{task.address}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        </div>
      </div>

      {/* Диалог с формой замера и чатом */}
      <Dialog open={!!selectedTaskId} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl">
              {selectedStage?.name || "Замер"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6">
            {isLoadingStage ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : selectedStage ? (
              <Tabs defaultValue="form" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-10 mb-4">
                  <TabsTrigger value="form" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Замер
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Чат
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="form" className="mt-0">
                  <MeasurementStageForm
                    stage={selectedStage}
                    onDataChange={handleDataChange}
                    readOnly={false}
                  />
                </TabsContent>

                <TabsContent value="chat" className="mt-0">
                  <StageChat stageId={selectedStage.id} />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                Не удалось загрузить данные этапа
              </div>
            )}
          </div>

          <div className="px-6 pb-6 border-t pt-4">
            <Button
              onClick={handleCloseDialog}
              variant="outline"
              className="w-full h-12"
            >
              Закрыть
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
