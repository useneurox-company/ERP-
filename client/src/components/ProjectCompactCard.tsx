import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, User, Clock, Calendar, Package } from "lucide-react";

interface StagesStats {
  completed: number;
  inProgress: number;
  pending: number;
  total: number;
}

interface TasksStats {
  total: number;
  completed: number;
  progress: number;
}

interface ProjectCompactCardProps {
  id: string;
  name: string;
  client: string;
  progress: number;
  status: "pending" | "in_progress" | "completed" | "reclamation" | "overdue";
  durationDays: number;
  manager: string;
  started_at?: Date | null;
  onClick?: () => void;
  projectNumber?: string;
  deadline?: Date | null;
  daysRemaining?: number;
  stagesStats?: StagesStats;
  currentStage?: string;
  itemsCount?: number;
  tasksStats?: TasksStats;
}

export function ProjectCompactCard({
  id,
  name,
  client,
  progress,
  status,
  durationDays,
  manager,
  started_at,
  onClick,
  projectNumber,
  deadline,
  daysRemaining,
  stagesStats,
  currentStage,
  itemsCount,
  tasksStats,
}: ProjectCompactCardProps) {
  // Определение цвета границы и фона
  const borderColor =
    status === "completed"
      ? "border-green-500"
      : status === "in_progress"
      ? "border-blue-500"
      : status === "reclamation"
      ? "border-red-500"
      : "border-gray-400";

  const bgColor =
    status === "completed"
      ? "bg-green-50/50 hover:bg-green-50/70 dark:bg-green-950/20 dark:hover:bg-green-950/30"
      : status === "in_progress"
      ? "bg-blue-50/50 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
      : status === "reclamation"
      ? "bg-red-50/50 hover:bg-red-50/70 dark:bg-red-950/20 dark:hover:bg-red-950/30"
      : "bg-accent/30 hover:bg-accent/50";

  // Текст статуса
  const getStatusText = () => {
    switch (status) {
      case "pending":
        return "В ожидании";
      case "in_progress":
        return "В работе";
      case "completed":
        return "Завершён";
      case "reclamation":
        return "Рекламация";
      default:
        return "В ожидании";
    }
  };

  const getStatusVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "reclamation":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Форматирование даты
  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
    });
  };

  // Цвет индикатора дедлайна
  const getDeadlineColor = (days: number | undefined) => {
    if (days === undefined || days === null) return "text-muted-foreground";
    if (days < 0) return "text-red-600 font-semibold"; // Просрочка
    if (days <= 3) return "text-red-500 font-medium"; // Критично
    if (days <= 7) return "text-yellow-600"; // Спешка
    return "text-green-600"; // Вовремя
  };

  // Форматирование текста дней
  const formatDaysText = (days: number | undefined) => {
    if (days === undefined || days === null) return "";
    if (days < 0) return `просрочен на ${Math.abs(days)} дн.`;
    if (days === 0) return "сегодня!";
    return `${days} дн.`;
  };

  return (
    <Card
      className={`p-3 border-l-4 ${borderColor} ${bgColor} transition-all duration-200 cursor-pointer`}
      onClick={onClick}
      data-testid={`card-project-${id}`}
    >
      <div className="space-y-2">
        {/* Строка 1: Номер + Название проекта + Статус + Процент */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold truncate flex-1" data-testid="text-project-name">
            {projectNumber && <span className="text-muted-foreground mr-2">№{projectNumber}</span>}
            {name}
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={getStatusVariant()} className="text-xs">
              {getStatusText()}
            </Badge>
            <span className="text-sm font-medium text-muted-foreground">
              {tasksStats?.progress ?? progress}%
            </span>
          </div>
        </div>

        {/* Строка 2: Клиент + РОП */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5" />
            <span className="truncate max-w-[200px]">{client}</span>
          </div>
          <div className="flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            <span className="truncate max-w-[150px]">{manager}</span>
          </div>
        </div>

        {/* Строка 3: Прогресс-бар по задачам */}
        <div className="flex items-center gap-2">
          <Progress
            value={tasksStats?.progress ?? progress}
            className="h-2 flex-1"
          />
          {tasksStats && tasksStats.total > 0 && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {tasksStats.completed}/{tasksStats.total} задач
            </span>
          )}
        </div>

        {/* Строка 4: Даты и дедлайн */}
        {(started_at || deadline) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {started_at && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Старт: {formatDate(started_at)}</span>
              </div>
            )}
            {deadline && (
              <div className="flex items-center gap-1">
                <span>До: {formatDate(deadline)}</span>
                <span className={getDeadlineColor(daysRemaining)}>
                  ({formatDaysText(daysRemaining)})
                </span>
              </div>
            )}
          </div>
        )}

        {/* Строка 5: Статистика этапов + Позиции */}
        {(stagesStats || itemsCount !== undefined) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {stagesStats && (
              <div className="flex items-center gap-1">
                <span>Этапы:</span>
                <span className="text-green-600">✓{stagesStats.completed}</span>
                <span className="text-blue-600">◐{stagesStats.inProgress}</span>
                <span className="text-gray-500">○{stagesStats.pending}</span>
              </div>
            )}
            {itemsCount !== undefined && (
              <div className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                <span>{itemsCount} позиций</span>
              </div>
            )}
          </div>
        )}

        {/* Строка 6: Текущий этап + Завершено */}
        {(currentStage || stagesStats) && (
          <div className="flex items-center justify-between gap-2 text-xs">
            {currentStage && (
              <span className="text-blue-600 font-medium truncate">
                Текущий: {currentStage}
              </span>
            )}
            {stagesStats && (
              <span className="text-muted-foreground shrink-0">
                Завершено: {stagesStats.completed} из {stagesStats.total}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
