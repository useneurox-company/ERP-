import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Edit, Trash2, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { CustomFieldDefinition } from "@shared/schema";

interface ManageCustomFieldsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELD_TYPES = [
  { value: "text", label: "Текст" },
  { value: "number", label: "Число" },
  { value: "url", label: "Ссылка" },
  { value: "date", label: "Дата" },
  { value: "checkbox", label: "Чекбокс" },
  { value: "select", label: "Выбор из списка" },
  { value: "multiselect", label: "Множественный выбор" },
];

export function ManageCustomFieldsDialog({
  open,
  onOpenChange,
}: ManageCustomFieldsDialogProps) {
  const { toast } = useToast();
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [fieldOptions, setFieldOptions] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fieldToDelete, setFieldToDelete] = useState<CustomFieldDefinition | null>(null);

  const { data: fields = [] } = useQuery<CustomFieldDefinition[]>({
    queryKey: ["/api/custom-field-definitions"],
  });

  const createField = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/custom-field-definitions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-field-definitions"] });
      toast({
        title: "Поле создано",
        description: "Кастомное поле успешно создано",
      });
      handleCloseFieldDialog();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать поле",
        variant: "destructive",
      });
    },
  });

  const updateField = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest("PUT", `/api/custom-field-definitions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-field-definitions"] });
      toast({
        title: "Поле обновлено",
        description: "Кастомное поле успешно обновлено",
      });
      handleCloseFieldDialog();
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось обновить поле",
        variant: "destructive",
      });
    },
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/custom-field-definitions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-field-definitions"] });
      toast({
        title: "Поле удалено",
        description: "Кастомное поле успешно удалено",
      });
      setDeleteDialogOpen(false);
      setFieldToDelete(null);
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить поле",
        variant: "destructive",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingField(null);
    setFieldName("");
    setFieldType("text");
    setFieldOptions("");
    setIsRequired(false);
    setFieldDialogOpen(true);
  };

  const handleOpenEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setFieldName(field.name);
    setFieldType(field.field_type);
    // Parse options from JSON string
    if (field.options) {
      try {
        const parsed = JSON.parse(field.options);
        setFieldOptions(Array.isArray(parsed) ? parsed.join(", ") : "");
      } catch {
        setFieldOptions("");
      }
    } else {
      setFieldOptions("");
    }
    setIsRequired(field.is_required || false);
    setFieldDialogOpen(true);
  };

  const handleCloseFieldDialog = () => {
    setFieldDialogOpen(false);
    setEditingField(null);
    setFieldName("");
    setFieldType("text");
    setFieldOptions("");
    setIsRequired(false);
  };

  const handleSaveField = () => {
    if (!fieldName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название поля",
        variant: "destructive",
      });
      return;
    }

    const data: any = {
      name: fieldName,
      field_type: fieldType,
      is_required: isRequired,
      order: fields.length,
    };

    if (fieldType === "select" || fieldType === "multiselect") {
      const options = fieldOptions
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);

      if (options.length === 0) {
        toast({
          title: "Ошибка",
          description: "Введите хотя бы одну опцию",
          variant: "destructive",
        });
        return;
      }

      data.options = JSON.stringify(options);
    }

    if (editingField) {
      updateField.mutate({ id: editingField.id, data });
    } else {
      createField.mutate(data);
    }
  };

  const handleDeleteClick = (field: CustomFieldDefinition) => {
    setFieldToDelete(field);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (fieldToDelete) {
      deleteField.mutate(fieldToDelete.id);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Настройка кастомных полей</DialogTitle>
            <DialogDescription>
              Настройте дополнительные поля для сделок. Изменения применяются ко всем сделкам.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="mb-4">Нет кастомных полей</p>
                <Button onClick={handleOpenCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить поле
                </Button>
              </div>
            ) : (
              <>
                {fields.map((field) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{field.name}</span>
                          {field.is_required && (
                            <span className="text-xs text-destructive">*</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {FIELD_TYPES.find((t) => t.value === field.field_type)?.label}
                          {field.options && ` • ${JSON.parse(field.options).length} опций`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleOpenEdit(field)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeleteClick(field)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Button onClick={handleOpenCreate} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить поле
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Field Create/Edit Dialog */}
      <Dialog open={fieldDialogOpen} onOpenChange={setFieldDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingField ? "Редактировать поле" : "Создать поле"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="field-name">Название поля</Label>
              <Input
                id="field-name"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="Например: Источник лида"
              />
            </div>

            <div>
              <Label htmlFor="field-type">Тип поля</Label>
              <Select value={fieldType} onValueChange={setFieldType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(fieldType === "select" || fieldType === "multiselect") && (
              <div>
                <Label htmlFor="field-options">Опции (через запятую)</Label>
                <Input
                  id="field-options"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                  placeholder="Опция 1, Опция 2, Опция 3"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-required"
                checked={isRequired}
                onCheckedChange={(checked) => setIsRequired(!!checked)}
              />
              <Label htmlFor="is-required" className="cursor-pointer">
                Обязательное поле
              </Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={handleCloseFieldDialog}>
              Отмена
            </Button>
            <Button onClick={handleSaveField}>
              {editingField ? "Сохранить" : "Создать"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить поле?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить поле "{fieldToDelete?.name}"? Все данные в этом поле будут удалены из всех сделок.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
