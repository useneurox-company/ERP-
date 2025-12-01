import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  FileText,
  MessageSquare,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Play,
  Unlock
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/notifications";

interface NotificationListProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClose: () => void;
}

export function NotificationList({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClose
}: NotificationListProps) {

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'deadline_change':
        return <Calendar className="w-4 h-4" />;
      case 'stage_unblocked':
        return <Unlock className="w-4 h-4" />;
      case 'new_document':
        return <FileText className="w-4 h-4" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4" />;
      case 'budget_exceeded':
        return <DollarSign className="w-4 h-4" />;
      case 'deadline_overdue':
        return <AlertTriangle className="w-4 h-4" />;
      case 'stage_completed':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'stage_started':
        return <Play className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: NotificationType) => {
    switch (type) {
      case 'deadline_change':
        return 'text-blue-600 bg-blue-50';
      case 'stage_unblocked':
        return 'text-green-600 bg-green-50';
      case 'new_document':
        return 'text-purple-600 bg-purple-50';
      case 'comment':
        return 'text-indigo-600 bg-indigo-50';
      case 'budget_exceeded':
        return 'text-orange-600 bg-orange-50';
      case 'deadline_overdue':
        return 'text-red-600 bg-red-50';
      case 'stage_completed':
        return 'text-emerald-600 bg-emerald-50';
      case 'stage_started':
        return 'text-cyan-600 bg-cyan-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'только что';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} мин назад`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} ч назад`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} дн назад`;

    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short'
    });
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    // Можно добавить навигацию к сущности
    onClose();
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col h-full max-h-[600px]">
      {/* Заголовок */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Уведомления</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllAsRead}
              className="text-xs"
            >
              Прочитать все
            </Button>
          )}
        </div>
      </div>

      {/* Список уведомлений */}
      <ScrollArea className="flex-1">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Нет уведомлений</p>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => {
              const colorClasses = getNotificationColor(notification.type);

              return (
                <div
                  key={notification.id}
                  className={cn(
                    "p-4 hover:bg-accent cursor-pointer transition-colors",
                    !notification.read && "bg-blue-50/50"
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex items-start gap-3">
                    {/* Иконка */}
                    <div className={cn(
                      "p-2 rounded-full flex-shrink-0",
                      colorClasses
                    )}>
                      {getNotificationIcon(notification.type)}
                    </div>

                    {/* Содержимое */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm",
                          !notification.read && "font-semibold"
                        )}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatTimeAgo(notification.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      {/* Футер со статистикой */}
      {notifications.length > 0 && (
        <div className="p-3 border-t bg-muted/30">
          <p className="text-xs text-center text-muted-foreground">
            {unreadCount > 0 ? (
              <>
                <strong>{unreadCount}</strong> {unreadCount === 1 ? 'непрочитанное' : 'непрочитанных'}
              </>
            ) : (
              'Все уведомления прочитаны'
            )}
          </p>
        </div>
      )}
    </div>
  );
}
