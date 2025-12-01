import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Save } from "lucide-react";
import type { ProjectStage } from "@shared/schema";

interface User {
  id: string;
  username: string;
  full_name?: string;
}

interface BasicStageData {
  assignee_id?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  notes?: string;
}

interface BasicStageFormProps {
  stage: ProjectStage;
  stageTypeIcon: string;
  stageTypeName: string;
  borderColor: string;
  onDataChange: (data: BasicStageData) => void;
  readOnly?: boolean;
}

export function BasicStageForm({
  stage,
  stageTypeIcon,
  stageTypeName,
  borderColor,
  onDataChange,
  readOnly = false
}: BasicStageFormProps) {
  const [formData, setFormData] = useState<BasicStageData>(() => {
    try {
      return stage.type_data ? JSON.parse(stage.type_data as string) : {};
    } catch {
      return {};
    }
  });

  const [plannedStartDate, setPlannedStartDate] = useState<Date | undefined>(
    stage.planned_start_date ? new Date(stage.planned_start_date) :
    formData.planned_start_date ? new Date(formData.planned_start_date) : undefined
  );

  const [plannedEndDate, setPlannedEndDate] = useState<Date | undefined>(
    stage.planned_end_date ? new Date(stage.planned_end_date) :
    formData.planned_end_date ? new Date(formData.planned_end_date) : undefined
  );

  const [hasChanges, setHasChanges] = useState(false);

  // Загружаем список пользователей
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  useEffect(() => {
    try {
      const parsed = stage.type_data ? JSON.parse(stage.type_data as string) : {};
      setFormData(parsed);
    } catch {
      setFormData({});
    }
  }, [stage.type_data]);

  const handleFieldChange = (field: keyof BasicStageData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setHasChanges(true);
  };

  const handleStartDateChange = (date: Date | undefined) => {
    setPlannedStartDate(date);
    handleFieldChange('planned_start_date', date?.toISOString());
  };

  const handleEndDateChange = (date: Date | undefined) => {
    setPlannedEndDate(date);
    handleFieldChange('planned_end_date', date?.toISOString());
  };

  const handleSave = () => {
    onDataChange(formData);
    setHasChanges(false);
  };

  return (
    <Card className={cn("border-l-4", borderColor)}>
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{stageTypeIcon}</span>
          <CardTitle className="text-base">{stageTypeName}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Исполнитель */}
        <div className="space-y-2">
          <Label htmlFor="assignee" className="text-sm font-medium">
            Исполнитель
          </Label>
          <Select
            value={formData.assignee_id || stage.assignee_id || ""}
            onValueChange={(value) => handleFieldChange('assignee_id', value || undefined)}
            disabled={readOnly}
          >
            <SelectTrigger id="assignee" className="text-sm">
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
        </div>

        {/* Плановые даты */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Плановая дата начала</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !plannedStartDate && "text-muted-foreground"
                  )}
                  disabled={readOnly}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
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

          <div className="space-y-2">
            <Label className="text-sm font-medium">Плановая дата окончания</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !plannedEndDate && "text-muted-foreground"
                  )}
                  disabled={readOnly}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
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
        </div>

        {/* Длительность */}
        {plannedStartDate && plannedEndDate && (
          <div className="p-3 bg-accent rounded-md">
            <p className="text-sm font-medium">
              Длительность: {Math.ceil((plannedEndDate.getTime() - plannedStartDate.getTime()) / (1000 * 60 * 60 * 24))} дней
            </p>
          </div>
        )}

        {/* Примечания */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="text-sm font-medium">
            Примечания
          </Label>
          <Textarea
            id="notes"
            value={formData.notes || ""}
            onChange={(e) => handleFieldChange('notes', e.target.value)}
            placeholder="Дополнительные детали для этого этапа..."
            rows={4}
            disabled={readOnly}
            className="text-sm"
          />
        </div>

        {/* Кнопка сохранения */}
        {!readOnly && hasChanges && (
          <Button
            onClick={handleSave}
            className="w-full"
            size="sm"
          >
            <Save className="w-4 h-4 mr-2" />
            Сохранить изменения
          </Button>
        )}

        {readOnly && (
          <div className="text-xs text-muted-foreground bg-accent p-2 rounded">
            ℹ️ Этап завершен. Редактирование недоступно.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
