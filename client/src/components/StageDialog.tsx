import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertProjectStageSchema } from "@shared/schema";
import type { ProjectStage, InsertProjectStage, User } from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { StageTypeSelector } from "./StageTypeSelector";

const formSchema = insertProjectStageSchema
  .omit({ project_id: true, item_id: true, order: true })
  .extend({
    name: z.string().min(1, "Название обязательно"),
    description: z.string().optional(),
    stage_type_id: z.string().nullable().optional(),
    duration_days: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
      if (val === null || val === undefined || val === "") return undefined;
      return typeof val === "string" ? parseInt(val) : val;
    }),
    planned_start_date: z.date().nullable().optional(),
    planned_end_date: z.date().nullable().optional(),
    assignee_id: z.string().nullable().optional(),
    cost: z.union([z.string(), z.number(), z.null()]).optional().transform((val) => {
      if (val === null || val === undefined || val === "") return undefined;
      return typeof val === "string" ? val : val.toString();
    }),
  });

type FormData = z.infer<typeof formSchema>;

interface StageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  itemId?: string;
  stage?: ProjectStage;
}

export function StageDialog({ open, onOpenChange, projectId, itemId, stage }: StageDialogProps) {
  const { toast } = useToast();
  const isEditing = !!stage;
  const mode = isEditing ? "edit" : "create";

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      stage_type_id: null,
      duration_days: undefined,
      planned_start_date: null,
      planned_end_date: null,
      assignee_id: null,
      cost: undefined,
      status: "pending",
    },
  });

  useEffect(() => {
    if (stage) {
      form.reset({
        name: stage.name,
        description: stage.description || "",
        stage_type_id: stage.stage_type_id || null,
        duration_days: stage.duration_days || undefined,
        planned_start_date: stage.planned_start_date ? new Date(stage.planned_start_date) : null,
        planned_end_date: stage.planned_end_date ? new Date(stage.planned_end_date) : null,
        assignee_id: stage.assignee_id || null,
        cost: stage.cost !== undefined && stage.cost !== null ? String(stage.cost) : undefined,
        status: stage.status,
      });
    } else {
      form.reset({
        name: "",
        description: "",
        stage_type_id: null,
        duration_days: undefined,
        planned_start_date: null,
        planned_end_date: null,
        assignee_id: null,
        cost: undefined,
        status: "pending",
      });
    }
  }, [stage, form, open]);

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!itemId) throw new Error("Item ID is required for creating a stage");
      
      const stagesResult = await fetch(`/api/projects/${projectId}/items/${itemId}/stages`);
      const stages = await stagesResult.json();
      const maxOrder = stages.length > 0 ? Math.max(...stages.map((s: ProjectStage) => s.order)) : 0;

      return await apiRequest('POST', `/api/projects/${projectId}/items/${itemId}/stages`, {
        ...data,
        project_id: projectId,
        item_id: itemId,
        order: maxOrder + 1,
        planned_start_date: data.planned_start_date || null,
        planned_end_date: data.planned_end_date || null,
      });
    },
    onSuccess: () => {
      if (itemId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'items', itemId, 'stages'] });
      }
      toast({
        title: "Этап создан",
        description: "Этап успешно добавлен",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать этап",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return await apiRequest('PUT', `/api/projects/stages/${stage?.id}`, {
        ...data,
        planned_start_date: data.planned_start_date || null,
        planned_end_date: data.planned_end_date || null,
      });
    },
    onSuccess: () => {
      const targetItemId = stage?.item_id || itemId;
      if (targetItemId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'items', targetItemId, 'stages'] });
      }
      toast({
        title: "Этап обновлен",
        description: "Этап успешно обновлен",
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить этап",
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-stage">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">
            {isEditing ? "Редактировать этап" : "Добавить этап"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              {...form.register("name")}
              data-testid="input-name"
              placeholder="Например: Раскрой материалов"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive" data-testid="error-name">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Описание</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              data-testid="input-description"
              placeholder="Добавьте описание этапа"
              rows={3}
            />
          </div>

          {!isEditing && (
            <div className="space-y-2">
              <Label>Тип этапа</Label>
              <Controller
                name="stage_type_id"
                control={form.control}
                render={({ field }) => (
                  <StageTypeSelector
                    selectedTypeId={field.value}
                    onSelectType={field.onChange}
                  />
                )}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="duration_days">Длительность (дней)</Label>
            <Input
              id="duration_days"
              type="number"
              min="1"
              {...form.register("duration_days")}
              data-testid="input-duration-days"
              placeholder="Например: 5"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Плановая дата начала</Label>
              <Controller
                name="planned_start_date"
                control={form.control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-start-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "dd.MM.yyyy") : "Выберите дату"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" data-testid="popover-start-date">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={(date) => field.onChange(date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label>Плановая дата окончания</Label>
              <Controller
                name="planned_end_date"
                control={form.control}
                render={({ field }) => (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                        data-testid="button-end-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value ? format(field.value, "dd.MM.yyyy") : "Выберите дату"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" data-testid="popover-end-date">
                      <Calendar
                        mode="single"
                        selected={field.value || undefined}
                        onSelect={(date) => field.onChange(date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="assignee_id">Исполнитель</Label>
              <Controller
                name="assignee_id"
                control={form.control}
                render={({ field }) => (
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                  >
                    <SelectTrigger data-testid="select-assignee">
                      <SelectValue placeholder="Не назначен" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" data-testid="select-assignee-none">
                        Не назначен
                      </SelectItem>
                      {users.map((user) => (
                        <SelectItem 
                          key={user.id} 
                          value={user.id}
                          data-testid={`select-assignee-${user.id}`}
                        >
                          {user.full_name || user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost">Стоимость (₽)</Label>
              <Input
                id="cost"
                type="number"
                min="0"
                step="0.01"
                {...form.register("cost")}
                data-testid="input-cost"
                placeholder="0.00"
              />
            </div>
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
