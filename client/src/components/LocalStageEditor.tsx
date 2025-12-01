import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Link2, X, FileText, Download, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StageTypeSelector } from "./StageTypeSelector";
import { TemplateStageTypeForm } from "./TemplateStageTypeForm";
import { useQuery } from "@tanstack/react-query";
import type { StageType } from "@shared/schema";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  assignChainColors,
  getAvailableDependencies,
  getDirectDependencies,
  getChainColorClass,
  getAllDependentsRecursive,
  wouldCreateCycle,
  ChainInfo,
} from "@/utils/dependencyUtils";

export interface LocalStage {
  id: string;
  name: string;
  stage_type_id?: string; // тип этапа из библиотеки
  template_data?: any; // данные специфичные для типа этапа (JSON)
  order_index: number;
  duration_days?: number;
  assignee_id?: string;
  cost?: number;
  description?: string;
  attachments?: Array<{ id?: string; file_name: string; file_path: string; file_size?: number; mime_type?: string }>;
}

export interface LocalStageDependency {
  stage_id: string;
  depends_on_stage_id: string;
}

interface LocalStageEditorProps {
  positionName: string;
  stages: LocalStage[];
  dependencies?: LocalStageDependency[];
  onStagesChange: (stages: LocalStage[]) => void;
  onDependenciesChange?: (dependencies: LocalStageDependency[]) => void;
  mode?: 'template' | 'project';
  users?: Array<{ id: string; full_name?: string; username: string }>;
}

// Sortable Stage Card Component
function SortableStageCard({
  stage,
  index,
  stages,
  dependencies,
  users,
  stageTypes,
  chainInfo,
  onDeleteStage,
  onUpdateStage,
  onAddDependency,
  onRemoveDependency,
  onDependenciesChange,
  onFileUpload,
  onDeleteAttachment,
}: any) {
  const [expanded, setExpanded] = useState(false);
  const [selectValue, setSelectValue] = useState(stage.id + "-trigger");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const stageDeps = dependencies.filter((d: LocalStageDependency) => d.stage_id === stage.id).map(d => d.depends_on_stage_id);
  const assigneeName = users?.find((u: any) => u.id === stage.assignee_id)?.full_name ||
                      users?.find((u: any) => u.id === stage.assignee_id)?.username ||
                      'Не назначен';
  const hasAttachments = stage.attachments && stage.attachments.length > 0;

  const colorClass = chainInfo ? getChainColorClass(chainInfo) : 'border-border bg-card';

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`stage-item-${index}`}
      className={`border rounded-lg transition-all ${colorClass} ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* Компактный вид (свёрнуто) */}
      <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-muted/50 transition-colors relative"
        onClick={() => setExpanded(!expanded)}>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded"
          title="Перетащите для изменения порядка"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{stage.name}</p>
          <p className="text-xs text-muted-foreground">
            ⏱️ {stage.duration_days || 0} дн. | 💰 {stage.cost || 0}₽ | 👤 {assigneeName}
          </p>
        </div>

        {stageDeps.length > 0 && (() => {
          const colorMap: any = {
            'border-blue-500': '#3b82f6',
            'border-green-500': '#22c55e',
            'border-purple-500': '#a855f7',
            'border-orange-500': '#f97316',
            'border-pink-500': '#ec4899',
            'border-cyan-500': '#06b6d4',
            'border-amber-500': '#f59e0b',
            'border-red-500': '#ef4444',
          };
          const strokeColor = chainInfo ? colorMap[chainInfo.color] || '#3b82f6' : '#666';
          const depNames = stageDeps
            .map(depId => stages.find(s => s.id === depId)?.name)
            .filter(Boolean)
            .join('\n');

          return (
            <div key={`deps-${stage.id}`} title={`Зависит от:\n${depNames}`} className="shrink-0">
              <Badge variant="outline" className="text-xs" style={{ borderColor: strokeColor, color: strokeColor }}>
                <svg width="12" height="12" viewBox="0 0 16 16" className="mr-1 flex-shrink-0">
                  <path
                    d="M 12 0 Q 16 2 16 8 Q 16 14 12 16"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    fill="none"
                    strokeLinecap="round"
                  />
                </svg>
                {stageDeps.length}
              </Badge>
            </div>
          );
        })()}

        {hasAttachments && (
          <Badge variant="secondary" className="shrink-0 text-xs">
            <FileText className="w-3 h-3 mr-1" />
            {stage.attachments!.length}
          </Badge>
        )}

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteStage(stage.id);
          }}
          data-testid={`button-delete-stage-${index}`}
        >
          <Trash2 className="w-4 h-4" />
        </Button>

        <div className="w-5 flex justify-center shrink-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>

      </div>

      {/* Развёрнутый вид */}
      {expanded && (
        <div className="p-4 border-t space-y-4 bg-muted/30">
          {/* Название */}
          <div>
            <Label className="text-xs">Название</Label>
            <Input
              value={stage.name}
              onChange={(e) => onUpdateStage(stage.id, 'name', e.target.value)}
              placeholder="Название этапа"
              data-testid={`input-stage-name-${index}`}
              className="mt-1"
            />
          </div>

          {/* Специализированная форма для типа этапа */}
          {stage.stage_type_id && (() => {
            const stageType = stageTypes?.find((st: StageType) => st.id === stage.stage_type_id);
            if (!stageType) return null;

            return (
              <TemplateStageTypeForm
                stageTypeCode={stageType.code}
                stageTypeName={stageType.name}
                data={stage.template_data}
                onChange={(data) => onUpdateStage(stage.id, 'template_data', data)}
              />
            );
          })()}

          {/* Срок и стоимость */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Срок (дни)</Label>
              <Input
                type="number"
                value={stage.duration_days || ''}
                onChange={(e) => onUpdateStage(stage.id, 'duration_days', parseInt(e.target.value) || 0)}
                placeholder="7"
                className="mt-1"
                data-testid={`input-duration-${index}`}
              />
            </div>
            <div>
              <Label className="text-xs">Стоимость (₽)</Label>
              <Input
                type="number"
                value={stage.cost || ''}
                onChange={(e) => onUpdateStage(stage.id, 'cost', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="mt-1"
                data-testid={`input-cost-${index}`}
              />
            </div>
          </div>

          {/* Исполнитель */}
          <div>
            <Label className="text-xs">Исполнитель</Label>
            <Select
              value={stage.assignee_id || 'unassigned'}
              onValueChange={(value) => onUpdateStage(stage.id, 'assignee_id', value === 'unassigned' ? '' : value)}
            >
              <SelectTrigger className="mt-1" data-testid={`select-assignee-${index}`}>
                <SelectValue placeholder="Выбрать исполнителя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Не назначен</SelectItem>
                {users?.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Описание */}
          <div>
            <Label className="text-xs">Описание</Label>
            <Textarea
              value={stage.description || ''}
              onChange={(e) => onUpdateStage(stage.id, 'description', e.target.value)}
              placeholder="Детали выполнения этапа..."
              className="mt-1 h-16 text-xs"
              data-testid={`textarea-description-${index}`}
            />
          </div>

          {/* Примеры выполнения (файлы) */}
          <div>
            <Label className="text-xs">📎 Примеры выполнения</Label>
            <div className="mt-2 space-y-2 p-2 border rounded bg-background/50">
              {stage.attachments && stage.attachments.length > 0 ? (
                <div className="space-y-2">
                  {stage.attachments.map((att, idx) => (
                    <div key={att.id || idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-xs">
                      <FileText className="w-4 h-4 flex-shrink-0" />
                      <div className="flex-1 min-w-0 truncate">
                        <p className="font-medium truncate">{att.file_name}</p>
                        {att.file_size && <p className="text-muted-foreground">{(att.file_size / 1024).toFixed(1)} KB</p>}
                      </div>
                      {att.file_path && att.file_path.startsWith('http') && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 flex-shrink-0"
                          asChild
                        >
                          <a href={att.file_path} download={att.file_name}>
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 flex-shrink-0 hover:bg-destructive/20 hover:text-destructive"
                        onClick={() => onDeleteAttachment(stage.id, att.id || `local-${idx}`)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-xs p-2">Файлы не загружены</p>
              )}
              <div className="relative">
                <input
                  type="file"
                  id={`file-upload-${stage.id}`}
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => onFileUpload(e, stage.id)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs mt-2"
                  onClick={() => document.getElementById(`file-upload-${stage.id}`)?.click()}
                >
                  + Загрузить файл
                </Button>
              </div>
            </div>
          </div>

          {/* Зависимости */}
          {onDependenciesChange && (
            <div className="border-t pt-3">
              <Label className="text-xs flex items-center gap-1">
                <Link2 className="w-3 h-3" />
                Зависит от других этапов
              </Label>
              <div className="mt-2">
                <Select
                  value={selectValue}
                  onValueChange={(value) => {
                    if (value !== stage.id + "-trigger") {
                      onAddDependency(stage.id, value);
                      setSelectValue(stage.id + "-trigger");
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs" data-testid={`select-add-dependency-${index}`}>
                    <SelectValue placeholder="Добавить зависимость" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableDependencies(
                      stage.id,
                      stages.map(s => s.id),
                      dependencies,
                      getDirectDependencies(stage.id, dependencies)
                    )
                      .map(depId => stages.find(s => s.id === depId))
                      .filter((s): s is LocalStage => !!s)
                      .map((s: LocalStage) => (
                        <SelectItem key={s.id} value={s.id} data-testid={`option-dependency-${s.id}`}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {stageDeps.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {stageDeps.map((dep: LocalStageDependency) => {
                    const depStage = stages.find((s: LocalStage) => s.id === dep.depends_on_stage_id);
                    return (
                      <Badge
                        key={dep.depends_on_stage_id}
                        variant="secondary"
                        className="text-xs gap-1"
                        data-testid={`badge-dependency-${dep.depends_on_stage_id}`}
                      >
                        {depStage?.name}
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-3 w-3 p-0 hover:bg-transparent"
                          onClick={() => onRemoveDependency(stage.id, dep.depends_on_stage_id)}
                          data-testid={`button-remove-dependency-${dep.depends_on_stage_id}`}
                        >
                          <X className="w-2 h-2" />
                        </Button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function LocalStageEditor({
  positionName,
  stages,
  dependencies = [],
  onStagesChange,
  onDependenciesChange,
  mode = 'template',
  users = []
}: LocalStageEditorProps) {
  const [newStageName, setNewStageName] = useState("");
  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  // Логирование при получении новых props
  useEffect(() => {
    console.log("[LocalStageEditor] Получены props для позиции:", positionName);
    console.log("[LocalStageEditor] Количество этапов:", stages.length);
    console.log("[LocalStageEditor] Этапы:", stages);
    console.log("[LocalStageEditor] Зависимости:", dependencies);
  }, [stages, dependencies, positionName]);

  // Загружаем типы этапов
  const { data: stageTypes = [] } = useQuery<StageType[]>({
    queryKey: ['/api/stage-types'],
  });

  // Рассчитываем цепи и цвета для зависимостей
  const chainColors = useMemo(() => {
    return assignChainColors(
      stages.map(s => s.id),
      dependencies
    );
  }, [stages, dependencies]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      distance: 8,
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddStage = () => {
    if (!newStageName.trim()) return;
    // Открываем диалог выбора типа
    setShowTypeDialog(true);
  };

  const handleConfirmAddStage = () => {
    if (!newStageName.trim()) return;

    const newStage: LocalStage = {
      id: `temp-${Date.now()}`,
      name: newStageName,
      stage_type_id: selectedTypeId || undefined,
      order_index: stages.length,
      attachments: [],
    };

    onStagesChange([...stages, newStage]);
    setNewStageName("");
    setSelectedTypeId(null);
    setShowTypeDialog(false);
  };

  const handleDeleteStage = (id: string) => {
    const updatedStages = stages
      .filter(s => s.id !== id)
      .map((s, index) => ({ ...s, order_index: index }));
    onStagesChange(updatedStages);

    if (onDependenciesChange) {
      const updatedDeps = dependencies.filter(
        d => d.stage_id !== id && d.depends_on_stage_id !== id
      );
      onDependenciesChange(updatedDeps);
    }
  };

  const handleUpdateStage = (id: string, field: keyof LocalStage, value: string | number) => {
    const updatedStages = stages.map(s =>
      s.id === id ? { ...s, [field]: value } : s
    );
    onStagesChange(updatedStages);
  };

  const handleAddDependency = (stageId: string, dependsOnStageId: string) => {
    if (!onDependenciesChange) return;

    // Проверяем есть ли уже такая зависимость
    const exists = dependencies.some(
      d => d.stage_id === stageId && d.depends_on_stage_id === dependsOnStageId
    );

    // Проверяем не создаст ли цикл
    if (wouldCreateCycle(stageId, dependsOnStageId, dependencies)) {
      console.warn('Циклическая зависимость недопустима!');
      return;
    }

    if (!exists && stageId !== dependsOnStageId) {
      onDependenciesChange([...dependencies, { stage_id: stageId, depends_on_stage_id: dependsOnStageId }]);
    }
  };

  const handleRemoveDependency = (stageId: string, dependsOnStageId: string) => {
    if (!onDependenciesChange) return;

    const updatedDeps = dependencies.filter(
      d => !(d.stage_id === stageId && d.depends_on_stage_id === dependsOnStageId)
    );
    onDependenciesChange(updatedDeps);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, stageId: string) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // For now, create a local reference. In production, you would upload to server
    const reader = new FileReader();
    reader.onload = (e) => {
      const updatedStages = stages.map(s => {
        if (s.id === stageId) {
          return {
            ...s,
            attachments: [
              ...(s.attachments || []),
              {
                id: `local-${Date.now()}`,
                file_name: file.name,
                file_path: e.target?.result as string,
                file_size: file.size,
                mime_type: file.type,
              }
            ]
          };
        }
        return s;
      });
      onStagesChange(updatedStages);
    };
    reader.readAsDataURL(file);

    // Reset input
    event.target.value = '';
  };

  const handleDeleteAttachment = (stageId: string, attachmentId: string) => {
    const updatedStages = stages.map(s => {
      if (s.id === stageId) {
        return {
          ...s,
          attachments: (s.attachments || []).filter(a => a.id !== attachmentId)
        };
      }
      return s;
    });
    onStagesChange(updatedStages);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = stages.findIndex((s) => s.id === active.id);
      const newIndex = stages.findIndex((s) => s.id === over.id);

      const newStages = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({
        ...s,
        order_index: i,
      }));

      onStagesChange(newStages);
    }
  };

  return (
    <div className="flex flex-col gap-3 min-h-0">
      <div className="shrink-0">
        <h4 className="text-sm font-medium mb-1">Этапы для: {positionName}</h4>
        <p className="text-xs text-muted-foreground">
          Перетащите этапы для изменения порядка. Нажмите на карточку для редактирования.
        </p>
      </div>

      <ScrollArea className="h-[400px] pr-3">
        <div className="space-y-2">
          {stages.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Этапы не добавлены</p>
              </CardContent>
            </Card>
          ) : (
            <div className="relative" style={{ position: 'relative' }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={stages.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {stages.map((stage, index) => (
                    <SortableStageCard
                      key={stage.id}
                      stage={stage}
                      index={index}
                      stages={stages}
                      dependencies={dependencies}
                      users={users}
                      stageTypes={stageTypes}
                      chainInfo={chainColors.get(stage.id)}
                      onDeleteStage={handleDeleteStage}
                      onUpdateStage={handleUpdateStage}
                      onAddDependency={handleAddDependency}
                      onRemoveDependency={handleRemoveDependency}
                      onDependenciesChange={onDependenciesChange}
                      onFileUpload={handleFileUpload}
                      onDeleteAttachment={handleDeleteAttachment}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="space-y-2 p-3 border rounded-lg bg-muted/50 shrink-0">
        <Label className="text-sm font-medium">Добавить новый этап</Label>
        <div className="flex gap-2">
          <Input
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="Название этапа"
            onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
            data-testid="input-new-stage-name"
          />
          <Button
            type="button"
            size="icon"
            onClick={handleAddStage}
            disabled={!newStageName.trim()}
            data-testid="button-add-stage"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Диалог выбора типа этапа */}
      <Dialog open={showTypeDialog} onOpenChange={setShowTypeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Выбор типа этапа</DialogTitle>
            <DialogDescription>
              Выберите тип для этапа "{newStageName}"
            </DialogDescription>
          </DialogHeader>

          <StageTypeSelector
            selectedTypeId={selectedTypeId}
            onSelectType={setSelectedTypeId}
          />

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowTypeDialog(false);
                setSelectedTypeId(null);
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleConfirmAddStage}
              disabled={!selectedTypeId}
            >
              Добавить этап
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
