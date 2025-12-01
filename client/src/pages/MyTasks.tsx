import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StageDetailView } from "@/components/StageDetailView";
import { Calendar, DollarSign, Clock, AlertTriangle, Filter, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type TaskStatus = 'all' | 'pending' | 'in_progress' | 'completed';
type TaskDeadline = 'all' | 'overdue' | 'today' | 'week';
type SortBy = 'deadline' | 'project' | 'status';

export default function MyTasks() {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const [selectedStage, setSelectedStage] = useState<any>(null);

  // Фильтры и сортировка
  const [statusFilter, setStatusFilter] = useState<TaskStatus>('all');
  const [deadlineFilter, setDeadlineFilter] = useState<TaskDeadline>('all');
  const [sortBy, setSortBy] = useState<SortBy>('deadline');

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/my-tasks", user?.id],
    enabled: !!user?.id,
  });

  // Расчёт дней до дедлайна
  const calculateDaysUntilDeadline = (deadline: string | null) => {
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

    // Фильтр по статусу
    if (statusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === statusFilter);
    }

    // Фильтр по дедлайну
    if (deadlineFilter !== 'all') {
      filtered = filtered.filter(task => {
        const daysUntil = calculateDaysUntilDeadline(task.planned_end_date);
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

    // Сортировка
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'deadline': {
          const daysA = calculateDaysUntilDeadline(a.planned_end_date) ?? 999;
          const daysB = calculateDaysUntilDeadline(b.planned_end_date) ?? 999;
          return daysA - daysB;
        }
        case 'project':
          return (a.project?.name || '').localeCompare(b.project?.name || '');
        case 'status': {
          const statusOrder = { 'in_progress': 0, 'pending': 1, 'completed': 2 };
          return statusOrder[a.status] - statusOrder[b.status];
        }
        default:
          return 0;
      }
    });

    return filtered;
  }, [tasks, statusFilter, deadlineFilter, sortBy]);

  // Счётчики
  const stats = useMemo(() => {
    return {
      total: tasks.length,
      inProgress: tasks.filter(t => t.status === 'in_progress').length,
      pending: tasks.filter(t => t.status === 'pending').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      overdue: tasks.filter(t => {
        const days = calculateDaysUntilDeadline(t.planned_end_date);
        return days !== null && days < 0;
      }).length,
    };
  }, [tasks]);

  if (isLoading) {
    return <div className="p-6">Загрузка...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок со счётчиками */}
      <div>
        <h1 className="text-2xl font-bold">Мои задачи</h1>
        <p className="text-muted-foreground">Этапы, назначенные мне</p>

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

      {/* Фильтры и сортировка */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as TaskStatus)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="completed">Завершено</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Select value={deadlineFilter} onValueChange={(v) => setDeadlineFilter(v as TaskDeadline)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Срок" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сроки</SelectItem>
                <SelectItem value="overdue">Просроченные</SelectItem>
                <SelectItem value="today">Сегодня</SelectItem>
                <SelectItem value="week">На неделю</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Сортировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deadline">По дедлайну</SelectItem>
                  <SelectItem value="project">По проекту</SelectItem>
                  <SelectItem value="status">По статусу</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(statusFilter !== 'all' || deadlineFilter !== 'all' || sortBy !== 'deadline') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setDeadlineFilter('all');
                  setSortBy('deadline');
                }}
              >
                Сбросить фильтры
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
              {tasks.length === 0 ? 'Нет назначенных задач' : 'Нет задач по выбранным фильтрам'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAndSortedTasks.map((task) => {
            const daysUntil = calculateDaysUntilDeadline(task.planned_end_date);
            const isOverdue = daysUntil !== null && daysUntil < 0;
            const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil < 3;

            const borderColor =
              task.status === 'completed' ? 'border-green-500' :
              task.status === 'in_progress' ? 'border-blue-500' :
              'border-gray-400';

            const bgColor =
              isOverdue ? 'bg-red-50/50 hover:bg-red-50/70 dark:bg-red-950/20 dark:hover:bg-red-950/30' :
              isUrgent ? 'bg-orange-50/50 hover:bg-orange-50/70 dark:bg-orange-950/20 dark:hover:bg-orange-950/30' :
              task.status === 'completed' ? 'bg-green-50/50 hover:bg-green-50/70 dark:bg-green-950/20 dark:hover:bg-green-950/30' :
              task.status === 'in_progress' ? 'bg-blue-50/50 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/30' :
              'bg-accent/30 hover:bg-accent/50';

            return (
              <Card
                key={task.id}
                data-testid={`task-${task.id}`}
                className={`border-l-4 ${borderColor} ${bgColor} transition-all duration-200 cursor-pointer`}
                onClick={() => setSelectedStage(task)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{task.name}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Проект: {task.project?.name}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${
                        task.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          : task.status === 'completed'
                          ? 'bg-green-500/10 text-green-600 border-green-500/20'
                          : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                      }`}
                    >
                      {task.status === 'in_progress' && '🔵 В работе'}
                      {task.status === 'completed' && '🟢 Завершён'}
                      {task.status === 'pending' && '⚪ Ожидает'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {task.description && (
                      <p className="text-sm">{task.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-sm">
                      {task.planned_end_date && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          {new Date(task.planned_end_date).toLocaleDateString('ru-RU')}
                        </div>
                      )}
                      {task.cost && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <DollarSign className="w-4 h-4" />
                          {parseFloat(task.cost).toLocaleString('ru-RU')} ₽
                        </div>
                      )}
                    </div>

                    {/* Осталось дней */}
                    {daysUntil !== null && task.status !== 'completed' && (
                      <div className={`flex items-center justify-between text-sm p-2 rounded-md ${
                        isOverdue
                          ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                          : isUrgent
                          ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                          : 'bg-primary/10 border border-primary/20'
                      }`}>
                        <div className="flex items-center gap-1 font-medium">
                          {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          <span>{isOverdue ? 'Просрочено' : 'Осталось'}</span>
                        </div>
                        <span className="text-xs font-bold">
                          {isOverdue ? `+${Math.abs(daysUntil)}` : daysUntil} дн.
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedStage} onOpenChange={(open) => !open && setSelectedStage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали этапа</DialogTitle>
          </DialogHeader>
          {selectedStage && (
            <StageDetailView
              stageId={selectedStage.id}
              stageName={selectedStage.name}
              stageStatus={selectedStage.status}
              stageDescription={selectedStage.description}
              stageDeadline={selectedStage.planned_end_date}
              stageCost={selectedStage.cost}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
