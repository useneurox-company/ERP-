import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, DollarSign, Factory, Package, TrendingUp, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  // todo: remove mock functionality
  const recentTasks = [
    {
      id: "101",
      title: "Согласовать чертежи с клиентом",
      assignee: "Петр Козлов",
      priority: "high" as const,
      deadline: "10.11.2025",
      attachments: 3,
      comments: 5,
    },
    {
      id: "102",
      title: "Заказать фурнитуру у поставщика",
      assignee: "Ольга Смирнова",
      priority: "medium" as const,
      deadline: "12.11.2025",
      attachments: 1,
      comments: 2,
    },
  ];

  const alerts = [
    { type: "Склад", message: "МДФ 18мм - критический остаток (15 листов)", severity: "high" },
    { type: "Проект", message: "Проект #567 - просрочен этап замера", severity: "high" },
    { type: "Производство", message: "3 сменных задания просрочены", severity: "medium" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-1">Общий обзор системы</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Активные сделки"
          value="24"
          change="+12% от прошлого месяца"
          changeType="positive"
          icon={ShoppingCart}
        />
        <StatCard
          title="Выручка"
          value="₽4.2М"
          change="+8% от прошлого месяца"
          changeType="positive"
          icon={DollarSign}
        />
        <StatCard
          title="В производстве"
          value="18"
          change="3 просрочено"
          changeType="negative"
          icon={Factory}
        />
        <StatCard
          title="На складе"
          value="156"
          change="15 критический остаток"
          changeType="neutral"
          icon={Package}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task card section temporarily disabled - TaskCard component needs to be reimplemented */}
        {/* <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Мои задачи
              </CardTitle>
              <Badge variant="secondary">2</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTasks.map((task) => (
              <TaskCard key={task.id} {...task} />
            ))}
          </CardContent>
        </Card> */}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Требуют внимания
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-md bg-muted/50 hover-elevate"
              >
                <AlertTriangle className={`h-4 w-4 mt-0.5 ${alert.severity === "high" ? "text-destructive" : "text-yellow-600 dark:text-yellow-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{alert.type}</p>
                  <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
