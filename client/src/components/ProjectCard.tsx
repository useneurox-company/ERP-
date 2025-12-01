import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, Calendar, User, Clock, AlertTriangle } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { UserAvatar } from "./UserAvatar";

interface ProjectCardProps {
  id: string;
  name: string;
  client: string;
  progress: number;
  status: "pending" | "in_progress" | "completed" | "overdue";
  durationDays: number;
  manager: string;
  stages: { name: string; status: "pending" | "in_progress" | "completed" }[];
  started_at?: Date | null;
}

export function ProjectCard({ id, name, client, progress, status, durationDays, manager, stages, started_at }: ProjectCardProps) {
  // Расчёт оставшихся дней
  const calculateDaysRemaining = () => {
    if (!started_at || status === 'completed' || status === 'pending') return null;

    const startDate = new Date(started_at);
    const today = new Date();
    const elapsedDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = durationDays - elapsedDays;

    return remaining;
  };

  const daysRemaining = calculateDaysRemaining();
  const isOverdue = daysRemaining !== null && daysRemaining < 0;
  const isUrgent = daysRemaining !== null && daysRemaining > 0 && daysRemaining < 3;

  // Определение цвета бордюра
  const borderColor =
    status === 'completed' ? 'border-green-500' :
    status === 'in_progress' ? 'border-blue-500' :
    'border-gray-400';

  const bgColor =
    status === 'completed' ? 'bg-green-50/50 hover:bg-green-50/70 dark:bg-green-950/20 dark:hover:bg-green-950/30' :
    status === 'in_progress' ? 'bg-blue-50/50 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/30' :
    'bg-accent/30 hover:bg-accent/50';

  return (
    <Card
      className={`border-l-4 ${borderColor} ${bgColor} transition-all duration-200 cursor-pointer`}
      data-testid={`card-project-${id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{name}</h3>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{client}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge
              variant="outline"
              className={`text-xs ${
                status === 'in_progress'
                  ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                  : status === 'completed'
                  ? 'bg-green-500/10 text-green-600 border-green-500/20'
                  : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
              }`}
            >
              {status === 'in_progress' && '🔵 В работе'}
              {status === 'completed' && '🟢 Завершён'}
              {status === 'pending' && '⚪ Ожидает'}
              {status === 'overdue' && '🔴 Просрочен'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-muted-foreground">Прогресс</span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Дата начала */}
        {started_at && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Начат</span>
            </div>
            <span className="text-xs">{new Date(started_at).toLocaleDateString('ru-RU')}</span>
          </div>
        )}

        {/* Осталось дней */}
        {daysRemaining !== null && (
          <div className={`flex items-center justify-between text-sm p-2 rounded-md ${
            isOverdue
              ? 'bg-red-500/10 text-red-600 border border-red-500/20'
              : isUrgent
              ? 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
              : 'bg-primary/10 border border-primary/20'
          }`}>
            <div className="flex items-center gap-1 font-medium">
              {isOverdue ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              <span>{isOverdue ? 'Просрочено' : 'Осталось'}</span>
            </div>
            <span className="text-xs font-bold">
              {isOverdue ? `+${Math.abs(daysRemaining)}` : daysRemaining} дн.
            </span>
          </div>
        )}

        {!started_at && status === 'pending' && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>Длительность</span>
            </div>
            <span className="text-xs">{durationDays} дн.</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3" />
            <span>РОП</span>
          </div>
          <div className="flex items-center gap-2">
            <UserAvatar name={manager} size="sm" />
            <span className="text-xs">{manager.split(" ")[0]}</span>
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            Этапы ({stages.filter(s => s.status === "completed").length}/{stages.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {stages.slice(0, 3).map((stage, i) => (
              <Badge
                key={i}
                variant={stage.status === "completed" ? "default" : "outline"}
                className="text-xs"
              >
                {stage.name}
              </Badge>
            ))}
            {stages.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{stages.length - 3}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
