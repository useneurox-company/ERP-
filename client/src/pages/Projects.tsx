import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, LayoutGrid, List, CheckSquare, X } from "lucide-react";
import { ProjectCompactCard } from "@/components/ProjectCompactCard";
import { ProjectCreateDialog } from "@/components/ProjectCreateDialog";
import { GanttChart } from "@/components/GanttChart";
import { MeasurerTasksList } from "@/components/MeasurerTasksList";
import { KanbanBoard } from "@/components/KanbanBoard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Project, ProjectStage, User } from "@shared/schema";
import type { DragStartEvent, DragEndEvent, DragOverEvent } from "@dnd-kit/core";

type ProjectWithStages = Project & { stages: ProjectStage[] };

export default function Projects() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [showGantt, setShowGantt] = useState(false);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Получаем данные пользователя для фильтрации проектов
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<any>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const storedRole = localStorage.getItem("userRole");
    if (storedUser) setUser(JSON.parse(storedUser));
    if (storedRole) setUserRole(JSON.parse(storedRole));
  }, []);

  const { data: projects = [], isLoading: projectsLoading, error: projectsError } = useQuery<ProjectWithStages[]>({
    queryKey: ["/api/projects", user?.id, userRole?.name],
    queryFn: async () => {
      // Формируем URL с параметрами
      const params = new URLSearchParams();
      if (user?.id) params.append('userId', user.id);
      if (userRole?.name) params.append('userRole', userRole.name);

      const url = `/api/projects${params.toString() ? '?' + params.toString() : ''}`;
      return await apiRequest('GET', url);
    },
    enabled: !!user && !!userRole, // Загружаем только когда есть данные пользователя
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Mutation для обновления статуса проекта
  const updateProjectStatusMutation = useMutation({
    mutationFn: async ({ projectId, newStatus }: { projectId: string; newStatus: string }) => {
      return await apiRequest("PUT", `/api/projects/${projectId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Ошибка",
        description: "Не удалось переместить проект",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (projectsError) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить проекты",
        variant: "destructive",
      });
    }
  }, [projectsError, toast]);

  // Для замерщика показываем упрощенный интерфейс задач
  if (userRole?.name === 'Замерщик') {
    return <MeasurerTasksList />;
  }

  const isLoading = projectsLoading || usersLoading;

  const getUserName = (userId: string | null) => {
    if (!userId) return "Не назначен";
    const user = users.find(u => u.id === userId);
    return user?.full_name || user?.username || "Не назначен";
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Не установлен";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const transformedProjects = projects.map(project => {
    // Расчет дедлайна
    const startDate = project.started_at ? new Date(project.started_at) : null;
    const deadline = startDate && project.duration_days
      ? new Date(startDate.getTime() + project.duration_days * 24 * 60 * 60 * 1000)
      : null;

    // Расчет оставшихся дней
    const daysRemaining = deadline
      ? Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    // Статистика этапов
    const completed = project.stages.filter(s => s.status === 'completed').length;
    const inProgress = project.stages.filter(s => s.status === 'in_progress').length;
    const pending = project.stages.filter(s => s.status === 'pending').length;
    const stagesStats = {
      completed,
      inProgress,
      pending,
      total: project.stages.length,
    };

    // Текущий активный этап
    const currentStageObj = project.stages.find(s => s.status === 'in_progress')
      || project.stages.find(s => s.status === 'pending');
    const currentStage = currentStageObj?.name;

    // Статистика задач (из API)
    const tasksStats = (project as any).tasks_total !== undefined ? {
      total: (project as any).tasks_total || 0,
      completed: (project as any).tasks_completed || 0,
      progress: (project as any).tasks_progress || 0,
    } : undefined;

    return {
      id: project.id,
      name: project.name,
      client: project.client_name,
      progress: project.progress || 0,
      status: project.status,
      durationDays: project.duration_days || 0,
      manager: getUserName(project.manager_id),
      started_at: project.started_at,
      projectNumber: project.project_number,
      deadline,
      daysRemaining,
      stagesStats,
      currentStage,
      itemsCount: project.items?.length,
      tasksStats,
      stages: project.stages.map(stage => ({
        name: stage.name,
        status: stage.status,
      })),
    };
  });

  const handleProjectClick = (projectId: string) => {
    setLocation(`/projects/${projectId}`);
  };

  // Drag & Drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    // Можно добавить дополнительную логику при наведении
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeProject = projects.find(p => p.id === activeId);

    if (!activeProject) {
      setActiveId(null);
      return;
    }

    const validStatuses = ["pending", "in_progress", "completed", "reclamation"];
    const newStatus = validStatuses.find(status =>
      overId === status || projects.find(p => p.id === overId && p.status === status)
    );

    if (newStatus && newStatus !== activeProject.status) {
      const previousProjects = [...projects];

      // Optimistic update
      queryClient.setQueryData(["/api/projects", user?.id, userRole?.name], (oldProjects: ProjectWithStages[] | undefined) => {
        if (!oldProjects) return oldProjects;
        return oldProjects.map(project =>
          project.id === activeId ? { ...project, status: newStatus } : project
        );
      });

      updateProjectStatusMutation.mutate(
        { projectId: activeId, newStatus },
        {
          onError: () => {
            queryClient.setQueryData(["/api/projects", user?.id, userRole?.name], previousProjects);
          }
        }
      );
    }

    setActiveId(null);
  };

  // Selection mode handlers
  const handleToggleSelection = (projectId: string) => {
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleToggleColumnSelection = (columnId: string) => {
    const columnProjects = transformedProjects.filter(p => p.status === columnId);
    const allSelected = columnProjects.every(p => selectedProjects.has(p.id));

    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      columnProjects.forEach(project => {
        if (allSelected) {
          newSet.delete(project.id);
        } else {
          newSet.add(project.id);
        }
      });
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedProjects.size === transformedProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(transformedProjects.map(p => p.id)));
    }
  };

  const handleCancelSelection = () => {
    setSelectionMode(false);
    setSelectedProjects(new Set());
  };

  // Скрываем кнопку создания проекта для роли замерщика
  const canCreateProject = userRole?.name !== 'Замерщик';

  // Определение колонок канбана
  const projectColumns = [
    { id: "pending", title: "В ожидании", color: "#9ca3af" },
    { id: "in_progress", title: "В работе", color: "#3b82f6" },
    { id: "completed", title: "Завершенные", color: "#22c55e" },
    { id: "reclamation", title: "Рекламация", color: "#ef4444" },
  ];

  // Создание колонок для канбан-доски
  const kanbanColumns = projectColumns.map(column => ({
    id: column.id,
    title: column.title,
    color: column.color,
    count: transformedProjects.filter(p => p.status === column.id).length,
    items: transformedProjects
      .filter(p => p.status === column.id)
      .map(project => ({
        id: project.id,
        content: (
          <div key={project.id} className="relative">
            {selectionMode && (
              <div className="absolute top-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedProjects.has(project.id)}
                  onCheckedChange={() => handleToggleSelection(project.id)}
                  className="bg-background"
                />
              </div>
            )}
            <ProjectCompactCard
              {...project}
              onClick={() => {
                if (selectionMode) {
                  handleToggleSelection(project.id);
                } else {
                  handleProjectClick(project.id);
                }
              }}
            />
          </div>
        )
      })),
  }));

  // Активный проект для drag overlay
  const activeProject = activeId ? transformedProjects.find(p => p.id === activeId) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Проекты</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Управление этапами разработки</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Переключатель вида: Kanban / List */}
          {!showGantt && (
            <div className="flex items-center border rounded-md">
              <Button
                variant={view === "kanban" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("kanban")}
                className="rounded-r-none"
              >
                <LayoutGrid className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Канбан</span>
              </Button>
              <Button
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
                className="rounded-l-none"
              >
                <List className="h-4 w-4 md:mr-2" />
                <span className="hidden md:inline">Список</span>
              </Button>
            </div>
          )}
          {/* Selection mode controls */}
          {view === "kanban" && !showGantt && (
            <>
              {selectionMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                  >
                    <CheckSquare className="h-4 w-4 mr-2" />
                    {selectedProjects.size === transformedProjects.length ? "Снять выбор" : "Выбрать все"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCancelSelection}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Отмена
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectionMode(true)}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Выбрать
                </Button>
              )}
            </>
          )}
          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setShowGantt(!showGantt)}
            data-testid="button-view-gantt"
          >
            <Calendar className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden md:flex"
            onClick={() => setShowGantt(!showGantt)}
            data-testid="button-view-gantt-desktop"
          >
            <Calendar className="h-4 w-4 mr-2" />
            {showGantt ? "Список проектов" : "Диаграмма Ганта"}
          </Button>
          {canCreateProject && (
            <>
              <Button
                size="icon"
                onClick={() => setCreateDialogOpen(true)}
                className="md:hidden"
                data-testid="button-create-project"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                className="hidden md:flex"
                data-testid="button-create-project-desktop"
              >
                <Plus className="h-4 w-4 mr-2" />
                Новый проект
              </Button>
            </>
          )}
        </div>
      </div>

      {showGantt ? (
        <div className="mt-6" data-testid="gantt-view">
          <GanttChart stages={projects.flatMap(p => p.stages)} />
        </div>
      ) : view === "kanban" ? (
        /* Kanban View */
        <div className="mt-6">
          <KanbanBoard
            columns={kanbanColumns}
            activeId={selectionMode ? null : activeId}
            onDragStart={selectionMode ? () => {} : handleDragStart}
            onDragOver={selectionMode ? () => {} : handleDragOver}
            onDragEnd={selectionMode ? () => {} : handleDragEnd}
            activeItem={!selectionMode && activeProject ? <ProjectCompactCard {...activeProject} /> : undefined}
            selectionMode={selectionMode}
            selectedItems={selectedProjects}
            onToggleColumnSelection={handleToggleColumnSelection}
          />
        </div>
      ) : (
        /* List View with Tabs */
        <>
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="all">Все ({transformedProjects.length})</TabsTrigger>
          <TabsTrigger value="pending">В ожидании ({transformedProjects.filter(p => p.status === "pending").length})</TabsTrigger>
          <TabsTrigger value="in_progress">В работе ({transformedProjects.filter(p => p.status === "in_progress").length})</TabsTrigger>
          <TabsTrigger value="completed">Завершенные ({transformedProjects.filter(p => p.status === "completed").length})</TabsTrigger>
          <TabsTrigger value="reclamation">Рекламация ({transformedProjects.filter(p => p.status === "reclamation").length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48" data-testid={`skeleton-project-${i}`} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {transformedProjects.map((project) => (
                <ProjectCompactCard
                  key={project.id}
                  {...project}
                  onClick={() => handleProjectClick(project.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="pending" className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1].map((i) => (
                <Skeleton key={i} className="h-48" data-testid={`skeleton-project-${i}`} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {transformedProjects
                .filter((p) => p.status === "pending")
                .map((project) => (
                  <ProjectCompactCard
                    key={project.id}
                    {...project}
                    onClick={() => handleProjectClick(project.id)}
                  />
                ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="in_progress" className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-48" data-testid={`skeleton-project-${i}`} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {transformedProjects
                .filter((p) => p.status === "in_progress")
                .map((project) => (
                  <ProjectCompactCard
                    key={project.id}
                    {...project}
                    onClick={() => handleProjectClick(project.id)}
                  />
                ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="completed" className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1].map((i) => (
                <Skeleton key={i} className="h-48" data-testid={`skeleton-project-${i}`} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {transformedProjects
                .filter((p) => p.status === "completed")
                .map((project) => (
                  <ProjectCompactCard
                    key={project.id}
                    {...project}
                    onClick={() => handleProjectClick(project.id)}
                  />
                ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="reclamation" className="mt-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1].map((i) => (
                <Skeleton key={i} className="h-48" data-testid={`skeleton-project-${i}`} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {transformedProjects
                .filter((p) => p.status === "reclamation")
                .map((project) => (
                  <ProjectCompactCard
                    key={project.id}
                    {...project}
                    onClick={() => handleProjectClick(project.id)}
                  />
                ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
        </>
      )}

      <ProjectCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
