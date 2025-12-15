import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, LayoutGrid, List, Calendar, Settings, Trash2, CheckSquare, ChevronDown, ArrowRight, X, Search, GripVertical, Edit, Palette } from "lucide-react";
import { useLocation, useSearch } from "wouter";
import { DealCard } from "@/components/DealCard";
import { DealDetailSheet } from "@/components/DealDetailSheet";
import { DealCreateDialog } from "@/components/DealCreateDialog";
import { ManageStagesDialog } from "@/components/ManageStagesDialog";
import { DealCardModal } from "@/components/DealCardModal";
import { DeleteDealDialog } from "@/components/DeleteDealDialog";
import { BulkStageChangeDialog } from "@/components/BulkStageChangeDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { Deal, User, DealStage } from "@shared/schema";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { apiRequest, queryClient, getCurrentUserId } from "@/lib/queryClient";

// Color presets for stage columns
const colorPresets: Record<string, { borderColor: string }> = {
  "#6366f1": { borderColor: "border-l-indigo-500" },
  "#8b5cf6": { borderColor: "border-l-violet-500" },
  "#0ea5e9": { borderColor: "border-l-sky-500" },
  "#f59e0b": { borderColor: "border-l-amber-500" },
  "#10b981": { borderColor: "border-l-emerald-500" },
  "#ef4444": { borderColor: "border-l-red-500" },
  "#ec4899": { borderColor: "border-l-pink-500" },
  "#14b8a6": { borderColor: "border-l-teal-500" },
};

// Sortable Deal Card Component
function SortableDealCard({
  deal,
  onClick,
  selectionMode,
  isSelected,
  onToggleSelection,
}: {
  deal: {
    id: string;
    title?: string;
    orderNumber?: string;
    clientName: string;
    company?: string;
    amount: number;
    deadline: string;
    manager: string;
    tags: string[];
    stage: string;
  };
  onClick: () => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelection: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
    disabled: selectionMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      return;
    }
    if (selectionMode) {
      onToggleSelection();
    } else {
      onClick();
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(selectionMode ? {} : listeners)}
      className="mb-2 cursor-grab active:cursor-grabbing"
    >
      <Card
        className="hover:shadow-md transition-shadow select-none bg-card"
        onClick={handleClick}
      >
        <CardContent className="p-2">
          {selectionMode && (
            <div className="absolute top-2 right-2 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={onToggleSelection}
                onClick={(e) => e.stopPropagation()}
                className="bg-background"
              />
            </div>
          )}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1">
              {!selectionMode && <GripVertical className="h-3 w-3 text-gray-400" />}
              <span className="font-medium text-xs truncate max-w-[140px]">
                {deal.title || deal.clientName}
              </span>
            </div>
            {deal.orderNumber && (
              <span className="text-xs text-muted-foreground">#{deal.orderNumber}</span>
            )}
          </div>

          <div className="space-y-0.5 text-xs">
            {deal.title && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="truncate">Клиент: {deal.clientName}</span>
              </div>
            )}
            {deal.company && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <span className="truncate">{deal.company}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Сумма:</span>
              <span className="font-medium">₽{deal.amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Срок:</span>
              <span>{deal.deadline}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Менеджер:</span>
              <span className="truncate max-w-[100px]">{deal.manager}</span>
            </div>
          </div>

          {deal.tags && deal.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t">
              {deal.tags.slice(0, 3).map((tag, i) => (
                <span key={i} className="px-1 py-0 text-xs rounded bg-muted text-muted-foreground">
                  #{tag}
                </span>
              ))}
              {deal.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{deal.tags.length - 3}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Kanban Column Component with Droppable
function DealKanbanColumn({
  stage,
  deals,
  borderColor,
  onCardClick,
  onEditStage,
  selectionMode,
  selectedDeals,
  onToggleSelection,
  onToggleColumnSelection,
}: {
  stage: DealStage;
  deals: Array<{
    id: string;
    title?: string;
    orderNumber?: string;
    clientName: string;
    company?: string;
    amount: number;
    deadline: string;
    manager: string;
    tags: string[];
    stage: string;
  }>;
  borderColor: string;
  onCardClick: (dealId: string) => void;
  onEditStage: () => void;
  selectionMode: boolean;
  selectedDeals: Set<string>;
  onToggleSelection: (dealId: string) => void;
  onToggleColumnSelection: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.key,
  });

  const columnDeals = deals.filter(d => d.stage === stage.key);
  const selectedInColumn = columnDeals.filter(d => selectedDeals.has(d.id)).length;
  const allSelectedInColumn = columnDeals.length > 0 && selectedInColumn === columnDeals.length;

  return (
    <div className="flex-shrink-0 w-56 md:w-64">
      <Card className={`border-l-[3px] ${borderColor} bg-zinc-900/95`}>
        <CardHeader className="pb-2 pt-2 px-2">
          <div className="flex items-center justify-between">
            {selectionMode ? (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelectedInColumn}
                  onCheckedChange={onToggleColumnSelection}
                  className="bg-zinc-700"
                />
                <CardTitle className="text-xs font-medium text-white">{stage.name}</CardTitle>
              </div>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-auto p-0.5 text-white hover:bg-zinc-700">
                    <CardTitle className="text-xs font-medium">{stage.name}</CardTitle>
                    <ChevronDown className="ml-1 h-2.5 w-2.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={onEditStage}>
                    <Edit className="mr-2 h-3 w-3" /> Редактировать
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onEditStage}>
                    <Palette className="mr-2 h-3 w-3" /> Изменить цвет
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Badge variant="secondary" className="bg-zinc-700 text-zinc-300 text-xs px-1">
              {columnDeals.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className={`space-y-2 min-h-[200px] px-2 pb-2 transition-colors ${
            isOver ? "bg-zinc-800/50" : ""
          }`}
        >
          <SortableContext items={columnDeals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {columnDeals.map((deal) => (
              <SortableDealCard
                key={deal.id}
                deal={deal}
                onClick={() => onCardClick(deal.id)}
                selectionMode={selectionMode}
                isSelected={selectedDeals.has(deal.id)}
                onToggleSelection={() => onToggleSelection(deal.id)}
              />
            ))}
          </SortableContext>
          {columnDeals.length === 0 && (
            <div className={`text-center py-4 ${isOver ? "text-zinc-300" : "text-zinc-500"}`}>
              <p className="text-xs">{isOver ? "Отпустите" : "Нет сделок"}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Sales() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();

  const [activeTab, setActiveTab] = useState<"kanban" | "list" | "calendar">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [zoomLevel, setZoomLevel] = useState(85);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isManageStagesOpen, setIsManageStagesOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkStageDialogOpen, setBulkStageDialogOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterManager, setFilterManager] = useState<string>("all");
  const { toast } = useToast();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Handle dealId and create from URL query params
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const dealId = params.get('dealId');
    const createNew = params.get('create');

    if (dealId) {
      setSelectedDealId(dealId);
      setModalOpen(true);
      // Clean up URL after opening modal
      setLocation('/sales', { replace: true });
    }

    if (createNew === 'true') {
      setIsCreateDialogOpen(true);
      // Clean up URL after opening dialog
      setLocation('/sales', { replace: true });
    }
  }, [searchString, setLocation]);

  const { data: deals = [], isLoading: dealsLoading, error: dealsError } = useQuery<Deal[]>({
    queryKey: ["/api/deals"],
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<DealStage[]>({
    queryKey: ["/api/deal-stages"],
  });

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/users', getCurrentUserId()],
  });

  useEffect(() => {
    if (dealsError) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить сделки",
        variant: "destructive",
      });
    }
  }, [dealsError, toast]);

  const isLoading = dealsLoading || usersLoading || stagesLoading;

  const getUserName = (userId: string | null) => {
    if (!userId) return "Не назначен";
    const user = users.find(u => u.id === userId);
    return user?.full_name || user?.username || "Не назначен";
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "Не установлен";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const transformedDeals = deals.map(deal => ({
    id: deal.id,
    title: deal.title || undefined,
    orderNumber: deal.order_number || undefined,
    clientName: deal.client_name,
    company: deal.company || undefined,
    amount: parseFloat(deal.amount || "0"),
    deadline: formatDate(deal.deadline),
    deadlineDate: deal.deadline,
    manager: getUserName(deal.manager_id),
    tags: deal.tags || [],
    stage: deal.stage,
  }));

  // Filter deals by search query and filters
  const filteredDeals = transformedDeals.filter((deal) => {
    // Stage filter
    if (filterStage !== "all" && deal.stage !== filterStage) return false;

    // Manager filter
    if (filterManager !== "all" && deal.manager !== filterManager) return false;

    // Search query
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      deal.clientName.toLowerCase().includes(search) ||
      deal.company?.toLowerCase().includes(search) ||
      deal.orderNumber?.toLowerCase().includes(search) ||
      deal.manager.toLowerCase().includes(search) ||
      deal.tags.some(tag => tag.toLowerCase().includes(search))
    );
  });

  // Get unique managers for filter
  const uniqueManagers = [...new Set(transformedDeals.map(d => d.manager))].filter(Boolean);

  const updateDealStageMutation = useMutation({
    mutationFn: async ({ dealId, newStage }: { dealId: string; newStage: string }) => {
      return await apiRequest("PUT", `/api/deals/${dealId}`, { stage: newStage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
    },
    onError: (error, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Ошибка",
        description: "Не удалось переместить сделку. Попробуйте снова.",
        variant: "destructive",
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (dealIds: string[]) => {
      return await apiRequest("POST", "/api/deals/bulk-delete", { dealIds });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Сделки удалены",
        description: data.message || `Удалено ${selectedDeals.size} сделок`,
      });
      setSelectedDeals(new Set());
      setSelectionMode(false);
      setBulkDeleteDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить сделки",
        variant: "destructive",
      });
    },
  });

  const bulkUpdateStageMutation = useMutation({
    mutationFn: async ({ dealIds, newStage }: { dealIds: string[], newStage: string }) => {
      return await apiRequest("POST", "/api/deals/bulk-update-stage", { dealIds, newStage });
    },
    onMutate: async ({ dealIds, newStage }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/deals"] });
      const previousDeals = queryClient.getQueryData(["/api/deals"]);

      queryClient.setQueryData(["/api/deals"], (oldDeals: Deal[] | undefined) => {
        if (!oldDeals) return oldDeals;
        return oldDeals.map(deal =>
          dealIds.includes(deal.id) ? { ...deal, stage: newStage } : deal
        );
      });

      return { previousDeals };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousDeals) {
        queryClient.setQueryData(["/api/deals"], context.previousDeals);
      }
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить этап",
        variant: "destructive",
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Этап изменен",
        description: data.message || `Этап изменен для ${selectedDeals.size} сделок`,
      });
      setSelectedDeals(new Set());
      setSelectionMode(false);
      setBulkStageDialogOpen(false);
    },
  });

  const handleToggleSelection = (dealId: string) => {
    setSelectedDeals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dealId)) {
        newSet.delete(dealId);
      } else {
        newSet.add(dealId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedDeals.size === transformedDeals.length) {
      setSelectedDeals(new Set());
    } else {
      setSelectedDeals(new Set(transformedDeals.map(d => d.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedDeals.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const handleToggleColumnSelection = (columnId: string) => {
    // Получить все ID сделок в этой колонке
    const columnDealIds = transformedDeals
      .filter(deal => deal.stage === columnId)
      .map(deal => deal.id);

    if (columnDealIds.length === 0) return;

    // Проверить сколько уже выбрано в этой колонке
    const selectedInColumn = columnDealIds.filter(id => selectedDeals.has(id));

    setSelectedDeals(prev => {
      const newSet = new Set(prev);

      // Если все выбраны → снять все
      if (selectedInColumn.length === columnDealIds.length) {
        columnDealIds.forEach(id => newSet.delete(id));
      } else {
        // Иначе → выбрать все
        columnDealIds.forEach(id => newSet.add(id));
      }

      return newSet;
    });
  };

  const handleDealClick = (dealId: string) => {
    setSelectedDealId(dealId);
    setModalOpen(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeDeal = deals.find(d => d.id === activeId);
    
    if (!activeDeal) {
      setActiveId(null);
      return;
    }

    const stageKeys = stages.map(s => s.key);
    const newStage = stageKeys.find(key => overId === key || deals.find(d => d.id === overId && d.stage === key));

    if (newStage && newStage !== activeDeal.stage) {
      const previousDeals = [...deals];
      
      queryClient.setQueryData(["/api/deals"], (oldDeals: Deal[] | undefined) => {
        if (!oldDeals) return oldDeals;
        return oldDeals.map(deal => 
          deal.id === activeId ? { ...deal, stage: newStage } : deal
        );
      });

      updateDealStageMutation.mutate(
        { dealId: activeId, newStage },
        {
          onError: () => {
            queryClient.setQueryData(["/api/deals"], previousDeals);
          }
        }
      );
    }

    setActiveId(null);
  };

  const activeDeal = activeId ? filteredDeals.find(d => d.id === activeId) : null;

  // Get border color for stage
  const getBorderColor = (color: string | null) => {
    if (!color) return "border-l-gray-500";
    return colorPresets[color]?.borderColor || "border-l-gray-500";
  };

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getDealsForDate = (day: number) => {
    const targetDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), day);
    return filteredDeals.filter(deal => {
      if (!deal.deadlineDate) return false;
      const dealDate = new Date(deal.deadlineDate);
      return dealDate.getDate() === targetDate.getDate() &&
             dealDate.getMonth() === targetDate.getMonth() &&
             dealDate.getFullYear() === targetDate.getFullYear();
    });
  };

  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Продажи (CRM)</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Управление заказами клиентов</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectionMode && (
            <>
              <Badge variant="secondary" data-testid="badge-selected-count">
                Выбрано: {selectedDeals.size}
              </Badge>
              <Button
                variant="outline"
                onClick={handleSelectAll}
                data-testid="button-select-all"
              >
                {selectedDeals.size === filteredDeals.length ? "Снять все" : "Выбрать все"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    disabled={selectedDeals.size === 0}
                    data-testid="button-actions-dropdown"
                  >
                    Действия ({selectedDeals.size}) <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setBulkStageDialogOpen(true)}
                    data-testid="menu-item-change-stage"
                  >
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Изменить этап
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleBulkDelete}
                    className="text-destructive"
                    data-testid="menu-item-delete"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Удалить
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectionMode(false);
                  setSelectedDeals(new Set());
                }}
                data-testid="button-cancel-selection"
              >
                <X className="h-4 w-4 mr-2" />
                Отмена
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search and View Toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* New Deal Button */}
        {!selectionMode && (
          <>
            <Button
              size="icon"
              onClick={() => setIsCreateDialogOpen(true)}
              className="md:hidden"
              data-testid="button-create-deal"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              onClick={() => setIsCreateDialogOpen(true)}
              className="hidden md:flex"
              data-testid="button-create-deal-desktop"
            >
              <Plus className="h-4 w-4 mr-2" />
              Новая сделка
            </Button>
          </>
        )}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "kanban" | "list" | "calendar")}>
          <TabsList>
            <TabsTrigger value="kanban" data-testid="button-view-kanban">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="list" data-testid="button-view-list">
              <List className="h-4 w-4 mr-2" />
              Список
            </TabsTrigger>
            <TabsTrigger value="calendar" data-testid="button-view-calendar">
              <Calendar className="h-4 w-4 mr-2" />
              Календарь
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Zoom Control for Kanban */}
        {activeTab === "kanban" && (
          <div className="flex items-center gap-1 bg-zinc-800 rounded-lg px-2 py-1 border border-zinc-600">
            <span className="text-xs text-zinc-400 mr-1">Масштаб:</span>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0 bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={() => setZoomLevel(Math.max(60, zoomLevel - 10))}
              disabled={zoomLevel <= 60}
            >
              −
            </Button>
            <span className="text-sm w-12 text-center font-medium text-white">{zoomLevel}%</span>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0 bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={() => setZoomLevel(Math.min(120, zoomLevel + 10))}
              disabled={zoomLevel >= 120}
            >
              +
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-xs bg-zinc-700 hover:bg-zinc-600 text-white ml-1"
              onClick={() => setZoomLevel(100)}
            >
              100%
            </Button>
          </div>
        )}

        {/* Manage stages button */}
        {!selectionMode && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsManageStagesOpen(true)}
              className="md:hidden"
              data-testid="button-manage-stages"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsManageStagesOpen(true)}
              className="hidden md:flex"
              data-testid="button-manage-stages-desktop"
            >
              <Settings className="h-4 w-4 mr-2" />
              Этапы
            </Button>
            <Button
              variant="outline"
              onClick={() => setSelectionMode(true)}
              data-testid="button-enable-selection"
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              <span className="hidden md:inline">Выбрать</span>
            </Button>
          </>
        )}

        {/* Search */}
        <div className="relative w-48 md:w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" data-testid={`skeleton-deal-${i}`} />
          ))}
        </div>
      ) : (
        <>
          {/* Kanban View */}
          {activeTab === "kanban" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={selectionMode ? undefined : handleDragStart}
              onDragEnd={selectionMode ? undefined : handleDragEnd}
            >
              <div
                className="overflow-x-auto"
                style={{
                  transform: `scale(${zoomLevel / 100})`,
                  transformOrigin: 'top left',
                  width: `${100 / (zoomLevel / 100)}%`
                }}
              >
                <div className="flex gap-3 pb-4">
                  {stages.map((stage) => (
                    <DealKanbanColumn
                      key={stage.id}
                      stage={stage}
                      deals={filteredDeals}
                      borderColor={getBorderColor(stage.color)}
                      onCardClick={handleDealClick}
                      onEditStage={() => setIsManageStagesOpen(true)}
                      selectionMode={selectionMode}
                      selectedDeals={selectedDeals}
                      onToggleSelection={handleToggleSelection}
                      onToggleColumnSelection={() => handleToggleColumnSelection(stage.key)}
                    />
                  ))}
                  {/* Add Stage Button */}
                  <div className="flex-shrink-0 w-56 md:w-64">
                    <Card className="border-l-[3px] border-l-dashed border-l-zinc-600 bg-zinc-900/50 hover:bg-zinc-800/50 cursor-pointer transition-colors">
                      <CardContent
                        className="flex flex-col items-center justify-center min-h-[150px] text-zinc-500"
                        onClick={() => setIsManageStagesOpen(true)}
                      >
                        <Plus className="h-6 w-6 mb-1" />
                        <span className="text-xs">Добавить статус</span>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
              <DragOverlay>
                {activeDeal && (
                  <Card className="shadow-lg w-56">
                    <CardContent className="p-2">
                      <div className="font-medium text-xs">{activeDeal.clientName}</div>
                      <div className="text-xs text-gray-500">₽{activeDeal.amount.toLocaleString()}</div>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* List View - Table */}
          {activeTab === "list" && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Этап:</span>
                  <Select value={filterStage} onValueChange={setFilterStage}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Все этапы" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все этапы</SelectItem>
                      {stages.map((stage) => (
                        <SelectItem key={stage.key} value={stage.key}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: stage.color || "#6b7280" }}
                            />
                            {stage.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Менеджер:</span>
                  <Select value={filterManager} onValueChange={setFilterManager}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Все менеджеры" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все менеджеры</SelectItem>
                      {uniqueManagers.map((manager) => (
                        <SelectItem key={manager} value={manager}>
                          {manager}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(filterStage !== "all" || filterManager !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFilterStage("all");
                      setFilterManager("all");
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Сбросить
                  </Button>
                )}

                <span className="text-sm text-muted-foreground ml-auto">
                  Показано: {filteredDeals.length} из {transformedDeals.length}
                </span>
              </div>

              {/* Table */}
              <div className="rounded-md border">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr className="border-b">
                    {selectionMode && (
                      <th className="w-10 p-3">
                        <Checkbox
                          checked={selectedDeals.size === filteredDeals.length && filteredDeals.length > 0}
                          onCheckedChange={handleSelectAll}
                          className="bg-background"
                        />
                      </th>
                    )}
                    <th className="text-left p-3 font-medium text-sm">Клиент</th>
                    <th className="text-left p-3 font-medium text-sm hidden md:table-cell">Компания</th>
                    <th className="text-left p-3 font-medium text-sm w-20">№</th>
                    <th className="text-right p-3 font-medium text-sm">Сумма</th>
                    <th className="text-left p-3 font-medium text-sm hidden lg:table-cell">Срок</th>
                    <th className="text-left p-3 font-medium text-sm hidden xl:table-cell">Менеджер</th>
                    <th className="text-left p-3 font-medium text-sm">Этап</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDeals.map((deal) => {
                    const stage = stages.find(s => s.key === deal.stage);
                    const stageColor = stage?.color || "#6b7280";
                    return (
                      <tr
                        key={deal.id}
                        className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => !selectionMode && handleDealClick(deal.id)}
                      >
                        {selectionMode && (
                          <td className="p-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedDeals.has(deal.id)}
                              onCheckedChange={() => handleToggleSelection(deal.id)}
                              className="bg-background"
                            />
                          </td>
                        )}
                        <td className="p-3">
                          <span className="font-medium">{deal.clientName}</span>
                        </td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell">
                          {deal.company || "—"}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {deal.orderNumber ? `#${deal.orderNumber}` : "—"}
                        </td>
                        <td className="p-3 text-right font-medium">
                          ₽{deal.amount.toLocaleString()}
                        </td>
                        <td className="p-3 text-muted-foreground hidden lg:table-cell">
                          {deal.deadline}
                        </td>
                        <td className="p-3 text-muted-foreground hidden xl:table-cell truncate max-w-[120px]">
                          {deal.manager}
                        </td>
                        <td className="p-3">
                          <Badge
                            style={{ backgroundColor: stageColor, color: "white" }}
                            className="text-xs whitespace-nowrap"
                          >
                            {stage?.name || deal.stage}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredDeals.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Нет сделок
                </div>
              )}
            </div>
          </div>
          )}

          {/* Calendar View */}
          {activeTab === "calendar" && (
            <div className="space-y-4">
              {/* Calendar Navigation */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                >
                  ←
                </Button>
                <h3 className="text-lg font-medium">
                  {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                >
                  →
                </Button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                    {day}
                  </div>
                ))}
                {(() => {
                  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(calendarDate);
                  const today = new Date();
                  const cells = [];

                  // Empty cells for days before the 1st
                  for (let i = 0; i < startingDayOfWeek; i++) {
                    cells.push(<div key={`empty-${i}`} className="min-h-[80px]" />);
                  }

                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dayDeals = getDealsForDate(day);
                    const isToday = today.getDate() === day &&
                                   today.getMonth() === calendarDate.getMonth() &&
                                   today.getFullYear() === calendarDate.getFullYear();

                    cells.push(
                      <div
                        key={day}
                        className={`min-h-[80px] border rounded-md p-1 ${
                          isToday ? "border-primary bg-primary/5" : "border-border"
                        }`}
                      >
                        <div className={`text-xs font-medium mb-1 ${isToday ? "text-primary" : ""}`}>
                          {day}
                        </div>
                        <div className="space-y-1">
                          {dayDeals.slice(0, 3).map((deal) => (
                            <div
                              key={deal.id}
                              className="text-xs p-1 rounded bg-muted truncate cursor-pointer hover:bg-muted/80"
                              onClick={() => handleDealClick(deal.id)}
                              title={deal.clientName}
                            >
                              {deal.clientName}
                            </div>
                          ))}
                          {dayDeals.length > 3 && (
                            <div className="text-xs text-muted-foreground">+{dayDeals.length - 3} ещё</div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return cells;
                })()}
              </div>
            </div>
          )}
        </>
      )}

      <DealDetailSheet
        deal={selectedDeal}
        open={isDetailSheetOpen}
        onOpenChange={setIsDetailSheetOpen}
      />

      <DealCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />

      <ManageStagesDialog
        open={isManageStagesOpen}
        onOpenChange={setIsManageStagesOpen}
      />

      <DealCardModal 
        dealId={selectedDealId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      <DeleteDealDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedDeals))}
        dealName={`${selectedDeals.size} ${selectedDeals.size === 1 ? 'сделку' : selectedDeals.size < 5 ? 'сделки' : 'сделок'}`}
        isPending={bulkDeleteMutation.isPending}
      />

      <BulkStageChangeDialog
        open={bulkStageDialogOpen}
        onOpenChange={setBulkStageDialogOpen}
        onConfirm={(newStage) => {
          bulkUpdateStageMutation.mutate({
            dealIds: Array.from(selectedDeals),
            newStage
          });
        }}
        selectedCount={selectedDeals.size}
        stages={stages}
        isPending={bulkUpdateStageMutation.isPending}
      />
    </div>
  );
}
