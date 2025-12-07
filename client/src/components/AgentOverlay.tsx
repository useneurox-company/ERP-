/**
 * AgentOverlay Component
 *
 * UI overlay для работы AI Browser Agent ВНУТРИ текущего окна (как Comet):
 * - Полупрозрачный overlay поверх контента
 * - Live скриншот текущей страницы
 * - Лог действий агента
 * - Кнопка СТОП
 * - Индикатор "Агент думает..."
 *
 * Агент работает в ТОМ ЖЕ окне что и пользователь, не открывает отдельный браузер!
 */

import { useState, useEffect } from "react";
import { useInPageAgent, AgentAction } from "@/hooks/useInPageAgent";
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
  Brain,
  Eye,
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
    session,
    screenshot,
    thinking,
    actions,
    error,
    isRunning,
    startAgent,
    stopAgent,
  } = useInPageAgent();

  // Обновляем задачу если передана извне
  useEffect(() => {
    if (initialTask) {
      setTask(initialTask);
    }
  }, [initialTask]);

  if (!isOpen) {
    return null;
  }

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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-4"
      data-agent-overlay
    >
      {/* Полупрозрачный overlay - позволяет видеть страницу */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Компактная панель управления сверху */}
      <Card className="relative z-10 w-full max-w-4xl mx-4 shadow-2xl">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">AI Agent</CardTitle>
              </div>
              <Badge variant="outline" className="text-green-500 border-green-500">
                <Eye className="h-3 w-3 mr-1" />
                In-Page Mode
              </Badge>
              {session?.status && (
                <Badge variant={isCompleted ? "default" : "secondary"}>
                  {session.status}
                </Badge>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="py-3 px-4 space-y-3">
          {/* Ввод задачи */}
          <div className="flex gap-2">
            <Input
              placeholder="Введите задачу для агента... (например: 'Открой раздел Проекты')"
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
              <Button onClick={handleStart} disabled={!task.trim()}>
                <Play className="h-4 w-4 mr-2" />
                Запустить
              </Button>
            )}
          </div>

          {/* Индикатор мышления */}
          {thinking && isRunning && (
            <div className="flex items-start gap-2 p-3 bg-primary/10 rounded-lg">
              <Brain className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 animate-pulse" />
              <p className="text-sm">{thinking}</p>
            </div>
          )}

          {/* Ошибка */}
          {error && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Успешное завершение */}
          {isCompleted && (
            <div className="p-3 bg-green-500/10 text-green-700 rounded-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Задача выполнена!</span>
            </div>
          )}

          {/* История действий (компактная) */}
          {actions.length > 0 && (
            <div className="border rounded-lg">
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  История действий
                </span>
                <Badge variant="secondary">{actions.length}</Badge>
              </div>
              <ScrollArea className="max-h-32">
                <div className="p-2 space-y-1">
                  {actions.map((action, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-1.5 bg-muted/30 rounded text-xs"
                    >
                      <ActionIcon type={action.type} />
                      <span className="flex-1 truncate">{formatAction(action)}</span>
                      <span className="text-muted-foreground">#{index + 1}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Подсказка */}
          {!isRunning && !session && (
            <p className="text-xs text-muted-foreground text-center">
              Агент будет работать прямо в этом окне браузера, выполняя клики и ввод текста
            </p>
          )}

          {/* Индикатор работы */}
          {isRunning && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Агент работает... Следите за страницей</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
