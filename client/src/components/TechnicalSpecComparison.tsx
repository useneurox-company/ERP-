import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TechnicalSpecificationData } from "@/types/technicalSpecification";
import { calculateAddonsTotal, calculateFinalTotal } from "@/types/technicalSpecification";

interface TechnicalSpecComparisonProps {
  techSpecData: TechnicalSpecificationData;
}

export function TechnicalSpecComparison({ techSpecData }: TechnicalSpecComparisonProps) {
  const originalTotal = techSpecData.originalPosition.total;
  const addonsTotal = calculateAddonsTotal(techSpecData.addons);
  const finalTotal = calculateFinalTotal(techSpecData);
  const difference = finalTotal - originalTotal;
  const percentageChange = originalTotal > 0 ? (difference / originalTotal) * 100 : 0;

  return (
    <Card>
      <CardHeader className="pb-3 pt-3">
        <CardTitle className="text-sm">Сравнение: Было → Стало</CardTitle>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="grid grid-cols-3 gap-4">
          {/* БЫЛО - Original */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium uppercase">Было</div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Исходная позиция</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {originalTotal.toLocaleString('ru-RU')} ₽
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  {techSpecData.originalPosition.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {techSpecData.originalPosition.quantity} {techSpecData.originalPosition.unit} × {' '}
                  {techSpecData.originalPosition.price.toLocaleString('ru-RU')} ₽
                </p>
              </div>
            </div>
          </div>

          {/* ИЗМЕНЕНИЯ - Changes */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium uppercase">
              Изменения
            </div>
            <div
              className={cn(
                "p-4 rounded-lg border-2 flex flex-col items-center justify-center min-h-[140px]",
                addonsTotal > 0 && "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
                addonsTotal < 0 && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                addonsTotal === 0 && "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800"
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {addonsTotal > 0 ? (
                  <TrendingUp className="w-6 h-6 text-green-600" />
                ) : addonsTotal < 0 ? (
                  <TrendingDown className="w-6 h-6 text-red-600" />
                ) : (
                  <ArrowRight className="w-6 h-6 text-gray-400" />
                )}
              </div>
              <p
                className={cn(
                  "text-2xl font-bold",
                  addonsTotal > 0 && "text-green-600",
                  addonsTotal < 0 && "text-red-600",
                  addonsTotal === 0 && "text-gray-400"
                )}
              >
                {addonsTotal > 0 ? "+" : ""}
                {addonsTotal.toLocaleString('ru-RU')} ₽
              </p>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {techSpecData.addons.length} {techSpecData.addons.length === 1 ? 'дополнение' : 'дополнений'}
              </p>
            </div>
          </div>

          {/* СТАЛО - Final */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-medium uppercase">Стало</div>
            <div
              className={cn(
                "p-4 rounded-lg border-2",
                difference > 0 && "bg-green-50 dark:bg-green-950/20 border-green-500 dark:border-green-700",
                difference < 0 && "bg-red-50 dark:bg-red-950/20 border-red-500 dark:border-red-700",
                difference === 0 && "bg-blue-50 dark:bg-blue-950/20 border-blue-500 dark:border-blue-700"
              )}
            >
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Итоговая стоимость</p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    difference > 0 && "text-green-600 dark:text-green-400",
                    difference < 0 && "text-red-600 dark:text-red-400",
                    difference === 0 && "text-blue-600 dark:text-blue-400"
                  )}
                >
                  {finalTotal.toLocaleString('ru-RU')} ₽
                </p>
                {difference !== 0 && (
                  <div className="mt-2 pt-2 border-t">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        difference > 0 && "text-green-600",
                        difference < 0 && "text-red-600"
                      )}
                    >
                      {difference > 0 ? "+" : ""}
                      {difference.toLocaleString('ru-RU')} ₽
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {difference > 0 ? "+" : ""}
                      {percentageChange.toFixed(1)}%
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Breakdown (if there are addons) */}
        {techSpecData.addons.length > 0 && (
          <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Расчет:</p>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Исходная позиция:</span>
                <span className="font-medium">{originalTotal.toLocaleString('ru-RU')} ₽</span>
              </div>
              {techSpecData.addons.map((addon) => (
                <div key={addon.id} className="flex justify-between text-xs pl-4">
                  <span className="text-muted-foreground">{addon.name}:</span>
                  <span
                    className={cn(
                      "font-medium",
                      addon.total > 0 && "text-green-600",
                      addon.total < 0 && "text-red-600"
                    )}
                  >
                    {addon.total > 0 ? "+" : ""}
                    {addon.total.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
              ))}
              <div className="flex justify-between pt-2 border-t font-semibold">
                <span>Итого:</span>
                <span
                  className={cn(
                    difference > 0 && "text-green-600",
                    difference < 0 && "text-red-600"
                  )}
                >
                  {finalTotal.toLocaleString('ru-RU')} ₽
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
