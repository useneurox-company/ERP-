import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StageDetailView } from "@/components/StageDetailView";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { Calendar, Clock, AlertTriangle, Filter, ArrowUpDown, Search, User, Plus, Trash2, Upload, X, Hash, Briefcase, ExternalLink, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type TaskStatus = 'all' | 'new' | 'pending' | 'in_progress' | 'pending_review' | 'completed' | 'rejected' | 'cancelled' | 'on_hold';
type TaskDeadline = 'all' | 'overdue' | 'today' | 'week';
type SortBy = 'deadline' | 'project' | 'status' | 'assignee';

// Статусы задач с метаданными
const statusMetadata: Record<string, { label: string; colorClass: string; borderClass: string; bgClass: string }> = {
  new: { label: 'Новая', colorClass: 'bg-slate-500/10 text-slate-600 border-slate-500/20', borderClass: 'border-slate-500', bgClass: 'bg-slate-50/50 hover:bg-slate-50/70 dark:bg-slate-950/20 dark:hover:bg-slate-950/30' },
  pending: { label: 'Ожидает', colorClass: 'bg-gray-500/10 text-gray-600 border-gray-500/20', borderClass: 'border-gray-400', bgClass: 'bg-accent/30 hover:bg-accent/50' },
  in_progress: { label: 'В работе', colorClass: 'bg-blue-500/10 text-blue-600 border-blue-500/20', borderClass: 'border-blue-500', bgClass: 'bg-blue-50/50 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/30' },
  pending_review: { label: 'На проверке', colorClass: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20', borderClass: 'border-yellow-500', bgClass: 'bg-yellow-50/50 hover:bg-yellow-50/70 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/30' },
  completed: { label: 'Завершён', colorClass: 'bg-green-500/10 text-green-600 border-green-500/20', borderClass: 'border-green-500', bgClass: 'bg-green-50/50 hover:bg-green-50/70 dark:bg-green-950/20 dark:hover:bg-green-950/30' },
  rejected: { label: 'Отклонена', colorClass: 'bg-red-500/10 text-red-600 border-red-500/20', borderClass: 'border-red-500', bgClass: 'bg-red-50/50 hover:bg-red-50/70 dark:bg-red-950/20 dark:hover:bg-red-950/30' },
  cancelled: { label: 'Отменена', colorClass: 'bg-gray-400/10 text-gray-500 border-gray-400/20', borderClass: 'border-gray-400', bgClass: 'bg-gray-50/50 hover:bg-gray-50/70 dark:bg-gray-950/20 dark:hover:bg-gray-950/30' },
  on_hold: { label: 'Приостановлена', colorClass: 'bg-purple-500/10 text-purple-600 border-purple-500/20', borderClass: 'border-purple-500', bgClass: 'bg-purple-50/50 hover:bg-purple-50/70 dark:bg-purple-950/20 dark:hover:bg-purple-950/30' },
};

export default function Tasks() {
  const [, setLocation] = useLocation();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const [selectedStage, setSelectedStage] = useState<any>(null);
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    deadline: '',
    assignee_id: '',
    related_entity_type: 'none' as 'none' | 'project' | 'deal',
    project_id: '',
    project_stage_id: '',
    deal_id: '',
  });
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [projectStages, setProjectStages] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<any>(null);
  const [projectComboboxOpen, setProjectComboboxOpen] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Фильтры и сортировка
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<TaskDeadline>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all'); // 'all' | 'my' | 'unassigned' | userId
  const [entityFilter, setEntityFilter] = useState<'all' | 'deals' | 'projects' | 'none'>('all');
  const [sortBy, setSortBy] = useState<SortBy>('deadline');

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: deals = [] } = useQuery<any[]>({
    queryKey: ["/api/deals"],
  });

  // Load stages when project is selected
  useEffect(() => {
    if (newTask.related_entity_type === 'project' && newTask.project_id && newTask.project_id !== 'none') {
      fetch(`/api/projects/${newTask.project_id}/stages`)
        .then(res => res.json())
        .then(data => setProjectStages(data))
        .catch(() => setProjectStages([]));
    } else {
      setProjectStages([]);
      setNewTask(prev => ({ ...prev, project_stage_id: '' }));
    }
  }, [newTask.project_id, newTask.related_entity_type]);

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const payload: any = {
        title: taskData.title,
        description: taskData.description || null,
        status: 'new',
        priority: taskData.priority,
        deadline: taskData.deadline ? new Date(taskData.deadline).toISOString() : null,
        assignee_id: taskData.assignee_id === 'none' || !taskData.assignee_id ? null : taskData.assignee_id,
        created_by: user?.id,
      };

      // Set entity-specific fields based on type
      if (taskData.related_entity_type === 'project') {
        payload.project_id = taskData.project_id === 'none' || !taskData.project_id ? null : taskData.project_id;
        payload.project_stage_id = taskData.project_stage_id === 'none' || !taskData.project_stage_id ? null : taskData.project_stage_id;
        payload.deal_id = null;
      } else if (taskData.related_entity_type === 'deal') {
        payload.deal_id = taskData.deal_id === 'none' || !taskData.deal_id ? null : taskData.deal_id;
        payload.project_id = null;
        payload.project_stage_id = null;
      } else {
        payload.project_id = null;
        payload.project_stage_id = null;
        payload.deal_id = null;
      }

      console.log('[Client] Отправка задачи:', payload);
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      console.log('[Client] Ответ сервера:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Client] Ошибка:', errorText);
        throw new Error('Failed to create task');
      }
      return response.json();
    },
    onSuccess: async (createdTask: any) => {
      // Upload files if any were selected
      if (attachmentFiles.length > 0) {
        try {
          for (const file of attachmentFiles) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('userId', user?.id || '');

            await fetch(`/api/tasks/${createdTask.id}/attachments`, {
              method: 'POST',
              body: formData,
            });
          }
          toast({
            title: "Задача создана",
            description: `Задача создана с ${attachmentFiles.length} файлами`,
          });
        } catch (error) {
          toast({
            title: "Задача создана",
            description: "Задача создана, но не все файлы загружены",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Задача создана",
          description: "Новая задача успешно добавлена",
        });
      }

      // Invalidate main tasks list
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });

      // Invalidate related queries based on task relationships
      if (createdTask.project_id) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', createdTask.project_id, 'tasks'] });
      }

      if (createdTask.project_stage_id) {
        queryClient.invalidateQueries({ queryKey: ['/api/stages', createdTask.project_stage_id, 'tasks'] });
      }

      if (createdTask.deal_id) {
        queryClient.invalidateQueries({ queryKey: ['/api/deals', createdTask.deal_id, 'tasks'] });
      }

      if (createdTask.project_item_id && createdTask.project_id) {
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${createdTask.project_id}/items/${createdTask.project_item_id}/tasks`]
        });
      }

      setCreateDialogOpen(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        deadline: '',
        assignee_id: '',
        related_entity_type: 'none',
        project_id: '',
        project_stage_id: '',
        deal_id: '',
      });
      setAttachmentFiles([]);
      setProjectStages([]);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать задачу",
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete task');
    },
    onSuccess: () => {
      // Invalidate main tasks list
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });

      // Invalidate related queries based on task relationships
      if (taskToDelete) {
        if (taskToDelete.project_id) {
          queryClient.invalidateQueries({ queryKey: ['/api/projects', taskToDelete.project_id, 'tasks'] });
        }

        if (taskToDelete.project_stage_id) {
          queryClient.invalidateQueries({ queryKey: ['/api/stages', taskToDelete.project_stage_id, 'tasks'] });
        }

        if (taskToDelete.deal_id) {
          queryClient.invalidateQueries({ queryKey: ['/api/deals', taskToDelete.deal_id, 'tasks'] });
        }

        if (taskToDelete.project_item_id && taskToDelete.project_id) {
          queryClient.invalidateQueries({
            queryKey: [`/api/projects/${taskToDelete.project_id}/items/${taskToDelete.project_item_id}/tasks`]
          });
        }
      }

      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      toast({
        title: "Задача удалена",
        description: "Задача успешно удалена из системы",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить задачу",
        variant: "destructive",
      });
    },
  });

  const handleDeleteTask = (task: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete.id);
    }
  };

  // Расчёт дней до дедлайна
  const calculateDaysUntilDeadline = (deadline: string | Date | null) => {
    if (!deadline) return null;
    const today = new Date();
    const endDate = new Date(deadline);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Фильтрация и сортировка
  const filteredAndSortedTasks = useMemo(() => {
    let filtered = [...tasks];

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(task =>
        task.name?.toLowerCase().includes(query) ||
        task.title?.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.project?.name?.toLowerCase().includes(query) ||
        task.assignee?.full_name?.toLowerCase().includes(query)
      );
    }

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Фильтр по дедлайну
    if (deadlineFilter !== 'all') {
      filtered = filtered.filter(task => {
        const daysUntil = calculateDaysUntilDeadline(task.deadline);
        if (daysUntil === null) return false;

        switch (deadlineFilter) {
          case 'overdue':
            return daysUntil < 0;
          case 'today':
            return daysUntil === 0;
          case 'week':
            return daysUntil > 0 && daysUntil <= 7;
          default:
            return true;
        }
      });
    }

    // Фильтр по исполнителю
    if (assigneeFilter !== 'all') {
      filtered = filtered.filter(task => {
        if (assigneeFilter === 'my') {
          return task.assignee_id === user?.id;
        } else if (assigneeFilter === 'unassigned') {
          return !task.assignee_id;
        } else {
          return task.assignee_id === assigneeFilter;
        }
      });
    }

    // Фильтр по связанным сущностям
    if (entityFilter !== 'all') {
      filtered = filtered.filter(task => {
        if (entityFilter === 'deals') {
          return !!task.deal_id;
        } else if (entityFilter === 'projects') {
          return !!task.project_id;
        } else if (entityFilter === 'none') {
          return !task.deal_id && !task.project_id;
        }
        return true;
      });
    }

    // Сортировка
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'deadline': {
          const daysA = calculateDaysUntilDeadline(a.deadline) ?? 999;
          const daysB = calculateDaysUntilDeadline(b.deadline) ?? 999;
          return daysA - daysB;
        }
        case 'project':
          return (a.project?.name || '').localeCompare(b.project?.name || '');
        case 'assignee':
          return (a.assignee?.full_name || '').localeCompare(b.assignee?.full_name || '');
        case 'status': {
          const statusOrder: Record<string, number> = {
            'new': 0,
            'pending': 1,
            'in_progress': 2,
            'pending_review': 3,
            'completed': 4,
            'rejected': 5,
            'cancelled': 6,
            'on_hold': 7
          };
          return (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [tasks, searchQuery, statusFilter, deadlineFilter, assigneeFilter, entityFilter, sortBy, user?.id]);

  // Счётчики
  const stats = useMemo(() => {
    return {
      total: tasks.length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => {
        const days = calculateDaysUntilDeadline(t.deadline);
        return days !== null && days < 0 && t.status !== 'completed';
      }).length,
    };
  }, [tasks]);

  if (isLoading) {
    return <div className="p-6">Загрузка...</div>;
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-full overflow-x-hidden">
      {/* Заголовок со счётчиками */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Все задачи</h1>
            <p className="text-muted-foreground">Управление задачами по всем проектам</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Создать задачу
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Всего</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">В работе</p>
              <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Ожидают</p>
              <p className="text-2xl font-bold text-gray-600">{stats.pending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Завершено</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Просрочено</p>
              <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Поиск */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по задачам, проектам, исполнителям..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Фильтры и сортировка */}
      <Card>
        <CardContent className="p-3 md:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2 md:gap-4">
            <div className="flex items-center gap-2 col-span-2 sm:col-span-1">
              <Filter className="w-4 h-4 text-muted-foreground hidden md:block" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus)}>
                <SelectTrigger className="w-full md:w-36">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="new">Новая</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="pending_review">На проверке</SelectItem>
                  <SelectItem value="completed">Завершено</SelectItem>
                  <SelectItem value="rejected">Отклонена</SelectItem>
                  <SelectItem value="cancelled">Отменена</SelectItem>
                  <SelectItem value="on_hold">Приостановлена</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={deadlineFilter} onValueChange={(v) => setDeadlineFilter(v as TaskDeadline)}>
              <SelectTrigger className="w-full md:w-36">
                <SelectValue placeholder="Срок" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сроки</SelectItem>
                <SelectItem value="overdue">Просроченные</SelectItem>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="week">На неделю</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue placeholder="Исполнитель" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все исполнители</SelectItem>
                <SelectItem value="my">Мои задачи</SelectItem>
                <SelectItem value="unassigned">Не назначены</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={entityFilter} onValueChange={(v) => setEntityFilter(v as any)}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue placeholder="Связь" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="deals">Сделки</SelectItem>
                <SelectItem value="projects">Проекты</SelectItem>
                <SelectItem value="none">Без связи</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground hidden md:block" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="w-full md:w-36">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deadline">По дедлайну</SelectItem>
                  <SelectItem value="project">По проекту</SelectItem>
                  <SelectItem value="assignee">По исполнителю</SelectItem>
                  <SelectItem value="status">По статусу</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(statusFilter !== 'all' || deadlineFilter !== 'all' || assigneeFilter !== 'all' || entityFilter !== 'all' || sortBy !== 'deadline' || searchQuery) && (
              <Button
                variant="outline"
                size="sm"
                className="col-span-2 sm:col-span-1 w-full md:w-auto"
                onClick={() => {
                  setStatusFilter('all');
                  setDeadlineFilter('all');
                  setAssigneeFilter('all');
                  setEntityFilter('all');
                  setSortBy('deadline');
                  setSearchQuery('');
                }}
              >
                Сбросить
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Список задач */}
      {filteredAndSortedTasks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              {tasks.length === 0 ? 'Нет задач в системе' : 'Нет задач по выбранным фильтрам'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {filteredAndSortedTasks.map((task, index) => {
            const daysUntil = calculateDaysUntilDeadline(task.deadline);
            const isOverdue = daysUntil !== null && daysUntil < 0 && task.status !== 'completed';
            const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil < 3 && task.status !== 'completed';

            const statusMeta = statusMetadata[task.status] || statusMetadata.pending;
            const borderColor = statusMeta.borderClass;

            const bgColor =
              isOverdue ? 'bg-red-50/50 hover:bg-red-50/70 dark:bg-red-950/20 dark:hover:bg-red-950/30' :
              isUrgent ? 'bg-orange-50/50 hover:bg-orange-50/70 dark:bg-orange-950/20 dark:hover:bg-orange-950/30' :
              statusMeta.bgClass;

            return (
              <Card
                key={task.id}
                data-testid={`task-${task.id}`}
                className={`group border-l-4 ${borderColor} ${bgColor} transition-all duration-300 cursor-pointer hover:shadow-md`}
                onClick={() => setTaskDetailId(task.id)}
              >
                <CardContent className="p-2">
                  {/* Компактная строка - всегда видна */}
                  <div className="flex items-center gap-2">
                    {/* Task ID Badge */}
                    <Badge variant="outline" className="text-xs font-mono bg-muted/50 shrink-0">
                      #{index + 1}
                    </Badge>
                    {/* Task Title */}
                    <span className="text-sm font-medium truncate flex-1 min-w-0">{task.title || task.name}</span>
                    {/* Assignee - hidden on mobile */}
                    {task.assignee && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px] hidden sm:block">
                        {task.assignee.full_name}
                      </span>
                    )}
                    {/* Deadline - hidden on mobile */}
                    {task.deadline && (
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                    {/* Status Badge */}
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${statusMeta.colorClass}`}
                    >
                      {statusMeta.label}
                    </Badge>
                    {/* Overdue/Urgent Badge */}
                    {daysUntil !== null && task.status !== 'completed' && (
                      <Badge
                        variant="outline"
                        className={`text-xs shrink-0 ${
                          isOverdue
                            ? 'bg-red-500/20 text-red-500 border-red-500/30'
                            : isUrgent
                            ? 'bg-orange-500/20 text-orange-500 border-orange-500/30'
                            : 'bg-primary/10 text-primary border-primary/20'
                        }`}
                      >
                        {isOverdue ? `+${Math.abs(daysUntil)}` : daysUntil} дн.
                      </Badge>
                    )}
                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                      onClick={(e) => handleDeleteTask(task, e)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  {/* Раскрываемая часть при наведении */}
                  <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300">
                    <div className="overflow-hidden">
                      <div className="pt-2 mt-2 border-t border-border/50 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {/* Assignee - visible on mobile in expanded view */}
                        {task.assignee && (
                          <div className="flex items-center gap-1 sm:hidden">
                            <User className="w-3 h-3" />
                            <span>{task.assignee.full_name}</span>
                          </div>
                        )}
                        {/* Deadline - visible on mobile in expanded view */}
                        {task.deadline && (
                          <div className="flex items-center gap-1 sm:hidden">
                            <Calendar className="w-3 h-3" />
                            <span>{new Date(task.deadline).toLocaleDateString('ru-RU')}</span>
                          </div>
                        )}
                        {/* Estimated Hours */}
                        {task.estimated_hours && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{task.estimated_hours} ч</span>
                          </div>
                        )}
                        {/* Related Deal */}
                        {task.deal_id && task.deal && (
                          <div
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/sales?dealId=${task.deal.id}`);
                            }}
                          >
                            <Briefcase className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">
                              {task.deal.client_name} {task.deal.order_number && `#${task.deal.order_number}`}
                            </span>
                          </div>
                        )}
                        {/* Related Project */}
                        {task.project_id && task.project && (
                          <div
                            className="flex items-center gap-1 text-green-600 hover:text-green-700 cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/projects/${task.project.id}`);
                            }}
                          >
                            <Hash className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">
                              {task.project.name}
                            </span>
                          </div>
                        )}
                        {/* Description */}
                        {task.description && (
                          <span className="text-muted-foreground line-clamp-1 w-full">
                            {task.description}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        taskId={taskDetailId}
        open={!!taskDetailId}
        onOpenChange={(open) => !open && setTaskDetailId(null)}
      />

      {/* Диалог создания задачи */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Создать новую задачу</DialogTitle>
            <DialogDescription>
              Заполните форму для создания новой задачи. Вы можете привязать задачу к проекту, сделке или оставить без привязки.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (newTask.title.trim()) {
              createTaskMutation.mutate(newTask);
            }
          }} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название *</Label>
              <Input
                id="title"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Введите название задачи"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Опишите задачу"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity_type">Привязать к</Label>
              <Select
                value={newTask.related_entity_type}
                onValueChange={(value: 'none' | 'project' | 'deal') => setNewTask({ ...newTask, related_entity_type: value, project_id: '', project_stage_id: '', deal_id: '' })}
              >
                <SelectTrigger id="entity_type">
                  <SelectValue placeholder="Выберите тип сущности" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без привязки</SelectItem>
                  <SelectItem value="project">Проект</SelectItem>
                  <SelectItem value="deal">Сделка</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newTask.related_entity_type === 'project' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="project">Проект *</Label>
                    <Popover open={projectComboboxOpen} onOpenChange={setProjectComboboxOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={projectComboboxOpen}
                          className="w-full justify-between font-normal"
                        >
                          {newTask.project_id
                            ? projects.find((p: any) => p.id === newTask.project_id)?.name
                            : "Выберите проект"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[300px] p-0">
                        <Command>
                          <CommandInput placeholder="Поиск проекта..." />
                          <CommandList>
                            <CommandEmpty>Проект не найден</CommandEmpty>
                            <CommandGroup>
                              {projects.map((project: any) => (
                                <CommandItem
                                  key={project.id}
                                  value={project.name}
                                  onSelect={() => {
                                    setNewTask({ ...newTask, project_id: project.id, project_stage_id: '' });
                                    setProjectComboboxOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      newTask.project_id === project.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {project.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stage">Этап (опционально)</Label>
                    <Select
                      value={newTask.project_stage_id}
                      onValueChange={(value) => setNewTask({ ...newTask, project_stage_id: value })}
                      disabled={!newTask.project_id || projectStages.length === 0}
                    >
                      <SelectTrigger id="stage">
                        <SelectValue placeholder="Выберите этап" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Без этапа</SelectItem>
                        {projectStages.map((stage: any) => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}

            {newTask.related_entity_type === 'deal' && (
              <div className="space-y-2">
                <Label htmlFor="deal">Сделка *</Label>
                <Select
                  value={newTask.deal_id}
                  onValueChange={(value) => setNewTask({ ...newTask, deal_id: value })}
                >
                  <SelectTrigger id="deal">
                    <SelectValue placeholder="Выберите сделку" />
                  </SelectTrigger>
                  <SelectContent>
                    {deals.map((deal: any) => (
                      <SelectItem key={deal.id} value={deal.id}>
                        {deal.client_name} - {deal.project_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="assignee">Исполнитель</Label>
              <Select
                value={newTask.assignee_id}
                onValueChange={(value) => setNewTask({ ...newTask, assignee_id: value })}
              >
                <SelectTrigger id="assignee">
                  <SelectValue placeholder="Выберите исполнителя" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {users.map((u: any) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Приоритет</Label>
                <Select
                  value={newTask.priority}
                  onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                >
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Низкий</SelectItem>
                    <SelectItem value="medium">Средний</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                    <SelectItem value="urgent">Срочный</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="deadline">Дедлайн</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={newTask.deadline}
                  onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                />
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="files">Прикрепить файлы</Label>
              <div className="space-y-3">
                <label htmlFor="files">
                  <Input
                    id="files"
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        setAttachmentFiles([...attachmentFiles, ...Array.from(e.target.files)]);
                      }
                    }}
                    className="hidden"
                  />
                  <div className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-muted-foreground/25 rounded-md hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer">
                    <Upload className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Нажмите для выбора файлов (макс. 10 МБ)
                    </span>
                  </div>
                </label>

                {/* Selected files preview */}
                {attachmentFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Выбрано файлов: {attachmentFiles.length}</p>
                    {attachmentFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-muted rounded-md text-sm"
                      >
                        <span className="truncate flex-1">{file.name}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 ml-2"
                          onClick={() => setAttachmentFiles(attachmentFiles.filter((_, i) => i !== idx))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={!newTask.title.trim() || createTaskMutation.isPending}
              >
                {createTaskMutation.isPending ? "Создание..." : "Создать задачу"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Диалог подтверждения удаления */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Удалить задачу?</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить задачу "{taskToDelete?.title}"? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setTaskToDelete(null);
              }}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteTaskMutation.isPending}
            >
              {deleteTaskMutation.isPending ? "Удаление..." : "Удалить"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
