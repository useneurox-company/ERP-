import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Role, RolePermission } from "@shared/schema";
import {
  Lock,
  Eye,
  FilePlus,
  FileEdit,
  Trash2,
  Users,
} from "lucide-react";

interface RolePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
}

const MODULES = [
  { id: "sales", name: "Сделки", icon: FilePlus },
  { id: "projects", name: "Проекты", icon: FileEdit },
  { id: "tasks", name: "Задачи", icon: FileEdit },
  { id: "warehouse", name: "Склад", icon: FilePlus },
  { id: "finance", name: "Финансы", icon: FilePlus },
  { id: "production", name: "Производство", icon: FileEdit },
  { id: "installations", name: "Монтаж", icon: FileEdit },
  { id: "documents", name: "Документы", icon: FilePlus },
  { id: "users", name: "Пользователи", icon: Users },
  { id: "settings", name: "Настройки", icon: Lock },
];

export function RolePermissionsDialog({ open, onOpenChange, role }: RolePermissionsDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<Map<string, any>>(new Map());

  const { data: roleData, isLoading } = useQuery<{ permissions: RolePermission[] }>({
    queryKey: [`/api/roles/${role?.id}/permissions`],
    enabled: !!role?.id && open,
  });

  useEffect(() => {
    if (roleData?.permissions) {
      const permMap = new Map();
      roleData.permissions.forEach((perm: RolePermission) => {
        permMap.set(perm.module, {
          id: perm.id,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
          view_all: perm.view_all,
        });
      });
      setPermissions(permMap);
    }
  }, [roleData]);

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ module, field, value }: { module: string; field: string; value: boolean }) => {
      const response = await fetch(`/api/roles/${role?.id}/permissions/${module}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to update permission");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roles/${role?.id}/permissions`] });
      toast({
        title: "Права обновлены",
        description: "Изменения сохранены",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить права доступа",
        variant: "destructive",
      });
    },
  });

  const handlePermissionChange = (module: string, field: string, value: boolean) => {
    // Optimistic update
    const newPermissions = new Map(permissions);
    const modulePerms = newPermissions.get(module) || {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
      view_all: false,
    };
    modulePerms[field] = value;
    newPermissions.set(module, modulePerms);
    setPermissions(newPermissions);

    // Update on server
    updatePermissionMutation.mutate({ module, field, value });
  };

  const getPermission = (module: string, field: string): boolean => {
    const modulePerms = permissions.get(module);
    return modulePerms ? modulePerms[field] : false;
  };

  if (!role) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{role.name}</span>
            {role.is_system && (
              <Badge variant="outline">Системная роль</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {role.description || "Управление правами доступа для этой роли"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
              <div className="col-span-2">Модуль</div>
              <div className="text-center">Просмотр</div>
              <div className="text-center">Создание</div>
              <div className="text-center">Редакт.</div>
              <div className="text-center">Удаление</div>
            </div>

            {MODULES.map((module) => {
              const ModuleIcon = module.icon;
              const canView = getPermission(module.id, "can_view");
              const canCreate = getPermission(module.id, "can_create");
              const canEdit = getPermission(module.id, "can_edit");
              const canDelete = getPermission(module.id, "can_delete");
              const viewAll = getPermission(module.id, "view_all");

              return (
                <div key={module.id} className="grid grid-cols-6 gap-2 items-center p-3 rounded-md border">
                  <div className="col-span-2 flex items-center gap-2">
                    <ModuleIcon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{module.name}</p>
                      {viewAll && (
                        <Badge variant="secondary" className="text-xs mt-1">
                          Все данные
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Checkbox
                      checked={canView}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(module.id, "can_view", checked as boolean)
                      }
                      disabled={role.is_system && role.name === "Администратор"}
                    />
                  </div>

                  <div className="flex justify-center">
                    <Checkbox
                      checked={canCreate}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(module.id, "can_create", checked as boolean)
                      }
                      disabled={!canView || (role.is_system && role.name === "Администратор")}
                    />
                  </div>

                  <div className="flex justify-center">
                    <Checkbox
                      checked={canEdit}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(module.id, "can_edit", checked as boolean)
                      }
                      disabled={!canView || (role.is_system && role.name === "Администратор")}
                    />
                  </div>

                  <div className="flex justify-center">
                    <Checkbox
                      checked={canDelete}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(module.id, "can_delete", checked as boolean)
                      }
                      disabled={!canView || (role.is_system && role.name === "Администратор")}
                    />
                  </div>

                  {canView && (
                    <div className="col-span-6 mt-2 pt-2 border-t flex items-center gap-2">
                      <Checkbox
                        id={`${module.id}-view-all`}
                        checked={viewAll}
                        onCheckedChange={(checked) =>
                          handlePermissionChange(module.id, "view_all", checked as boolean)
                        }
                        disabled={role.is_system && role.name === "Администратор"}
                      />
                      <Label
                        htmlFor={`${module.id}-view-all`}
                        className="text-xs text-muted-foreground cursor-pointer"
                      >
                        Видеть все данные (не только свои)
                      </Label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
