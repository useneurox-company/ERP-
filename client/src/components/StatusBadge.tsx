import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType = "pending" | "in_progress" | "completed" | "overdue" | "cancelled";

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<StatusType, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Не начат", variant: "secondary" },
  in_progress: { label: "В работе", variant: "default" },
  completed: { label: "Завершен", variant: "outline" },
  overdue: { label: "Просрочен", variant: "destructive" },
  cancelled: { label: "Отменен", variant: "outline" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <Badge 
      variant={config.variant}
      className={cn("text-xs", className)}
      data-testid={`badge-status-${status}`}
    >
      {config.label}
    </Badge>
  );
}
