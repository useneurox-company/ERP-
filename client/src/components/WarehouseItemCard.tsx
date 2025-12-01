import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, AlertTriangle, MapPin, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WarehouseItemCardProps {
  id: string;
  name: string;
  sku?: string | null;
  barcode?: string | null;
  quantity: number;
  unit: string;
  price?: number | null;
  location: string | null;
  category: "materials" | "products";
  supplier?: string | null;
  description?: string | null;
  status: "normal" | "low" | "critical";
  minStock: number;
  onClick?: () => void;
}

export function WarehouseItemCard({
  id,
  name,
  sku,
  barcode,
  quantity,
  unit,
  price,
  location,
  category,
  supplier,
  description,
  status,
  minStock,
  onClick
}: WarehouseItemCardProps) {
  const statusConfig = {
    normal: { 
      label: "Норма", 
      variant: "outline" as const,
      color: "text-green-600 dark:text-green-400", 
      bg: "bg-green-100 dark:bg-green-900/30" 
    },
    low: { 
      label: "Низкий", 
      variant: "secondary" as const,
      color: "text-yellow-600 dark:text-yellow-400", 
      bg: "bg-yellow-100 dark:bg-yellow-900/30" 
    },
    critical: { 
      label: "Критический", 
      variant: "destructive" as const,
      color: "text-red-600 dark:text-red-400", 
      bg: "bg-red-100 dark:bg-red-900/30" 
    },
  };

  const categoryLabels = {
    materials: "Материалы",
    products: "Продукция",
  };

  const config = statusConfig[status];

  return (
    <Card 
      className="hover-elevate active-elevate-2 cursor-pointer" 
      onClick={onClick}
      data-testid={`card-warehouse-item-${id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate" data-testid={`text-warehouse-item-name-${id}`}>
              {name}
            </h3>
            {sku && (
              <p className="text-xs text-muted-foreground mt-0.5">Арт: {sku}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs" data-testid={`badge-warehouse-category-${id}`}>
                {categoryLabels[category]}
              </Badge>
            </div>
          </div>
          <div className={`flex items-center justify-center w-12 h-12 rounded ${config.bg}`}>
            <Package className={`h-6 w-6 ${config.color}`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" data-testid={`text-warehouse-quantity-${id}`}>
            {quantity}
          </span>
          <span className="text-lg text-muted-foreground" data-testid={`text-warehouse-unit-${id}`}>
            {unit}
          </span>
        </div>

        {price !== null && price !== undefined && price > 0 && (
          <div className="text-sm text-muted-foreground">
            Цена: <span className="font-medium">{price} ₽/{unit}</span>
          </div>
        )}

        {location && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span data-testid={`text-warehouse-location-${id}`}>{location}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Badge 
              variant={config.variant} 
              className="gap-1"
              data-testid={`badge-warehouse-status-${id}`}
            >
              {(status === "critical" || status === "low") && (
                <AlertTriangle className="h-3 w-3" />
              )}
              {config.label}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
            }}
            data-testid={`button-warehouse-qr-${id}`}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground">
          Мин. остаток: {minStock} {unit}
        </div>
      </CardContent>
    </Card>
  );
}
