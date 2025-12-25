import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, QrCode, Plus, ArrowUp, ArrowDown, Lock, CheckCircle, XCircle } from "lucide-react";
import { insertWarehouseItemSchema, type WarehouseItem, type WarehouseTransaction, type User, type WarehouseReservation, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { WarehouseTransactionDialog } from "./WarehouseTransactionDialog";
import { QRCodeDialog } from "./QRCodeDialog";
import { FormDescription } from "@/components/ui/form";

interface WarehouseItemDetailSheetProps {
  item: WarehouseItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
}

export function WarehouseItemDetailSheet({ item, open, onOpenChange, currentUserId }: WarehouseItemDetailSheetProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const { toast } = useToast();

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<WarehouseTransaction[]>({
    queryKey: ["/api/warehouse/items", item?.id, "transactions"],
    enabled: !!item?.id,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: reservations = [], isLoading: reservationsLoading } = useQuery<WarehouseReservation[]>({
    queryKey: ["/api/warehouse/items", item?.id, "reservations"],
    enabled: !!item?.id,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const form = useForm({
    resolver: zodResolver(insertWarehouseItemSchema),
    defaultValues: {
      name: item?.name || "",
      sku: item?.sku || "",
      quantity: item?.quantity ?? 0,
      unit: item?.unit || "шт",
      price: item?.price ?? 0,
      location: item?.location || "",
      category: item?.category || "materials",
      supplier: item?.supplier || "",
      description: item?.description || "",
      min_stock: item?.min_stock ?? 0,
      track_min_stock: item?.track_min_stock || false,
      status: item?.status || "normal",
      project_id: item?.project_id || null,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name || "",
        sku: item.sku || "",
        quantity: item.quantity ?? 0,
        unit: item.unit || "шт",
        price: item.price ?? 0,
        location: item.location || "",
        category: item.category || "materials",
        supplier: item.supplier || "",
        description: item.description || "",
        min_stock: item.min_stock ?? 0,
        track_min_stock: item.track_min_stock || false,
        status: item.status || "normal",
        project_id: item.project_id || null,
      });
    }
  }, [item, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const itemData = {
        ...data,
        sku: data.sku || null,
        quantity: Number(data.quantity) || 0,
        price: Number(data.price) || 0,
        location: data.location || null,
        supplier: data.supplier || null,
        description: data.description || null,
        min_stock: Number(data.min_stock) || 0,
        track_min_stock: data.track_min_stock || false,
        project_id: data.project_id || null,
      };
      await apiRequest("PUT", `/api/warehouse/items/${item?.id}`, itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items", item?.id] });
      toast({
        title: "Успешно",
        description: "Позиция обновлена",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/warehouse/items/${item?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      toast({
        title: "Успешно",
        description: "Позиция удалена",
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const confirmReservationMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      await apiRequest("PATCH", `/api/warehouse/reservations/${reservationId}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items", item?.id, "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      toast({
        title: "Успешно",
        description: "Резерв подтверждён",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const releaseReservationMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      await apiRequest("PATCH", `/api/warehouse/reservations/${reservationId}/release`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items", item?.id, "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      toast({
        title: "Успешно",
        description: "Резерв снят",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelReservationMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      await apiRequest("PATCH", `/api/warehouse/reservations/${reservationId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items", item?.id, "reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      toast({
        title: "Успешно",
        description: "Резерв отменён",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    updateMutation.mutate(data);
  });

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const getStatusBadge = (status: "normal" | "low" | "critical") => {
    const config = {
      normal: { label: "Норма", variant: "outline" as const },
      low: { label: "Низкий остаток", variant: "secondary" as const },
      critical: { label: "Критический", variant: "destructive" as const },
    };
    return config[status];
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.full_name || user?.username || "Неизвестно";
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getProjectName = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return project?.name || "Неизвестный проект";
  };

  const getReservationStatusBadge = (status: string) => {
    const config = {
      pending: { label: "Ожидание", variant: "secondary" as const, color: "text-yellow-600" },
      confirmed: { label: "Подтверждён", variant: "default" as const, color: "text-blue-600" },
      released: { label: "Снят", variant: "outline" as const, color: "text-green-600" },
      cancelled: { label: "Отменён", variant: "outline" as const, color: "text-gray-500" },
    };
    return config[status as keyof typeof config] || config.pending;
  };

  const activeReservations = reservations.filter(r => r.status === 'pending' || r.status === 'confirmed');
  const totalReserved = activeReservations.reduce((sum, r) => sum + Number(r.quantity), 0);

  const statusConfig = item ? getStatusBadge(item.status as "normal" | "low" | "critical") : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle data-testid="text-warehouse-sheet-title">Детали позиции</SheetTitle>
            <SheetDescription data-testid="text-warehouse-sheet-description">
              Редактирование позиции на складе
            </SheetDescription>
          </SheetHeader>

          {item && (
            <div className="mt-4 space-y-3">
              <Card>
                <CardContent className="pt-4">
                  <h3 className="font-semibold mb-3">Основная информация</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">Название:</div>
                    <div className="font-medium">{item.name}</div>

                    {item.sku && (
                      <>
                        <div className="text-muted-foreground">Артикул:</div>
                        <div className="font-mono">{item.sku}</div>
                      </>
                    )}

                    {item.barcode && (
                      <>
                        <div className="text-muted-foreground">Штрихкод:</div>
                        <div className="font-mono text-xs">{item.barcode}</div>
                      </>
                    )}

                    <div className="text-muted-foreground">Категория:</div>
                    <div>{item.category === 'materials' ? 'Материал' : 'Готовое изделие'}</div>

                    {item.category === 'products' && (
                      <>
                        <div className="text-muted-foreground">Проект:</div>
                        <div className="font-medium">
                          {item.project_id ? getProjectName(item.project_id) :
                            <span className="text-muted-foreground">Не привязан</span>
                          }
                        </div>
                      </>
                    )}

                    <div className="text-muted-foreground">Количество:</div>
                    <div className="font-semibold">{item.quantity} {item.unit}</div>

                    {item.price !== null && item.price !== undefined && Number(item.price) > 0 && (
                      <>
                        <div className="text-muted-foreground">Цена:</div>
                        <div>{item.price} ₽/{item.unit}</div>

                        <div className="text-muted-foreground">Общая стоимость:</div>
                        <div className="font-semibold">{(Number(item.price) * Number(item.quantity)).toFixed(2)} ₽</div>
                      </>
                    )}

                    {item.location && (
                      <>
                        <div className="text-muted-foreground">Расположение:</div>
                        <div>{item.location}</div>
                      </>
                    )}

                    {item.supplier && (
                      <>
                        <div className="text-muted-foreground">Поставщик:</div>
                        <div>{item.supplier}</div>
                      </>
                    )}

                    <div className="text-muted-foreground">Мин. остаток:</div>
                    <div>{item.min_stock} {item.unit}</div>

                    <div className="text-muted-foreground">Статус:</div>
                    <div>
                      <Badge variant={statusConfig?.variant} data-testid="badge-warehouse-status">
                        {statusConfig?.label}
                      </Badge>
                    </div>
                  </div>

                  {item.description && (
                    <div className="pt-3 mt-3 border-t">
                      <div className="text-sm text-muted-foreground mb-1">Описание:</div>
                      <div className="text-sm bg-muted p-3 rounded-md">{item.description}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {item && item.category === 'materials' && (
            <Card className="mt-3">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-orange-600" />
                    <CardTitle className="text-base">Резервы материала</CardTitle>
                  </div>
                  {activeReservations.length > 0 && (
                    <Badge variant="secondary" className="text-orange-600">
                      {totalReserved} {item.unit}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {reservationsLoading ? (
                  <div className="text-sm text-muted-foreground">Загрузка резервов...</div>
                ) : reservations.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Нет резервов</div>
                ) : (
                  <div className="space-y-2">
                    {reservations
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((reservation) => {
                        const statusBadge = getReservationStatusBadge(reservation.status);
                        return (
                          <div
                            key={reservation.id}
                            className="flex flex-col gap-2 p-3 border rounded-md bg-muted/30"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-sm">
                                    {getProjectName(reservation.project_id)}
                                  </p>
                                  <Badge variant={statusBadge.variant} className="text-xs">
                                    {statusBadge.label}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Количество: <span className="font-semibold text-orange-600">{reservation.quantity} {item.unit}</span>
                                </p>
                                {reservation.reason && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Причина: {reservation.reason}
                                  </p>
                                )}
                                {reservation.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Заметки: {reservation.notes}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {reservation.reserved_by ? getUserName(reservation.reserved_by) + " • " : ""}
                                  {formatDate(reservation.created_at)}
                                </p>
                              </div>
                              <div className="flex flex-col gap-1">
                                {reservation.status === 'pending' && (
                                  <>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => confirmReservationMutation.mutate(reservation.id)}
                                      disabled={confirmReservationMutation.isPending}
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Подтвердить
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => cancelReservationMutation.mutate(reservation.id)}
                                      disabled={cancelReservationMutation.isPending}
                                    >
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Отменить
                                    </Button>
                                  </>
                                )}
                                {reservation.status === 'confirmed' && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => releaseReservationMutation.mutate(reservation.id)}
                                    disabled={releaseReservationMutation.isPending}
                                  >
                                    Снять резерв
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Название позиции"
                        data-testid="input-warehouse-item-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Артикул (опционально)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Артикул товара"
                        data-testid="input-warehouse-item-sku"
                      />
                    </FormControl>
                    <FormDescription>Уникальный код товара для идентификации</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Цена за единицу</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        data-testid="input-warehouse-item-price"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                      />
                    </FormControl>
                    <FormDescription>Цена в рублях за единицу измерения</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Количество</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          data-testid="input-warehouse-item-quantity"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Единица</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-warehouse-item-unit">
                            <SelectValue placeholder="Выберите единицу" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="шт" data-testid="option-item-unit-pc">шт</SelectItem>
                          <SelectItem value="кг" data-testid="option-item-unit-kg">кг</SelectItem>
                          <SelectItem value="м" data-testid="option-item-unit-m">м</SelectItem>
                          <SelectItem value="м²" data-testid="option-item-unit-m2">м²</SelectItem>
                          <SelectItem value="л" data-testid="option-item-unit-l">л</SelectItem>
                          <SelectItem value="уп" data-testid="option-item-unit-pack">уп</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Местоположение</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Например: Стеллаж А-1" 
                        data-testid="input-warehouse-item-location"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Категория</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-warehouse-item-category">
                          <SelectValue placeholder="Выберите категорию" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="materials" data-testid="option-item-category-materials">
                          Материалы
                        </SelectItem>
                        <SelectItem value="products" data-testid="option-item-category-products">
                          Готовая продукция
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {form.watch("category") === "products" && (
                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Проект (опционально)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-warehouse-item-project">
                            <SelectValue placeholder="Выберите проект" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Без проекта</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name} {project.client_name ? `(${project.client_name})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Привязка готовой продукции к проекту
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="track_min_stock"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox
                        checked={Boolean(field.value)}
                        onCheckedChange={field.onChange}
                        data-testid="checkbox-warehouse-item-track-min-stock"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>
                        Отслеживать минимальный остаток
                      </FormLabel>
                      <FormDescription>
                        Получать уведомление, когда остаток товара опускается ниже минимального
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />

              {form.watch("track_min_stock") && (
                <FormField
                  control={form.control}
                  name="min_stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Минимальный остаток</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          data-testid="input-warehouse-item-min-stock"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                        />
                      </FormControl>
                      <FormDescription>Укажите минимальное количество для отслеживания</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Поставщик (опционально)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Название поставщика"
                        data-testid="input-warehouse-item-supplier"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание (опционально)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Дополнительная информация о товаре"
                        className="resize-none"
                        rows={3}
                        data-testid="textarea-warehouse-item-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormLabel>QR код</FormLabel>
                <div className="flex items-center gap-2 p-3 border rounded-md bg-muted">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium" data-testid="text-warehouse-qr-code">
                      QR: {item?.id}
                    </p>
                    <p className="text-xs text-muted-foreground">Идентификатор позиции</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQRDialog(true)}
                  >
                    <QrCode className="h-4 w-4 mr-1" />
                    Показать
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-warehouse-item"
                >
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-warehouse-item"
                >
                  Удалить
                </Button>
              </div>
            </form>
          </Form>

          <Card className="mt-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">История транзакций</CardTitle>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowTransactionDialog(true)}
                  data-testid="button-add-transaction"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Транзакция
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {transactionsLoading ? (
                <div className="text-sm text-muted-foreground" data-testid="text-transactions-loading">
                  Загрузка транзакций...
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-sm text-muted-foreground" data-testid="text-no-transactions">
                  Нет транзакций
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 10)
                    .map((transaction, index) => (
                      <div 
                        key={transaction.id} 
                        className="flex items-center gap-3 p-3 border rounded-md"
                        data-testid={`transaction-item-${index}`}
                      >
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          transaction.type === "in" 
                            ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                        }`}>
                          {transaction.type === "in" ? (
                            <ArrowDown className="h-4 w-4" />
                          ) : (
                            <ArrowUp className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm" data-testid={`transaction-quantity-${index}`}>
                              {transaction.type === "in" ? "+" : "-"}{transaction.quantity} {item?.unit}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {transaction.type === "in" ? "Приход" : "Расход"}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getUserName(transaction.user_id)} • {formatDate(transaction.created_at)}
                          </p>
                          {transaction.notes && (
                            <p className="text-xs text-muted-foreground mt-1" data-testid={`transaction-notes-${index}`}>
                              {transaction.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-warehouse-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-warehouse-delete-title">
              Подтвердите удаление
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-warehouse-delete-description">
              Вы уверены, что хотите удалить эту позицию? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-warehouse-delete">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-warehouse-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {item && (
        <WarehouseTransactionDialog
          open={showTransactionDialog}
          onOpenChange={setShowTransactionDialog}
          itemId={item.id}
          currentUserId={currentUserId}
        />
      )}

      <QRCodeDialog
        open={showQRDialog}
        onOpenChange={setShowQRDialog}
        item={item}
      />
    </>
  );
}
