import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Upload, FileText, Trash2, Eye, X, Download } from "lucide-react";
import { apiRequest, queryClient, getCurrentUserId } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DealDocument, DealAttachment } from "@shared/schema";

const contractViewSchema = z.object({
  name: z.string().min(1, "Введите название договора"),
  comment: z.string().optional(),
  is_signed: z.boolean().optional(),
});

type ContractViewData = z.infer<typeof contractViewSchema>;

interface ContractViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  contractId: string;
  onSuccess?: () => void;
}

export function ContractViewDialog({
  open,
  onOpenChange,
  dealId,
  contractId,
  onSuccess
}: ContractViewDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Fetch contract data
  const { data: contract, isLoading } = useQuery<DealDocument>({
    queryKey: ['/api/deals', dealId, 'documents', contractId],
    queryFn: async () => {
      console.log(`[ContractViewDialog] Fetching contract: dealId=${dealId}, contractId=${contractId}`);
      const result = await apiRequest<DealDocument>('GET', `/api/deals/${dealId}/documents/${contractId}`);
      console.log('[ContractViewDialog] API response:', result);
      return result;
    },
    enabled: open,
  });

  // Fetch attachments
  const { data: attachments = [] } = useQuery<DealAttachment[]>({
    queryKey: ['/api/deals', dealId, 'documents', contractId, 'attachments'],
    queryFn: async () => {
      return await apiRequest('GET', `/api/deals/${dealId}/documents/${contractId}/attachments`);
    },
    enabled: open,
  });

  const form = useForm<ContractViewData>({
    resolver: zodResolver(contractViewSchema),
    defaultValues: {
      name: "",
      comment: "",
      is_signed: false,
    },
  });

  // Load contract data when it's fetched
  useEffect(() => {
    if (contract && open) {
      console.log('[ContractViewDialog] Contract data:', {
        id: contract.id,
        name: contract.name,
        file_url: contract.file_url,
        is_signed: Boolean(contract.is_signed)
      });
      form.reset({
        name: contract.name,
        comment: contract.comment || "",
        is_signed: Boolean(contract.is_signed),
      });
    }
  }, [contract, open, form]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|doc)$/i)) {
      toast({
        title: "Неверный формат файла",
        description: "Пожалуйста, загрузите PDF или DOCX файл",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "Файл слишком большой",
        description: "Максимальный размер файла: 10 МБ",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    setUploadingFile(file);
    event.target.value = '';
  };

  const handleAttachmentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "Файл слишком большой",
        description: "Максимальный размер файла: 10 МБ",
        variant: "destructive",
      });
      event.target.value = '';
      return;
    }

    setUploadingAttachment(file);
    uploadAttachment.mutate(file);
    event.target.value = '';
  };

  const uploadAttachment = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      try {
        // Upload file
        const formData = new FormData();
        formData.append('file', file);

        const uploadResponse = await fetch('/api/objects/upload', {
          method: 'POST',
          headers: {
            'X-User-Id': getCurrentUserId(),
          },
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload file');
        }

        const uploadData = await uploadResponse.json();

        // Create attachment record
        return await apiRequest('POST', `/api/deals/${dealId}/documents/${contractId}/attachments`, {
          file_name: file.name,
          file_path: uploadData.objectPath,
          file_size: file.size,
          mime_type: file.type,
        });
      } finally {
        setIsUploading(false);
        setUploadingAttachment(null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents', contractId, 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      toast({
        title: "Успешно",
        description: "Файл загружен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось загрузить файл",
        variant: "destructive",
      });
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: async (attachmentId: string) => {
      return await apiRequest('DELETE', `/api/deals/${dealId}/documents/${contractId}/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents', contractId, 'attachments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      toast({
        title: "Успешно",
        description: "Вложение удалено",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить вложение",
        variant: "destructive",
      });
    },
  });

  const saveContract = useMutation({
    mutationFn: async (data: ContractViewData) => {
      let fileUrl = contract?.file_url;

      // Upload new file if selected
      if (uploadingFile) {
        setIsUploading(true);
        try {
          const formData = new FormData();
          formData.append('file', uploadingFile);

          const uploadResponse = await fetch('/api/objects/upload', {
            method: 'POST',
            headers: {
              'X-User-Id': getCurrentUserId(),
            },
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error('Failed to upload file');
          }

          const uploadData = await uploadResponse.json();
          fileUrl = uploadData.objectPath;
        } catch (error) {
          throw new Error('Ошибка загрузки файла');
        } finally {
          setIsUploading(false);
        }
      }

      return await apiRequest('PUT', `/api/deals/${dealId}/documents/${contractId}`, {
        name: data.name,
        file_url: fileUrl,
        comment: data.comment || null,
        is_signed: data.is_signed,
      });
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Договор обновлён",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents', contractId] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      setUploadingFile(null);
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить договор",
        variant: "destructive",
      });
    },
  });

  const deleteContractFile = useMutation({
    mutationFn: async () => {
      return await apiRequest('PUT', `/api/deals/${dealId}/documents/${contractId}`, {
        file_url: null,
      });
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Файл договора удалён",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents', contractId] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить файл",
        variant: "destructive",
      });
    },
  });

  const deleteContract = useMutation({
    mutationFn: async () => {
      return await apiRequest('DELETE', `/api/deals/${dealId}/documents/${contractId}`);
    },
    onSuccess: () => {
      toast({
        title: "Успешно",
        description: "Договор удалён",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить договор",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ContractViewData) => {
    saveContract.mutate(data);
  };

  const handleDeleteFile = () => {
    if (confirm("Удалить файл договора? Запись о договоре останется, но файл будет удалён.")) {
      deleteContractFile.mutate();
    }
  };

  const handleDeleteContract = () => {
    if (confirm("Удалить договор полностью? Это действие нельзя отменить.")) {
      deleteContract.mutate();
    }
  };

  if (isLoading || !contract) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Загрузка...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Просмотр договора</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Contract Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название договора</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Введите название договора" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contract File */}
            <div className="space-y-2">
              <FormLabel>Файл договора (PDF или DOCX)</FormLabel>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
                className="hidden"
              />

              {contract.file_url || uploadingFile ? (
                <div className="border rounded-lg p-4 flex items-center gap-3">
                  <FileText className="w-8 h-8 text-primary" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {uploadingFile ? uploadingFile.name : contract.file_url?.split('/').pop() || 'Договор'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {uploadingFile
                        ? `${(uploadingFile.size / 1024).toFixed(1)} KB (новый файл)`
                        : 'Текущий файл'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {contract.file_url && !uploadingFile && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => window.open(contract.file_url, '_blank')}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                    {uploadingFile ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setUploadingFile(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={handleDeleteFile}
                        disabled={deleteContractFile.isPending}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
                >
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Нажмите, чтобы загрузить файл
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF или DOCX, до 10 МБ
                  </p>
                </div>
              )}
            </div>

            {/* Contract Preview */}
            {contract.file_url && !contract.file_url.startsWith('placeholder') && !uploadingFile && (
              <div className="space-y-2">
                <FormLabel>Предпросмотр договора</FormLabel>
                {contract.file_url.toLowerCase().includes('.pdf') ? (
                  <div className="border rounded-lg overflow-hidden" style={{ height: '600px' }}>
                    <iframe
                      src={contract.file_url}
                      className="w-full h-full"
                      title="Предпросмотр договора"
                    />
                  </div>
                ) : (
                  <div className="border rounded-lg p-8 text-center bg-muted/30">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Предпросмотр недоступен для DOCX файлов
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.open(contract.file_url, '_blank')}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Открыть файл
                    </Button>
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Attachments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Дополнительные файлы</FormLabel>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => attachmentInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Загрузить файл
                </Button>
              </div>

              <input
                ref={attachmentInputRef}
                type="file"
                onChange={handleAttachmentSelect}
                className="hidden"
              />

              {uploadingAttachment && (
                <div className="border rounded-lg p-3 flex items-center gap-3 bg-muted/50">
                  <FileText className="w-6 h-6 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{uploadingAttachment.name}</p>
                    <p className="text-xs text-muted-foreground">Загрузка...</p>
                  </div>
                </div>
              )}

              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map(attachment => (
                    <div key={attachment.id} className="border rounded-lg p-3 flex items-center gap-3">
                      <FileText className="w-6 h-6 text-primary" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : 'Неизвестный размер'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(attachment.file_path, '_blank')}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            if (confirm(`Удалить файл "${attachment.file_name}"?`)) {
                              deleteAttachment.mutate(attachment.id);
                            }
                          }}
                          disabled={deleteAttachment.isPending}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {attachments.length === 0 && !uploadingAttachment && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Дополнительных файлов нет
                </p>
              )}
            </div>

            <Separator />

            {/* Comment */}
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Комментарий</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Добавьте комментарий к договору"
                      rows={4}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Is Signed */}
            <FormField
              control={form.control}
              name="is_signed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Подписан</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-between gap-2 pt-4">
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteContract}
                disabled={deleteContract.isPending || saveContract.isPending || isUploading}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить договор
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={saveContract.isPending || isUploading}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  disabled={saveContract.isPending || isUploading}
                >
                  {isUploading
                    ? "Загрузка файла..."
                    : saveContract.isPending
                      ? "Сохранение..."
                      : "Сохранить"}
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
