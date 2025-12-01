import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Lock,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectStage } from "@shared/schema";

interface ProjectMetrics {
  totalStages: number;
  completedStages: number;
  inProgressStages: number;
  blockedStages: number;
  overallProgress: number;

  daysToDeadline?: number;
  isOverdue: boolean;
  deadlineDate?: string;

  budgetPlanned?: number;
  budgetSpent?: number;
  budgetRemaining?: number;
  isBudgetExceeded: boolean;

  criticalIssues: CriticalIssue[];
  recentDelays: DelayInfo[];
}

interface CriticalIssue {
  id: string;
  type: 'blocked' | 'overdue' | 'budget_exceeded';
  stageName: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
}

interface DelayInfo {
  id: string;
  stageName: string;
  daysDelayed: number;
  reason?: string;
}

interface ProjectDashboardProps {
  metrics: ProjectMetrics;
  projectName: string;
  className?: string;
}

export function ProjectDashboard({
  metrics,
  projectName,
  className
}: ProjectDashboardProps) {

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-100 text-red-700 border-red-200';
      case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'low': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'blocked': return <Lock className="w-4 h-4" />;
      case 'overdue': return <Clock className="w-4 h-4" />;
      case 'budget_exceeded': return <DollarSign className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
  };

  // Вычисляем процент бюджета
  const budgetPercentage = metrics.budgetPlanned && metrics.budgetPlanned > 0
    ? (metrics.budgetSpent || 0) / metrics.budgetPlanned * 100
    : 0;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{projectName}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Дашборд проекта с ключевыми метриками
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-4 py-2">
          <Activity className="w-4 h-4 mr-2" />
          {metrics.overallProgress}% завершено
        </Badge>
      </div>

      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Прогресс этапов */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Этапы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.completedStages} / {metrics.totalStages}
            </div>
            <Progress value={(metrics.completedStages / metrics.totalStages) * 100} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              В работе: {metrics.inProgressStages}
            </p>
          </CardContent>
        </Card>

        {/* Дедлайн */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Дедлайн
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.isOverdue ? (
              <>
                <div className="text-2xl font-bold text-red-600 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6" />
                  Просрочен
                </div>
                <p className="text-xs text-red-600 mt-2">
                  На {Math.abs(metrics.daysToDeadline || 0)} дней
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {metrics.daysToDeadline !== undefined ? `${metrics.daysToDeadline} дн` : '-'}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatDate(metrics.deadlineDate)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Бюджет */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-purple-600" />
              Бюджет
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.budgetPlanned ? formatCurrency(metrics.budgetSpent || 0) : '-'}
            </div>
            {metrics.budgetPlanned && (
              <>
                <Progress
                  value={budgetPercentage}
                  className={cn(
                    "mt-2 h-2",
                    metrics.isBudgetExceeded && "[&>div]:bg-red-500"
                  )}
                />
                <p className={cn(
                  "text-xs mt-2",
                  metrics.isBudgetExceeded ? "text-red-600" : "text-muted-foreground"
                )}>
                  {metrics.isBudgetExceeded ? 'Превышен' : 'Осталось'}: {formatCurrency(Math.abs(metrics.budgetRemaining || 0))}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Блокировки */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lock className="w-4 h-4 text-orange-600" />
              Блокировки
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.blockedStages > 0 ? (
              <>
                <div className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6" />
                  {metrics.blockedStages}
                </div>
                <p className="text-xs text-orange-600 mt-2">
                  Требуют внимания
                </p>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6" />
                  0
                </div>
                <p className="text-xs text-green-600 mt-2">
                  Нет блокировок
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Круговая диаграмма прогресса */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Общий прогресс проекта</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center">
            <CircularProgress
              value={metrics.overallProgress}
              size={200}
              strokeWidth={16}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Критические проблемы */}
        {metrics.criticalIssues.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Критические проблемы
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.criticalIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={cn(
                      "p-3 rounded-md border",
                      getSeverityColor(issue.severity)
                    )}
                  >
                    <div className="flex items-start gap-2">
                      {getIssueIcon(issue.type)}
                      <div className="flex-1">
                        <p className="font-medium text-sm">{issue.stageName}</p>
                        <p className="text-xs mt-1 opacity-90">{issue.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Задержки */}
        {metrics.recentDelays.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-600" />
                Текущие задержки
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics.recentDelays.map((delay) => (
                  <div
                    key={delay.id}
                    className="p-3 rounded-md border border-orange-200 bg-orange-50"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{delay.stageName}</p>
                        {delay.reason && (
                          <p className="text-xs text-muted-foreground mt-1">{delay.reason}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-orange-700">
                        +{delay.daysDelayed} дн
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Положительные индикаторы */}
      {metrics.criticalIssues.length === 0 && metrics.recentDelays.length === 0 && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center gap-3 text-green-700">
              <CheckCircle2 className="w-8 h-8" />
              <div>
                <p className="font-semibold">Проект идет по плану</p>
                <p className="text-sm">Нет критических проблем и задержек</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Компонент круговой диаграммы прогресса
interface CircularProgressProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
}

function CircularProgress({ value, size = 120, strokeWidth = 10 }: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  const getColor = () => {
    if (value >= 80) return '#10b981'; // green
    if (value >= 50) return '#3b82f6'; // blue
    if (value >= 25) return '#f59e0b'; // orange
    return '#ef4444'; // red
  };

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Фоновый круг */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Прогресс */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      {/* Текст в центре */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold" style={{ color: getColor() }}>
          {value}%
        </span>
        <span className="text-xs text-muted-foreground mt-1">завершено</span>
      </div>
    </div>
  );
}
