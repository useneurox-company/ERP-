import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TechSpecAddon, RecentlyAdded } from "@/types/technicalSpecification";
import { nanoid } from "nanoid";

interface TechnicalSpecAddonsTableProps {
  addons: TechSpecAddon[];
  recentlyAdded: RecentlyAdded;
  onAddonsChange: (addons: TechSpecAddon[]) => void;
  readOnly?: boolean;
}

interface AddonFormData {
  name: string;
  description: string;
  priceChange: number;
  quantity: number;
  unit: string;
  category: string;
  imageUrl: string;
}

const UNITS = ["шт", "м²", "м.п.", "м", "кг", "л", "уп"];
const CATEGORIES = [
  "Дополнительные материалы",
  "Дополнительные работы",
  "Изменение конструкции",
  "Улучшения",
  "Скидка",
  "Другое"
];

export function TechnicalSpecAddonsTable({
  addons,
  recentlyAdded,
  onAddonsChange,
  readOnly = false
}: TechnicalSpecAddonsTableProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<TechSpecAddon | null>(null);
  const [formData, setFormData] = useState<AddonFormData>({
    name: "",
    description: "",
    priceChange: 0,
    quantity: 1,
    unit: "шт",
    category: "Другое",
    imageUrl: ""
  });

  // Calculate totals
  const addonsTotal = addons.reduce((sum, addon) => sum + addon.total, 0);
  const positiveTotal = addons
    .filter(a => a.total > 0)
    .reduce((sum, a) => sum + a.total, 0);
  const negativeTotal = addons
    .filter(a => a.total < 0)
    .reduce((sum, a) => sum + a.total, 0);

  const handleOpenDialog = (addon?: TechSpecAddon) => {
    if (addon) {
      setEditingAddon(addon);
      setFormData({
        name: addon.name,
        description: addon.description || "",
        priceChange: addon.priceChange,
        quantity: addon.quantity,
        unit: addon.unit,
        category: addon.category || "Другое",
        imageUrl: addon.imageUrl || ""
      });
    } else {
      setEditingAddon(null);
      setFormData({
        name: "",
        description: "",
        priceChange: 0,
        quantity: 1,
        unit: "шт",
        category: "Другое",
        imageUrl: ""
      });
    }
    setDialogOpen(true);
  };

  const handleSaveAddon = () => {
    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;

    if (editingAddon) {
      // Update existing addon
      const updatedAddons = addons.map(addon =>
        addon.id === editingAddon.id
          ? {
              ...addon,
              name: formData.name,
              description: formData.description,
              priceChange: formData.priceChange,
              quantity: formData.quantity,
              unit: formData.unit,
              category: formData.category,
              imageUrl: formData.imageUrl,
              total: formData.priceChange * formData.quantity
            }
          : addon
      );
      onAddonsChange(updatedAddons);
    } else {
      // Add new addon
      const newAddon: TechSpecAddon = {
        id: nanoid(),
        name: formData.name,
        description: formData.description,
        priceChange: formData.priceChange,
        quantity: formData.quantity,
        unit: formData.unit,
        category: formData.category,
        imageUrl: formData.imageUrl,
        total: formData.priceChange * formData.quantity,
        addedAt: new Date().toISOString(),
        addedBy: user?.id || "unknown",
        addedByName: user?.full_name || user?.username || "Unknown"
      };
      onAddonsChange([...addons, newAddon]);
    }

    setDialogOpen(false);
  };

  const handleDeleteAddon = (addonId: string) => {
    if (confirm("Вы уверены, что хотите удалить это дополнение?")) {
      onAddonsChange(addons.filter(addon => addon.id !== addonId));
    }
  };

  const isRecentlyAdded = (addonId: string) => {
    return recentlyAdded.addons.includes(addonId);
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Дополнения и изменения</CardTitle>
            {!readOnly && (
              <Button
                size="sm"
                variant="default"
                className="h-8 gap-1"
                onClick={() => handleOpenDialog()}
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          {addons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Дополнения не добавлены. Нажмите "Добавить" для внесения изменений в исходную позицию.
            </div>
          ) : (
            <>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]"></TableHead>
                      <TableHead>Название</TableHead>
                      <TableHead className="w-32">Цена за ед.</TableHead>
                      <TableHead className="w-24">Кол-во</TableHead>
                      <TableHead className="w-32">Итого</TableHead>
                      {!readOnly && <TableHead className="w-24">Действия</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {addons.map((addon) => (
                      <TableRow
                        key={addon.id}
                        className={cn(
                          isRecentlyAdded(addon.id) &&
                            "bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500"
                        )}
                      >
                        <TableCell>
                          {addon.imageUrl && (
                            <img
                              src={addon.imageUrl}
                              alt={addon.name}
                              className="w-8 h-8 object-cover rounded"
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{addon.name}</p>
                            {addon.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {addon.description}
                              </p>
                            )}
                            {addon.category && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {addon.category}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "font-medium",
                              addon.priceChange > 0 && "text-green-600",
                              addon.priceChange < 0 && "text-red-600"
                            )}
                          >
                            {addon.priceChange > 0 ? "+" : ""}
                            {addon.priceChange.toLocaleString('ru-RU')} ₽
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {addon.quantity} {addon.unit}
                        </TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "font-semibold",
                              addon.total > 0 && "text-green-600",
                              addon.total < 0 && "text-red-600"
                            )}
                          >
                            {addon.total > 0 ? "+" : ""}
                            {addon.total.toLocaleString('ru-RU')} ₽
                          </span>
                        </TableCell>
                        {!readOnly && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => handleOpenDialog(addon)}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 hover:bg-destructive/10 hover:text-destructive"
                                onClick={() => handleDeleteAddon(addon.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Summary */}
              <div className="mt-4 space-y-2 border-t pt-4">
                {positiveTotal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Добавления:</span>
                    <span className="font-medium text-green-600">
                      +{positiveTotal.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                )}
                {negativeTotal < 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Вычитания:</span>
                    <span className="font-medium text-red-600">
                      {negativeTotal.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold pt-2 border-t">
                  <span>Итого изменений:</span>
                  <span
                    className={cn(
                      addonsTotal > 0 && "text-green-600",
                      addonsTotal < 0 && "text-red-600"
                    )}
                  >
                    {addonsTotal > 0 ? "+" : ""}
                    {addonsTotal.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingAddon ? "Редактировать дополнение" : "Добавить дополнение"}
            </DialogTitle>
            <DialogDescription>
              {editingAddon
                ? "Измените параметры дополнения"
                : "Добавьте новое дополнение или вычитание к исходной позиции"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Название *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Например: Дополнительная фурнитура"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Подробное описание дополнения"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Категория</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceChange">
                  Изменение цены за ед. (₽) *
                </Label>
                <Input
                  id="priceChange"
                  type="number"
                  step="0.01"
                  value={formData.priceChange}
                  onChange={(e) =>
                    setFormData({ ...formData, priceChange: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Положительное - добавление, отрицательное - вычитание
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantity">Количество *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: parseFloat(e.target.value) || 1 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit">Единица измерения</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger id="unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUrl">URL изображения</Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="https://example.com/image.jpg"
              />
            </div>

            {/* Preview Total */}
            <div className="p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Итого за это дополнение:</span>
                <span
                  className={cn(
                    "text-lg font-bold",
                    formData.priceChange * formData.quantity > 0 && "text-green-600",
                    formData.priceChange * formData.quantity < 0 && "text-red-600"
                  )}
                >
                  {formData.priceChange * formData.quantity > 0 ? "+" : ""}
                  {(formData.priceChange * formData.quantity).toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={handleSaveAddon}
              disabled={!formData.name || formData.priceChange === 0}
            >
              {editingAddon ? "Сохранить" : "Добавить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
