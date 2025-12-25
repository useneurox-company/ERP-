import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, Scissors, Info, Upload, Download, FileSpreadsheet, Factory } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { nanoid } from "nanoid";
import type { CuttingSpecItem } from "@/types/constructorDocumentation";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  exportCuttingSpecToExcel,
  importCuttingSpecFromExcel,
  downloadCuttingSpecTemplate
} from "@/lib/excelUtils";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { ProjectStage } from "@shared/schema";

interface CuttingSpecTableProps {
  items: CuttingSpecItem[];
  onChange: (items: CuttingSpecItem[]) => void;
  projectId?: string;
  readOnly?: boolean;
  userId?: string;
  userName?: string;
}

export function CuttingSpecTable({
  items,
  onChange,
  projectId,
  readOnly = false,
  userId = "unknown",
  userName = "Unknown"
}: CuttingSpecTableProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newItem, setNewItem] = useState<Partial<CuttingSpecItem>>({
    partName: "",
    dimensions: "",
    material: "",
    quantity: 1,
    edgeBanding: ""
  });

  // Получаем этапы проекта
  const { data: projectStages = [] } = useQuery<ProjectStage[]>({
    queryKey: [`/api/projects/${projectId}/stages`],
    queryFn: async () => {
      if (!projectId) return [];
      return await apiRequest("GET", `/api/projects/${projectId}/stages`);
    },
    enabled: !!projectId,
  });

  const handleAddItem = () => {
    if (!newItem.partName?.trim() || !newItem.dimensions?.trim() || !newItem.material?.trim()) {
      return;
    }

    const item: CuttingSpecItem = {
      id: nanoid(),
      partName: newItem.partName,
      dimensions: newItem.dimensions,
      material: newItem.material,
      quantity: newItem.quantity || 1,
      edgeBanding: newItem.edgeBanding,
      notes: newItem.notes,
      addedAt: new Date().toISOString(),
      addedBy: userId,
      addedByName: userName
    };

    onChange([...items, item]);
    setNewItem({ partName: "", dimensions: "", material: "", quantity: 1, edgeBanding: "", notes: "" });
  };

  const handleDeleteItem = (id: string) => {
    if (confirm("Удалить деталь из спецификации?")) {
      onChange(items.filter(item => item.id !== id));
    }
  };

  const handleUpdateItem = (id: string, field: keyof CuttingSpecItem, value: any) => {
    onChange(
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleExport = () => {
    try {
      exportCuttingSpecToExcel(items);
      toast({
        title: "Экспорт выполнен",
        description: `Экспортировано ${items.length} деталей на распил`,
      });
    } catch (error) {
      toast({
        title: "Ошибка экспорта",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const importedItems = await importCuttingSpecFromExcel(file, userId, userName);
      onChange([...items, ...importedItems]);
      toast({
        title: "Импорт выполнен",
        description: `Импортировано ${importedItems.length} деталей на распил`,
      });
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      toast({
        title: "Ошибка импорта",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleDownloadTemplate = () => {
    downloadCuttingSpecTemplate();
    toast({
      title: "Шаблон скачан",
      description: "Используйте этот шаблон для заполнения спецификации на распил",
    });
  };

  const handleExportToProduction = async () => {
    if (items.length === 0) {
      toast({
        title: "Нет деталей для отправки",
        description: "Добавьте детали в спецификацию на распил",
        variant: "destructive",
      });
      return;
    }

    if (!projectId) {
      toast({
        title: "Ошибка",
        description: "Не указан ID проекта",
        variant: "destructive",
      });
      return;
    }

    try {
      // Найти этап Производства
      const productionStage = projectStages.find(stage => stage.stage_type_id === "production");

      if (!productionStage) {
        toast({
          title: "Этап Производства не найден",
          description: "Сначала создайте этап Производства в проекте",
          variant: "destructive",
        });
        return;
      }

      // Получить текущие данные этапа Производства
      let productionData: any = {};
      try {
        productionData = productionStage.type_data ? JSON.parse(productionStage.type_data as string) : {};
      } catch (e) {
        productionData = {};
      }

      // Преобразовать детали в формат этапа Производства
      const cuttingSpecification = items.map(item => ({
        id: item.id,
        part_name: item.partName,
        material: item.material,
        dimensions: item.dimensions,
        quantity: item.quantity,
        edge_banding: item.edgeBanding,
        completed: false,
        notes: item.notes,
      }));

      // Обновить данные этапа Производства
      const updatedData = {
        ...productionData,
        cutting_specification: cuttingSpecification,
        specification_imported: true,
        specification_progress: 0,
      };

      // Отправить обновление на сервер
      await apiRequest("PUT", `/api/projects/stages/${productionStage.id}`, {
        type_data: JSON.stringify(updatedData),
      });

      // Обновить кэш
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/stages`] });

      toast({
        title: "Экспорт завершен",
        description: `${items.length} деталей отправлено в Производство`,
      });
    } catch (error) {
      console.error("Error exporting to production:", error);
      toast({
        title: "Ошибка экспорта",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const totalParts = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImport}
        className="hidden"
      />

      {/* Action buttons */}
      {!readOnly && (
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportClick}
            className="gap-2"
          >
            <Upload className="w-4 h-4" />
            Импорт из Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={items.length === 0}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Экспорт в Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            className="gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Скачать шаблон
          </Button>
          {items.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleExportToProduction}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Factory className="w-4 h-4" />
              Отправить в Производство ({items.length})
            </Button>
          )}
        </div>
      )}

      {/* Статистика */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-slate-50 dark:bg-slate-900 rounded">
            <div className="text-xs text-muted-foreground">Типов деталей</div>
            <div className="text-lg font-semibold">{items.length}</div>
          </div>
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
            <div className="text-xs text-muted-foreground">Всего деталей</div>
            <div className="text-lg font-semibold text-blue-600">{totalParts}</div>
          </div>
          <div className="text-center p-2 bg-purple-50 dark:bg-purple-950/20 rounded">
            <div className="text-xs text-muted-foreground">Материалы</div>
            <div className="text-lg font-semibold text-purple-600">
              {new Set(items.map(i => i.material)).size}
            </div>
          </div>
        </div>
      )}

      {/* Форма добавления */}
      {!readOnly && (
        <div className="p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Добавить деталь
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-3">
              <Label className="text-xs">Название детали</Label>
              <Input
                placeholder="Столешница"
                value={newItem.partName || ""}
                onChange={(e) => setNewItem({ ...newItem, partName: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs flex items-center gap-1">
                Размеры
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Формат: длина×ширина×толщина</p>
                      <p className="text-xs text-muted-foreground">Например: 2000×600×18</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                placeholder="2000×600×18"
                value={newItem.dimensions || ""}
                onChange={(e) => setNewItem({ ...newItem, dimensions: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Материал</Label>
              <Input
                placeholder="ЛДСП"
                value={newItem.material || ""}
                onChange={(e) => setNewItem({ ...newItem, material: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="col-span-1">
              <Label className="text-xs">Кол-во</Label>
              <Input
                type="number"
                min="1"
                value={newItem.quantity || 1}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                className="h-9"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs flex items-center gap-1">
                Кромка
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-3 h-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Формат: верх-низ-лево-право</p>
                      <p className="text-xs text-muted-foreground">0 = без кромки, 2 = кромка 2мм</p>
                      <p className="text-xs text-muted-foreground">Например: 0-0-2-2</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Input
                placeholder="0-0-2-2"
                value={newItem.edgeBanding || ""}
                onChange={(e) => setNewItem({ ...newItem, edgeBanding: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="col-span-1 flex items-end">
              <Button
                onClick={handleAddItem}
                disabled={!newItem.partName?.trim() || !newItem.dimensions?.trim() || !newItem.material?.trim()}
                className="h-9 w-full"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div>
            <Label className="text-xs">Примечания (необязательно)</Label>
            <Input
              placeholder="Дополнительная информация"
              value={newItem.notes || ""}
              onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
              className="h-9"
            />
          </div>
        </div>
      )}

      {/* Таблица */}
      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <Scissors className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Спецификация на распил пуста</p>
          <p className="text-xs mt-1">Добавьте детали используя форму выше</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[25%]">Название детали</TableHead>
                <TableHead className="w-[15%]">Размеры (ДхШхТ)</TableHead>
                <TableHead className="w-[15%]">Материал</TableHead>
                <TableHead className="w-[8%]">Кол-во</TableHead>
                <TableHead className="w-[12%]">Кромкование</TableHead>
                <TableHead className="w-[25%]">Примечания</TableHead>
                {!readOnly && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.partName}</div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {item.dimensions}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {item.material}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="font-semibold">{item.quantity}</span>
                    ) : (
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                        className="h-8 w-16"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-sm text-muted-foreground">{item.edgeBanding || "-"}</span>
                    ) : (
                      <Input
                        placeholder="0-0-2-2"
                        value={item.edgeBanding || ""}
                        onChange={(e) => handleUpdateItem(item.id, "edgeBanding", e.target.value)}
                        className="h-8"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span className="text-xs text-muted-foreground">{item.notes || "-"}</span>
                    ) : (
                      <Input
                        placeholder="Примечания"
                        value={item.notes || ""}
                        onChange={(e) => handleUpdateItem(item.id, "notes", e.target.value)}
                        className="h-8 text-xs"
                      />
                    )}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                        className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
