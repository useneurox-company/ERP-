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
import { Loader2 } from "lucide-react";
import { insertProjectSchema, type User, type Deal } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface ProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectCreateDialog({ open, onOpenChange }: ProjectCreateDialogProps) {
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: deals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
  });

  const form = useForm({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      client_name: "",
      deal_id: "",
      status: "pending" as const,
      duration_days: 0,
      manager_id: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const projectData = {
        ...data,
        deal_id: data.deal_id || null,
        manager_id: data.manager_id || null,
      };
      await apiRequest("POST", "/api/projects", projectData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Успешно",
        description: "Проект создан",
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
    completed: "Завершен",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-project-dialog-title">Новый проект</DialogTitle>
          <DialogDescription data-testid="text-project-dialog-description">
            Создание нового проекта
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название проекта</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="Название проекта" 
                      data-testid="input-create-project-name"
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
                      data-testid="input-create-project-client-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="deal_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сделка</FormLabel>
                  <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-project-deal">
                        <SelectValue placeholder="Выберите сделку (опционально)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none" data-testid="option-create-project-deal-none">
                        Без сделки
                      </SelectItem>
                      {deals.map((deal) => (
                        <SelectItem 
                          key={deal.id} 
                          value={deal.id}
                          data-testid={`option-create-project-deal-${deal.id}`}
                        >
                          {deal.client_name} - {deal.company || "Нет компании"}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Статус</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-project-status">
                        <SelectValue placeholder="Выберите статус" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pending" data-testid="option-create-project-status-pending">
                        {statusLabels.pending}
                      </SelectItem>
                      <SelectItem value="in_progress" data-testid="option-create-project-status-in_progress">
                        {statusLabels.in_progress}
                      </SelectItem>
                      <SelectItem value="completed" data-testid="option-create-project-status-completed">
                        {statusLabels.completed}
                      </SelectItem>
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
                  <FormLabel>РОП</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-create-project-manager">
                        <SelectValue placeholder="Выберите менеджера" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem 
                          key={user.id} 
                          value={user.id}
                          data-testid={`option-create-project-manager-${user.id}`}
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

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-create-project"
              >
                Отмена
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="flex-1"
                data-testid="button-submit-create-project"
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
