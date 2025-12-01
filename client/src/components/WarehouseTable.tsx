import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Package, AlertTriangle, CheckCircle2, QrCode, Trash2, Lock } from "lucide-react";
import type { WarehouseItem, Project } from "@shared/schema";

interface WarehouseTableProps {
  items: WarehouseItem[];
  onItemClick: (item: WarehouseItem) => void;
  onShowQR: (item: WarehouseItem) => void;
  onDeleteItems: (itemIds: string[]) => void;
  onReserve: (item: WarehouseItem) => void;
  selectedItems: string[];
  onSelectItems: (itemIds: string[]) => void;
  projects?: Project[];
}

export function WarehouseTable({
  items,
  onItemClick,
  onShowQR,
  onDeleteItems,
  onReserve,
  selectedItems,
  onSelectItems,
  projects = [],
}: WarehouseTableProps) {
  const [sortColumn, setSortColumn] = useState<keyof WarehouseItem>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: keyof WarehouseItem) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];

    if (aVal === null || aVal === undefined) return 1;
    if (bVal === null || bVal === undefined) return -1;

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();

    if (sortDirection === "asc") {
      return aStr.localeCompare(bStr, "ru");
    } else {
      return bStr.localeCompare(aStr, "ru");
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "low":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "critical":
        return "Критический";
      case "low":
        return "Низкий";
      default:
        return "Норма";
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectItems(sortedItems.map(item => item.id));
    } else {
      onSelectItems([]);
    }
  };

  const handleSelectItem = (itemId: string, checked: boolean) => {
    if (checked) {
      onSelectItems([...selectedItems, itemId]);
    } else {
      onSelectItems(selectedItems.filter(id => id !== itemId));
    }
  };

  const allSelected = sortedItems.length > 0 && selectedItems.length === sortedItems.length;
  const someSelected = selectedItems.length > 0 && selectedItems.length < sortedItems.length;

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return null;
    const project = projects.find(p => p.id === projectId);
    return project?.name || "Неизвестный проект";
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleSelectAll}
                aria-label="Выбрать все"
                className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
              />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("sku")}
            >
              Артикул {sortColumn === "sku" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("name")}
            >
              Название {sortColumn === "name" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 text-right"
              onClick={() => handleSort("quantity")}
            >
              Всего {sortColumn === "quantity" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="text-right">Резервы/Проект</TableHead>
            <TableHead className="text-right">Доступно</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50 text-right"
              onClick={() => handleSort("price")}
            >
              Цена {sortColumn === "price" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="text-right">Сумма</TableHead>
            <TableHead>Категория</TableHead>
            <TableHead>Местоположение</TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort("status")}
            >
              Статус {sortColumn === "status" && (sortDirection === "asc" ? "↑" : "↓")}
            </TableHead>
            <TableHead className="text-right">Действия</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                Нет товаров для отображения
              </TableCell>
            </TableRow>
          ) : (
            sortedItems.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onItemClick(item)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedItems.includes(item.id)}
                    onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                    aria-label={`Выбрать ${item.name}`}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {item.sku || "-"}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    {item.name}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-semibold">{item.quantity}</span> {item.unit}
                </TableCell>
                <TableCell className="text-right">
                  {item.category === 'materials' ? (
                    item.reserved_quantity && parseFloat(String(item.reserved_quantity)) > 0 ? (
                      <span className="text-orange-600 font-medium flex items-center justify-end gap-1">
                        <Lock className="h-3 w-3" />
                        {parseFloat(String(item.reserved_quantity))} {item.unit}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )
                  ) : (
                    getProjectName(item.project_id) ? (
                      <span className="text-blue-600 font-medium">{getProjectName(item.project_id)}</span>
                    ) : (
                      <span className="text-muted-foreground">Не привязан</span>
                    )
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {item.category === 'materials' ? (
                    (() => {
                      const available = parseFloat(String(item.quantity)) - parseFloat(String(item.reserved_quantity || 0));
                      return (
                        <span className={`font-medium ${available <= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {available} {item.unit}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {item.price && parseFloat(item.price.toString()) > 0 ? (
                    <span>{parseFloat(item.price.toString()).toLocaleString("ru-RU")} ₽</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {item.price && parseFloat(item.price.toString()) > 0 ? (
                    <span>
                      {(parseFloat(item.price.toString()) * parseFloat(item.quantity.toString())).toLocaleString("ru-RU")} ₽
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {item.category === "materials" ? "Материал" : "Изделие"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.location || "-"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(item.status)}
                    <span className="text-sm">{getStatusText(item.status)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1">
                    {item.category === 'materials' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReserve(item)}
                        title="Зарезервировать"
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      >
                        <Lock className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onShowQR(item)}
                      title="Показать QR-код"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onItemClick(item)}
                      title="Подробнее"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteItems([item.id])}
                      title="Удалить"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
