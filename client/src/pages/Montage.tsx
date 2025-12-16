import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Calendar,
  LayoutGrid,
  List,
  MapPin,
  Phone,
  User,
  Users,
  Wrench,
  Package,
  Clock,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  X,
  Trash2,
  Edit,
  Mail,
  Star,
  Check,
  AlertCircle,
  ChevronDown,
  Palette,
  Settings,
  Truck,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MontageOrder {
  id: string;
  order_number: string;
  project_id: string | null;
  project_name: string | null;
  address: string;
  client_name: string | null;
  client_phone: string | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  deadline: string | null;
  status: string;
  installer_id: string | null;
  installer_name: string | null;
  total_cost: number | null;
  notes: string | null;
  items: MontageItem[];
  items_count: number;
  installers: OrderInstaller[];
  created_at: string;
  updated_at: string;
}

interface OrderInstaller {
  id: string;
  installer_id: string;
  installer_name: string | null;
  installer_phone: string | null;
  installer_specialization: string | null;
  installer_hourly_rate: number | null;
}

interface Project {
  id: string;
  name: string;
  client_name: string | null;
  address: string | null;
  status: string;
}

interface ProjectItem {
  id: string;
  name: string;
  article: string | null;
  quantity: number;
  price: number | null;
  image_url: string | null;
  ready_for_montage: boolean;
}

interface MontageItem {
  id: string;
  montage_order_id: string;
  project_item_id: string;
  quantity: number;
  status: string;
  cost: number | null;
  notes: string | null;
  item_name: string | null;
  item_article: string | null;
  item_quantity: number | null;
  item_price: number | null;
  item_image_url: string | null;
  project_id: string | null;
}

interface Installer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  specialization: string | null;
  hourly_rate: number | null;
  qualification_level: string | null;
  description: string | null;
  is_active: boolean;
}

interface MontageStatus {
  id: string;
  code: string;
  name: string;
  color: string;
  bg_color: string | null;
  text_color: string | null;
  order: number;
  is_system: boolean;
  is_active: boolean;
}

interface MontageItemStatus {
  id: string;
  code: string;
  name: string;
  color: string;
  bg_color: string | null;
  text_color: string | null;
  order: number;
  is_system: boolean;
  is_active: boolean;
}

const qualificationConfig: Record<string, { label: string; color: string }> = {
  low: { label: "Низкий", color: "bg-orange-200 text-orange-700" },
  medium: { label: "Средний", color: "bg-blue-200 text-blue-700" },
  high: { label: "Высокий", color: "bg-green-200 text-green-700" },
};

// Форматирование телефона: +7 XXX XXX-XX-XX
const formatPhoneNumber = (value: string): string => {
  // Убираем всё кроме цифр
  const digits = value.replace(/\D/g, '');

  // Если начинается с 8 или 7, убираем первую цифру
  const cleanDigits = digits.startsWith('8') || digits.startsWith('7')
    ? digits.slice(1)
    : digits;

  // Ограничиваем до 10 цифр (без кода страны)
  const limited = cleanDigits.slice(0, 10);

  // Форматируем
  if (limited.length === 0) return '+7 ';
  if (limited.length <= 3) return `+7 ${limited}`;
  if (limited.length <= 6) return `+7 ${limited.slice(0, 3)} ${limited.slice(3)}`;
  if (limited.length <= 8) return `+7 ${limited.slice(0, 3)} ${limited.slice(3, 6)}-${limited.slice(6)}`;
  return `+7 ${limited.slice(0, 3)} ${limited.slice(3, 6)}-${limited.slice(6, 8)}-${limited.slice(8)}`;
};

interface MontageStats {
  total: number;
  planned: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  total_cost: number;
}

// Fallback status config (used if API fails)
const defaultStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  planned: { label: "Запланирован", color: "text-yellow-600", bgColor: "bg-yellow-100" },
  in_progress: { label: "В работе", color: "text-blue-600", bgColor: "bg-blue-100" },
  completed: { label: "Завершён", color: "text-green-600", bgColor: "bg-green-100" },
  cancelled: { label: "Отменён", color: "text-gray-600", bgColor: "bg-gray-100" },
};

// Color presets for status columns
const colorPresets: Record<string, { borderColor: string; textColor: string; bgColor: string }> = {
  yellow: { borderColor: "border-l-amber-500", textColor: "text-yellow-600", bgColor: "bg-yellow-100" },
  blue: { borderColor: "border-l-blue-500", textColor: "text-blue-600", bgColor: "bg-blue-100" },
  green: { borderColor: "border-l-emerald-500", textColor: "text-green-600", bgColor: "bg-green-100" },
  gray: { borderColor: "border-l-gray-500", textColor: "text-gray-600", bgColor: "bg-gray-100" },
  red: { borderColor: "border-l-red-500", textColor: "text-red-600", bgColor: "bg-red-100" },
  purple: { borderColor: "border-l-purple-500", textColor: "text-purple-600", bgColor: "bg-purple-100" },
  orange: { borderColor: "border-l-orange-500", textColor: "text-orange-600", bgColor: "bg-orange-100" },
  cyan: { borderColor: "border-l-cyan-500", textColor: "text-cyan-600", bgColor: "bg-cyan-100" },
};

// itemStatusConfig is now dynamically loaded from API inside the component

// Sortable Card Component
function SortableCard({
  order,
  onClick,
  statusConfig,
  itemStatusConfig,
}: {
  order: MontageOrder;
  onClick: () => void;
  statusConfig: Record<string, { label: string; color: string; bgColor: string }>;
  itemStatusConfig: Record<string, { label: string; color: string }>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: order.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Handle click only if not dragging
  const handleClick = (e: React.MouseEvent) => {
    // Prevent click if we're in drag mode
    if (isDragging) {
      e.preventDefault();
      return;
    }
    onClick();
  };

  const statusStyle = statusConfig[order.status] || { label: order.status, color: "text-gray-600", bgColor: "bg-gray-100" };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-2 cursor-grab active:cursor-grabbing"
    >
      <Card
        className="hover:shadow-md transition-shadow select-none"
        onClick={handleClick}
      >
        <CardContent className="p-2">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1">
              <GripVertical className="h-3 w-3 text-gray-400" />
              <span className="font-medium text-xs">{order.order_number}</span>
            </div>
            <Badge className={`${statusStyle.bgColor} ${statusStyle.color} text-xs px-1 py-0`}>
              {statusStyle.label}
            </Badge>
          </div>

          <div className="space-y-0.5 text-xs">
            <div className="flex items-center gap-1 text-gray-600">
              <MapPin className="h-2.5 w-2.5" />
              <span className="truncate">{order.address}</span>
            </div>
            {order.scheduled_date && (
              <div className="flex items-center gap-1 text-gray-600">
                <Calendar className="h-2.5 w-2.5" />
                <span>{order.scheduled_date}</span>
                {order.scheduled_time && <span>в {order.scheduled_time}</span>}
              </div>
            )}
            {order.installer_name && (
              <div className="flex items-center gap-1 text-gray-600">
                <Wrench className="h-2.5 w-2.5" />
                <span>{order.installer_name}</span>
              </div>
            )}
            {order.project_name && (
              <div className="flex items-center gap-1 text-gray-500">
                <Package className="h-2.5 w-2.5" />
                <span className="truncate">{order.project_name}</span>
              </div>
            )}
          </div>

          {/* Item status counts */}
          {order.items && order.items.length > 0 && (
            <div className="flex flex-wrap gap-0.5 mt-1 pt-1 border-t">
              {Object.entries(
                order.items.reduce((acc, item) => {
                  acc[item.status] = (acc[item.status] || 0) + 1;
                  return acc;
                }, {} as Record<string, number>)
              ).map(([status, count]) => {
                const config = itemStatusConfig[status] || { label: status, color: "bg-gray-200 text-gray-700" };
                return (
                  <span
                    key={status}
                    className={`px-1 py-0 text-xs rounded ${config.color}`}
                    title={config.label}
                  >
                    {count}
                  </span>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between mt-1 pt-1 border-t">
            <span className="text-xs text-gray-500">{order.items_count} поз.</span>
            {order.total_cost && (
              <span className="font-medium text-xs">{order.total_cost.toLocaleString()} ₽</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Kanban Column Component with Droppable
function KanbanColumn({
  title,
  status,
  orders,
  count,
  borderColor,
  isSystem,
  onCardClick,
  onEditStatus,
  onDeleteStatus,
  statusConfig,
  itemStatusConfig,
}: {
  title: string;
  status: string;
  orders: MontageOrder[];
  count: number;
  borderColor: string;
  isSystem: boolean;
  onCardClick: (order: MontageOrder) => void;
  onEditStatus: () => void;
  onDeleteStatus: () => void;
  statusConfig: Record<string, { label: string; color: string; bgColor: string }>;
  itemStatusConfig: Record<string, { label: string; color: string }>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-shrink-0 w-56 md:w-60">
      <Card className={`border-l-[3px] ${borderColor} bg-zinc-900/95`}>
        <CardHeader className="pb-2 pt-2 px-2">
          <div className="flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto p-0.5 text-white hover:bg-zinc-700">
                  <CardTitle className="text-xs font-medium">{title}</CardTitle>
                  <ChevronDown className="ml-1 h-2.5 w-2.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={onEditStatus}>
                  <Edit className="mr-2 h-3 w-3" /> Редактировать
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEditStatus}>
                  <Palette className="mr-2 h-3 w-3" /> Изменить цвет
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDeleteStatus}
                  disabled={isSystem || count > 0}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  {isSystem ? "Системный" : count > 0 ? `${count} заказ.` : "Удалить"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Badge variant="secondary" className="bg-zinc-700 text-zinc-300 text-xs px-1">{count}</Badge>
          </div>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className={`space-y-2 min-h-[200px] px-2 pb-2 transition-colors ${
            isOver ? "bg-zinc-800/50" : ""
          }`}
        >
          <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            {orders.map((order) => (
              <SortableCard key={order.id} order={order} onClick={() => onCardClick(order)} statusConfig={statusConfig} itemStatusConfig={itemStatusConfig} />
            ))}
          </SortableContext>
          {orders.length === 0 && (
            <div className={`text-center py-4 ${isOver ? "text-zinc-300" : "text-zinc-500"}`}>
              <Package className={`h-6 w-6 mx-auto mb-1 ${isOver ? "opacity-100" : "opacity-50"}`} />
              <p className="text-xs">{isOver ? "Отпустите" : "Нет заказов"}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Montage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("kanban");
  const [selectedOrder, setSelectedOrder] = useState<MontageOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draggedOrder, setDraggedOrder] = useState<MontageOrder | null>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(85); // 85% по умолчанию для компактности
  const [calendarZoom, setCalendarZoom] = useState(100); // Масштаб календаря
  const [itemsPerPage, setItemsPerPage] = useState(10); // Количество на странице в списке
  const [currentPage, setCurrentPage] = useState(1); // Текущая страница

  // Installer management state
  const [isInstallersOpen, setIsInstallersOpen] = useState(false);
  const [isInstallerFormOpen, setIsInstallerFormOpen] = useState(false);
  const [editingInstaller, setEditingInstaller] = useState<Installer | null>(null);
  const [installerFormData, setInstallerFormData] = useState({
    name: "",
    phone: "+7 ",
    email: "",
    specialization: "",
    hourly_rate: "",
    qualification_level: "medium",
    vehicle_number: "",
    description: "",
  });

  // Form state for create/edit
  const [formData, setFormData] = useState({
    address: "",
    client_name: "",
    client_phone: "",
    scheduled_date: "",
    scheduled_time: "",
    deadline: "",
    installer_id: "",
    total_cost: "",
    notes: "",
  });

  // New state for multiple installers and project/items selection
  const [selectedInstallerIds, setSelectedInstallerIds] = useState<string[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // State for adding items to existing orders
  const [isAddItemDialogOpen, setIsAddItemDialogOpen] = useState(false);
  const [addItemProjectId, setAddItemProjectId] = useState<string>("");
  const [addItemSelectedIds, setAddItemSelectedIds] = useState<string[]>([]);
  const [addItemQuantity, setAddItemQuantity] = useState(1);
  const [addItemCost, setAddItemCost] = useState<string>("");

  // State for status management
  const [isStatusFormOpen, setIsStatusFormOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<MontageStatus | null>(null);
  const [statusFormData, setStatusFormData] = useState({
    code: "",
    name: "",
    color: "blue",
  });

  // State for item status management
  const [isItemStatusFormOpen, setIsItemStatusFormOpen] = useState(false);
  const [editingItemStatus, setEditingItemStatus] = useState<MontageItemStatus | null>(null);
  const [itemStatusFormData, setItemStatusFormData] = useState({
    code: "",
    name: "",
    color: "blue",
  });

  // Fetch montage statuses from API
  const { data: montageStatuses = [] } = useQuery<MontageStatus[]>({
    queryKey: ["/api/montage/statuses"],
    queryFn: async () => {
      const res = await fetch("/api/montage/statuses");
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json();
    },
  });

  // Create statusConfig from API data
  const statusConfig = useMemo(() => {
    if (montageStatuses.length === 0) return defaultStatusConfig;
    return montageStatuses.reduce((acc, status) => {
      const preset = colorPresets[status.color] || colorPresets.gray;
      acc[status.code] = {
        label: status.name,
        color: status.text_color || preset.textColor,
        bgColor: status.bg_color || preset.bgColor,
      };
      return acc;
    }, {} as Record<string, { label: string; color: string; bgColor: string }>);
  }, [montageStatuses]);

  // Fetch montage item statuses from API
  const { data: montageItemStatuses = [] } = useQuery<MontageItemStatus[]>({
    queryKey: ["/api/montage/item-statuses"],
    queryFn: async () => {
      const res = await fetch("/api/montage/item-statuses");
      if (!res.ok) throw new Error("Failed to fetch item statuses");
      return res.json();
    },
  });

  // Create itemStatusConfig from API data
  const itemStatusConfig = useMemo(() => {
    const defaultConfig: Record<string, { label: string; color: string }> = {
      pending: { label: "Ожидает", color: "bg-gray-200 text-gray-700" },
      warehouse: { label: "На складе", color: "bg-blue-200 text-blue-700" },
      on_site: { label: "На объекте", color: "bg-yellow-200 text-yellow-700" },
      completed: { label: "Готово", color: "bg-green-200 text-green-700" },
    };
    if (montageItemStatuses.length === 0) return defaultConfig;
    return montageItemStatuses.reduce((acc, status) => {
      // Ensure valid colors with fallbacks
      const bgColor = status.bg_color || 'bg-gray-200';
      const textColor = status.text_color || 'text-gray-900';

      acc[status.code] = {
        label: status.name,
        color: `${bgColor} ${textColor}`,
      };
      return acc;
    }, {} as Record<string, { label: string; color: string }>);
  }, [montageItemStatuses]);

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery<MontageOrder[]>({
    queryKey: ["/api/montage"],
    queryFn: async () => {
      const res = await fetch("/api/montage");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
    refetchInterval: 5000, // Real-time: обновление каждые 5 секунд
  });

  // Fetch installers
  const { data: installers = [] } = useQuery<Installer[]>({
    queryKey: ["/api/installers"],
    queryFn: async () => {
      const res = await fetch("/api/installers");
      if (!res.ok) throw new Error("Failed to fetch installers");
      return res.json();
    },
  });

  // Fetch stats
  const { data: stats } = useQuery<MontageStats>({
    queryKey: ["/api/montage/stats"],
    queryFn: async () => {
      const res = await fetch("/api/montage/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 5000, // Real-time: обновление каждые 5 секунд
  });

  // Fetch projects for selection
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  // Fetch items for selected project
  const { data: projectItems = [] } = useQuery<ProjectItem[]>({
    queryKey: ["/api/projects", selectedProjectId, "items"],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/projects/${selectedProjectId}/items`);
      if (!res.ok) throw new Error("Failed to fetch project items");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  // Fetch assigned items (already in active montage orders)
  const { data: assignedItemIds = [] } = useQuery<string[]>({
    queryKey: ["/api/montage/items/assigned", selectedProjectId],
    queryFn: async () => {
      if (!selectedProjectId) return [];
      const res = await fetch(`/api/montage/items/assigned?project_id=${selectedProjectId}`);
      if (!res.ok) throw new Error("Failed to fetch assigned items");
      return res.json();
    },
    enabled: !!selectedProjectId,
  });

  // Create order mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/montage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          project_id: selectedProjectId || null,
          total_cost: data.total_cost ? parseFloat(data.total_cost) : null,
          installer_id: data.installer_id || null,
          installer_ids: selectedInstallerIds,
        }),
      });
      if (!res.ok) throw new Error("Failed to create order");
      return res.json();
    },
    onSuccess: async (order) => {
      // Add selected items to the order
      if (selectedItemIds.length > 0) {
        for (const itemId of selectedItemIds) {
          try {
            await fetch(`/api/montage/${order.id}/items`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                project_item_id: itemId,
                quantity: 1,
                status: "pending",
              }),
            });
          } catch (err) {
            console.error("Failed to add item to order:", err);
          }
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/montage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/montage/stats"] });
      toast({ title: "Заказ создан" });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать заказ", variant: "destructive" });
    },
  });

  // Update order mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MontageOrder> }) => {
      const res = await fetch(`/api/montage/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update order");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/montage/stats"] });
      toast({ title: "Заказ обновлён" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить заказ", variant: "destructive" });
    },
  });

  // Delete order mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/montage/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete order");
      return true; // DELETE returns 204 No Content
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage"] });
      queryClient.invalidateQueries({ queryKey: ["/api/montage/stats"] });
      toast({ title: "Заказ удалён" });
      setIsDetailOpen(false);
      setSelectedOrder(null);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить заказ", variant: "destructive" });
    },
  });

  // Create installer mutation
  const createInstallerMutation = useMutation({
    mutationFn: async (data: typeof installerFormData) => {
      const res = await fetch("/api/installers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : null,
        }),
      });
      if (!res.ok) throw new Error("Failed to create installer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installers"] });
      toast({ title: "Монтажник добавлен" });
      setIsInstallerFormOpen(false);
      resetInstallerForm();
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось добавить монтажника", variant: "destructive" });
    },
  });

  // Update installer mutation
  const updateInstallerMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Installer> }) => {
      const res = await fetch(`/api/installers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update installer");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installers"] });
      toast({ title: "Монтажник обновлён" });
      setIsInstallerFormOpen(false);
      setEditingInstaller(null);
      resetInstallerForm();
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить монтажника", variant: "destructive" });
    },
  });

  // Delete installer mutation
  const deleteInstallerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/installers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete installer");
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/installers"] });
      toast({ title: "Монтажник удалён" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить монтажника", variant: "destructive" });
    },
  });

  // Create status mutation
  const createStatusMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; color: string }) => {
      const res = await fetch("/api/montage/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage/statuses"] });
      toast({ title: "Статус создан" });
      setIsStatusFormOpen(false);
      resetStatusForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MontageStatus> }) => {
      const res = await fetch(`/api/montage/statuses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage/statuses"] });
      toast({ title: "Статус обновлён" });
      setIsStatusFormOpen(false);
      setEditingStatus(null);
      resetStatusForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Delete status mutation
  const deleteStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/montage/statuses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete status");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage/statuses"] });
      toast({ title: "Статус удалён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // === ITEM STATUS MUTATIONS ===

  // Reset item status form
  const resetItemStatusForm = () => {
    setItemStatusFormData({ code: "", name: "", color: "blue" });
    setEditingItemStatus(null);
  };

  // Create item status mutation
  const createItemStatusMutation = useMutation({
    mutationFn: async (data: { code: string; name: string; color: string }) => {
      const res = await fetch("/api/montage/item-statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          bg_color: `bg-${data.color}-200`,
          text_color: `text-${data.color}-700`,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create item status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage/item-statuses"] });
      toast({ title: "Статус изделия создан" });
      setIsItemStatusFormOpen(false);
      resetItemStatusForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Update item status mutation
  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MontageItemStatus> }) => {
      const res = await fetch(`/api/montage/item-statuses/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          bg_color: data.color ? `bg-${data.color}-200` : undefined,
          text_color: data.color ? `text-${data.color}-700` : undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update item status");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage/item-statuses"] });
      toast({ title: "Статус изделия обновлён" });
      setIsItemStatusFormOpen(false);
      resetItemStatusForm();
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Delete item status mutation
  const deleteItemStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/montage/item-statuses/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete item status");
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage/item-statuses"] });
      toast({ title: "Статус изделия удалён" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Update montage item (status, notes)
  const updateMontageItemMutation = useMutation({
    mutationFn: async ({ itemId, status, notes }: { itemId: string; status?: string; notes?: string }) => {
      const body: Record<string, string> = {};
      if (status !== undefined) body.status = status;
      if (notes !== undefined) body.notes = notes;

      const res = await fetch(`/api/montage/items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/montage"] });
      toast({ title: "Изделие обновлено" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  // Handle item status form submit
  const handleItemStatusSubmit = () => {
    if (editingItemStatus) {
      updateItemStatusMutation.mutate({
        id: editingItemStatus.id,
        data: itemStatusFormData,
      });
    } else {
      createItemStatusMutation.mutate(itemStatusFormData);
    }
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const order = orders.find((o) => o.id === event.active.id);
    setDraggedOrder(order || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedOrder(null);

    if (!over) return;

    const orderId = active.id as string;
    const overId = over.id as string;
    // Use dynamic statuses from API
    const statuses = montageStatuses.map(s => s.code);

    // Find the dragged order
    const draggedOrderItem = orders.find((o) => o.id === orderId);
    if (!draggedOrderItem) return;

    let newStatus: string | null = null;

    // Check if dropped directly on a column
    if (statuses.includes(overId)) {
      newStatus = overId;
    } else {
      // Dropped on another card - find what column that card is in
      const targetOrder = orders.find((o) => o.id === overId);
      if (targetOrder) {
        newStatus = targetOrder.status;
      }
    }

    // Update status if it changed
    if (newStatus && draggedOrderItem.status !== newStatus) {
      updateMutation.mutate({ id: orderId, data: { status: newStatus } });
    }
  };

  const resetForm = () => {
    setFormData({
      address: "",
      client_name: "",
      client_phone: "",
      scheduled_date: "",
      scheduled_time: "",
      deadline: "",
      installer_id: "",
      total_cost: "",
      notes: "",
    });
    setSelectedInstallerIds([]);
    setSelectedProjectId("");
    setSelectedItemIds([]);
  };

  const resetInstallerForm = () => {
    setInstallerFormData({
      name: "",
      phone: "+7 ",
      email: "",
      specialization: "",
      hourly_rate: "",
      qualification_level: "medium",
      vehicle_number: "",
      description: "",
    });
  };

  const resetStatusForm = () => {
    setStatusFormData({
      code: "",
      name: "",
      color: "blue",
    });
  };

  const handleEditStatus = (status: MontageStatus) => {
    setEditingStatus(status);
    setStatusFormData({
      code: status.code,
      name: status.name,
      color: status.color,
    });
    setIsStatusFormOpen(true);
  };

  const handleStatusFormSubmit = () => {
    if (!statusFormData.name) {
      toast({ title: "Ошибка", description: "Укажите название статуса", variant: "destructive" });
      return;
    }
    if (!statusFormData.code) {
      toast({ title: "Ошибка", description: "Укажите код статуса (латиницей)", variant: "destructive" });
      return;
    }
    if (editingStatus) {
      updateStatusMutation.mutate({
        id: editingStatus.id,
        data: statusFormData,
      });
    } else {
      createStatusMutation.mutate(statusFormData);
    }
  };

  const handleDeleteStatus = (status: MontageStatus) => {
    if (status.is_system) {
      toast({ title: "Ошибка", description: "Нельзя удалить системный статус", variant: "destructive" });
      return;
    }
    deleteStatusMutation.mutate(status.id);
  };

  const handleEditInstaller = (installer: Installer) => {
    setEditingInstaller(installer);
    setInstallerFormData({
      name: installer.name,
      phone: installer.phone ? formatPhoneNumber(installer.phone) : "+7 ",
      email: installer.email || "",
      specialization: installer.specialization || "",
      hourly_rate: installer.hourly_rate?.toString() || "",
      qualification_level: installer.qualification_level || "medium",
      vehicle_number: installer.vehicle_number || "",
      description: installer.description || "",
    });
    setIsInstallerFormOpen(true);
  };

  const handleInstallerFormSubmit = () => {
    if (!installerFormData.name) {
      toast({ title: "Ошибка", description: "Укажите имя монтажника", variant: "destructive" });
      return;
    }
    if (editingInstaller) {
      updateInstallerMutation.mutate({
        id: editingInstaller.id,
        data: {
          ...installerFormData,
          hourly_rate: installerFormData.hourly_rate ? parseFloat(installerFormData.hourly_rate) : null,
        } as Partial<Installer>,
      });
    } else {
      createInstallerMutation.mutate(installerFormData);
    }
  };

  const handleCreateSubmit = () => {
    if (!formData.address) {
      toast({ title: "Ошибка", description: "Укажите адрес", variant: "destructive" });
      return;
    }

    // Валидация: проверяем что все выбранные позиции готовы к монтажу
    if (selectedItemIds.length > 0 && selectedProjectId) {
      const notReadyItems = projectItems.filter(
        item => selectedItemIds.includes(item.id) && !item.ready_for_montage
      );

      if (notReadyItems.length > 0) {
        toast({
          title: "Ошибка",
          description: `Позиции не готовы к монтажу: ${notReadyItems.map(i => i.name).join(', ')}`,
          variant: "destructive"
        });
        return;
      }
    }

    createMutation.mutate(formData);
  };

  const handleOpenDetail = (order: MontageOrder) => {
    setSelectedOrder(order);
    setIsDetailOpen(true);
  };

  // Filter orders by search
  const filteredOrders = orders.filter((order) => {
    const search = searchQuery.toLowerCase();
    return (
      order.order_number?.toLowerCase().includes(search) ||
      order.address?.toLowerCase().includes(search) ||
      order.client_name?.toLowerCase().includes(search) ||
      order.project_name?.toLowerCase().includes(search) ||
      order.installer_name?.toLowerCase().includes(search)
    );
  });

  // Group orders by status for Kanban (dynamic based on API statuses)
  const ordersByStatus = useMemo(() => {
    const result: Record<string, MontageOrder[]> = {};
    // Initialize all statuses with empty arrays
    montageStatuses.forEach(status => {
      result[status.code] = filteredOrders.filter((o) => o.status === status.code);
    });
    // Fallback for orders with unknown status
    const knownCodes = montageStatuses.map(s => s.code);
    const unknownOrders = filteredOrders.filter(o => !knownCodes.includes(o.status));
    if (unknownOrders.length > 0 && result[knownCodes[0]]) {
      result[knownCodes[0]] = [...result[knownCodes[0]], ...unknownOrders];
    }
    return result;
  }, [filteredOrders, montageStatuses]);

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    // Add empty days for padding
    const startDay = firstDay.getDay() || 7;
    for (let i = 1; i < startDay; i++) {
      days.push(null);
    }

    // Add actual days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getOrdersForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return filteredOrders.filter((o) => o.scheduled_date === dateStr);
  };

  const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Монтаж</h1>
          <p className="text-gray-500">Управление заказами на монтаж</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsInstallersOpen(true)}>
            <Users className="h-4 w-4 mr-2" />
            Монтажники
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Создать заказ
          </Button>
        </div>
      </div>

      {/* Stats - Compact */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Card>
            <CardContent className="p-2">
              <div className="text-lg font-bold">{stats.total}</div>
              <div className="text-xs text-gray-500">Всего</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="text-lg font-bold text-yellow-600">{stats.planned}</div>
              <div className="text-xs text-gray-500">Запланировано</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="text-lg font-bold text-blue-600">{stats.in_progress}</div>
              <div className="text-xs text-gray-500">В работе</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="text-lg font-bold text-green-600">{stats.completed}</div>
              <div className="text-xs text-gray-500">Завершено</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-2">
              <div className="text-lg font-bold">{stats.total_cost?.toLocaleString() || 0} ₽</div>
              <div className="text-xs text-gray-500">Общая сумма</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search and View Toggle */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск по адресу, клиенту, проекту..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="kanban">
              <LayoutGrid className="h-4 w-4 mr-2" />
              Kanban
            </TabsTrigger>
            <TabsTrigger value="list">
              <List className="h-4 w-4 mr-2" />
              Список
            </TabsTrigger>
            <TabsTrigger value="calendar">
              <Calendar className="h-4 w-4 mr-2" />
              Календарь
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {/* Zoom Control for Kanban */}
        {activeTab === "kanban" && (
          <div className="flex items-center gap-1 ml-auto bg-zinc-800 rounded-lg px-2 py-1 border border-zinc-600">
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

        {/* Zoom Control for Calendar */}
        {activeTab === "calendar" && (
          <div className="flex items-center gap-1 ml-auto bg-zinc-800 rounded-lg px-2 py-1 border border-zinc-600">
            <span className="text-xs text-zinc-400 mr-1">Масштаб:</span>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0 bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={() => setCalendarZoom(Math.max(60, calendarZoom - 10))}
              disabled={calendarZoom <= 60}
            >
              −
            </Button>
            <span className="text-sm w-12 text-center font-medium text-white">{calendarZoom}%</span>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 w-6 p-0 bg-zinc-700 hover:bg-zinc-600 text-white"
              onClick={() => setCalendarZoom(Math.min(120, calendarZoom + 10))}
              disabled={calendarZoom >= 120}
            >
              +
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="h-6 px-2 text-xs bg-zinc-700 hover:bg-zinc-600 text-white ml-1"
              onClick={() => setCalendarZoom(100)}
            >
              100%
            </Button>
          </div>
        )}

        {/* Items per page for List */}
        {activeTab === "list" && (
          <div className="flex items-center gap-2 ml-auto bg-zinc-800 rounded-lg px-2 py-1 border border-zinc-600">
            <span className="text-xs text-zinc-400">На странице:</span>
            <Select value={String(itemsPerPage)} onValueChange={(v) => { console.log("Items per page changed:", v); setItemsPerPage(Number(v)); setCurrentPage(1); }}>
              <SelectTrigger className="h-6 w-16 text-xs bg-zinc-700 border-zinc-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200]">
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">Все</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-gray-500">Загрузка...</p>
        </div>
      ) : (
        <>
          {/* Kanban View */}
          {activeTab === "kanban" && (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
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
                  {montageStatuses.map((status) => {
                    const preset = colorPresets[status.color] || colorPresets.gray;
                    const orders = ordersByStatus[status.code] || [];
                    return (
                      <KanbanColumn
                        key={status.id}
                        title={status.name}
                        status={status.code}
                        orders={orders}
                        count={orders.length}
                        borderColor={preset.borderColor}
                        isSystem={status.is_system}
                        onCardClick={handleOpenDetail}
                        onEditStatus={() => handleEditStatus(status)}
                        onDeleteStatus={() => handleDeleteStatus(status)}
                        statusConfig={statusConfig}
                        itemStatusConfig={itemStatusConfig}
                      />
                    );
                  })}
                  {/* Add Status Button - Compact */}
                  <div className="flex-shrink-0 w-56 md:w-60">
                    <Card className="border-l-[3px] border-l-dashed border-l-zinc-600 bg-zinc-900/50 hover:bg-zinc-800/50 cursor-pointer transition-colors">
                      <CardContent
                        className="flex flex-col items-center justify-center min-h-[150px] text-zinc-500"
                        onClick={() => {
                          setEditingStatus(null);
                          resetStatusForm();
                          setIsStatusFormOpen(true);
                        }}
                      >
                        <Plus className="h-6 w-6 mb-1" />
                        <span className="text-xs">Добавить статус</span>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
              <DragOverlay>
                {draggedOrder && (
                  <Card className="shadow-lg">
                    <CardContent className="p-2">
                      <div className="font-medium text-xs">{draggedOrder.order_number}</div>
                      <div className="text-xs text-gray-500">{draggedOrder.address}</div>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* List View */}
          {activeTab === "list" && (() => {
            // Pagination logic
            const totalItems = filteredOrders.length;
            const effectiveItemsPerPage = itemsPerPage >= 100 ? totalItems : itemsPerPage;
            const totalPages = Math.ceil(totalItems / effectiveItemsPerPage) || 1;
            const startIndex = (currentPage - 1) * effectiveItemsPerPage;
            const paginatedOrders = filteredOrders.slice(startIndex, startIndex + effectiveItemsPerPage);
            console.log("Pagination:", JSON.stringify({ totalItems, itemsPerPage, effectiveItemsPerPage, totalPages, startIndex, paginatedLength: paginatedOrders.length }));

            return (
            <div className="space-y-3">
              {filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-12">
                    <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Нет заказов на монтаж</p>
                    <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Создать первый заказ
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {paginatedOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleOpenDetail(order)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-bold">{order.order_number}</span>
                              <Badge className={`${statusConfig[order.status]?.bgColor} ${statusConfig[order.status]?.color}`}>
                                {statusConfig[order.status]?.label}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <div className="flex items-center gap-1 text-gray-600">
                                  <MapPin className="h-4 w-4" />
                                  <span>{order.address}</span>
                                </div>
                              </div>
                              {order.client_name && (
                                <div className="flex items-center gap-1 text-gray-600">
                                  <User className="h-4 w-4" />
                                  <span>{order.client_name}</span>
                                </div>
                              )}
                              {order.scheduled_date && (
                                <div className="flex items-center gap-1 text-gray-600">
                                  <Calendar className="h-4 w-4" />
                                  <span>{order.scheduled_date}</span>
                                </div>
                              )}
                              {order.installer_name && (
                                <div className="flex items-center gap-1 text-gray-600">
                                  <Wrench className="h-4 w-4" />
                                  <span>{order.installer_name}</span>
                                </div>
                              )}
                            </div>
                            {order.project_name && (
                              <div className="mt-2 text-sm text-gray-500">
                                Проект: {order.project_name}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">
                              {order.total_cost?.toLocaleString() || 0} ₽
                            </div>
                            <div className="text-sm text-gray-500">{order.items_count} позиций</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 px-2">
                      <div className="text-sm text-zinc-400">
                        Показано {startIndex + 1}-{Math.min(startIndex + effectiveItemsPerPage, totalItems)} из {totalItems}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 bg-zinc-800 border-zinc-600 hover:bg-zinc-700"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          <ChevronLeft className="h-4 w-4 -ml-2" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 bg-zinc-800 border-zinc-600 hover:bg-zinc-700"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="px-3 text-sm text-white">
                          {currentPage} / {totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 bg-zinc-800 border-zinc-600 hover:bg-zinc-700"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 w-8 p-0 bg-zinc-800 border-zinc-600 hover:bg-zinc-700"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                          <ChevronRight className="h-4 w-4 -ml-2" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            );
          })()}

          {/* Calendar View */}
          {activeTab === "calendar" && (
            <div
              className="overflow-auto"
              style={{
                transform: `scale(${calendarZoom / 100})`,
                transformOrigin: 'top left',
                width: `${100 / (calendarZoom / 100)}%`
              }}
            >
            <Card className="bg-zinc-900/95 border-zinc-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-600 hover:bg-zinc-800"
                    onClick={() =>
                      setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))
                    }
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <CardTitle className="text-white">
                    {monthNames[calendarDate.getMonth()]} {calendarDate.getFullYear()}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-zinc-600 hover:bg-zinc-800"
                    onClick={() =>
                      setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))
                    }
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1">
                  {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
                    <div key={day} className="text-center font-medium py-2 text-zinc-400">
                      {day}
                    </div>
                  ))}
                  {getDaysInMonth(calendarDate).map((day, idx) => {
                    if (!day) {
                      return <div key={`empty-${idx}`} className="min-h-[100px] bg-zinc-800/30"></div>;
                    }
                    const dayOrders = getOrdersForDate(day);
                    const isToday = day.toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={day.toISOString()}
                        className={`min-h-[100px] border rounded p-1 ${
                          isToday ? "bg-blue-900/50 border-blue-500" : "bg-zinc-800 border-zinc-700"
                        }`}
                      >
                        <div className={`text-sm font-medium mb-1 ${isToday ? "text-blue-400" : "text-zinc-300"}`}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayOrders.slice(0, 3).map((order) => (
                            <div
                              key={order.id}
                              className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${statusConfig[order.status]?.bgColor} ${statusConfig[order.status]?.color}`}
                              onClick={() => handleOpenDetail(order)}
                              title={`${order.order_number} - ${order.address}`}
                            >
                              {order.order_number}
                            </div>
                          ))}
                          {dayOrders.length > 3 && (
                            <div className="text-xs text-zinc-400 text-center">
                              +{dayOrders.length - 3} ещё
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Новый заказ на монтаж</DialogTitle>
            <DialogDescription>
              Заполните информацию о заказе на монтаж
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Project Selection */}
            <div>
              <Label>Проект</Label>
              <Select
                value={selectedProjectId}
                onValueChange={(value) => {
                  setSelectedProjectId(value);
                  setSelectedItemIds([]);
                  // Auto-fill address and client from project
                  const project = projects.find(p => p.id === value);
                  if (project) {
                    setFormData(prev => ({
                      ...prev,
                      address: project.address || prev.address,
                      client_name: project.client_name || prev.client_name,
                    }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name} {project.client_name && `- ${project.client_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Items Selection */}
            {selectedProjectId && (
              <div>
                <Label className="mb-2 block">Изделия для монтажа</Label>
                {projectItems.length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center border rounded bg-zinc-800/50">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Нет позиций в проекте
                  </div>
                ) : (
                  <div className="border rounded max-h-48 overflow-y-auto">
                    {projectItems.map((item) => {
                      const isAssigned = assignedItemIds.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 p-3 border-b last:border-b-0 ${
                            isAssigned
                              ? "opacity-60 cursor-not-allowed"
                              : "cursor-pointer hover:bg-zinc-800/50"
                          } ${
                            selectedItemIds.includes(item.id) ? "bg-zinc-700/50" : ""
                          }`}
                          onClick={() => {
                            if (isAssigned) return;
                            if (selectedItemIds.includes(item.id)) {
                              setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                            } else {
                              setSelectedItemIds(prev => [...prev, item.id]);
                            }
                          }}
                        >
                          <Checkbox
                            checked={selectedItemIds.includes(item.id)}
                            disabled={isAssigned}
                            onCheckedChange={(checked) => {
                              if (isAssigned) return;
                              if (checked) {
                                setSelectedItemIds(prev => [...prev, item.id]);
                              } else {
                                setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                              }
                            }}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.name}</div>
                            <div className="text-xs text-gray-500">
                              {item.quantity} шт.
                              {item.article && ` • ${item.article}`}
                            </div>
                          </div>
                          {isAssigned ? (
                            <Badge className="bg-orange-200 text-orange-700">
                              <Truck className="h-3 w-3 mr-1" />
                              В монтаже
                            </Badge>
                          ) : item.ready_for_montage ? (
                            <Badge className="bg-green-200 text-green-700">
                              <Check className="h-3 w-3 mr-1" />
                              Готово
                            </Badge>
                          ) : (
                            <Badge className="bg-gray-200 text-gray-600">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Не готово
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {selectedItemIds.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Выбрано: {selectedItemIds.length} из {projectItems.length}
                  </p>
                )}
              </div>
            )}

            <div>
              <Label>Адрес *</Label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="ул. Ленина, 15"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Имя клиента</Label>
                <Input
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Иванов Иван"
                />
              </div>
              <div>
                <Label>Телефон клиента</Label>
                <Input
                  value={formData.client_phone || '+7 '}
                  onChange={(e) => setFormData({ ...formData, client_phone: formatPhoneNumber(e.target.value) })}
                  placeholder="+7 999 123-45-67"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Дата монтажа</Label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Время</Label>
                <Input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Срок выполнения</Label>
                <Input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                />
              </div>
            </div>

            {/* Multiple Installers Selection */}
            <div>
              <Label className="mb-2 block">Монтажники (можно выбрать несколько)</Label>
              <div className="border rounded max-h-40 overflow-y-auto">
                {installers.filter(i => i.is_active).length === 0 ? (
                  <div className="text-sm text-gray-500 py-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-1 opacity-50" />
                    Нет активных монтажников
                  </div>
                ) : (
                  installers
                    .filter((i) => i.is_active)
                    .map((installer) => (
                      <div
                        key={installer.id}
                        className={`flex items-center gap-3 p-2 border-b last:border-b-0 cursor-pointer hover:bg-zinc-800/50 ${
                          selectedInstallerIds.includes(installer.id) ? "bg-zinc-700/50" : ""
                        }`}
                        onClick={() => {
                          if (selectedInstallerIds.includes(installer.id)) {
                            setSelectedInstallerIds(prev => prev.filter(id => id !== installer.id));
                          } else {
                            setSelectedInstallerIds(prev => [...prev, installer.id]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={selectedInstallerIds.includes(installer.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedInstallerIds(prev => [...prev, installer.id]);
                            } else {
                              setSelectedInstallerIds(prev => prev.filter(id => id !== installer.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{installer.name}</div>
                          <div className="text-xs text-gray-500">
                            {installer.specialization || "Монтажник"}
                            {installer.hourly_rate && ` • ${installer.hourly_rate.toLocaleString()} ₽/день`}
                          </div>
                        </div>
                        {installer.qualification_level && (
                          <Badge className={qualificationConfig[installer.qualification_level]?.color || "bg-gray-200 text-gray-700"}>
                            {qualificationConfig[installer.qualification_level]?.label || installer.qualification_level}
                          </Badge>
                        )}
                      </div>
                    ))
                )}
              </div>
              {selectedInstallerIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Выбрано: {selectedInstallerIds.length}
                </p>
              )}
            </div>

            <div>
              <Label>Стоимость монтажа (₽)</Label>
              <Input
                type="number"
                value={formData.total_cost}
                onChange={(e) => setFormData({ ...formData, total_cost: e.target.value })}
                placeholder="5000"
              />
            </div>
            <div>
              <Label>Заметки</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-[550px] sm:max-w-[550px] overflow-y-auto">
          {selectedOrder && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>Заказ {selectedOrder.order_number}</SheetTitle>
                  <Badge className={`${statusConfig[selectedOrder.status]?.bgColor} ${statusConfig[selectedOrder.status]?.color}`}>
                    {statusConfig[selectedOrder.status]?.label}
                  </Badge>
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Address & Client */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <div className="font-medium">{selectedOrder.address}</div>
                    </div>
                  </div>
                  {selectedOrder.client_name && (
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-400" />
                      <div>{selectedOrder.client_name}</div>
                    </div>
                  )}
                  {selectedOrder.client_phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-5 w-5 text-gray-400" />
                      <div>{selectedOrder.client_phone}</div>
                    </div>
                  )}
                  {selectedOrder.scheduled_date && (
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-gray-400" />
                      <div>
                        {selectedOrder.scheduled_date}
                        {selectedOrder.scheduled_time && ` в ${selectedOrder.scheduled_time}`}
                      </div>
                    </div>
                  )}
                  {selectedOrder.installers && selectedOrder.installers.length > 0 ? (
                    <div className="flex items-start gap-3">
                      <Wrench className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div className="space-y-1">
                        {selectedOrder.installers.map((inst) => (
                          <div key={inst.id} className="text-sm">
                            {inst.installer_name}
                            {inst.installer_specialization && (
                              <span className="text-gray-500 ml-1">({inst.installer_specialization})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : selectedOrder.installer_name ? (
                    <div className="flex items-center gap-3">
                      <Wrench className="h-5 w-5 text-gray-400" />
                      <div>{selectedOrder.installer_name}</div>
                    </div>
                  ) : null}
                  {selectedOrder.deadline && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-gray-400" />
                      <div>Срок: {selectedOrder.deadline}</div>
                    </div>
                  )}
                </div>

                {/* Project Info */}
                {selectedOrder.project_name && (
                  <div className="border-t pt-4">
                    <div className="text-sm font-medium text-gray-500 mb-2">Проект</div>
                    <div className="font-medium">{selectedOrder.project_name}</div>
                  </div>
                )}

                {/* Items */}
                <div className="border-t pt-4">
                  <div className="text-sm font-medium text-gray-500 mb-3">
                    Позиции ({selectedOrder.items?.length || 0})
                  </div>
                  {selectedOrder.items && selectedOrder.items.length > 0 ? (
                    <div className="space-y-2">
                      {selectedOrder.items.map((item) => (
                        <div
                          key={item.id}
                          className="p-3 bg-muted/30 rounded space-y-2"
                        >
                          {/* Верхняя строка: изображение + инфо + статус */}
                          <div className="flex items-center gap-3">
                            {/* Изображение позиции */}
                            {item.item_image_url ? (
                              <img
                                src={item.item_image_url}
                                alt={item.item_name || "Позиция"}
                                className="w-12 h-12 object-cover rounded flex-shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded flex items-center justify-center flex-shrink-0">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">{item.item_name || "Без названия"}</div>
                              {item.item_article && (
                                <div className="text-xs text-gray-400">Арт: {item.item_article}</div>
                              )}
                              <div className="text-xs text-gray-500">
                                {item.quantity} шт.
                                {item.cost && ` • ${item.cost.toLocaleString()} ₽`}
                              </div>
                            </div>
                            <Select
                              value={item.status}
                              onValueChange={(newStatus) => {
                                updateMontageItemMutation.mutate({ itemId: item.id, status: newStatus });
                                // Update local state for immediate feedback
                                if (selectedOrder) {
                                  const updatedItems = selectedOrder.items.map((i) =>
                                    i.id === item.id ? { ...i, status: newStatus } : i
                                  );
                                  setSelectedOrder({ ...selectedOrder, items: updatedItems });
                                }
                              }}
                            >
                              <SelectTrigger className={`w-[140px] h-8 text-xs ${itemStatusConfig[item.status]?.color}`}>
                                <SelectValue>{itemStatusConfig[item.status]?.label || item.status}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {montageItemStatuses.map((status) => (
                                  <SelectItem key={status.id} value={status.code}>
                                    <span className={`${status.bg_color || 'bg-gray-100'} ${status.text_color || 'text-gray-900'} px-2 py-0.5 rounded text-xs font-medium`}>
                                      {status.name}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {/* Описание позиции */}
                          <Input
                            defaultValue={item.notes || ""}
                            placeholder="Описание / заметки..."
                            className="h-7 text-xs"
                            onBlur={(e) => {
                              const newNotes = e.target.value;
                              if (newNotes !== (item.notes || "")) {
                                updateMontageItemMutation.mutate({ itemId: item.id, notes: newNotes });
                                // Update local state
                                if (selectedOrder) {
                                  const updatedItems = selectedOrder.items.map((i) =>
                                    i.id === item.id ? { ...i, notes: newNotes } : i
                                  );
                                  setSelectedOrder({ ...selectedOrder, items: updatedItems });
                                }
                              }
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400">
                      <Package className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">Нет позиций</p>
                    </div>
                  )}
                </div>

                {/* Total */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Итого:</span>
                    <span className="text-xl font-bold">
                      {selectedOrder.total_cost?.toLocaleString() || 0} ₽
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="border-t pt-4">
                    <div className="text-sm font-medium text-gray-500 mb-2">Заметки</div>
                    <div className="text-sm bg-gray-50 p-3 rounded">{selectedOrder.notes}</div>
                  </div>
                )}

                {/* Status Change */}
                <div className="border-t pt-4">
                  <div className="text-sm font-medium text-gray-500 mb-2">Изменить статус</div>
                  <Select
                    value={selectedOrder.status}
                    onValueChange={(value) => {
                      updateMutation.mutate({ id: selectedOrder.id, data: { status: value } });
                      setSelectedOrder({ ...selectedOrder, status: value });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Запланирован</SelectItem>
                      <SelectItem value="in_progress">В работе</SelectItem>
                      <SelectItem value="completed">Завершён</SelectItem>
                      <SelectItem value="cancelled">Отменён</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Actions */}
                <div className="border-t pt-4 flex gap-2">
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      if (confirm("Удалить заказ?")) {
                        deleteMutation.mutate(selectedOrder.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Удалить
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Installers & Item Statuses Management Sheet */}
      <Sheet open={isInstallersOpen} onOpenChange={setIsInstallersOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Настройки
            </SheetTitle>
          </SheetHeader>

          <Tabs defaultValue="installers" className="mt-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="installers">Монтажники</TabsTrigger>
              <TabsTrigger value="item-statuses">Статусы изделий</TabsTrigger>
            </TabsList>

            {/* Installers Tab */}
            <TabsContent value="installers" className="mt-4 space-y-4">
              {/* Add new installer button */}
              <Button
                className="w-full"
                onClick={() => {
                  resetInstallerForm();
                  setEditingInstaller(null);
                  setIsInstallerFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить монтажника
              </Button>

              {/* Installers list */}
              <div className="space-y-3">
                {installers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Монтажники не добавлены</p>
                  </div>
                ) : (
                  installers.map((installer) => (
                  <Card key={installer.id} className="bg-zinc-900/95 border-zinc-700">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                            <User className="h-5 w-5 text-zinc-400" />
                          </div>
                          <div>
                            <h4 className="font-medium text-white">{installer.name}</h4>
                            {installer.specialization && (
                              <p className="text-xs text-zinc-400">{installer.specialization}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditInstaller(installer)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => {
                              if (confirm(`Удалить монтажника "${installer.name}"?`)) {
                                deleteInstallerMutation.mutate(installer.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Contact info */}
                      <div className="space-y-1 text-sm text-zinc-400">
                        {installer.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <span>{installer.phone}</span>
                          </div>
                        )}
                        {installer.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <span>{installer.email}</span>
                          </div>
                        )}
                      </div>

                      {/* Qualification and description */}
                      <div className="mt-3 flex items-center gap-2">
                        {installer.qualification_level && (
                          <Badge className={qualificationConfig[installer.qualification_level]?.color || "bg-gray-200 text-gray-700"}>
                            <Star className="h-3 w-3 mr-1" />
                            {qualificationConfig[installer.qualification_level]?.label || installer.qualification_level}
                          </Badge>
                        )}
                        {installer.hourly_rate && (
                          <Badge variant="secondary" className="bg-zinc-700 text-zinc-300">
                            {installer.hourly_rate.toLocaleString()} ₽/день
                          </Badge>
                        )}
                      </div>

                      {installer.description && (
                        <p className="mt-2 text-sm text-zinc-400">{installer.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
              </div>
            </TabsContent>

            {/* Item Statuses Tab */}
            <TabsContent value="item-statuses" className="mt-4 space-y-4">
              {/* Add new item status button */}
              <Button
                className="w-full"
                onClick={() => {
                  setItemStatusFormData({ code: "", name: "", color: "blue" });
                  setEditingItemStatus(null);
                  setIsItemStatusFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Добавить статус изделия
              </Button>

              {/* Item statuses list */}
              <div className="space-y-3">
                {montageItemStatuses.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Статусы изделий не добавлены</p>
                  </div>
                ) : (
                  montageItemStatuses.map((status) => (
                    <Card key={status.id} className="bg-zinc-900/95 border-zinc-700">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-4 h-4 rounded-full bg-${status.color}-500`}
                              style={{ backgroundColor: `var(--${status.color}-500, ${status.color === 'blue' ? '#3b82f6' : status.color === 'yellow' ? '#eab308' : status.color === 'green' ? '#22c55e' : status.color === 'red' ? '#ef4444' : status.color === 'gray' ? '#6b7280' : '#8b5cf6'})` }}
                            />
                            <div>
                              <h4 className="font-medium text-white">{status.name}</h4>
                              <p className="text-xs text-zinc-400">Код: {status.code}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {status.is_system && (
                              <Badge variant="outline" className="text-xs text-zinc-400 border-zinc-600">
                                Системный
                              </Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingItemStatus(status);
                                setItemStatusFormData({
                                  code: status.code,
                                  name: status.name,
                                  color: status.color,
                                });
                                setIsItemStatusFormOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {!status.is_system && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300"
                                onClick={() => {
                                  if (confirm(`Удалить статус "${status.name}"?`)) {
                                    deleteItemStatusMutation.mutate(status.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Item Status Form Dialog */}
      <Dialog open={isItemStatusFormOpen} onOpenChange={(open) => {
        setIsItemStatusFormOpen(open);
        if (!open) {
          resetItemStatusForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingItemStatus ? "Редактировать статус изделия" : "Новый статус изделия"}
            </DialogTitle>
            <DialogDescription>
              {editingItemStatus ? "Измените данные статуса" : "Заполните данные нового статуса"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Код *</Label>
              <Input
                value={itemStatusFormData.code}
                onChange={(e) => setItemStatusFormData({ ...itemStatusFormData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="on_delivery"
                disabled={!!editingItemStatus}
              />
              <p className="text-xs text-gray-500 mt-1">Латинские буквы и подчёркивания</p>
            </div>
            <div>
              <Label>Название *</Label>
              <Input
                value={itemStatusFormData.name}
                onChange={(e) => setItemStatusFormData({ ...itemStatusFormData, name: e.target.value })}
                placeholder="На доставке"
              />
            </div>
            <div>
              <Label>Цвет</Label>
              <Select
                value={itemStatusFormData.color}
                onValueChange={(v) => setItemStatusFormData({ ...itemStatusFormData, color: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">🔵 Синий</SelectItem>
                  <SelectItem value="yellow">🟡 Жёлтый</SelectItem>
                  <SelectItem value="green">🟢 Зелёный</SelectItem>
                  <SelectItem value="red">🔴 Красный</SelectItem>
                  <SelectItem value="gray">⚪ Серый</SelectItem>
                  <SelectItem value="purple">🟣 Фиолетовый</SelectItem>
                  <SelectItem value="orange">🟠 Оранжевый</SelectItem>
                  <SelectItem value="cyan">🔵 Голубой</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsItemStatusFormOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleItemStatusSubmit}
              disabled={!itemStatusFormData.code || !itemStatusFormData.name || createItemStatusMutation.isPending || updateItemStatusMutation.isPending}
            >
              {createItemStatusMutation.isPending || updateItemStatusMutation.isPending
                ? "Сохранение..."
                : editingItemStatus ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Installer Form Dialog */}
      <Dialog open={isInstallerFormOpen} onOpenChange={(open) => {
        setIsInstallerFormOpen(open);
        if (!open) {
          setEditingInstaller(null);
          resetInstallerForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingInstaller ? "Редактировать монтажника" : "Новый монтажник"}
            </DialogTitle>
            <DialogDescription>
              {editingInstaller ? "Измените данные монтажника" : "Заполните данные нового монтажника"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Имя *</Label>
                <Input
                  value={installerFormData.name}
                  onChange={(e) => setInstallerFormData({ ...installerFormData, name: e.target.value })}
                  placeholder="ФИО монтажника"
                />
              </div>
              <div>
                <Label>Телефон</Label>
                <Input
                  value={installerFormData.phone || '+7 '}
                  onChange={(e) => setInstallerFormData({ ...installerFormData, phone: formatPhoneNumber(e.target.value) })}
                  placeholder="+7 999 444-55-66"
                />
              </div>
              <div>
                <Label className="text-zinc-400">Email <span className="text-zinc-500 text-xs">(необязательно)</span></Label>
                <Input
                  value={installerFormData.email}
                  onChange={(e) => setInstallerFormData({ ...installerFormData, email: e.target.value })}
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <Label>Специализация</Label>
                <Input
                  value={installerFormData.specialization}
                  onChange={(e) => setInstallerFormData({ ...installerFormData, specialization: e.target.value })}
                  placeholder="Мебель, кухни..."
                />
              </div>
              <div>
                <Label>Ставка в день (₽)</Label>
                <Input
                  type="number"
                  value={installerFormData.hourly_rate}
                  onChange={(e) => setInstallerFormData({ ...installerFormData, hourly_rate: e.target.value })}
                  placeholder="1000"
                />
              </div>
              <div className="col-span-2">
                <Label>Уровень квалификации</Label>
                <Select
                  value={installerFormData.qualification_level}
                  onValueChange={(value) => setInstallerFormData({ ...installerFormData, qualification_level: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Низкий</SelectItem>
                    <SelectItem value="medium">Средний</SelectItem>
                    <SelectItem value="high">Высокий</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Номер машины</Label>
                <Input
                  value={installerFormData.vehicle_number}
                  onChange={(e) => setInstallerFormData({ ...installerFormData, vehicle_number: e.target.value })}
                  placeholder="А123БВ777"
                />
              </div>
              <div className="col-span-2">
                <Label>Описание</Label>
                <Textarea
                  value={installerFormData.description}
                  onChange={(e) => setInstallerFormData({ ...installerFormData, description: e.target.value })}
                  placeholder="Дополнительная информация о монтажнике..."
                  rows={3}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsInstallerFormOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleInstallerFormSubmit}
              disabled={createInstallerMutation.isPending || updateInstallerMutation.isPending}
            >
              {createInstallerMutation.isPending || updateInstallerMutation.isPending
                ? "Сохранение..."
                : editingInstaller
                  ? "Сохранить"
                  : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Form Dialog */}
      <Dialog open={isStatusFormOpen} onOpenChange={setIsStatusFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStatus ? "Редактировать статус" : "Новый статус"}</DialogTitle>
            <DialogDescription>
              {editingStatus ? "Измените параметры статуса" : "Добавьте новую колонку на Kanban доску"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Код (латиница, snake_case)</Label>
              <Input
                value={statusFormData.code}
                onChange={(e) => setStatusFormData({ ...statusFormData, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                placeholder="on_hold"
                disabled={editingStatus?.is_system}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Уникальный код статуса, используется в системе
              </p>
            </div>
            <div>
              <Label>Название</Label>
              <Input
                value={statusFormData.name}
                onChange={(e) => setStatusFormData({ ...statusFormData, name: e.target.value })}
                placeholder="На удержании"
              />
            </div>
            <div>
              <Label>Цвет</Label>
              <Select
                value={statusFormData.color}
                onValueChange={(value) => setStatusFormData({ ...statusFormData, color: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yellow">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-yellow-500" />
                      Жёлтый
                    </div>
                  </SelectItem>
                  <SelectItem value="blue">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-blue-500" />
                      Синий
                    </div>
                  </SelectItem>
                  <SelectItem value="green">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-green-500" />
                      Зелёный
                    </div>
                  </SelectItem>
                  <SelectItem value="gray">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-gray-500" />
                      Серый
                    </div>
                  </SelectItem>
                  <SelectItem value="red">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-red-500" />
                      Красный
                    </div>
                  </SelectItem>
                  <SelectItem value="purple">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-purple-500" />
                      Фиолетовый
                    </div>
                  </SelectItem>
                  <SelectItem value="orange">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-orange-500" />
                      Оранжевый
                    </div>
                  </SelectItem>
                  <SelectItem value="cyan">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-cyan-500" />
                      Голубой
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editingStatus?.is_system && (
              <div className="flex items-center gap-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-yellow-700 dark:text-yellow-400">Это системный статус. Код нельзя изменить.</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusFormOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleStatusFormSubmit}
              disabled={createStatusMutation.isPending || updateStatusMutation.isPending}
            >
              {createStatusMutation.isPending || updateStatusMutation.isPending
                ? "Сохранение..."
                : editingStatus
                  ? "Сохранить"
                  : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
