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
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
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

      {/* Список задач - компактный вид с раскрытием при наведении */}
      {filteredAndSortedTasks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              {tasks.length === 0 ? 'Нет назначенных задач' : 'Нет задач по выбранным фильтрам'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filteredAndSortedTasks.map((task, index) => {
            const daysUntil = calculateDaysUntilDeadline(task.planned_end_date);
            const isOverdue = daysUntil !== null && daysUntil < 0;
            const isUrgent = daysUntil !== null && daysUntil >= 0 && daysUntil < 3;

            const borderColor =
              task.status === 'completed' ? 'border-l-green-500' :
              task.status === 'in_progress' ? 'border-l-blue-500' :
              isOverdue ? 'border-l-red-500' :
              isUrgent ? 'border-l-orange-500' :
              'border-l-gray-400';

            const bgColor =
              isOverdue ? 'bg-red-950/20' :
              isUrgent ? 'bg-orange-950/10' :
              task.status === 'completed' ? 'bg-green-950/10' :
              task.status === 'in_progress' ? 'bg-blue-950/10' :
              '';

            return (
              <Card
                key={task.id}
                data-testid={`task-${task.id}`}
                className={`group border-l-4 ${borderColor} ${bgColor} transition-all duration-300 cursor-pointer hover:shadow-md`}
                onClick={() => setSelectedStage(task)}
              >
                <CardContent className="p-3">
                  {/* Компактная строка - всегда видна */}
                  <div className="flex items-center gap-3">
                    {/* Номер */}
                    <span className="text-xs font-mono text-muted-foreground w-6 shrink-0">
                      #{index + 1}
                    </span>

                    {/* Название */}
                    <span className="font-medium text-sm truncate flex-1 min-w-0">
                      {task.name}
                    </span>

                    {/* Исполнитель */}
                    <span className="text-xs text-muted-foreground truncate max-w-[120px] hidden sm:block">
                      {task.assignee?.full_name || task.assignee?.username || 'Не назначен'}
                    </span>

                    {/* Дата */}
                    {task.planned_end_date && (
                      <span className="text-xs text-muted-foreground shrink-0 hidden sm:flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(task.planned_end_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}

                    {/* Сумма если есть */}
                    {task.cost && (
                      <span className="text-xs text-green-600 font-medium shrink-0 hidden md:block">
                        # {parseFloat(task.cost).toLocaleString('ru-RU')}
                      </span>
                    )}

                    {/* Статус */}
                    <Badge
                      variant="outline"
                      className={`text-xs shrink-0 ${
                        task.status === 'completed'
                          ? 'bg-green-500/10 text-green-600 border-green-500/20'
                          : task.status === 'in_progress'
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                          : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                      }`}
                    >
                      {task.status === 'completed' ? 'Завершён' :
                       task.status === 'in_progress' ? 'В работе' : 'Новая'}
                    </Badge>

                    {/* Дни */}
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
                  </div>

                  {/* Раскрываемая часть при наведении */}
                  <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] transition-[grid-template-rows] duration-300">
                    <div className="overflow-hidden">
                      <div className="pt-3 mt-3 border-t border-border/50 space-y-2">
                        {/* Проект */}
                        {task.project?.name && (
                          <p className="text-xs text-muted-foreground">
                            Проект: <span className="text-foreground">{task.project.name}</span>
                          </p>
                        )}

                        {/* Описание */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                        )}

                        {/* Мобильная инфа */}
                        <div className="flex flex-wrap gap-2 text-xs sm:hidden">
                          <span className="text-muted-foreground">
                            {task.assignee?.full_name || 'Не назначен'}
                          </span>
                          {task.planned_end_date && (
                            <span className="text-muted-foreground">
                              {new Date(task.planned_end_date).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                          {task.cost && (
                            <span className="text-green-600 font-medium">
                              {parseFloat(task.cost).toLocaleString('ru-RU')} ₽
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
