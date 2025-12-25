import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StageDetailView } from "@/components/StageDetailView";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Link2,
  Layers,
  Plus,
  Package,
  Ruler,
  FileText,
  PenTool,
  ClipboardCheck,
  Factory,
  Wrench
} from "lucide-react";
import type { ProjectStage, User, RolePermission } from "@shared/schema";

interface ProjectBusinessProcessesProps {
  projectId: string;
  selectedItemId?: string | null;
  onAddStage?: () => void;
}

interface StageWithDependencies extends ProjectStage {
  dependencies?: string[];
  dependentStages?: string[];
  isOnCriticalPath?: boolean;
  delayDays?: number;
}

export function ProjectBusinessProcesses({ projectId, selectedItemId, onAddStage }: ProjectBusinessProcessesProps) {
  // State для модального окна с деталями этапа
  const [selectedStage, setSelectedStage] = useState<ProjectStage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Получаем текущего пользователя из localStorage
  const userStr = localStorage.getItem("user");
  const currentUser: User | null = userStr ? JSON.parse(userStr) : null;

  // Получаем этапы выбранной позиции
  const { data: stages = [], isLoading } = useQuery<ProjectStage[]>({
    queryKey: ['/api/projects', projectId, 'items', selectedItemId, 'stages'],
    enabled: !!projectId && !!selectedItemId,
  });

  // Получаем типы этапов для отображения названий
  const { data: stageTypes = [] } = useQuery<{id: string, code: string, name: string}[]>({
    queryKey: ['/api/stage-types'],
  });

  // Функция для получения типа этапа по его stage_type_id
  const getStageTypeCode = (stageTypeId: string | null) => {
    if (!stageTypeId) return null;
    return stageTypes.find(t => t.id === stageTypeId)?.code || null;
  };

  // Функция для рендеринга иконки этапа по коду типа
  const renderStageIcon = (code: string | null) => {
    const iconClass = "w-8 h-8";
    switch (code) {
      case 'procurement':
        return <Package className={`${iconClass} text-purple-500`} />;
      case 'measurement':
        return <Ruler className={`${iconClass} text-blue-500`} />;
      case 'design':
        return <PenTool className={`${iconClass} text-orange-500`} />;
      case 'approval':
        return <ClipboardCheck className={`${iconClass} text-green-500`} />;
      case 'production':
        return <Factory className={`${iconClass} text-red-500`} />;
      case 'installation':
        return <Wrench className={`${iconClass} text-yellow-600`} />;
      case 'documentation':
        return <FileText className={`${iconClass} text-gray-500`} />;
      default:
        return <Layers className={`${iconClass} text-gray-400`} />;
    }
  };

  // Получаем зависимости этапов
  const { data: dependencies = [] } = useQuery<any[]>({
    queryKey: ['/api/projects', projectId, 'dependencies'],
    enabled: !!projectId,
  });

  // Получаем информацию о роли пользователя для проверки прав доступа
  const { data: userRole } = useQuery<any>({
    queryKey: ['/api/roles', currentUser?.role_id],
    enabled: !!currentUser?.role_id,
  });

  // Получаем права доступа пользователя
  const { data: permissions = [] } = useQuery<RolePermission[]>({
    queryKey: ['/api/role-permissions', currentUser?.role_id],
    enabled: !!currentUser?.role_id,
  });

  // Проверяем, имеет ли пользователь полный доступ ко всем этапам (админ)
  const canViewAll = Boolean(permissions.find(p => p.module === 'projects')?.view_all);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!selectedItemId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Layers className="w-16 h-16 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Выберите позицию мебели</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          Для отображения бизнес-процесса выберите позицию мебели из списка слева
        </p>
      </div>
    );
  }

  // Преобразуем этапы с учётом зависимостей
  const stagesWithDeps: StageWithDependencies[] = stages.map(stage => {
    const stageDeps = dependencies.filter(d => d.dependent_stage_id === stage.id);
    const dependentOnThis = dependencies.filter(d => d.depends_on_stage_id === stage.id);

    return {
      ...stage,
      dependencies: stageDeps.map(d => d.depends_on_stage_id),
      dependentStages: dependentOnThis.map(d => d.dependent_stage_id),
    };
  });

  // Расчёт задержек и влияния на финальный срок
  const calculateDelays = (stage: StageWithDependencies) => {
    if (!stage.planned_end_date || stage.status === 'completed') return 0;

    const plannedEnd = new Date(stage.planned_end_date);
    const today = new Date();

    if (stage.status === 'in_progress' && today > plannedEnd) {
      return Math.ceil((today.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
    }

    return 0;
  };

  // Определение критического пути (упрощённый алгоритм)
  const findCriticalPath = () => {
    // Этапы без зависимостей (начальные)
    const startStages = stagesWithDeps.filter(s => !s.dependencies || s.dependencies.length === 0);

    // Этапы без зависимых (конечные)
    const endStages = stagesWithDeps.filter(s => !s.dependentStages || s.dependentStages.length === 0);

    // Простая эвристика: критический путь = самая длинная цепочка
    const criticalStageIds = new Set<string>();

    // Добавляем все незавершённые этапы с задержками
    stagesWithDeps.forEach(stage => {
      const delay = calculateDelays(stage);
      if (delay > 0) {
        criticalStageIds.add(stage.id);
        // Добавляем все зависимые этапы
        stage.dependentStages?.forEach(depId => criticalStageIds.add(depId));
      }
    });

    return criticalStageIds;
  };

  const criticalPath = findCriticalPath();

  // Подсчёт общей задержки проекта
  const totalProjectDelay = stagesWithDeps.reduce((sum, stage) => {
    return sum + calculateDelays(stage);
  }, 0);

  // Статистика
  const stats = {
    total: stages.length,
    completed: stages.filter(s => s.status === 'completed').length,
    inProgress: stages.filter(s => s.status === 'in_progress').length,
    delayed: stagesWithDeps.filter(s => calculateDelays(s) > 0).length,
  };

  // Получаем имя этапа по ID
  const getStageName = (stageId: string) => {
    return stages.find(s => s.id === stageId)?.name || 'Неизвестный этап';
  };

  // Функция для получения типа этапа по ID
  const getStageType = (stageTypeId: string | null) => {
    if (!stageTypeId) return null;
    return stageTypes.find(st => st.id === stageTypeId);
  };

  return (
    <div className="space-y-6">
      {/* Заголовок с кнопкой добавления */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Этапы производства</h3>
        {onAddStage && (
          <Button onClick={onAddStage} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Добавить этап
          </Button>
        )}
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Всего этапов</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Завершено</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">В работе</p>
                <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-xs text-muted-foreground">Просрочено</p>
                <p className="text-2xl font-bold text-red-600">{stats.delayed}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Предупреждение о задержках */}
      {totalProjectDelay > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Внимание!</strong> Обнаружены задержки на {totalProjectDelay} дн., которые могут повлиять на финальный срок проекта.
          </AlertDescription>
        </Alert>
      )}

      {/* Список этапов с зависимостями */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Бизнес-процесс проекта</h3>
        <div className="space-y-3">
          {stagesWithDeps.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Нет этапов в проекте</p>
              </CardContent>
            </Card>
          ) : (
            stagesWithDeps.map((stage) => {
              const delay = calculateDelays(stage);
              const isOnCriticalPath = criticalPath.has(stage.id);

              // Проверяем, является ли этап "моим" (назначен на текущего пользователя)
              const isMyStage = stage.assignee_id === currentUser?.id;
              // Пользователь может видеть и редактировать этап, если он админ (canViewAll) или это его этап
              const canEdit = canViewAll || isMyStage;
              // Этап показывается серым, если это не мой этап и нет прав view_all
              const isReadOnly = !canEdit;

              return (
                <Card
                  key={stage.id}
                  onClick={() => {
                    setSelectedStage(stage);
                    setDialogOpen(true);
                  }}
                  className={`border-l-4 transition-all cursor-pointer hover:shadow-md ${
                    isReadOnly ? 'opacity-60' : ''
                  } ${
                    isOnCriticalPath
                      ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20'
                      : stage.status === 'completed'
                      ? 'border-green-500 bg-green-50/30 dark:bg-green-950/20'
                      : stage.status === 'in_progress'
                      ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-950/20'
                      : 'border-gray-400 bg-accent/30'
                  }`}
                >
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      {(() => {
                        const stageType = getStageType(stage.stage_type_id);
                        return (
                          <>
                            {/* Большая иконка типа этапа */}
                            <div className="flex-shrink-0">
                              {renderStageIcon(stageType?.code || null)}
                            </div>

                            {/* Основной контент */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                                  {stage.name}
                                  {isOnCriticalPath && (
                                    <Badge variant="destructive" className="text-xs">
                                      ⚠️ Критический путь
                                    </Badge>
                                  )}
                                </CardTitle>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "flex-shrink-0",
                                    stage.status === 'completed'
                                      ? 'border-green-500 text-green-700'
                                      : stage.status === 'in_progress'
                                      ? 'border-blue-500 text-blue-700'
                                      : ''
                                  )}
                                >
                                  {stage.status === 'pending' && '⚪ Ожидает'}
                                  {stage.status === 'in_progress' && '🔵 В работе'}
                                  {stage.status === 'completed' && '🟢 Завершён'}
                                </Badge>
                              </div>
                              {stage.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {stage.description}
                                </p>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Даты */}
                    <div className="flex gap-4 text-sm">
                      {stage.planned_start_date && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {new Date(stage.planned_start_date).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      )}
                      {stage.planned_end_date && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <ArrowRight className="w-4 h-4" />
                          <span>
                            {new Date(stage.planned_end_date).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Задержка */}
                    {delay > 0 && (
                      <Alert variant="destructive" className="py-2">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription className="text-sm">
                          Задержка: {delay} дн.
                          {stage.dependentStages && stage.dependentStages.length > 0 && (
                            <span className="ml-1">
                              (затронет {stage.dependentStages.length} зависимых этапов)
                            </span>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Зависимости */}
                    {stage.dependencies && stage.dependencies.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Link2 className="w-4 h-4" />
                          <span>Зависит от:</span>
                        </div>
                        <div className="flex flex-wrap gap-2 ml-6">
                          {stage.dependencies.map(depId => (
                            <Badge key={depId} variant="outline" className="text-xs">
                              {getStageName(depId)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Зависимые этапы */}
                    {stage.dependentStages && stage.dependentStages.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <TrendingUp className="w-4 h-4" />
                          <span>От этого зависят:</span>
                        </div>
                        <div className="flex flex-wrap gap-2 ml-6">
                          {stage.dependentStages.map(depId => (
                            <Badge key={depId} variant="outline" className="text-xs">
                              {getStageName(depId)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Модальное окно с деталями этапа */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getStageTypeCode(selectedStage?.stage_type_id || null) === 'procurement' && <Package className="w-5 h-5 text-purple-500" />}
              {getStageTypeCode(selectedStage?.stage_type_id || null) === 'measurement' && <Ruler className="w-5 h-5 text-blue-500" />}
              {getStageTypeCode(selectedStage?.stage_type_id || null) === 'technical_specification' && <FileText className="w-5 h-5 text-orange-500" />}
              {getStageTypeCode(selectedStage?.stage_type_id || null) === 'constructor_documentation' && <PenTool className="w-5 h-5 text-pink-500" />}
              {getStageTypeCode(selectedStage?.stage_type_id || null) === 'approval' && <ClipboardCheck className="w-5 h-5 text-green-500" />}
              {getStageTypeCode(selectedStage?.stage_type_id || null) === 'production' && <Factory className="w-5 h-5 text-amber-500" />}
              {getStageTypeCode(selectedStage?.stage_type_id || null) === 'installation' && <Wrench className="w-5 h-5 text-cyan-500" />}
              {getStageTypeCode(selectedStage?.stage_type_id || null) === 'procurement' ? 'Снабжение' :
               getStageTypeCode(selectedStage?.stage_type_id || null) === 'measurement' ? 'Замер' :
               getStageTypeCode(selectedStage?.stage_type_id || null) === 'technical_specification' ? 'Техническое задание' :
               getStageTypeCode(selectedStage?.stage_type_id || null) === 'constructor_documentation' ? 'Конструкторская документация' :
               getStageTypeCode(selectedStage?.stage_type_id || null) === 'approval' ? 'Согласование' :
               getStageTypeCode(selectedStage?.stage_type_id || null) === 'production' ? 'Производство' :
               getStageTypeCode(selectedStage?.stage_type_id || null) === 'installation' ? 'Монтаж' :
               selectedStage?.name || "Детали этапа"}
            </DialogTitle>
          </DialogHeader>
          {selectedStage && (
            <StageDetailView
              stageId={selectedStage.id}
              stageName={selectedStage.name}
              stageStatus={selectedStage.status}
              stageDescription={selectedStage.description || undefined}
              stageDeadline={selectedStage.planned_end_date ? new Date(selectedStage.planned_end_date).toISOString() : undefined}
              stageCost={selectedStage.cost !== undefined && selectedStage.cost !== null ? String(selectedStage.cost) : undefined}
              projectId={projectId}
              onStatusChange={() => {
                queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'stages'] });
                queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'dependencies'] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
