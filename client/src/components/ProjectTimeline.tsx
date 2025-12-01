import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface ProjectTimelineProps {
  projectId: string;
}

export function ProjectTimeline({ projectId }: ProjectTimelineProps) {
  const { data: timeline, isLoading } = useQuery<any>({
    queryKey: ["/api/projects", projectId, "timeline"],
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Таймлайн проекта</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Загрузка...</p>
        </CardContent>
      </Card>
    );
  }

  if (!timeline || !timeline.stats || !timeline.stages) {
    return null;
  }

  const { stats, stages } = timeline;
  const hasDelays = stages.some((s: any) => s.delay_days && s.delay_days > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Таймлайн проекта</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Всего этапов</p>
            <p className="text-2xl font-bold" data-testid="text-total-stages">{stats.total}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Завершено</p>
            <p className="text-2xl font-bold text-green-600" data-testid="text-completed-stages">{stats.completed}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">В работе</p>
            <p className="text-2xl font-bold text-blue-600" data-testid="text-in-progress-stages">{stats.in_progress}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Ожидает</p>
            <p className="text-2xl font-bold text-gray-500" data-testid="text-pending-stages">{stats.pending}</p>
          </div>
        </div>

        {stats.final_deadline && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Финальный срок</p>
                <p className="text-lg font-semibold" data-testid="text-final-deadline">
                  {format(new Date(stats.final_deadline), "dd.MM.yyyy")}
                </p>
              </div>
            </div>
          </div>
        )}

        {hasDelays && (
          <div className="border-t pt-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-orange-600">Задержки в выполнении</p>
                <div className="space-y-1 mt-2">
                  {stages
                    .filter((s: any) => s.delay_days && s.delay_days > 0)
                    .map((stage: any) => (
                      <div key={stage.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{stage.name}</span>
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          +{stage.delay_days} дней
                        </Badge>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>
              Прогресс: {stats.completed}/{stats.total} этапов (
              {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%)
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
