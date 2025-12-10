import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { LightboxProvider } from "@/contexts/LightboxContext";
import { AppSidebar } from "@/components/AppSidebar";
import { TopBar } from "@/components/TopBar";
import { AssistantPanel } from "@/components/AssistantPanel";
import Dashboard from "@/pages/Dashboard";
import Sales from "@/pages/Sales";
import Projects from "@/pages/Projects";
import ProjectDetailPage from "@/pages/ProjectDetailPage";
import Production from "@/pages/Production";
import Warehouse from "@/pages/Warehouse";
import Suppliers from "@/pages/Suppliers";
import Clients from "@/pages/Clients";
import Shipments from "@/pages/Shipments";
import ShipmentScanner from "@/pages/ShipmentScanner";
import ShipmentDetail from "@/pages/ShipmentDetail";
import Finance from "@/pages/Finance";
import Installation from "@/pages/Installation";
import Montage from "@/pages/Montage"; // Montage module
import Mail from "@/pages/Mail";
import Documents from "@/pages/Documents";
import AIAgents from "@/pages/AIAgents";
import Tasks from "@/pages/Tasks";
import Settings from "@/pages/Settings";
import ProcessTemplates from "@/pages/ProcessTemplates";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import { useEffect, useState } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/sales" component={Sales} />
      <Route path="/projects/:id" component={ProjectDetailPage} />
      <Route path="/projects" component={Projects} />
      <Route path="/production" component={Production} />
      <Route path="/warehouse" component={Warehouse} />
      <Route path="/suppliers" component={Suppliers} />
      <Route path="/clients" component={Clients} />
      <Route path="/shipments/new" component={ShipmentScanner} />
      <Route path="/shipments/:id" component={ShipmentDetail} />
      <Route path="/shipments" component={Shipments} />
      <Route path="/finance" component={Finance} />
      <Route path="/installation" component={Installation} />
      <Route path="/montage" component={Montage} />
      <Route path="/mail" component={Mail} />
      <Route path="/documents" component={Documents} />
      <Route path="/ai-agents" component={AIAgents} />
      <Route path="/tasks" component={Tasks} />
      <Route path="/process-templates" component={ProcessTemplates} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

// Ключ для хранения состояния агента (должен совпадать с useInPageAgent.ts)
const AGENT_STATE_KEY = 'emerald_agent_state';

function AppContent() {
  const [location] = useLocation();
  const [userRole, setUserRole] = useState<any>(null);
  // Проверяем сохранённое состояние агента при инициализации
  const [assistantOpen, setAssistantOpen] = useState(() => {
    try {
      const agentState = sessionStorage.getItem(AGENT_STATE_KEY);
      if (agentState) {
        const state = JSON.parse(agentState);
        // Если состояние не старше 5 минут - агент работал, открываем чат
        if (Date.now() - state.timestamp < 5 * 60 * 1000) {
          console.log('[App] Agent state found, opening assistant panel');
          return true;
        }
      }
    } catch { /* ignore */ }
    return false;
  });
  const [assistantMinimized, setAssistantMinimized] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("userRole");
    if (role) {
      try {
        setUserRole(JSON.parse(role));
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, []);

  // Скрываем sidebar для роли замерщика
  const showSidebar = userRole?.name !== 'Замерщик';

  const handleAssistantToggle = () => {
    if (assistantOpen && assistantMinimized) {
      // If minimized, expand it
      setAssistantMinimized(false);
    } else {
      // Toggle open/close
      setAssistantOpen(!assistantOpen);
      setAssistantMinimized(false);
    }
  };

  const handleAssistantClose = () => {
    setAssistantOpen(false);
    setAssistantMinimized(false);
  };

  const handleAssistantMinimize = () => {
    setAssistantMinimized(!assistantMinimized);
  };

  return (
    <div className="flex h-screen w-full">
      {showSidebar && <AppSidebar activeModule={location} />}
      <div className="flex flex-col flex-1">
        <TopBar
          onAssistantToggle={handleAssistantToggle}
          isAssistantOpen={assistantOpen && !assistantMinimized}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6 bg-background">
          <Router />
        </main>
      </div>
      <AssistantPanel
        isOpen={assistantOpen}
        onClose={handleAssistantClose}
        isMinimized={assistantMinimized}
        onMinimize={handleAssistantMinimize}
      />
    </div>
  );
}

function App() {
  const [location, setLocation] = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Проверяем авторизацию при загрузке
    const user = localStorage.getItem("user");

    if (user) {
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
      // Если не на странице логина, перенаправляем на неё
      if (location !== "/login") {
        setLocation("/login");
      }
    }

    setIsLoading(false);
  }, [location, setLocation]);

  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  // Показываем загрузку пока проверяем аутентификацию
  if (isLoading) {
    return null;
  }

  // Если не авторизован и на странице логина, показываем только логин
  if (!isAuthenticated && location === "/login") {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Login />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Если не авторизован и не на странице логина, перенаправляем
  if (!isAuthenticated) {
    return (
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Redirect to="/login" />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    );
  }

  // Если авторизован, показываем основное приложение
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LightboxProvider>
          <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
            <AppContent />
          </SidebarProvider>
        </LightboxProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
