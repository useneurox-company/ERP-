import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import {
  Activity,
  CheckCircle,
  FileText,
  Edit,
  Trash2,
  Play,
  Clock,
  Loader2,
  Hammer,
  XCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface ActivityLog {
  id: string;
  entity_type: string;
  entity_id: string;
  action_type: string;
  user_id: string | null;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  description: string | null;
  created_at: string;
  user: {
    id: string;
    username: string;
    full_name: string;
  } | null;
}

interface ProjectActivityLogProps {
  projectId: string;
}

// Map action types to icons
const getActionIcon = (actionType: string) => {
  const iconClass = "w-4 h-4";

  switch (actionType) {
    case "created":
      return <Activity className={iconClass} />;
    case "updated":
    case "stage_updated":
      return <Edit className={iconClass} />;
    case "deleted":
      return <Trash2 className={iconClass} />;
    case "stage_started":
    case "started":
      return <Play className={iconClass} />;
    case "stage_completed":
    case "completed":
      return <CheckCircle className={iconClass} />;
    case "document_uploaded":
      return <FileText className={iconClass} />;
    case "deadline_changed":
      return <Clock className={iconClass} />;
    case "item_ready_for_montage":
      return <Hammer className={`${iconClass} text-green-500`} />;
    case "item_not_ready_for_montage":
      return <XCircle className={`${iconClass} text-gray-500`} />;
    case "montage_created":
      return <Hammer className={iconClass} />;
    default:
      return <Activity className={iconClass} />;
  }
};

export function ProjectActivityLog({ projectId }: ProjectActivityLogProps) {
  const { data: activityLogs = [], isLoading, isError, error } = useQuery<ActivityLog[]>({
    queryKey: ['/api/projects', projectId, 'events'],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/events`);
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!projectId,
    refetchInterval: 5000, // Обновление каждые 5 секунд
    staleTime: 0,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">События проекта</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {activityLogs.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="text-center py-8">
              <p className="text-sm text-destructive">Ошибка загрузки событий</p>
              <p className="text-xs text-muted-foreground mt-1">
                {error instanceof Error ? error.message : "Попробуйте обновить страницу"}
              </p>
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Нет событий</p>
              <p className="text-xs text-muted-foreground mt-1">
                История изменений будет отображаться здесь
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="text-muted-foreground mt-1">
                    {getActionIcon(log.action_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    {log.user && (
                      <p className="text-xs font-medium text-primary mb-1">
                        {log.user.full_name || log.user.username}
                      </p>
                    )}
                    <p className="text-sm break-words">{log.description}</p>
                    {log.field_changed && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Поле: {log.field_changed}
                        {log.old_value && log.new_value && (
                          <span> ({log.old_value} → {log.new_value})</span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: ru
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
