import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest, queryClient, getCurrentUserId } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Bot,
  ShoppingCart,
  Trash2,
  Loader2,
  Package,
  Check,
  Building2,
  Clock,
  Truck,
  PackageCheck,
  Lock,
  Plus,
  X,
  ListTodo
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface ExcelComparisonViewProps {
  stageId: string;
  projectId: string;
}

interface ComparisonItem {
  id: string;
  comparison_id: string;
  excel_name: string;
  excel_sku?: string;
  excel_quantity: number;
  excel_unit: string;
  warehouse_item_id?: string;
  warehouse_quantity?: number;
  status: string;
  match_confidence?: string;
  ai_suggestions?: string;
  selected_alternative_id?: string;
  quantity_to_order: number;
  added_to_order: number;
  // Новые поля для закупки
  supplier_id?: string;
  price?: number;
  note?: string;
  procurement_status?: string; // pending, ordered, in_transit, received, cancelled
  ordered_at?: string;
  received_at?: string;
  warehouse_item?: {
    id: string;
    name: string;
    sku?: string;
    quantity: number;
    unit?: string;
  };
  alternative_item?: {
    id: string;
    name: string;
    sku?: string;
    quantity: number;
    unit?: string;
  };
  supplier?: {
    id: string;
    name: string;
    contact_person?: string;
    phone?: string;
  };
  ai_suggestions_parsed?: Array<{
    id: string;
    name: string;
    sku?: string;
    quantity: number;
    confidence?: string;
  }>;
}

interface Comparison {
  id: string;
  file_name: string;
  status: string;
  total_items: number;
  items_in_stock: number;
  items_partial: number;
  items_missing: number;
  created_at: string;
}

interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
}

// Статусы закупки
const PROCUREMENT_STATUSES = [
  { value: 'pending', label: 'Ожидание', icon: Clock, color: 'text-gray-500' },
  { value: 'ordered', label: 'Заказано', icon: ShoppingCart, color: 'text-blue-500' },
  { value: 'in_transit', label: 'В пути', icon: Truck, color: 'text-yellow-500' },
  { value: 'received', label: 'Получено', icon: PackageCheck, color: 'text-green-500' },
  { value: 'cancelled', label: 'Отменено', icon: XCircle, color: 'text-red-500' },
];

export function ExcelComparisonView({ stageId, projectId }: ExcelComparisonViewProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentComparisonId, setCurrentComparisonId] = useState<string | null>(null);

  // Получить список сравнений для этапа
  const { data: comparisons = [], isLoading: loadingComparisons } = useQuery<Comparison[]>({
    queryKey: [`/api/procurement/stage/${stageId}`],
    enabled: !!stageId,
    refetchInterval: 10000, // Real-time: обновление каждые 10 секунд
  });

  // Получить детали текущего сравнения
  const { data: comparisonData, isLoading: loadingComparison } = useQuery<{
    comparison: Comparison;
    items: ComparisonItem[];
  }>({
    queryKey: [`/api/procurement/${currentComparisonId}`],
    enabled: !!currentComparisonId,
    refetchInterval: 5000, // Real-time: обновление каждые 5 секунд
  });

  // Получить список поставщиков
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['/api/suppliers'],
    refetchInterval: 30000, // Real-time: обновление каждые 30 секунд
  });

  // ========== SHOPPING CARDS (мини-Kanban) ==========
  interface ShoppingCard {
    id: string;
    stage_id: string;
    title: string;
    description?: string;
    status: 'todo' | 'in_progress' | 'done';
    order_index: number;
    created_at: string;
    updated_at: string;
  }

  const [newCardTitle, setNewCardTitle] = useState('');
  const [showAddCard, setShowAddCard] = useState(false);

  // Получить карточки
  const { data: shoppingCards = [] } = useQuery<ShoppingCard[]>({
    queryKey: [`/api/procurement/stage/${stageId}/cards`],
    enabled: !!stageId,
    refetchInterval: 10000,
  });

  // Создать карточку
  const createCardMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch(`/api/procurement/stage/${stageId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Ошибка создания');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/stage/${stageId}/cards`] });
      setNewCardTitle('');
      setShowAddCard(false);
    },
  });

  // Обновить карточку
  const updateCardMutation = useMutation({
    mutationFn: async ({ cardId, data }: { cardId: string; data: Partial<ShoppingCard> }) => {
      const res = await fetch(`/api/procurement/cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Ошибка обновления');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/stage/${stageId}/cards`] });
    },
  });

  // Удалить карточку
  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await fetch(`/api/procurement/cards/${cardId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ошибка удаления');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/stage/${stageId}/cards`] });
    },
  });

  // Группировка карточек по статусам
  const cardsByStatus = {
    todo: shoppingCards.filter(c => c.status === 'todo'),
    in_progress: shoppingCards.filter(c => c.status === 'in_progress'),
    done: shoppingCards.filter(c => c.status === 'done'),
  };

  // Мутация загрузки файла
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stage_id', stageId);
      formData.append('project_id', projectId);

      const response = await fetch('/api/procurement/upload', {
        method: 'POST',
        headers: {
          'x-user-id': getCurrentUserId(),
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка загрузки');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({ description: "Файл загружен. Запускаю сравнение..." });
      setCurrentComparisonId(data.id);
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/stage/${stageId}`] });
      // Сразу запускаем сравнение
      runCompareMutation.mutate(data.id);
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  // Мутация запуска сравнения
  const runCompareMutation = useMutation({
    mutationFn: async (comparisonId: string) => {
      return await apiRequest('POST', `/api/procurement/${comparisonId}/compare`);
    },
    onSuccess: () => {
      toast({ description: "Сравнение завершено!" });
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/${currentComparisonId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/stage/${stageId}`] });
    },
    onError: (error: Error) => {
      toast({ description: error.message, variant: "destructive" });
    },
  });

  // Мутация добавления в заказ
  const toggleOrderMutation = useMutation({
    mutationFn: async ({ itemId, addToOrder }: { itemId: string; addToOrder: boolean }) => {
      return await apiRequest('PUT', `/api/procurement/items/${itemId}/order`, {
        add_to_order: addToOrder
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/${currentComparisonId}`] });
    },
  });

  // Мутация выбора альтернативы
  const selectAlternativeMutation = useMutation({
    mutationFn: async ({ itemId, alternativeId }: { itemId: string; alternativeId: string }) => {
      return await apiRequest('PUT', `/api/procurement/items/${itemId}/alternative`, {
        alternative_id: alternativeId
      });
    },
    onSuccess: () => {
      toast({ description: "Альтернатива выбрана" });
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/${currentComparisonId}`] });
    },
  });

  // Мутация подтверждения сопоставления (устанавливает confidence = 'high')
  const confirmMatchMutation = useMutation({
    mutationFn: async ({ itemId }: { itemId: string }) => {
      return await apiRequest('PUT', `/api/procurement/items/${itemId}/confirm`);
    },
    onSuccess: () => {
      toast({ description: "Сопоставление подтверждено" });
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/${currentComparisonId}`] });
    },
  });

  // Мутация изменения количества
  const updateQuantityMutation = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      return await apiRequest('PUT', `/api/procurement/items/${itemId}/quantity`, { quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/${currentComparisonId}`] });
    },
  });

  // Мутация обновления данных позиции (поставщик, цена, примечание, статус)
  const updateItemMutation = useMutation({
    mutationFn: async ({ itemId, data }: {
      itemId: string;
      data: { supplier_id?: string; price?: number; note?: string; procurement_status?: string }
    }) => {
      return await apiRequest('PUT', `/api/procurement/items/${itemId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/procurement/${currentComparisonId}`] });
    },
  });

  // Функция экспорта заказа в Excel
  const handleExportOrder = async () => {
    if (!currentComparisonId) return;

    try {
      const response = await fetch(`/api/procurement/${currentComparisonId}/export`, {
        method: 'GET',
        headers: {
          'X-User-Id': getCurrentUserId(),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка экспорта');
      }

      // Скачиваем файл
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Заявка_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({ description: "Заявка успешно создана" });
    } catch (error: any) {
      toast({ description: error.message || "Ошибка экспорта", variant: "destructive" });
    }
  };

  // Авто-раскрытие для low confidence и missing (если есть альтернативы)
  useEffect(() => {
    if (comparisonData?.items) {
      const itemsToExpand = comparisonData.items.filter(item =>
        (item.match_confidence === 'low' || item.status === 'missing') &&
        item.ai_suggestions_parsed &&
        item.ai_suggestions_parsed.length > 0
      );
      if (itemsToExpand.length > 0) {
        setExpandedRows(prev => {
          const newSet = new Set(prev);
          itemsToExpand.forEach(item => newSet.add(item.id));
          return newSet;
        });
      }
    }
  }, [comparisonData?.items]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const toggleRow = (itemId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedRows(newExpanded);
  };

  // Авто-раскрытие для неточных совпадений (medium/low с warehouse_item или с альтернативами)
  useEffect(() => {
    if (!comparisonData?.items) return;

    const itemsToExpand = comparisonData.items.filter(item => {
      // Пропускаем уже подтверждённые или выбранные
      if (item.match_confidence === 'high' || item.status === 'alternative_selected') return false;

      // Раскрываем если есть неточный warehouse_item или альтернативы
      const hasInexactMatch = item.warehouse_item && item.match_confidence !== 'high';
      const hasAlternatives = item.ai_suggestions_parsed && item.ai_suggestions_parsed.length > 0;

      return hasInexactMatch || hasAlternatives;
    });

    if (itemsToExpand.length > 0) {
      setExpandedRows(prev => {
        const newExpanded = new Set(prev);
        itemsToExpand.forEach(item => newExpanded.add(item.id));
        return newExpanded;
      });
    }
  }, [comparisonData?.items]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'missing':
      case 'pending':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'alternative_selected':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      default:
        return <Package className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_stock':
        return <Badge className="bg-green-100 text-green-800">Есть</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800">Частично</Badge>;
      case 'missing':
        return <Badge className="bg-red-100 text-red-800">Нет</Badge>;
      case 'alternative_selected':
        return <Badge className="bg-blue-100 text-blue-800">Замена</Badge>;
      default:
        return <Badge variant="outline">Ожидание</Badge>;
    }
  };

  // Считаем позиции в заказе
  const itemsInOrder = comparisonData?.items.filter(i => i.added_to_order) || [];

  // Считаем статистику из items (не из comparison)
  const itemsInStockCount = comparisonData?.items.filter(i => i.status === 'in_stock').length || 0;
  const itemsPartialCount = comparisonData?.items.filter(i => i.status === 'partial').length || 0;
  const itemsMissingCount = comparisonData?.items.filter(i => i.status === 'missing').length || 0;
  const itemsPendingCount = comparisonData?.items.filter(i => i.status === 'pending').length || 0;

  // Функция для получения количества для заказа
  const getQuantityToOrder = (item: ComparisonItem) => {
    return item.status === 'pending' ? item.excel_quantity : item.quantity_to_order;
  };

  // Сортировка: подтверждённые (high) вверху, потом выбранные альтернативы, потом остальные
  const sortedItems = useMemo(() => {
    if (!comparisonData?.items) return [];

    return [...comparisonData.items].sort((a, b) => {
      // Порядок приоритета: high > alternative_selected > medium > low > missing/pending
      const getPriority = (item: ComparisonItem) => {
        if (item.match_confidence === 'high') return 0;
        if (item.status === 'alternative_selected') return 1;
        if (item.match_confidence === 'medium') return 2;
        if (item.match_confidence === 'low') return 3;
        return 4; // missing, pending
      };
      return getPriority(a) - getPriority(b);
    });
  }, [comparisonData?.items]);

  return (
    <Card>
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
            <CardTitle className="text-sm">Сравнение закупок</CardTitle>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".xlsx,.xls"
              className="hidden"
            />
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending || runCompareMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Upload className="w-3 h-3 mr-1" />
              )}
              Excel
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {/* Список загруженных сравнений */}
        {comparisons.length > 0 && !currentComparisonId && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Предыдущие сравнения:</p>
            {comparisons.map((comp, index) => (
              <div
                key={comp.id}
                className="flex items-center justify-between py-1 px-2 border rounded hover:bg-accent/50"
              >
                <span className="text-xs">
                  Сравнение #{comparisons.length - index} ({comp.total_items} поз.)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => setCurrentComparisonId(comp.id)}
                >
                  Открыть
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* ========== МИНИ-KANBAN: Список покупок ========== */}
        {!currentComparisonId && (
          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Список покупок</span>
                <Badge variant="secondary" className="text-xs">{shoppingCards.length}</Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs"
                onClick={() => setShowAddCard(!showAddCard)}
              >
                <Plus className="w-3 h-3 mr-1" />
                Добавить
              </Button>
            </div>

            {/* Форма добавления */}
            {showAddCard && (
              <div className="flex gap-2 mb-3">
                <Input
                  value={newCardTitle}
                  onChange={(e) => setNewCardTitle(e.target.value)}
                  placeholder="Что нужно купить..."
                  className="h-7 text-xs flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newCardTitle.trim()) {
                      createCardMutation.mutate(newCardTitle.trim());
                    }
                  }}
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!newCardTitle.trim() || createCardMutation.isPending}
                  onClick={() => createCardMutation.mutate(newCardTitle.trim())}
                >
                  {createCardMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                </Button>
              </div>
            )}

            {/* 3 колонки Kanban */}
            <div className="grid grid-cols-3 gap-2">
              {/* Колонка: Купить (todo) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-xs font-medium text-blue-700 dark:text-blue-300">
                  <ShoppingCart className="w-3 h-3" />
                  Купить ({cardsByStatus.todo.length})
                </div>
                {cardsByStatus.todo.map(card => (
                  <div key={card.id} className="flex items-center gap-1 p-2 bg-white dark:bg-gray-800 border rounded text-xs group">
                    <span className="flex-1 truncate">{card.title}</span>
                    <Select
                      value={card.status}
                      onValueChange={(status) => updateCardMutation.mutate({ cardId: card.id, data: { status: status as 'todo' | 'in_progress' | 'done' } })}
                    >
                      <SelectTrigger className="h-5 w-5 p-0 border-0 opacity-0 group-hover:opacity-100">
                        <ChevronRight className="w-3 h-3" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in_progress">В процессе</SelectItem>
                        <SelectItem value="done">Куплено</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                      onClick={() => deleteCardMutation.mutate(card.id)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Колонка: В процессе (in_progress) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs font-medium text-yellow-700 dark:text-yellow-300">
                  <Clock className="w-3 h-3" />
                  В процессе ({cardsByStatus.in_progress.length})
                </div>
                {cardsByStatus.in_progress.map(card => (
                  <div key={card.id} className="flex items-center gap-1 p-2 bg-white dark:bg-gray-800 border rounded text-xs group">
                    <span className="flex-1 truncate">{card.title}</span>
                    <Select
                      value={card.status}
                      onValueChange={(status) => updateCardMutation.mutate({ cardId: card.id, data: { status: status as 'todo' | 'in_progress' | 'done' } })}
                    >
                      <SelectTrigger className="h-5 w-5 p-0 border-0 opacity-0 group-hover:opacity-100">
                        <ChevronRight className="w-3 h-3" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">Купить</SelectItem>
                        <SelectItem value="done">Куплено</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                      onClick={() => deleteCardMutation.mutate(card.id)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Колонка: Куплено (done) */}
              <div className="space-y-1">
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded text-xs font-medium text-green-700 dark:text-green-300">
                  <CheckCircle className="w-3 h-3" />
                  Куплено ({cardsByStatus.done.length})
                </div>
                {cardsByStatus.done.map(card => (
                  <div key={card.id} className="flex items-center gap-1 p-2 bg-white dark:bg-gray-800 border rounded text-xs group">
                    <span className="flex-1 truncate line-through text-muted-foreground">{card.title}</span>
                    <Select
                      value={card.status}
                      onValueChange={(status) => updateCardMutation.mutate({ cardId: card.id, data: { status: status as 'todo' | 'in_progress' | 'done' } })}
                    >
                      <SelectTrigger className="h-5 w-5 p-0 border-0 opacity-0 group-hover:opacity-100">
                        <ChevronRight className="w-3 h-3" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">Купить</SelectItem>
                        <SelectItem value="in_progress">В процессе</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                      onClick={() => deleteCardMutation.mutate(card.id)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {shoppingCards.length === 0 && !showAddCard && (
              <div className="text-center py-4 text-xs text-muted-foreground">
                Нет карточек. Нажмите "Добавить" чтобы создать.
              </div>
            )}
          </div>
        )}

        {/* Результаты сравнения */}
        {currentComparisonId && comparisonData && (
          <>
            {/* Сводка */}
            <div className="flex items-center gap-3 py-2 px-3 bg-muted/50 rounded flex-wrap">
              {itemsPendingCount > 0 && (
                <div className="flex items-center gap-1">
                  <Package className="w-3 h-3 text-gray-400" />
                  <span className="text-xs">{itemsPendingCount} ожидание</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <CheckCircle className="w-3 h-3 text-green-500" />
                <span className="text-xs">{itemsInStockCount} есть</span>
              </div>
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                <span className="text-xs">{itemsPartialCount} частично</span>
              </div>
              <div className="flex items-center gap-1">
                <XCircle className="w-3 h-3 text-red-500" />
                <span className="text-xs">{itemsMissingCount} нет</span>
              </div>
              {/* Разделитель и легенда */}
              <div className="h-4 w-px bg-border mx-1" />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-green-500" /> точно
                <span className="w-2 h-2 rounded-full bg-yellow-500" /> похоже
                <span className="w-2 h-2 rounded-full bg-red-500" /> проверить
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 text-xs"
                onClick={() => setCurrentComparisonId(null)}
              >
                Назад
              </Button>
            </div>

            {runCompareMutation.isPending && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <span className="ml-2 text-xs">AI сравнивает...</span>
              </div>
            )}

            {/* Таблица и корзина рядом */}
            {!runCompareMutation.isPending && (
              <div className="flex gap-2">
                {/* Таблица позиций */}
                <div className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 text-xs">№</TableHead>
                        <TableHead className="text-xs">Позиция из Excel</TableHead>
                        <TableHead className="text-xs">Артикул</TableHead>
                        <TableHead className="text-xs">Сопоставлено</TableHead>
                        <TableHead className="text-xs text-right">Нужно</TableHead>
                        <TableHead className="text-xs text-right">Склад</TableHead>
                        <TableHead className="text-xs">Статус</TableHead>
                        <TableHead className="w-8 text-xs">AI</TableHead>
                        <TableHead className="text-xs text-right">Действие</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItems.map((item, index) => (
                        <Collapsible key={item.id} asChild>
                          <>
                            <TableRow className="hover:bg-muted/50 h-8">
                              <TableCell className="py-1 text-xs">{index + 1}</TableCell>
                              <TableCell className="py-1 text-xs">{item.excel_name}</TableCell>
                              <TableCell className="py-1 text-xs text-muted-foreground">
                                {item.excel_sku || '—'}
                              </TableCell>
                              {/* Сопоставленный товар со склада */}
                              <TableCell className="py-1 text-xs">
                                {item.match_confidence === 'high' && item.warehouse_item ? (
                                  // Точное совпадение - показываем как раньше
                                  <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" title="Точное совпадение" />
                                    <span className="truncate max-w-[120px]" title={item.warehouse_item.name}>
                                      {item.warehouse_item.name}
                                    </span>
                                    <Check className="w-3 h-3 text-green-500 shrink-0" title="Подтверждено" />
                                    <Lock className="w-3 h-3 text-amber-500 shrink-0" title="Зарезервировано" />
                                  </div>
                                ) : item.status === 'alternative_selected' && item.alternative_item ? (
                                  // Выбрана альтернатива
                                  <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Выбрана альтернатива" />
                                    <span className="truncate max-w-[120px] text-blue-600" title={item.alternative_item.name}>
                                      {item.alternative_item.name}
                                    </span>
                                    <Check className="w-3 h-3 text-blue-500 shrink-0" />
                                    <Lock className="w-3 h-3 text-amber-500 shrink-0" title="Зарезервировано" />
                                  </div>
                                ) : (item.warehouse_item || (item.ai_suggestions_parsed && item.ai_suggestions_parsed.length > 0)) ? (
                                  // Неточное совпадение ИЛИ есть альтернативы - предлагаем выбрать
                                  <div className="flex items-center gap-1">
                                    {item.warehouse_item ? (
                                      <>
                                        {item.match_confidence === 'medium' && (
                                          <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" title="Похожий товар" />
                                        )}
                                        {item.match_confidence === 'low' && (
                                          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="Требует проверки" />
                                        )}
                                      </>
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Выберите из списка" />
                                    )}
                                    <span className="text-orange-600 font-medium">Выберите →</span>
                                  </div>
                                ) : (
                                  <span className="text-red-500">Не найдено</span>
                                )}
                              </TableCell>
                              <TableCell className="py-1 text-xs text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <input
                                    type="number"
                                    className="w-12 text-right bg-transparent border-b border-transparent hover:border-gray-300 focus:border-primary focus:outline-none px-1 py-0.5 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    defaultValue={item.excel_quantity}
                                    min={0}
                                    onBlur={(e) => {
                                      const newQty = parseInt(e.target.value) || 0;
                                      if (newQty !== item.excel_quantity) {
                                        updateQuantityMutation.mutate({
                                          itemId: item.id,
                                          quantity: newQty
                                        });
                                      }
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                  />
                                  <span className="text-muted-foreground">{item.excel_unit}</span>
                                </div>
                              </TableCell>
                              <TableCell className="py-1 text-xs text-right">
                                {item.warehouse_quantity ?? 0} {item.excel_unit}
                              </TableCell>
                              <TableCell className="py-1">{getStatusBadge(item.status)}</TableCell>
                              <TableCell className="py-1">
                                {/* Показываем кнопку если есть альтернативы ИЛИ medium/low с warehouse_item */}
                                {((item.ai_suggestions_parsed && item.ai_suggestions_parsed.length > 0) ||
                                  (item.warehouse_item && item.match_confidence !== 'high' && item.status !== 'alternative_selected')) && (
                                  <CollapsibleTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => toggleRow(item.id)}
                                    >
                                      {expandedRows.has(item.id) ? (
                                        <ChevronDown className="w-3 h-3" />
                                      ) : (
                                        <ChevronRight className="w-3 h-3" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                )}
                              </TableCell>
                              <TableCell className="py-1 text-right">
                                {item.status === 'in_stock' ? (
                                  <span className="text-green-600 text-xs">✓</span>
                                ) : (
                                  <Button
                                    size="sm"
                                    className="h-6 text-xs"
                                    variant={item.added_to_order ? "secondary" : "default"}
                                    onClick={() => toggleOrderMutation.mutate({
                                      itemId: item.id,
                                      addToOrder: !item.added_to_order
                                    })}
                                    disabled={toggleOrderMutation.isPending}
                                  >
                                    <ShoppingCart className="w-3 h-3 mr-1" />
                                    +{getQuantityToOrder(item)}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>

                            {/* Раскрывающаяся панель альтернатив */}
                            <CollapsibleContent asChild>
                              <TableRow className="bg-blue-50/50 dark:bg-blue-950/20">
                                <TableCell colSpan={9} className="p-0">
                                  <div className="p-3 space-y-2">
                                    <div className="flex items-center gap-2 text-xs font-medium">
                                      <Bot className="w-3 h-3 text-blue-500" />
                                      Выберите подходящий вариант:
                                    </div>
                                    <div className="grid gap-2">
                                      {/* Если есть warehouse_item с medium/low - показываем первым как предложение AI */}
                                      {item.warehouse_item && item.match_confidence !== 'high' && (
                                        <div
                                          className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-950/30 rounded border border-yellow-200 dark:border-yellow-800"
                                        >
                                          <div>
                                            <div className="flex items-center gap-1">
                                              <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                                              <p className="font-medium text-xs">{item.warehouse_item.name}</p>
                                              <span className="text-xs text-yellow-600 ml-1">(предложение AI)</span>
                                            </div>
                                            <p className="text-xs text-muted-foreground ml-3">
                                              {item.warehouse_item.sku && `Артикул: ${item.warehouse_item.sku} | `}
                                              Доступно: {item.warehouse_quantity}
                                            </p>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="h-6 text-xs"
                                            onClick={() => {
                                              // Подтверждаем сопоставление AI
                                              confirmMatchMutation.mutate({ itemId: item.id });
                                            }}
                                            disabled={confirmMatchMutation.isPending}
                                          >
                                            Выбрать
                                          </Button>
                                        </div>
                                      )}
                                      {/* Остальные альтернативы */}
                                      {item.ai_suggestions_parsed?.map((alt) => (
                                        <div
                                          key={alt.id}
                                          className="flex items-center justify-between p-2 bg-background rounded border"
                                        >
                                          <div>
                                            <p className="font-medium text-xs">{alt.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                              {alt.sku && `Артикул: ${alt.sku} | `}
                                              Доступно: {alt.available_quantity ?? alt.quantity}
                                            </p>
                                          </div>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-xs"
                                            onClick={() => selectAlternativeMutation.mutate({
                                              itemId: item.id,
                                              alternativeId: alt.id
                                            })}
                                            disabled={selectAlternativeMutation.isPending}
                                          >
                                            Выбрать
                                          </Button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Корзина заказа справа */}
                {itemsInOrder.length > 0 && (
                  <div className="w-80 shrink-0 border-l pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShoppingCart className="w-4 h-4" />
                      <span className="font-medium text-xs">В заказе: {itemsInOrder.length}</span>
                    </div>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-3 pr-3">
                        {itemsInOrder.map((item) => {
                          const statusInfo = PROCUREMENT_STATUSES.find(s => s.value === (item.procurement_status || 'pending'));
                          const StatusIcon = statusInfo?.icon || Clock;

                          return (
                            <div key={item.id} className="p-2 bg-muted/50 rounded space-y-2">
                              {/* Название и количество */}
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <p className="text-xs font-medium truncate" title={item.alternative_item?.name || item.warehouse_item?.name || item.excel_name}>
                                    {item.alternative_item?.name || item.warehouse_item?.name || item.excel_name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {getQuantityToOrder(item)} {item.excel_unit}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 shrink-0"
                                  onClick={() => toggleOrderMutation.mutate({
                                    itemId: item.id,
                                    addToOrder: false
                                  })}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>

                              {/* Поставщик */}
                              <div className="flex items-center gap-1">
                                <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                                <Select
                                  value={item.supplier_id || ''}
                                  onValueChange={(value) => {
                                    updateItemMutation.mutate({
                                      itemId: item.id,
                                      data: { supplier_id: value || undefined }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-6 text-xs flex-1">
                                    <SelectValue placeholder="Выбрать поставщика" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {suppliers.map((sup) => (
                                      <SelectItem key={sup.id} value={sup.id} className="text-xs">
                                        {sup.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Цена и статус */}
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  placeholder="Цена"
                                  className="h-6 text-xs w-20"
                                  defaultValue={item.price || ''}
                                  onBlur={(e) => {
                                    const price = parseFloat(e.target.value) || undefined;
                                    if (price !== item.price) {
                                      updateItemMutation.mutate({
                                        itemId: item.id,
                                        data: { price }
                                      });
                                    }
                                  }}
                                />
                                <Select
                                  value={item.procurement_status || 'pending'}
                                  onValueChange={(value) => {
                                    updateItemMutation.mutate({
                                      itemId: item.id,
                                      data: { procurement_status: value }
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-6 text-xs flex-1">
                                    <div className="flex items-center gap-1">
                                      <StatusIcon className={`w-3 h-3 ${statusInfo?.color}`} />
                                      <SelectValue />
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {PROCUREMENT_STATUSES.map((status) => (
                                      <SelectItem key={status.value} value={status.value} className="text-xs">
                                        <div className="flex items-center gap-1">
                                          <status.icon className={`w-3 h-3 ${status.color}`} />
                                          {status.label}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Примечание */}
                              <Input
                                placeholder="Примечание..."
                                className="h-6 text-xs"
                                defaultValue={item.note || ''}
                                onBlur={(e) => {
                                  const note = e.target.value || undefined;
                                  if (note !== item.note) {
                                    updateItemMutation.mutate({
                                      itemId: item.id,
                                      data: { note }
                                    });
                                  }
                                }}
                              />

                              {/* Сумма */}
                              {item.price && (
                                <div className="text-xs text-right text-muted-foreground">
                                  Сумма: {formatCurrency(item.price * getQuantityToOrder(item))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    {/* Итого и кнопка создания заявки */}
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>Позиций:</span>
                        <span className="font-medium">{itemsInOrder.length}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span>Итого:</span>
                        <span className="font-medium">
                          {formatCurrency(
                            itemsInOrder.reduce((sum, item) => {
                              return sum + (item.price || 0) * getQuantityToOrder(item);
                            }, 0)
                          )}
                        </span>
                      </div>
                      <Button className="w-full h-8 text-xs" onClick={handleExportOrder}>
                        Создать заявку
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Пустое состояние */}
        {!currentComparisonId && comparisons.length === 0 && !loadingComparisons && (
          <div className="text-center py-4">
            <FileSpreadsheet className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">
              Загрузите Excel для сравнения со складом
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
