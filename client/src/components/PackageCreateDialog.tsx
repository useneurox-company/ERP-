import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Trash2 } from "lucide-react";
import type { Project } from "@shared/schema";

const packageSchema = z.object({
  name: z.string().min(1, "Укажите название упаковки"),
  project_name: z.string().min(1, "Выберите проект"),
  location: z.string().optional(),
  notes: z.string().optional(),
  details: z.array(
    z.object({
      name: z.string().min(1, "Укажите название детали"),
      quantity: z.string().min(1, "Укажите количество"),
    })
  ).min(1, "Добавьте хотя бы одну деталь"),
});

type PackageForm = z.infer<typeof packageSchema>;

interface PackageCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PackageCreateDialog({ open, onOpenChange }: PackageCreateDialogProps) {
  const { toast } = useToast();

  const form = useForm<PackageForm>({
    resolver: zodResolver(packageSchema),
    defaultValues: {
      name: "",
      project_name: "",
      location: "",
      notes: "",
      details: [{ name: "", quantity: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "details",
  });

  // Загрузка проектов
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: PackageForm) => {
      const package_details = data.details.map((d) => ({
        name: d.name,
        quantity: parseFloat(d.quantity),
      }));

      return await apiRequest("POST", "/api/warehouse/packages", {
        name: data.name,
        project_name: data.project_name,
        package_details,
        location: data.location || "",
        notes: data.notes || "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      toast({
        title: "Успешно",
        description: "Упаковка создана",
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

  const onSubmit = (data: PackageForm) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать упаковку</DialogTitle>
          <DialogDescription>
            Соберите несколько деталей в одну упаковку
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Название упаковки */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название упаковки</FormLabel>
                  <FormControl>
                    <Input placeholder="Комплект стола офисного" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Проект */}
            <FormField
              control={form.control}
              name="project_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Проект *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите проект" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.name}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Или введите название вручную в поле выше
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Местоположение */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Местоположение (опционально)</FormLabel>
                  <FormControl>
                    <Input placeholder="Стеллаж А-1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Детали упаковки */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Детали в упаковке</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ name: "", quantity: "" })}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить деталь
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start">
                  <FormField
                    control={form.control}
                    name={`details.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        {index === 0 && <FormLabel>Название</FormLabel>}
                        <FormControl>
                          <Input placeholder="Доска сосна" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`details.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-32">
                        {index === 0 && <FormLabel>Кол-во</FormLabel>}
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className={index === 0 ? "mt-8" : ""}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {/* Комментарий */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Комментарий (опционально)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Дополнительная информация"
                      className="resize-none"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Создание..." : "Создать упаковку"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
