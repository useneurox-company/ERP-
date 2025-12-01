import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  Activity,
  FileText,
  UserPlus,
  Edit,
  Trash2,
  ArrowRight,
  CheckCircle
} from "lucide-react";

interface EventBubbleProps {
  event: {
    id: string;
    description: string;
    action_type: string;
    field_changed?: string | null;
    old_value?: string | null;
    new_value?: string | null;
    user: {
      full_name?: string | null;
      username: string;
    };
    created_at: string;
  };
}

// Иконка для типа события
const getEventIcon = (actionType: string) => {
  const iconClass = "w-4 h-4";

  switch (actionType) {
    case 'created':
      return <CheckCircle className={cn(iconClass, "text-green-500")} />;
    case 'updated':
      return <Edit className={cn(iconClass, "text-blue-500")} />;
    case 'deleted':
      return <Trash2 className={cn(iconClass, "text-red-500")} />;
    case 'added':
      return <UserPlus className={cn(iconClass, "text-purple-500")} />;
    default:
      return <Activity className={cn(iconClass, "text-gray-500")} />;
  }
};

// Цвет бордера для типа события
const getEventBorderColor = (actionType: string): string => {
  switch (actionType) {
    case 'created':
      return 'border-l-green-500';
    case 'updated':
      return 'border-l-blue-500';
    case 'deleted':
      return 'border-l-red-500';
    case 'added':
      return 'border-l-purple-500';
    default:
      return 'border-l-gray-400';
  }
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

export function EventBubble({ event }: EventBubbleProps) {
  return (
    <div className="mb-3 animate-in fade-in duration-300">
      {/* Карточка события */}
      <div className={cn(
        "border-l-4 rounded-r-lg px-3 py-2 bg-muted/30",
        getEventBorderColor(event.action_type)
      )}>
        <div className="flex items-start gap-2">
          {/* Иконка */}
          <div className="mt-0.5 shrink-0">
            {getEventIcon(event.action_type)}
          </div>

          {/* Контент */}
          <div className="flex-1 min-w-0">
            {/* Описание события */}
            <p className="text-sm text-foreground/90">
              {event.description}
            </p>

            {/* Изменение поля (если есть) */}
            {event.field_changed && event.old_value && event.new_value && (
              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                <span className="line-through">{event.old_value}</span>
                <ArrowRight className="w-3 h-3" />
                <span className="font-medium text-foreground">{event.new_value}</span>
              </div>
            )}

            {/* Футер: автор и время */}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {event.user.full_name || event.user.username}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {formatTime(event.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
