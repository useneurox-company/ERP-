import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Clock, Briefcase, ExternalLink, Hash, Package } from "lucide-react";
import { useLocation } from "wouter";

interface TaskListProps {
  stageId?: string;
  dealId?: string;
  onTaskClick?: (taskId: string) => void;
  compact?: boolean;
}

export function TaskList({ stageId, dealId, onTaskClick, compact }: TaskListProps) {
  const [, setLocation] = useLocation();

  const queryUrl = dealId
    ? `/api/deals/${dealId}/tasks`
    : stageId
    ? `/api/stages/${stageId}/tasks`
    : '/api/tasks';

  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: [queryUrl],
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-slate-500/10 text-slate-600 border-slate-500/20';
      case 'pending':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      case 'in_progress':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'pending_review':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'completed':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'cancelled':
        return 'bg-gray-400/10 text-gray-500 border-gray-400/20';
      case 'on_hold':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new':
        return 'Новая';
      case 'pending':
        return 'Ожидает';
      case 'in_progress':
        return 'В работе';
      case 'pending_review':
        return 'На проверке';
      case 'completed':
        return 'Завершена';
      case 'rejected':
        return 'Отклонена';
      case 'cancelled':
        return 'Отменена';
      case 'on_hold':
        return 'Приостановлена';
      default:
        return status;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'high':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'normal':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'low':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'Срочный';
      case 'high':
        return 'Высокий';
      case 'normal':
        return 'Обычный';
      case 'low':
        return 'Низкий';
      default:
        return priority;
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Загрузка задач...</div>;
  }

  if (tasks.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Нет задач для этого этапа
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      {tasks.map((task: any) => (
        <Card
          key={task.id}
          className="hover:bg-accent/50 transition-colors cursor-pointer"
          onClick={() => onTaskClick?.(task.id)}
        >
          <CardContent className={compact ? "p-2" : "p-3"}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Task ID Badge */}
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs font-mono bg-muted/50">
                    <Hash className="w-3 h-3 mr-1" />
                    {task.id.substring(0, 8)}
                  </Badge>
                </div>

                <h4 className="font-medium text-sm truncate">{task.title || task.name}</h4>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {task.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </Badge>
                  <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                    {getPriorityLabel(task.priority)}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                  {task.assignee && (
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span className="font-medium text-foreground">{task.assignee.full_name || task.assignee.username}</span>
                    </div>
                  )}
                  {task.deadline && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(task.deadline).toLocaleDateString('ru-RU')}</span>
                    </div>
                  )}
                  {task.estimated_hours && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{task.estimated_hours}ч</span>
                    </div>
                  )}
                </div>

                {/* Show related deal with details */}
                {task.deal_id && task.deal && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-auto py-2 w-full justify-start"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocation(`/sales?dealId=${task.deal.id}`);
                    }}
                  >
                    <Briefcase className="w-3 h-3 mr-2 flex-shrink-0" />
                    <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                      <span className="text-xs font-medium truncate w-full text-left">
                        {task.deal.client_name}
                      </span>
                      {task.deal.company && (
                        <span className="text-xs text-muted-foreground truncate w-full text-left">
                          {task.deal.company}
                        </span>
                      )}
                      {task.deal.order_number && (
                        <span className="text-xs text-muted-foreground">
                          Заказ #{task.deal.order_number}
                        </span>
                      )}
                    </div>
                    <ExternalLink className="w-3 h-3 ml-2 flex-shrink-0" />
                  </Button>
                )}
                {task.project_id && task.project && (
                  <div className="flex items-center gap-1 mt-2 text-xs">
                    <Briefcase className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Проект:</span>
                    <span className="font-medium">{task.project.name}</span>
                  </div>
                )}
                {task.project_item_id && task.project_item && (
                  <div className="flex items-center gap-1 mt-2 text-xs">
                    <Package className="w-3 h-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Позиция:</span>
                    <span className="font-medium">{task.project_item.name}</span>
                    {task.project_item.article && (
                      <span className="text-muted-foreground">({task.project_item.article})</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
