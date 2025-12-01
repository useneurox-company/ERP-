import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface PriceDisplayProps {
  value: number | string | null | undefined;
  module?: string;
  format?: 'currency' | 'number' | 'percent';
  currency?: string;
  className?: string;
  showIcon?: boolean;
  placeholder?: string;
}

/**
 * Component to display prices with permission checks
 * If user has hide_prices permission, shows placeholder instead of actual value
 */
export function PriceDisplay({
  value,
  module = 'global',
  format = 'currency',
  currency = '₽',
  className,
  showIcon = true,
  placeholder = '***'
}: PriceDisplayProps) {
  const { shouldHidePrices, shouldHidePricesAny } = usePermissions();

  // Check if prices should be hidden
  const isHidden = shouldHidePrices(module) || shouldHidePricesAny();

  // Format the value based on format type
  const formatValue = (val: number | string | null | undefined) => {
    if (val === null || val === undefined) return '—';

    const numValue = typeof val === 'string' ? parseFloat(val) : val;

    if (isNaN(numValue)) return '—';

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: currency === '₽' ? 'RUB' : currency === '$' ? 'USD' : 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(numValue);

      case 'percent':
        return `${numValue.toFixed(2)}%`;

      case 'number':
      default:
        return new Intl.NumberFormat('ru-RU', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(numValue);
    }
  };

  if (isHidden) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn('inline-flex items-center gap-1', className)}>
              {showIcon && <EyeOff className="w-3 h-3 text-muted-foreground" />}
              <span className="text-muted-foreground">{placeholder}</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Цены скрыты согласно вашим правам доступа</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {showIcon && <Eye className="w-3 h-3 text-muted-foreground opacity-0" />}
      <span>{formatValue(value)}</span>
    </span>
  );
}

/**
 * Hook to format prices with permission checks
 * Returns formatted string or placeholder based on permissions
 */
export function usePriceFormat() {
  const { shouldHidePrices, shouldHidePricesAny } = usePermissions();

  const formatPrice = (
    value: number | string | null | undefined,
    options?: {
      module?: string;
      format?: 'currency' | 'number' | 'percent';
      currency?: string;
      placeholder?: string;
    }
  ): string => {
    const {
      module = 'global',
      format = 'currency',
      currency = '₽',
      placeholder = '***'
    } = options || {};

    // Check if prices should be hidden
    const isHidden = shouldHidePrices(module) || shouldHidePricesAny();

    if (isHidden) {
      return placeholder;
    }

    if (value === null || value === undefined) return '—';

    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    if (isNaN(numValue)) return '—';

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: currency === '₽' ? 'RUB' : currency === '$' ? 'USD' : 'EUR',
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(numValue);

      case 'percent':
        return `${numValue.toFixed(2)}%`;

      case 'number':
      default:
        return new Intl.NumberFormat('ru-RU', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(numValue);
    }
  };

  return { formatPrice };
}