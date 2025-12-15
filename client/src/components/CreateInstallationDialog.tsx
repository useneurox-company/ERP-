import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MapPin } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Project, User } from "@shared/schema";

interface CreateInstallationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedProjectId?: string;
}

interface InstallationFormData {
  project_id: string;
  client_name: string;
  address: string;
  phone: string;
  date: string;
  installer_id: string;
  payment: string;
  notes: string;
}

export function CreateInstallationDialog({
  open,
  onOpenChange,
  preselectedProjectId
}: CreateInstallationDialogProps) {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  // Получаем детали выбранного проекта для автозаполнения
  const { data: selectedProject } = useQuery<Project>({
    queryKey: ["/api/projects", selectedProjectId],
    enabled: !!selectedProjectId && open,
    queryFn: async () => {
      const response = await fetch(`/api/projects/${selectedProjectId}`);
      if (!response.ok) throw new Error("Failed to fetch project");
      return response.json();
    },
  });

  const form = useForm<InstallationFormData>({
    defaultValues: {
      project_id: preselectedProjectId || "",
      client_name: "",
      address: "",
      phone: "",
      date: "",
      installer_id: "",
      payment: "",
      notes: "",
    },
  });

  // При выборе проекта автозаполняем данные
  useEffect(() => {
    if (selectedProject) {
      // Автозаполняем клиента
      if (selectedProject.client_name) {
        form.setValue("client_name", selectedProject.client_name);
      }
      // Автозаполняем адрес из проекта
      if ((selectedProject as any).address) {
        form.setValue("address", (selectedProject as any).address);
      }
    }
  }, [selectedProject, form]);

  // При открытии с preselectedProjectId
  useEffect(() => {
    if (open && preselectedProjectId) {
      setSelectedProjectId(preselectedProjectId);
      form.setValue("project_id", preselectedProjectId);
    }
  }, [open, preselectedProjectId, form]);

  // Сбрасываем форму при закрытии
  useEffect(() => {
    if (!open) {
      form.reset();
      setSelectedProjectId("");
    }
  }, [open, form]);

  const createMutation = useMutation({
    mutationFn: async (data: InstallationFormData) => {
      const payload = {
        project_id: data.project_id || null,
        client_name: data.client_name,
        address: data.address,
        phone: data.phone || null,
        date: data.date ? new Date(data.date).toISOString() : null,
        installer_id: data.installer_id || null,
        payment: data.payment ? parseFloat(data.payment) : null,
        notes: data.notes || null,
        status: "scheduled",
      };
      await apiRequest("POST", "/api/installations", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installations"] });
      toast({
        title: "Успешно",
        description: "Задача монтажа создана",
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
    if (!data.client_name || !data.address) {
      toast({
        title: "Ошибка",
        description: "Заполните обязательные поля: Клиент и Адрес",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(data);
  });

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    form.setValue("project_id", projectId);
  };

  // Фильтруем только монтажников
  const installers = users.filter(u =>
    u.role_id && (u as any).role?.name === "Монтажник"
  );
  // Если нет фильтра по роли, показываем всех
  const availableInstallers = installers.length > 0 ? installers : users;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новая задача монтажа</DialogTitle>
          <DialogDescription>
            Создание новой задачи монтажа
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Проект</FormLabel>
                  <Select
                    onValueChange={handleProjectChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите проект (опционально)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.project_number ? `#${project.project_number} - ` : ""}
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
              name="client_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Клиент *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Имя клиента"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    Адрес монтажа *
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Адрес объекта"
                    />
                  </FormControl>
                  {selectedProject && (selectedProject as any).address && field.value === (selectedProject as any).address && (
                    <p className="text-xs text-muted-foreground">
                      Адрес подставлен из проекта
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Телефон</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="+7 (___) ___-__-__"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата монтажа</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="datetime-local"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="installer_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Монтажник</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите монтажника" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableInstallers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
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
                  <FormLabel>Оплата (₽)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      placeholder="0"
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
                  <FormLabel>Примечания</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Дополнительная информация..."
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
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="flex-1"
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
