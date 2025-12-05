import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { QRScanner } from "@/components/QRScanner";
import { ScanLine, Trash2, CheckCircle, ArrowLeft, Plus } from "lucide-react";
import type { WarehouseItem, Project } from "@shared/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ScannedItem {
  id: string;
  name: string;
  sku: string;
  category?: string;
  quantity: number;
  maxQuantity: number;
  unit: string;
}

export default function ShipmentScanner() {
  const [, setLocation] = useLocation();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isManualAddOpen, setIsManualAddOpen] = useState(false);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [shipmentId, setShipmentId] = useState<string | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [projectName, setProjectName] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [warehouseKeeper, setWarehouseKeeper] = useState("");
  const [notes, setNotes] = useState("");

  const { toast } = useToast();

  const { data: items = [] } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items"],
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 15000, // Real-time: обновление каждые 15 секунд
  });

  // Создание накладной
  const createShipmentMutation = useMutation({
    mutationFn: async () => {
      const currentUser = localStorage.getItem("currentUserId") || "user-1";

      return await apiRequest("POST", "/api/shipments", {
        project_name: projectName,
        delivery_address: deliveryAddress,
        warehouse_keeper: warehouseKeeper,
        notes,
        created_by: currentUser,
      });
    },
    onSuccess: (data) => {
      setShipmentId(data.id);
      toast({ title: "Накладная создана", description: `Номер: ${data.shipment_number}` });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Обработка сканирования - открывает диалог выбора количества
  const handleScan = async (qrCode: string) => {
    if (!shipmentId) {
      toast({ title: "Ошибка", description: "Сначала создайте накладную", variant: "destructive" });
      return;
    }

    // Ищем товар по QR
    const item = items.find((i) => i.barcode === qrCode || i.id === qrCode);

    if (!item) {
      toast({ title: "Товар не найден", description: "QR-код не распознан", variant: "destructive" });
      return;
    }

    // Проверяем что товар есть в наличии
    if (parseFloat(item.quantity.toString()) <= 0) {
      toast({
        title: "Ошибка",
        description: "Товар отсутствует на складе",
        variant: "destructive",
      });
      return;
    }

    // Открываем диалог выбора количества
    openQuantityDialog(item);
    setIsScannerOpen(false);
  };

  // Посчитать уже добавленное количество товара в накладную
  const getAlreadyAddedQuantity = (itemId: string) => {
    return scannedItems
      .filter(item => item.id === itemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Посчитать доступное количество (на складе минус уже добавленное)
  const getAvailableQuantity = (item: WarehouseItem) => {
    const stockQty = parseFloat(item.quantity.toString());
    const addedQty = getAlreadyAddedQuantity(item.id);
    return stockQty - addedQty;
  };

  // Открыть диалог выбора количества
  const openQuantityDialog = (item: WarehouseItem) => {
    const available = getAvailableQuantity(item);
    if (available <= 0) {
      toast({
        title: "Ошибка",
        description: "Весь доступный товар уже добавлен в накладную",
        variant: "destructive",
      });
      return;
    }
    setSelectedItem(item);
    setSelectedQuantity(1);
    setIsQuantityDialogOpen(true);
  };

  // Получить доступное количество для выбранного товара
  const selectedItemAvailable = selectedItem ? getAvailableQuantity(selectedItem) : 0;

  // Подтвердить добавление с выбранным количеством
  const confirmAddItem = async () => {
    if (!shipmentId || !selectedItem) return;

    const maxQty = selectedItemAvailable;
    if (selectedQuantity <= 0 || selectedQuantity > maxQty) {
      toast({
        title: "Ошибка",
        description: `Укажите количество от 1 до ${maxQty}`,
        variant: "destructive",
      });
      return;
    }

    try {
      // Добавляем в накладную
      await apiRequest("POST", `/api/shipments/${shipmentId}/items`, {
        item_id: selectedItem.id,
        quantity: selectedQuantity,
      });

      // Обновляем локальный список
      const newItem: ScannedItem = {
        id: selectedItem.id,
        name: selectedItem.name,
        sku: selectedItem.sku,
        category: selectedItem.category_id || undefined,
        quantity: selectedQuantity,
        maxQuantity: maxQty,
        unit: selectedItem.unit,
      };
      setScannedItems([...scannedItems, newItem]);

      toast({ title: "Добавлено", description: `${selectedItem.name} × ${selectedQuantity}` });
      setIsQuantityDialogOpen(false);
      setIsManualAddOpen(false);
      setSelectedItem(null);
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    }
  };

  // Удалить позицию
  const handleRemoveItem = async (itemId: string) => {
    if (!shipmentId) return;

    try {
      await apiRequest("DELETE", `/api/shipments/${shipmentId}/items/${itemId}`);
      setScannedItems(scannedItems.filter((item) => item.id !== itemId));
      toast({ title: "Удалено" });
    } catch (error: any) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    }
  };

  // Ручное добавление товара - открывает диалог выбора количества
  const handleManualAdd = (item: WarehouseItem) => {
    if (!shipmentId) return;
    openQuantityDialog(item);
  };

  // Подтвердить отгрузку
  const confirmShipmentMutation = useMutation({
    mutationFn: async () => {
      if (!shipmentId) throw new Error("Накладная не создана");
      const currentUser = localStorage.getItem("currentUserId") || "user-1";

      return await apiRequest("POST", `/api/shipments/${shipmentId}/confirm`, {
        user_id: currentUser,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({ title: "Отгрузка подтверждена", description: "Товары списаны со склада" });

      // Переход на страницу печати накладной
      setLocation(`/shipments/${shipmentId}`);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleStartShipment = () => {
    if (!projectName || !warehouseKeeper) {
      toast({
        title: "Заполните обязательные поля",
        description: "Проект и ФИО кладовщика обязательны",
        variant: "destructive",
      });
      return;
    }

    createShipmentMutation.mutate();
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      {/* Шапка */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Назад
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Новая отгрузка</h1>
          <p className="text-sm text-muted-foreground">
            Сканируйте QR-коды товаров и упаковок
          </p>
        </div>
      </div>

      {/* Форма создания накладной */}
      {!shipmentId && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="space-y-2">
            <Label>Проект *</Label>
            <Select value={projectName} onValueChange={setProjectName}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.name}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Адрес доставки</Label>
            <Input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="ул. Примерная, д. 123"
            />
          </div>

          <div className="space-y-2">
            <Label>ФИО кладовщика *</Label>
            <Input
              value={warehouseKeeper}
              onChange={(e) => setWarehouseKeeper(e.target.value)}
              placeholder="Иванов Иван Иванович"
            />
          </div>

          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительная информация"
              rows={2}
            />
          </div>

          <Button onClick={handleStartShipment} className="w-full">
            Создать накладную и начать сканирование
          </Button>
        </div>
      )}

      {/* Сканирование */}
      {shipmentId && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Отсканировано: {scannedItems.length} поз.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsManualAddOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить вручную
              </Button>
              <Button onClick={() => setIsScannerOpen(true)}>
                <ScanLine className="h-4 w-4 mr-2" />
                Сканировать QR
              </Button>
            </div>
          </div>

          {/* Список отсканированных товаров */}
          {scannedItems.length > 0 ? (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Название</TableHead>
                    <TableHead>Артикул</TableHead>
                    <TableHead className="text-center">Количество</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scannedItems.map((item, index) => (
                    <TableRow key={`${item.id}-${index}`}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">
                          {item.quantity} {item.unit}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
              Начните сканировать QR-коды товаров
            </div>
          )}

          {/* Кнопки действий */}
          {scannedItems.length > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={() => confirmShipmentMutation.mutate()}
                className="flex-1"
                disabled={confirmShipmentMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {confirmShipmentMutation.isPending
                  ? "Подтверждение..."
                  : "Подтвердить отгрузку"}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Сканер */}
      <QRScanner open={isScannerOpen} onOpenChange={setIsScannerOpen} onScanSuccess={handleScan} />

      {/* Диалог ручного добавления товара */}
      <Dialog open={isManualAddOpen} onOpenChange={setIsManualAddOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить товар в отгрузку</DialogTitle>
            <DialogDescription>
              Выберите товар из списка для добавления в отгрузку
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {items
              .filter((item) => getAvailableQuantity(item) > 0)
              .map((item) => {
                const available = getAvailableQuantity(item);
                const added = getAlreadyAddedQuantity(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted cursor-pointer"
                    onClick={() => handleManualAdd(item)}
                  >
                    <div className="flex-1">
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.sku} • Доступно: {available} {item.unit}
                        {added > 0 && (
                          <span className="text-yellow-600 ml-2">
                            (в накладной: {added})
                          </span>
                        )}
                        {item.package_details && (
                          <Badge variant="secondary" className="ml-2">
                            Упаковка
                          </Badge>
                        )}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            {items.filter((item) => getAvailableQuantity(item) > 0)
              .length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Нет доступных товаров для отгрузки
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог выбора количества */}
      <Dialog open={isQuantityDialogOpen} onOpenChange={setIsQuantityDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Укажите количество</DialogTitle>
            <DialogDescription>
              {selectedItem?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Количество для отгрузки</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedQuantity(Math.max(1, selectedQuantity - 1))}
                  disabled={selectedQuantity <= 1}
                >
                  -
                </Button>
                <Input
                  type="number"
                  min={1}
                  max={selectedItemAvailable}
                  value={selectedQuantity}
                  onChange={(e) => setSelectedQuantity(Math.min(parseInt(e.target.value) || 1, selectedItemAvailable))}
                  className="text-center w-24"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedQuantity(Math.min(selectedItemAvailable, selectedQuantity + 1))}
                  disabled={selectedQuantity >= selectedItemAvailable}
                >
                  +
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Доступно: {selectedItemAvailable} {selectedItem?.unit}
                {getAlreadyAddedQuantity(selectedItem?.id || '') > 0 && (
                  <span className="text-yellow-600 ml-2">
                    (уже добавлено: {getAlreadyAddedQuantity(selectedItem?.id || '')})
                  </span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setIsQuantityDialogOpen(false);
                  setSelectedItem(null);
                }}
              >
                Отмена
              </Button>
              <Button className="flex-1" onClick={confirmAddItem}>
                Добавить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
