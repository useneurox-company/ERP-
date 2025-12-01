import { Badge } from "@/components/ui/badge";

type TaskStatus = 'new' | 'in_progress' | 'pending_review' | 'completed' | 'rejected' | 'cancelled' | 'on_hold';

interface TaskStatusBadgeProps {
  status: TaskStatus;
}

const statusConfig: Record<TaskStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Новая", variant: "secondary" },
  in_progress: { label: "В работе", variant: "default" },
  pending_review: { label: "На проверке", variant: "outline" },
  completed: { label: "Завершена", variant: "default" },
  rejected: { label: "Отклонена", variant: "destructive" },
  cancelled: { label: "Отменена", variant: "secondary" },
  on_hold: { label: "Приостановлена", variant: "outline" },
};

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.new;

  return (
    <Badge variant={config.variant} className="capitalize">
      {config.label}
    </Badge>
  );
}
