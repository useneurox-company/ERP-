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
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";
import { insertProductionTaskSchema, type User, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProductionTaskCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductionTaskCreateDialog({ open, onOpenChange }: ProductionTaskCreateDialogProps) {
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const form = useForm({
    resolver: zodResolver(insertProductionTaskSchema),
    defaultValues: {
      item_name: "",
      project_id: "",
      worker_id: "",
      payment: "",
      deadline: "",
      progress: 0,
      status: "pending" as const,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const taskData = {
        ...data,
        project_id: data.project_id || null,
        worker_id: data.worker_id || null,
        payment: data.payment || null,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
      };
      await apiRequest("POST", "/api/production", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/production"] });
      toast({
        title: "Успешно",
        description: "Задача создана",
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

  const statusLabels: Record<string, string> = {
    pending: "В ожидании",
    in_progress: "В работе",
    completed: "Завершено",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-production-dialog-title">Новая задача</DialogTitle>
          <DialogDescription data-testid="text-production-dialog-description">
            Создание новой производственной задачи
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="item_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название изделия</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Название изделия" 
                      data-testid="input-create-production-item-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Проект (опционально)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-production-project">
                        <SelectValue placeholder="Выберите проект" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem 
                          key={project.id} 
                          value={project.id}
                          data-testid={`option-create-production-project-${project.id}`}
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

            <FormField
              control={form.control}
              name="worker_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Работник</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-production-worker">
                        <SelectValue placeholder="Выберите работника" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem 
                          key={user.id} 
                          value={user.id}
                          data-testid={`option-create-production-worker-${user.id}`}
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
              name="payment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Оплата</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="number" 
                      placeholder="0.00" 
                      data-testid="input-create-production-payment"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deadline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Срок</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="datetime-local" 
                      data-testid="input-create-production-deadline"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="progress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Прогресс: {field.value}%</FormLabel>
                  <FormControl>
                    <Slider 
                      value={[field.value || 0]} 
                      onValueChange={(value) => field.onChange(value[0])}
                      max={100}
                      step={5}
                      data-testid="slider-create-production-progress"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Статус</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-production-status">
                        <SelectValue placeholder="Выберите статус" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending" data-testid="option-create-production-status-pending">
                        {statusLabels.pending}
                      </SelectItem>
                      <SelectItem value="in_progress" data-testid="option-create-production-status-in_progress">
                        {statusLabels.in_progress}
                      </SelectItem>
                      <SelectItem value="completed" data-testid="option-create-production-status-completed">
                        {statusLabels.completed}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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
                data-testid="button-cancel-create-production"
              >
                Отмена
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="flex-1"
                data-testid="button-submit-create-production"
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
