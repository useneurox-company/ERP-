import React, { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertProjectItemSchema } from "@shared/schema";
import type { ProjectItem, InsertProjectItem } from "@shared/schema";
import { z } from "zod";

const formSchema = insertProjectItemSchema.omit({ project_id: true, order: true }).extend({
  name: z.string().min(1, "Название обязательно"),
  quantity: z.coerce.number().min(1, "Минимальное количество: 1"),
  price: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
    if (val === null || val === undefined || val === "") return null;
    return typeof val === "string" ? parseFloat(val) : val;
  }),
  article: z.string().nullable().optional(),
  image_url: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ProjectItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  item?: ProjectItem;
}

export function ProjectItemDialog({ open, onOpenChange, projectId, item }: ProjectItemDialogProps) {
  const { toast } = useToast();
  const isEditing = !!item;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      article: null,
      quantity: 1,
      price: null,
      image_url: undefined,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        article: item.article || null,
        quantity: item.quantity,
        price: item.price || null,
        image_url: item.image_url || undefined,
      });
    } else {
      form.reset({
        name: "",
        article: null,
        quantity: 1,
        price: null,
        image_url: undefined,
      });
    }
  }, [item, form]);

  // Handle file input
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Ошибка",
        description: "Можно загружать только изображения",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      form.setValue('image_url', base64);
      toast({
        title: "Изображение добавлено",
        description: "Изображение успешно загружено",
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle paste image from clipboard
  const handlePasteImage = async (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        event.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        handleFileSelect(file);
        break;
      }
    }
  };

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleRemoveImage = () => {
    form.setValue('image_url', undefined);
    toast({
      title: "Изображение удалено",
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const maxOrderResult = await fetch(`/api/projects/${projectId}/items`);
      const items = await maxOrderResult.json();
      const maxOrder = items.length > 0 ? Math.max(...items.map((i: ProjectItem) => i.order)) : 0;

      return await apiRequest('POST', `/api/projects/${projectId}/items`, {
        ...data,
        project_id: projectId,
        order: maxOrder + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'items'] });
      toast({
        title: "Позиция создана",
        description: "Позиция мебели успешно добавлена",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать позицию",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Clean undefined values - SQLite can't handle them
      const cleanedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [key, value === undefined ? null : value])
      );
      return await apiRequest('PUT', `/api/projects/${projectId}/items/${item?.id}`, cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'items'] });
      toast({
        title: "Позиция обновлена",
        description: "Позиция мебели успешно обновлена",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить позицию",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-project-item">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Редактировать позицию" : "Добавить позицию"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              {...form.register("name")}
              data-testid="input-name"
              placeholder="Например: Кухонный гарнитур"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive" data-testid="error-name">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="article">Артикул</Label>
            <Input
              id="article"
              {...form.register("article")}
              data-testid="input-article"
              placeholder="Например: КГ-001"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Количество *</Label>
              <Input
                id="quantity"
                type="number"
                min="1"
                {...form.register("quantity")}
                data-testid="input-quantity"
              />
              {form.formState.errors.quantity && (
                <p className="text-sm text-destructive" data-testid="error-quantity">
                  {form.formState.errors.quantity.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Цена (₽)</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                {...form.register("price")}
                data-testid="input-price"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Изображение</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                }
              }}
            />
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onPaste={handlePasteImage}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => {
                if (!form.watch('image_url')) {
                  fileInputRef.current?.click();
                }
              }}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.ctrlKey && e.key === 'v') {
                  handlePasteImage(e as any);
                }
              }}
            >
              {form.watch('image_url') ? (
                <div className="space-y-2">
                  <img
                    src={form.watch('image_url')}
                    alt="Preview"
                    className="w-20 h-20 object-cover mx-auto rounded"
                  />
                  <div className="flex gap-2 justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Заменить
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage();
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  <p className="font-medium mb-1">Нажмите для выбора изображения</p>
                  <p className="text-xs">или Ctrl+V для вставки</p>
                  <p className="text-xs">или перетащите файл сюда</p>
                </div>
              )}
            </div>
            {form.formState.errors.image_url && (
              <p className="text-sm text-destructive">
                {form.formState.errors.image_url.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              data-testid="button-cancel"
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              data-testid="button-submit"
            >
              {isPending ? "Сохранение..." : isEditing ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
