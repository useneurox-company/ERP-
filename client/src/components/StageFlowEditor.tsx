import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Link2, X, Eye } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ProjectStage, StageDependency } from "@shared/schema";
import { StageDialog } from "./StageDialog";
import { StatusBadge } from "./StatusBadge";
import { StageDetailView } from "./StageDetailView";

interface StagePosition {
  id: string;
  x: number;
  y: number;
}

interface StageFlowEditorProps {
  projectId: string;
  itemId: string;
  itemName: string;
}

export function StageFlowEditor({ projectId, itemId, itemName }: StageFlowEditorProps) {
  const { toast } = useToast();
  const [positions, setPositions] = useState<StagePosition[]>([]);
  const [draggingStage, setDraggingStage] = useState<string | null>(null);
  const [linkingMode, setLinkingMode] = useState<string | null>(null);
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<ProjectStage | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: stages = [], isLoading } = useQuery<ProjectStage[]>({
    queryKey: ['/api/projects', projectId, 'items', itemId, 'stages'],
  });

  const { data: dependencies = [] } = useQuery<StageDependency[]>({
    queryKey: ['/api/projects', projectId, 'dependencies'],
  });

  // Initialize positions for stages
  useEffect(() => {
    if (stages.length > 0 && positions.length === 0) {
      const initialPositions = stages.map((stage, index) => ({
        id: stage.id,
        x: 100 + (index % 3) * 250,
        y: 100 + Math.floor(index / 3) * 150,
      }));
      setPositions(initialPositions);
    }
  }, [stages, positions.length]);

  const addDependency = useMutation({
    mutationFn: async ({ fromStageId, toStageId }: { fromStageId: string; toStageId: string }) => {
      return await apiRequest('POST', `/api/stages/${toStageId}/dependencies`, {
        depends_on_stage_id: fromStageId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'dependencies'] });
      toast({
        title: "Зависимость добавлена",
        description: "Этапы успешно связаны",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить зависимость",
        variant: "destructive",
      });
    },
  });

  const removeDependency = useMutation({
    mutationFn: async (dependencyId: string) => {
      return await apiRequest('DELETE', `/api/stages/dependencies/${dependencyId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'dependencies'] });
      toast({
        title: "Зависимость удалена",
        description: "Связь между этапами удалена",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить зависимость",
        variant: "destructive",
      });
    },
  });

  const handleMouseDown = (stageId: string, e: React.MouseEvent) => {
    e.preventDefault();
    setDraggingStage(stageId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingStage || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setPositions(prev => 
      prev.map(pos => 
        pos.id === draggingStage ? { ...pos, x, y } : pos
      )
    );
  };

  const handleMouseUp = () => {
    setDraggingStage(null);
  };

  const handleStageClick = (stageId: string) => {
    if (linkingMode) {
      if (linkingMode !== stageId) {
        addDependency.mutate({
          fromStageId: linkingMode,
          toStageId: stageId,
        });
      }
      setLinkingMode(null);
    }
  };

  const getStagePosition = (stageId: string) => {
    return positions.find(p => p.id === stageId) || { x: 0, y: 0 };
  };

  // Filter dependencies for this item's stages
  const itemStageDependencies = dependencies.filter(dep => {
    const fromStage = stages.find(s => s.id === dep.depends_on_stage_id);
    const toStage = stages.find(s => s.id === dep.stage_id);
    return fromStage && toStage;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" data-testid="text-flow-title">
            Этапы для: {itemName}
          </h3>
          <p className="text-sm text-muted-foreground">
            Перетаскивайте этапы и связывайте их зависимостями
          </p>
        </div>
        <div className="flex items-center gap-2">
          {linkingMode && (
            <Badge variant="secondary" className="gap-2">
              <Link2 className="w-3 h-3" />
              Выберите целевой этап
              <Button
                size="icon"
                variant="ghost"
                className="h-4 w-4 p-0"
                onClick={() => setLinkingMode(null)}
                data-testid="button-cancel-linking"
              >
                <X className="w-3 h-3" />
              </Button>
            </Badge>
          )}
          <Button
            onClick={() => setStageDialogOpen(true)}
            data-testid="button-add-stage"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить этап
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div
          ref={containerRef}
          className="relative w-full h-[600px] bg-muted/20 rounded-lg overflow-hidden cursor-move"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          data-testid="stage-flow-canvas"
        >
          {/* SVG for arrows */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
            {itemStageDependencies.map((dep) => {
              const fromPos = getStagePosition(dep.depends_on_stage_id);
              const toPos = getStagePosition(dep.stage_id);
              
              // Arrow from center-right of 'from' to center-left of 'to'
              const x1 = fromPos.x + 150;
              const y1 = fromPos.y + 40;
              const x2 = toPos.x;
              const y2 = toPos.y + 40;

              return (
                <g key={dep.id}>
                  <defs>
                    <marker
                      id={`arrowhead-${dep.id}`}
                      markerWidth="10"
                      markerHeight="10"
                      refX="9"
                      refY="3"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3, 0 6"
                        className="fill-primary"
                      />
                    </marker>
                  </defs>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className="stroke-primary"
                    strokeWidth="2"
                    markerEnd={`url(#arrowhead-${dep.id})`}
                  />
                  {/* Delete button on arrow */}
                  <circle
                    cx={(x1 + x2) / 2}
                    cy={(y1 + y2) / 2}
                    r="12"
                    className="fill-background stroke-border cursor-pointer pointer-events-auto hover-elevate"
                    onClick={() => removeDependency.mutate(dep.id)}
                    data-testid={`button-remove-dependency-${dep.id}`}
                  />
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 + 1}
                    textAnchor="middle"
                    className="text-xs fill-destructive pointer-events-none"
                    style={{ fontSize: '12px' }}
                  >
                    ×
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Stages */}
          {stages.map((stage) => {
            const pos = getStagePosition(stage.id);
            const isLinking = linkingMode === stage.id;

            return (
              <Card
                key={stage.id}
                className={`absolute w-[150px] p-3 cursor-move select-none ${
                  isLinking ? 'ring-2 ring-primary' : ''
                }`}
                style={{
                  left: pos.x,
                  top: pos.y,
                  zIndex: draggingStage === stage.id ? 10 : 2,
                }}
                onMouseDown={(e) => handleMouseDown(stage.id, e)}
                onClick={() => handleStageClick(stage.id)}
                data-testid={`stage-node-${stage.id}`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium line-clamp-2 flex-1">
                      {stage.name}
                    </p>
                  </div>
                  <StatusBadge status={stage.status as "pending" | "in_progress" | "completed" | "overdue" | "cancelled"} />
                  <div className="flex items-center gap-1 pt-2 border-t">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStage(stage);
                      }}
                      data-testid={`button-view-details-${stage.id}`}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLinkingMode(stage.id);
                      }}
                      data-testid={`button-link-stage-${stage.id}`}
                    >
                      <Link2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}

          {stages.length === 0 && !isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground" data-testid="text-no-stages">
                  Нет этапов
                </p>
                <p className="text-sm text-muted-foreground">
                  Добавьте первый этап
                </p>
              </div>
            </div>
          )}
        </div>

        {linkingMode && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Кликните на этап, чтобы создать зависимость. Выбранный этап будет зависеть от текущего.
            </p>
          </div>
        )}
      </Card>

      <StageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        projectId={projectId}
        itemId={itemId}
      />

      <Dialog open={!!selectedStage} onOpenChange={(open) => !open && setSelectedStage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детали этапа</DialogTitle>
          </DialogHeader>
          {selectedStage && (
            <StageDetailView
              stageId={selectedStage.id}
              stageName={selectedStage.name}
              stageStatus={selectedStage.status}
              stageDescription={selectedStage.description || undefined}
              stageDeadline={selectedStage.planned_end_date ? selectedStage.planned_end_date.toString() : undefined}
              stageCost={selectedStage.cost !== undefined && selectedStage.cost !== null ? String(selectedStage.cost) : undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
