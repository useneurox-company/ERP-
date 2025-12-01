import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Bell, Search, Bot, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "./ThemeToggle";
import { UserAvatar } from "./UserAvatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TopBarProps {
  onAssistantToggle?: () => void;
  isAssistantOpen?: boolean;
}

export function TopBar({ onAssistantToggle, isAssistantOpen }: TopBarProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [userRole, setUserRole] = useState<any>(null);
  const [userName, setUserName] = useState<string>("Пользователь");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    const user = localStorage.getItem("user");

    if (role) {
      setUserRole(JSON.parse(role));
    }

    if (user) {
      const userData = JSON.parse(user);
      setUserName(userData.full_name || userData.username || "Пользователь");
    }
  }, []);

  // Скрываем toggle sidebar для роли замерщика
  const showSidebarToggle = userRole?.name !== 'Замерщик';

  // Функция выхода из системы
  const handleLogout = () => {
    // Очищаем localStorage
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userPermissions");
    localStorage.removeItem("currentUserId");

    // Показываем уведомление
    toast({
      description: "Вы успешно вышли из системы",
    });

    // Перенаправляем на страницу входа
    setLocation("/login");

    // Перезагружаем страницу
    window.location.reload();
  };

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-2 md:gap-4 border-b bg-background px-4 md:px-6">
      {showSidebarToggle && <SidebarTrigger data-testid="button-sidebar-toggle" />}
      
      {/* Desktop Search - visible on md and above */}
      <div className="hidden md:flex flex-1 items-center gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Поиск по системе..."
            className="pl-9"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Mobile Search Button - visible only on small screens */}
      <div className="flex md:hidden flex-1 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="hover-elevate active-elevate-2"
          onClick={() => setSearchOpen(true)}
          data-testid="button-mobile-search"
        >
          <Search className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Search Sheet */}
      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="top" className="w-full">
          <SheetHeader>
            <SheetTitle>Поиск</SheetTitle>
            <SheetDescription>
              Поиск по всей системе
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Поиск по системе..."
                className="pl-9"
                data-testid="input-search-mobile"
                autoFocus
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-1 md:gap-2">
        {/* Assistant Toggle Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isAssistantOpen ? "default" : "ghost"}
              size="icon"
              onClick={onAssistantToggle}
              className="hover-elevate active-elevate-2"
              data-testid="button-assistant-toggle"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Ассистент</p>
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative hover-elevate active-elevate-2"
              data-testid="button-notifications"
            >
              <Bell className="h-5 w-5" />
              <Badge
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                variant="destructive"
              >
                3
              </Badge>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Уведомления</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Новый заказ клиента</p>
                <p className="text-xs text-muted-foreground">ООО "Интерьер Плюс" #1234</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Просрочен этап замера</p>
                <p className="text-xs text-muted-foreground">Проект #567</p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">Низкий остаток на складе</p>
                <p className="text-xs text-muted-foreground">МДФ 18мм - осталось 15 листов</p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 hover-elevate active-elevate-2"
              data-testid="button-user-menu"
            >
              <UserAvatar name={userName} size="sm" />
              <span className="hidden md:inline text-sm">{userName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">Профиль</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">Настройки</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
