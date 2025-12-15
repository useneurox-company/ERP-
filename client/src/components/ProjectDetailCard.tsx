import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, Building2, User, Clock, MapPin } from "lucide-react";

interface ProjectDetailCardProps {
  id: string;
  name: string;
  client: string;
  address?: string | null;
  progress: number;
  status: "pending" | "in_progress" | "completed" | "overdue";
  durationDays: number;
  manager: string;
  started_at?: Date | null;
  onClick?: () => void;
}

export function ProjectDetailCard({
  id,
  name,
  client,
  address,
  progress,
  status,
  durationDays,
  manager,
  started_at,
  onClick,
}: ProjectDetailCardProps) {
  // Определение цвета границы и фона
  const borderColor =
    status === "completed"
      ? "border-green-500"
      : status === "in_progress"
      ? "border-blue-500"
      : "border-gray-400";

  const bgColor =
    status === "completed"
      ? "bg-green-50/50 hover:bg-green-50/70 dark:bg-green-950/20 dark:hover:bg-green-950/30"
      : status === "in_progress"
      ? "bg-blue-50/50 hover:bg-blue-50/70 dark:bg-blue-950/20 dark:hover:bg-blue-950/30"
      : "bg-accent/30 hover:bg-accent/50";

  return (
    <Card
      className={`p-6 border-l-4 ${borderColor} ${bgColor} transition-all duration-200 cursor-pointer`}
      onClick={onClick}
      data-testid={`card-project-${id}`}
    >
      <div className="space-y-4">
        {/* Заголовок и статус */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold" data-testid="text-project-name">
              {name}
            </h2>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4" />
              <span className="text-sm">Клиент: {client}</span>
            </div>
            {address && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span className="text-sm">{address}</span>
              </div>
            )}
          </div>
          <Badge
            variant="outline"
            className={`text-sm px-3 py-1 ${
              status === "in_progress"
                ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                : status === "completed"
                ? "bg-green-500/10 text-green-600 border-green-500/20"
                : "bg-gray-500/10 text-gray-600 border-gray-500/20"
            }`}
          >
            {status === "in_progress" && "🔵 В работе"}
            {status === "completed" && "🟢 Завершён"}
            {status === "pending" && "⚪ Ожидает"}
            {status === "overdue" && "🔴 Просрочен"}
          </Badge>
        </div>

        {/* Информация о проекте */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Длительность */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Calendar className="w-4 h-4" />
              <span>Длительность</span>
            </div>
            <p className="text-lg font-medium" data-testid="text-project-duration">
              {durationDays} дн.
            </p>
            {started_at && (
              <p className="text-xs text-muted-foreground">
                Начат: {new Date(started_at).toLocaleDateString("ru-RU")}
              </p>
            )}
          </div>

          {/* Прогресс */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Clock className="w-4 h-4" />
              <span>Прогресс</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold" data-testid="text-project-progress">
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>

          {/* РОП */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <User className="w-4 h-4" />
              <span>РОП</span>
            </div>
            <p className="text-lg font-medium" data-testid="text-project-manager">
              {manager}
            </p>
          </div>
        </div>

        {/* Позиции мебели */}
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            Кликните для просмотра деталей проекта
          </p>
        </div>
      </div>
    </Card>
  );
}
