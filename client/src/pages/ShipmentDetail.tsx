import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Printer,
  XCircle,
  FileText,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
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

export default function ShipmentDetail() {
  const [, params] = useRoute("/shipments/:id");
  const [, setLocation] = useLocation();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const shipmentId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shipment, isLoading } = useQuery({
    queryKey: [`/api/shipments/${shipmentId}`],
    enabled: !!shipmentId,
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const currentUser = localStorage.getItem("currentUserId") || "user-1";
      return await apiRequest("POST", `/api/shipments/${shipmentId}/cancel`, {
        user_id: currentUser,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/shipments/${shipmentId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      toast({ title: "Отгрузка отменена", description: "Товары возвращены на склад" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const currentUser = localStorage.getItem("currentUserId") || "user-1";
      return await apiRequest("DELETE", `/api/shipments/${shipmentId}`, undefined, {
        headers: { "X-User-Id": currentUser },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({ title: "Накладная удалена" });
      setLocation("/shipments");
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      setDeleteDialogOpen(false);
    },
  });

  const handlePrint = () => {
    window.print();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Черновик</Badge>;
      case "confirmed":
        return <Badge className="bg-green-500">Подтверждено</Badge>;
      case "cancelled":
        return <Badge variant="destructive">Отменено</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return <div className="container max-w-4xl mx-auto py-6">Загрузка...</div>;
  }

  if (!shipment) {
    return (
      <div className="container max-w-4xl mx-auto py-6">
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Накладная не найдена</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      {/* Шапка - скрывается при печати */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" onClick={() => setLocation("/shipments")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          К списку накладных
        </Button>
        <div className="flex gap-2">
          {shipment.status === "confirmed" && (
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Отменить отгрузку
            </Button>
          )}
          {(shipment.status === "draft" || shipment.status === "cancelled") && (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить накладную
            </Button>
          )}
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Печать
          </Button>
        </div>
      </div>

      {/* Сама накладная - для печати */}
      <div className="border rounded-lg p-8 bg-white print:border-0">
        {/* Заголовок */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">ТОВАРНАЯ НАКЛАДНАЯ</h1>
          <p className="text-xl font-mono">{shipment.shipment_number}</p>
        </div>

        {/* Информация о накладной */}
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-sm text-muted-foreground">Дата создания:</p>
            <p className="font-semibold">
              {format(new Date(shipment.created_at), "dd MMMM yyyy, HH:mm", {
                locale: ru,
              })}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Статус:</p>
            <div className="mt-1">{getStatusBadge(shipment.status)}</div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Проект:</p>
            <p className="font-semibold">{shipment.project_name}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Кладовщик:</p>
            <p className="font-semibold">{shipment.warehouse_keeper}</p>
          </div>

          {shipment.delivery_address && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Адрес доставки:</p>
              <p className="font-semibold">{shipment.delivery_address}</p>
            </div>
          )}

          {shipment.notes && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Комментарий:</p>
              <p>{shipment.notes}</p>
            </div>
          )}
        </div>

        {/* Таблица товаров */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Перечень товаров:</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">№</TableHead>
                <TableHead>Наименование</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead className="text-center">Тип</TableHead>
                <TableHead className="text-right">Количество</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipment.items?.map((item: any, index: number) => (
                <TableRow key={item.id}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{item.item_name}</TableCell>
                  <TableCell className="font-mono text-xs">{item.item_sku || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={item.is_package ? "secondary" : "outline"}>
                      {item.is_package ? "Упаковка" : "Товар"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {item.quantity} {item.unit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 text-right">
            <p className="font-semibold">
              Всего позиций: {shipment.items?.length || 0}
            </p>
          </div>
        </div>

        {/* Детали упаковок */}
        {shipment.items?.some((item: any) => item.is_package && item.package_details) && (
          <div className="mb-8 border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Состав упаковок:</h2>
            {shipment.items
              .filter((item: any) => item.is_package && item.package_details)
              .map((item: any) => {
                const details = JSON.parse(item.package_details);
                return (
                  <div key={item.id} className="mb-4">
                    <p className="font-semibold mb-2">{item.item_name}:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      {details.map((detail: any, idx: number) => (
                        <li key={idx}>
                          {detail.name} — {detail.quantity} шт.
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        )}

        {/* Подписи */}
        <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Отпустил (кладовщик):</p>
            <div className="border-b border-black pb-1 mb-2 h-12"></div>
            <p className="text-sm">
              ______________ / {shipment.warehouse_keeper}
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Получил (водитель):</p>
            <div className="border-b border-black pb-1 mb-2 h-12"></div>
            <p className="text-sm">______________ / _______________</p>
          </div>
        </div>

        {/* Дата подтверждения */}
        {shipment.confirmed_at && (
          <div className="mt-8 text-sm text-muted-foreground text-center">
            Подтверждено:{" "}
            {format(new Date(shipment.confirmed_at), "dd.MM.yyyy HH:mm", {
              locale: ru,
            })}
          </div>
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить накладную?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить накладную{" "}
              <span className="font-mono font-semibold">{shipment.shipment_number}</span>?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
