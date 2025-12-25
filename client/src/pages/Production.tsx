import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ProductionCard } from "@/components/ProductionCard";
import { ProductionTaskDetailSheet } from "@/components/ProductionTaskDetailSheet";
import { ProductionTaskCreateDialog } from "@/components/ProductionTaskCreateDialog";
import { Button } from "@/components/ui/button";
import { Plus, QrCode } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { ProductionTask, ProductionStage, User, Project } from "@shared/schema";

type ProductionTaskWithStages = ProductionTask & { stages: ProductionStage[] };

export default function Production() {
  const { toast } = useToast();
  const [selectedTask, setSelectedTask] = useState<ProductionTask | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: productionTasks = [], isLoading: tasksLoading, error: tasksError } = useQuery<ProductionTaskWithStages[]>({
    queryKey: ["/api/production"],
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  if (tasksError) {
    toast({
      title: "Ошибка загрузки",
      description: "Не удалось загрузить производственные задания",
      variant: "destructive",
    });
  }

  const isLoading = tasksLoading || usersLoading || projectsLoading;

  const getUserName = (userId: string | null) => {
    if (!userId) return "Не назначен";
    const user = users.find(u => u.id === userId);
    return user?.full_name || user?.username || "Не назначен";
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null;
    const project = projects.find(p => p.id === projectId);
    return project?.name || null;
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Не установлен";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleCardClick = (task: ProductionTaskWithStages) => {
    setSelectedTask(task);
    setIsDetailSheetOpen(true);
  };

  const handleCreateClick = () => {
    setIsCreateDialogOpen(true);
  };

  const transformedTasks = productionTasks.map(task => ({
    id: task.id,
    itemName: task.item_name,
    projectName: getProjectName(task.project_id),
    stages: task.stages.map(stage => ({
      name: stage.name,
      status: stage.status as "pending" | "in_progress" | "completed",
    })),
    progress: task.progress || 0,
    worker: getUserName(task.worker_id),
    payment: parseFloat(String(task.payment || "0")),
    deadline: formatDate(task.deadline),
    qrCode: !!task.qr_code,
    status: task.status as "pending" | "in_progress" | "completed",
  }));

  const pendingTasks = transformedTasks.filter((t) => t.status === "pending");
  const inProgressTasks = transformedTasks.filter((t) => t.status === "in_progress");
  const completedTasks = transformedTasks.filter((t) => t.status === "completed");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Производство</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Сменные задания и контроль этапов</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="icon"
            className="md:hidden"
            data-testid="button-scan-qr"
          >
            <QrCode className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            className="hidden md:flex"
            data-testid="button-scan-qr-desktop"
          >
            <QrCode className="h-4 w-4 mr-2" />
            Сканировать QR
          </Button>
          <Button 
            size="icon"
            onClick={handleCreateClick} 
            className="md:hidden"
            data-testid="button-create-production"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button 
            onClick={handleCreateClick} 
            className="hidden md:flex"
            data-testid="button-create-production-desktop"
          >
            <Plus className="h-4 w-4 mr-2" />
            Новое задание
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="all" data-testid="tab-production-all">
            Все задания ({transformedTasks.length})
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="tab-production-pending">
            В ожидании ({pendingTasks.length})
          </TabsTrigger>
          <TabsTrigger value="in_progress" data-testid="tab-production-in_progress">
            В работе ({inProgressTasks.length})
          </TabsTrigger>
          <TabsTrigger value="completed" data-testid="tab-production-completed">
            Завершенные ({completedTasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-80" data-testid={`skeleton-production-${i}`} />
              ))}
            </div>
          ) : transformedTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-production-tasks">
                Нет производственных заданий
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transformedTasks.map((task) => {
                const originalTask = productionTasks.find(t => t.id === task.id);
                return (
                  <ProductionCard 
                    key={task.id} 
                    {...task} 
                    onClick={() => originalTask && handleCardClick(originalTask)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-80" data-testid={`skeleton-production-${i}`} />
              ))}
            </div>
          ) : pendingTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-pending-tasks">
                Нет заданий в ожидании
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingTasks.map((task) => {
                const originalTask = productionTasks.find(t => t.id === task.id);
                return (
                  <ProductionCard 
                    key={task.id} 
                    {...task} 
                    onClick={() => originalTask && handleCardClick(originalTask)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="in_progress" className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-80" data-testid={`skeleton-production-${i}`} />
              ))}
            </div>
          ) : inProgressTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-in-progress-tasks">
                Нет заданий в работе
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {inProgressTasks.map((task) => {
                const originalTask = productionTasks.find(t => t.id === task.id);
                return (
                  <ProductionCard 
                    key={task.id} 
                    {...task} 
                    onClick={() => originalTask && handleCardClick(originalTask)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-6">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1].map((i) => (
                <Skeleton key={i} className="h-80" data-testid={`skeleton-production-${i}`} />
              ))}
            </div>
          ) : completedTasks.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground" data-testid="text-no-completed-tasks">
                Нет завершенных заданий
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedTasks.map((task) => {
                const originalTask = productionTasks.find(t => t.id === task.id);
                return (
                  <ProductionCard 
                    key={task.id} 
                    {...task} 
                    onClick={() => originalTask && handleCardClick(originalTask)}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ProductionTaskDetailSheet
        task={selectedTask}
        open={isDetailSheetOpen}
        onOpenChange={setIsDetailSheetOpen}
      />

      <ProductionTaskCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}
