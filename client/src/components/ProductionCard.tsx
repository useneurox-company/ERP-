import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QrCode, Clock, DollarSign, User, CheckCircle2, Circle, FolderKanban } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "./UserAvatar";

interface ProductionStage {
  name: string;
  status: "completed" | "in_progress" | "pending";
}

interface ProductionCardProps {
  id: string;
  itemName: string;
  projectName?: string | null;
  stages: ProductionStage[];
  progress: number;
  worker: string;
  payment: number;
  deadline: string;
  qrCode?: boolean;
  status: "pending" | "in_progress" | "completed";
  onClick?: () => void;
}

export function ProductionCard({ id, itemName, projectName, stages, progress, worker, payment, deadline, qrCode = false, status, onClick }: ProductionCardProps) {
  const currentStage = stages.find((s) => s.status === "in_progress")?.name || (stages.length > 0 ? stages[stages.length - 1].name : "Нет стадий");

  const statusLabels: Record<string, string> = {
    pending: "В ожидании",
    in_progress: "В работе",
    completed: "Завершено",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300",
    in_progress: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
    completed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  };

  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer" 
      data-testid={`card-production-${id}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate" data-testid={`text-production-item-name-${id}`}>{itemName}</h3>
            {projectName && (
              <div className="flex items-center gap-1 mt-1">
                <FolderKanban className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate" data-testid={`text-production-project-${id}`}>
                  {projectName}
                </span>
              </div>
            )}
            <Badge variant="default" className="text-xs mt-2" data-testid={`badge-production-stage-${id}`}>
              {currentStage}
            </Badge>
          </div>
          {qrCode && (
            <div className="flex items-center justify-center w-12 h-12 bg-muted rounded" data-testid={`icon-production-qr-${id}`}>
              <QrCode className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Прогресс</span>
            <span className="font-medium" data-testid={`text-production-progress-${id}`}>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" data-testid={`progress-production-${id}`} />
        </div>

        {stages.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-muted-foreground">Этапы производства:</span>
            <div className="flex flex-wrap gap-1">
              {stages.slice(0, 3).map((stage, index) => {
                const isCompleted = stage.status === "completed";
                const isInProgress = stage.status === "in_progress";

                return (
                  <div
                    key={index}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs ${
                      isCompleted
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : isInProgress
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-muted text-muted-foreground"
                    }`}
                    data-testid={`production-stage-${id}-${index}`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Circle className={`h-3 w-3 ${isInProgress ? "fill-current" : ""}`} />
                    )}
                    <span>{stage.name}</span>
                  </div>
                );
              })}
              {stages.length > 3 && (
                <Badge variant="secondary" className="text-xs">
                  +{stages.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="text-xs">Работник</span>
          </div>
          <div className="flex items-center gap-2">
            <UserAvatar name={worker} size="sm" />
            <span className="text-xs" data-testid={`text-production-worker-${id}`}>
              {worker.split(" ")[0]}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span className="text-xs">Оплата</span>
          </div>
          <span className="text-xs font-medium" data-testid={`text-production-payment-${id}`}>
            ₽{payment.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="text-xs">Срок</span>
          </div>
          <span className="text-xs" data-testid={`text-production-deadline-${id}`}>{deadline}</span>
        </div>

        <Badge 
          variant="outline" 
          className={`text-xs w-full justify-center ${statusColors[status]}`}
          data-testid={`badge-production-status-${id}`}
        >
          {statusLabels[status]}
        </Badge>
      </CardContent>
    </Card>
  );
}
