import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Check, X, Search, Package, AlertTriangle } from "lucide-react";
import type { HardwareSpecItem, WarehouseComparisonResult } from "@/types/constructorDocumentation";
import type { WarehouseItem } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";

interface WarehouseComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: HardwareSpecItem[];
  onComparisonComplete: (
    updatedItems: HardwareSpecItem[],
    comparisonResult: WarehouseComparisonResult
  ) => void;
  userId: string;
  userName: string;
}

interface ItemComparison {
  specItem: HardwareSpecItem;
  warehouseMatches: WarehouseItem[];
  selectedWarehouseItem?: WarehouseItem;
  alternativeItem?: WarehouseItem;
  searchQuery?: string;
}

export function WarehouseComparisonDialog({
  open,
  onOpenChange,
  items,
  onComparisonComplete,
  userId,
  userName
}: WarehouseComparisonDialogProps) {
  const { toast } = useToast();
  const [comparisons, setComparisons] = useState<ItemComparison[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  // Fetch all warehouse items
  const { data: allWarehouseItems = [] } = useQuery<WarehouseItem[]>({
    queryKey: ["warehouse-items"],
    queryFn: async () => {
      const response = await fetch("/api/warehouse/items");
      if (!response.ok) throw new Error("Failed to fetch warehouse items");
      return response.json();
    },
    enabled: open,
  });

  // Initialize comparisons when dialog opens
  useEffect(() => {
    if (open && items.length > 0) {
      const initialComparisons = items.map(item => {
        // Auto-search in warehouse for matching items
        const matches = allWarehouseItems.filter(wItem => {
          const itemArticle = item.article.toLowerCase();
          const itemName = item.name.toLowerCase();
          return (
            wItem.sku?.toLowerCase().includes(itemArticle) ||
            wItem.barcode?.toLowerCase().includes(itemArticle) ||
            wItem.name.toLowerCase().includes(itemName) ||
            wItem.name.toLowerCase().includes(itemArticle)
          );
        });

        // Auto-select exact match if found
        const exactMatch = matches.find(m =>
          m.sku?.toLowerCase() === item.article.toLowerCase() ||
          m.barcode?.toLowerCase() === item.article.toLowerCase()
        );

        return {
          specItem: item,
          warehouseMatches: matches,
          selectedWarehouseItem: exactMatch,
          searchQuery: item.article,
        };
      });

      setComparisons(initialComparisons);
      setCurrentIndex(0);
    }
  }, [open, items, allWarehouseItems]);

  const currentComparison = comparisons[currentIndex];

  const handleSearch = (index: number, query: string) => {
    setIsSearching(true);
    const updated = [...comparisons];

    const matches = allWarehouseItems.filter(wItem => {
      const q = query.toLowerCase();
      return (
        wItem.name.toLowerCase().includes(q) ||
        wItem.sku?.toLowerCase().includes(q) ||
        wItem.barcode?.toLowerCase().includes(q)
      );
    });

    updated[index] = {
      ...updated[index],
      searchQuery: query,
      warehouseMatches: matches,
    };

    setComparisons(updated);
    setTimeout(() => setIsSearching(false), 300);
  };

  const handleSelectWarehouseItem = (index: number, warehouseItem: WarehouseItem) => {
    const updated = [...comparisons];
    updated[index] = {
      ...updated[index],
      selectedWarehouseItem: warehouseItem,
      alternativeItem: undefined,
    };
    setComparisons(updated);
  };

  const handleSelectAlternative = (index: number, warehouseItem: WarehouseItem) => {
    const updated = [...comparisons];
    updated[index] = {
      ...updated[index],
      alternativeItem: warehouseItem,
      selectedWarehouseItem: undefined,
    };
    setComparisons(updated);
  };

  const handleMarkNeedsToProcure = (index: number) => {
    const updated = [...comparisons];
    updated[index] = {
      ...updated[index],
      selectedWarehouseItem: undefined,
      alternativeItem: undefined,
    };
    setComparisons(updated);
  };

  const handleComplete = () => {
    // Build updated items and comparison result
    const updatedItems = comparisons.map(comp => {
      const warehouseItem = comp.selectedWarehouseItem || comp.alternativeItem;

      return {
        ...comp.specItem,
        warehouseAvailable: warehouseItem ? parseFloat(String(warehouseItem.quantity)) : undefined,
        warehouseItemId: warehouseItem?.id,
        needsToProcure: !warehouseItem,
        alternativeUsed: !!comp.alternativeItem,
        alternativeItemId: comp.alternativeItem?.id,
      };
    });

    const foundInWarehouse = comparisons.filter(c => c.selectedWarehouseItem || c.alternativeItem).length;
    const needsToProcure = comparisons.filter(c => !c.selectedWarehouseItem && !c.alternativeItem).length;
    const alternativesUsed = comparisons.filter(c => c.alternativeItem).length;

    const comparisonResult: WarehouseComparisonResult = {
      comparedAt: new Date().toISOString(),
      comparedBy: userId,
      comparedByName: userName,
      totalItems: items.length,
      foundInWarehouse,
      needsToProcure,
      alternativesUsed,
    };

    onComparisonComplete(updatedItems, comparisonResult);
    onOpenChange(false);

    toast({
      title: "Сравнение завершено",
      description: `Найдено на складе: ${foundInWarehouse}, Нужно закупить: ${needsToProcure}`,
    });
  };

  const handleNext = () => {
    if (currentIndex < comparisons.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (!currentComparison) {
    return null;
  }

  const availableQuantity = currentComparison.selectedWarehouseItem || currentComparison.alternativeItem
    ? parseFloat(String((currentComparison.selectedWarehouseItem || currentComparison.alternativeItem)!.quantity))
    : 0;
  const hasEnoughStock = availableQuantity >= currentComparison.specItem.quantity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Сравнение со складом</span>
            <Badge variant="outline">
              {currentIndex + 1} / {comparisons.length}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Сопоставьте позиции спецификации с товарами на складе
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Spec Item */}
          <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              Позиция спецификации:
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Название</div>
                <div className="font-semibold">{currentComparison.specItem.name}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Артикул</div>
                <div className="font-mono text-sm">{currentComparison.specItem.article}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Требуется</div>
                <div className="font-semibold">{currentComparison.specItem.quantity} {currentComparison.specItem.unit}</div>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label>Поиск на складе</Label>
            <div className="flex gap-2">
              <Input
                value={currentComparison.searchQuery || ""}
                onChange={(e) => handleSearch(currentIndex, e.target.value)}
                placeholder="Введите название или артикул"
                className="flex-1"
              />
              <Button variant="outline" disabled>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Warehouse Matches */}
          <div className="space-y-2">
            <Label>Результаты на складе ({currentComparison.warehouseMatches.length})</Label>

            {currentComparison.warehouseMatches.length === 0 ? (
              <div className="text-center py-8 border rounded-lg bg-slate-50 dark:bg-slate-900">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-muted-foreground">Не найдено на складе</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => handleMarkNeedsToProcure(currentIndex)}
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Отметить для закупки
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Название</TableHead>
                      <TableHead className="w-[20%]">SKU</TableHead>
                      <TableHead className="w-[15%]">Наличие</TableHead>
                      <TableHead className="w-[25%]">Действие</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentComparison.warehouseMatches.map((wItem) => {
                      const quantity = parseFloat(String(wItem.quantity));
                      const isSelected = currentComparison.selectedWarehouseItem?.id === wItem.id;
                      const isAlternative = currentComparison.alternativeItem?.id === wItem.id;
                      const hasEnough = quantity >= currentComparison.specItem.quantity;

                      return (
                        <TableRow key={wItem.id} className={isSelected || isAlternative ? "bg-green-50 dark:bg-green-950/20" : ""}>
                          <TableCell>
                            <div className="font-medium">{wItem.name}</div>
                            {wItem.description && (
                              <div className="text-xs text-muted-foreground">{wItem.description}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                              {wItem.sku}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant={hasEnough ? "default" : "destructive"} className={hasEnough ? "bg-green-500" : ""}>
                              {quantity} {wItem.unit}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {isSelected ? (
                                <Badge className="bg-green-600">
                                  <Check className="w-3 h-3 mr-1" />
                                  Выбрано
                                </Badge>
                              ) : isAlternative ? (
                                <Badge variant="outline" className="bg-blue-50">
                                  <Check className="w-3 h-3 mr-1" />
                                  Аналог
                                </Badge>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSelectWarehouseItem(currentIndex, wItem)}
                                  >
                                    Выбрать
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleSelectAlternative(currentIndex, wItem)}
                                  >
                                    Как аналог
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Selection Status */}
          {(currentComparison.selectedWarehouseItem || currentComparison.alternativeItem) && (
            <div className={`p-4 border rounded-lg ${hasEnoughStock ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-orange-50 dark:bg-orange-950/20 border-orange-200"}`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    {currentComparison.alternativeItem ? "Выбран аналог" : "Найдено на складе"}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Доступно: {availableQuantity} {currentComparison.specItem.unit}
                    {!hasEnoughStock && " (недостаточно, нужно закупить)"}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkNeedsToProcure(currentIndex)}
                >
                  <X className="w-4 h-4" />
                  Отменить
                </Button>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentIndex === 0}
            >
              Предыдущая
            </Button>
            <div className="flex gap-2">
              {currentIndex === comparisons.length - 1 ? (
                <Button onClick={handleComplete}>
                  Завершить сравнение
                </Button>
              ) : (
                <Button onClick={handleNext}>
                  Следующая
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
