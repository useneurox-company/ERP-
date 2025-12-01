import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { GripVertical, Trash2, Plus } from "lucide-react";
import type { DealStage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ManageStagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StageEdit extends DealStage {
  isNew?: boolean;
}

interface SortableStageItemProps {
  stage: StageEdit;
  onUpdate: (id: string, updates: Partial<StageEdit>) => void;
  onDelete: (id: string) => void;
}

function SortableStageItem({ stage, onUpdate, onDelete }: SortableStageItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 rounded-md bg-card border"
      data-testid={`stage-item-${stage.key}`}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
        <GripVertical className="h-5 w-5 text-muted-foreground" data-testid={`drag-handle-${stage.key}`} />
      </div>
      
      <div className="flex-1 flex items-center gap-3">
        <Input
          value={stage.name}
          onChange={(e) => onUpdate(stage.id, { name: e.target.value })}
          className="flex-1"
          placeholder="Название этапа"
          data-testid={`input-stage-name-${stage.key}`}
        />
        
        <div className="flex items-center gap-2">
          <Label htmlFor={`color-${stage.id}`} className="text-sm text-muted-foreground">
            Цвет:
          </Label>
          <input
            id={`color-${stage.id}`}
            type="color"
            value={stage.color || "#6366f1"}
            onChange={(e) => onUpdate(stage.id, { color: e.target.value })}
            className="w-12 h-9 rounded border cursor-pointer"
            data-testid={`input-stage-color-${stage.key}`}
          />
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={() => onDelete(stage.id)}
        data-testid={`button-delete-stage-${stage.key}`}
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function ManageStagesDialog({ open, onOpenChange }: ManageStagesDialogProps) {
  const [stages, setStages] = useState<StageEdit[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [stageToDelete, setStageToDelete] = useState<StageEdit | null>(null);
  const [dealsCount, setDealsCount] = useState(0);
  const [targetStageKey, setTargetStageKey] = useState<string>("");
  const { toast } = useToast();

  const { data: apiStages = [], isLoading } = useQuery<DealStage[]>({
    queryKey: ["/api/deal-stages"],
    enabled: open,
  });

  useEffect(() => {
    if (apiStages.length > 0) {
      setStages([...apiStages]);
    }
  }, [apiStages]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setStages((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((item, index) => ({ ...item, order: index + 1 }));
      });
    }
  };

  const handleUpdateStage = (id: string, updates: Partial<StageEdit>) => {
    setStages((prev) =>
      prev.map((stage) => (stage.id === id ? { ...stage, ...updates } : stage))
    );
  };

  const handleAddStage = () => {
    const newStage: StageEdit = {
      id: `temp-${Date.now()}`,
      key: `stage-${Date.now()}`,
      name: "Новый этап",
      color: "#6366f1",
      order: stages.length + 1,
      created_at: new Date(),
      isNew: true,
    };
    setStages((prev) => [...prev, newStage]);
  };

  const checkDealsCount = async (stageKey: string) => {
    try {
      const response = await fetch(`/api/deal-stages/${stageKey}/count`);
      const data = await response.json();
      return data.count || 0;
    } catch (error) {
      console.error("Error checking deals count:", error);
      return 0;
    }
  };

  const handleDeleteClick = async (id: string) => {
    const stage = stages.find((s) => s.id === id);
    if (!stage) return;

    if (stage.isNew) {
      setStages((prev) => prev.filter((s) => s.id !== id));
      return;
    }

    const count = await checkDealsCount(stage.key);
    setDealsCount(count);
    setStageToDelete(stage);

    if (count > 0) {
      setDeleteDialogOpen(true);
    } else {
      await deleteStage(id, undefined);
    }
  };

  const deleteStage = async (id: string, targetKey?: string) => {
    try {
      const url = targetKey 
        ? `/api/deal-stages/${id}?targetStageKey=${targetKey}`
        : `/api/deal-stages/${id}`;
      
      await apiRequest("DELETE", url);
      
      setStages((prev) => prev.filter((s) => s.id !== id));
      
      toast({
        title: "Этап удален",
        description: targetKey ? "Сделки перемещены в другой этап" : "Этап успешно удален",
      });
      
      setDeleteDialogOpen(false);
      setStageToDelete(null);
      setTargetStageKey("");
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить этап",
        variant: "destructive",
      });
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [];
      // Get pipeline_id from first existing stage
      const pipelineId = stages.find(s => !s.isNew)?.pipeline_id || null;

      for (const stage of stages) {
        if (stage.isNew) {
          updates.push(
            apiRequest("POST", "/api/deal-stages", {
              pipeline_id: pipelineId,
              key: stage.key,
              name: stage.name,
              color: stage.color,
              order: stage.order,
            })
          );
        } else {
          updates.push(
            apiRequest("PUT", `/api/deal-stages/${stage.id}`, {
              name: stage.name,
              color: stage.color,
              order: stage.order,
            })
          );
        }
      }

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deal-stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      
      toast({
        title: "Сохранено",
        description: "Этапы успешно обновлены",
      });
      
      onOpenChange(false);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить изменения",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    saveMutation.mutate();
  };

  const availableStagesForMove = stages.filter(
    (s) => s.id !== stageToDelete?.id && !s.isNew
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-manage-stages">
          <DialogHeader>
            <DialogTitle>Управление этапами</DialogTitle>
            <DialogDescription>
              Измените порядок, название или цвет этапов. Перетащите этапы для изменения порядка.
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="space-y-2">
              <div className="h-16 bg-muted animate-pulse rounded" />
              <div className="h-16 bg-muted animate-pulse rounded" />
              <div className="h-16 bg-muted animate-pulse rounded" />
            </div>
          ) : (
            <div className="space-y-3">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={stages.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {stages.map((stage) => (
                    <SortableStageItem
                      key={stage.id}
                      stage={stage}
                      onUpdate={handleUpdateStage}
                      onDelete={handleDeleteClick}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <Button
                variant="outline"
                onClick={handleAddStage}
                className="w-full"
                data-testid="button-add-stage"
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить этап
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-stages"
            >
              {saveMutation.isPending ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-stage-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить этап?</AlertDialogTitle>
            <AlertDialogDescription>
              В этом этапе находится {dealsCount} {dealsCount === 1 ? "сделка" : "сделок"}.
              Выберите этап, в который нужно переместить эти сделки.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-4">
            <Label htmlFor="target-stage">Переместить сделки в:</Label>
            <Select value={targetStageKey} onValueChange={setTargetStageKey}>
              <SelectTrigger id="target-stage" data-testid="select-target-stage">
                <SelectValue placeholder="Выберите этап" />
              </SelectTrigger>
              <SelectContent>
                {availableStagesForMove.map((stage) => (
                  <SelectItem
                    key={stage.id}
                    value={stage.key}
                    data-testid={`select-item-${stage.key}`}
                  >
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (stageToDelete && targetStageKey) {
                  deleteStage(stageToDelete.id, targetStageKey);
                }
              }}
              disabled={!targetStageKey}
              data-testid="button-confirm-delete"
            >
              Переместить и удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
