// Статусы позиций мебели с цветовой подсветкой

export interface ItemStatus {
  value: string;
  label: string;
  bgColor: string;
  textColor: string;
  borderColor?: string;
}

export const ITEM_STATUSES: ItemStatus[] = [
  { value: 'new', label: 'Новый', bgColor: 'bg-slate-200', textColor: 'text-slate-700', borderColor: 'border-black' },
  { value: 'soglasov', label: 'Согласов.', bgColor: 'bg-gray-300', textColor: 'text-gray-900', borderColor: 'border-black' },
  { value: 'chertezhi', label: 'Чертежи', bgColor: 'bg-blue-400', textColor: 'text-white', borderColor: 'border-black' },
  { value: 'zapusk', label: 'Запуск', bgColor: 'bg-yellow-400', textColor: 'text-yellow-900', borderColor: 'border-black' },
  { value: 'stolyarka', label: 'Столярка', bgColor: 'bg-green-500', textColor: 'text-white', borderColor: 'border-black' },
  { value: 'predmontazh', label: 'Предмонтаж', bgColor: 'bg-slate-400', textColor: 'text-white', borderColor: 'border-black' },
  { value: 'malyarka', label: 'Малярка', bgColor: 'bg-orange-500', textColor: 'text-white', borderColor: 'border-black' },
  { value: 'shlifovka', label: 'Шлифовка', bgColor: 'bg-amber-500', textColor: 'text-white', borderColor: 'border-black' },
  { value: 'upakovano', label: 'Упаковано', bgColor: 'bg-teal-500', textColor: 'text-white', borderColor: 'border-black' },
  { value: 'montazh', label: 'Монтаж', bgColor: 'bg-cyan-500', textColor: 'text-white', borderColor: 'border-black' },
  { value: 'gotovo', label: 'Готово', bgColor: 'bg-emerald-600', textColor: 'text-white', borderColor: 'border-black' },
  { value: 'ne_oplachen', label: 'НЕ ОПЛАЧЕН', bgColor: 'bg-red-200', textColor: 'text-red-800', borderColor: 'border-black' },
  { value: 'reklamacia', label: 'Рекламация', bgColor: 'bg-red-600', textColor: 'text-white', borderColor: 'border-black' },
];

export function getStatusConfig(statusValue: string | null | undefined): ItemStatus {
  return ITEM_STATUSES.find(s => s.value === statusValue) || ITEM_STATUSES[0];
}

export function getStatusBgStyle(statusValue: string | null | undefined): string {
  const status = getStatusConfig(statusValue);
  return `${status.bgColor} ${status.textColor}`;
}

export function getCardBorderStyle(statusValue: string | null | undefined): string {
  const status = getStatusConfig(statusValue);
  return status.borderColor || 'border-border';
}
