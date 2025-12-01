import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Package,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Factory,
  ClipboardList
} from "lucide-react";
import type { ProjectStage, ProductionTask as DBProductionTask } from "@shared/schema";
import type { ProductionStageData, CuttingSpecItem, AllocatedMaterial, ProductionPhoto } from "@/types/production";
import { ProductionCard } from "./ProductionCard";
import { ProductionTaskCreateDialog } from "./ProductionTaskCreateDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ProductionStageFormProps {
  stage: ProjectStage;
  projectId: string;
  onDataChange: (data: ProductionStageData) => void;
  readOnly?: boolean;
}

interface User {
  id: string;
  username: string;
  full_name?: string;
}

interface ProductionStageFromDB {
  id: string;
  task_id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  order: number;
}

export function ProductionStageForm({
  stage,
  projectId,
  onDataChange,
  readOnly = false
}: ProductionStageFormProps) {
  const { toast } = useToast();

  // Инициализация данных формы
  const [formData, setFormData] = useState<ProductionStageData>(() => {
    try {
      const parsed = stage.type_data ? JSON.parse(stage.type_data as string) : {};
      return {
        linked_task_ids: [],
        cutting_specification: [],
        specification_imported: false,
        specification_progress: 0,
        allocated_materials: [],
        materials_allocated: false,
        production_photos: [],
        quality_checks: [],
        quality_approved: false,
        overall_progress: 0,
        production_completed: false,
        ready_for_installation: false,
        installation_notified: false,
        ...parsed,
      };
    } catch {
      return {
        linked_task_ids: [],
        cutting_specification: [],
        specification_imported: false,
        specification_progress: 0,
        allocated_materials: [],
        materials_allocated: false,
        production_photos: [],
        quality_checks: [],
        quality_approved: false,
        overall_progress: 0,
        production_completed: false,
        ready_for_installation: false,
        installation_notified: false,
      };
    }
  });

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Загружаем производственные задачи для проекта
  const { data: productionTasks = [] } = useQuery<DBProductionTask[]>({
    queryKey: ['/api/production', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/production?project_id=${projectId}`);
      return response;
    }
  });

  // Загружаем подэтапы производства
  const { data: productionStages = [] } = useQuery<ProductionStageFromDB[]>({
    queryKey: ['/api/production/stages', formData.linked_task_ids],
    enabled: formData.linked_task_ids.length > 0,
    queryFn: async () => {
      // Загружаем подэтапы для всех связанных задач
      const allStages: ProductionStageFromDB[] = [];
      for (const taskId of formData.linked_task_ids) {
        const stages = await apiRequest('GET', `/api/production/${taskId}/stages`);
        allStages.push(...stages);
      }
      return allStages;
    }
  });

  // Загружаем пользователей для отображения исполнителей
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Вычисляем общий прогресс
  useEffect(() => {
    if (productionTasks.length === 0) {
      return;
    }

    const totalProgress = productionTasks.reduce((sum, task) => sum + (task.progress || 0), 0);
    const avgProgress = Math.round(totalProgress / productionTasks.length);

    // Обновляем overall_progress если изменился
    if (formData.overall_progress !== avgProgress) {
      setFormData(prev => ({
        ...prev,
        overall_progress: avgProgress,
        production_completed: avgProgress === 100,
        ready_for_installation: avgProgress === 100 && prev.quality_approved,
      }));
      setHasChanges(true);
    }
  }, [productionTasks, formData.overall_progress, formData.quality_approved]);

  // Обработчик изменения данных
  const handleFieldChange = (updates: Partial<ProductionStageData>) => {
    setFormData(prev => ({
      ...prev,
      ...updates,
    }));
    setHasChanges(true);
  };

  // Сохранение изменений
  const handleSave = () => {
    onDataChange(formData);
    setHasChanges(false);
  };

  // Получаем рабочего по ID
  const getWorkerName = (workerId?: string | null) => {
    if (!workerId) return 'Не назначен';
    const user = users.find(u => u.id === workerId);
    return user?.full_name || user?.username || 'Неизвестно';
  };

  // Обработчик создания новой задачи
  const handleTaskCreated = () => {
    // Обновляем список задач
    queryClient.invalidateQueries({ queryKey: ['/api/production', projectId] });
  };

  // Переключение отметки о выполнении детали спецификации
  const handleToggleSpecItem = (itemId: string) => {
    const updatedSpec = formData.cutting_specification.map(item =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    const completed = updatedSpec.filter(item => item.completed).length;
    const progress = updatedSpec.length > 0
      ? Math.round((completed / updatedSpec.length) * 100)
      : 0;

    handleFieldChange({
      cutting_specification: updatedSpec,
      specification_progress: progress,
    });
  };

  // Добавление детали в спецификацию
  const [newSpecItem, setNewSpecItem] = useState<Partial<CuttingSpecItem>>({});
  const [specDialogOpen, setSpecDialogOpen] = useState(false);

  const handleAddSpecItem = () => {
    if (!newSpecItem.part_name || !newSpecItem.material || !newSpecItem.dimensions || !newSpecItem.quantity) {
      toast({
        description: 'Заполните все обязательные поля',
        variant: 'destructive',
      });
      return;
    }

    const item: CuttingSpecItem = {
      id: nanoid(),
      part_name: newSpecItem.part_name,
      material: newSpecItem.material,
      dimensions: newSpecItem.dimensions,
      quantity: newSpecItem.quantity,
      edge_banding: newSpecItem.edge_banding,
      completed: false,
      notes: newSpecItem.notes,
    };

    handleFieldChange({
      cutting_specification: [...formData.cutting_specification, item],
    });

    setNewSpecItem({});
    setSpecDialogOpen(false);
  };

  return (
    <Card className="border-l-4 border-orange-500">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏭</span>
          <CardTitle className="text-base">Производство</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Общий прогресс */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Factory className="w-4 h-4" />
              Общий прогресс производства
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Выполнено</span>
              <span className="font-bold text-lg">{formData.overall_progress}%</span>
            </div>
            <Progress value={formData.overall_progress} className="h-3" />

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${formData.production_completed ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-xs">
                  {formData.production_completed ? 'Производство завершено' : 'В процессе'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${formData.quality_approved ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-xs">
                  {formData.quality_approved ? 'Качество подтверждено' : 'Требуется проверка'}
                </span>
              </div>
            </div>

            {formData.ready_for_installation && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Готово к монтажу</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Вкладки */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="tasks">
              Задачи ({productionTasks.length})
            </TabsTrigger>
            <TabsTrigger value="specification">
              Спецификация ({formData.cutting_specification.length})
            </TabsTrigger>
            <TabsTrigger value="materials">
              Материалы ({formData.allocated_materials.length})
            </TabsTrigger>
          </TabsList>

          {/* Вкладка: Производственные задачи */}
          <TabsContent value="tasks" className="space-y-3">
            {!readOnly && (
              <Button
                onClick={() => setCreateDialogOpen(true)}
                size="sm"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Создать производственную задачу
              </Button>
            )}

            {productionTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Factory className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет производственных задач</p>
                <p className="text-xs mt-1">Создайте первую задачу для начала производства</p>
              </div>
            ) : (
              <div className="space-y-3">
                {productionTasks.map((task) => {
                  // Получаем подэтапы для этой задачи
                  const taskStages = productionStages
                    .filter(s => s.task_id === task.id)
                    .map(s => ({
                      name: s.name,
                      status: s.status as 'pending' | 'in_progress' | 'completed',
                    }));

                  return (
                    <ProductionCard
                      key={task.id}
                      id={task.id}
                      itemName={task.item_name}
                      projectName={null}
                      stages={taskStages}
                      progress={task.progress || 0}
                      worker={getWorkerName(task.worker_id)}
                      payment={task.payment || 0}
                      deadline={task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Не указан'}
                      qrCode={!!task.qr_code}
                      status={task.status as 'pending' | 'in_progress' | 'completed'}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Вкладка: Спецификация на распил */}
          <TabsContent value="specification" className="space-y-3">
            {!readOnly && (
              <Dialog open={specDialogOpen} onOpenChange={setSpecDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить деталь
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Добавить деталь в спецификацию</DialogTitle>
                    <DialogDescription>
                      Укажите параметры детали для производства
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Название детали *</Label>
                      <Input
                        value={newSpecItem.part_name || ''}
                        onChange={(e) => setNewSpecItem({ ...newSpecItem, part_name: e.target.value })}
                        placeholder="Например: Полка верхняя"
                      />
                    </div>
                    <div>
                      <Label>Материал *</Label>
                      <Input
                        value={newSpecItem.material || ''}
                        onChange={(e) => setNewSpecItem({ ...newSpecItem, material: e.target.value })}
                        placeholder="Например: ЛДСП Egger U999"
                      />
                    </div>
                    <div>
                      <Label>Размеры (ДxШxВ) *</Label>
                      <Input
                        value={newSpecItem.dimensions || ''}
                        onChange={(e) => setNewSpecItem({ ...newSpecItem, dimensions: e.target.value })}
                        placeholder="Например: 800x400x18"
                      />
                    </div>
                    <div>
                      <Label>Количество *</Label>
                      <Input
                        type="number"
                        value={newSpecItem.quantity || ''}
                        onChange={(e) => setNewSpecItem({ ...newSpecItem, quantity: parseInt(e.target.value) || 0 })}
                        placeholder="1"
                      />
                    </div>
                    <div>
                      <Label>Кромка</Label>
                      <Input
                        value={newSpecItem.edge_banding || ''}
                        onChange={(e) => setNewSpecItem({ ...newSpecItem, edge_banding: e.target.value })}
                        placeholder="Например: АБС 2мм по 4 сторонам"
                      />
                    </div>
                    <div>
                      <Label>Примечания</Label>
                      <Textarea
                        value={newSpecItem.notes || ''}
                        onChange={(e) => setNewSpecItem({ ...newSpecItem, notes: e.target.value })}
                        placeholder="Дополнительные детали..."
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleAddSpecItem} className="w-full">
                      Добавить деталь
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {formData.cutting_specification.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Спецификация пуста</p>
                <p className="text-xs mt-1">Добавьте детали для производства</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between p-3 bg-accent rounded-md">
                  <span className="text-sm font-medium">Прогресс по спецификации</span>
                  <span className="text-sm font-bold">{formData.specification_progress}%</span>
                </div>

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">✓</TableHead>
                        <TableHead>Деталь</TableHead>
                        <TableHead>Материал</TableHead>
                        <TableHead>Размеры</TableHead>
                        <TableHead className="text-right">Кол-во</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.cutting_specification.map((item) => (
                        <TableRow key={item.id} className={item.completed ? 'bg-green-50' : ''}>
                          <TableCell>
                            <Checkbox
                              checked={item.completed}
                              onCheckedChange={() => handleToggleSpecItem(item.id)}
                              disabled={readOnly}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            {item.part_name}
                            {item.completed && (
                              <CheckCircle2 className="w-4 h-4 inline-block ml-2 text-green-600" />
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.material}
                          </TableCell>
                          <TableCell className="text-sm">{item.dimensions}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </TabsContent>

          {/* Вкладка: Материалы */}
          <TabsContent value="materials" className="space-y-3">
            {formData.allocated_materials.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Материалы не выделены</p>
                <p className="text-xs mt-1">Материалы будут доступны после этапа Снабжение</p>
              </div>
            ) : (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Материал</TableHead>
                      <TableHead className="text-right">Количество</TableHead>
                      <TableHead>Дата выделения</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {formData.allocated_materials.map((material) => (
                      <TableRow key={material.id}>
                        <TableCell className="font-medium">{material.material_name}</TableCell>
                        <TableCell className="text-right">
                          {material.quantity} {material.unit}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {material.allocated_date
                            ? new Date(material.allocated_date).toLocaleDateString('ru-RU')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Примечания */}
        <div className="space-y-2">
          <Label>Примечания</Label>
          <Textarea
            value={formData.notes || ''}
            onChange={(e) => handleFieldChange({ notes: e.target.value })}
            placeholder="Особенности производства, требования к качеству..."
            rows={3}
            disabled={readOnly}
          />
        </div>

        {/* Кнопка сохранения */}
        {!readOnly && hasChanges && (
          <Button onClick={handleSave} className="w-full" size="sm">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Сохранить изменения
          </Button>
        )}

        {readOnly && (
          <div className="text-xs text-muted-foreground bg-accent p-2 rounded">
            ℹ️ Этап завершен. Редактирование недоступно.
          </div>
        )}
      </CardContent>

      {/* Диалог создания производственной задачи */}
      <ProductionTaskCreateDialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) {
            handleTaskCreated();
          }
        }}
      />
    </Card>
  );
}
