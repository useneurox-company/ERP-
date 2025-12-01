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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Package, AlertCircle, Check, Upload, Download, FileSpreadsheet, GitCompare, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { nanoid } from "nanoid";
import type { HardwareSpecItem, WarehouseComparisonResult } from "@/types/constructorDocumentation";
import { cn } from "@/lib/utils";
import {
  exportHardwareSpecToExcel,
  importHardwareSpecFromExcel,
  downloadHardwareSpecTemplate
} from "@/lib/excelUtils";
import { useToast } from "@/hooks/use-toast";
import { WarehouseComparisonDialog } from "./WarehouseComparisonDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { ProjectStage } from "@shared/schema";

interface HardwareSpecTableProps {
  items: HardwareSpecItem[];
  onChange: (items: HardwareSpecItem[]) => void;
  onComparisonComplete?: (comparisonResult: WarehouseComparisonResult) => void;
  projectId?: string;
  readOnly?: boolean;
  userId?: string;
  userName?: string;
}

export function HardwareSpecTable({
  items,
  onChange,
  onComparisonComplete,
  projectId,
  readOnly = false,
  userId = "unknown",
  userName = "Unknown"
}: HardwareSpecTableProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [comparisonDialogOpen, setComparisonDialogOpen] = useState(false);
  const [newItem, setNewItem] = useState<Partial<HardwareSpecItem>>({
    name: "",
    article: "",
    quantity: 1,
    unit: "шт"
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
    if (!newItem.name?.trim() || !newItem.article?.trim()) {
      return;
    }

    const item: HardwareSpecItem = {
      id: nanoid(),
      name: newItem.name,
      article: newItem.article,
      quantity: newItem.quantity || 1,
      unit: newItem.unit || "шт",
      notes: newItem.notes,
      addedAt: new Date().toISOString(),
      addedBy: userId,
      addedByName: userName
    };

    onChange([...items, item]);
    setNewItem({ name: "", article: "", quantity: 1, unit: "шт", notes: "" });
  };

  const handleDeleteItem = (id: string) => {
    if (confirm("Удалить позицию из спецификации?")) {
      onChange(items.filter(item => item.id !== id));
    }
  };

  const handleUpdateItem = (id: string, field: keyof HardwareSpecItem, value: any) => {
    onChange(
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleExport = () => {
    try {
      exportHardwareSpecToExcel(items);
      toast({
        title: "Экспорт выполнен",
        description: `Экспортировано ${items.length} позиций фурнитуры`,
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
      const importedItems = await importHardwareSpecFromExcel(file, userId, userName);
      onChange([...items, ...importedItems]);
      toast({
        title: "Импорт выполнен",
        description: `Импортировано ${importedItems.length} позиций фурнитуры`,
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
    downloadHardwareSpecTemplate();
    toast({
      title: "Шаблон скачан",
      description: "Используйте этот шаблон для заполнения спецификации",
    });
  };

  const handleComparisonComplete = (updatedItems: HardwareSpecItem[], comparisonResult: WarehouseComparisonResult) => {
    onChange(updatedItems);
    onComparisonComplete?.(comparisonResult);
  };

  const handleExportToProcurement = async () => {
    const itemsNeedingProcurement = items.filter(item => item.needsToProcure);

    if (itemsNeedingProcurement.length === 0) {
      toast({
        title: "Нет позиций для закупки",
        description: "Все позиции найдены на складе или отмечены как аналоги",
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
      // Найти этап Снабжения
      const procurementStage = projectStages.find(stage => stage.stage_type === "procurement");

      if (!procurementStage) {
        toast({
          title: "Этап Снабжения не найден",
          description: "Сначала создайте этап Снабжения в проекте",
          variant: "destructive",
        });
        return;
      }

      // Получить текущие данные этапа Снабжения
      let procurementData: any = {};
      try {
        procurementData = procurementStage.type_data ? JSON.parse(procurementStage.type_data as string) : {};
      } catch (e) {
        procurementData = {};
      }

      const existingItems = procurementData.procurement_items || [];

      // Создать новые позиции для закупки
      const newProcurementItems = itemsNeedingProcurement.map(item => ({
        id: nanoid(),
        material_name: `${item.name} (${item.article})`,
        quantity: item.quantity,
        unit: item.unit,
        status: "not_ordered" as const,
        notes: `Автоматически добавлено из КД. ${item.notes || ""}`.trim(),
      }));

      // Обновить данные этапа Снабжения
      const updatedData = {
        ...procurementData,
        procurement_items: [...existingItems, ...newProcurementItems],
      };

      // Отправить обновление на сервер
      await apiRequest("PUT", `/api/projects/stages/${procurementStage.id}`, {
        type_data: JSON.stringify(updatedData),
      });

      // Обновить кэш
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/stages`] });

      toast({
        title: "Экспорт завершен",
        description: `${itemsNeedingProcurement.length} позиций отправлено в Снабжение`,
      });
    } catch (error) {
      console.error("Error exporting to procurement:", error);
      toast({
        title: "Ошибка экспорта",
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const units = ["шт", "м", "м²", "кг", "л", "пара", "упак"];

  // Статистика
  const totalItems = items.length;
  const foundInWarehouse = items.filter(item => item.warehouseAvailable && item.warehouseAvailable > 0).length;
  const needsToProcure = items.filter(item => item.needsToProcure).length;
  const alternativesUsed = items.filter(item => item.alternativeUsed).length;

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
            variant="default"
            size="sm"
            onClick={() => setComparisonDialogOpen(true)}
            disabled={items.length === 0}
            className="gap-2"
          >
            <GitCompare className="w-4 h-4" />
            Сравнить со складом
          </Button>
          {needsToProcure > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={handleExportToProcurement}
              className="gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <Truck className="w-4 h-4" />
              Отправить в Снабжение ({needsToProcure})
            </Button>
          )}
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
        </div>
      )}

      {/* Warehouse Comparison Dialog */}
      <WarehouseComparisonDialog
        open={comparisonDialogOpen}
        onOpenChange={setComparisonDialogOpen}
        items={items}
        onComparisonComplete={handleComparisonComplete}
        userId={userId}
        userName={userName}
      />

      {/* Статистика */}
      {totalItems > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 bg-slate-50 dark:bg-slate-900 rounded">
            <div className="text-xs text-muted-foreground">Всего позиций</div>
            <div className="text-lg font-semibold">{totalItems}</div>
          </div>
          <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded">
            <div className="text-xs text-muted-foreground">Есть на складе</div>
            <div className="text-lg font-semibold text-green-600">{foundInWarehouse}</div>
          </div>
          <div className="text-center p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
            <div className="text-xs text-muted-foreground">Нужно закупить</div>
            <div className="text-lg font-semibold text-orange-600">{needsToProcure}</div>
          </div>
          <div className="text-center p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
            <div className="text-xs text-muted-foreground">Аналоги</div>
            <div className="text-lg font-semibold text-blue-600">{alternativesUsed}</div>
          </div>
        </div>
      )}

      {/* Форма добавления */}
      {!readOnly && (
        <div className="p-4 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
          <div className="text-sm font-medium flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Добавить позицию
          </div>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-4">
              <Label className="text-xs">Название</Label>
              <Input
                placeholder="Петля накладная"
                value={newItem.name || ""}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="col-span-3">
              <Label className="text-xs">Артикул</Label>
              <Input
                placeholder="PH-100-CR"
                value={newItem.article || ""}
                onChange={(e) => setNewItem({ ...newItem, article: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Количество</Label>
              <Input
                type="number"
                min="1"
                value={newItem.quantity || 1}
                onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                className="h-9"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Ед. изм.</Label>
              <Select
                value={newItem.unit || "шт"}
                onValueChange={(value) => setNewItem({ ...newItem, unit: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {units.map(unit => (
                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 flex items-end">
              <Button
                onClick={handleAddItem}
                disabled={!newItem.name?.trim() || !newItem.article?.trim()}
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
          <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Спецификация на фурнитуру пуста</p>
          <p className="text-xs mt-1">Добавьте позиции используя форму выше</p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Название</TableHead>
                <TableHead className="w-[15%]">Артикул</TableHead>
                <TableHead className="w-[10%]">Кол-во</TableHead>
                <TableHead className="w-[10%]">Ед.</TableHead>
                <TableHead className="w-[10%]">На складе</TableHead>
                <TableHead className="w-[15%]">Статус</TableHead>
                <TableHead className="w-[20%]">Примечания</TableHead>
                {!readOnly && <TableHead className="w-[50px]"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="font-medium">{item.name}</div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                      {item.article}
                    </code>
                  </TableCell>
                  <TableCell>
                    {readOnly ? (
                      <span>{item.quantity}</span>
                    ) : (
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, "quantity", parseInt(e.target.value) || 1)}
                        className="h-8 w-20"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{item.unit}</span>
                  </TableCell>
                  <TableCell>
                    {item.warehouseAvailable !== undefined ? (
                      <div className="flex items-center gap-1">
                        <Badge
                          variant={item.warehouseAvailable >= item.quantity ? "default" : "destructive"}
                          className={cn(
                            "text-xs",
                            item.warehouseAvailable >= item.quantity && "bg-green-500"
                          )}
                        >
                          {item.warehouseAvailable} {item.unit}
                        </Badge>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {item.needsToProcure && (
                        <Badge variant="outline" className="text-xs gap-1 w-fit">
                          <AlertCircle className="w-3 h-3" />
                          Закупить
                        </Badge>
                      )}
                      {item.alternativeUsed && (
                        <Badge variant="outline" className="text-xs gap-1 w-fit bg-blue-50 text-blue-700 border-blue-200">
                          <Check className="w-3 h-3" />
                          Аналог
                        </Badge>
                      )}
                      {!item.needsToProcure && item.warehouseAvailable && item.warehouseAvailable >= item.quantity && (
                        <Badge variant="outline" className="text-xs gap-1 w-fit bg-green-50 text-green-700 border-green-200">
                          <Check className="w-3 h-3" />
                          В наличии
                        </Badge>
                      )}
                    </div>
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
