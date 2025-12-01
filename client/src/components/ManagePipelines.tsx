import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Star, List, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import type { SalesPipeline, DealStage, CustomFieldDefinition } from "@shared/schema";

export function ManagePipelines() {
  const { toast } = useToast();
  const [pipelineDialogOpen, setPipelineDialogOpen] = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<SalesPipeline | null>(null);
  const [pipelineName, setPipelineName] = useState("");
  const [pipelineDescription, setPipelineDescription] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pipelineToDelete, setPipelineToDelete] = useState<SalesPipeline | null>(null);

  const { data: pipelines = [] } = useQuery<SalesPipeline[]>({
    queryKey: ["/api/sales-pipelines"],
  });

  const createPipeline = useMutation({
    mutationFn: async (data: { name: string; description: string; order: number }) => {
      return await apiRequest("POST", "/api/sales-pipelines", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-pipelines"] });
      toast({
        title: "Воронка создана",
        description: "Воронка продаж успешно создана",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать воронку",
        variant: "destructive",
      });
    },
  });

  const updatePipeline = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
      return await apiRequest("PUT", `/api/sales-pipelines/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-pipelines"] });
      toast({
        title: "Воронка обновлена",
        description: "Воронка продаж успешно обновлена",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить воронку",
        variant: "destructive",
      });
    },
  });

  const deletePipeline = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/sales-pipelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-pipelines"] });
      toast({
        title: "Воронка удалена",
        description: "Воронка продаж успешно удалена",
      });
      setDeleteDialogOpen(false);
      setPipelineToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error?.message || "Не удалось удалить воронку",
        variant: "destructive",
      });
    },
  });

  const setAsDefault = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/sales-pipelines/${id}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-pipelines"] });
      toast({
        title: "Воронка по умолчанию",
        description: "Воронка установлена как основная",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось установить воронку по умолчанию",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingPipeline(null);
    setPipelineName("");
    setPipelineDescription("");
    setPipelineDialogOpen(true);
  };

  const handleOpenEdit = (pipeline: SalesPipeline) => {
    setEditingPipeline(pipeline);
    setPipelineName(pipeline.name);
    setPipelineDescription(pipeline.description || "");
    setPipelineDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setPipelineDialogOpen(false);
    setEditingPipeline(null);
    setPipelineName("");
    setPipelineDescription("");
  };

  const handleSave = () => {
    if (!pipelineName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название воронки",
        variant: "destructive",
      });
      return;
    }

    if (editingPipeline) {
      updatePipeline.mutate({
        id: editingPipeline.id,
        data: { name: pipelineName, description: pipelineDescription },
      });
    } else {
      const maxOrder = Math.max(...pipelines.map((p) => p.order), -1);
      createPipeline.mutate({
        name: pipelineName,
        description: pipelineDescription,
        order: maxOrder + 1,
      });
    }
  };

  const handleDelete = (pipeline: SalesPipeline) => {
    if (pipeline.is_default) {
      toast({
        title: "Ошибка",
        description: "Нельзя удалить основную воронку",
        variant: "destructive",
      });
      return;
    }
    setPipelineToDelete(pipeline);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (pipelineToDelete) {
      deletePipeline.mutate(pipelineToDelete.id);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Воронки продаж</h2>
          <p className="text-muted-foreground text-sm">
            Настройте воронки продаж, их этапы и кастомные поля
          </p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Создать воронку
        </Button>
      </div>

      <div className="grid gap-4">
        {pipelines.map((pipeline) => (
          <Card key={pipeline.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{pipeline.name}</CardTitle>
                  {pipeline.is_default && (
                    <Badge variant="default">
                      <Star className="h-3 w-3 mr-1" />
                      По умолчанию
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!pipeline.is_default && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAsDefault.mutate(pipeline.id)}
                      disabled={setAsDefault.isPending}
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Сделать основной
                    </Button>
                  )}
                  <Button variant="outline" size="sm" onClick={() => handleOpenEdit(pipeline)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Редактировать
                  </Button>
                  {!pipeline.is_default && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(pipeline)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
              {pipeline.description && (
                <p className="text-sm text-muted-foreground mt-2">{pipeline.description}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>ID: {pipeline.id}</p>
                <p className="mt-1">
                  Создана: {new Date(pipeline.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}

        {pipelines.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Нет воронок продаж. Создайте первую воронку.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={pipelineDialogOpen} onOpenChange={setPipelineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPipeline ? "Редактировать воронку" : "Создать воронку"}
            </DialogTitle>
            <DialogDescription>
              {editingPipeline
                ? "Измените параметры воронки продаж"
                : "Создайте новую воронку продаж"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Название</Label>
              <Input
                id="name"
                value={pipelineName}
                onChange={(e) => setPipelineName(e.target.value)}
                placeholder="Например: B2B продажи"
              />
            </div>
            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={pipelineDescription}
                onChange={(e) => setPipelineDescription(e.target.value)}
                placeholder="Краткое описание воронки"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Отмена
            </Button>
            <Button
              onClick={handleSave}
              disabled={createPipeline.isPending || updatePipeline.isPending}
            >
              {editingPipeline ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить воронку?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить воронку "{pipelineToDelete?.name}"? Это действие
              нельзя отменить. Все сделки, этапы и кастомные поля этой воронки будут удалены.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
