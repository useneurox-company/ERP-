import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, LayoutGrid, List, CheckSquare, X, Search, GripVertical, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ProjectCompactCard } from "@/components/ProjectCompactCard";
import { ProjectCreateDialog } from "@/components/ProjectCreateDialog";
import { GanttChart } from "@/components/GanttChart";
import { MeasurerTasksList } from "@/components/MeasurerTasksList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Project, ProjectStage, User } from "@shared/schema";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Color presets for status columns
const statusColorPresets: Record<string, { borderColor: string; label: string }> = {
  pending: { borderColor: "border-l-gray-400", label: "В ожидании" },
  in_progress: { borderColor: "border-l-blue-500", label: "В работе" },
  completed: { borderColor: "border-l-green-500", label: "Завершенные" },
  reclamation: { borderColor: "border-l-red-500", label: "Рекламация" },
};

// Sortable Project Card Component - компактная с расширением при hover
function SortableProjectCard({
  project,
  onClick,
  selectionMode,
  isSelected,
  onToggleSelection,
}: {
  project: any;
  onClick: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: project.id,
    disabled: selectionMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      return;
    }
    if (selectionMode) {
      onToggleSelection();
    } else {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(selectionMode ? {} : listeners)}
      className="mb-1.5 cursor-grab active:cursor-grabbing"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Card
        className={`transition-all duration-200 select-none bg-card ${
          isHovered ? "shadow-lg scale-[1.02]" : "shadow-sm"
        }`}
        onClick={handleClick}
      >
        <CardContent className={`transition-all duration-200 ${isHovered ? "p-2" : "p-1.5"}`}>
          {selectionMode && (
            <div className="absolute top-1 right-1 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelection}
                onClick={(e) => e.stopPropagation()}
                className="bg-background h-3.5 w-3.5"
              />
            </div>
          )}

          {/* Компактный вид - всегда виден */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              {!selectionMode && <GripVertical className="h-3 w-3 text-gray-400 flex-shrink-0" />}
              <span className="font-medium text-xs truncate">{project.name}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {project.projectNumber && (
                <span className="text-[10px] text-muted-foreground">#{project.projectNumber}</span>
              )}
              <span className="text-[10px] font-medium text-primary">{project.progress}%</span>
            </div>
          </div>

          {/* Progress bar - компактный */}
          <div className="mt-1 h-0.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                project.progress === 100 ? "bg-green-500" : "bg-primary"
              }`}
              style={{ width: `${project.progress}%` }}
            />
          </div>

          {/* Расширенная информация - показывается при hover */}
          <div className={`overflow-hidden transition-all duration-200 ${
            isHovered ? "max-h-32 opacity-100 mt-1.5" : "max-h-0 opacity-0"
          }`}>
            <div className="space-y-0.5 text-[11px] border-t border-border/50 pt-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Клиент:</span>
                <span className="truncate max-w-[100px]">{project.client}</span>
              </div>
              {project.manager && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Менеджер:</span>
                  <span className="truncate max-w-[80px]">{project.manager}</span>
                </div>
              )}
              {project.daysRemaining !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Осталось:</span>
                  <span className={project.daysRemaining < 0 ? "text-red-500" : project.daysRemaining <= 3 ? "text-amber-500" : "text-green-500"}>
                    {project.daysRemaining < 0 ? `−${Math.abs(project.daysRemaining)} дн.` : `${project.daysRemaining} дн.`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Kanban Column Component with Droppable
function ProjectKanbanColumn({
  status,
  label,
  projects,
  borderColor,
  onCardClick,
  selectionMode,
  selectedProjects,
  onToggleSelection,
  onToggleColumnSelection,
}: {
  status: string;
  label: string;
  projects: any[];
  borderColor: string;
  onCardClick: (projectId: string) => void;
  selectionMode: boolean;
  selectedProjects: Set<string>;
  onToggleSelection: (projectId: string) => void;
  onToggleColumnSelection: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  const columnProjects = projects.filter(p => p.status === status);
  const selectedInColumn = columnProjects.filter(p => selectedProjects.has(p.id)).length;
  const allSelectedInColumn = columnProjects.length > 0 && selectedInColumn === columnProjects.length;

  return (
    <div className="flex-shrink-0 w-56 md:w-64">
      <Card className={`border-l-[3px] ${borderColor} bg-zinc-900/95`}>
        <CardHeader className="pb-2 pt-2 px-2">
          <div className="flex items-center justify-between">
            {selectionMode ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelectedInColumn}
                  onCheckedChange={onToggleColumnSelection}
                  className="bg-zinc-700"
                />
                <CardTitle className="text-xs font-medium text-white">{label}</CardTitle>
              </div>
            ) : (
              <CardTitle className="text-xs font-medium text-white">{label}</CardTitle>
            )}
            <Badge variant="secondary" className="bg-zinc-700 text-zinc-300 text-xs px-1">
              {columnProjects.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className={`space-y-2 min-h-[200px] px-2 pb-2 transition-colors ${
            isOver ? "bg-zinc-800/50" : ""
          }`}
        >
          <SortableContext items={columnProjects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {columnProjects.map((project) => (
              <SortableProjectCard
                key={project.id}
                project={project}
                onClick={() => onCardClick(project.id)}
                selectionMode={selectionMode}
                isSelected={selectedProjects.has(project.id)}
                onToggleSelection={() => onToggleSelection(project.id)}
              />
            ))}
          </SortableContext>
          {columnProjects.length === 0 && (
            <div className={`text-center py-4 ${isOver ? "text-zinc-300" : "text-zinc-500"}`}>
              <p className="text-xs">{isOver ? "Отпустите" : "Нет проектов"}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ProjectWithStages = Project & { stages: ProjectStage[] };

export default function Projects() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"kanban" | "list" | "calendar">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(85);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set());
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
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

  // Filter projects by search query
  const filteredProjects = transformedProjects.filter((project) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      project.name.toLowerCase().includes(search) ||
      project.client.toLowerCase().includes(search) ||
      project.projectNumber?.toLowerCase().includes(search) ||
      project.manager.toLowerCase().includes(search)
    );
  });

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getProjectsForDate = (day: number) => {
    const targetDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    return filteredProjects.filter(project => {
      if (!project.deadline) return false;
      const deadlineDate = new Date(project.deadline);
      return deadlineDate.getDate() === targetDate.getDate() &&
             deadlineDate.getMonth() === targetDate.getMonth() &&
             deadlineDate.getFullYear() === targetDate.getFullYear();
    });
  };

  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

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

    // Если бросили на то же место
    if (activeId === overId) {
      setActiveId(null);
      return;
    }

    const activeProject = projects.find(p => p.id === activeId);

    if (!activeProject) {
      setActiveId(null);
      return;
    }

    const validStatuses = ["pending", "in_progress", "completed", "reclamation"];

    // Определяем целевой статус
    let newStatus: string | undefined;

    // Проверяем, бросили ли на колонку (статус) или на карточку
    if (validStatuses.includes(overId)) {
      // Бросили на пустую область колонки
      newStatus = overId;
    } else {
      // Бросили на другую карточку - определяем её статус
      const overProject = projects.find(p => p.id === overId);
      if (overProject) {
        newStatus = overProject.status;
      }
    }

    if (newStatus) {
      const previousProjects = [...projects];
      const statusChanged = newStatus !== activeProject.status;

      // Optimistic update
      queryClient.setQueryData(["/api/projects", user?.id, userRole?.name], (oldProjects: ProjectWithStages[] | undefined) => {
        if (!oldProjects) return oldProjects;

        // Если перемещаем в другую колонку - просто меняем статус
        if (statusChanged) {
          return oldProjects.map(project =>
            project.id === activeId ? { ...project, status: newStatus } : project
          );
        }

        // Если перемещаем внутри одной колонки - меняем порядок
        const columnProjectIds = oldProjects
          .filter(p => p.status === newStatus)
          .map(p => p.id);

        const oldIndex = columnProjectIds.indexOf(activeId);
        const newIndex = columnProjectIds.indexOf(overId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          // Меняем порядок ID в колонке
          const reorderedIds = arrayMove(columnProjectIds, oldIndex, newIndex);

          // Создаём карту порядка
          const orderMap = new Map(reorderedIds.map((id, idx) => [id, idx]));

          // Сортируем проекты в колонке по новому порядку
          return [...oldProjects].sort((a, b) => {
            if (a.status === newStatus && b.status === newStatus) {
              return (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0);
            }
            return 0;
          });
        }

        return oldProjects;
      });

      // Отправляем на сервер если статус изменился
      if (statusChanged) {
        updateProjectStatusMutation.mutate(
          { projectId: activeId, newStatus },
          {
            onError: () => {
              queryClient.setQueryData(["/api/projects", user?.id, userRole?.name], previousProjects);
            }
          }
        );
      }
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

  // Статусы проектов
  const projectStatuses = ["pending", "in_progress", "completed", "reclamation"] as const;

  // Активный проект для drag overlay
  const activeProject = activeId ? transformedProjects.find(p => p.id === activeId) : null;

  // State for Gantt view
  const [showGantt, setShowGantt] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Проекты</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Управление этапами разработки</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!selectionMode && canCreateProject && (
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
          {selectionMode && (
            <>
              <Badge variant="secondary" data-testid="badge-selected-count">
                Выбрано: {selectedProjects.size}
              </Badge>
              <Button
                variant="outline"
                onClick={handleSelectAll}
                data-testid="button-select-all"
              >
                {selectedProjects.size === transformedProjects.length ? "Снять все" : "Выбрать все"}
              </Button>
              <Button
                variant="ghost"
                onClick={handleCancelSelection}
                data-testid="button-cancel-selection"
              >
                <X className="h-4 w-4 mr-2" />
                Отмена
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск по названию, клиенту, номеру..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {!showGantt && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "kanban" | "list" | "calendar")}>
            <TabsList>
              <TabsTrigger value="kanban" data-testid="button-view-kanban">
                <LayoutGrid className="h-4 w-4 mr-2" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="list" data-testid="button-view-list">
                <List className="h-4 w-4 mr-2" />
                Список
              </TabsTrigger>
              <TabsTrigger value="calendar" data-testid="button-view-calendar">
                <Calendar className="h-4 w-4 mr-2" />
                Календарь
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {/* Zoom Control for Kanban */}
        {activeTab === "kanban" && !showGantt && (
          <div className="flex items-center gap-1 ml-auto bg-zinc-800 rounded-lg px-2 py-1 border border-zinc-600">
            <span className="text-xs text-zinc-400 mr-1">Масштаб:</span>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0 bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={() => setZoomLevel(Math.max(60, zoomLevel - 10))}
              disabled={zoomLevel <= 60}
            >
              −
            </Button>
            <span className="text-sm w-12 text-center font-medium text-white">{zoomLevel}%</span>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0 bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={() => setZoomLevel(Math.min(120, zoomLevel + 10))}
              disabled={zoomLevel >= 120}
            >
              +
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-xs bg-zinc-700 hover:bg-zinc-600 text-white ml-1"
              onClick={() => setZoomLevel(100)}
            >
              100%
            </Button>
          </div>
        )}

        {/* Gantt Toggle & Selection */}
        {!selectionMode && (
          <>
            <Button
              variant={showGantt ? "default" : "outline"}
              size="icon"
              className="md:hidden"
              onClick={() => setShowGantt(!showGantt)}
              data-testid="button-view-gantt"
            >
              <Calendar className="h-4 w-4" />
            </Button>
            <Button
              variant={showGantt ? "default" : "outline"}
              className="hidden md:flex"
              onClick={() => setShowGantt(!showGantt)}
              data-testid="button-view-gantt-desktop"
            >
              <Calendar className="h-4 w-4 mr-2" />
              {showGantt ? "Скрыть Ганта" : "Диаграмма Ганта"}
            </Button>
            {activeTab === "kanban" && !showGantt && (
              <Button
                variant="outline"
                onClick={() => setSelectionMode(true)}
                data-testid="button-enable-selection"
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                <span className="hidden md:inline">Выбрать</span>
              </Button>
            )}
          </>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64" data-testid={`skeleton-project-${i}`} />
          ))}
        </div>
      ) : showGantt ? (
        <div className="mt-6" data-testid="gantt-view">
          <GanttChart stages={projects.flatMap(p => p.stages)} />
        </div>
      ) : (
        <>
          {/* Kanban View */}
          {activeTab === "kanban" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={selectionMode ? undefined : handleDragStart}
              onDragOver={selectionMode ? undefined : handleDragOver}
              onDragEnd={selectionMode ? undefined : handleDragEnd}
            >
              <div
                className="overflow-x-auto"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top left',
                  width: `${100 / (zoomLevel / 100)}%`
                }}
              >
                <div className="flex gap-3 pb-4">
                  {projectStatuses.map((status) => (
                    <ProjectKanbanColumn
                      key={status}
                      status={status}
                      label={statusColorPresets[status].label}
                      projects={filteredProjects}
                      borderColor={statusColorPresets[status].borderColor}
                      onCardClick={handleProjectClick}
                      selectionMode={selectionMode}
                      selectedProjects={selectedProjects}
                      onToggleSelection={handleToggleSelection}
                      onToggleColumnSelection={() => handleToggleColumnSelection(status)}
                    />
                  ))}
                </div>
              </div>
              <DragOverlay>
                {activeProject && (
                  <Card className="shadow-lg w-56">
                    <CardContent className="p-2">
                      <div className="font-medium text-xs">{activeProject.name}</div>
                      <div className="text-xs text-gray-500">{activeProject.client}</div>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* List View */}
          {activeTab === "list" && (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="overflow-x-auto">
                <TabsTrigger value="all">Все ({filteredProjects.length})</TabsTrigger>
                <TabsTrigger value="pending">В ожидании ({filteredProjects.filter(p => p.status === "pending").length})</TabsTrigger>
                <TabsTrigger value="in_progress">В работе ({filteredProjects.filter(p => p.status === "in_progress").length})</TabsTrigger>
                <TabsTrigger value="completed">Завершенные ({filteredProjects.filter(p => p.status === "completed").length})</TabsTrigger>
                <TabsTrigger value="reclamation">Рекламация ({filteredProjects.filter(p => p.status === "reclamation").length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-6">
                <div className="space-y-2">
                  {filteredProjects.map((project) => (
                    <ProjectCompactCard
                      key={project.id}
                      {...project}
                      onClick={() => handleProjectClick(project.id)}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="pending" className="mt-6">
                <div className="space-y-2">
                  {filteredProjects.filter((p) => p.status === "pending").map((project) => (
                    <ProjectCompactCard
                      key={project.id}
                      {...project}
                      onClick={() => handleProjectClick(project.id)}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="in_progress" className="mt-6">
                <div className="space-y-2">
                  {filteredProjects.filter((p) => p.status === "in_progress").map((project) => (
                    <ProjectCompactCard
                      key={project.id}
                      {...project}
                      onClick={() => handleProjectClick(project.id)}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="completed" className="mt-6">
                <div className="space-y-2">
                  {filteredProjects.filter((p) => p.status === "completed").map((project) => (
                    <ProjectCompactCard
                      key={project.id}
                      {...project}
                      onClick={() => handleProjectClick(project.id)}
                    />
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="reclamation" className="mt-6">
                <div className="space-y-2">
                  {filteredProjects.filter((p) => p.status === "reclamation").map((project) => (
                    <ProjectCompactCard
                      key={project.id}
                      {...project}
                      onClick={() => handleProjectClick(project.id)}
                    />
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          )}

          {/* Calendar View */}
          {activeTab === "calendar" && (
            <div className="space-y-4">
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-lg font-medium">
                  {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                {(() => {
                  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(calendarDate);
                  const today = new Date();
                  const cells = [];

                  // Empty cells for days before the 1st
                  for (let i = 0; i < startingDayOfWeek; i++) {
                    cells.push(<div key={`empty-${i}`} className="min-h-[80px]" />);
                  }

                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dayProjects = getProjectsForDate(day);
                    const isToday = today.getDate() === day &&
                                   today.getMonth() === calendarDate.getMonth() &&
                                   today.getFullYear() === calendarDate.getFullYear();

                    cells.push(
                      <div
                        key={day}
                        className={`min-h-[80px] border rounded-md p-1 ${
                          isToday ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayProjects.slice(0, 3).map((project) => (
                            <div
                              key={project.id}
                              className="text-xs p-1 rounded bg-muted truncate cursor-pointer hover:bg-muted/80"
                              onClick={() => handleProjectClick(project.id)}
                              title={project.name}
                            >
                              {project.name}
                            </div>
                          ))}
                          {dayProjects.length > 3 && (
                            <div className="text-xs text-muted-foreground">+{dayProjects.length - 3} ещё</div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return cells;
                })()}
              </div>
            </div>
          )}
        </>
      )}

      <ProjectCreateDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </div>
  );
}
