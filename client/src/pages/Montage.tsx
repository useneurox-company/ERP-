import { useState } from "react";
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

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  planned: { label: "Запланирован", color: "text-yellow-600", bgColor: "bg-yellow-100" },
  in_progress: { label: "В работе", color: "text-blue-600", bgColor: "bg-blue-100" },
  completed: { label: "Завершён", color: "text-green-600", bgColor: "bg-green-100" },
  cancelled: { label: "Отменён", color: "text-gray-600", bgColor: "bg-gray-100" },
};

const itemStatusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Ожидает", color: "bg-gray-200 text-gray-700" },
  installed: { label: "Установлено", color: "bg-green-200 text-green-700" },
  issue: { label: "Проблема", color: "bg-red-200 text-red-700" },
};

// Sortable Card Component
function SortableCard({ order, onClick }: { order: MontageOrder; onClick: () => void }) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-3 cursor-grab active:cursor-grabbing"
    >
      <Card
        className="hover:shadow-md transition-shadow select-none"
        onClick={handleClick}
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-gray-400" />
              <span className="font-medium text-sm">{order.order_number}</span>
            </div>
            <Badge className={`${statusConfig[order.status]?.bgColor} ${statusConfig[order.status]?.color} text-xs`}>
              {statusConfig[order.status]?.label}
            </Badge>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-1 text-gray-600">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{order.address}</span>
            </div>
            {order.scheduled_date && (
              <div className="flex items-center gap-1 text-gray-600">
                <Calendar className="h-3 w-3" />
                <span>{order.scheduled_date}</span>
                {order.scheduled_time && <span>в {order.scheduled_time}</span>}
              </div>
            )}
            {order.installer_name && (
              <div className="flex items-center gap-1 text-gray-600">
                <Wrench className="h-3 w-3" />
                <span>{order.installer_name}</span>
              </div>
            )}
            {order.project_name && (
              <div className="flex items-center gap-1 text-gray-500">
                <Package className="h-3 w-3" />
                <span className="truncate">{order.project_name}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-2 pt-2 border-t">
            <span className="text-xs text-gray-500">{order.items_count} позиций</span>
            {order.total_cost && (
              <span className="font-medium text-sm">{order.total_cost.toLocaleString()} ₽</span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Status column colors - matching Sales/CRM Kanban style
const columnColors: Record<string, string> = {
  planned: "border-l-amber-500",
  in_progress: "border-l-blue-500",
  completed: "border-l-emerald-500",
  cancelled: "border-l-gray-500",
};

// Kanban Column Component with Droppable
function KanbanColumn({
  title,
  status,
  orders,
  count,
  onCardClick,
}: {
  title: string;
  status: string;
  orders: MontageOrder[];
  count: number;
  onCardClick: (order: MontageOrder) => void;
}) {
  const borderColor = columnColors[status];
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div className="flex-shrink-0 w-72 md:w-80">
      <Card className={`border-l-[3px] ${borderColor} bg-zinc-900/95`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-white">{title}</CardTitle>
            <Badge variant="secondary" className="bg-zinc-700 text-zinc-300">{count}</Badge>
          </div>
        </CardHeader>
        <CardContent
          ref={setNodeRef}
          className={`space-y-3 min-h-[300px] transition-colors ${
            isOver ? "bg-zinc-800/50" : ""
          }`}
        >
          <SortableContext items={orders.map((o) => o.id)} strategy={verticalListSortingStrategy}>
            {orders.map((order) => (
              <SortableCard key={order.id} order={order} onClick={() => onCardClick(order)} />
            ))}
          </SortableContext>
          {orders.length === 0 && (
            <div className={`text-center py-8 ${isOver ? "text-zinc-300" : "text-zinc-500"}`}>
              <Package className={`h-8 w-8 mx-auto mb-2 ${isOver ? "opacity-100" : "opacity-50"}`} />
              <p className="text-sm">{isOver ? "Отпустите здесь" : "Нет заказов"}</p>
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

  // Fetch orders
  const { data: orders = [], isLoading } = useQuery<MontageOrder[]>({
    queryKey: ["/api/montage"],
    queryFn: async () => {
      const res = await fetch("/api/montage");
      if (!res.ok) throw new Error("Failed to fetch orders");
      return res.json();
    },
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
    const statuses = ["planned", "in_progress", "completed", "cancelled"];

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
      description: "",
    });
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

  // Group orders by status for Kanban
  const ordersByStatus = {
    planned: filteredOrders.filter((o) => o.status === "planned"),
    in_progress: filteredOrders.filter((o) => o.status === "in_progress"),
    completed: filteredOrders.filter((o) => o.status === "completed"),
    cancelled: filteredOrders.filter((o) => o.status === "cancelled"),
  };

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
      <div className="flex items-center justify-between">
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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-gray-500">Всего</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{stats.planned}</div>
              <div className="text-sm text-gray-500">Запланировано</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
              <div className="text-sm text-gray-500">В работе</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
              <div className="text-sm text-gray-500">Завершено</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total_cost?.toLocaleString() || 0} ₽</div>
              <div className="text-sm text-gray-500">Общая сумма</div>
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
              <div className="flex gap-4 overflow-x-auto pb-4">
                <KanbanColumn
                  title="Запланировано"
                  status="planned"
                  orders={ordersByStatus.planned}
                  count={ordersByStatus.planned.length}
                  onCardClick={handleOpenDetail}
                />
                <KanbanColumn
                  title="В работе"
                  status="in_progress"
                  orders={ordersByStatus.in_progress}
                  count={ordersByStatus.in_progress.length}
                  onCardClick={handleOpenDetail}
                />
                <KanbanColumn
                  title="Завершено"
                  status="completed"
                  orders={ordersByStatus.completed}
                  count={ordersByStatus.completed.length}
                  onCardClick={handleOpenDetail}
                />
                <KanbanColumn
                  title="Отменено"
                  status="cancelled"
                  orders={ordersByStatus.cancelled}
                  count={ordersByStatus.cancelled.length}
                  onCardClick={handleOpenDetail}
                />
              </div>
              <DragOverlay>
                {draggedOrder && (
                  <Card className="shadow-lg">
                    <CardContent className="p-3">
                      <div className="font-medium">{draggedOrder.order_number}</div>
                      <div className="text-sm text-gray-500">{draggedOrder.address}</div>
                    </CardContent>
                  </Card>
                )}
              </DragOverlay>
            </DndContext>
          )}

          {/* List View */}
          {activeTab === "list" && (
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
                filteredOrders.map((order) => (
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
                ))
              )}
            </div>
          )}

          {/* Calendar View */}
          {activeTab === "calendar" && (
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
                    {projectItems.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-zinc-800/50 ${
                          selectedItemIds.includes(item.id) ? "bg-zinc-700/50" : ""
                        }`}
                        onClick={() => {
                          if (selectedItemIds.includes(item.id)) {
                            setSelectedItemIds(prev => prev.filter(id => id !== item.id));
                          } else {
                            setSelectedItemIds(prev => [...prev, item.id]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={selectedItemIds.includes(item.id)}
                          onCheckedChange={(checked) => {
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
                        {item.ready_for_montage ? (
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
                    ))}
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
        <SheetContent className="w-[450px] sm:max-w-[450px]">
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
                          className="flex items-center gap-3 p-2 bg-muted/30 rounded"
                        >
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
                          <Badge className={itemStatusConfig[item.status]?.color}>
                            {itemStatusConfig[item.status]?.label}
                          </Badge>
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

      {/* Installers Management Sheet */}
      <Sheet open={isInstallersOpen} onOpenChange={setIsInstallersOpen}>
        <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Монтажники
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
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
          </div>
        </SheetContent>
      </Sheet>

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
    </div>
  );
}
