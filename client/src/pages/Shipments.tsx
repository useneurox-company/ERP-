import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
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

export default function Shipments() {
  const [, setLocation] = useLocation();
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "confirmed" | "cancelled">("all");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shipmentToDelete, setShipmentToDelete] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shipments = [] } = useQuery<any[]>({
    queryKey: ["/api/shipments"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (shipmentId: string) => {
      const currentUser = localStorage.getItem("currentUserId") || "user-1";
      return await apiRequest("DELETE", `/api/shipments/${shipmentId}`, undefined, {
        headers: { "X-User-Id": currentUser },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({ title: "Накладная удалена" });
      setDeleteDialogOpen(false);
      setShipmentToDelete(null);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
      setDeleteDialogOpen(false);
      setShipmentToDelete(null);
    },
  });

  const handleDeleteClick = (shipment: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setShipmentToDelete(shipment);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (shipmentToDelete) {
      deleteMutation.mutate(shipmentToDelete.id);
    }
  };

  const filteredShipments = statusFilter === "all"
    ? shipments
    : shipments.filter((s) => s.status === statusFilter);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Накладные</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Архив всех отгрузок товаров
          </p>
        </div>
        <Button onClick={() => setLocation("/shipments/new")}>
          <Plus className="h-4 w-4 mr-2" />
          Новая отгрузка
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Все ({shipments.length})</TabsTrigger>
          <TabsTrigger value="draft">
            Черновики ({shipments.filter((s) => s.status === "draft").length})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            Подтверждено ({shipments.filter((s) => s.status === "confirmed").length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            Отменено ({shipments.filter((s) => s.status === "cancelled").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="mt-6">
          {filteredShipments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
              Нет накладных
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Номер</TableHead>
                    <TableHead>Проект</TableHead>
                    <TableHead>Кладовщик</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата создания</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShipments.map((shipment) => (
                    <TableRow
                      key={shipment.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setLocation(`/shipments/${shipment.id}`)}
                    >
                      <TableCell className="font-mono font-semibold">
                        {shipment.shipment_number}
                      </TableCell>
                      <TableCell>{shipment.project_name}</TableCell>
                      <TableCell>{shipment.warehouse_keeper}</TableCell>
                      <TableCell>{getStatusBadge(shipment.status)}</TableCell>
                      <TableCell>
                        {format(new Date(shipment.created_at), "dd MMM yyyy HH:mm", {
                          locale: ru,
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/shipments/${shipment.id}`);
                            }}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          {(shipment.status === "draft" || shipment.status === "cancelled") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDeleteClick(shipment, e)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить накладную?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить накладную{" "}
              <span className="font-mono font-semibold">{shipmentToDelete?.shipment_number}</span>?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
