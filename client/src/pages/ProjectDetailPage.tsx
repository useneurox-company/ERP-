import { useState, useEffect, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowLeft, Plus, Edit, Trash2, Calendar, FileText, Layers,
  AlertCircle, GripVertical, MessageSquare, Play, ImageIcon, File, User as UserIcon, Package, Paperclip, Clock, Hammer, Check, Users
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ProjectItemDialog } from "@/components/ProjectItemDialog";
import { StageDialog } from "@/components/StageDialog";
import { StageFlowEditor } from "@/components/StageFlowEditor";
import { StageDetailView } from "@/components/StageDetailView";
import { StatusBadge } from "@/components/StatusBadge";
import { GanttChart } from "@/components/GanttChart";
import { ProjectTimeline } from "@/components/ProjectTimeline";
import { ProjectBusinessProcesses } from "@/components/ProjectBusinessProcesses";
import { ProjectChat } from "@/components/ProjectChat";
import { ProjectActivityLog } from "@/components/ProjectActivityLog";
import { ProjectDocumentsRepository } from "@/components/ProjectDocumentsRepository";
import { InlineEditField } from "@/components/InlineEditField";
import { TaskList } from "@/components/TaskList";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Project, ProjectItem, ProjectStage, User } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format } from "date-fns";

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

// StageCard component with drag&drop functionality
interface StageCardProps {
  stage: ProjectStage;
  users: User[];
  onEdit: (stage: ProjectStage) => void;
  onDelete: (stageId: string) => void;
  onViewDetails: (stage: ProjectStage) => void;
  formatDate: (date: Date | null) => string;
  formatCurrency: (amount: string | null) => string;
}

function StageCard({ stage, users, onEdit, onDelete, onViewDetails, formatDate, formatCurrency }: StageCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const assignee = users.find((u) => u.id === stage.assignee_id);
  const progressValue = stage.status === "completed" ? 100 : stage.status === "in_progress" ? 50 : 0;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className="p-4 space-y-3"
      data-testid={`card-stage-${stage.id}`}
    >
      <div className="flex items-start gap-3">
        <button
          className="cursor-grab active:cursor-grabbing mt-1"
          {...attributes}
          {...listeners}
          data-testid={`handle-stage-${stage.id}`}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1 flex-1">
              <h4 className="font-medium" data-testid={`text-stage-name-${stage.id}`}>
                {stage.name}
              </h4>
              {stage.description && (
                <p className="text-sm text-muted-foreground" data-testid={`text-stage-description-${stage.id}`}>
                  {stage.description}
                </p>
              )}
            </div>
            <StatusBadge status={stage.status} data-testid={`badge-stage-status-${stage.id}`} />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Даты</p>
              <p data-testid={`text-stage-dates-${stage.id}`}>
                {formatDate(stage.planned_start_date)} - {formatDate(stage.planned_end_date)}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Исполнитель</p>
              <p data-testid={`text-stage-assignee-${stage.id}`}>
                {assignee ? (assignee.full_name || assignee.username) : "Не назначен"}
              </p>
            </div>

            {stage.cost && (
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs">Стоимость</p>
                <p className="font-semibold" data-testid={`text-stage-cost-${stage.id}`}>
                  {formatCurrency(stage.cost)}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Прогресс</p>
              <div className="space-y-1">
                <Progress value={progressValue} data-testid={`progress-stage-${stage.id}`} />
                <p className="text-xs" data-testid={`text-stage-progress-${stage.id}`}>
                  {progressValue}%
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onEdit(stage)}
              data-testid={`button-edit-stage-${stage.id}`}
            >
              <Edit className="w-3 h-3 mr-1" />
              Изменить
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onDelete(stage.id)}
              data-testid={`button-delete-stage-${stage.id}`}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Удалить
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewDetails(stage)}
              data-testid={`button-view-details-${stage.id}`}
            >
              <MessageSquare className="w-3 h-3 mr-1" />
              Детали
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Component to display tasks for a specific project item
function ProjectItemTasksSection({ projectId, itemId, onTaskClick }: { projectId: string; itemId: string; onTaskClick?: (taskId: string) => void }) {
  const { data: tasks = [], isLoading } = useQuery<any[]>({
    queryKey: [`/api/projects/${projectId}/items/${itemId}/tasks`],
  });

  // Calculate days until deadline
  const getDaysUntilDeadline = (deadline: string | null): number | null => {
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlineDate = new Date(deadline);
    deadlineDate.setHours(0, 0, 0, 0);
    const diffTime = deadlineDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Get deadline color based on days remaining
  const getDeadlineColor = (deadline: string | null): string => {
    const daysRemaining = getDaysUntilDeadline(deadline);
    if (daysRemaining === null) return 'text-muted-foreground';
    if (daysRemaining < 0) return 'text-red-600'; // Overdue
    if (daysRemaining <= 1) return 'text-red-600'; // Due today or tomorrow
    if (daysRemaining <= 3) return 'text-yellow-600'; // Due within 3 days
    return 'text-green-600'; // More than 3 days
  };

  // Format deadline text
  const formatDeadline = (deadline: string | null): string => {
    if (!deadline) return '';
    const daysRemaining = getDaysUntilDeadline(deadline);
    if (daysRemaining === null) return '';

    const deadlineDate = new Date(deadline);
    const formattedDate = deadlineDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });

    if (daysRemaining < 0) return `Просрочено ${Math.abs(daysRemaining)} д.`;
    if (daysRemaining === 0) return `Сегодня (${formattedDate})`;
    if (daysRemaining === 1) return `Завтра (${formattedDate})`;
    if (daysRemaining <= 7) return `Через ${daysRemaining} д. (${formattedDate})`;
    return formattedDate;
  };

  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t">
        <p className="text-xs text-muted-foreground">Загрузка задач...</p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return null; // Don't show anything if no tasks
  }

  return (
    <div className="mt-2 pt-2 border-t border-dashed" onClick={(e) => e.stopPropagation()}>
      <div className="space-y-1">
        {tasks.map((task: any) => (
          <div
            key={task.id}
            className="flex items-center gap-2 px-1.5 py-1 bg-muted/30 rounded text-[11px] hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onTaskClick?.(task.id);
            }}
          >
            {/* Статус - точка */}
            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              task.status === 'completed' ? 'bg-green-500' :
              task.status === 'in_progress' ? 'bg-blue-500' : 'bg-gray-400'
            }`} />

            {/* Название */}
            <span className="font-medium truncate flex-1">{task.title}</span>

            {/* Исполнитель */}
            {task.assignee && (
              <span className="text-muted-foreground truncate max-w-[80px]">
                {task.assignee.full_name || task.assignee.username}
              </span>
            )}

            {/* Дедлайн */}
            {task.deadline && (
              <span className={`shrink-0 ${getDeadlineColor(task.deadline)}`}>
                {formatDeadline(task.deadline)}
              </span>
            )}

            {/* Вложения */}
            {task.attachments_count > 0 && (
              <span className="flex items-center gap-0.5 text-muted-foreground shrink-0">
                <Paperclip className="w-2.5 h-2.5" />
                {task.attachments_count}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProjectItem | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  // Stage dialog state
  const [stageDialogOpen, setStageDialogOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<ProjectStage | undefined>();
  const [deleteStageDialogOpen, setDeleteStageDialogOpen] = useState(false);
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);

  // Stage details sheet state
  const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
  const [selectedStageForDetails, setSelectedStageForDetails] = useState<ProjectStage | undefined>();

  // Project delete dialog state
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);

  // Create task dialog state
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);

  // Task detail dialog state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedItemForTask, setSelectedItemForTask] = useState<ProjectItem | null>(null);

  // Send to Montage dialog state
  const [sendToMontageOpen, setSendToMontageOpen] = useState(false);
  const [itemForMontage, setItemForMontage] = useState<ProjectItem | null>(null);
  const [montageFormData, setMontageFormData] = useState({
    address: "",
    client_name: "",
    client_phone: "",
    scheduled_date: "",
    scheduled_time: "",
    deadline: "",
    installer_id: "",
    cost: "",
    notes: "",
  });

  // Create Montage from project dialog state
  const [createMontageDialogOpen, setCreateMontageDialogOpen] = useState(false);
  const [selectedMontageItemIds, setSelectedMontageItemIds] = useState<string[]>([]);
  const [selectedMontageInstallerIds, setSelectedMontageInstallerIds] = useState<string[]>([]);
  const [createMontageFormData, setCreateMontageFormData] = useState({
    address: "",
    client_name: "",
    client_phone: "",
    scheduled_date: "",
    scheduled_time: "",
    deadline: "",
    total_cost: "",
    notes: "",
  });

  // Task filters state
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('all');
  const [taskDeadlineFilter, setTaskDeadlineFilter] = useState<'all' | 'overdue' | 'today' | 'week'>('all');

  // Блокировка доступа для замерщиков
  useEffect(() => {
    const userRoleStr = localStorage.getItem("userRole");
    if (userRoleStr) {
      const userRole = JSON.parse(userRoleStr);
      if (userRole?.name === 'Замерщик') {
        toast({
          description: "У вас нет доступа к этой странице",
          variant: "destructive",
        });
        setLocation("/projects");
      }
    }
  }, [toast, setLocation]);

  const { data: project, isLoading: projectLoading} = useQuery<Project & { stages: ProjectStage[] }>({
    queryKey: ['/api/projects', id],
    enabled: !!id,
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery<ProjectItem[]>({
    queryKey: ['/api/projects', id, 'items'],
    enabled: !!id,
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  // Query stages for selected item
  const { data: stages = [], isLoading: stagesLoading } = useQuery<ProjectStage[]>({
    queryKey: ['/api/projects', id, 'items', selectedItemId, 'stages'],
    enabled: !!id && !!selectedItemId,
  });

  // Query users for assignee select
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Query tasks for this project
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<any[]>({
    queryKey: ['/api/projects', id, 'tasks'],
    enabled: !!id,
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  // Query installers for montage
  const { data: installers = [] } = useQuery<any[]>({
    queryKey: ['/api/installers'],
  });

  // Create Montage Order from project mutation
  const createMontageOrderMutation = useMutation({
    mutationFn: async (data: {
      project_id: string;
      address: string;
      client_name?: string;
      client_phone?: string;
      scheduled_date?: string;
      scheduled_time?: string;
      deadline?: string;
      total_cost?: number;
      notes?: string;
      installer_ids: string[];
      item_ids: string[];
    }) => {
      // Create order
      const res = await fetch('/api/montage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: data.project_id,
          address: data.address,
          client_name: data.client_name || null,
          client_phone: data.client_phone || null,
          scheduled_date: data.scheduled_date || null,
          scheduled_time: data.scheduled_time || null,
          deadline: data.deadline || null,
          total_cost: data.total_cost || null,
          notes: data.notes || null,
          installer_ids: data.installer_ids,
        }),
      });
      if (!res.ok) throw new Error('Failed to create montage order');
      const order = await res.json();

      // Add items to order
      for (const itemId of data.item_ids) {
        await fetch(`/api/montage/${order.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_item_id: itemId,
            quantity: 1,
            status: 'pending',
          }),
        });
      }

      return order;
    },
    onSuccess: () => {
      toast({ title: "Заказ на монтаж создан", description: "Заказ успешно создан с выбранными позициями" });
      setCreateMontageDialogOpen(false);
      setSelectedMontageItemIds([]);
      setSelectedMontageInstallerIds([]);
      setCreateMontageFormData({
        address: "",
        client_name: "",
        client_phone: "",
        scheduled_date: "",
        scheduled_time: "",
        deadline: "",
        total_cost: "",
        notes: "",
      });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать заказ на монтаж", variant: "destructive" });
    },
  });

  // Toggle ready for montage mutation
  const toggleReadyForMontageMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const res = await fetch(`/api/project-items/${itemId}/ready-for-montage`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to toggle ready for montage');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'events'] });
      toast({
        title: data.ready_for_montage ? "Готово к монтажу" : "Снято с готовности",
        description: data.ready_for_montage
          ? `Изделие "${data.name}" помечено как готовое к монтажу`
          : `Изделие "${data.name}" снято с готовности к монтажу`,
      });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось изменить статус готовности", variant: "destructive" });
    },
  });

  // Send to Montage mutation
  const sendToMontageMutation = useMutation({
    mutationFn: async (data: {
      project_id: string;
      project_item_id: string;
      address: string;
      client_name?: string;
      client_phone?: string;
      scheduled_date?: string;
      scheduled_time?: string;
      installer_id?: string;
      cost?: number;
      notes?: string;
    }) => {
      // Create new_order object for the API
      const payload = {
        project_item_id: data.project_item_id,
        cost: data.cost || null,
        new_order: {
          project_id: data.project_id,
          address: data.address,
          client_name: data.client_name || null,
          client_phone: data.client_phone || null,
          scheduled_date: data.scheduled_date || null,
          scheduled_time: data.scheduled_time || null,
          installer_id: data.installer_id || null,
          total_cost: data.cost || null,
          notes: data.notes || null,
        },
      };
      const res = await fetch('/api/montage/send-to-montage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to send to montage');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Отправлено на монтаж", description: "Позиция успешно добавлена в заказ на монтаж" });
      setSendToMontageOpen(false);
      setItemForMontage(null);
      setMontageFormData({
        address: "",
        client_name: "",
        client_phone: "",
        scheduled_date: "",
        scheduled_time: "",
        installer_id: "",
        cost: "",
        notes: "",
      });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось отправить на монтаж", variant: "destructive" });
    },
  });

  // Helper function to calculate days until deadline
  const calculateTaskDaysUntilDeadline = (deadline: string | null): number | null => {
    if (!deadline) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endDate = new Date(deadline);
    endDate.setHours(0, 0, 0, 0);
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Helper function for priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'normal': return 'bg-blue-400';
      case 'low': return 'bg-gray-300';
      default: return 'bg-gray-300';
    }
  };

  // Helper function for task deadline color
  const getTaskDeadlineColor = (deadline: string | null): string => {
    const days = calculateTaskDaysUntilDeadline(deadline);
    if (days === null) return 'text-muted-foreground';
    if (days < 0) return 'text-red-600 font-medium';
    if (days === 0) return 'text-red-600 font-medium';
    if (days === 1) return 'text-orange-600';
    if (days <= 3) return 'text-yellow-600';
    return 'text-muted-foreground';
  };

  // Helper function to format task deadline
  const formatTaskDeadline = (deadline: string | null): string => {
    if (!deadline) return '';
    const days = calculateTaskDaysUntilDeadline(deadline);
    const date = new Date(deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    if (days === null) return date;
    if (days < 0) return `Просрочено`;
    if (days === 0) return 'Сегодня';
    if (days === 1) return 'Завтра';
    return date;
  };

  // Helper function for status badge
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed': return { label: 'Готово', color: 'bg-green-500/10 text-green-600 border-green-500/20' };
      case 'in_progress': return { label: 'В работе', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
      case 'pending_review': return { label: 'На проверке', color: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
      case 'pending': return { label: 'Ожидает', color: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20' };
      case 'new': return { label: 'Новая', color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
      case 'on_hold': return { label: 'Пауза', color: 'bg-orange-500/10 text-orange-600 border-orange-500/20' };
      case 'rejected': return { label: 'Отклонена', color: 'bg-red-500/10 text-red-600 border-red-500/20' };
      case 'cancelled': return { label: 'Отменена', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };
      default: return { label: status, color: 'bg-gray-500/10 text-gray-600 border-gray-500/20' };
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];

    // Filter by status
    if (taskStatusFilter !== 'all') {
      filtered = filtered.filter(task => task.status === taskStatusFilter);
    }

    // Filter by assignee
    if (taskAssigneeFilter !== 'all') {
      if (taskAssigneeFilter === 'unassigned') {
        filtered = filtered.filter(task => !task.assignee_id);
      } else {
        filtered = filtered.filter(task => task.assignee_id === taskAssigneeFilter);
      }
    }

    // Filter by deadline
    if (taskDeadlineFilter !== 'all') {
      filtered = filtered.filter(task => {
        const daysUntil = calculateTaskDaysUntilDeadline(task.deadline || task.due_date);
        if (daysUntil === null) return false;

        switch (taskDeadlineFilter) {
          case 'overdue':
            return daysUntil < 0;
          case 'today':
            return daysUntil === 0;
          case 'week':
            return daysUntil > 0 && daysUntil <= 7;
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [tasks, taskStatusFilter, taskAssigneeFilter, taskDeadlineFilter]);

  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await apiRequest('DELETE', `/api/projects/${id}/items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'items'] });
      toast({
        title: "Позиция удалена",
        description: "Позиция мебели успешно удалена",
      });
      if (selectedItemId === itemToDelete) {
        setSelectedItemId(null);
      }
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить позицию",
        variant: "destructive",
      });
    },
  });

  const formatDate = (date: Date | null) => {
    if (!date) return "Не установлен";
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: string | null) => {
    if (!amount) return "0 ₽";
    return `${parseFloat(amount).toLocaleString("ru-RU")} ₽`;
  };

  const handleAddItem = () => {
    setEditingItem(undefined);
    setItemDialogOpen(true);
  };

  const handleEditItem = (item: ProjectItem) => {
    setEditingItem(item);
    setItemDialogOpen(true);
  };

  const handleDeleteItem = (itemId: string) => {
    setItemToDelete(itemId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      deleteMutation.mutate(itemToDelete);
    }
  };

  // Stage handlers
  const handleAddStage = () => {
    setEditingStage(undefined);
    setStageDialogOpen(true);
  };

  const handleEditStage = (stage: ProjectStage) => {
    setEditingStage(stage);
    setStageDialogOpen(true);
  };

  const handleDeleteStage = (stageId: string) => {
    setStageToDelete(stageId);
    setDeleteStageDialogOpen(true);
  };

  const handleViewDetails = (stage: ProjectStage) => {
    setSelectedStageForDetails(stage);
    setDetailsSheetOpen(true);
  };

  const deleteStage = useMutation({
    mutationFn: async (stageId: string) => {
      return await apiRequest('DELETE', `/api/projects/stages/${stageId}`);
    },
    onSuccess: () => {
      if (selectedItemId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'items', selectedItemId, 'stages'] });
      }
      toast({
        title: "Этап удален",
        description: "Этап успешно удален",
      });
      setDeleteStageDialogOpen(false);
      setStageToDelete(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить этап",
        variant: "destructive",
      });
    },
  });

  const confirmDeleteStage = () => {
    if (stageToDelete) {
      deleteStage.mutate(stageToDelete);
    }
  };

  const startProjectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/projects/${id}/start`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "stages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ description: "Проект запущен" });
    },
    onError: (error: Error) => {
      toast({ description: error.message || "Ошибка запуска проекта", variant: "destructive" });
    },
  });

  const reorderStages = useMutation({
    mutationFn: async (stageIds: string[]) => 
      apiRequest('PATCH', `/api/projects/${id}/items/${selectedItemId}/stages/reorder`, {
        stageIds
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/projects', id, 'items', selectedItemId, 'stages'] 
      });
      toast({ 
        title: "Порядок этапов обновлён",
        description: "Порядок этапов успешно изменен",
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['/api/projects', id, 'items', selectedItemId, 'stages'] 
      });
      toast({ 
        title: "Ошибка", 
        description: "Не удалось обновить порядок", 
        variant: "destructive" 
      });
    }
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stages.findIndex(s => s.id === active.id);
    const newIndex = stages.findIndex(s => s.id === over.id);

    // Optimistic update
    const reordered = arrayMove(stages, oldIndex, newIndex);
    queryClient.setQueryData(
      ['/api/projects', id, 'items', selectedItemId, 'stages'],
      reordered
    );

    // Single atomic API call
    reorderStages.mutate(reordered.map(s => s.id));
  };

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      const userStr = localStorage.getItem("user");
      const currentUser = userStr ? JSON.parse(userStr) : null;
      await apiRequest("DELETE", `/api/projects/${id}`, {
        user_id: currentUser?.id,
      });
    },
    onSuccess: () => {
      toast({
        title: "Проект удалён",
        description: "Проект и все связанные данные успешно удалены",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setLocation("/projects");
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить проект",
        variant: "destructive",
      });
    },
  });

  const updateProjectField = useMutation({
    mutationFn: async (data: Partial<Project>) => {
      return await apiRequest("PUT", `/api/projects/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Поле обновлено",
        description: "Информация успешно сохранена",
      });
    },
    onError: (error: any) => {
      let description = error.message || "Не удалось обновить поле проекта";

      // Улучшенная обработка ошибок уникальности
      if (error.message?.includes("unique") || error.message?.includes("UNIQUE")) {
        description = "Этот номер проекта уже используется. Выберите другой номер.";
      } else if (error.message?.includes("project_number")) {
        description = "Ошибка при обновлении номера проекта. Проверьте формат.";
      }

      toast({
        title: "Ошибка",
        description,
        variant: "destructive",
      });
    },
  });

  const selectedItem = items.find(item => item.id === selectedItemId);
  const sortedStages = [...stages].sort((a, b) => a.order - b.order);

  if (projectLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20" data-testid="skeleton-header" />
        <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
          <Skeleton className="h-96" data-testid="skeleton-sidebar" />
          <Skeleton className="h-96" data-testid="skeleton-content" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground" />
        <p className="text-lg text-muted-foreground" data-testid="text-not-found">
          Проект не найден
        </p>
        <Button onClick={() => setLocation("/projects")} data-testid="button-back-to-projects">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Вернуться к проектам
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => setLocation("/projects")}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к проектам
        </Button>

        {/* Compact Two-Line Header - Variant 2 */}
        <Card className={`border-l-4 ${
          project.status === 'completed' ? 'border-green-500' :
          project.status === 'in_progress' ? 'border-blue-500' :
          'border-gray-400'
        }`}>
          {/* Line 1: Project name + number + status | Progress % + Actions */}
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-b">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <h1 className="text-lg font-semibold truncate" data-testid="text-project-name">
                  {project.name}
                </h1>
                <InlineEditField
                  label=""
                  value={project.project_number}
                  type="text"
                  placeholder="№"
                  formatter={(val) => val ? `№${val}` : '№'}
                  displayClassName="text-sm text-muted-foreground"
                  onSave={(value) => updateProjectField.mutate({ project_number: value || null })}
                />
              </div>
              <Badge
                variant="outline"
                className={`shrink-0 ${
                  project.status === 'in_progress'
                    ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                    : project.status === 'completed'
                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                    : 'bg-gray-500/10 text-gray-600 border-gray-500/20'
                }`}
                data-testid="badge-status"
              >
                {project.status === 'in_progress' && 'В работе'}
                {project.status === 'completed' && 'Завершён'}
                {project.status === 'pending' && 'Ожидает'}
              </Badge>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-semibold" data-testid="text-progress">
                {project.progress || 0}%
              </span>
              {!project.started_at && project.status === "pending" && (
                <Button
                  size="sm"
                  onClick={() => startProjectMutation.mutate()}
                  disabled={startProjectMutation.isPending}
                  data-testid="button-start-project"
                >
                  <Play className="w-3 h-3 mr-1" />
                  Запустить
                </Button>
              )}
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDeleteProjectDialogOpen(true)}
                data-testid="button-delete-project"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Line 2: Client + Dates | Progress bar */}
          <div className="flex items-center justify-between gap-4 px-4 py-2">
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span data-testid="text-client-name">
                Клиент: {project.client_name}
              </span>
              {project.started_at && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span data-testid="text-start-date">
                    Старт: {new Date(project.started_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </>
              )}
              {project.started_at && project.duration_days && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span data-testid="text-final-deadline">
                    До: {(() => {
                      const deadline = new Date(project.started_at);
                      deadline.setDate(deadline.getDate() + (project.duration_days || 0));
                      return deadline.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    })()}
                  </span>
                </>
              )}
              {project.started_at && project.duration_days && project.status !== 'completed' && (
                <>
                  {(() => {
                    const startDate = new Date(project.started_at);
                    const today = new Date();
                    const elapsedDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                    const remaining = (project.duration_days || 0) - elapsedDays;
                    const isOverdue = remaining < 0;

                    return (
                      <span className={`font-medium ${
                        isOverdue ? 'text-red-600' : remaining < 3 ? 'text-orange-600' : 'text-green-600'
                      }`} data-testid="text-days-remaining">
                        ({isOverdue ? `просрочен на ${Math.abs(remaining)} дн.` : `${remaining} дн.`})
                      </span>
                    );
                  })()}
                </>
              )}
              {!project.started_at && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <span data-testid="text-duration">
                    Длительность: {project.duration_days || 0} дн.
                  </span>
                </>
              )}
              <span className="text-muted-foreground">•</span>
              <span data-testid="text-items-count">
                Позиций: {items.length}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0 min-w-[120px]">
              <Progress value={project.progress || 0} className="h-2 flex-1" data-testid="progress-bar" />
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-6">
        {/* Left Panel - Items List */}
        <Card className="p-4 h-fit lg:sticky lg:top-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" data-testid="text-items-title">
                Позиции мебели
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Только если форма ещё не заполнена - авто-заполнить из проекта
                    if (!createMontageFormData.address) {
                      setCreateMontageFormData({
                        ...createMontageFormData,
                        address: project?.delivery_address || "",
                        client_name: project?.client_name || "",
                        client_phone: project?.client_phone || "",
                      });
                      // Pre-select items only if no items selected yet
                      const readyItems = items.filter(item => item.ready_for_montage);
                      setSelectedMontageItemIds(readyItems.map(item => item.id));
                    }
                    setCreateMontageDialogOpen(true);
                  }}
                  data-testid="button-create-montage"
                >
                  <Hammer className="w-4 h-4 mr-1" />
                  Монтаж
                </Button>
                <Button
                  size="icon"
                  onClick={handleAddItem}
                  data-testid="button-add-item"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Separator />

            {itemsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-24" data-testid={`skeleton-item-${i}`} />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Layers className="w-12 h-12 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground" data-testid="text-empty-items">
                  Нет позиций мебели
                </p>
                <p className="text-xs text-muted-foreground">
                  Добавьте первую позицию
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {items.map((item) => (
                  <Card
                    key={item.id}
                    className={`p-2 cursor-pointer transition-colors ${
                      selectedItemId === item.id ? "border-primary" : ""
                    }`}
                    onClick={() => setSelectedItemId(item.id)}
                    data-testid={`card-item-${item.id}`}
                  >
                    <div className="flex gap-2">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded flex-shrink-0"
                          data-testid={`image-item-${item.id}`}
                        />
                      ) : (
                        <div className="w-10 h-10 flex items-center justify-center bg-muted rounded flex-shrink-0">
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        {/* Header: название, артикул, количество и кнопки в одной строке */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <p className="font-medium text-sm truncate" data-testid={`text-item-name-${item.id}`}>
                              {item.name}
                            </p>
                            {item.article && (
                              <span className="text-[10px] text-muted-foreground shrink-0" data-testid={`text-item-article-${item.id}`}>
                                #{item.article}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground shrink-0" data-testid={`text-item-quantity-${item.id}`}>
                              {item.quantity} шт
                            </span>
                            {item.price && (
                              <span className="text-xs font-medium shrink-0" data-testid={`text-item-total-${item.id}`}>
                                {formatCurrency((parseFloat(item.price) * item.quantity).toString())}
                              </span>
                            )}
                          </div>
                          {/* Компактные кнопки */}
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditItem(item);
                                  }}
                                  data-testid={`button-edit-item-${item.id}`}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Изменить</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-destructive hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteItem(item.id);
                                  }}
                                  data-testid={`button-delete-item-${item.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Удалить</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="default"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedItemForTask(item);
                                    setCreateTaskDialogOpen(true);
                                  }}
                                  data-testid={`button-create-task-${item.id}`}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Создать задачу</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant={item.ready_for_montage ? "default" : "outline"}
                                  className={`h-6 w-6 ${item.ready_for_montage ? "bg-green-600 hover:bg-green-700" : ""}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleReadyForMontageMutation.mutate(item.id);
                                  }}
                                  disabled={toggleReadyForMontageMutation.isPending}
                                  data-testid={`button-toggle-ready-montage-${item.id}`}
                                >
                                  <Hammer className="w-3 h-3" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{item.ready_for_montage ? "Готово к монтажу (нажмите чтобы снять)" : "Пометить готовым к монтажу"}</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </div>

                        {/* Tasks for this item - компактно */}
                        <ProjectItemTasksSection projectId={id!} itemId={item.id} onTaskClick={setSelectedTaskId} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Right Panel - Tabs */}
        <Card className="p-6">
          <Tabs defaultValue="processes" className="w-full">
            <TabsList className="w-full justify-start" data-testid="tabs-list">
              <TabsTrigger value="processes" data-testid="tab-processes">
                Бизнес-процессы
              </TabsTrigger>
              <TabsTrigger value="gantt" data-testid="tab-gantt">
                Диаграмма Ганта
              </TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents">
                Документы
              </TabsTrigger>
              <TabsTrigger value="chat" data-testid="tab-chat">
                Чат проекта
              </TabsTrigger>
              <TabsTrigger value="events" data-testid="tab-events">
                События
              </TabsTrigger>
              <TabsTrigger value="tasks" data-testid="tab-tasks">
                Задачи
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gantt" className="mt-6 space-y-4" data-testid="content-gantt">
              <ProjectTimeline projectId={id!} />
              <GanttChart stages={project?.stages || []} projectId={id} />
            </TabsContent>

            <TabsContent value="documents" className="mt-6" data-testid="content-documents">
              <ProjectDocumentsRepository projectId={id!} />
            </TabsContent>

            <TabsContent value="processes" className="mt-6" data-testid="content-processes">
              <ProjectBusinessProcesses projectId={id!} selectedItemId={selectedItemId} onAddStage={handleAddStage} />
            </TabsContent>

            <TabsContent value="chat" className="mt-6" data-testid="content-chat">
              <ProjectChat projectId={id!} />
            </TabsContent>

            <TabsContent value="events" className="mt-6" data-testid="content-events">
              <ProjectActivityLog projectId={id!} />
            </TabsContent>

            <TabsContent value="tasks" className="mt-6" data-testid="content-tasks">
              {/* Task Filters */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-3">
                    <Select value={taskStatusFilter} onValueChange={setTaskStatusFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Статус" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все статусы</SelectItem>
                        <SelectItem value="new">Новая</SelectItem>
                        <SelectItem value="pending">Ожидает</SelectItem>
                        <SelectItem value="in_progress">В работе</SelectItem>
                        <SelectItem value="pending_review">На проверке</SelectItem>
                        <SelectItem value="completed">Завершена</SelectItem>
                        <SelectItem value="rejected">Отклонена</SelectItem>
                        <SelectItem value="cancelled">Отменена</SelectItem>
                        <SelectItem value="on_hold">Приостановлена</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={taskAssigneeFilter} onValueChange={setTaskAssigneeFilter}>
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Исполнитель" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все исполнители</SelectItem>
                        <SelectItem value="unassigned">Не назначены</SelectItem>
                        {users.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={taskDeadlineFilter} onValueChange={(v) => setTaskDeadlineFilter(v as any)}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Срок" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Все сроки</SelectItem>
                        <SelectItem value="overdue">Просроченные</SelectItem>
                        <SelectItem value="today">Сегодня</SelectItem>
                        <SelectItem value="week">На неделю</SelectItem>
                      </SelectContent>
                    </Select>

                    {(taskStatusFilter !== 'all' || taskAssigneeFilter !== 'all' || taskDeadlineFilter !== 'all') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTaskStatusFilter('all');
                          setTaskAssigneeFilter('all');
                          setTaskDeadlineFilter('all');
                        }}
                      >
                        Сбросить
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {tasksLoading ? (
                <div className="text-center text-muted-foreground py-8">
                  Загрузка задач...
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  {tasks.length === 0 ? 'Нет задач для этого проекта' : 'Нет задач по выбранным фильтрам'}
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredTasks.map((task: any) => {
                    const statusInfo = getStatusInfo(task.status);
                    const deadline = task.deadline || task.due_date;
                    return (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        {/* Приоритет - цветная полоса */}
                        <div className={`w-1 self-stretch rounded-full shrink-0 ${getPriorityColor(task.priority)}`} />

                        {/* Основной контент */}
                        <div className="flex-1 min-w-0">
                          {/* Первая строка */}
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate flex-1">{task.title}</span>
                            {task.project_item && (
                              <Badge variant="secondary" className="text-[10px] h-5 shrink-0">
                                {task.project_item.name}
                              </Badge>
                            )}
                            <div className="flex items-center gap-2 shrink-0">
                              {task.attachments_count > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <Paperclip className="w-3 h-3" />
                                  {task.attachments_count}
                                </span>
                              )}
                              {task.comments_count > 0 && (
                                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <MessageSquare className="w-3 h-3" />
                                  {task.comments_count}
                                </span>
                              )}
                              <Badge variant="outline" className={`text-[10px] h-5 ${statusInfo.color}`}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                          </div>

                          {/* Вторая строка */}
                          <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-1">
                              <UserIcon className="w-3 h-3" />
                              {task.assignee?.full_name || task.assignee?.username || 'Не назначен'}
                            </span>
                            {deadline && (
                              <span className={`flex items-center gap-1 ${getTaskDeadlineColor(deadline)}`}>
                                <Calendar className="w-3 h-3" />
                                {formatTaskDeadline(deadline)}
                              </span>
                            )}
                            {(task.actual_hours || task.estimated_hours) && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {task.actual_hours || 0}ч/{task.estimated_hours || 0}ч
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </Card>
      </div>

      <ProjectItemDialog
        open={itemDialogOpen}
        onOpenChange={setItemDialogOpen}
        projectId={id!}
        item={editingItem}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-item">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-title">
              Удалить позицию?
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              Это действие нельзя отменить. Позиция мебели будет удалена навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <StageDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        projectId={id!}
        itemId={selectedItemId || undefined}
        stage={editingStage}
      />

      <AlertDialog open={deleteStageDialogOpen} onOpenChange={setDeleteStageDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-stage">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-stage-title">
              Удалить этап?
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-stage-description">
              Это действие нельзя отменить. Этап будет удален навсегда.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-stage">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteStage}
              disabled={deleteStage.isPending}
              data-testid="button-confirm-delete-stage"
            >
              {deleteStage.isPending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stage Details Sheet */}
      <Sheet open={detailsSheetOpen} onOpenChange={setDetailsSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedStageForDetails?.name || "Детали этапа"}</SheetTitle>
          </SheetHeader>
          {selectedStageForDetails && (
            <div className="mt-6">
              <StageDetailView
                stageId={selectedStageForDetails.id}
                stageName={selectedStageForDetails.name}
                stageStatus={selectedStageForDetails.status}
                stageDescription={selectedStageForDetails.description || undefined}
                stageDeadline={selectedStageForDetails.planned_end_date ? new Date(selectedStageForDetails.planned_end_date).toISOString() : undefined}
                stageCost={selectedStageForDetails.cost || undefined}
                projectId={id}
                onStatusChange={() => {
                  if (selectedItemId) {
                    queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'items', selectedItemId, 'stages'] });
                  }
                  queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                }}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Project Dialog */}
      <AlertDialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-project">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-project-title">
              Удалить проект?
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-project-description">
              <div className="space-y-2">
                <p>Это действие нельзя отменить. Будут удалены:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Проект "{project?.name}"</li>
                  <li>Все позиции мебели ({items.length})</li>
                  <li>Все этапы и зависимости</li>
                  <li>Все документы</li>
                  <li>Вся история изменений</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-project">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteProjectMutation.mutate()}
              disabled={deleteProjectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-project"
            >
              {deleteProjectMutation.isPending ? "Удаление..." : "Удалить проект"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createTaskDialogOpen}
        onOpenChange={(open) => {
          setCreateTaskDialogOpen(open);
          if (!open) {
            setSelectedItemForTask(null);
          }
        }}
        projectId={id || undefined}
        projectItemId={selectedItemForTask?.id}
        itemName={selectedItemForTask?.name}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'tasks'] });
          if (selectedItemForTask) {
            queryClient.invalidateQueries({
              queryKey: [`/api/projects/${id}/items/${selectedItemForTask.id}/tasks`]
            });
          }
        }}
      />

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />

      {/* Create Montage from Project Dialog */}
      <Dialog open={createMontageDialogOpen} onOpenChange={setCreateMontageDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создать заказ на монтаж</DialogTitle>
            <DialogDescription>
              Создание заказа на монтаж для проекта "{project?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Items Selection */}
            <div>
              <Label className="mb-2 block">Изделия для монтажа</Label>
              {items.length === 0 ? (
                <div className="text-sm text-gray-500 py-4 text-center border rounded bg-muted/50">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Нет позиций в проекте
                </div>
              ) : (
                <div className="border rounded max-h-48 overflow-y-auto">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center gap-3 p-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                        selectedMontageItemIds.includes(item.id) ? "bg-muted" : ""
                      }`}
                      onClick={() => {
                        if (selectedMontageItemIds.includes(item.id)) {
                          setSelectedMontageItemIds(prev => prev.filter(id => id !== item.id));
                        } else {
                          setSelectedMontageItemIds(prev => [...prev, item.id]);
                        }
                      }}
                    >
                      <Checkbox
                        checked={selectedMontageItemIds.includes(item.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedMontageItemIds(prev => [...prev, item.id]);
                          } else {
                            setSelectedMontageItemIds(prev => prev.filter(id => id !== item.id));
                          }
                        }}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{item.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {item.quantity} шт.
                          {item.article && ` • ${item.article}`}
                        </div>
                      </div>
                      {item.ready_for_montage ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          <Check className="h-3 w-3 mr-1" />
                          Готово
                        </Badge>
                      ) : (
                        <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Не готово
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {selectedMontageItemIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Выбрано: {selectedMontageItemIds.length} из {items.length}
                </p>
              )}
            </div>

            <div>
              <Label>Адрес *</Label>
              <Input
                value={createMontageFormData.address}
                onChange={(e) => setCreateMontageFormData({ ...createMontageFormData, address: e.target.value })}
                placeholder="ул. Ленина, 15"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Имя клиента</Label>
                <Input
                  value={createMontageFormData.client_name}
                  onChange={(e) => setCreateMontageFormData({ ...createMontageFormData, client_name: e.target.value })}
                  placeholder="Иванов Иван"
                />
              </div>
              <div>
                <Label>Телефон клиента</Label>
                <Input
                  value={createMontageFormData.client_phone || '+7 '}
                  onChange={(e) => setCreateMontageFormData({ ...createMontageFormData, client_phone: formatPhoneNumber(e.target.value) })}
                  placeholder="+7 999 123-45-67"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Дата монтажа</Label>
                <Input
                  type="date"
                  value={createMontageFormData.scheduled_date}
                  onChange={(e) => setCreateMontageFormData({ ...createMontageFormData, scheduled_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Время</Label>
                <Input
                  type="time"
                  value={createMontageFormData.scheduled_time}
                  onChange={(e) => setCreateMontageFormData({ ...createMontageFormData, scheduled_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Срок выполнения</Label>
                <Input
                  type="date"
                  value={createMontageFormData.deadline}
                  onChange={(e) => setCreateMontageFormData({ ...createMontageFormData, deadline: e.target.value })}
                />
              </div>
            </div>

            {/* Multiple Installers Selection */}
            <div>
              <Label className="mb-2 block">Монтажники (можно выбрать несколько)</Label>
              <div className="border rounded max-h-40 overflow-y-auto">
                {installers.filter((i: any) => i.is_active).length === 0 ? (
                  <div className="text-sm text-muted-foreground py-4 text-center">
                    <Users className="h-6 w-6 mx-auto mb-1 opacity-50" />
                    Нет активных монтажников
                  </div>
                ) : (
                  installers
                    .filter((i: any) => i.is_active)
                    .map((installer: any) => (
                      <div
                        key={installer.id}
                        className={`flex items-center gap-3 p-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 ${
                          selectedMontageInstallerIds.includes(installer.id) ? "bg-muted" : ""
                        }`}
                        onClick={() => {
                          if (selectedMontageInstallerIds.includes(installer.id)) {
                            setSelectedMontageInstallerIds(prev => prev.filter(id => id !== installer.id));
                          } else {
                            setSelectedMontageInstallerIds(prev => [...prev, installer.id]);
                          }
                        }}
                      >
                        <Checkbox
                          checked={selectedMontageInstallerIds.includes(installer.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedMontageInstallerIds(prev => [...prev, installer.id]);
                            } else {
                              setSelectedMontageInstallerIds(prev => prev.filter(id => id !== installer.id));
                            }
                          }}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{installer.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {installer.specialization || "Монтажник"}
                            {installer.hourly_rate && ` • ${installer.hourly_rate.toLocaleString()} ₽/день`}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
              {selectedMontageInstallerIds.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Выбрано: {selectedMontageInstallerIds.length}
                </p>
              )}
            </div>

            <div>
              <Label>Стоимость монтажа (₽)</Label>
              <Input
                type="number"
                value={createMontageFormData.total_cost}
                onChange={(e) => setCreateMontageFormData({ ...createMontageFormData, total_cost: e.target.value })}
                placeholder="5000"
              />
            </div>

            <div>
              <Label>Заметки</Label>
              <Textarea
                value={createMontageFormData.notes}
                onChange={(e) => setCreateMontageFormData({ ...createMontageFormData, notes: e.target.value })}
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMontageDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (!createMontageFormData.address) {
                  toast({ title: "Ошибка", description: "Укажите адрес", variant: "destructive" });
                  return;
                }
                if (selectedMontageItemIds.length === 0) {
                  toast({ title: "Ошибка", description: "Выберите хотя бы одно изделие", variant: "destructive" });
                  return;
                }

                // Валидация: проверяем что все выбранные позиции готовы к монтажу
                const notReadyItems = items.filter(
                  item => selectedMontageItemIds.includes(item.id) && !item.ready_for_montage
                );

                if (notReadyItems.length > 0) {
                  toast({
                    title: "Ошибка",
                    description: `Позиции не готовы к монтажу: ${notReadyItems.map(i => i.name).join(', ')}`,
                    variant: "destructive"
                  });
                  return;
                }

                if (!id) return;
                createMontageOrderMutation.mutate({
                  project_id: id,
                  address: createMontageFormData.address,
                  client_name: createMontageFormData.client_name || undefined,
                  client_phone: createMontageFormData.client_phone || undefined,
                  scheduled_date: createMontageFormData.scheduled_date || undefined,
                  scheduled_time: createMontageFormData.scheduled_time || undefined,
                  deadline: createMontageFormData.deadline || undefined,
                  total_cost: createMontageFormData.total_cost ? parseFloat(createMontageFormData.total_cost) : undefined,
                  notes: createMontageFormData.notes || undefined,
                  installer_ids: selectedMontageInstallerIds,
                  item_ids: selectedMontageItemIds,
                });
              }}
              disabled={createMontageOrderMutation.isPending}
            >
              {createMontageOrderMutation.isPending ? "Создание..." : "Создать заказ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Montage Dialog */}
      <Dialog open={sendToMontageOpen} onOpenChange={setSendToMontageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Отправить на монтаж</DialogTitle>
            <DialogDescription>
              Создание нового заказа на монтаж для выбранной позиции
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {itemForMontage && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{itemForMontage.name}</p>
                <p className="text-sm text-muted-foreground">
                  {itemForMontage.quantity} шт. • {itemForMontage.article ? `#${itemForMontage.article}` : ''}
                </p>
              </div>
            )}
            <div>
              <Label>Адрес монтажа *</Label>
              <Input
                value={montageFormData.address}
                onChange={(e) => setMontageFormData({ ...montageFormData, address: e.target.value })}
                placeholder="ул. Ленина, 15"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Имя клиента</Label>
                <Input
                  value={montageFormData.client_name}
                  onChange={(e) => setMontageFormData({ ...montageFormData, client_name: e.target.value })}
                  placeholder="Иванов Иван"
                />
              </div>
              <div>
                <Label>Телефон</Label>
                <Input
                  value={montageFormData.client_phone || '+7 '}
                  onChange={(e) => setMontageFormData({ ...montageFormData, client_phone: formatPhoneNumber(e.target.value) })}
                  placeholder="+7 999 123-45-67"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Дата</Label>
                <Input
                  type="date"
                  value={montageFormData.scheduled_date}
                  onChange={(e) => setMontageFormData({ ...montageFormData, scheduled_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Время</Label>
                <Input
                  type="time"
                  value={montageFormData.scheduled_time}
                  onChange={(e) => setMontageFormData({ ...montageFormData, scheduled_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Монтажник</Label>
              <Select
                value={montageFormData.installer_id}
                onValueChange={(value) => setMontageFormData({ ...montageFormData, installer_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите монтажника" />
                </SelectTrigger>
                <SelectContent>
                  {installers
                    .filter((i: any) => i.is_active)
                    .map((installer: any) => (
                      <SelectItem key={installer.id} value={installer.id}>
                        {installer.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Стоимость монтажа (₽)</Label>
              <Input
                type="number"
                value={montageFormData.cost}
                onChange={(e) => setMontageFormData({ ...montageFormData, cost: e.target.value })}
                placeholder="5000"
              />
            </div>
            <div>
              <Label>Заметки</Label>
              <Textarea
                value={montageFormData.notes}
                onChange={(e) => setMontageFormData({ ...montageFormData, notes: e.target.value })}
                placeholder="Дополнительная информация..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendToMontageOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                if (!montageFormData.address) {
                  toast({ title: "Ошибка", description: "Укажите адрес", variant: "destructive" });
                  return;
                }
                if (!itemForMontage || !id) return;
                sendToMontageMutation.mutate({
                  project_id: id,
                  project_item_id: itemForMontage.id,
                  address: montageFormData.address,
                  client_name: montageFormData.client_name || undefined,
                  client_phone: montageFormData.client_phone || undefined,
                  scheduled_date: montageFormData.scheduled_date || undefined,
                  scheduled_time: montageFormData.scheduled_time || undefined,
                  installer_id: montageFormData.installer_id || undefined,
                  cost: montageFormData.cost ? parseFloat(montageFormData.cost) : undefined,
                  notes: montageFormData.notes || undefined,
                });
              }}
              disabled={sendToMontageMutation.isPending}
            >
              {sendToMontageMutation.isPending ? "Отправка..." : "Отправить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
