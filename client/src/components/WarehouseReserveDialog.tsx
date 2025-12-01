import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WarehouseItem, Project } from "@shared/schema";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface WarehouseReserveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: WarehouseItem | null;
  userId: string;
}

export function WarehouseReserveDialog({
  open,
  onOpenChange,
  item,
  userId,
}: WarehouseReserveDialogProps) {
  const { toast } = useToast();
  const [projectId, setProjectId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Загрузка списка проектов
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  // Сброс формы при открытии
  useEffect(() => {
    if (open) {
      setProjectId("");
      setQuantity("");
      setReason("");
      setNotes("");
    }
  }, [open]);

  // Доступное количество
  const availableQuantity = item
    ? parseFloat(String(item.quantity)) - parseFloat(String(item.reserved_quantity || 0))
    : 0;

  // Мутация для создания резерва
  const createReservationMutation = useMutation({
    mutationFn: async (data: {
      item_id: string;
      project_id: string;
      quantity: number;
      reserved_by: string;
      reason?: string;
      notes?: string;
    }) => {
      return await apiRequest("POST", "/api/warehouse/reservations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      toast({
        title: "Резерв создан",
        description: "Материал успешно зарезервирован под проект",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать резерв",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!item) return;

    const quantityNum = parseFloat(quantity);

    if (!projectId) {
      toast({
        title: "Ошибка",
        description: "Выберите проект",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(quantityNum) || quantityNum <= 0) {
      toast({
        title: "Ошибка",
        description: "Укажите корректное количество",
        variant: "destructive",
      });
      return;
    }

    if (quantityNum > availableQuantity) {
      toast({
        title: "Ошибка",
        description: `Недостаточно товара. Доступно: ${availableQuantity}`,
        variant: "destructive",
      });
      return;
    }

    createReservationMutation.mutate({
      item_id: item.id,
      project_id: projectId,
      quantity: quantityNum,
      reserved_by: userId || undefined,
      reason: reason || undefined,
      notes: notes || undefined,
    });
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Зарезервировать материал</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Материал</Label>
            <div className="p-3 bg-muted rounded-md">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                Всего: {item.quantity} {item.unit}
              </p>
              <p className="text-sm text-muted-foreground">
                Зарезервировано: {item.reserved_quantity || 0} {item.unit}
              </p>
              <p className="text-sm font-medium text-primary">
                Доступно: {availableQuantity} {item.unit}
              </p>
            </div>
          </div>

          {availableQuantity <= 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Нет доступного количества для резервирования
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="project">Проект *</Label>
            <Select value={projectId} onValueChange={setProjectId} disabled={availableQuantity <= 0}>
              <SelectTrigger id="project">
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name} - {project.client_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">Количество *</Label>
            <Input
              id="quantity"
              type="number"
              min="0"
              max={availableQuantity}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={`Макс: ${availableQuantity}`}
              disabled={availableQuantity <= 0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Причина</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Например: Для производства кухни"
              disabled={availableQuantity <= 0}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Комментарий</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Дополнительная информация..."
              rows={3}
              disabled={availableQuantity <= 0}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createReservationMutation.isPending}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={createReservationMutation.isPending || availableQuantity <= 0}
            >
              {createReservationMutation.isPending && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              Зарезервировать
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
