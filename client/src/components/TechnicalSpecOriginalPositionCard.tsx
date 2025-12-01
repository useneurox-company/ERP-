import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Info } from "lucide-react";
import type { OriginalPosition } from "@/types/technicalSpecification";

interface TechnicalSpecOriginalPositionCardProps {
  originalPosition: OriginalPosition;
}

export function TechnicalSpecOriginalPositionCard({
  originalPosition
}: TechnicalSpecOriginalPositionCardProps) {
  return (
    <Card className="border-blue-500">
      <CardHeader className="bg-blue-50 dark:bg-blue-950/20 pb-3 pt-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="w-4 h-4" />
          Исходная позиция проекта
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 pb-3 space-y-4">
        {/* Main content with image and details */}
        <div className="flex gap-4">
          {originalPosition.imageUrl && (
            <div className="flex-shrink-0">
              <img
                src={originalPosition.imageUrl}
                alt={originalPosition.name}
                className="w-24 h-24 object-cover rounded border"
              />
            </div>
          )}

          <div className="flex-1 space-y-3">
            {/* Name and Article */}
            <div>
              <p className="text-xs text-muted-foreground">Название</p>
              <p className="font-semibold text-base">{originalPosition.name}</p>
              {originalPosition.article && (
                <p className="text-xs text-muted-foreground mt-1">
                  Артикул: {originalPosition.article}
                </p>
              )}
            </div>

            {/* Price Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Цена за единицу</p>
                <p className="font-semibold text-sm">
                  {originalPosition.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Количество</p>
                <p className="font-semibold text-sm">
                  {originalPosition.quantity} {originalPosition.unit}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Итого</p>
                <p className="font-semibold text-base text-blue-600 dark:text-blue-400">
                  {originalPosition.total.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info Alert */}
        <Alert className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-xs text-blue-900 dark:text-blue-100">
            Это исходная позиция из проекта. Все изменения цены вносятся через таблицу дополнений ниже.
            Итоговая стоимость будет рассчитываться как: <strong>Исходная цена + Сумма дополнений</strong>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
