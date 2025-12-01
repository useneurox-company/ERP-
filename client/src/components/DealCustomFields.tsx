import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Edit2, Check, X, Upload as UploadIcon, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CustomFieldDefinition, User } from "@shared/schema";

interface DealCustomFieldValue {
  id: string;
  deal_id: string;
  field_definition_id: string;
  value: string | null;
  created_at: string;
  field_name: string;
  field_type: string;
  options?: string[];
}

interface DealCustomFieldsProps {
  dealId: string | null;
}

export function DealCustomFields({ dealId }: DealCustomFieldsProps) {
  const { toast } = useToast();
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  // Helper function to parse options from JSON string
  const parseOptions = (options: string | null | undefined): string[] => {
    if (!options) return [];
    try {
      const parsed = JSON.parse(options);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const { data: definitions = [] } = useQuery<CustomFieldDefinition[]>({
    queryKey: ["/api/custom-field-definitions"],
  });

  const { data: fieldValues = [] } = useQuery<DealCustomFieldValue[]>({
    queryKey: ["/api/deals", dealId, "custom-fields"],
    enabled: !!dealId,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const saveField = useMutation({
    mutationFn: async ({
      fieldDefinitionId,
      value,
    }: {
      fieldDefinitionId: string;
      value: string;
    }) => {
      if (!dealId) throw new Error("No deal ID");
      return apiRequest("POST", `/api/deals/${dealId}/custom-fields`, {
        field_definition_id: fieldDefinitionId,
        value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/deals", dealId, "custom-fields"],
      });
      toast({
        title: "Поле сохранено",
        description: "Значение успешно сохранено",
      });
      setEditingFieldId(null);
      setEditValue("");
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось сохранить значение",
        variant: "destructive",
      });
    },
  });

  const handleStartEdit = (fieldId: string, currentValue: string | null) => {
    setEditingFieldId(fieldId);
    setEditValue(currentValue || "");
  };

  const handleSave = (fieldDefinitionId: string) => {
    saveField.mutate({ fieldDefinitionId, value: editValue });
  };

  const handleCancel = () => {
    setEditingFieldId(null);
    setEditValue("");
  };

  const getDisplayValue = (definition: CustomFieldDefinition, value: string | null): string => {
    if (!value) return "—";

    switch (definition.field_type) {
      case "checkbox":
        return value === "true" ? "Да" : "Нет";
      case "user": {
        const user = users.find(u => u.id === value);
        return user?.username || value;
      }
      case "currency": {
        try {
          const parsed = JSON.parse(value);
          return `${parsed.amount} ${parsed.currency}`;
        } catch {
          return value;
        }
      }
      case "multiselect": {
        try {
          const selected = JSON.parse(value);
          return Array.isArray(selected) ? selected.join(", ") : value;
        } catch {
          return value;
        }
      }
      case "rating": {
        return "★".repeat(parseInt(value) || 0) + "☆".repeat(5 - (parseInt(value) || 0));
      }
      case "progress": {
        return `${value}%`;
      }
      default:
        return value;
    }
  };

  const renderFieldEditor = (definition: CustomFieldDefinition, currentValue?: DealCustomFieldValue) => {
    const isEditing = editingFieldId === definition.id;
    const displayValue = getDisplayValue(definition, currentValue?.value || null);

    if (!isEditing) {
      return (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm" data-testid={`field-value-${definition.id}`}>
            {displayValue}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => handleStartEdit(definition.id, currentValue?.value || null)}
            data-testid={`button-edit-${definition.id}`}
          >
            <Edit2 className="h-3 w-3" />
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {definition.field_type === "text" && (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Введите значение"
            className="h-8 text-sm"
            data-testid={`input-${definition.id}`}
          />
        )}

        {definition.field_type === "number" && (
          <Input
            type="number"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Введите число"
            className="h-8 text-sm"
            data-testid={`input-${definition.id}`}
          />
        )}

        {definition.field_type === "date" && (
          <Input
            type="date"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="h-8 text-sm"
            data-testid={`input-${definition.id}`}
          />
        )}

        {definition.field_type === "checkbox" && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={editValue === "true"}
              onCheckedChange={(checked) => setEditValue(checked ? "true" : "false")}
              data-testid={`checkbox-${definition.id}`}
            />
            <Label className="text-sm">Да</Label>
          </div>
        )}

        {definition.field_type === "textarea" && (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Введите текст"
            className="min-h-[80px] text-sm"
            data-testid={`textarea-${definition.id}`}
          />
        )}

        {definition.field_type === "email" && (
          <Input
            type="email"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="email@example.com"
            className="h-8 text-sm"
            data-testid={`input-${definition.id}`}
          />
        )}

        {definition.field_type === "phone" && (
          <Input
            type="tel"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="+7 (999) 123-45-67"
            className="h-8 text-sm"
            data-testid={`input-${definition.id}`}
          />
        )}

        {definition.field_type === "url" && (
          <Input
            type="url"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="https://example.com"
            className="h-8 text-sm"
            data-testid={`input-${definition.id}`}
          />
        )}

        {definition.field_type === "currency" && (() => {
          let currencyData = { amount: "", currency: "₽" };
          try {
            currencyData = editValue ? JSON.parse(editValue) : { amount: "", currency: "₽" };
          } catch {}
          return (
            <div className="flex gap-2">
              <Input
                type="number"
                value={currencyData.amount}
                onChange={(e) => {
                  setEditValue(JSON.stringify({ amount: e.target.value, currency: currencyData.currency }));
                }}
                placeholder="Сумма"
                className="h-8 text-sm flex-1"
                data-testid={`input-amount-${definition.id}`}
              />
              <Select
                value={currencyData.currency}
                onValueChange={(currency) => {
                  setEditValue(JSON.stringify({ amount: currencyData.amount, currency }));
                }}
              >
                <SelectTrigger className="h-8 text-sm w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="₽">₽</SelectItem>
                  <SelectItem value="$">$</SelectItem>
                  <SelectItem value="€">€</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        })()}

        {definition.field_type === "select" && definition.options && (
          <Select value={editValue} onValueChange={setEditValue}>
            <SelectTrigger className="h-8 text-sm" data-testid={`select-${definition.id}`}>
              <SelectValue placeholder="Выберите значение" />
            </SelectTrigger>
            <SelectContent>
              {parseOptions(definition.options).filter(Boolean).map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {definition.field_type === "multiselect" && definition.options && (() => {
          let selected: string[] = [];
          try {
            selected = editValue ? JSON.parse(editValue) : [];
            if (!Array.isArray(selected)) selected = [];
          } catch {}
          return (
            <div className="space-y-1">
              {parseOptions(definition.options).filter(Boolean).map((option) => {
                const isChecked = selected.includes(option);
                return (
                  <div key={option} className="flex items-center gap-2">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        const updated = checked
                          ? [...selected, option]
                          : selected.filter((o: string) => o !== option);
                        setEditValue(JSON.stringify(updated));
                      }}
                    />
                    <Label className="text-sm">{option}</Label>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {definition.field_type === "user" && (
          <Select value={editValue} onValueChange={setEditValue}>
            <SelectTrigger className="h-8 text-sm" data-testid={`select-user-${definition.id}`}>
              <SelectValue placeholder="Выберите пользователя" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {definition.field_type === "rating" && (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setEditValue(star.toString())}
                className="text-2xl hover:scale-110 transition-transform"
              >
                {parseInt(editValue) >= star ? "★" : "☆"}
              </button>
            ))}
          </div>
        )}

        {definition.field_type === "progress" && (
          <div className="space-y-2">
            <Input
              type="range"
              min="0"
              max="100"
              value={editValue || "0"}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full"
            />
            <div className="text-sm text-center">{editValue || 0}%</div>
          </div>
        )}

        {definition.field_type === "color" && (
          <div className="flex gap-2 items-center">
            <Input
              type="color"
              value={editValue || "#000000"}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-10 w-20"
            />
            <Input
              type="text"
              value={editValue || ""}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="#000000"
              className="h-8 text-sm flex-1"
            />
          </div>
        )}

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleSave(definition.id)}
            disabled={saveField.isPending}
            className="h-7 px-2"
            data-testid={`button-save-${definition.id}`}
          >
            <Check className="h-3 w-3 mr-1" />
            Сохранить
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCancel}
            className="h-7 px-2"
            data-testid={`button-cancel-${definition.id}`}
          >
            <X className="h-3 w-3 mr-1" />
            Отмена
          </Button>
        </div>
      </div>
    );
  };

  if (!dealId || definitions.length === 0) {
    return null; // Don't show section if no deal ID or no custom fields are defined
  }

  return (
    <div className="mb-4">
      <p className="text-sm font-medium mb-2">Дополнительные поля</p>
      <div className="space-y-3">
        {definitions.map((definition) => {
          const currentValue = fieldValues.find(
            (fv) => fv.field_definition_id === definition.id
          );
          return (
            <div key={definition.id} data-testid={`custom-field-${definition.id}`}>
              <Label className="text-xs text-muted-foreground">
                {definition.name}
              </Label>
              {renderFieldEditor(definition, currentValue)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
