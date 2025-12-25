import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { UserPermissionsSection } from "@/components/UserPermissionsSection";
import { Separator } from "@/components/ui/separator";
import type { User, Role } from "@shared/schema";

interface UserFormData {
  username: string;
  password?: string;
  email?: string;
  full_name?: string;
  phone?: string;
  role_id?: string;
  is_active: boolean;
  can_view_financial: boolean;
}

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User & { role?: Role };
  mode: "create" | "edit";
}

export function UserFormDialog({ open, onOpenChange, user, mode }: UserFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | undefined>(user?.role_id || undefined);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<UserFormData>({
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      full_name: user?.full_name || "",
      phone: user?.phone || "",
      role_id: user?.role_id || undefined,
      is_active: user?.is_active ?? true,
      can_view_financial: user?.can_view_financial ?? false,
    }
  });

  const canViewFinancial = watch("can_view_financial");

  // Load roles
  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ["/api/roles"],
  });

  useEffect(() => {
    if (user) {
      reset({
        username: user.username,
        email: user.email || "",
        full_name: user.full_name || "",
        phone: user.phone || "",
        role_id: user.role_id || undefined,
        is_active: user.is_active ?? true,
        can_view_financial: user.can_view_financial ?? false,
      });
      setSelectedRoleId(user.role_id || undefined);
    } else {
      reset({
        username: "",
        email: "",
        full_name: "",
        phone: "",
        role_id: undefined,
        is_active: true,
        can_view_financial: false,
      });
      setSelectedRoleId(undefined);
    }
  }, [user, reset]);

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      return await apiRequest("POST", "/api/users", data);
    },
    onSuccess: async (newUser) => {
      try {
        // If role is selected, assign it
        if (selectedRoleId) {
          await apiRequest("PUT", `/api/users/${newUser.id}/role`, { roleId: selectedRoleId });
        }

        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        toast({
          title: "Пользователь создан",
          description: "Новый пользователь успешно добавлен в систему",
        });
        onOpenChange(false);
        reset();
      } catch (error) {
        // User created but role assignment failed
        queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        toast({
          title: "Пользователь создан",
          description: "Но не удалось назначить роль. Назначьте роль вручную.",
          variant: "destructive",
        });
        onOpenChange(false);
        reset();
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      if (!user) {
        throw new Error("User not found");
      }

      // Update user info
      const updateData: Partial<UserFormData> & { password?: string } = {
        email: data.email,
        full_name: data.full_name,
        phone: data.phone,
        can_view_financial: data.can_view_financial,
      };

      // Only include password if it's provided
      if (data.password && data.password.trim() !== "") {
        updateData.password = data.password;
      }

      const result = await apiRequest("PUT", `/api/users/${user.id}`, updateData);

      // Update role if changed
      if (selectedRoleId !== user.role_id) {
        await apiRequest("PUT", `/api/users/${user.id}/role`, { roleId: selectedRoleId || null });
      }

      // Update active status if changed
      if (data.is_active !== user.is_active) {
        await apiRequest("PUT", `/api/users/${user.id}/status`, { isActive: data.is_active });
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Изменения сохранены",
        description: "Данные пользователя обновлены",
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

  const onSubmit = (data: UserFormData) => {
    // Convert "none" to undefined for "No role" selection
    data.role_id = selectedRoleId === "none" ? undefined : selectedRoleId;
    if (mode === "create") {
      if (!data.password || data.password.trim() === "") {
        toast({
          title: "Ошибка",
          description: "Пароль обязателен при создании пользователя",
          variant: "destructive",
        });
        return;
      }
      createUserMutation.mutate(data);
    } else {
      updateUserMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Создать пользователя" : "Редактировать пользователя"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Добавьте нового пользователя в систему"
              : "Измените данные пользователя"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Имя пользователя *</Label>
            <Input
              id="username"
              {...register("username", { required: "Обязательное поле" })}
              disabled={mode === "edit"}
              placeholder="ivanov"
            />
            {errors.username && (
              <p className="text-sm text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {mode === "create" ? "Пароль *" : "Новый пароль (оставьте пустым, чтобы не менять)"}
            </Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="full_name">Полное имя</Label>
            <Input
              id="full_name"
              {...register("full_name")}
              placeholder="Иванов Иван Иванович"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="ivanov@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Роль</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Без роли</SelectItem>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "edit" && (
            <>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="is_active" className="flex flex-col space-y-1">
                  <span>Активный пользователь</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    Неактивные пользователи не могут входить в систему
                  </span>
                </Label>
                <Switch
                  id="is_active"
                  defaultChecked={user?.is_active ?? true}
                  onCheckedChange={(checked) => setValue("is_active", checked)}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="can_view_financial" className="flex flex-col space-y-1">
                  <span>Видеть фин документы</span>
                  <span className="font-normal text-sm text-muted-foreground">
                    Доступ к финансовым документам (счета, КП, договора)
                  </span>
                </Label>
                <Switch
                  id="can_view_financial"
                  checked={canViewFinancial}
                  onCheckedChange={(checked) => setValue("can_view_financial", checked)}
                />
              </div>
            </>
          )}

          {mode === "edit" && user && (
            <>
              <Separator className="my-4" />
              <UserPermissionsSection userId={user.id} roleId={user.role_id} />
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
            >
              {mode === "create" ? "Создать" : "Сохранить"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
