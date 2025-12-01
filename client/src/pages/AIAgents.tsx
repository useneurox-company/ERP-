import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, Plus, Settings as SettingsIcon, Zap } from "lucide-react";

export default function AIAgents() {
  // todo: remove mock functionality
  const agents = [
    {
      id: "1",
      name: "Агент-аналитик продаж",
      description: "Анализирует воронку продаж и предлагает рекомендации",
      status: "active" as const,
      lastRun: "2 часа назад",
    },
    {
      id: "2",
      name: "Агент-помощник менеджера",
      description: "Автоматически обрабатывает входящие заявки",
      status: "inactive" as const,
      lastRun: "Не запускался",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">ИИ Агенты</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Автоматизация с помощью искусственного интеллекта</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            size="icon"
            className="md:hidden"
            data-testid="button-add-agent"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Button 
            className="hidden md:flex"
            data-testid="button-add-agent-desktop"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить агента
          </Button>
        </div>
      </div>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 flex-shrink-0">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Функция находится в разработке</h3>
              <p className="text-sm text-muted-foreground">
                ИИ агенты помогут автоматизировать рутинные задачи: анализ сделок, обработка заявок, 
                генерация отчетов и многое другое. Интерфейс для управления агентами будет добавлен в следующих версиях.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => (
          <Card key={agent.id} className="hover-elevate" data-testid={`card-agent-${agent.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{agent.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{agent.description}</p>
                  </div>
                </div>
                <Badge variant={agent.status === "active" ? "default" : "secondary"}>
                  {agent.status === "active" ? "Активен" : "Неактивен"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Последний запуск</span>
                <span className="text-xs">{agent.lastRun}</span>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" className="flex-1" data-testid={`button-configure-${agent.id}`}>
                  <SettingsIcon className="h-3 w-3 mr-1" />
                  Настроить
                </Button>
                <Button variant="outline" size="sm" className="flex-1" data-testid={`button-run-${agent.id}`}>
                  <Zap className="h-3 w-3 mr-1" />
                  Запустить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
