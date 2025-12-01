import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, Package } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { WarehouseItem } from "@shared/schema";

interface QuickTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scannedCode: string;
  currentUserId: string;
}

const transactionSchema = z.object({
  type: z.enum(["in", "out"]),
  quantity: z.number().positive("Количество должно быть больше нуля"),
  notes: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

export function QuickTransactionDialog({
  open,
  onOpenChange,
  scannedCode,
  currentUserId,
}: QuickTransactionDialogProps) {
  const { toast } = useToast();
  const [transactionType, setTransactionType] = useState<"in" | "out">("in");

  // Fetch item by barcode or ID
  const { data: items = [], isLoading: isLoadingItems } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items"],
    enabled: open && !!scannedCode,
  });

  const item = items.find(
    (i) => i.barcode === scannedCode || i.id === scannedCode || i.sku === scannedCode
  );

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "in",
      quantity: 1,
      notes: "",
    },
  });

  const transactionMutation = useMutation({
    mutationFn: async (data: TransactionFormData) => {
      if (!item) throw new Error("Товар не найден");

      await apiRequest("POST", `/api/warehouse/items/${item.id}/transactions`, {
        type: data.type,
        quantity: data.quantity,
        notes: data.notes || null,
        user_id: currentUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      toast({
        title: "Успешно",
        description: `Операция "${transactionType === "in" ? "приход" : "расход"}" выполнена`,
      });
      form.reset();
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

  const handleSubmit = form.handleSubmit((data) => {
    const formData = { ...data, type: transactionType };
    transactionMutation.mutate(formData);
  });

  const handleTypeChange = (type: "in" | "out") => {
    setTransactionType(type);
    form.setValue("type", type);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Быстрая операция</DialogTitle>
          <DialogDescription>
            Приход или расход товара
          </DialogDescription>
        </DialogHeader>

        {isLoadingItems ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !item ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">Товар не найден</p>
            <p className="text-sm text-muted-foreground mt-1">Код: {scannedCode}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Item Info */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{item.name}</h3>
                <Badge variant="outline">
                  {item.category === "materials" ? "Материал" : "Изделие"}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                {item.sku && <div>Артикул: {item.sku}</div>}
                <div>
                  В наличии: <span className="font-semibold">{item.quantity}</span> {item.unit}
                </div>
                {item.location && <div>Расположение: {item.location}</div>}
              </div>
            </div>

            {/* Transaction Type Selection */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={transactionType === "in" ? "default" : "outline"}
                onClick={() => handleTypeChange("in")}
                className="h-20 flex flex-col gap-2"
              >
                <TrendingUp className="h-6 w-6" />
                <span>Приход</span>
              </Button>
              <Button
                type="button"
                variant={transactionType === "out" ? "default" : "outline"}
                onClick={() => handleTypeChange("out")}
                className="h-20 flex flex-col gap-2"
              >
                <TrendingDown className="h-6 w-6" />
                <span>Расход</span>
              </Button>
            </div>

            {/* Transaction Form */}
            <Form {...form}>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                          value={field.value}
                          onChange={(e) =>
                            field.onChange(e.target.value ? parseFloat(e.target.value) : 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Примечание (опционально)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Причина операции или комментарий"
                          className="resize-none"
                          rows={2}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={transactionMutation.isPending}
                    className="flex-1"
                  >
                    {transactionMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Выполнить
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
