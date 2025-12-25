import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Trash2,
  MoreHorizontal,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Calendar,
  User,
  EyeOff,
  Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { apiRequest } from "@/lib/queryClient";

interface ChecklistItem {
  id: string;
  checklist_id: string;
  task_id: string;
  item_text: string;
  is_completed: boolean;
  order: number;
  deadline: string | null;
  assignee_id: string | null;
  assignee?: {
    id: string;
    username: string;
    full_name: string | null;
  } | null;
}

interface Checklist {
  id: string;
  task_id: string;
  name: string;
  order: number;
  hide_completed: boolean;
  items: ChecklistItem[];
  progress: {
    completed: number;
    total: number;
    percentage: number;
  };
}

interface User {
  id: string;
  username: string;
  full_name: string | null;
}

interface ChecklistSectionProps {
  taskId: string;
  users: User[];
}

export function ChecklistSection({ taskId, users }: ChecklistSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newChecklistName, setNewChecklistName] = useState("");
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});
  const [expandedChecklists, setExpandedChecklists] = useState<Record<string, boolean>>({});
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingItemText, setEditingItemText] = useState("");

  // Fetch checklists
  const { data: checklists = [], isLoading } = useQuery<Checklist[]>({
    queryKey: [`/api/tasks/${taskId}/checklists`],
    enabled: !!taskId,
  });

  // Create checklist mutation
  const createChecklistMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", `/api/tasks/${taskId}/checklists`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/checklists`] });
      setNewChecklistName("");
      setShowAddChecklist(false);
      toast({ title: "Чеклист создан" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать чеклист", variant: "destructive" });
    },
  });

  // Update checklist mutation
  const updateChecklistMutation = useMutation({
    mutationFn: async ({ checklistId, data }: { checklistId: string; data: Partial<Checklist> }) => {
      return apiRequest("PUT", `/api/tasks/${taskId}/checklists/${checklistId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/checklists`] });
    },
  });

  // Delete checklist mutation
  const deleteChecklistMutation = useMutation({
    mutationFn: async (checklistId: string) => {
      return apiRequest("DELETE", `/api/tasks/${taskId}/checklists/${checklistId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/checklists`] });
      toast({ title: "Чеклист удалён" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить чеклист", variant: "destructive" });
    },
  });

  // Create item mutation
  const createItemMutation = useMutation({
    mutationFn: async ({ checklistId, item_text }: { checklistId: string; item_text: string }) => {
      return apiRequest("POST", `/api/tasks/${taskId}/checklists/${checklistId}/items`, { item_text });
    },
    onSuccess: (_, { checklistId }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/checklists`] });
      setNewItemText((prev) => ({ ...prev, [checklistId]: "" }));
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось добавить элемент", variant: "destructive" });
    },
  });

  // Update item mutation
  const updateItemMutation = useMutation({
    mutationFn: async ({
      checklistId,
      itemId,
      data,
    }: {
      checklistId: string;
      itemId: string;
      data: Partial<ChecklistItem>;
    }) => {
      return apiRequest("PUT", `/api/tasks/${taskId}/checklists/${checklistId}/items/${itemId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/checklists`] });
      setEditingItem(null);
    },
  });

  // Delete item mutation
  const deleteItemMutation = useMutation({
    mutationFn: async ({ checklistId, itemId }: { checklistId: string; itemId: string }) => {
      return apiRequest("DELETE", `/api/tasks/${taskId}/checklists/${checklistId}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/checklists`] });
    },
  });

  const handleCreateChecklist = () => {
    if (newChecklistName.trim()) {
      createChecklistMutation.mutate(newChecklistName.trim());
    }
  };

  const handleToggleItem = (checklistId: string, item: ChecklistItem) => {
    updateItemMutation.mutate({
      checklistId,
      itemId: item.id,
      data: { is_completed: !item.is_completed },
    });
  };

  const handleAddItem = (checklistId: string) => {
    const text = newItemText[checklistId]?.trim();
    if (text) {
      createItemMutation.mutate({ checklistId, item_text: text });
    }
  };

  const toggleExpanded = (checklistId: string) => {
    setExpandedChecklists((prev) => ({
      ...prev,
      [checklistId]: prev[checklistId] === undefined ? false : !prev[checklistId],
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent, checklistId: string) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAddItem(checklistId);
    }
  };

  const handleItemKeyDown = (e: React.KeyboardEvent, checklistId: string, itemId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      updateItemMutation.mutate({
        checklistId,
        itemId,
        data: { item_text: editingItemText },
      });
    } else if (e.key === "Escape") {
      setEditingItem(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-3">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Чеклисты
        </h3>
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </Card>
    );
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />
          Чеклисты ({checklists.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddChecklist(!showAddChecklist)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Добавить
        </Button>
      </div>

      {/* Add checklist form */}
      {showAddChecklist && (
        <div className="mb-4 p-3 bg-muted rounded-md">
          <Input
            placeholder="Название чеклиста..."
            value={newChecklistName}
            onChange={(e) => setNewChecklistName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateChecklist();
              if (e.key === "Escape") setShowAddChecklist(false);
            }}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <Button size="sm" onClick={handleCreateChecklist} disabled={!newChecklistName.trim()}>
              Создать
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowAddChecklist(false)}>
              Отмена
            </Button>
          </div>
        </div>
      )}

      {/* Checklists */}
      {checklists.length === 0 && !showAddChecklist ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Чеклистов пока нет
        </p>
      ) : (
        <div className="space-y-4">
          {checklists.map((checklist) => {
            const isExpanded = expandedChecklists[checklist.id] !== false;
            // Всегда показываем все элементы (завершённые отображаются с зачёркиванием)
            const visibleItems = checklist.items;

            return (
              <div key={checklist.id} className="border rounded-md p-3">
                {/* Checklist header */}
                <div className="flex items-center gap-2 mb-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => toggleExpanded(checklist.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm flex-1">{checklist.name}</span>
                  <Badge variant="secondary" className="text-xs">
                    {checklist.progress.completed}/{checklist.progress.total}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          updateChecklistMutation.mutate({
                            checklistId: checklist.id,
                            data: { hide_completed: !checklist.hide_completed },
                          })
                        }
                      >
                        {checklist.hide_completed ? (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Показать отмеченные
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Скрыть отмеченные
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => deleteChecklistMutation.mutate(checklist.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить чеклист
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <Progress value={checklist.progress.percentage} className="h-2" />
                </div>

                {/* Items */}
                {isExpanded && (
                  <>
                    <div className="space-y-2">
                      {visibleItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 group"
                        >
                          <Checkbox
                            checked={item.is_completed}
                            onCheckedChange={() => handleToggleItem(checklist.id, item)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            {editingItem === item.id ? (
                              <Input
                                value={editingItemText}
                                onChange={(e) => setEditingItemText(e.target.value)}
                                onKeyDown={(e) => handleItemKeyDown(e, checklist.id, item.id)}
                                onBlur={() => {
                                  updateItemMutation.mutate({
                                    checklistId: checklist.id,
                                    itemId: item.id,
                                    data: { item_text: editingItemText },
                                  });
                                }}
                                autoFocus
                                className="h-7 text-sm"
                              />
                            ) : (
                              <span
                                className={`text-sm cursor-pointer ${
                                  item.is_completed ? "line-through text-muted-foreground" : ""
                                }`}
                                onClick={() => {
                                  setEditingItem(item.id);
                                  setEditingItemText(item.item_text);
                                }}
                              >
                                {item.item_text}
                              </span>
                            )}
                            {/* Item meta */}
                            <div className="flex items-center gap-2 mt-1">
                              {item.deadline && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(new Date(item.deadline), "d MMM", { locale: ru })}
                                </span>
                              )}
                              {item.assignee && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Avatar className="h-4 w-4">
                                    <AvatarFallback className="text-[8px]">
                                      {item.assignee.full_name?.[0] || item.assignee.username[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  {item.assignee.full_name || item.assignee.username}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Item actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Deadline picker */}
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={`h-7 w-7 p-0 ${item.deadline ? "text-primary" : ""}`}
                                >
                                  <Calendar className="h-3 w-3" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="end">
                                <CalendarComponent
                                  mode="single"
                                  selected={item.deadline ? new Date(item.deadline) : undefined}
                                  onSelect={(date) =>
                                    updateItemMutation.mutate({
                                      checklistId: checklist.id,
                                      itemId: item.id,
                                      data: { deadline: date ? date.toISOString().split("T")[0] : null },
                                    })
                                  }
                                  initialFocus
                                />
                                {item.deadline && (
                                  <div className="p-2 border-t">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="w-full text-destructive"
                                      onClick={() =>
                                        updateItemMutation.mutate({
                                          checklistId: checklist.id,
                                          itemId: item.id,
                                          data: { deadline: null },
                                        })
                                      }
                                    >
                                      Убрать срок
                                    </Button>
                                  </div>
                                )}
                              </PopoverContent>
                            </Popover>
                            {/* Assignee selector */}
                            <Select
                              value={item.assignee_id || "none"}
                              onValueChange={(value) =>
                                updateItemMutation.mutate({
                                  checklistId: checklist.id,
                                  itemId: item.id,
                                  data: { assignee_id: value === "none" ? null : value },
                                })
                              }
                            >
                              <SelectTrigger className="h-7 w-7 p-0 border-0">
                                <User className="h-3 w-3" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">Без исполнителя</SelectItem>
                                {users.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.full_name || user.username}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() =>
                                deleteItemMutation.mutate({
                                  checklistId: checklist.id,
                                  itemId: item.id,
                                })
                              }
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add item */}
                    <div className="mt-3 flex gap-2">
                      <Input
                        placeholder="Добавить элемент..."
                        value={newItemText[checklist.id] || ""}
                        onChange={(e) =>
                          setNewItemText((prev) => ({
                            ...prev,
                            [checklist.id]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => handleKeyDown(e, checklist.id)}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleAddItem(checklist.id)}
                        disabled={!newItemText[checklist.id]?.trim()}
                        className="h-8"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
