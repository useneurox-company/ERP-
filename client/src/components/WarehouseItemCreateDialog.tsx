import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { insertWarehouseItemSchema, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FormDescription } from "@/components/ui/form";

interface WarehouseItemCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedCategoryId?: string | null;
}

export function WarehouseItemCreateDialog({ open, onOpenChange, preselectedCategoryId }: WarehouseItemCreateDialogProps) {
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ["/api/warehouse/categories"],
  });

  const form = useForm({
    resolver: zodResolver(insertWarehouseItemSchema),
    defaultValues: {
      name: "",
      sku: "",
      quantity: 0,
      unit: "шт",
      price: 0,
      location: "",
      category_id: preselectedCategoryId || null,
      supplier: "",
      description: "",
      min_stock: 0,
      track_min_stock: false,
      status: "normal" as const,
      project_id: null,
    },
  });

  // Обновить category_id при изменении preselectedCategoryId
  useEffect(() => {
    if (open && preselectedCategoryId) {
      form.setValue("category_id", preselectedCategoryId);
    }
  }, [open, preselectedCategoryId, form]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const itemData = {
        ...data,
        sku: data.sku || undefined,
        quantity: Number(data.quantity) || 0,
        price: Number(data.price) || 0,
        location: data.location || null,
        supplier: data.supplier || null,
        description: data.description || null,
        min_stock: Number(data.min_stock) || 0,
        track_min_stock: data.track_min_stock || false,
        project_id: data.project_id || null,
      };
      await apiRequest("POST", "/api/warehouse/items", itemData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/items"] });
      toast({
        title: "Успешно",
        description: "Позиция создана",
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
    createMutation.mutate(data);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-warehouse-dialog-title">Новая позиция</DialogTitle>
          <DialogDescription data-testid="text-warehouse-dialog-description">
            Добавление позиции на склад
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                      data-testid="input-warehouse-name"
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
                      placeholder="Будет сгенерирован автоматически"
                      data-testid="input-warehouse-sku"
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
                      data-testid="input-warehouse-price"
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
                        data-testid="input-warehouse-quantity"
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-warehouse-unit">
                          <SelectValue placeholder="Выберите единицу" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="шт" data-testid="option-unit-pc">шт</SelectItem>
                        <SelectItem value="кг" data-testid="option-unit-kg">кг</SelectItem>
                        <SelectItem value="м" data-testid="option-unit-m">м</SelectItem>
                        <SelectItem value="м²" data-testid="option-unit-m2">м²</SelectItem>
                        <SelectItem value="л" data-testid="option-unit-l">л</SelectItem>
                        <SelectItem value="уп" data-testid="option-unit-pack">уп</SelectItem>
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
                      data-testid="input-warehouse-location"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Категория</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value || undefined}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-warehouse-category">
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon && <span className="mr-1">{cat.icon}</span>}
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("category_id") && (
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
                        <SelectTrigger data-testid="select-warehouse-project">
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
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-warehouse-track-min-stock"
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
                        data-testid="input-warehouse-min-stock"
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
                      data-testid="input-warehouse-supplier"
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
                      data-testid="textarea-warehouse-description"
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
                data-testid="button-warehouse-cancel-create"
              >
                Отмена
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="flex-1"
                data-testid="button-warehouse-submit-create"
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
