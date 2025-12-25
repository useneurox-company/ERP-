import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CustomFieldDefinition } from "@shared/schema";

export function ManageCustomFields() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null);
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<string>("text");
  const [fieldOptions, setFieldOptions] = useState("");

  const { data: definitions = [], isLoading } = useQuery<CustomFieldDefinition[]>({
    queryKey: ["/api/custom-field-definitions"],
  });

  const createField = useMutation({
    mutationFn: async (data: { name: string; field_type: string; options?: string | null }) => {
      return apiRequest("POST", "/api/custom-field-definitions", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-field-definitions"] });
      toast({
        title: "Поле создано",
        description: "Пользовательское поле успешно создано",
      });
      resetForm();
      setDialogOpen(false);
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
    mutationFn: async ({ id, data }: { id: string; data: Partial<CustomFieldDefinition> }) => {
      return apiRequest("PUT", `/api/custom-field-definitions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-field-definitions"] });
      toast({
        title: "Поле обновлено",
        description: "Пользовательское поле успешно обновлено",
      });
      resetForm();
      setDialogOpen(false);
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
      return apiRequest("DELETE", `/api/custom-field-definitions/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-field-definitions"] });
      toast({
        title: "Поле удалено",
        description: "Пользовательское поле успешно удалено",
      });
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить поле",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setEditingField(null);
    setFieldName("");
    setFieldType("text");
    setFieldOptions("");
  };

  const handleEdit = (field: CustomFieldDefinition) => {
    setEditingField(field);
    setFieldName(field.name);
    setFieldType(field.field_type);
    // Parse options - can be string (JSON) or array
    let optionsArr: string[] = [];
    if (field.options) {
      if (Array.isArray(field.options)) {
        optionsArr = field.options;
      } else if (typeof field.options === 'string') {
        try {
          const parsed = JSON.parse(field.options);
          optionsArr = Array.isArray(parsed) ? parsed : [];
        } catch {
          optionsArr = [];
        }
      }
    }
    setFieldOptions(optionsArr.join("\n"));
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!fieldName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название поля",
        variant: "destructive",
      });
      return;
    }

    const options: string | null | undefined = fieldType === "select" && fieldOptions.trim()
      ? JSON.stringify(fieldOptions.split("\n").map(opt => opt.trim()).filter(Boolean))
      : null;

    if (editingField) {
      updateField.mutate({
        id: editingField.id,
        data: {
          name: fieldName,
          field_type: fieldType as any,
          options,
        },
      });
    } else {
      createField.mutate({
        name: fieldName,
        field_type: fieldType as any,
        options,
      });
    }
  };

  const fieldTypeLabels: Record<string, string> = {
    text: "Текст",
    number: "Число",
    date: "Дата",
    checkbox: "Чекбокс",
    file: "Файл",
    select: "Список",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Пользовательские поля сделок</CardTitle>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-custom-field">
              <Plus className="h-4 w-4 mr-2" />
              Добавить поле
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingField ? "Редактировать поле" : "Создать поле"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="field-name">Название поля</Label>
                <Input
                  id="field-name"
                  value={fieldName}
                  onChange={(e) => setFieldName(e.target.value)}
                  placeholder="Например: Источник лида"
                  data-testid="input-field-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="field-type">Тип поля</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger id="field-type" data-testid="select-field-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(fieldTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {fieldType === "select" && (
                <div className="space-y-2">
                  <Label htmlFor="field-options">Варианты (по одному на строку)</Label>
                  <textarea
                    id="field-options"
                    className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md resize-none"
                    value={fieldOptions}
                    onChange={(e) => setFieldOptions(e.target.value)}
                    placeholder="Вариант 1&#10;Вариант 2&#10;Вариант 3"
                    data-testid="textarea-field-options"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDialogOpen(false);
                    resetForm();
                  }}
                  data-testid="button-cancel-field"
                >
                  Отмена
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={createField.isPending || updateField.isPending}
                  data-testid="button-save-field"
                >
                  {editingField ? "Сохранить" : "Создать"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
        ) : definitions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Нет пользовательских полей. Создайте первое поле для сделок.
          </div>
        ) : (
          <div className="space-y-2">
            {definitions.map((field) => (
              <div
                key={field.id}
                className="flex items-center justify-between p-3 rounded-md border hover-elevate"
                data-testid={`field-${field.id}`}
              >
                <div>
                  <p className="text-sm font-medium">{field.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {fieldTypeLabels[field.field_type] || field.field_type}
                    </Badge>
                    {field.options && field.options.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({field.options.length} вариантов)
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(field)}
                    data-testid={`button-edit-field-${field.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteField.mutate(field.id)}
                    disabled={deleteField.isPending}
                    data-testid={`button-delete-field-${field.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
