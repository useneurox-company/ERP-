import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus, Trash2, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WarehouseCategory } from "@shared/schema";

interface CategoryTreeNode extends WarehouseCategory {
  children: WarehouseCategory[];
}

interface WarehouseCategorySidebarProps {
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onCreateCategory?: () => void;
  onCreateItemInCategory?: (categoryId: string) => void;
  onDeleteCategory?: (categoryId: string) => void;
}

export function WarehouseCategorySidebar({
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  onCreateItemInCategory,
  onDeleteCategory,
}: WarehouseCategorySidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Получить дерево категорий
  const { data: categoryTree = [], isLoading } = useQuery<CategoryTreeNode[]>({
    queryKey: ["/api/warehouse/categories/tree"],
  });

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategory = (category: CategoryTreeNode, level: number = 0) => {
    const isExpanded = expandedCategories.has(category.id);
    const isSelected = selectedCategoryId === category.id;
    const hasChildren = category.children && category.children.length > 0;

    return (
      <div key={category.id} className="select-none group">
        <div
          className={cn(
            "flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent relative",
            isSelected && "bg-accent font-medium",
            level === 0 && "font-semibold"
          )}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
          onClick={() => {
            if (hasChildren) {
              toggleCategory(category.id);
            }
            onSelectCategory(category.id);
          }}
        >
          {hasChildren ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleCategory(category.id);
              }}
              className="p-0.5 hover:bg-accent-foreground/10 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <div className="w-5" />
          )}

          <span className="text-base mr-1">
            {category.icon || (isExpanded ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4" />)}
          </span>

          <span className="flex-1 text-sm truncate">{category.name}</span>

          {hasChildren && (
            <span className="text-xs text-muted-foreground">
              {category.children.length}
            </span>
          )}

          {/* Кнопки при наведении */}
          <div className="hidden group-hover:flex items-center gap-1 ml-1">
            {onCreateItemInCategory && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateItemInCategory(category.id);
                }}
                className="p-1 hover:bg-green-500/20 rounded"
                title="Добавить товар в эту категорию"
              >
                <PackagePlus className="h-3.5 w-3.5 text-green-600" />
              </button>
            )}
            {onDeleteCategory && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCategory(category.id);
                }}
                className="p-1 hover:bg-red-500/20 rounded"
                title="Удалить категорию"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-600" />
              </button>
            )}
          </div>
        </div>

        {isExpanded && hasChildren && (
          <div className="mt-0.5">
            {category.children.map((child) =>
              renderCategory({ ...child, children: [] } as CategoryTreeNode, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="w-64 border-r bg-background p-4 space-y-2">
        <div className="h-8 bg-accent rounded animate-pulse" />
        <div className="h-8 bg-accent rounded animate-pulse" />
        <div className="h-8 bg-accent rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="w-64 border-r bg-background flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Категории</h2>
          {onCreateCategory && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCreateCategory}
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Category Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {/* All categories option */}
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer hover:bg-accent mb-2",
            selectedCategoryId === null && "bg-accent font-medium"
          )}
          onClick={() => onSelectCategory(null)}
        >
          <Folder className="h-4 w-4" />
          <span className="text-sm">Все товары</span>
        </div>

        <div className="space-y-0.5">
          {categoryTree.map((category) => renderCategory(category))}
        </div>

        {categoryTree.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Нет категорий
          </div>
        )}
      </div>
    </div>
  );
}
