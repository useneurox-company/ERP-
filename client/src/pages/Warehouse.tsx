import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Plus, Search, LayoutGrid, List, ScanLine, Trash2, Package, Truck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { WarehouseTable } from "@/components/WarehouseTable";
import { WarehouseItemCard } from "@/components/WarehouseItemCard";
import { WarehouseItemDetailSheet } from "@/components/WarehouseItemDetailSheet";
import { WarehouseItemCreateDialog } from "@/components/WarehouseItemCreateDialog";
import { PackageCreateDialog } from "@/components/PackageCreateDialog";
import { QRCodeDialog } from "@/components/QRCodeDialog";
import { QRScanner } from "@/components/QRScanner";
import { QuickTransactionDialog } from "@/components/QuickTransactionDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { WarehouseReserveDialog } from "@/components/WarehouseReserveDialog";
import { WarehouseCategorySidebar } from "@/components/WarehouseCategorySidebar";
import { CategoryManageDialog } from "@/components/CategoryManageDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { WarehouseItem, User, WarehouseReservation, Project } from "@shared/schema";

export default function Warehouse() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<WarehouseItem | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isDetailSheetOpen, setIsDetailSheetOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPackageDialogOpen, setIsPackageDialogOpen] = useState(false);
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isQuickTransactionOpen, setIsQuickTransactionOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isReserveDialogOpen, setIsReserveDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "normal" | "low" | "critical">("all");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [preselectedCategoryId, setPreselectedCategoryId] = useState<string | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isDeleteCategoryDialogOpen, setIsDeleteCategoryDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const { toast } = useToast();

  const { data: items = [], isLoading, error } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouse/items"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: allReservations = [] } = useQuery<WarehouseReservation[]>({
    queryKey: ["/api/warehouse/reservations"],
    queryFn: async () => {
      // Fetch all reservations for all items
      const reservations: WarehouseReservation[] = [];
      for (const item of items) {
        try {
          const itemReservations = await apiRequest<WarehouseReservation[]>("GET", `/api/warehouse/items/${item.id}/reservations`);
          reservations.push(...itemReservations);
        } catch (error) {
          console.error(`Failed to fetch reservations for item ${item.id}:`, error);
        }
      }
      return reservations;
    },
    enabled: items.length > 0,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Ошибка загрузки",
        description: "Не удалось загрузить данные склада",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const currentUserId = users[0]?.id || "";

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesCategory = selectedCategoryId === null || item.category_id === selectedCategoryId;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleItemClick = (item: WarehouseItem) => {
    setSelectedItem(item);
    setIsDetailSheetOpen(true);
  };

  const handleQRClick = (item: WarehouseItem) => {
    setSelectedItem(item);
    setIsQRDialogOpen(true);
  };

  const handleShowQR = (item: WarehouseItem) => {
    setSelectedItem(item);
    setIsQRDialogOpen(true);
  };

  const handleReserve = (item: WarehouseItem) => {
    setSelectedItem(item);
    setIsReserveDialogOpen(true);
  };

  const handleScan = (decodedText: string) => {
    const foundItem = items.find(
      (item) => item.barcode === decodedText || item.id === decodedText
    );

    if (foundItem) {
      setSelectedItem(foundItem);
      setIsQuickTransactionOpen(true);
      toast({
        title: "Товар найден",
        description: foundItem.name,
      });
    } else {
      toast({
        title: "Товар не найден",
        description: "QR-код не соответствует ни одному товару",
        variant: "destructive",
      });
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      // Удаляем все товары последовательно
      for (const id of itemIds) {
        await apiRequest("DELETE", `/api/warehouse/${id}`);
      }
    },
    onSuccess: (_, itemIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse"] });
      toast({
        title: "Успешно",
        description: `Удалено товаров: ${itemIds.length}`,
      });
      setSelectedItems([]);
      setIsDeleteDialogOpen(false);
      setItemsToDelete([]);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка удаления",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleDeleteItems = (itemIds: string[]) => {
    setItemsToDelete(itemIds);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    deleteMutation.mutate(itemsToDelete);
  };

  const handleDeleteSelected = () => {
    if (selectedItems.length === 0) {
      toast({
        title: "Нет выбранных товаров",
        description: "Выберите товары для удаления",
        variant: "destructive",
      });
      return;
    }
    handleDeleteItems(selectedItems);
  };

  const handleCreateItemInCategory = (categoryId: string) => {
    setPreselectedCategoryId(categoryId);
    setIsCreateDialogOpen(true);
  };

  const handleDeleteCategory = (categoryId: string) => {
    setCategoryToDelete(categoryId);
    setIsDeleteCategoryDialogOpen(true);
  };

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId: string) => {
      await apiRequest("DELETE", `/api/warehouse/categories/${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/categories/tree"] });
      toast({
        title: "Успешно",
        description: "Категория удалена",
      });
      setIsDeleteCategoryDialogOpen(false);
      setCategoryToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка удаления",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirmDeleteCategory = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete);
    }
  };

  const renderGrid = (itemsToRender: WarehouseItem[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {itemsToRender.length === 0 ? (
        <div className="col-span-full text-center py-12 text-muted-foreground" data-testid="text-no-items">
          Ничего не найдено
        </div>
      ) : (
        itemsToRender.map((item) => (
          <WarehouseItemCard
            key={item.id}
            id={item.id}
            name={item.name}
            sku={item.sku}
            barcode={item.barcode}
            quantity={parseFloat(String(item.quantity))}
            unit={item.unit}
            price={item.price ? parseFloat(String(item.price)) : undefined}
            location={item.location}
            category={(item.category_id || "") as any}
            supplier={item.supplier}
            description={item.description}
            status={item.status as "normal" | "low" | "critical"}
            minStock={parseFloat(String(item.min_stock || 0))}
            onClick={() => handleItemClick(item)}
          />
        ))
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Склад</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Учет материалов и готовой продукции</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedItems.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить выбранные ({selectedItems.length})
            </Button>
          )}
          <Button variant="outline" onClick={() => setIsScannerOpen(true)}>
            <ScanLine className="h-4 w-4 mr-2" />
            Сканировать
          </Button>
          <Button variant="outline" onClick={() => setIsPackageDialogOpen(true)}>
            <Package className="h-4 w-4 mr-2" />
            Создать упаковку
          </Button>
          <Link href="/shipments/new">
            <Button variant="default">
              <Truck className="h-4 w-4 mr-2" />
              Начать отгрузку
            </Button>
          </Link>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Новая позиция
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию или артикулу..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-warehouse"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-auto">
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="all" data-testid="filter-status-all">
              Все
            </TabsTrigger>
            <TabsTrigger value="normal" data-testid="filter-status-normal">
              Норма
            </TabsTrigger>
            <TabsTrigger value="low" data-testid="filter-status-low">
              Низкий
            </TabsTrigger>
            <TabsTrigger value="critical" data-testid="filter-status-critical">
              Критический
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1 border rounded-md">
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Layout with Sidebar and Content */}
      <div className="flex gap-4 min-h-[600px]">
        {/* Category Sidebar */}
        <WarehouseCategorySidebar
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          onCreateCategory={() => setIsCategoryDialogOpen(true)}
          onCreateItemInCategory={handleCreateItemInCategory}
          onDeleteCategory={handleDeleteCategory}
        />

        {/* Main Content */}
        <div className="flex-1">
          {isLoading ? (
            viewMode === "table" ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} className="h-64" data-testid={`skeleton-warehouse-${i}`} />
                ))}
              </div>
            )
          ) : viewMode === "table" ? (
            <WarehouseTable
              items={filteredItems}
              onItemClick={handleItemClick}
              onShowQR={handleShowQR}
              onReserve={handleReserve}
              onDeleteItems={handleDeleteItems}
              selectedItems={selectedItems}
              onSelectItems={setSelectedItems}
              projects={projects}
            />
          ) : (
            renderGrid(filteredItems)
          )}
        </div>
      </div>

      {!isLoading && (
        <div className="text-sm text-muted-foreground">
          Показано: {filteredItems.length} из {items.length} позиций
        </div>
      )}

      <WarehouseItemDetailSheet
        item={selectedItem}
        open={isDetailSheetOpen}
        onOpenChange={setIsDetailSheetOpen}
        currentUserId={currentUserId}
      />

      <WarehouseItemCreateDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) setPreselectedCategoryId(null);
        }}
        preselectedCategoryId={preselectedCategoryId}
      />

      <QRCodeDialog
        open={isQRDialogOpen}
        onOpenChange={setIsQRDialogOpen}
        item={selectedItem}
      />

      <QRScanner
        open={isScannerOpen}
        onOpenChange={setIsScannerOpen}
        onScanSuccess={handleScan}
      />

      <QuickTransactionDialog
        open={isQuickTransactionOpen}
        onOpenChange={setIsQuickTransactionOpen}
        scannedCode={selectedItem?.barcode || selectedItem?.id || ""}
        currentUserId={currentUserId}
      />

      <DeleteConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        itemCount={itemsToDelete.length}
        isDeleting={deleteMutation.isPending}
      />

      <WarehouseReserveDialog
        open={isReserveDialogOpen}
        onOpenChange={setIsReserveDialogOpen}
        item={selectedItem}
        userId={currentUserId}
      />

      <PackageCreateDialog
        open={isPackageDialogOpen}
        onOpenChange={setIsPackageDialogOpen}
      />

      <DeleteConfirmDialog
        open={isDeleteCategoryDialogOpen}
        onOpenChange={setIsDeleteCategoryDialogOpen}
        onConfirm={handleConfirmDeleteCategory}
        itemCount={1}
        isDeleting={deleteCategoryMutation.isPending}
        title="Удалить категорию?"
        description="Вы уверены что хотите удалить эту категорию? Это действие нельзя отменить."
      />

      <CategoryManageDialog
        open={isCategoryDialogOpen}
        onOpenChange={setIsCategoryDialogOpen}
        category={null}
      />
    </div>
  );
}
