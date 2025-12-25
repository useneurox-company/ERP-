import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { insertWarehouseTransactionSchema, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

interface WarehouseTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemId: string;
  currentUserId: string;
}

const transactionFormSchema = insertWarehouseTransactionSchema.extend({
  type: z.enum(["in", "out"]),
});

export function WarehouseTransactionDialog({ 
  open, 
  onOpenChange, 
  itemId,
  currentUserId
}: WarehouseTransactionDialogProps) {
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const form = useForm({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      item_id: itemId,
      type: "in" as "in" | "out",
      quantity: 0,
      user_id: currentUserId,
      project_id: "",
      notes: "",
    },
  });

  const transactionType = form.watch("type");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const transactionData = {
        ...data,
        project_id: data.type === "out" && data.project_id ? data.project_id : null,
        notes: data.notes || null,
      };
      await apiRequest("POST", "/api/warehouse/transactions", transactionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items", itemId] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items", itemId, "transactions"] });
      toast({
        title: "Успешно",
        description: "Транзакция создана",
      });
      form.reset({
        item_id: itemId,
        type: "in",
        quantity: 0,
        user_id: currentUserId,
        project_id: "",
        notes: "",
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

  const handleSubmit = form.handleSubmit((data) => {
    createMutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="text-transaction-dialog-title">Новая транзакция</DialogTitle>
          <DialogDescription data-testid="text-transaction-dialog-description">
            Приход или расход товара
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Тип операции</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem 
                          value="in" 
                          id="type-in"
                          data-testid="radio-transaction-type-in"
                        />
                        <Label htmlFor="type-in" className="cursor-pointer">
                          Приход
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem 
                          value="out" 
                          id="type-out"
                          data-testid="radio-transaction-type-out"
                        />
                        <Label htmlFor="type-out" className="cursor-pointer">
                          Расход
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                      data-testid="input-transaction-quantity"
                      value={field.value}
                      onChange={(e) => {
                        const value = e.target.value.replace(',', '.');
                        field.onChange(value ? parseFloat(value) : 0);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {transactionType === "out" && (
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Проект (опционально)</FormLabel>
                    <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-transaction-project">
                          <SelectValue placeholder="Выберите проект" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none" data-testid="option-transaction-project-none">
                          Без проекта
                        </SelectItem>
                        {projects.map((project) => (
                          <SelectItem 
                            key={project.id} 
                            value={project.id}
                            data-testid={`option-transaction-project-${project.id}`}
                          >
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Примечание</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Дополнительная информация..." 
                      data-testid="input-transaction-notes"
                      rows={3}
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
                data-testid="button-transaction-cancel"
              >
                Отмена
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="flex-1"
                data-testid="button-transaction-submit"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
