import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { BasicStageTypeForm } from "./BasicStageTypeForm";

export interface TemplateStageTypeData {
  // Для замера
  address?: string;
  cost?: number;
  measurement_date?: string;
  notes?: string;

  // Для Согласования, Снабжения, Производства, Монтажа
  assignee_id?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  duration_days?: number;

  // Для других типов - можно расширить
  [key: string]: any;
}

interface TemplateStageTypeFormProps {
  stageTypeCode: string;
  stageTypeName: string;
  data?: TemplateStageTypeData;
  onChange: (data: TemplateStageTypeData) => void;
}

export function TemplateStageTypeForm({
  stageTypeCode,
  stageTypeName,
  data = {},
  onChange
}: TemplateStageTypeFormProps) {
  const [formData, setFormData] = useState<TemplateStageTypeData>(data);
  const [measurementDate, setMeasurementDate] = useState<Date | undefined>(
    data.measurement_date ? new Date(data.measurement_date) : undefined
  );

  // Синхронизируем внешние изменения data
  useEffect(() => {
    setFormData(data);
    if (data.measurement_date) {
      setMeasurementDate(new Date(data.measurement_date));
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

  const handleDateChange = (date: Date | undefined) => {
    setMeasurementDate(date);
    handleFieldChange('measurement_date', date?.toISOString());
  };

  // Форма для типа "Замер"
  if (stageTypeCode === 'measurement') {
    return (
      <div className="space-y-4 p-4 bg-muted/30 rounded-lg border-l-4 border-blue-500">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-2xl">📏</span>
          <div>
            <h4 className="font-semibold text-sm">Специфичные поля для замера</h4>
            <p className="text-xs text-muted-foreground">Укажите шаблонные значения для замеров</p>
          </div>
        </div>

        {/* Адрес объекта */}
        <div className="space-y-2">
          <Label htmlFor="template-address" className="text-xs">
            Адрес объекта (пример)
          </Label>
          <Input
            id="template-address"
            value={formData.address || ""}
            onChange={(e) => handleFieldChange('address', e.target.value)}
            placeholder="Например: г. Москва, ул. Ленина, д. 10"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Этот адрес будет подсказкой при создании реального этапа замера
          </p>
        </div>

        {/* Дата замера */}
        <div className="space-y-2">
          <Label className="text-xs">Плановая дата замера (пример)</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "w-full justify-start text-left font-normal text-sm",
                  !measurementDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {measurementDate ? format(measurementDate, "dd.MM.yyyy") : "Выберите дату"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={measurementDate}
                onSelect={handleDateChange}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Стоимость замера */}
        <div className="space-y-2">
          <Label htmlFor="template-cost" className="text-xs">
            Стоимость замера (₽)
          </Label>
          <Input
            id="template-cost"
            type="number"
            min="0"
            step="0.01"
            value={formData.cost || ""}
            onChange={(e) => handleFieldChange('cost', parseFloat(e.target.value) || undefined)}
            placeholder="0.00"
            className="text-sm"
          />
        </div>

        {/* Примечания */}
        <div className="space-y-2">
          <Label htmlFor="template-notes" className="text-xs">
            Примечания к замеру
          </Label>
          <Textarea
            id="template-notes"
            value={formData.notes || ""}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            placeholder="Укажите важные детали для замерщика..."
            rows={3}
            className="text-sm"
          />
        </div>

        <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950/20 p-2 rounded">
          💡 Эти данные - шаблон для замерщика. В реальном проекте он сможет загрузить фото, видео и аудио.
        </div>
      </div>
    );
  }

  // Форма для этапа "Согласование"
  if (stageTypeCode === 'approval') {
    return (
      <BasicStageTypeForm
        stageTypeCode={stageTypeCode}
        stageTypeName={stageTypeName}
        stageTypeIcon="✅"
        borderColor="border-green-500"
        data={data}
        onChange={onChange}
      />
    );
  }

  // Форма для этапа "Снабжение"
  if (stageTypeCode === 'procurement') {
    return (
      <BasicStageTypeForm
        stageTypeCode={stageTypeCode}
        stageTypeName={stageTypeName}
        stageTypeIcon="📦"
        borderColor="border-purple-500"
        data={data}
        onChange={onChange}
      />
    );
  }

  // Форма для этапа "Производство"
  if (stageTypeCode === 'production') {
    return (
      <BasicStageTypeForm
        stageTypeCode={stageTypeCode}
        stageTypeName={stageTypeName}
        stageTypeIcon="🏭"
        borderColor="border-orange-500"
        data={data}
        onChange={onChange}
      />
    );
  }

  // Форма для этапа "Монтаж"
  if (stageTypeCode === 'installation') {
    return (
      <BasicStageTypeForm
        stageTypeCode={stageTypeCode}
        stageTypeName={stageTypeName}
        stageTypeIcon="🔨"
        borderColor="border-yellow-500"
        data={data}
        onChange={onChange}
      />
    );
  }

  // Для остальных типов этапов - пока заглушка
  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border-l-4 border-gray-400">
      <div className="flex items-center gap-2 mb-3">
        <div>
          <h4 className="font-semibold text-sm">Тип: {stageTypeName}</h4>
          <p className="text-xs text-muted-foreground">
            Специализированная форма для этого типа будет добавлена позже
          </p>
        </div>
      </div>

      <div className="text-xs text-muted-foreground bg-accent p-3 rounded">
        Пока для этого типа этапа нет специальных полей. Используйте стандартные поля выше.
      </div>
    </div>
  );
}
