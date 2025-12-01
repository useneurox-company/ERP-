import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays } from "date-fns";
import type { ProjectStage } from "@shared/schema";

interface GanttChartProps {
  stages: ProjectStage[];
}

export function GanttChart({ stages }: GanttChartProps) {
  const { chartData, dateRange, totalDays } = useMemo(() => {
    if (stages.length === 0) {
      return { chartData: [], dateRange: { start: new Date(), end: new Date() }, totalDays: 0 };
    }

    const dates = stages.flatMap(stage => [
      stage.planned_start_date ? new Date(stage.planned_start_date) : null,
      stage.planned_end_date ? new Date(stage.planned_end_date) : null,
      stage.actual_start_date ? new Date(stage.actual_start_date) : null,
      stage.actual_end_date ? new Date(stage.actual_end_date) : null,
    ].filter(d => d !== null) as Date[]);

    if (dates.length === 0) {
      return { chartData: [], dateRange: { start: new Date(), end: new Date() }, totalDays: 0 };
    }

    const start = new Date(Math.min(...dates.map(d => d.getTime())));
    const end = new Date(Math.max(...dates.map(d => d.getTime())));
    const days = differenceInDays(end, start) + 1;

    const data = stages.map(stage => {
      const plannedStart = stage.planned_start_date ? new Date(stage.planned_start_date) : null;
      const plannedEnd = stage.planned_end_date ? new Date(stage.planned_end_date) : null;
      const actualStart = stage.actual_start_date ? new Date(stage.actual_start_date) : null;
      const actualEnd = stage.actual_end_date ? new Date(stage.actual_end_date) : null;

      const plannedOffset = plannedStart ? differenceInDays(plannedStart, start) : 0;
      const plannedDuration = plannedStart && plannedEnd ? differenceInDays(plannedEnd, plannedStart) + 1 : 0;
      
      const actualOffset = actualStart ? differenceInDays(actualStart, start) : 0;
      const actualDuration = actualStart && actualEnd ? differenceInDays(actualEnd, actualStart) + 1 : 
                             actualStart ? differenceInDays(new Date(), actualStart) + 1 : 0;

      return {
        stage,
        plannedOffset: (plannedOffset / days) * 100,
        plannedWidth: (plannedDuration / days) * 100,
        actualOffset: (actualOffset / days) * 100,
        actualWidth: (actualDuration / days) * 100,
        hasPlanned: !!plannedStart && !!plannedEnd,
        hasActual: !!actualStart,
      };
    });

    return { chartData: data, dateRange: { start, end }, totalDays: days };
  }, [stages]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>График Ганта</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            Нет этапов с датами для отображения
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>График Ганта</CardTitle>
        <div className="flex gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-primary/30 border border-primary rounded"></div>
            <span>План</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-primary rounded"></div>
            <span>Факт</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground mb-4">
          {format(dateRange.start, "dd.MM.yyyy")} - {format(dateRange.end, "dd.MM.yyyy")} ({totalDays} дней)
        </div>

        <div className="space-y-3">
          {chartData.map(({ stage, plannedOffset, plannedWidth, actualOffset, actualWidth, hasPlanned, hasActual }) => (
            <div key={stage.id} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">{stage.name}</span>
                  <Badge variant={stage.status === 'completed' ? 'default' : stage.status === 'in_progress' ? 'secondary' : 'outline'} className="shrink-0">
                    {stage.status === 'completed' ? 'Завершен' : stage.status === 'in_progress' ? 'В работе' : 'Ожидает'}
                  </Badge>
                </div>
              </div>

              <div className="relative h-8 bg-muted rounded">
                {hasPlanned && (
                  <div
                    className="absolute top-0 h-full bg-primary/30 border border-primary rounded"
                    style={{
                      left: `${plannedOffset}%`,
                      width: `${plannedWidth}%`,
                    }}
                    data-testid={`gantt-planned-${stage.id}`}
                  />
                )}
                {hasActual && (
                  <div
                    className="absolute top-0 h-full bg-primary rounded"
                    style={{
                      left: `${actualOffset}%`,
                      width: `${actualWidth}%`,
                    }}
                    data-testid={`gantt-actual-${stage.id}`}
                  />
                )}
              </div>

              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {stage.actual_start_date 
                    ? `Начато: ${format(new Date(stage.actual_start_date), "dd.MM.yyyy")}`
                    : stage.planned_start_date 
                    ? `План: ${format(new Date(stage.planned_start_date), "dd.MM.yyyy")}`
                    : 'Не начато'}
                </span>
                <span>
                  {stage.actual_end_date 
                    ? `Завершено: ${format(new Date(stage.actual_end_date), "dd.MM.yyyy")}`
                    : stage.planned_end_date 
                    ? `План: ${format(new Date(stage.planned_end_date), "dd.MM.yyyy")}`
                    : '-'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
