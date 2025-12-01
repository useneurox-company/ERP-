import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, Lock } from "lucide-react";
import type { ProjectStage } from "@shared/schema";

interface StageInfo {
  id: string;
  name: string;
  status: string;
  isBlocked: boolean;
  stageTypeIcon?: string;
  order: number;
}

interface PositionProgressBarProps {
  stages: StageInfo[];
  currentStageId?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function PositionProgressBar({
  stages,
  currentStageId,
  className,
  size = 'md'
}: PositionProgressBarProps) {
  // Сортируем этапы по order
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  // Определяем размеры в зависимости от size
  const sizeClasses = {
    sm: {
      container: 'gap-1',
      icon: 'w-6 h-6',
      text: 'text-xs',
      line: 'h-0.5',
    },
    md: {
      container: 'gap-2',
      icon: 'w-8 h-8',
      text: 'text-sm',
      line: 'h-1',
    },
    lg: {
      container: 'gap-3',
      icon: 'w-10 h-10',
      text: 'text-base',
      line: 'h-1.5',
    },
  };

  const sizes = sizeClasses[size];

  // Получаем цвет и иконку для этапа
  const getStageAppearance = (stage: StageInfo, index: number) => {
    const isCurrent = stage.id === currentStageId;
    const isCompleted = stage.status === 'completed';
    const isBlocked = stage.isBlocked;
    const isPending = stage.status === 'pending' || stage.status === 'not_started';

    let bgColor = 'bg-gray-200';
    let textColor = 'text-gray-400';
    let icon = <Circle className={cn(sizes.icon, 'opacity-50')} />;
    let pulseAnimation = '';

    if (isBlocked) {
      bgColor = 'bg-red-100';
      textColor = 'text-red-600';
      icon = <Lock className={cn(sizes.icon, textColor)} />;
    } else if (isCompleted) {
      bgColor = 'bg-green-100';
      textColor = 'text-green-600';
      icon = <CheckCircle2 className={cn(sizes.icon, textColor)} />;
    } else if (isCurrent) {
      bgColor = 'bg-blue-100';
      textColor = 'text-blue-600';
      icon = <Clock className={cn(sizes.icon, textColor)} />;
      pulseAnimation = 'animate-pulse';
    } else if (isPending) {
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-400';
      icon = <Circle className={cn(sizes.icon, textColor, 'opacity-50')} />;
    }

    return { bgColor, textColor, icon, pulseAnimation };
  };

  // Получаем цвет линии между этапами
  const getLineColor = (fromStage: StageInfo, toStage: StageInfo) => {
    if (fromStage.status === 'completed') {
      return 'bg-green-500';
    }
    return 'bg-gray-300';
  };

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("flex items-center justify-between", sizes.container)}>
        {sortedStages.map((stage, index) => {
          const { bgColor, textColor, icon, pulseAnimation } = getStageAppearance(stage, index);
          const showLine = index < sortedStages.length - 1;
          const nextStage = sortedStages[index + 1];

          return (
            <div key={stage.id} className="flex items-center flex-1 last:flex-none">
              {/* Иконка этапа */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "rounded-full flex items-center justify-center",
                    bgColor,
                    "p-2",
                    pulseAnimation
                  )}
                  title={stage.name}
                >
                  {stage.stageTypeIcon ? (
                    <span className="text-xl">{stage.stageTypeIcon}</span>
                  ) : (
                    icon
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1 text-center max-w-[80px] truncate",
                    sizes.text,
                    textColor,
                    pulseAnimation && 'font-semibold'
                  )}
                  title={stage.name}
                >
                  {stage.name}
                </span>
              </div>

              {/* Линия к следующему этапу */}
              {showLine && nextStage && (
                <div className="flex-1 mx-1">
                  <div
                    className={cn(
                      "w-full rounded-full transition-colors",
                      sizes.line,
                      getLineColor(stage, nextStage)
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Упрощенная версия для компактного отображения
interface CompactProgressBarProps {
  totalStages: number;
  completedStages: number;
  currentStageName?: string;
}

export function CompactProgressBar({
  totalStages,
  completedStages,
  currentStageName
}: CompactProgressBarProps) {
  const percentage = totalStages > 0 ? (completedStages / totalStages) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {currentStageName || 'Прогресс'}
        </span>
        <span className="font-medium">
          {completedStages} / {totalStages}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
