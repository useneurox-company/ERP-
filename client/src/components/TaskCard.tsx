import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Paperclip, MessageSquare, User, Clock, CheckSquare, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCardProps {
  id: string;
  title: string;
  status: string;
  assignee: string;
  priority: "low" | "medium" | "high" | "urgent";
  deadline: string;
  completed?: boolean;
  attachments?: number;
  comments?: number;
  deal_name?: string;
  project_name?: string;
  estimated_hours?: number;
  actual_hours?: number;
  checklist_total?: number;
  checklist_completed?: number;
  is_overdue?: boolean;
  onClick?: () => void;
}

const getStatusBorderColor = (status: string) => {
  switch (status) {
    case 'new': return 'border-l-slate-500';
    case 'pending': return 'border-l-gray-500';
    case 'in_progress': return 'border-l-blue-500';
    case 'pending_review': return 'border-l-yellow-500';
    case 'completed': return 'border-l-green-500';
    case 'rejected': return 'border-l-red-500';
    case 'cancelled': return 'border-l-gray-400';
    case 'on_hold': return 'border-l-purple-500';
    default: return 'border-l-gray-500';
  }
};

const priorityConfig = {
  low: { label: "Низкий", className: "text-xs h-5 px-2 bg-green-500/10 text-green-600 border-green-500/20" },
  medium: { label: "Средний", className: "text-xs h-5 px-2 bg-yellow-500/10 text-yellow-600 border-yellow-500/20" },
  high: { label: "Высокий", className: "text-xs h-5 px-2 bg-orange-500/10 text-orange-600 border-orange-500/20" },
  urgent: { label: "Срочный", className: "text-xs h-5 px-2 bg-red-500/10 text-red-600 border-red-500/20" },
};

const getDaysUntilDeadline = (deadline: string): { days: number; label: string } => {
  if (!deadline) return { days: 999, label: '' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineDate = new Date(deadline);
  deadlineDate.setHours(0, 0, 0, 0);

  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { days: diffDays, label: `${Math.abs(diffDays)}д` };
  if (diffDays === 0) return { days: 0, label: 'Сегодня' };
  if (diffDays === 1) return { days: 1, label: 'Завтра' };
  return { days: diffDays, label: `${diffDays}д` };
};

const formatDeadline = (deadline: string): string => {
  if (!deadline) return '';
  const date = new Date(deadline);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}`;
};

export function TaskCard({
  id,
  title,
  status,
  assignee,
  priority,
  deadline,
  completed = false,
  attachments = 0,
  comments = 0,
  deal_name,
  project_name,
  estimated_hours,
  actual_hours,
  checklist_total,
  checklist_completed,
  is_overdue = false,
  onClick,
}: TaskCardProps) {
  const { label: priorityLabel, className: priorityClassName } = priorityConfig[priority];
  const statusBorderColor = getStatusBorderColor(status);
  const { days, label: daysLabel } = getDaysUntilDeadline(deadline);

  // Определяем цвет фона для просроченных задач
  const isOverdue = is_overdue || (days < 0 && status !== 'completed');
  const isToday = days === 0 && status !== 'completed';

  return (
    <Card
      className={cn(
        "p-3 cursor-pointer hover:shadow-md transition-all border-l-4",
        statusBorderColor,
        isOverdue && "bg-red-50/50 border-red-100",
        isToday && "bg-orange-50/50 border-orange-100"
      )}
      onClick={onClick}
    >
      {/* Строка 1: ID + Название + Приоритет + Индикатор просроченности */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className="text-xs h-5 px-2 shrink-0 font-mono">
            #{id.slice(0, 8)}
          </Badge>
          <span className={cn(
            "font-medium text-sm truncate",
            completed && "line-through text-muted-foreground"
          )}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Badge className={cn("border", priorityClassName)}>
            {priorityLabel}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-xs h-5 px-2">
              -{Math.abs(days)}д
            </Badge>
          )}
          {isToday && (
            <Badge className="text-xs h-5 px-2 bg-orange-500/10 text-orange-600 border-orange-500/20">
              Сегодня
            </Badge>
          )}
        </div>
      </div>

      {/* Строка 2: Исполнитель + Дедлайн + Связанная сущность */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
        {assignee && (
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{assignee}</span>
          </div>
        )}
        {deadline && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{formatDeadline(deadline)}</span>
          </div>
        )}
        {deal_name && (
          <div className="flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            <span className="truncate max-w-[150px]" title={deal_name}>{deal_name}</span>
          </div>
        )}
        {project_name && !deal_name && (
          <div className="flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            <span className="truncate max-w-[150px]" title={project_name}>{project_name}</span>
          </div>
        )}
      </div>

      {/* Строка 3: Счетчики (вложения, комментарии, чек-лист, часы) */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {attachments > 0 && (
          <div className="flex items-center gap-1">
            <Paperclip className="h-3 w-3" />
            <span>{attachments}</span>
          </div>
        )}
        {comments > 0 && (
          <div className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            <span>{comments}</span>
          </div>
        )}
        {checklist_total !== undefined && checklist_total > 0 && (
          <div className="flex items-center gap-1">
            <CheckSquare className="h-3 w-3" />
            <span>{checklist_completed || 0}/{checklist_total}</span>
          </div>
        )}
        {(estimated_hours !== undefined || actual_hours !== undefined) && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {actual_hours !== undefined ? `${actual_hours}ч` : '0ч'}
              {estimated_hours !== undefined && `/${estimated_hours}ч`}
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
