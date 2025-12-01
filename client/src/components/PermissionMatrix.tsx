import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Lock, Eye, Edit, Trash2, Play, CheckCircle2, Save, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { StagePermission } from "@shared/schema";
import {
  getAllRoles,
  getRoleIcon,
  getRoleColor,
  DEFAULT_PERMISSIONS,
  type ProjectRole,
  type PermissionAction,
} from "@/types/roles-permissions";

interface PermissionMatrixProps {
  className?: string;
}

type PermissionKey = 'can_read' | 'can_write' | 'can_delete' | 'can_start' | 'can_complete';

export function PermissionMatrix({ className }: PermissionMatrixProps) {
  const queryClient = useQueryClient();
  const [editedPermissions, setEditedPermissions] = useState<Record<string, StagePermission>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch stage types
  const { data: stageTypes = [] } = useQuery({
    queryKey: ["/api/stage-types"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/stage-types");
    },
  });

  // Fetch stage permissions
  const { data: permissions = [], isLoading } = useQuery<StagePermission[]>({
    queryKey: ["/api/stage-permissions"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/stage-permissions");
    },
  });

  // Save permissions mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async (permissionsToSave: StagePermission[]) => {
      await apiRequest("PUT", "/api/stage-permissions/bulk", {
        permissions: permissionsToSave,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stage-permissions"] });
      toast({
        description: "Разрешения сохранены",
      });
      setEditedPermissions({});
      setHasChanges(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Ошибка при сохранении разрешений",
      });
    },
  });

  // Reset to default permissions
  const resetToDefaultMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/stage-permissions/reset-defaults");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stage-permissions"] });
      toast({
        description: "Разрешения сброшены до значений по умолчанию",
      });
      setEditedPermissions({});
      setHasChanges(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Ошибка при сбросе разрешений",
      });
    },
  });

  // Получить разрешение для роли × стейджа
  const getPermission = (role: ProjectRole, stageTypeCode: string): StagePermission | undefined => {
    const key = `${role}_${stageTypeCode}`;

    // Сначала проверяем отредактированные
    if (editedPermissions[key]) {
      return editedPermissions[key];
    }

    // Затем из БД
    const existing = permissions.find(
      (p) => p.role === role && p.stage_type_code === stageTypeCode
    );

    return existing;
  };

  // Переключить разрешение
  const togglePermission = (
    role: ProjectRole,
    stageTypeCode: string,
    permissionKey: PermissionKey
  ) => {
    const key = `${role}_${stageTypeCode}`;
    const current = getPermission(role, stageTypeCode);

    const updated: StagePermission = current
      ? { ...current, [permissionKey]: !current[permissionKey] }
      : {
          id: key, // временный ID
          role,
          stage_type_code: stageTypeCode,
          can_read: permissionKey === 'can_read',
          can_write: permissionKey === 'can_write',
          can_delete: permissionKey === 'can_delete',
          can_start: permissionKey === 'can_start',
          can_complete: permissionKey === 'can_complete',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

    setEditedPermissions((prev) => ({
      ...prev,
      [key]: updated,
    }));
    setHasChanges(true);
  };

  // Сохранить изменения
  const handleSave = () => {
    const permissionsToSave = Object.values(editedPermissions);
    savePermissionsMutation.mutate(permissionsToSave);
  };

  // Отменить изменения
  const handleCancel = () => {
    setEditedPermissions({});
    setHasChanges(false);
  };

  // Сбросить к дефолтным
  const handleResetToDefault = () => {
    if (confirm("Вы уверены? Все текущие разрешения будут заменены на значения по умолчанию.")) {
      resetToDefaultMutation.mutate();
    }
  };

  // Иконки для действий
  const actionIcons: Record<PermissionKey, React.ReactNode> = {
    can_read: <Eye className="w-4 h-4" />,
    can_write: <Edit className="w-4 h-4" />,
    can_delete: <Trash2 className="w-4 h-4" />,
    can_start: <Play className="w-4 h-4" />,
    can_complete: <CheckCircle2 className="w-4 h-4" />,
  };

  const actionLabels: Record<PermissionKey, string> = {
    can_read: 'Просмотр',
    can_write: 'Редактирование',
    can_delete: 'Удаление',
    can_start: 'Запуск',
    can_complete: 'Завершение',
  };

  const allRoles = getAllRoles();
  const permissionKeys: PermissionKey[] = ['can_read', 'can_write', 'can_delete', 'can_start', 'can_complete'];

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <CardTitle>Матрица разрешений</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Отменить
                </Button>
                <Button size="sm" onClick={handleSave} disabled={savePermissionsMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {savePermissionsMutation.isPending ? "Сохранение..." : "Сохранить"}
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToDefault}
              disabled={resetToDefaultMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              По умолчанию
            </Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Настройте права доступа для каждой роли к различным типам этапов
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="space-y-6">
              {allRoles.map((roleInfo) => (
                <div key={roleInfo.role} className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-2xl">{roleInfo.icon}</span>
                    <div>
                      <h3 className="font-semibold">{roleInfo.name}</h3>
                      <p className="text-xs text-muted-foreground">{roleInfo.description}</p>
                    </div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Тип этапа</TableHead>
                        {permissionKeys.map((key) => (
                          <TableHead key={key} className="text-center">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center justify-center cursor-help">
                                    {actionIcons[key]}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{actionLabels[key]}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stageTypes.map((stageType: any) => {
                        const permission = getPermission(roleInfo.role, stageType.code);

                        return (
                          <TableRow key={stageType.code}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {stageType.icon && (
                                  <span className="text-lg">{stageType.icon}</span>
                                )}
                                <span className="font-medium">{stageType.name}</span>
                              </div>
                            </TableCell>
                            {permissionKeys.map((key) => (
                              <TableCell key={key} className="text-center">
                                <Checkbox
                                  checked={permission?.[key] || false}
                                  onCheckedChange={() =>
                                    togglePermission(roleInfo.role, stageType.code, key)
                                  }
                                  className={cn(
                                    editedPermissions[`${roleInfo.role}_${stageType.code}`] &&
                                      "border-orange-500"
                                  )}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {hasChanges && (
          <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-md">
            <p className="text-sm text-orange-700">
              У вас есть несохраненные изменения. Нажмите "Сохранить", чтобы применить их.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
