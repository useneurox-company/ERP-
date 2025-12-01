import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Plus,
  Edit2,
  Trash2,
  Package,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Truck,
  FileText,
} from "lucide-react";
import type { ProjectStage } from "@shared/schema";
import type { ProcurementStageData, ProcurementItem, BudgetInfo } from "@/types/procurement";
import { nanoid } from "nanoid";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ExcelComparisonView } from "./procurement/ExcelComparisonView";

interface User {
  id: string;
  username: string;
  full_name?: string;
}

interface ProcurementStageFormProps {
  stage: ProjectStage;
  onDataChange: (data: ProcurementStageData) => void;
  readOnly?: boolean;
}

export function ProcurementStageForm({
  stage,
  onDataChange,
  readOnly = false
}: ProcurementStageFormProps) {
  const [formData, setFormData] = useState<ProcurementStageData>(() => {
    try {
      const parsed = stage.type_data ? JSON.parse(stage.type_data as string) : {};
      const items = parsed.procurement_items || [];

      // Вычисляем бюджет
      const actualExpenses = items.reduce((sum: number, item: ProcurementItem) =>
        sum + (item.cost || 0), 0
      );
      const plannedBudget = parsed.budget_info?.planned_budget || 0;

      return {
        procurement_items: items,
        budget_info: {
          planned_budget: plannedBudget,
          actual_expenses: actualExpenses,
          remaining: plannedBudget - actualExpenses,
          is_over_budget: actualExpenses > plannedBudget && plannedBudget > 0,
        },
        all_materials_received: items.length > 0 && items.every((i: ProcurementItem) => i.status === 'received'),
        production_notified: parsed.production_notified || false,
        ...parsed,
      };
    } catch {
      return {
        procurement_items: [],
        budget_info: {
          actual_expenses: 0,
          remaining: 0,
          is_over_budget: false,
        },
        all_materials_received: false,
        production_notified: false,
      };
    }
  });

  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ProcurementItem | null>(null);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [plannedBudget, setPlannedBudget] = useState(formData.budget_info.planned_budget?.toString() || "");

  // Форма для позиции
  const [itemForm, setItemForm] = useState<Partial<ProcurementItem>>({
    material_name: "",
    quantity: 1,
    unit: "шт",
    status: "not_ordered",
  });

  // Загружаем список пользователей
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Пересчитываем бюджет при изменении items
  useEffect(() => {
    const actualExpenses = formData.procurement_items.reduce((sum, item) =>
      sum + (item.cost || 0), 0
    );
    const plannedBudget = formData.budget_info.planned_budget || 0;
    const allReceived = formData.procurement_items.length > 0 &&
      formData.procurement_items.every(i => i.status === 'received');

    const updatedData = {
      ...formData,
      budget_info: {
        ...formData.budget_info,
        actual_expenses: actualExpenses,
        remaining: plannedBudget - actualExpenses,
        is_over_budget: actualExpenses > plannedBudget && plannedBudget > 0,
      },
      all_materials_received: allReceived,
    };

    if (JSON.stringify(updatedData) !== JSON.stringify(formData)) {
      setFormData(updatedData);
    }
  }, [formData.procurement_items, formData.budget_info.planned_budget]);

  const handleAddItem = () => {
    setEditingItem(null);
    setItemForm({
      material_name: "",
      quantity: 1,
      unit: "шт",
      status: "not_ordered",
    });
    setShowItemDialog(true);
  };

  const handleEditItem = (item: ProcurementItem) => {
    setEditingItem(item);
    setItemForm(item);
    setShowItemDialog(true);
  };

  const handleSaveItem = () => {
    if (!itemForm.material_name?.trim()) return;

    const newItem: ProcurementItem = {
      id: editingItem?.id || nanoid(),
      material_name: itemForm.material_name,
      quantity: itemForm.quantity || 1,
      unit: itemForm.unit || "шт",
      status: itemForm.status || "not_ordered",
      supplier: itemForm.supplier,
      order_date: itemForm.order_date,
      expected_delivery: itemForm.expected_delivery,
      actual_delivery: itemForm.actual_delivery,
      cost: itemForm.cost,
      invoice_url: itemForm.invoice_url,
      notes: itemForm.notes,
    };

    const updatedItems = editingItem
      ? formData.procurement_items.map(i => i.id === editingItem.id ? newItem : i)
      : [...formData.procurement_items, newItem];

    const updatedData = {
      ...formData,
      procurement_items: updatedItems,
    };

    setFormData(updatedData);
    onDataChange(updatedData);
    setShowItemDialog(false);
  };

  const handleDeleteItem = (itemId: string) => {
    const updatedItems = formData.procurement_items.filter(i => i.id !== itemId);
    const updatedData = {
      ...formData,
      procurement_items: updatedItems,
    };
    setFormData(updatedData);
    onDataChange(updatedData);
  };

  const handleSaveBudget = () => {
    const budget = parseFloat(plannedBudget) || 0;
    const updatedData = {
      ...formData,
      budget_info: {
        ...formData.budget_info,
        planned_budget: budget,
      },
    };
    setFormData(updatedData);
    onDataChange(updatedData);
    setShowBudgetDialog(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />Получено</Badge>;
      case 'in_transit':
        return <Badge className="bg-blue-100 text-blue-800"><Truck className="w-3 h-3 mr-1" />В пути</Badge>;
      case 'ordered':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />Заказано</Badge>;
      default:
        return <Badge variant="outline">Не заказано</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString("ru-RU")} ₽`;
  };

  const completionPercentage = formData.procurement_items.length > 0
    ? (formData.procurement_items.filter(i => i.status === 'received').length / formData.procurement_items.length) * 100
    : 0;

  return (
    <Card className="border-l-4 border-purple-500">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <CardTitle className="text-base">Снабжение</CardTitle>
          </div>
          {formData.all_materials_received && (
            <Badge className="bg-green-600">
              <CheckCircle className="w-3 h-3 mr-1" />
              Все материалы получены
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Исполнитель */}
        <div className="space-y-2">
          <Label htmlFor="assignee" className="text-sm font-medium">
            Ответственный за закупки
          </Label>
          <Select
            value={formData.assignee_id || stage.assignee_id || "__none__"}
            onValueChange={(value) => {
              const updated = { ...formData, assignee_id: value === "__none__" ? undefined : value };
              setFormData(updated);
              onDataChange(updated);
            }}
            disabled={readOnly}
          >
            <SelectTrigger id="assignee" className="text-sm">
              <SelectValue placeholder="Выберите снабженца" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Не назначен</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.full_name || u.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Сравнение закупок с Excel */}
        {stage.project_id && (
          <ExcelComparisonView
            stageId={stage.id}
            projectId={stage.project_id}
          />
        )}

        {readOnly && stage.status === 'completed' && (
          <div className="text-xs text-muted-foreground bg-accent p-2 rounded">
            ℹ️ Этап завершен. Редактирование недоступно.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
