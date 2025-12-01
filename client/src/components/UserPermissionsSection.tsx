import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ModulePermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  view_all: boolean;
  hide_prices: boolean;
}

interface RolePermission {
  id: string;
  role_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  view_all: boolean;
  hide_prices: boolean;
}

interface UserPermission {
  id: string;
  user_id: string;
  module: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  view_all: boolean;
  hide_prices: boolean;
}

interface UserPermissionsSectionProps {
  userId: string;
  roleId: string | null;
}

const MODULES = [
  { id: "sales", name: "Продажи" },
  { id: "projects", name: "Проекты" },
  { id: "warehouse", name: "Склад" },
  { id: "finance", name: "Финансы" },
  { id: "tasks", name: "Задачи" },
];

const PERMISSION_LABELS = {
  can_create: "Создание",
  can_edit: "Редактирование",
  can_delete: "Удаление",
  hide_prices: "Скрыть цены",
};

export function UserPermissionsSection({ userId, roleId }: UserPermissionsSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [localPermissions, setLocalPermissions] = useState<Record<string, ModulePermissions>>({});

  // Fetch user permissions (role + individual)
  const { data: permissionsData, isLoading } = useQuery<{
    rolePermissions: RolePermission[];
    individualPermissions: UserPermission[];
  }>({
    queryKey: [`/api/users/${userId}/permissions`],
    queryFn: async () => {
      const response = await fetch(`/api/users/${userId}/permissions`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch permissions");
      return response.json();
    },
    enabled: !!userId,
  });

  // Initialize local permissions from fetched data
  useEffect(() => {
    if (permissionsData) {
      const perms: Record<string, ModulePermissions> = {};

      // First, add role permissions
      permissionsData.rolePermissions?.forEach((perm) => {
        perms[perm.module] = {
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
          view_all: perm.view_all,
          hide_prices: perm.hide_prices || false,
        };
      });

      // Then override with individual permissions
      permissionsData.individualPermissions?.forEach((perm) => {
        perms[perm.module] = {
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
          view_all: perm.view_all,
          hide_prices: perm.hide_prices || false,
        };
      });

      setLocalPermissions(perms);
    }
  }, [permissionsData]);

  // Update permission mutation
  const updatePermissionMutation = useMutation({
    mutationFn: async ({ module, permissions }: { module: string; permissions: ModulePermissions }) => {
      const response = await fetch(`/api/users/${userId}/permissions/${module}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permissions),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update permission");
      }
      return response.json();
    },
    onSuccess: (_, { module }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/permissions`] });
      toast({
        title: "Права обновлены",
        description: `Права для модуля "${MODULES.find(m => m.id === module)?.name}" сохранены`,
      });
      setEditingModule(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete permission mutation (reset to role)
  const deletePermissionMutation = useMutation({
    mutationFn: async (module: string) => {
      const response = await fetch(`/api/users/${userId}/permissions/${module}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok && response.status !== 404) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete permission");
      }
    },
    onSuccess: (_, module) => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${userId}/permissions`] });
      toast({
        title: "Сброс прав",
        description: `Индивидуальные права для модуля "${MODULES.find(m => m.id === module)?.name}" удалены`,
      });
      setEditingModule(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handlePermissionChange = (module: string, field: keyof ModulePermissions, value: boolean) => {
    setLocalPermissions((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [field]: value,
      },
    }));
  };

  const handleSave = (module: string) => {
    const permissions = localPermissions[module];
    if (permissions) {
      updatePermissionMutation.mutate({ module, permissions });
    }
  };

  const handleReset = (module: string) => {
    deletePermissionMutation.mutate(module);
  };

  const isIndividualPermission = (module: string): boolean => {
    return permissionsData?.individualPermissions?.some((p) => p.module === module) || false;
  };

  const getRolePermission = (module: string): RolePermission | undefined => {
    return permissionsData?.rolePermissions?.find((p) => p.module === module);
  };

  const overrideCount = permissionsData?.individualPermissions?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span>Индивидуальные права доступа</span>
          <div className="flex items-center gap-2">
            {overrideCount > 0 && (
              <Badge variant="secondary">{overrideCount} переопределений</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {isOpen ? "Скрыть" : "Показать"}
            </span>
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4 space-y-4">
        {!roleId && (
          <div className="p-4 rounded-md bg-muted/50">
            <p className="text-sm text-muted-foreground">
              У пользователя нет роли. Настройте индивидуальные права для каждого модуля.
            </p>
          </div>
        )}

        {MODULES.map((module) => {
          const rolePermission = getRolePermission(module.id);
          const hasIndividualPermission = isIndividualPermission(module.id);
          const currentPermissions = localPermissions[module.id] || {
            can_view: true,  // По умолчанию разрешаем просмотр
            can_create: false,
            can_edit: false,
            can_delete: false,
            view_all: false,
            hide_prices: false,
          };
          const isEditing = editingModule === module.id;

          return (
            <Card key={module.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{module.name}</CardTitle>
                    {hasIndividualPermission && (
                      <Badge variant="default" className="text-xs">Переопределено</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasIndividualPermission && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReset(module.id)}
                        disabled={deletePermissionMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Сбросить
                      </Button>
                    )}
                    {isEditing ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingModule(null)}
                        >
                          Отмена
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleSave(module.id)}
                          disabled={updatePermissionMutation.isPending}
                        >
                          Сохранить
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingModule(module.id)}
                      >
                        Изменить
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {rolePermission && !hasIndividualPermission && (
                  <div className="text-xs text-muted-foreground mb-2">
                    Права от роли (базовые)
                  </div>
                )}

                {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                  const permKey = key as keyof ModulePermissions;
                  const value = currentPermissions[permKey];

                  return (
                    <div key={key} className="flex items-center justify-between">
                      <Label htmlFor={`${module.id}-${key}`} className="text-sm">
                        {label}
                      </Label>
                      <Switch
                        id={`${module.id}-${key}`}
                        checked={value}
                        onCheckedChange={(checked) =>
                          handlePermissionChange(module.id, permKey, checked)
                        }
                        disabled={!isEditing}
                      />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
