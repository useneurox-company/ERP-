import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2 } from "lucide-react";
import { insertDealSchema, type User, type DealStage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DealCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealCreateDialog({ open, onOpenChange }: DealCreateDialogProps) {
  const [newTag, setNewTag] = useState("");
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: stages = [] } = useQuery<DealStage[]>({
    queryKey: ["/api/deal-stages"],
    enabled: open,
  });

  const form = useForm({
    resolver: zodResolver(insertDealSchema),
    defaultValues: {
      title: "",
      client_name: "",
      company: null,
      amount: null,
      stage: "",
      manager_id: null,
      production_days_count: null,
      tags: [] as string[],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/deals", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Успешно",
        description: "Сделка создана",
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

  const handleAddTag = () => {
    if (newTag.trim()) {
      const currentTags = form.getValues("tags") || [];
      form.setValue("tags", [...currentTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (index: number) => {
    const currentTags = form.getValues("tags") || [];
    form.setValue("tags", currentTags.filter((_, i) => i !== index));
  };

  // Устанавливаем первый этап по умолчанию когда загрузились stages
  useEffect(() => {
    if (stages.length > 0 && open) {
      const currentStage = form.getValues("stage");
      // Если текущий stage не найден в списке - ставим первый
      if (!currentStage || !stages.find(s => s.key === currentStage)) {
        form.setValue("stage", stages[0].key);
      }
    }
  }, [stages, open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-dialog-title">Новая сделка</DialogTitle>
          <DialogDescription data-testid="text-dialog-description">
            Создание новой сделки в CRM
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название сделки</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Например: Кухня для Ивановых"
                      data-testid="input-create-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Клиент</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Имя клиента"
                      data-testid="input-create-client-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Компания</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="Название компании"
                      data-testid="input-create-company"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сумма</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      type="number"
                      placeholder="0.00"
                      data-testid="input-create-amount"
                      onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="stage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Стадия</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-stage">
                        <SelectValue placeholder="Выберите стадию" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {stages.map((stage) => (
                        <SelectItem
                          key={stage.id}
                          value={stage.key}
                          data-testid={`option-create-stage-${stage.key}`}
                        >
                          {stage.name}
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
              name="manager_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Менеджер</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-manager">
                        <SelectValue placeholder="Выберите менеджера" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem 
                          key={user.id} 
                          value={user.id}
                          data-testid={`option-create-manager-${user.id}`}
                        >
                          {user.full_name || user.username}
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
              name="production_days_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сроки изготовления в рабочих днях</FormLabel>
                  <FormControl>
                    <Input 
                      value={field.value ?? ""}
                      type="number" 
                      min="1"
                      placeholder="Количество рабочих дней" 
                      data-testid="input-create-production-days"
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Теги</FormLabel>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="Добавить тег"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        data-testid="input-create-new-tag"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleAddTag}
                        data-testid="button-create-add-tag"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {field.value?.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="secondary"
                          data-testid={`tag-create-${index}`}
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(index)}
                            className="ml-1 hover:text-destructive"
                            data-testid={`button-create-remove-tag-${index}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
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
                data-testid="button-cancel-create"
              >
                Отмена
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="flex-1"
                data-testid="button-submit-create"
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
