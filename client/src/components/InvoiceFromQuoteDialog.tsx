import { useState, useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, Image as ImageIcon, X, ZoomIn } from "lucide-react";
import { apiRequest, queryClient, getCurrentUserId } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DealDocument } from "@shared/schema";

const positionSchema = z.object({
  name: z.string().min(1, "Введите название"),
  price: z.coerce.number().min(0, "Цена должна быть больше 0"),
  quantity: z.coerce.number().min(1, "Количество должно быть больше 0"),
  unit: z.string().default("шт"),
  imageUrl: z.string().optional(),
  height: z.coerce.number().min(0).optional(),
  width: z.coerce.number().min(0).optional(),
  depth: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
  isService: z.boolean().optional(),
});

const invoiceFormSchema = z.object({
  quote_id: z.string().min(1, "Выберите КП"),
  invoice_number: z.string().min(1, "Введите номер счёта"),
  positions: z.array(positionSchema).min(1, "Добавьте хотя бы одну позицию"),
});

type InvoiceFormData = z.infer<typeof invoiceFormSchema>;

interface InvoiceFromQuoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  invoiceId?: string; // Для редактирования существующего счёта
  onSuccess?: () => void;
}

// Custom hook for auto-resizing textarea
const useAutoResizeTextarea = (value: string | undefined) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max height ~5 lines
      textarea.style.height = newHeight + 'px';
    }
  }, [value]);

  return textareaRef;
};

export function InvoiceFromQuoteDialog({
  open,
  onOpenChange,
  dealId,
  invoiceId,
  onSuccess
}: InvoiceFromQuoteDialogProps) {
  const { toast } = useToast();
  const [selectedQuoteId, setSelectedQuoteId] = useState<string>("");
  const isEditing = !!invoiceId;
  const [imagePreview, setImagePreview] = useState<{ url: string; index: number } | null>(null);
  const positionRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  // Загружаем список КП для данной сделки
  const { data: quotes = [] } = useQuery<DealDocument[]>({
    queryKey: ['/api/deals', dealId, 'documents'],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/deals/${dealId}/documents`);
      const allDocs = response as DealDocument[];
      // Фильтруем только КП (коммерческие предложения)
      return allDocs.filter((doc: DealDocument) => doc.document_type === 'quote');
    },
    enabled: open,
  });

  // Загружаем данные существующего счёта для редактирования
  const { data: editingInvoice } = useQuery<DealDocument | undefined>({
    queryKey: ['/api/deals', dealId, 'documents', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/documents`, {
        method: 'GET',
        headers: {
          'X-User-Id': getCurrentUserId(),
          'Content-Type': 'application/json'
        },
        cache: 'no-cache',
        credentials: 'include'
      });
      const docs = await response.json() as DealDocument[];
      return docs.find((doc: DealDocument) => doc.id === invoiceId);
    },
    enabled: open && isEditing,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });

  // Генерируем номер счёта автоматически
  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
    return `ORD-${year}-${month}-${day}-${random}`;
  };

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      quote_id: "",
      invoice_number: generateInvoiceNumber(),
      positions: [],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "positions",
  });

  // Загружаем данные существующего счёта при редактировании
  useEffect(() => {
    if (!open) return;

    if (editingInvoice && isEditing) {
      // Загружаем данные существующего счёта
      const docData = typeof editingInvoice.data === 'string'
        ? JSON.parse(editingInvoice.data)
        : editingInvoice.data as any;
      const positions = docData?.positions || [];

      form.reset({
        quote_id: editingInvoice.parent_id || "",
        invoice_number: editingInvoice.name,
        positions: positions.map((pos: any) => ({
          name: pos.name,
          price: pos.price,
          quantity: pos.quantity,
          unit: pos.unit || "шт",
          imageUrl: pos.imageUrl || undefined,
          height: pos.height || undefined,
          width: pos.width || undefined,
          depth: pos.depth || undefined,
          description: pos.description || undefined,
          isService: pos.isService || false,
        })),
      });

      if (editingInvoice.parent_id) {
        setSelectedQuoteId(editingInvoice.parent_id);
      }
    } else if (!isEditing) {
      // Сбрасываем форму только для создания нового счёта
      form.reset({
        quote_id: "",
        invoice_number: generateInvoiceNumber(),
        positions: [],
      });
      setSelectedQuoteId("");
    }
  }, [editingInvoice, open, isEditing, invoiceId]);

  // Когда выбрано КП, загружаем его позиции (только для создания нового счёта)
  useEffect(() => {
    if (selectedQuoteId && !isEditing) {
      const selectedQuote = quotes.find((q) => q.id === selectedQuoteId);
      if (selectedQuote && selectedQuote.data) {
        try {
          const quoteData = JSON.parse(selectedQuote.data);
          if (quoteData.positions && Array.isArray(quoteData.positions)) {
            // Сохраняем все поля при копировании позиций из КП
            const positionsWithAllFields = quoteData.positions.map((pos: any) => ({
              name: pos.name,
              price: pos.price,
              quantity: pos.quantity,
              unit: pos.unit || "шт",
              imageUrl: pos.imageUrl || undefined,
              height: pos.height || undefined,
              width: pos.width || undefined,
              depth: pos.depth || undefined,
              description: pos.description || undefined,
              isService: pos.isService || false,
            }));
            replace(positionsWithAllFields);
          }
        } catch (e) {
          console.error("Failed to parse quote data:", e);
        }
      }
    }
  }, [selectedQuoteId, quotes, replace, isEditing]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      const totalAmount = data.positions.reduce(
        (sum, pos) => sum + pos.price * pos.quantity,
        0
      );

      if (isEditing && invoiceId) {
        // Обновляем существующий счёт
        return await apiRequest('PUT', `/api/deals/${dealId}/documents/${invoiceId}`, {
          name: data.invoice_number,
          data: JSON.stringify({ positions: data.positions }),
          total_amount: totalAmount,
          parent_id: data.quote_id,
        });
      } else {
        // Создаём новый счёт
        const invoiceData = {
          deal_id: dealId,
          document_type: 'invoice',
          name: data.invoice_number,
          version: 1,
          file_url: `placeholder-${Date.now()}`,
          data: JSON.stringify({ positions: data.positions }),
          total_amount: totalAmount,
          parent_id: data.quote_id,
          is_signed: false,
        };

        return await apiRequest('POST', `/api/deals/${dealId}/documents`, invoiceData);
      }
    },
    onSuccess: () => {
      // Инвалидируем кеш документов
      queryClient.invalidateQueries({
        queryKey: ['/api/deals', dealId, 'documents'],
        exact: true
      });

      toast({
        title: isEditing ? "Счёт обновлён" : "Счёт создан",
        description: isEditing
          ? "Счёт успешно обновлён"
          : "Счёт успешно создан на основании КП",
      });

      onOpenChange(false);
      form.reset();
      setSelectedQuoteId("");

      // Вызываем callback после небольшой задержки, чтобы дать время на инвалидацию
      if (onSuccess) {
        setTimeout(() => onSuccess(), 100);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || (isEditing ? "Не удалось обновить счёт" : "Не удалось создать счёт"),
        variant: "destructive",
      });
    },
  });

  // Handle paste image from clipboard
  const handlePasteImage = async (event: React.ClipboardEvent, index: number) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        event.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = e.target?.result as string;
          form.setValue(`positions.${index}.imageUrl`, base64);
          toast({
            title: "Изображение добавлено",
            description: "Изображение успешно вставлено из буфера обмена",
          });
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    form.setValue(`positions.${index}.imageUrl`, undefined);
    toast({
      title: "Изображение удалено",
    });
  };

  const onSubmit = (data: InvoiceFormData) => {
    createInvoiceMutation.mutate(data);
  };

  const totalAmount = fields.reduce(
    (sum, field) => sum + (field.price || 0) * (field.quantity || 1),
    0
  );

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Редактировать Счёт" : "Создать Счёт на основании КП"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Выбор КП */}
            <FormField
              control={form.control}
              name="quote_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Выберите КП</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedQuoteId(value);
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите коммерческое предложение" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {quotes.map((quote) => (
                        <SelectItem key={quote.id} value={quote.id}>
                          {quote.name} - {quote.total_amount?.toLocaleString("ru-RU")} ₽
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Номер счёта */}
            <FormField
              control={form.control}
              name="invoice_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Номер счёта</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="ORD-2025-01-01-00001" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Позиции */}
            {fields.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <FormLabel>Позиции</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ name: "", price: 0, quantity: 1, unit: "шт", imageUrl: undefined, height: undefined, width: undefined, depth: undefined, description: undefined })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить позицию
                  </Button>
                </div>

                <div className="border rounded-md overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Название</TableHead>
                      <TableHead className="w-32">Цена</TableHead>
                      <TableHead className="w-24">Кол-во</TableHead>
                      <TableHead className="w-24">Ед.изм.</TableHead>
                      <TableHead className="w-60">Габариты (В×Ш×Г, мм)</TableHead>
                      <TableHead className="w-64">Описание</TableHead>
                      <TableHead className="w-32">Итого</TableHead>
                      <TableHead className="w-20">Фото</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow
                        key={field.id}
                        ref={(el) => (positionRefs.current[index] = el)}
                        onPaste={(e) => handlePasteImage(e, index)}
                        tabIndex={-1}
                      >
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`positions.${index}.name`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input {...field} placeholder="Название позиции" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`positions.${index}.price`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    placeholder="0"
                                    min="0"
                                    step="0.01"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`positions.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input
                                    {...field}
                                    type="number"
                                    placeholder="1"
                                    min="1"
                                    step="1"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`positions.${index}.unit`}
                            render={({ field }) => (
                              <FormItem>
                                <Select onValueChange={field.onChange} value={field.value} defaultValue="шт">
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="шт" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="шт">шт</SelectItem>
                                    <SelectItem value="м²">м²</SelectItem>
                                    <SelectItem value="м.п.">м.п.</SelectItem>
                                    <SelectItem value="м">м</SelectItem>
                                    <SelectItem value="кг">кг</SelectItem>
                                    <SelectItem value="л">л</SelectItem>
                                    <SelectItem value="уп">уп</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <FormField
                              control={form.control}
                              name={`positions.${index}.height`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="В"
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`positions.${index}.width`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="Ш"
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`positions.${index}.depth`}
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormControl>
                                    <Input
                                      {...field}
                                      type="number"
                                      step="0.1"
                                      min="0"
                                      placeholder="Г"
                                      className="w-full"
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`positions.${index}.description`}
                            render={({ field }) => {
                              const textareaRef = useAutoResizeTextarea(field.value);
                              return (
                                <FormItem>
                                  <FormControl>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Textarea
                                          {...field}
                                          placeholder="Описание"
                                          className="min-h-[36px] resize-none"
                                          rows={1}
                                        />
                                      </TooltipTrigger>
                                      {field.value && (
                                        <TooltipContent side="top" className="max-w-md">
                                          <p className="whitespace-pre-wrap">{field.value}</p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </FormControl>
                                </FormItem>
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {((field.price || 0) * (field.quantity || 1)).toLocaleString("ru-RU")} ₽
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            {field.imageUrl ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setImagePreview({ url: field.imageUrl!, index })}
                                  className="relative w-8 h-8 rounded border hover:border-primary transition-colors"
                                >
                                  <img
                                    src={field.imageUrl}
                                    alt="Preview"
                                    className="w-full h-full object-cover rounded"
                                  />
                                  <ZoomIn className="absolute inset-0 m-auto w-4 h-4 text-white opacity-0 hover:opacity-100 transition-opacity" />
                                </button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleRemoveImage(index)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </>
                            ) : (
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                Ctrl+V
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                            disabled={fields.length === 1}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>

                <div className="flex justify-end text-lg font-semibold pt-2 border-t">
                  Итого: {totalAmount.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            )}

            {fields.length === 0 && selectedQuoteId && (
              <div className="text-center py-8 text-muted-foreground">
                Выбранное КП не содержит позиций
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={createInvoiceMutation.isPending || !selectedQuoteId}
              >
                {createInvoiceMutation.isPending
                  ? (isEditing ? "Сохранение..." : "Создание...")
                  : (isEditing ? "Сохранить" : "Создать")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Image Preview Dialog */}
      {imagePreview && (
        <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Изображение позиции</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              <img
                src={imagePreview.url}
                alt="Preview"
                className="max-w-full max-h-[70vh] object-contain rounded"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImagePreview(null)}>
                Закрыть
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  handleRemoveImage(imagePreview.index);
                  setImagePreview(null);
                }}
              >
                Удалить
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </Dialog>
    </TooltipProvider>
  );
}
