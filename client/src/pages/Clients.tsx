import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, Trash2, User, Phone, Mail, Building2, FileText, FolderKanban, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";
import type { Client, Deal, Project } from "@shared/schema";

interface ClientWithStats extends Client {
  deals_count: number;
  total_amount: number;
  projects_count: number;
}

interface ClientFormData {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  inn: string;
  notes: string;
  is_active: boolean;
}

const emptyFormData: ClientFormData = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  inn: "",
  notes: "",
  is_active: true,
};

export default function Clients() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null);
  const [formData, setFormData] = useState<ClientFormData>(emptyFormData);

  const { toast } = useToast();

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    refetchInterval: 15000, // Real-time: обновление каждые 15 секунд
  });

  // Fetch client details when selected
  const { data: clientDetails, isLoading: isLoadingDetails } = useQuery<ClientWithStats>({
    queryKey: ["/api/clients", selectedClient?.id],
    enabled: !!selectedClient?.id && isDetailSheetOpen,
  });

  // Fetch client's deals
  const { data: clientDeals = [] } = useQuery<Deal[]>({
    queryKey: ["/api/clients", selectedClient?.id, "deals"],
    enabled: !!selectedClient?.id && isDetailSheetOpen,
  });

  // Fetch client's projects
  const { data: clientProjects = [] } = useQuery<Project[]>({
    queryKey: ["/api/clients", selectedClient?.id, "projects"],
    enabled: !!selectedClient?.id && isDetailSheetOpen,
  });

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (client.contact_person && client.contact_person.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (client.inn && client.inn.includes(searchQuery))
  );

  const createMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      return await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Успешно", description: "Клиент создан" });
      setIsCreateDialogOpen(false);
      setFormData(emptyFormData);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ClientFormData> }) => {
      return await apiRequest("PUT", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Успешно", description: "Клиент обновлен" });
      setIsEditDialogOpen(false);
      setSelectedClient(null);
      setFormData(emptyFormData);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Успешно", description: "Клиент удален" });
      setIsDeleteDialogOpen(false);
      setSelectedClient(null);
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const handleCreate = () => {
    setFormData(emptyFormData);
    setIsCreateDialogOpen(true);
  };

  const handleEdit = (client: Client) => {
    setSelectedClient(client as ClientWithStats);
    setFormData({
      name: client.name,
      contact_person: client.contact_person || "",
      phone: client.phone || "",
      email: client.email || "",
      address: client.address || "",
      inn: client.inn || "",
      notes: client.notes || "",
      is_active: client.is_active,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    setSelectedClient(client as ClientWithStats);
    setIsDeleteDialogOpen(true);
  };

  const handleViewDetails = (client: Client) => {
    setSelectedClient(client as ClientWithStats);
    setIsDetailSheetOpen(true);
  };

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({ title: "Ошибка", description: "Введите имя клиента", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleSubmitEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    if (!formData.name.trim()) {
      toast({ title: "Ошибка", description: "Введите имя клиента", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: selectedClient.id, data: formData });
  };

  const renderForm = () => (
    <div className="grid gap-4 py-4">
      <div className="grid gap-2">
        <Label htmlFor="name">Имя клиента *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Иванов Иван Иванович"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="contact_person">Контактное лицо</Label>
          <Input
            id="contact_person"
            value={formData.contact_person}
            onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
            placeholder="Менеджер"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="inn">ИНН</Label>
          <Input
            id="inn"
            value={formData.inn}
            onChange={(e) => setFormData({ ...formData, inn: e.target.value })}
            placeholder="7712345678"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="phone">Телефон</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+7 (999) 123-45-67"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="client@example.com"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="address">Адрес</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="г. Москва, ул. Примерная, д. 1"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="notes">Примечания</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Дополнительная информация..."
          rows={3}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Активен</Label>
      </div>
    </div>
  );

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("ru-RU");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Клиенты</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Управление клиентами и их данными
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Новый клиент
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени, контакту или ИНН..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клиент</TableHead>
                <TableHead>Контакт</TableHead>
                <TableHead>Телефон</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-[120px]">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "Ничего не найдено" : "Нет клиентов"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetails(client)}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {client.name}
                      </div>
                    </TableCell>
                    <TableCell>{client.contact_person || "—"}</TableCell>
                    <TableCell>
                      {client.phone ? (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {client.phone}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {client.email ? (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {client.email}
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={client.is_active ? "default" : "secondary"}>
                        {client.is_active ? "Активен" : "Неактивен"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(client)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(client)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewDetails(client)}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && (
        <div className="text-sm text-muted-foreground">
          Показано: {filteredClients.length} из {clients.length}
        </div>
      )}

      {/* Client Detail Sheet */}
      <Sheet open={isDetailSheetOpen} onOpenChange={setIsDetailSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {selectedClient?.name}
            </SheetTitle>
          </SheetHeader>

          {isLoadingDetails ? (
            <div className="space-y-4 mt-6">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : clientDetails && (
            <div className="mt-6 space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{clientDetails.deals_count}</div>
                    <p className="text-xs text-muted-foreground">Сделок</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{clientDetails.projects_count}</div>
                    <p className="text-xs text-muted-foreground">Проектов</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-lg font-bold">{formatCurrency(clientDetails.total_amount || 0)}</div>
                    <p className="text-xs text-muted-foreground">Сумма</p>
                  </CardContent>
                </Card>
              </div>

              {/* Contact Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Контактная информация</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {clientDetails.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {clientDetails.phone}
                    </div>
                  )}
                  {clientDetails.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {clientDetails.email}
                    </div>
                  )}
                  {clientDetails.address && (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {clientDetails.address}
                    </div>
                  )}
                  {clientDetails.inn && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      ИНН: {clientDetails.inn}
                    </div>
                  )}
                  {clientDetails.notes && (
                    <div className="mt-4 p-3 bg-muted rounded-lg">
                      <p className="text-muted-foreground">{clientDetails.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Deals and Projects Tabs */}
              <Tabs defaultValue="deals">
                <TabsList className="w-full">
                  <TabsTrigger value="deals" className="flex-1">
                    <FileText className="h-4 w-4 mr-2" />
                    Сделки ({clientDeals.length})
                  </TabsTrigger>
                  <TabsTrigger value="projects" className="flex-1">
                    <FolderKanban className="h-4 w-4 mr-2" />
                    Проекты ({clientProjects.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="deals" className="mt-4">
                  {clientDeals.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Нет сделок
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientDeals.map((deal) => (
                        <Card key={deal.id}>
                          <CardContent className="py-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{deal.order_number || "Без номера"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(deal.created_at)}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{formatCurrency(deal.amount || 0)}</p>
                                <Badge variant="outline" className="text-xs">
                                  {deal.stage}
                                </Badge>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="projects" className="mt-4">
                  {clientProjects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      Нет проектов
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {clientProjects.map((project) => (
                        <Card key={project.id}>
                          <CardContent className="py-3">
                            <div className="flex justify-between items-center">
                              <div>
                                <p className="font-medium">{project.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {project.project_number || "Без номера"}
                                </p>
                              </div>
                              <Badge variant="outline">
                                {project.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitCreate}>
            {renderForm()}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Создание..." : "Создать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактировать клиента</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit}>
            {renderForm()}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Сохранение..." : "Сохранить"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить клиента "{selectedClient?.name}"?
              Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedClient && deleteMutation.mutate(selectedClient.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Удаление..." : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
