import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserPlus, Trash2, Shield, Search, Filter } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { UserRole } from "@shared/schema";
import {
  getAllRoles,
  getRoleInfo,
  getRoleColor,
  getRoleIcon,
  type ProjectRole,
  type UserRoleAssignment,
} from "@/types/roles-permissions";

interface RoleManagementProps {
  projectId?: string; // если указан, показываем только роли для этого проекта
  className?: string;
}

export function RoleManagement({ projectId, className }: RoleManagementProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Fetch user roles
  const { data: userRoles = [], isLoading } = useQuery<UserRole[]>({
    queryKey: ["/api/user-roles", projectId],
    queryFn: async () => {
      const url = projectId
        ? `/api/user-roles?projectId=${projectId}`
        : "/api/user-roles";
      return await apiRequest("GET", url);
    },
  });

  // Fetch users for assignment dropdown
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/users");
    },
  });

  // Fetch projects for project dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      return await apiRequest("GET", "/api/projects");
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await apiRequest("DELETE", `/api/user-roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
      toast({
        description: "Роль удалена",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Ошибка при удалении роли",
      });
    },
  });

  // Filter and search roles
  const filteredRoles = userRoles.filter((userRole) => {
    // Фильтр по роли
    if (roleFilter !== "all" && userRole.role !== roleFilter) {
      return false;
    }

    // Поиск по имени пользователя
    if (searchQuery) {
      const user = users.find((u: any) => u.id === userRole.user_id);
      const userName = user?.full_name || user?.username || "";
      if (!userName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    return true;
  });

  // Группируем роли по пользователям
  const rolesByUser = filteredRoles.reduce((acc, role) => {
    if (!acc[role.user_id]) {
      acc[role.user_id] = [];
    }
    acc[role.user_id].push(role);
    return acc;
  }, {} as Record<string, UserRole[]>);

  const handleDeleteRole = (roleId: string) => {
    if (confirm("Вы уверены, что хотите удалить эту роль?")) {
      deleteRoleMutation.mutate(roleId);
    }
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle>
              {projectId ? "Роли участников проекта" : "Управление ролями"}
            </CardTitle>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Назначить роль
              </Button>
            </DialogTrigger>
            <AddRoleDialog
              projectId={projectId}
              users={users}
              projects={projects}
              onSuccess={() => {
                setIsAddDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/user-roles"] });
              }}
            />
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Фильтры */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по имени пользователя..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-[200px]">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Все роли" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все роли</SelectItem>
                {getAllRoles().map((role) => (
                  <SelectItem key={role.role} value={role.role}>
                    {role.icon} {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Таблица ролей */}
        <ScrollArea className="h-[500px]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Загрузка...
            </div>
          ) : Object.keys(rolesByUser).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Нет назначенных ролей</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Пользователь</TableHead>
                  <TableHead>Роли</TableHead>
                  {!projectId && <TableHead>Проект</TableHead>}
                  <TableHead className="w-[100px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(rolesByUser).map(([userId, roles]) => {
                  const user = users.find((u: any) => u.id === userId);
                  const userName = user?.full_name || user?.username || "Неизвестный пользователь";

                  return roles.map((role) => {
                    const roleInfo = getRoleInfo(role.role as ProjectRole);
                    const project = role.project_id
                      ? projects.find((p: any) => p.id === role.project_id)
                      : null;

                    return (
                      <TableRow key={role.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{userName}</p>
                            <p className="text-xs text-muted-foreground">
                              {user?.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-sm",
                              getRoleColor(role.role as ProjectRole) === "blue" && "bg-blue-100 text-blue-700 border-blue-200",
                              getRoleColor(role.role as ProjectRole) === "green" && "bg-green-100 text-green-700 border-green-200",
                              getRoleColor(role.role as ProjectRole) === "purple" && "bg-purple-100 text-purple-700 border-purple-200",
                              getRoleColor(role.role as ProjectRole) === "orange" && "bg-orange-100 text-orange-700 border-orange-200",
                              getRoleColor(role.role as ProjectRole) === "red" && "bg-red-100 text-red-700 border-red-200",
                              getRoleColor(role.role as ProjectRole) === "cyan" && "bg-cyan-100 text-cyan-700 border-cyan-200"
                            )}
                          >
                            {getRoleIcon(role.role as ProjectRole)} {roleInfo.name}
                          </Badge>
                        </TableCell>
                        {!projectId && (
                          <TableCell>
                            {project ? (
                              <span className="text-sm">{project.name}</span>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Глобальная
                              </Badge>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRole(role.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  });
                })}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Dialog для добавления роли
interface AddRoleDialogProps {
  projectId?: string;
  users: any[];
  projects: any[];
  onSuccess: () => void;
}

function AddRoleDialog({
  projectId,
  users,
  projects,
  onSuccess,
}: AddRoleDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<ProjectRole | "">("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(
    projectId
  );

  const addRoleMutation = useMutation({
    mutationFn: async (data: {
      user_id: string;
      role: string;
      project_id?: string;
    }) => {
      await apiRequest("POST", "/api/user-roles", data);
    },
    onSuccess: () => {
      toast({
        description: "Роль назначена",
      });
      onSuccess();
      // Reset form
      setSelectedUserId("");
      setSelectedRole("");
      if (!projectId) {
        setSelectedProjectId(undefined);
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Ошибка при назначении роли",
      });
    },
  });

  const handleSubmit = () => {
    if (!selectedUserId || !selectedRole) {
      toast({
        variant: "destructive",
        description: "Заполните все обязательные поля",
      });
      return;
    }

    addRoleMutation.mutate({
      user_id: selectedUserId,
      role: selectedRole,
      project_id: selectedProjectId,
    });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Назначить роль пользователю</DialogTitle>
        <DialogDescription>
          Выберите пользователя, роль и проект (если нужно)
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        {/* Пользователь */}
        <div className="space-y-2">
          <Label htmlFor="user">Пользователь *</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger id="user">
              <SelectValue placeholder="Выберите пользователя" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user: any) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name || user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Роль */}
        <div className="space-y-2">
          <Label htmlFor="role">Роль *</Label>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as ProjectRole)}>
            <SelectTrigger id="role">
              <SelectValue placeholder="Выберите роль" />
            </SelectTrigger>
            <SelectContent>
              {getAllRoles().map((role) => (
                <SelectItem key={role.role} value={role.role}>
                  <div className="flex items-center gap-2">
                    <span>{role.icon}</span>
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {role.description}
                      </p>
                    </div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Проект (если не задан в props) */}
        {!projectId && (
          <div className="space-y-2">
            <Label htmlFor="project">Проект (опционально)</Label>
            <Select
              value={selectedProjectId || "global"}
              onValueChange={(v) =>
                setSelectedProjectId(v === "global" ? undefined : v)
              }
            >
              <SelectTrigger id="project">
                <SelectValue placeholder="Выберите проект" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  <Badge variant="secondary">Глобальная роль</Badge>
                </SelectItem>
                {projects.map((project: any) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Глобальная роль действует на все проекты
            </p>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button
          onClick={handleSubmit}
          disabled={addRoleMutation.isPending || !selectedUserId || !selectedRole}
        >
          {addRoleMutation.isPending ? "Сохранение..." : "Назначить роль"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
