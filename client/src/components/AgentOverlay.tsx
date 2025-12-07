/**
 * AgentOverlay Component
 *
 * ЕСЛИ ПОТЕРЯЛ КОНТЕКСТ - ПРОЧИТАЙ BROWSER_AGENT_DEVELOPMENT.md!
 *
 * UI overlay для отображения работы AI Browser Agent:
 * - Затемнение экрана
 * - Live скриншот браузера агента
 * - Лог действий (что делает агент)
 * - Кнопка СТОП
 * - Индикатор "Агент думает..."
 *
 * ФАЗА 5: Frontend Overlay
 */

import { useState, useEffect } from "react";
import { useBrowserAgent, AgentAction } from "@/hooks/useBrowserAgent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Play,
  Square,
  Bot,
  MousePointer,
  Keyboard,
  ArrowDown,
  Clock,
  Navigation,
  CheckCircle,
  Loader2,
  Wifi,
  WifiOff,
  Brain,
} from "lucide-react";

interface AgentOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialTask?: string;
}

// Иконка для типа действия
function ActionIcon({ type }: { type: AgentAction["type"] }) {
  switch (type) {
    case "click":
      return <MousePointer className="h-4 w-4" />;
    case "type":
      return <Keyboard className="h-4 w-4" />;
    case "scroll":
      return <ArrowDown className="h-4 w-4" />;
    case "wait":
      return <Clock className="h-4 w-4" />;
    case "navigate":
      return <Navigation className="h-4 w-4" />;
    case "complete":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    default:
      return <Bot className="h-4 w-4" />;
  }
}

// Форматирование действия для отображения
function formatAction(action: AgentAction): string {
  switch (action.type) {
    case "click":
      if (action.params?.text) {
        return `Клик по "${action.params.text}"`;
      }
      if (action.params?.selector) {
        return `Клик по ${action.params.selector}`;
      }
      return "Клик";
    case "type":
      return `Ввод: "${action.params?.text || ""}"`;
    case "scroll":
      return `Скролл ${action.params?.y ? `на ${action.params.y}px` : ""}`;
    case "wait":
      return `Ожидание ${action.params?.ms || 1000}мс`;
    case "navigate":
      return `Переход на ${action.params?.url || ""}`;
    case "complete":
      return "Задача выполнена!";
    default:
      return action.type;
  }
}

export function AgentOverlay({ isOpen, onClose, initialTask = "" }: AgentOverlayProps) {
  const [task, setTask] = useState(initialTask);
  const {
    isConnected,
    session,
    screenshot,
    thinking,
    actions,
    error,
    startAgent,
    stopAgent,
  } = useBrowserAgent();

  // Обновляем задачу если передана извне
  useEffect(() => {
    if (initialTask) {
      setTask(initialTask);
    }
  }, [initialTask]);

  if (!isOpen) {
    return null;
  }

  const isRunning = session?.status === "running" || session?.status === "starting";
  const isCompleted = session?.status === "completed";

  const handleStart = () => {
    if (task.trim()) {
      startAgent(task.trim());
    }
  };

  const handleStop = () => {
    stopAgent();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isRunning && task.trim()) {
      handleStart();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Затемнение фона */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Основной контейнер */}
      <div className="relative z-10 w-full max-w-6xl h-[90vh] mx-4 flex gap-4">
        {/* Левая панель - Скриншот */}
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between py-3 px-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">AI Browser Agent</CardTitle>
              {isConnected ? (
                <Badge variant="outline" className="text-green-500 border-green-500">
                  <Wifi className="h-3 w-3 mr-1" />
                  Подключен
                </Badge>
              ) : (
                <Badge variant="outline" className="text-red-500 border-red-500">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Отключен
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col gap-3 p-4 overflow-hidden">
            {/* Ввод задачи */}
            <div className="flex gap-2">
              <Input
                placeholder="Введите задачу для агента..."
                value={task}
                onChange={(e) => setTask(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isRunning}
                className="flex-1"
              />
              {isRunning ? (
                <Button variant="destructive" onClick={handleStop}>
                  <Square className="h-4 w-4 mr-2" />
                  Стоп
                </Button>
              ) : (
                <Button onClick={handleStart} disabled={!task.trim() || !isConnected}>
                  <Play className="h-4 w-4 mr-2" />
                  Запустить
                </Button>
              )}
            </div>

            {/* Область скриншота */}
            <div className="flex-1 relative bg-muted rounded-lg overflow-hidden">
              {screenshot ? (
                <img
                  src={screenshot}
                  alt="Browser Screenshot"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  {isRunning ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span>Загрузка скриншота...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Bot className="h-12 w-12" />
                      <span>Введите задачу и нажмите "Запустить"</span>
                    </div>
                  )}
                </div>
              )}

              {/* Оверлей статуса */}
              {isCompleted && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-500/20">
                  <Badge className="text-lg py-2 px-4 bg-green-500">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Задача выполнена!
                  </Badge>
                </div>
              )}
            </div>

            {/* Индикатор мышления */}
            {thinking && isRunning && (
              <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
                <Brain className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm">{thinking}</p>
              </div>
            )}

            {/* Ошибка */}
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded-lg">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Правая панель - Лог действий */}
        <Card className="w-80 flex flex-col overflow-hidden">
          <CardHeader className="flex-shrink-0 py-3 px-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              История действий
              {actions.length > 0 && (
                <Badge variant="secondary">{actions.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {actions.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4">
                    Действия появятся здесь
                  </p>
                ) : (
                  actions.map((action, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        <ActionIcon type={action.type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {formatAction(action)}
                        </p>
                        {action.result && (
                          <p className="text-xs text-muted-foreground truncate">
                            {action.result}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        #{index + 1}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
