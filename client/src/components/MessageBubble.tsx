import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Check, CheckCheck, MessageSquare, Phone, Mail, CheckSquare } from "lucide-react";

interface MessageBubbleProps {
  message: {
    id: string;
    content: string;
    author: {
      id: string;
      full_name?: string | null;
      username: string;
    };
    created_at: string;
    is_read?: boolean | number;
    direction?: string;
    message_type: string;
  };
  currentUserId: string;
}

// Получить инициалы из имени
const getInitials = (name: string | null | undefined, username: string): string => {
  if (name) {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return username.substring(0, 2).toUpperCase();
};

// Форматирование времени
const formatTime = (dateString: string): string => {
  if (!dateString) return '';

  const date = new Date(dateString);

  // Проверка на валидность даты
  if (isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    // Сегодня - только время
    return format(date, "HH:mm", { locale: ru });
  } else if (diffInDays === 1) {
    // Вчера
    return `Вчера, ${format(date, "HH:mm", { locale: ru })}`;
  } else {
    // Старше - полная дата
    return format(date, "dd.MM.yyyy HH:mm", { locale: ru });
  }
};

// Иконка типа сообщения
const MessageTypeIcon = ({ type }: { type: string }) => {
  const iconClass = "w-3 h-3";

  switch (type) {
    case 'note':
      return <MessageSquare className={iconClass} />;
    case 'call':
      return <Phone className={iconClass} />;
    case 'email':
      return <Mail className={iconClass} />;
    case 'task':
      return <CheckSquare className={iconClass} />;
    default:
      return <MessageSquare className={iconClass} />;
  }
};

// Цвет бэйджа типа сообщения
const getMessageTypeBadgeClass = (type: string): string => {
  switch (type) {
    case 'note':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'call':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'email':
      return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    case 'task':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
};

// Helper to render message with images (thumbnails that expand on click)
function renderMessageContent(message: string) {
  const parts = message.split(/(\[img\][^\[]+\[\/img\])/g);

  return parts.map((part, index) => {
    const imgMatch = part.match(/\[img\]([^\[]+)\[\/img\]/);
    if (imgMatch) {
      // imgUrl может быть /objects/uuid.ext или просто uuid.ext
      // Формируем корректный URL для endpoint /objects/:objectPath
      const imgUrl = imgMatch[1].startsWith('/objects/') ? imgMatch[1] : `/objects/${imgMatch[1]}`;
      const fullUrl = imgUrl;
      return (
        <img
          key={index}
          src={fullUrl}
          alt="Изображение"
          className="max-h-16 rounded border cursor-pointer hover:opacity-80 hover:shadow-md transition-all inline-block"
          title="Нажмите для увеличения"
          onClick={() => window.open(fullUrl, '_blank')}
        />
      );
    }
    return part ? <span key={index}>{part}</span> : null;
  });
}

export function MessageBubble({ message, currentUserId }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'outgoing' || message.author.id === currentUserId;
  const isRead = message.is_read === true || message.is_read === 1;

  return (
    <div
      className={cn(
        "flex gap-2 mb-3 animate-in fade-in duration-300",
        isOutgoing ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <Avatar className="w-8 h-8 shrink-0">
        <AvatarFallback className={cn(
          "text-xs font-medium",
          isOutgoing
            ? "bg-blue-500 text-white"
            : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
        )}>
          {getInitials(message.author.full_name, message.author.username)}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-[70%]",
          isOutgoing ? "items-end" : "items-start"
        )}
      >
        {/* Message Header */}
        <div className={cn(
          "flex items-center gap-2 px-1",
          isOutgoing ? "flex-row-reverse" : "flex-row"
        )}>
          <span className="text-xs font-medium text-foreground">
            {message.author.full_name || message.author.username}
          </span>
          <Badge
            variant="outline"
            className={cn("text-[10px] h-4 px-1.5", getMessageTypeBadgeClass(message.message_type))}
          >
            <MessageTypeIcon type={message.message_type} />
          </Badge>
        </div>

        {/* Message Bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2 shadow-sm",
            isOutgoing
              ? "bg-blue-500 text-white rounded-tr-sm"
              : "bg-gray-100 dark:bg-gray-800 text-foreground rounded-tl-sm"
          )}
        >
          <div className="text-sm whitespace-pre-wrap break-words">{renderMessageContent(message.content)}</div>
        </div>

        {/* Message Footer */}
        <div className={cn(
          "flex items-center gap-1.5 px-1",
          isOutgoing ? "flex-row-reverse" : "flex-row"
        )}>
          <span className={cn(
            "text-[10px]",
            isOutgoing ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"
          )}>
            {formatTime(message.created_at)}
          </span>

          {/* Read Status - только для исходящих */}
          {isOutgoing && (
            <div className="flex items-center">
              {isRead ? (
                <CheckCheck className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              ) : (
                <Check className="w-3.5 h-3.5 text-gray-400" />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
