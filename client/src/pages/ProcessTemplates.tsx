import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Edit2, Trash2, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ProcessTemplate } from "@shared/schema";
import { LocalStageEditor, LocalStage, LocalStageDependency } from "@/components/LocalStageEditor";
import { Switch } from "@/components/ui/switch";

export default function ProcessTemplates() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProcessTemplate | null>(null);
  const [showStagesDialog, setShowStagesDialog] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Stages state
  const [stages, setStages] = useState<LocalStage[]>([]);
  const [dependencies, setDependencies] = useState<LocalStageDependency[]>([]);

  // Fetch users
  const { data: users = [] } = useQuery<Array<{ id: string; full_name?: string; username: string }>>({
    queryKey: ["/api/users"],
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<ProcessTemplate[]>({
    queryKey: ["/api/templates"],
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string; is_active: boolean }) => {
      return await apiRequest("POST", "/api/templates", {
        ...data,
        is_active: data.is_active ? 1 : 0
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ description: "Шаблон создан" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ description: "Ошибка при создании шаблона", variant: "destructive" });
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProcessTemplate> }) => {
      const convertedData = { ...data };
      if (typeof convertedData.is_active === 'boolean') {
        convertedData.is_active = convertedData.is_active ? 1 : 0;
      }
      return await apiRequest("PUT", `/api/templates/${id}`, convertedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ description: "Шаблон обновлён" });
      handleCloseDialog();
    },
    onError: () => {
      toast({ description: "Ошибка при обновлении шаблона", variant: "destructive" });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ description: "Шаблон удалён" });
    },
    onError: () => {
      toast({ description: "Ошибка при удалении шаблона", variant: "destructive" });
    },
  });

  const handleOpenCreateDialog = () => {
    setEditingTemplate(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setShowCreateDialog(true);
  };

  const handleOpenEditDialog = (template: ProcessTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setDescription(template.description || "");
    setIsActive(template.is_active);
    setShowCreateDialog(true);
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setEditingTemplate(null);
    setName("");
    setDescription("");
    setIsActive(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast({ description: "Введите название", variant: "destructive" });
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        data: { name, description: description || undefined, is_active: isActive },
      });
    } else {
      createMutation.mutate({ name, description: description || undefined, is_active: isActive });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Удалить шаблон?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenStagesDialog = (templateId: string) => {
    setSelectedTemplateId(templateId);
    // Load stages and dependencies for this template
    loadTemplateStages(templateId);
    setShowStagesDialog(true);
  };

  const loadTemplateStages = async (templateId: string) => {
    try {
      const response = await fetch(`/api/templates/${templateId}`);
      const data = await response.json();
      
      // Convert to LocalStage format
      const localStages: LocalStage[] = data.stages.map((s: any) => ({
        id: s.id,
        name: s.name,
        order_index: s.order,
        duration_days: s.duration_days,
        assignee_id: s.assignee_id,
        cost: s.cost ? parseFloat(s.cost) : undefined,
        description: s.description,
      }));

      const localDeps: LocalStageDependency[] = data.dependencies.map((d: any) => ({
        stage_id: d.template_stage_id,
        depends_on_stage_id: d.depends_on_template_stage_id,
      }));

      setStages(localStages);
      setDependencies(localDeps);
    } catch (error) {
      toast({ description: "Ошибка загрузки этапов", variant: "destructive" });
    }
  };

  const handleSaveStages = async () => {
    if (!selectedTemplateId) return;

    try {
      // First, fetch all existing stages
      const existingResponse = await fetch(`/api/templates/${selectedTemplateId}/stages`);
      const existingStages = await existingResponse.json();

      // Delete all existing stages (cascade will delete dependencies)
      for (const stage of existingStages) {
        await apiRequest("DELETE", `/api/templates/stages/${stage.id}`);
      }

      // Create new stages
      const createdStages: Record<string, string> = {};
      for (const stage of stages) {
        // Build stage data, ensuring correct types
        const stageData = {
          name: stage.name || "",  // Ensure it's not null
          order: Number(stage.order_index),  // Ensure it's a number
          duration_days: stage.duration_days ? Number(stage.duration_days) : undefined,
          assignee_id: stage.assignee_id || undefined,
          cost: stage.cost !== undefined && stage.cost !== null ? Number(stage.cost) : undefined,
          description: stage.description || undefined,
          stage_type_id: stage.stage_type_id || undefined,  // Передаем тип этапа
        };

        console.log(`[SaveStages] Sending stage ${stage.id}:`, {
          stageName: stage.name,
          stageOrderIndex: stage.order_index,
          stageData
        });

        const response = await fetch(
          `/api/templates/${selectedTemplateId}/stages`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": localStorage.getItem("currentUserId") || "",
            },
            body: JSON.stringify(stageData),
            credentials: "include",
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error(`[SaveStages] Error creating stage ${stage.id}:`, errorData);
          throw new Error(`Failed to create stage ${stage.name}: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log(`[SaveStages] Successfully created stage ${stage.id} -> ${data.id}`);
        createdStages[stage.id] = data.id;
      }

      // Create dependencies with new IDs
      for (const dep of dependencies) {
        const depData = {
          template_stage_id: createdStages[dep.stage_id],
          depends_on_template_stage_id: createdStages[dep.depends_on_stage_id],
        };
        console.log(`[SaveStages] Creating dependency:`, depData);

        const depResponse = await fetch(
          `/api/templates/${selectedTemplateId}/dependencies`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-User-Id": localStorage.getItem("currentUserId") || "",
            },
            body: JSON.stringify(depData),
            credentials: "include",
          }
        );

        if (!depResponse.ok) {
          const errorData = await depResponse.json();
          console.error(`[SaveStages] Error creating dependency:`, errorData);
          throw new Error(`Failed to create dependency: ${JSON.stringify(errorData)}`);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/templates", selectedTemplateId] });
      toast({ description: "Этапы сохранены" });
      setShowStagesDialog(false);
      setSelectedTemplateId(null);
      setStages([]);
      setDependencies([]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Неизвестная ошибка";
      console.error("[SaveStages] Fatal error:", errorMessage);
      toast({ description: `Ошибка при сохранении этапов: ${errorMessage}`, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Шаблоны процессов</h1>
          <p className="text-muted-foreground mt-1">
            Создавайте шаблоны с этапами и зависимостями для быстрого применения к позициям
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} data-testid="button-create-template">
          <Plus className="w-4 h-4 mr-2" />
          Создать шаблон
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">Нет шаблонов</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} data-testid={`template-card-${template.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg" data-testid={`template-name-${template.id}`}>
                      {template.name}
                    </CardTitle>
                    {template.description && (
                      <CardDescription className="mt-1" data-testid={`template-desc-${template.id}`}>
                        {template.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenStagesDialog(template.id)}
                      data-testid={`button-stages-${template.id}`}
                    >
                      <Settings2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleOpenEditDialog(template)}
                      data-testid={`button-edit-${template.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(template.id)}
                      data-testid={`button-delete-${template.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span className={template.is_active ? "text-green-600" : "text-muted-foreground"}>
                    {template.is_active ? "Активен" : "Неактивен"}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent data-testid="dialog-template-form">
          <DialogHeader>
            <DialogTitle data-testid="dialog-template-title">
              {editingTemplate ? "Редактировать шаблон" : "Создать шаблон"}
            </DialogTitle>
            <DialogDescription>
              Задайте название и описание для шаблона процесса
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например: Бизнес процесс стол"
                data-testid="input-template-name"
              />
            </div>
            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Опциональное описание"
                data-testid="input-template-description"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Активен</Label>
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={setIsActive}
                data-testid="switch-template-active"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              data-testid="button-cancel"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {editingTemplate ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stages Editor Dialog */}
      <Dialog open={showStagesDialog} onOpenChange={setShowStagesDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh]" data-testid="dialog-stages-editor">
          <DialogHeader>
            <DialogTitle data-testid="dialog-stages-title">Настройка этапов</DialogTitle>
            <DialogDescription>
              Добавьте этапы и настройте зависимости между ними
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[60vh]">
            <LocalStageEditor
              positionName="Шаблон"
              stages={stages}
              dependencies={dependencies}
              onStagesChange={setStages}
              onDependenciesChange={setDependencies}
              mode="template"
              users={users}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowStagesDialog(false);
                setSelectedTemplateId(null);
                setStages([]);
                setDependencies([]);
              }}
              data-testid="button-cancel-stages"
            >
              Отмена
            </Button>
            <Button onClick={handleSaveStages} data-testid="button-save-stages">
              Сохранить этапы
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
