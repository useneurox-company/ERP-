import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CheckSquare, Clock, User, Paperclip, ChevronRight } from "lucide-react";

interface TaskBubbleProps {
  task: {
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    due_date?: string | null;
    assignee?: {
      id: string;
      full_name?: string | null;
      username: string;
    } | null;
    created_at: string;
    attachments?: Array<{
      id: string;
      file_name: string;
    }>;
  };
  onOpenDetails?: (taskId: string) => void;
}

// Метаданные статусов
const statusMetadata: Record<string, { label: string; color: string }> = {
  new: { label: "Новая", color: "bg-gray-500" },
  pending: { label: "В ожидании", color: "bg-yellow-500" },
  in_progress: { label: "В работе", color: "bg-blue-500" },
  pending_review: { label: "На проверке", color: "bg-purple-500" },
  completed: { label: "Завершена", color: "bg-green-500" },
  rejected: { label: "Отклонена", color: "bg-red-500" },
  cancelled: { label: "Отменена", color: "bg-gray-400" },
  on_hold: { label: "Приостановлена", color: "bg-orange-500" },
};

// Метаданные приоритетов
const priorityMetadata: Record<string, { label: string; color: string }> = {
  low: { label: "Низкий", color: "text-gray-500" },
  medium: { label: "Средний", color: "text-blue-500" },
  high: { label: "Высокий", color: "text-orange-500" },
  urgent: { label: "Срочно", color: "text-red-500" },
};

// Форматирование времени
const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return format(date, "HH:mm", { locale: ru });
  } else if (diffInDays === 1) {
    return `Вчера, ${format(date, "HH:mm", { locale: ru })}`;
  } else {
    return format(date, "dd.MM.yyyy HH:mm", { locale: ru });
  }
};

export function TaskBubble({ task, onOpenDetails }: TaskBubbleProps) {
  const statusInfo = statusMetadata[task.status] || statusMetadata.pending;
  const priorityInfo = priorityMetadata[task.priority] || priorityMetadata.medium;

  return (
    <div className="mb-3 animate-in fade-in duration-300">
      {/* Карточка задачи */}
      <div className="border rounded-lg p-3 bg-card hover:bg-accent/50 transition-colors">
        {/* Заголовок */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-start gap-2 flex-1">
            <CheckSquare className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium line-clamp-2">{task.title}</h4>
              {task.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Метаданные */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {/* Статус */}
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-5 px-1.5",
              statusInfo.color,
              "text-white border-0"
            )}
          >
            {statusInfo.label}
          </Badge>

          {/* Приоритет */}
          <span className={cn("text-[10px] font-medium", priorityInfo.color)}>
            {priorityInfo.label}
          </span>

          {/* Исполнитель */}
          {task.assignee && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[120px]">
                {task.assignee.full_name || task.assignee.username}
              </span>
            </div>
          )}

          {/* Срок выполнения */}
          {task.due_date && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>до {format(new Date(task.due_date), "dd.MM.yyyy", { locale: ru })}</span>
            </div>
          )}
        </div>

        {/* Файлы */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {task.attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-[10px] text-muted-foreground"
              >
                <Paperclip className="w-3 h-3" />
                <span className="truncate max-w-[100px]">{attachment.file_name}</span>
              </div>
            ))}
          </div>
        )}

        {/* Футер */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-[10px] text-muted-foreground">
            {formatTime(task.created_at)}
          </span>

          {onOpenDetails && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenDetails(task.id)}
              className="h-6 px-2 text-[10px]"
            >
              Открыть
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
