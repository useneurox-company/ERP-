import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Edit2, Plus, Trash2, Settings2, ArrowLeft, Wand2, Image as ImageIcon, X, ZoomIn } from "lucide-react";
import { LocalStageEditor, LocalStage, LocalStageDependency } from "./LocalStageEditor";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface InvoicePosition {
  name: string;
  article?: string;
  quantity: number;
  price: string;
  imageUrl?: string;
}

interface PositionStagesData {
  stages: LocalStage[];
  dependencies: LocalStageDependency[];
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoicePositions: InvoicePosition[];
  onCreateProject: (
    selectedPositions: number[], 
    editedPositions: InvoicePosition[],
    positionStagesData: Record<number, PositionStagesData>
  ) => void;
  isPending: boolean;
  dealName: string;
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  invoicePositions,
  onCreateProject,
  isPending,
  dealName,
}: CreateProjectDialogProps) {
  const { toast } = useToast();
  const [positions, setPositions] = useState<InvoicePosition[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [currentTab, setCurrentTab] = useState<"positions" | "stages">("positions");
  const [selectedPositionForStages, setSelectedPositionForStages] = useState<number | null>(null);
  const [positionStagesData, setPositionStagesData] = useState<Record<number, PositionStagesData>>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [imagePreview, setImagePreview] = useState<{ url: string; index: number } | null>(null);

  // Load templates
  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["/api/templates"],
    enabled: open,
  });

  // Load users for executor selection
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  useEffect(() => {
    if (open) {
      console.log("[CreateProjectDialog] Dialog opened - initializing");
      if (invoicePositions.length > 0) {
        setPositions([...invoicePositions]);
        setSelectedIndices(new Set(invoicePositions.map((_, i) => i)));
      }
      setCurrentTab("positions");
      setSelectedPositionForStages(null);
      setPositionStagesData({}); // Очистить данные этапов только при открытии
      console.log("[CreateProjectDialog] positionStagesData cleared");
    }
  }, [open]); // Убрали invoicePositions из зависимостей - теперь срабатывает только при open/close

  const handleToggle = (index: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedIndices(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedIndices.size === positions.length) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(positions.map((_, i) => i)));
    }
  };

  const handleAddPosition = () => {
    const newPosition: InvoicePosition = {
      name: "Новая позиция",
      quantity: 1,
      price: "0",
      imageUrl: undefined,
    };
    setPositions([...positions, newPosition]);
    setSelectedIndices(new Set(Array.from(selectedIndices).concat(positions.length)));
    setEditingIndex(positions.length);
  };

  const handleDeletePosition = (index: number) => {
    const newPositions = positions.filter((_, i) => i !== index);
    setPositions(newPositions);
    
    const newSelected = new Set<number>();
    selectedIndices.forEach(idx => {
      if (idx < index) {
        newSelected.add(idx);
      } else if (idx > index) {
        newSelected.add(idx - 1);
      }
    });
    setSelectedIndices(newSelected);

    // Переиндексировать positionStagesData
    const newStagesData: Record<number, PositionStagesData> = {};
    Object.entries(positionStagesData).forEach(([key, value]) => {
      const oldIndex = parseInt(key);
      if (oldIndex < index) {
        newStagesData[oldIndex] = value;
      } else if (oldIndex > index) {
        newStagesData[oldIndex - 1] = value;
      }
      // Если oldIndex === index, не добавляем (удаляем)
    });
    setPositionStagesData(newStagesData);
  };

  const handleUpdatePosition = (index: number, field: keyof InvoicePosition, value: string | number) => {
    const newPositions = [...positions];
    newPositions[index] = { ...newPositions[index], [field]: value };
    setPositions(newPositions);
  };

  const handlePasteImage = async (event: React.ClipboardEvent, index: number) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        event.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          const newPositions = [...positions];
          newPositions[index] = { ...newPositions[index], imageUrl: base64 };
          setPositions(newPositions);
          toast({
            title: "Изображение добавлено",
            description: "Изображение успешно вставлено из буфера обмена",
          });
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    const newPositions = [...positions];
    newPositions[index] = { ...newPositions[index], imageUrl: undefined };
    setPositions(newPositions);
    toast({
      title: "Изображение удалено",
    });
  };

  const handleCreate = () => {
    onCreateProject(Array.from(selectedIndices), positions, positionStagesData);
  };

  const goToStages = (index: number) => {
    console.log("[GoToStages] Position index:", index);
    console.log("[GoToStages] Current positionStagesData:", positionStagesData);
    console.log("[GoToStages] Stages for position:", positionStagesData[index]?.stages);
    console.log("[GoToStages] Stages count:", positionStagesData[index]?.stages?.length || 0);
    setSelectedPositionForStages(index);
    setCurrentTab("stages");
  };

  const backToPositions = () => {
    setSelectedPositionForStages(null);
    setCurrentTab("positions");
  };

  const handleApplyTemplateToAll = async () => {
    if (!selectedTemplateId) return;

    setIsApplyingTemplate(true);
    try {
      const response = await apiRequest<any>(
        "GET",
        `/api/templates/${selectedTemplateId}`
      );
      const data = response;

      // Детальное логирование для отладки
      console.log("[ApplyTemplate] Full API Response:", response);
      console.log("[ApplyTemplate] Response type:", typeof response);
      console.log("[ApplyTemplate] Response keys:", Object.keys(response || {}));

      if (data?.stages) {
        console.log("[ApplyTemplate] Stages count:", data.stages.length);
      }
      if (data?.dependencies) {
        console.log("[ApplyTemplate] Dependencies count:", data.dependencies.length);
      }

      // Проверка наличия данных
      if (!data) {
        console.error("[ApplyTemplate] Empty response from API");
        throw new Error("Сервер вернул пустой ответ. Проверьте подключение.");
      }

      // Проверка поля template
      if (!data.template) {
        console.error("[ApplyTemplate] Missing 'template' field:", data);
        throw new Error("Ответ сервера не содержит информацию о шаблоне.");
      }

      // Проверка поля stages
      if (!data.stages) {
        console.error("[ApplyTemplate] Missing 'stages' field:", data);
        throw new Error("Ответ сервера не содержит этапы шаблона.");
      }

      if (!Array.isArray(data.stages)) {
        console.error("[ApplyTemplate] 'stages' is not an array:", typeof data.stages, data.stages);
        throw new Error(`Неверный формат этапов: ожидался массив, получен ${typeof data.stages}`);
      }

      // Проверка template.name для toast
      if (!data.template.name) {
        console.warn("[ApplyTemplate] Template has no name:", data.template);
      }

      const { template, stages, dependencies = [] } = data;

      console.log("[ApplyTemplate] Validated data:", {
        templateName: template.name,
        stagesCount: stages.length,
        dependenciesCount: dependencies.length
      });

      // Применить шаблон ко ВСЕМ позициям (независимо от выбора чекбоксами)
      const newStagesData: Record<number, PositionStagesData> = {};

      console.log("[ApplyTemplate] Applying to ALL positions, count:", positions.length);

      positions.forEach((_, positionIndex) => {
        // Create stage ID mapping with crypto.randomUUID() for uniqueness
        const stageIdMap: Record<string, string> = {};
        stages.forEach((stage: any) => {
          stageIdMap[stage.id] = crypto.randomUUID();
        });

        console.log(`[ApplyTemplate] Processing position ${positionIndex}:`, positions[positionIndex]?.name);

        // Map template stages to LocalStage format
        const localStages: LocalStage[] = stages.map((stage: any) => {
          const stageObj: LocalStage = {
            id: stageIdMap[stage.id],
            name: stage.name || '',
            order_index: stage.order,
          };
          if (stage.duration_days) stageObj.duration_days = stage.duration_days;
          if (stage.assignee_id) stageObj.assignee_id = stage.assignee_id;
          if (stage.cost) stageObj.cost = parseFloat(stage.cost);
          if (stage.description) stageObj.description = stage.description;
          if (stage.stage_type_id) stageObj.stage_type_id = stage.stage_type_id;
          if (stage.template_data) stageObj.template_data = stage.template_data;
          return stageObj;
        });

        // Map dependencies with validation
        const localDependencies: LocalStageDependency[] = dependencies
          .filter((dep: any) => {
            const hasValidIds = stageIdMap[dep.template_stage_id] && stageIdMap[dep.depends_on_template_stage_id];
            if (!hasValidIds) {
              console.warn(`[ApplyTemplate] Skipping dependency for position ${positionIndex}:`, dep);
            }
            return hasValidIds;
          })
          .map((dep: any) => ({
            stage_id: stageIdMap[dep.template_stage_id],
            depends_on_stage_id: stageIdMap[dep.depends_on_template_stage_id],
          }));

        newStagesData[positionIndex] = {
          stages: localStages,
          dependencies: localDependencies,
        };

        console.log(`[ApplyTemplate] Position ${positionIndex} stages count:`, localStages.length);
      });

      console.log("[ApplyTemplate] Total positions processed:", Object.keys(newStagesData).length);

      setPositionStagesData(prev => {
        const updated = {
          ...prev,
          ...newStagesData,
        };
        console.log("[ApplyTemplate] Updated positionStagesData:", updated);
        console.log("[ApplyTemplate] Keys in positionStagesData:", Object.keys(updated));
        return updated;
      });

      toast({
        description: `Шаблон "${template.name}" применён ко всем позициям (${positions.length})`
      });
      setSelectedTemplateId("");
    } catch (error: any) {
      console.error("[ApplyTemplate] Error applying template:", error);
      console.error("[ApplyTemplate] Error stack:", error.stack);

      // Определить тип ошибки для более информативного сообщения
      let errorMessage = "Не удалось применить шаблон";

      if (error.message) {
        errorMessage = error.message;
      } else if (error.response?.status === 404) {
        errorMessage = "Шаблон не найден на сервере";
      } else if (error.response?.status === 500) {
        errorMessage = "Внутренняя ошибка сервера";
      } else if (error.name === "NetworkError") {
        errorMessage = "Ошибка сети. Проверьте подключение.";
      }

      toast({
        title: "Ошибка применения шаблона",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId || selectedPositionForStages === null) return;

    setIsApplyingTemplate(true);
    try {
      console.log("=== ПРИМЕНЕНИЕ ШАБЛОНА ===");
      console.log("Template ID:", selectedTemplateId);
      console.log("Position Index:", selectedPositionForStages);

      const response = await apiRequest<any>(
        "GET",
        `/api/templates/${selectedTemplateId}`
      );
      const data = response;

      console.log("Получены данные от API:", data);
      console.log("data.stages:", data?.stages);
      console.log("data.dependencies:", data?.dependencies);

      // API returns { template, stages, dependencies }
      if (!data || !data.stages || !Array.isArray(data.stages)) {
        console.error("Неправильная структура данных:", { data, hasStages: !!data?.stages, isArray: Array.isArray(data?.stages) });
        throw new Error("Invalid template data structure");
      }

      const { template, stages, dependencies = [] } = data;
      console.log("Этапов в шаблоне:", stages.length);
      console.log("Зависимостей в шаблоне:", dependencies.length);

      // Create stage ID mapping with crypto.randomUUID() for uniqueness
      const stageIdMap: Record<string, string> = {};
      stages.forEach((stage: any) => {
        stageIdMap[stage.id] = crypto.randomUUID();
      });

      // Map template stages to LocalStage format
      const localStages: LocalStage[] = stages.map((stage: any) => {
        const stageObj: LocalStage = {
          id: stageIdMap[stage.id],
          name: stage.name || '',
          order_index: stage.order,
        };
        if (stage.duration_days) stageObj.duration_days = stage.duration_days;
        if (stage.assignee_id) stageObj.assignee_id = stage.assignee_id;
        if (stage.cost) stageObj.cost = parseFloat(stage.cost);
        if (stage.description) stageObj.description = stage.description;
        if (stage.stage_type_id) stageObj.stage_type_id = stage.stage_type_id;
        if (stage.template_data) stageObj.template_data = stage.template_data;
        return stageObj;
      });

      console.log("Создано localStages:", localStages);

      // Map dependencies with validation - skip invalid dependencies
      const localDependencies: LocalStageDependency[] = dependencies
        .filter((dep: any) => {
          const hasValidIds = stageIdMap[dep.template_stage_id] && stageIdMap[dep.depends_on_template_stage_id];
          if (!hasValidIds) {
            console.warn("Skipping dependency with missing stage IDs:", dep);
          }
          return hasValidIds;
        })
        .map((dep: any) => ({
          stage_id: stageIdMap[dep.template_stage_id],
          depends_on_stage_id: stageIdMap[dep.depends_on_template_stage_id],
        }));

      console.log("Создано localDependencies:", localDependencies);

      setPositionStagesData(prev => {
        const newData = {
          ...prev,
          [selectedPositionForStages]: {
            stages: localStages,
            dependencies: localDependencies,
          }
        };
        console.log("Обновляем positionStagesData:", newData);
        console.log("Для позиции", selectedPositionForStages, ":", newData[selectedPositionForStages]);
        return newData;
      });

      console.log("=== ШАБЛОН ПРИМЕНЁН УСПЕШНО ===");
      toast({ description: `Шаблон "${template.name}" применён` });
      setSelectedTemplateId("");
    } catch (error) {
      console.error("Error applying template:", error);
      const message = error instanceof Error ? error.message : "Ошибка при применении шаблона";
      toast({ description: message, variant: "destructive" });
    } finally {
      setIsApplyingTemplate(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]" data-testid="dialog-create-project">
        <DialogHeader>
          {currentTab === "stages" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={backToPositions}
              className="mb-2 w-fit"
              data-testid="button-back-to-positions"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад к позициям
            </Button>
          )}
          <DialogTitle>
            {currentTab === "positions" 
              ? "Создать проект из счёта" 
              : `Настройка этапов: ${positions[selectedPositionForStages!]?.name}`
            }
          </DialogTitle>
          <DialogDescription>
            {currentTab === "positions" 
              ? `Выберите позиции из счёта, которые войдут в проект "${dealName}"`
              : "Добавьте этапы и свяжите их зависимостями. После создания проекта этапы будут доступны для редактирования."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 min-h-0">
          {currentTab === "positions" ? (
            <>
            <div className="flex items-center justify-between gap-2 pb-2 border-b shrink-0">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all"
                checked={selectedIndices.size === positions.length}
                onCheckedChange={handleToggleAll}
                data-testid="checkbox-select-all"
              />
              <label
                htmlFor="select-all"
                className="text-sm font-medium cursor-pointer"
                data-testid="label-select-all"
              >
                Выбрать все ({selectedIndices.size} из {positions.length})
              </label>
            </div>
            <div className="flex gap-2">
              <Select
                value={selectedTemplateId}
                onValueChange={setSelectedTemplateId}
                disabled={isApplyingTemplate}
              >
                <SelectTrigger className="w-[200px]" data-testid="select-template-all">
                  <SelectValue placeholder="Шаблон для всех" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleApplyTemplateToAll}
                disabled={!selectedTemplateId || isApplyingTemplate}
                data-testid="button-apply-template-all"
              >
                {isApplyingTemplate ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4 mr-1" />
                )}
                Применить ко всем
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddPosition}
                data-testid="button-add-position"
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[280px] pr-3">
            <div className="space-y-2">
              {positions.map((position, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 rounded-lg border hover-elevate"
                  data-testid={`position-${index}`}
                  onPaste={editingIndex === index ? (e) => handlePasteImage(e, index) : undefined}
                  tabIndex={editingIndex === index ? -1 : undefined}
                >
                  <Checkbox
                    id={`position-${index}`}
                    checked={selectedIndices.has(index)}
                    onCheckedChange={() => handleToggle(index)}
                    data-testid={`checkbox-position-${index}`}
                    className="mt-0.5"
                  />

                  {editingIndex === index ? (
                    <div className="flex-1 space-y-2">
                      <Input
                        value={position.name}
                        onChange={(e) => handleUpdatePosition(index, 'name', e.target.value)}
                        placeholder="Название"
                        data-testid={`input-edit-name-${index}`}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={position.quantity}
                          onChange={(e) => handleUpdatePosition(index, 'quantity', parseInt(e.target.value) || 1)}
                          placeholder="Кол-во"
                          className="w-20"
                          data-testid={`input-edit-quantity-${index}`}
                        />
                        <Input
                          type="number"
                          value={position.price}
                          onChange={(e) => handleUpdatePosition(index, 'price', e.target.value)}
                          placeholder="Цена"
                          className="flex-1"
                          data-testid={`input-edit-price-${index}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setEditingIndex(null)}
                          data-testid={`button-save-${index}`}
                        >
                          Готово
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        {position.imageUrl ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setImagePreview({ url: position.imageUrl!, index })}
                              className="relative w-12 h-12 rounded border hover:border-primary transition-colors"
                            >
                              <img
                                src={position.imageUrl}
                                alt="Preview"
                                className="w-full h-full object-cover rounded"
                              />
                              <ZoomIn className="absolute inset-0 m-auto w-4 h-4 text-white opacity-0 hover:opacity-100 transition-opacity" />
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveImage(index)}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Удалить фото
                            </Button>
                          </>
                        ) : (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 p-2 border rounded bg-muted/30">
                            <ImageIcon className="w-3 h-3" />
                            Нажмите Ctrl+V чтобы вставить изображение
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        {position.imageUrl && (
                          <button
                            type="button"
                            onClick={() => setImagePreview({ url: position.imageUrl!, index })}
                            className="relative w-12 h-12 rounded border hover:border-primary transition-colors shrink-0"
                          >
                            <img
                              src={position.imageUrl}
                              alt="Preview"
                              className="w-full h-full object-cover rounded"
                            />
                            <ZoomIn className="absolute inset-0 m-auto w-4 h-4 text-white opacity-0 hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm" data-testid={`text-position-name-${index}`}>
                            {position.name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-medium" data-testid={`text-position-price-${index}`}>
                          {parseFloat(position.price).toLocaleString('ru-RU')} ₽
                        </p>
                        <p className="text-xs text-muted-foreground" data-testid={`text-position-quantity-${index}`}>
                          {position.quantity} шт.
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={positionStagesData[index]?.stages?.length > 0 ? "default" : "outline"}
                          onClick={(e) => {
                            e.stopPropagation();
                            goToStages(index);
                          }}
                          data-testid={`button-stages-${index}`}
                        >
                          <Settings2 className="w-3 h-3 mr-1" />
                          Этапы
                          {positionStagesData[index]?.stages?.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                              {positionStagesData[index].stages.length}
                            </span>
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingIndex(index)}
                          data-testid={`button-edit-${index}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDeletePosition(index)}
                          data-testid={`button-delete-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedIndices.size === 0 && (
            <p className="text-sm text-destructive shrink-0" data-testid="text-validation-error">
              Выберите хотя бы одну позицию для создания проекта
            </p>
          )}
            </>
          ) : selectedPositionForStages !== null ? (
            <>
              <div className="shrink-0 flex items-center gap-2 pb-3 border-b">
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                  disabled={isApplyingTemplate}
                >
                  <SelectTrigger className="flex-1" data-testid="select-template">
                    <SelectValue placeholder="Выберите шаблон процесса" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleApplyTemplate}
                  disabled={!selectedTemplateId || isApplyingTemplate}
                  size="default"
                  data-testid="button-apply-template"
                >
                  {isApplyingTemplate ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-2" />
                  )}
                  Применить
                </Button>
              </div>

              <LocalStageEditor
                positionName={positions[selectedPositionForStages]?.name || ""}
                stages={positionStagesData[selectedPositionForStages]?.stages || []}
                dependencies={positionStagesData[selectedPositionForStages]?.dependencies || []}
                mode="project"
                users={users}
                onStagesChange={(stages) => {
                  setPositionStagesData(prev => ({
                    ...prev,
                    [selectedPositionForStages]: {
                      stages,
                      dependencies: prev[selectedPositionForStages]?.dependencies || []
                    }
                  }));
                }}
                onDependenciesChange={(dependencies) => {
                  setPositionStagesData(prev => ({
                    ...prev,
                    [selectedPositionForStages]: {
                      stages: prev[selectedPositionForStages]?.stages || [],
                      dependencies
                    }
                  }));
                }}
              />
            </>
          ) : null}

          <DialogFooter className="shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            data-testid="button-cancel"
          >
            Отмена
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isPending || selectedIndices.size === 0}
            data-testid="button-create-project-confirm"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isPending ? "Создание..." : "Создать проект"}
          </Button>
          </DialogFooter>
        </div>
      </DialogContent>

      {/* Image Preview Dialog */}
      {imagePreview && (
        <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Изображение позиции</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              <img
                src={imagePreview.url}
                alt="Preview"
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImagePreview(null)}>
                Закрыть
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  handleRemoveImage(imagePreview.index);
                  setImagePreview(null);
                }}
              >
                Удалить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
  );
}
