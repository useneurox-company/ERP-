import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WarehouseCategory } from "@shared/schema";

// Предустановленные иконки для категорий
const CATEGORY_ICONS = [
  "📦", "🪵", "🔩", "🎨", "📏", "🪟", "🪞", "🍳",
  "🚪", "🪑", "📚", "🛏️", "🪴", "💡", "🔨", "⚙️",
  "📐", "🧰", "🖼️", "🪜", "🧱", "🪛", "🗄️", "🎯",
  "🏭", "🏗️", "🔧", "📊", "💼", "🎁", "📋", "🗂️",
];

// Предустановленная палитра цветов
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#eab308", // yellow
  "#84cc16", // lime
  "#22c55e", // green
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#0ea5e9", // sky
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#a855f7", // purple
  "#d946ef", // fuchsia
  "#ec4899", // pink
  "#6b7280", // gray
  "#000000", // black
];

const categoryFormSchema = z.object({
  name: z.string().min(1, "Название обязательно"),
  parent_id: z.string().nullable().optional(),
  icon: z.string().optional(),
  color: z.string().optional(),
  order: z.number().optional(),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

interface CategoryManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: WarehouseCategory | null; // null = create, object = edit
}

export function CategoryManageDialog({
  open,
  onOpenChange,
  category,
}: CategoryManageDialogProps) {
  const { toast } = useToast();
  const isEditing = !!category;

  // Получить все категории для выбора родительской
  const { data: allCategories = [] } = useQuery<WarehouseCategory[]>({
    queryKey: ["/api/warehouse/categories"],
    enabled: open,
  });

  // Фильтруем категории - нельзя выбрать себя или свои подкатегории как родителя
  const selectableParentCategories = allCategories.filter((cat) => {
    if (isEditing && category) {
      // Нельзя выбрать саму себя
      if (cat.id === category.id) return false;
      // Нельзя выбрать свою подкатегорию (проверяем parent_id)
      if (cat.parent_id === category.id) return false;
    }
    return true;
  });

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: "",
      parent_id: null,
      icon: "",
      color: "#6b7280",
      order: 0,
    },
  });

  // Заполнить форму при редактировании
  useEffect(() => {
    if (category) {
      form.reset({
        name: category.name,
        parent_id: category.parent_id || null,
        icon: category.icon || "",
        color: category.color || "#6b7280",
        order: category.order || 0,
      });
    } else {
      form.reset({
        name: "",
        parent_id: null,
        icon: "",
        color: "#6b7280",
        order: 0,
      });
    }
  }, [category, form]);

  const createMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      apiRequest("POST", "/api/warehouse/categories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/categories/tree"] });
      toast({
        title: "Категория создана",
        description: "Новая категория успешно добавлена",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать категорию",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CategoryFormData) =>
      apiRequest("PUT", `/api/warehouse/categories/${category?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/categories/tree"] });
      toast({
        title: "Категория обновлена",
        description: "Изменения успешно сохранены",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить категорию",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CategoryFormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактировать категорию" : "Создать категорию"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Измените данные категории"
              : "Добавьте новую категорию для склада"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название</FormLabel>
                  <FormControl>
                    <Input placeholder="Например: МДФ, Фурнитура" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="parent_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Родительская категория</FormLabel>
                  <Select
                    value={field.value || "root"}
                    onValueChange={(value) =>
                      field.onChange(value === "root" ? null : value)
                    }
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Корневая категория" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="root">Корневая категория</SelectItem>
                      {selectableParentCategories.map((cat) => (
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

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Иконка (emoji)</FormLabel>
                  <div className="space-y-2">
                    {/* Emoji Picker Grid */}
                    <div className="grid grid-cols-8 gap-1 p-2 border rounded-md">
                      {CATEGORY_ICONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => field.onChange(emoji)}
                          className={`p-2 text-xl hover:bg-accent rounded transition-colors ${
                            field.value === emoji ? 'bg-accent ring-2 ring-primary' : ''
                          }`}
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                    {/* Fallback: ручной ввод */}
                    <FormControl>
                      <Input
                        placeholder="или введите свой emoji"
                        {...field}
                        value={field.value || ""}
                        className="text-center"
                      />
                    </FormControl>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Цвет</FormLabel>
                  <div className="space-y-2">
                    {/* Color Palette Grid */}
                    <div className="grid grid-cols-8 gap-2 p-2 border rounded-md">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => field.onChange(color)}
                          className={`w-8 h-8 rounded-full transition-all hover:scale-110 ${
                            field.value === color ? 'ring-2 ring-primary ring-offset-2' : ''
                          }`}
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ))}
                    </div>
                    {/* Color Picker для custom цветов */}
                    <div className="flex gap-2 items-center">
                      <FormControl>
                        <Input
                          type="color"
                          {...field}
                          value={field.value || "#6b7280"}
                          className="w-20 h-10"
                        />
                      </FormControl>
                      <Input
                        type="text"
                        value={field.value || "#6b7280"}
                        onChange={(e) => field.onChange(e.target.value)}
                        placeholder="#6b7280"
                        className="flex-1 font-mono text-sm"
                      />
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Порядок сортировки</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      value={field.value || 0}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? "Сохранение..."
                  : isEditing
                  ? "Сохранить"
                  : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
