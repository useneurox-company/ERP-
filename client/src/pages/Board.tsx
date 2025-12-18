import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Search,
  Trash2,
  Edit,
  MoreVertical,
  GripVertical,
  X,
  User,
  Calendar,
  Tag,
  Upload,
  Paperclip,
  LayoutGrid,
} from "lucide-react";

// Types
interface BoardLabel {
  id: string;
  name: string;
  color: string;
}

interface BoardCardAttachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
}

interface BoardCard {
  id: string;
  column_id: string;
  title: string;
  description?: string;
  order: number;
  assigned_to?: string;
  assignee?: { id: string; username: string; full_name?: string };
  priority?: string;
  due_date?: string;
  labels?: BoardLabel[];
  attachments?: BoardCardAttachment[];
}

interface BoardColumn {
  id: string;
  board_id: string;
  title: string;
  color: string;
  order: number;
  cards: BoardCard[];
}

interface Board {
  id: string;
  name: string;
  description?: string;
  columns: BoardColumn[];
  labels: BoardLabel[];
}

// Priority colors
const priorityColors: Record<string, string> = {
  low: "bg-blue-500",
  normal: "bg-gray-500",
  high: "bg-orange-500",
  urgent: "bg-red-500",
};

// Sortable Card Component
function SortableCard({ card, onClick }: { card: BoardCard; onClick: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: "card", card } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow touch-none"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
          {/* Labels */}
          {card.labels && card.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {card.labels.map((label) => (
                <div
                  key={label.id}
                  className="h-2 w-8 rounded-full"
                  style={{ backgroundColor: label.color }}
                  title={label.name}
                />
              ))}
            </div>
          )}

          {/* Title */}
          <p className="font-medium text-sm">{card.title}</p>

          {/* Meta info */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {card.priority && card.priority !== "normal" && (
              <div
                className={`h-2 w-2 rounded-full ${priorityColors[card.priority]}`}
                title={card.priority}
              />
            )}
            {card.due_date && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(card.due_date).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "short",
                })}
              </div>
            )}
            {card.attachments && card.attachments.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3" />
                {card.attachments.length}
              </div>
            )}
            {card.assignee && (
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-[10px]">
                  {(card.assignee.full_name || card.assignee.username)?.[0]}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </div>
    </div>
  );
}

// Column Component
function BoardColumnComponent({
  column,
  onAddCard,
  onEditColumn,
  onDeleteColumn,
  onCardClick,
}: {
  column: BoardColumn;
  onAddCard: (columnId: string) => void;
  onEditColumn: (column: BoardColumn) => void;
  onDeleteColumn: (columnId: string) => void;
  onCardClick: (card: BoardCard) => void;
}) {
  const cardIds = column.cards.map((c) => c.id);
  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: { type: "column", column } });

  return (
    <div className="flex-shrink-0 w-72">
      <div
        className="rounded-t-lg p-3 flex items-center justify-between"
        style={{ backgroundColor: column.color + "20", borderTop: `3px solid ${column.color}` }}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{column.title}</span>
          <Badge variant="secondary" className="text-xs">
            {column.cards.length}
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEditColumn(column)}>
              <Edit className="h-4 w-4 mr-2" />
              Редактировать
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteColumn(column.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={setNodeRef}
        className={`bg-muted/30 rounded-b-lg p-2 min-h-[400px] space-y-2 transition-colors ${isOver ? "bg-primary/10 ring-2 ring-primary/30" : ""}`}
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <SortableCard
              key={card.id}
              card={card}
              onClick={() => onCardClick(card)}
            />
          ))}
        </SortableContext>

        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground"
          onClick={() => onAddCard(column.id)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Добавить карточку
        </Button>
      </div>
    </div>
  );
}

// Main Board Page
export default function Board() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);

  // Dialogs
  const [createBoardDialogOpen, setCreateBoardDialogOpen] = useState(false);
  const [createCardDialogOpen, setCreateCardDialogOpen] = useState(false);
  const [editCardDialogOpen, setEditCardDialogOpen] = useState(false);
  const [createColumnDialogOpen, setCreateColumnDialogOpen] = useState(false);
  const [editColumnDialogOpen, setEditColumnDialogOpen] = useState(false);
  const [createLabelDialogOpen, setCreateLabelDialogOpen] = useState(false);

  // Form state
  const [newBoardName, setNewBoardName] = useState("");
  const [newBoardDescription, setNewBoardDescription] = useState("");
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardDescription, setNewCardDescription] = useState("");
  const [newCardAssignee, setNewCardAssignee] = useState("");
  const [newCardPriority, setNewCardPriority] = useState("normal");
  const [newCardDueDate, setNewCardDueDate] = useState("");
  const [selectedCard, setSelectedCard] = useState<BoardCard | null>(null);
  const [newColumnTitle, setNewColumnTitle] = useState("");
  const [newColumnColor, setNewColumnColor] = useState("#6366f1");
  const [editingColumn, setEditingColumn] = useState<BoardColumn | null>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#6366f1");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);

  // Get current user
  const userStr = localStorage.getItem("user");
  const currentUser = userStr ? JSON.parse(userStr) : null;

  // Queries
  const { data: boards = [] } = useQuery<Board[]>({
    queryKey: ["/api/boards"],
  });

  const { data: currentBoard } = useQuery<Board>({
    queryKey: [`/api/boards/${selectedBoardId}`],
    enabled: !!selectedBoardId,
    refetchInterval: 5000, // Обновление каждые 5 секунд для реалтайма
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // Set first board as selected if none selected
  useEffect(() => {
    if (boards.length > 0 && !selectedBoardId) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  // Mutations
  const createBoardMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await fetch("/api/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, created_by: currentUser?.id }),
      });
      if (!response.ok) throw new Error("Failed to create board");
      return response.json();
    },
    onSuccess: (board) => {
      queryClient.invalidateQueries({ queryKey: ["/api/boards"] });
      setSelectedBoardId(board.id);
      setCreateBoardDialogOpen(false);
      setNewBoardName("");
      setNewBoardDescription("");
      toast({ title: "Доска создана" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать доску", variant: "destructive" });
    },
  });

  const createCardMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(
        `/api/boards/${selectedBoardId}/columns/${selectedColumnId}/cards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...data, created_by: currentUser?.id }),
        }
      );
      if (!response.ok) throw new Error("Failed to create card");
      return response.json();
    },
    onSuccess: async (card) => {
      // Upload attachments if any
      if (attachmentFiles.length > 0) {
        for (const file of attachmentFiles) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("userId", currentUser?.id || "");
          await fetch(`/api/boards/cards/${card.id}/attachments`, {
            method: "POST",
            body: formData,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: [`/api/boards/${selectedBoardId}`] });
      setCreateCardDialogOpen(false);
      resetCardForm();
      toast({ title: "Карточка создана" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать карточку", variant: "destructive" });
    },
  });

  const updateCardMutation = useMutation({
    mutationFn: async ({ cardId, data }: { cardId: string; data: any }) => {
      const response = await fetch(`/api/boards/cards/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update card");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${selectedBoardId}`] });
      setEditCardDialogOpen(false);
      setSelectedCard(null);
      resetCardForm();
      toast({ title: "Карточка обновлена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить карточку", variant: "destructive" });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const response = await fetch(`/api/boards/cards/${cardId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete card");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${selectedBoardId}`] });
      setEditCardDialogOpen(false);
      setSelectedCard(null);
      toast({ title: "Карточка удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить карточку", variant: "destructive" });
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: async ({ cardId, columnId, order }: { cardId: string; columnId: string; order: number }) => {
      const response = await fetch(`/api/boards/cards/${cardId}/move`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ column_id: columnId, order }),
      });
      if (!response.ok) throw new Error("Failed to move card");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${selectedBoardId}`] });
    },
  });

  const createColumnMutation = useMutation({
    mutationFn: async (data: { title: string; color: string }) => {
      const response = await fetch(`/api/boards/${selectedBoardId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create column");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${selectedBoardId}`] });
      setCreateColumnDialogOpen(false);
      setNewColumnTitle("");
      setNewColumnColor("#6366f1");
      toast({ title: "Колонка создана" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать колонку", variant: "destructive" });
    },
  });

  const updateColumnMutation = useMutation({
    mutationFn: async ({ columnId, data }: { columnId: string; data: any }) => {
      const response = await fetch(`/api/boards/${selectedBoardId}/columns/${columnId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to update column");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${selectedBoardId}`] });
      setEditColumnDialogOpen(false);
      setEditingColumn(null);
      toast({ title: "Колонка обновлена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить колонку", variant: "destructive" });
    },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const response = await fetch(`/api/boards/${selectedBoardId}/columns/${columnId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete column");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${selectedBoardId}`] });
      toast({ title: "Колонка удалена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить колонку", variant: "destructive" });
    },
  });

  const createLabelMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const response = await fetch(`/api/boards/${selectedBoardId}/labels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create label");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/boards/${selectedBoardId}`] });
      setCreateLabelDialogOpen(false);
      setNewLabelName("");
      setNewLabelColor("#6366f1");
      toast({ title: "Метка создана" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать метку", variant: "destructive" });
    },
  });

  // Handlers
  const resetCardForm = () => {
    setNewCardTitle("");
    setNewCardDescription("");
    setNewCardAssignee("");
    setNewCardPriority("normal");
    setNewCardDueDate("");
    setAttachmentFiles([]);
  };

  const handleAddCard = (columnId: string) => {
    setSelectedColumnId(columnId);
    resetCardForm();
    setCreateCardDialogOpen(true);
  };

  const handleCardClick = (card: BoardCard) => {
    setSelectedCard(card);
    setNewCardTitle(card.title);
    setNewCardDescription(card.description || "");
    setNewCardAssignee(card.assigned_to || "");
    setNewCardPriority(card.priority || "normal");
    setNewCardDueDate(card.due_date ? card.due_date.split("T")[0] : "");
    setEditCardDialogOpen(true);
  };

  const handleEditColumn = (column: BoardColumn) => {
    setEditingColumn(column);
    setNewColumnTitle(column.title);
    setNewColumnColor(column.color);
    setEditColumnDialogOpen(true);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const newFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file && file.size <= 10 * 1024 * 1024) {
          newFiles.push(file);
        }
      }
    }

    if (newFiles.length > 0) {
      setAttachmentFiles((prev) => [...prev, ...newFiles]);
      toast({ title: "Файлы добавлены", description: `${newFiles.length} файл(ов)` });
    }
  };

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const card = currentBoard?.columns
      .flatMap((c) => c.cards)
      .find((c) => c.id === active.id);
    setActiveCard(card || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveCard(null);

    if (!over) return;

    const activeCard = currentBoard?.columns
      .flatMap((c) => c.cards)
      .find((c) => c.id === active.id);

    if (!activeCard) return;

    // Find target column
    let targetColumnId = activeCard.column_id;
    let targetOrder = activeCard.order;

    // Check if dropped on another card
    const overCard = currentBoard?.columns
      .flatMap((c) => c.cards)
      .find((c) => c.id === over.id);

    if (overCard) {
      targetColumnId = overCard.column_id;
      targetOrder = overCard.order;
    } else {
      // Dropped on column directly
      const overColumn = currentBoard?.columns.find((c) => c.id === over.id);
      if (overColumn) {
        targetColumnId = overColumn.id;
        targetOrder = overColumn.cards.length;
      }
    }

    if (activeCard.column_id !== targetColumnId || activeCard.order !== targetOrder) {
      moveCardMutation.mutate({
        cardId: activeCard.id,
        columnId: targetColumnId,
        order: targetOrder,
      });
    }
  };

  // Filter cards by search
  const filteredColumns = currentBoard?.columns.map((col) => ({
    ...col,
    cards: col.cards.filter((card) =>
      card.title.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  }));

  const allCardIds = filteredColumns?.flatMap((col) => col.cards.map((c) => c.id)) || [];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <LayoutGrid className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Доска</h1>

            {/* Board selector */}
            <Select
              value={selectedBoardId || ""}
              onValueChange={setSelectedBoardId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Выберите доску" />
              </SelectTrigger>
              <SelectContent>
                {boards.map((board) => (
                  <SelectItem key={board.id} value={board.id}>
                    {board.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Button variant="outline" onClick={() => setCreateLabelDialogOpen(true)}>
              <Tag className="h-4 w-4 mr-2" />
              Метки
            </Button>
            <Button variant="outline" onClick={() => setCreateColumnDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Колонка
            </Button>
            <Button onClick={() => setCreateBoardDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Новая доска
            </Button>
          </div>
        </div>
      </div>

      {/* Board content */}
      {!currentBoard ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Нет досок</h3>
            <p className="text-muted-foreground mb-4">Создайте первую доску для начала работы</p>
            <Button onClick={() => setCreateBoardDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Создать доску
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto p-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-4 h-full">
              <SortableContext items={allCardIds} strategy={verticalListSortingStrategy}>
                {filteredColumns?.map((column) => (
                  <BoardColumnComponent
                    key={column.id}
                    column={column}
                    onAddCard={handleAddCard}
                    onEditColumn={handleEditColumn}
                    onDeleteColumn={(id) => deleteColumnMutation.mutate(id)}
                    onCardClick={handleCardClick}
                  />
                ))}
              </SortableContext>

              {/* Add column button */}
              <div className="flex-shrink-0 w-72">
                <Button
                  variant="outline"
                  className="w-full h-12 border-dashed"
                  onClick={() => setCreateColumnDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить колонку
                </Button>
              </div>
            </div>

            <DragOverlay>
              {activeCard && (
                <div className="bg-card border rounded-lg p-3 shadow-lg opacity-90">
                  <p className="font-medium text-sm">{activeCard.title}</p>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {/* Create Board Dialog */}
      <Dialog open={createBoardDialogOpen} onOpenChange={setCreateBoardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать доску</DialogTitle>
            <DialogDescription>Новая доска для организации задач</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createBoardMutation.mutate({
                name: newBoardName,
                description: newBoardDescription || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={newBoardName}
                onChange={(e) => setNewBoardName(e.target.value)}
                placeholder="Моя доска"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={newBoardDescription}
                onChange={(e) => setNewBoardDescription(e.target.value)}
                placeholder="Описание доски..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateBoardDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={!newBoardName.trim()}>
                Создать
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Card Dialog */}
      <Dialog open={createCardDialogOpen} onOpenChange={setCreateCardDialogOpen}>
        <DialogContent onPaste={handlePaste}>
          <DialogHeader>
            <DialogTitle>Создать карточку</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createCardMutation.mutate({
                title: newCardTitle,
                description: newCardDescription || undefined,
                assigned_to: newCardAssignee || undefined,
                priority: newCardPriority,
                due_date: newCardDueDate || undefined,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                placeholder="Название задачи"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={newCardDescription}
                onChange={(e) => setNewCardDescription(e.target.value)}
                placeholder="Описание..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Исполнитель</Label>
                <Select value={newCardAssignee || "none"} onValueChange={(val) => setNewCardAssignee(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не назначен</SelectItem>
                    {users.filter(u => u.id).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Приоритет</Label>
                <Select value={newCardPriority} onValueChange={setNewCardPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Низкий</SelectItem>
                    <SelectItem value="normal">Обычный</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                    <SelectItem value="urgent">Срочный</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Срок</Label>
              <Input
                type="date"
                value={newCardDueDate}
                onChange={(e) => setNewCardDueDate(e.target.value)}
              />
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Файлы</Label>
              <div className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-md">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Используйте Ctrl+V для вставки
                </span>
              </div>
              {attachmentFiles.length > 0 && (
                <div className="space-y-1">
                  {attachmentFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                      <span className="truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateCardDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={!newCardTitle.trim()}>
                Создать
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Card Dialog */}
      <Dialog open={editCardDialogOpen} onOpenChange={setEditCardDialogOpen}>
        <DialogContent onPaste={handlePaste}>
          <DialogHeader>
            <DialogTitle>Редактировать карточку</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (selectedCard) {
                updateCardMutation.mutate({
                  cardId: selectedCard.id,
                  data: {
                    title: newCardTitle,
                    description: newCardDescription || null,
                    assigned_to: newCardAssignee || null,
                    priority: newCardPriority,
                    due_date: newCardDueDate || null,
                  },
                });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={newCardTitle}
                onChange={(e) => setNewCardTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea
                value={newCardDescription}
                onChange={(e) => setNewCardDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Исполнитель</Label>
                <Select value={newCardAssignee || "none"} onValueChange={(val) => setNewCardAssignee(val === "none" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Не назначен" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Не назначен</SelectItem>
                    {users.filter(u => u.id).map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name || user.username}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Приоритет</Label>
                <Select value={newCardPriority} onValueChange={setNewCardPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Низкий</SelectItem>
                    <SelectItem value="normal">Обычный</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                    <SelectItem value="urgent">Срочный</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Срок</Label>
              <Input
                type="date"
                value={newCardDueDate}
                onChange={(e) => setNewCardDueDate(e.target.value)}
              />
            </div>
            <div className="flex justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={() => selectedCard && deleteCardMutation.mutate(selectedCard.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Удалить
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setEditCardDialogOpen(false)}>
                  Отмена
                </Button>
                <Button type="submit">Сохранить</Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Column Dialog */}
      <Dialog open={createColumnDialogOpen} onOpenChange={setCreateColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать колонку</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createColumnMutation.mutate({
                title: newColumnTitle,
                color: newColumnColor,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                placeholder="Название колонки"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex gap-2">
                {["#6366f1", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#06b6d4"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${newColumnColor === color ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColumnColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateColumnDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={!newColumnTitle.trim()}>
                Создать
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Column Dialog */}
      <Dialog open={editColumnDialogOpen} onOpenChange={setEditColumnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать колонку</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingColumn) {
                updateColumnMutation.mutate({
                  columnId: editingColumn.id,
                  data: { title: newColumnTitle, color: newColumnColor },
                });
              }
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={newColumnTitle}
                onChange={(e) => setNewColumnTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex gap-2">
                {["#6366f1", "#f59e0b", "#22c55e", "#ef4444", "#8b5cf6", "#06b6d4"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${newColumnColor === color ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColumnColor(color)}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditColumnDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit">Сохранить</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Label Dialog */}
      <Dialog open={createLabelDialogOpen} onOpenChange={setCreateLabelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Создать метку</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createLabelMutation.mutate({
                name: newLabelName,
                color: newLabelColor,
              });
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                placeholder="Название метки"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Цвет</Label>
              <div className="flex gap-2">
                {["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"].map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-8 w-8 rounded-full border-2 ${newLabelColor === color ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewLabelColor(color)}
                  />
                ))}
              </div>
            </div>

            {/* Existing labels */}
            {currentBoard?.labels && currentBoard.labels.length > 0 && (
              <div className="space-y-2">
                <Label>Существующие метки</Label>
                <div className="flex flex-wrap gap-2">
                  {currentBoard.labels.map((label) => (
                    <Badge
                      key={label.id}
                      style={{ backgroundColor: label.color }}
                      className="text-white"
                    >
                      {label.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateLabelDialogOpen(false)}>
                Закрыть
              </Button>
              <Button type="submit" disabled={!newLabelName.trim()}>
                Создать
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
