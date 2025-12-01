import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { TemplateStageTypeData } from "./TemplateStageTypeForm";

interface User {
  id: string;
  username: string;
  full_name?: string;
}

interface BasicStageTypeFormProps {
  stageTypeCode: string;
  stageTypeName: string;
  stageTypeIcon: string;
  borderColor: string;
  data?: TemplateStageTypeData;
  onChange: (data: TemplateStageTypeData) => void;
}

export function BasicStageTypeForm({
  stageTypeCode,
  stageTypeName,
  stageTypeIcon,
  borderColor,
  data = {},
  onChange
}: BasicStageTypeFormProps) {
  const [formData, setFormData] = useState<TemplateStageTypeData>(data);
  const [plannedStartDate, setPlannedStartDate] = useState<Date | undefined>(
    data.planned_start_date ? new Date(data.planned_start_date) : undefined
  );
  const [plannedEndDate, setPlannedEndDate] = useState<Date | undefined>(
    data.planned_end_date ? new Date(data.planned_end_date) : undefined
  );

  // Загружаем список пользователей для выбора исполнителя
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Синхронизируем внешние изменения data
  useEffect(() => {
    setFormData(data);
    if (data.planned_start_date) {
      setPlannedStartDate(new Date(data.planned_start_date));
    }
    if (data.planned_end_date) {
      setPlannedEndDate(new Date(data.planned_end_date));
    }
  }, [data]);

  const handleFieldChange = (field: keyof TemplateStageTypeData, value: any) => {
    const updatedData = {
      ...formData,
      [field]: value,
    };
    setFormData(updatedData);
    onChange(updatedData);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setPlannedStartDate(date);
    handleFieldChange('planned_start_date', date?.toISOString());
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setPlannedEndDate(date);
    handleFieldChange('planned_end_date', date?.toISOString());
  };

  return (
    <div className={cn("space-y-4 p-4 bg-muted/30 rounded-lg border-l-4", borderColor)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{stageTypeIcon}</span>
        <div>
          <h4 className="font-semibold text-sm">Специфичные поля для {stageTypeName.toLowerCase()}</h4>
          <p className="text-xs text-muted-foreground">Базовые параметры этапа</p>
        </div>
      </div>

      {/* Исполнитель */}
      <div className="space-y-2">
        <Label htmlFor={`${stageTypeCode}-assignee`} className="text-xs">
          Исполнитель (по умолчанию)
        </Label>
        <Select
          value={formData.assignee_id || ""}
          onValueChange={(value) => handleFieldChange('assignee_id', value || undefined)}
        >
          <SelectTrigger id={`${stageTypeCode}-assignee`} className="text-sm">
            <SelectValue placeholder="Выберите исполнителя" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Не назначен</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.full_name || user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Этот исполнитель будет назначен автоматически при создании этапа
        </p>
      </div>

      {/* Плановая дата начала */}
      <div className="space-y-2">
        <Label className="text-xs">Плановая дата начала</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-full justify-start text-left font-normal text-sm",
                !plannedStartDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {plannedStartDate ? format(plannedStartDate, "dd.MM.yyyy") : "Выберите дату"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={plannedStartDate}
              onSelect={handleStartDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Плановая дата окончания */}
      <div className="space-y-2">
        <Label className="text-xs">Плановая дата окончания</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "w-full justify-start text-left font-normal text-sm",
                !plannedEndDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-3 w-3" />
              {plannedEndDate ? format(plannedEndDate, "dd.MM.yyyy") : "Выберите дату"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={plannedEndDate}
              onSelect={handleEndDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Длительность (вычисляемая) */}
      {plannedStartDate && plannedEndDate && (
        <div className="space-y-2">
          <Label className="text-xs">Длительность (дней)</Label>
          <div className="text-sm font-medium p-2 bg-accent rounded">
            {Math.ceil((plannedEndDate.getTime() - plannedStartDate.getTime()) / (1000 * 60 * 60 * 24))} дней
          </div>
        </div>
      )}

      {/* Примечания */}
      <div className="space-y-2">
        <Label htmlFor={`${stageTypeCode}-notes`} className="text-xs">
          Примечания
        </Label>
        <Textarea
          id={`${stageTypeCode}-notes`}
          value={formData.notes || ""}
          onChange={(e) => handleFieldChange('notes', e.target.value)}
          placeholder="Укажите дополнительные детали для этого этапа..."
          rows={3}
          className="text-sm"
        />
      </div>

      <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
        💡 Эти данные - шаблон для этапа. В реальном проекте можно будет изменить исполнителя и сроки.
      </div>
    </div>
  );
}
