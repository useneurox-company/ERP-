import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus,
  Truck,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  FileText,
  MapPin,
  Clock,
  Star
} from "lucide-react";
import type { ProjectStage, Installation } from "@shared/schema";
import type {
  InstallationStageData,
  InstallationStatus,
  InstallationPhoto,
  InstallationDefect,
  ShipmentItem
} from "@/types/installation";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { nanoid } from "nanoid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface InstallationStageFormProps {
  stage: ProjectStage;
  projectId: string;
  onDataChange: (data: InstallationStageData) => void;
  readOnly?: boolean;
}

interface User {
  id: string;
  username: string;
  full_name?: string;
}

export function InstallationStageForm({
  stage,
  projectId,
  onDataChange,
  readOnly = false
}: InstallationStageFormProps) {
  const { toast } = useToast();

  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  // Инициализация данных формы
  const [formData, setFormData] = useState<InstallationStageData>(() => {
    try {
      const parsed = stage.type_data ? JSON.parse(stage.type_data as string) : {};
      return {
        shipment_completed: false,
        installation_status: 'not_started',
        photos: [],
        photos_before_count: 0,
        photos_after_count: 0,
        defects: [],
        has_critical_defects: false,
        client_accepted: false,
        ...parsed,
      };
    } catch {
      return {
        shipment_completed: false,
        installation_status: 'not_started',
        photos: [],
        photos_before_count: 0,
        photos_after_count: 0,
        defects: [],
        has_critical_defects: false,
        client_accepted: false,
      };
    }
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Загружаем монтажи для проекта
  const { data: installations = [] } = useQuery<Installation[]>({
    queryKey: ['/api/installations', projectId],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/installations?project_id=${projectId}`);
      return response;
    }
  });

  // Загружаем пользователей
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  // Обработчик изменения данных
  const handleFieldChange = (updates: Partial<InstallationStageData>) => {
    setFormData(prev => ({
      ...prev,
      ...updates,
    }));
    setHasChanges(true);
  };

  // Сохранение изменений
  const handleSave = () => {
    onDataChange(formData);
    setHasChanges(false);
  };

  // Получаем имя пользователя по ID
  const getUserName = (userId?: string | null) => {
    if (!userId) return 'Не назначен';
    const foundUser = users.find(u => u.id === userId);
    return foundUser?.full_name || foundUser?.username || 'Неизвестно';
  };

  // Статусы монтажа
  const statusLabels: Record<InstallationStatus, string> = {
    not_started: 'Не начат',
    scheduled: 'Запланирован',
    in_transit: 'Выезд на объект',
    in_progress: 'Монтаж в процессе',
    completed: 'Завершен',
    accepted: 'Принято клиентом',
  };

  const statusColors: Record<InstallationStatus, string> = {
    not_started: 'bg-gray-100 text-gray-700',
    scheduled: 'bg-blue-100 text-blue-700',
    in_transit: 'bg-yellow-100 text-yellow-700',
    in_progress: 'bg-orange-100 text-orange-700',
    completed: 'bg-green-100 text-green-700',
    accepted: 'bg-emerald-100 text-emerald-700',
  };

  // Вычисляем прогресс
  const getProgressPercentage = (): number => {
    const statusProgress: Record<InstallationStatus, number> = {
      not_started: 0,
      scheduled: 20,
      in_transit: 40,
      in_progress: 60,
      completed: 80,
      accepted: 100,
    };
    return statusProgress[formData.installation_status] || 0;
  };

  // Добавление элемента отгрузки
  const [newShipmentItem, setNewShipmentItem] = useState<Partial<ShipmentItem>>({});
  const [shipmentDialogOpen, setShipmentDialogOpen] = useState(false);

  const handleAddShipmentItem = () => {
    if (!newShipmentItem.item_name || !newShipmentItem.quantity || !newShipmentItem.unit) {
      toast({
        description: 'Заполните все обязательные поля',
        variant: 'destructive',
      });
      return;
    }

    const item: ShipmentItem = {
      id: nanoid(),
      item_name: newShipmentItem.item_name,
      quantity: newShipmentItem.quantity,
      unit: newShipmentItem.unit,
      notes: newShipmentItem.notes,
    };

    if (!formData.shipment) {
      handleFieldChange({
        shipment: {
          id: nanoid(),
          shipment_date: new Date().toISOString(),
          received_by: stage.assignee_id || '',
          received_by_name: getUserName(stage.assignee_id),
          items: [item],
          warehouse_confirmed: false,
        },
      });
    } else {
      handleFieldChange({
        shipment: {
          ...formData.shipment,
          items: [...formData.shipment.items, item],
        },
      });
    }

    setNewShipmentItem({});
    setShipmentDialogOpen(false);
  };

  // Добавление дефекта
  const [newDefect, setNewDefect] = useState<Partial<InstallationDefect>>({});
  const [defectDialogOpen, setDefectDialogOpen] = useState(false);

  const handleAddDefect = () => {
    if (!newDefect.description || !newDefect.severity) {
      toast({
        description: 'Заполните описание и серьезность дефекта',
        variant: 'destructive',
      });
      return;
    }

    const defect: InstallationDefect = {
      id: nanoid(),
      description: newDefect.description,
      severity: newDefect.severity as 'minor' | 'major' | 'critical',
      photo_urls: [],
      reported_at: new Date().toISOString(),
      reported_by: user?.id || '',
      reported_by_name: user?.full_name || user?.username || 'Неизвестно',
      status: 'reported',
    };

    handleFieldChange({
      defects: [...formData.defects, defect],
      has_critical_defects: defect.severity === 'critical' || formData.has_critical_defects,
    });

    setNewDefect({});
    setDefectDialogOpen(false);
  };

  // Получить цвет серьезности дефекта
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'minor': return 'bg-yellow-100 text-yellow-700';
      case 'major': return 'bg-orange-100 text-orange-700';
      case 'critical': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'minor': return 'Незначительный';
      case 'major': return 'Серьезный';
      case 'critical': return 'Критический';
      default: return severity;
    }
  };

  return (
    <Card className="border-l-4 border-yellow-500">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔨</span>
          <CardTitle className="text-base">Монтаж</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Общий статус и прогресс */}
        <Card className="border-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Статус монтажа
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Текущий статус</Label>
              <Select
                value={formData.installation_status}
                onValueChange={(value) => handleFieldChange({ installation_status: value as InstallationStatus })}
                disabled={readOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Badge className={statusColors[formData.installation_status]}>
                {statusLabels[formData.installation_status]}
              </Badge>
              <span className="text-sm font-bold">{getProgressPercentage()}%</span>
            </div>
            <Progress value={getProgressPercentage()} className="h-3" />

            {formData.client_accepted && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-md">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Работы приняты клиентом</span>
                </div>
                {formData.client_acceptance_date && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Дата принятия: {new Date(formData.client_acceptance_date).toLocaleDateString('ru-RU')}
                  </p>
                )}
              </div>
            )}

            {formData.has_critical_defects && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Обнаружены критические дефекты</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Вкладки */}
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Информация</TabsTrigger>
            <TabsTrigger value="shipment">
              Отгрузка ({formData.shipment?.items.length || 0})
            </TabsTrigger>
            <TabsTrigger value="photos">
              Фото ({formData.photos.length})
            </TabsTrigger>
            <TabsTrigger value="defects">
              Дефекты ({formData.defects.length})
            </TabsTrigger>
          </TabsList>

          {/* Вкладка: Информация */}
          <TabsContent value="info" className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Монтажник</Label>
                <Select
                  value={formData.assignee_id || ''}
                  onValueChange={(value) => handleFieldChange({ assignee_id: value })}
                  disabled={readOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите монтажника" />
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

              <div>
                <Label>Плановая дата монтажа</Label>
                <Input
                  type="date"
                  value={formData.planned_start_date?.split('T')[0] || ''}
                  onChange={(e) => handleFieldChange({ planned_start_date: new Date(e.target.value).toISOString() })}
                  disabled={readOnly}
                />
              </div>
            </div>

            {formData.installation_location && (
              <div className="p-3 bg-accent rounded-md">
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4" />
                  <span className="text-sm font-medium">Адрес объекта</span>
                </div>
                <p className="text-sm">{formData.installation_location.address}</p>
              </div>
            )}

            <div>
              <Label>Примечания</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => handleFieldChange({ notes: e.target.value })}
                placeholder="Особенности монтажа, требования..."
                rows={4}
                disabled={readOnly}
              />
            </div>

            {formData.client_feedback && (
              <div>
                <Label>Отзыв клиента</Label>
                <div className="p-3 bg-accent rounded-md">
                  <p className="text-sm">{formData.client_feedback}</p>
                  {formData.client_rating && (
                    <div className="flex items-center gap-1 mt-2">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${i < formData.client_rating! ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Вкладка: Отгрузка */}
          <TabsContent value="shipment" className="space-y-3">
            {!readOnly && (
              <Dialog open={shipmentDialogOpen} onOpenChange={setShipmentDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить позицию
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Добавить позицию отгрузки</DialogTitle>
                    <DialogDescription>
                      Укажите что отгружается со склада для монтажа
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Наименование *</Label>
                      <Input
                        value={newShipmentItem.item_name || ''}
                        onChange={(e) => setNewShipmentItem({ ...newShipmentItem, item_name: e.target.value })}
                        placeholder="Например: Кухонный гарнитур"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Количество *</Label>
                        <Input
                          type="number"
                          value={newShipmentItem.quantity || ''}
                          onChange={(e) => setNewShipmentItem({ ...newShipmentItem, quantity: parseInt(e.target.value) || 0 })}
                          placeholder="1"
                        />
                      </div>
                      <div>
                        <Label>Единица *</Label>
                        <Input
                          value={newShipmentItem.unit || ''}
                          onChange={(e) => setNewShipmentItem({ ...newShipmentItem, unit: e.target.value })}
                          placeholder="шт"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Примечания</Label>
                      <Textarea
                        value={newShipmentItem.notes || ''}
                        onChange={(e) => setNewShipmentItem({ ...newShipmentItem, notes: e.target.value })}
                        placeholder="Дополнительные детали..."
                        rows={2}
                      />
                    </div>
                    <Button onClick={handleAddShipmentItem} className="w-full">
                      Добавить
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {formData.shipment && formData.shipment.items.length > 0 ? (
              <>
                {formData.shipment.warehouse_confirmed && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">Отгрузка подтверждена складом</span>
                    </div>
                  </div>
                )}

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Наименование</TableHead>
                        <TableHead className="text-right">Количество</TableHead>
                        <TableHead>Примечания</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formData.shipment.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
                          <TableCell className="text-right">
                            {item.quantity} {item.unit}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет позиций для отгрузки</p>
                <p className="text-xs mt-1">Добавьте что нужно отгрузить со склада</p>
              </div>
            )}
          </TabsContent>

          {/* Вкладка: Фото */}
          <TabsContent value="photos" className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-accent rounded-md text-center">
                <p className="text-xs text-muted-foreground">До монтажа</p>
                <p className="text-2xl font-bold">{formData.photos_before_count}</p>
              </div>
              <div className="p-3 bg-accent rounded-md text-center">
                <p className="text-xs text-muted-foreground">В процессе</p>
                <p className="text-2xl font-bold">
                  {formData.photos.filter(p => p.type === 'during').length}
                </p>
              </div>
              <div className="p-3 bg-accent rounded-md text-center">
                <p className="text-xs text-muted-foreground">После монтажа</p>
                <p className="text-2xl font-bold">{formData.photos_after_count}</p>
              </div>
            </div>

            {formData.photos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Нет фотографий</p>
                <p className="text-xs mt-1">Загрузите фото до, во время и после монтажа</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.photos.map((photo) => (
                  <div key={photo.id} className="p-3 border rounded-md">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className="text-xs">
                          {photo.type === 'before' ? 'До' : photo.type === 'after' ? 'После' : 'В процессе'}
                        </Badge>
                        {photo.description && (
                          <p className="text-sm mt-1">{photo.description}</p>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(photo.uploaded_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Вкладка: Дефекты */}
          <TabsContent value="defects" className="space-y-3">
            {!readOnly && (
              <Dialog open={defectDialogOpen} onOpenChange={setDefectDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="w-full" variant="destructive">
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Зарегистрировать дефект
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Зарегистрировать дефект</DialogTitle>
                    <DialogDescription>
                      Опишите обнаруженный дефект при монтаже
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Описание проблемы *</Label>
                      <Textarea
                        value={newDefect.description || ''}
                        onChange={(e) => setNewDefect({ ...newDefect, description: e.target.value })}
                        placeholder="Подробное описание дефекта..."
                        rows={4}
                      />
                    </div>
                    <div>
                      <Label>Серьезность *</Label>
                      <Select
                        value={newDefect.severity}
                        onValueChange={(value) => setNewDefect({ ...newDefect, severity: value as any })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите серьезность" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minor">Незначительный</SelectItem>
                          <SelectItem value="major">Серьезный</SelectItem>
                          <SelectItem value="critical">Критический</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddDefect} className="w-full" variant="destructive">
                      Зарегистрировать
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {formData.defects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50 text-green-500" />
                <p className="text-sm">Дефекты не обнаружены</p>
                <p className="text-xs mt-1">Монтаж выполнен качественно</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formData.defects.map((defect) => (
                  <div key={defect.id} className="p-3 border rounded-md">
                    <div className="flex items-start justify-between mb-2">
                      <Badge className={getSeverityColor(defect.severity)}>
                        {getSeverityLabel(defect.severity)}
                      </Badge>
                      <p className="text-xs text-muted-foreground">
                        {new Date(defect.reported_at).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <p className="text-sm">{defect.description}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Сообщил: {defect.reported_by_name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Кнопка сохранения */}
        {!readOnly && hasChanges && (
          <Button onClick={handleSave} className="w-full" size="sm">
            <CheckCircle2 className="w-4 h-4 mr-2" />
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
