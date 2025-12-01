import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowUp, ArrowDown, Minus } from "lucide-react";

type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
}

const priorityConfig: Record<TaskPriority, {
  label: string;
  icon: React.ReactNode;
  className: string;
}> = {
  low: {
    label: "Низкий",
    icon: <ArrowDown className="h-3 w-3" />,
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100"
  },
  normal: {
    label: "Обычный",
    icon: <Minus className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100"
  },
  high: {
    label: "Высокий",
    icon: <ArrowUp className="h-3 w-3" />,
    className: "bg-orange-100 text-orange-700 hover:bg-orange-100"
  },
  urgent: {
    label: "Срочный",
    icon: <AlertCircle className="h-3 w-3" />,
    className: "bg-red-100 text-red-700 hover:bg-red-100"
  },
};

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const config = priorityConfig[priority] || priorityConfig.normal;

  return (
    <Badge variant="outline" className={`flex items-center gap-1 ${config.className}`}>
      {config.icon}
      <span>{config.label}</span>
    </Badge>
  );
}
