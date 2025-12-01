import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Calendar, User, Phone, Camera } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Installation, User as UserType, Project } from "@shared/schema";

export default function Installation() {
  const { toast } = useToast();

  const { data: installations = [], isLoading: installationsLoading, error } = useQuery<Installation[]>({
    queryKey: ["/api/installations"],
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  if (error) {
    toast({
      title: "Ошибка загрузки",
      description: "Не удалось загрузить данные о монтаже",
      variant: "destructive",
    });
  }

  const isLoading = installationsLoading || usersLoading || projectsLoading;

  const statusConfig = {
    scheduled: { label: "Запланирован", variant: "secondary" as const },
    in_progress: { label: "В работе", variant: "default" as const },
    completed: { label: "Завершен", variant: "outline" as const },
  };

  const getUserName = (userId: string | null) => {
    if (!userId) return "Не назначен";
    const user = users.find(u => u.id === userId);
    return user?.full_name || user?.username || "Не назначен";
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return "Проект";
    const project = projects.find(p => p.id === projectId);
    return project?.name || "Проект";
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Не установлен";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Монтаж</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Управление монтажными работами</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="icon"
            className="md:hidden"
            data-testid="button-create-installation"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button 
            className="hidden md:flex"
            data-testid="button-create-installation-desktop"
          >
            <Plus className="h-4 w-4 mr-2" />
            Новая задача
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-80" data-testid={`skeleton-installation-${i}`} />
          ))}
        </div>
      ) : installations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Нет запланированных монтажей
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {installations.map((installation) => (
            <Card key={installation.id} className="hover-elevate active-elevate-2" data-testid={`card-installation-${installation.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{getProjectName(installation.project_id)}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{installation.client_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {installation.project_id && (
                      <Badge variant="outline" className="font-mono text-xs">#{installation.project_id.slice(0, 8)}</Badge>
                    )}
                    <Badge variant={statusConfig[installation.status].variant}>
                      {statusConfig[installation.status].label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <span className="text-xs">{installation.address}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span className="text-xs">Дата монтажа</span>
                  </div>
                  <span className="text-xs font-medium">{formatDate(installation.date)}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="text-xs">Монтажник</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <UserAvatar name={getUserName(installation.installer_id)} size="sm" />
                    <span className="text-xs">{getUserName(installation.installer_id).split(" ")[0]}</span>
                  </div>
                </div>

                {installation.phone && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span className="text-xs">Телефон</span>
                    </div>
                    <span className="text-xs font-mono">{installation.phone}</span>
                  </div>
                )}

                {installation.payment && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">Оплата</span>
                    <span className="text-sm font-semibold">₽{parseFloat(installation.payment).toLocaleString()}</span>
                  </div>
                )}

                {installation.status === "in_progress" && (
                  <Button variant="outline" size="sm" className="w-full gap-2" data-testid={`button-upload-photo-${installation.id}`}>
                    <Camera className="h-4 w-4" />
                    Загрузить фото
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
