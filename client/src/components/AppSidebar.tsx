import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ShoppingCart,
  FolderKanban,
  Factory,
  Package,
  Truck,
  DollarSign,
  Hammer,
  Mail,
  CheckSquare,
  FileText,
  Bot,
  Settings,
  FileStack,
  Building2,
  Users,
  Kanban,
  Phone,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { UserAvatar } from "./UserAvatar";

const modules = [
  { title: "Продажи", url: "/sales", icon: ShoppingCart },
  { title: "Клиенты", url: "/clients", icon: Users },
  { title: "Проекты", url: "/projects", icon: FolderKanban },
  { title: "Монтаж", url: "/montage", icon: Hammer },
  { title: "Склад", url: "/warehouse", icon: Package },
  { title: "Поставщики", url: "/suppliers", icon: Building2 },
  { title: "Отгрузки", url: "/shipments", icon: Truck },
];

const tools = [
  { title: "Задачи", url: "/tasks", icon: CheckSquare },
  { title: "Доска", url: "/board", icon: Kanban },
  { title: "AI Телефония", url: "/telephony", icon: Phone },
];

interface AppSidebarProps {
  activeModule?: string;
}

export function AppSidebar({ activeModule = "/" }: AppSidebarProps) {
  const [userName, setUserName] = useState("Пользователь");
  const [userRole, setUserRole] = useState<{ name: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    const user = localStorage.getItem("user");

    if (role) {
      setUserRole(JSON.parse(role));
    }

    if (user) {
      const userData = JSON.parse(user);
      setUserName(userData.full_name || userData.username || "Пользователь");
      // Check if user is admin
      setIsAdmin(userData.username?.toLowerCase() === 'admin');
    }
  }, []);

  // Dynamically build settings menu based on admin status
  const settings = [
    { title: "Шаблоны процессов", url: "/process-templates", icon: FileStack },
    ...(isAdmin ? [{ title: "Настройки", url: "/settings", icon: Settings }] : []),
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <img
            src="/logo.png"
            alt="Emerald ERP"
            className="h-10 w-10 shrink-0 object-contain"
          />
          <div className="group-data-[collapsible=icon]:hidden overflow-hidden">
            <h2 className="font-semibold text-sidebar-foreground truncate">EMERALD</h2>
            <p className="text-xs text-muted-foreground truncate">Фабрика мебели</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Модули</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modules.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeModule === item.url}
                    tooltip={item.title}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Инструменты</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {tools.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeModule === item.url}
                    tooltip={item.title}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {settings.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeModule === item.url}
                    tooltip={item.title}
                    data-testid={`link-${item.title.toLowerCase()}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span className="group-data-[collapsible=icon]:hidden">{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <UserAvatar name={userName} size="sm" />
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden overflow-hidden">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
            <p className="text-xs text-muted-foreground truncate">{userRole?.name || "Сотрудник"}</p>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
