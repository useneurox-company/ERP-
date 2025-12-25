import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Upload, FileText, Trash2, Eye } from "lucide-react";
import { apiRequest, queryClient, getCurrentUserId } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DealDocument } from "@shared/schema";

const contractFormSchema = z.object({
  name: z.string().min(1, "Введите название договора"),
  is_signed: z.boolean().optional(),
});

type ContractFormData = z.infer<typeof contractFormSchema>;

interface ContractFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  contractId?: string; // For editing existing contract
  onSuccess?: () => void;
}

export function ContractFormDialog({
  open,
  onOpenChange,
  dealId,
  contractId,
  onSuccess
}: ContractFormDialogProps) {
  const { toast } = useToast();
  const isEditing = !!contractId;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Calculate hasFile early for use in hooks
  const hasFiles = uploadedFiles.length > 0 || existingFileUrl;

  const { data: existingDocuments = [] } = useQuery<DealDocument[]>({
    queryKey: ['/api/deals', dealId, 'documents'],
    enabled: open,
  });

  const { data: editingContract } = useQuery<DealDocument | undefined>({
    queryKey: ['/api/deals', dealId, 'documents', contractId],
    queryFn: async () => {
      const docs = await apiRequest<DealDocument[]>('GET', `/api/deals/${dealId}/documents`);
      return docs.find((doc: DealDocument) => doc.id === contractId);
    },
    enabled: open && isEditing,
  });

  const form = useForm<ContractFormData>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      name: "",
      is_signed: false,
    },
  });

  // Load existing contract data when editing
  useEffect(() => {
    if (editingContract && open) {
      form.reset({
        name: editingContract.name,
        is_signed: Boolean(editingContract.is_signed),
      });
      setExistingFileUrl(editingContract.file_url);
      setUploadedFiles([]);
    } else if (!isEditing && open) {
      form.reset({
        name: "",
        is_signed: false,
      });
      setExistingFileUrl(null);
      setUploadedFiles([]);
    }
  }, [editingContract, open, isEditing, form]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const validExtensions = /\.(pdf|docx|doc)$/i;
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    const newFiles: File[] = [];
    let hasErrors = false;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      const hasValidExtension = validExtensions.test(file.name);
      const hasValidType = validTypes.includes(file.type);

      if (!hasValidExtension && !hasValidType) {
        toast({
          title: "Неверный формат файла",
          description: `Файл "${file.name}" не является PDF или DOCX`,
          variant: "destructive",
        });
        hasErrors = true;
        continue;
      }

      // Validate file size
      if (file.size > maxSize) {
        toast({
          title: "Файл слишком большой",
          description: `Файл "${file.name}" превышает 10 МБ`,
          variant: "destructive",
        });
        hasErrors = true;
        continue;
      }

      // Check for duplicates
      if (!uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
        newFiles.push(file);
      }
    }

    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }

    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingFile = () => {
    setExistingFileUrl(null);
  };

  // Validate and process file (for drag-drop)
  const processFile = (file: File) => {
    // Check by file extension first (more reliable for drag-and-drop)
    const validExtensions = /\.(pdf|docx|doc)$/i;
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];

    const hasValidExtension = validExtensions.test(file.name);
    const hasValidType = validTypes.includes(file.type);

    // Accept file if either extension OR mime type is valid
    if (!hasValidExtension && !hasValidType) {
      console.log('[ContractFormDialog] File rejected:', { name: file.name, type: file.type });
      toast({
        title: "Неверный формат файла",
        description: `Файл "${file.name}" не является PDF или DOCX`,
        variant: "destructive",
      });
      return false;
    }

    console.log('[ContractFormDialog] File accepted:', { name: file.name, type: file.type });

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "Файл слишком большой",
        description: `Файл "${file.name}" превышает 10 МБ`,
        variant: "destructive",
      });
      return false;
    }

    // Check for duplicates
    if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
      return false;
    }

    setUploadedFiles(prev => [...prev, file]);
    return true;
  };

  // Process multiple files from drop
  const processFiles = (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      processFile(files[i]);
    }
  };

  // Handle paste (Ctrl+V)
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            processFile(file);
          }
        }
      }
    };

    if (open) {
      document.addEventListener('paste', handlePaste);
      return () => document.removeEventListener('paste', handlePaste);
    }
  }, [open, uploadedFiles]);

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set isDragOver to false if leaving the dropzone completely
    // Check if relatedTarget is outside the currentTarget
    const relatedTarget = e.relatedTarget as Node;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    console.log('[ContractFormDialog] Drop event triggered');
    const files = e.dataTransfer?.files;

    if (files && files.length > 0) {
      // Log all dropped files
      for (let i = 0; i < files.length; i++) {
        console.log(`[ContractFormDialog] File ${i}:`, files[i].name, files[i].type, files[i].size);
      }
      // Process all dropped files
      processFiles(files);
    }
  };

  const saveContract = useMutation({
    mutationFn: async (data: ContractFormData) => {
      console.log('[ContractFormDialog] Starting save contract...');
      console.log('[ContractFormDialog] uploadedFiles:', uploadedFiles.map(f => f.name));
      console.log('[ContractFormDialog] existingFileUrl:', existingFileUrl);

      setIsUploading(true);
      try {
        if (isEditing && contractId) {
          // Update existing contract - use first file or existing
          let fileUrl = existingFileUrl;

          if (uploadedFiles.length > 0) {
            const formData = new FormData();
            formData.append('file', uploadedFiles[0]);

            const uploadResponse = await fetch('/api/objects/upload', {
              method: 'POST',
              headers: { 'X-User-Id': getCurrentUserId() },
              body: formData,
            });

            if (!uploadResponse.ok) throw new Error('Failed to upload file');
            const uploadData = await uploadResponse.json();
            fileUrl = uploadData.objectPath;
          }

          if (!fileUrl) throw new Error('Необходимо загрузить файл договора');

          return await apiRequest('PUT', `/api/deals/${dealId}/documents/${contractId}`, {
            name: data.name,
            file_url: fileUrl,
            is_signed: data.is_signed,
          });
        } else {
          // Create new contracts - one per file
          const contractDocuments = existingDocuments.filter(
            (doc) => doc.document_type === 'contract'
          );
          let version = contractDocuments.reduce(
            (max, doc) => Math.max(max, doc.version || 0),
            0
          ) + 1;

          const results = [];

          for (const file of uploadedFiles) {
            console.log('[ContractFormDialog] Uploading file:', file.name);

            const formData = new FormData();
            formData.append('file', file);

            const uploadResponse = await fetch('/api/objects/upload', {
              method: 'POST',
              headers: { 'X-User-Id': getCurrentUserId() },
              body: formData,
            });

            if (!uploadResponse.ok) {
              console.error('[ContractFormDialog] Upload failed for:', file.name);
              continue;
            }

            const uploadData = await uploadResponse.json();
            const fileUrl = uploadData.objectPath;

            // Use file name (without extension) as contract name if multiple files
            const contractName = uploadedFiles.length === 1
              ? data.name
              : file.name.replace(/\.(pdf|docx|doc)$/i, '');

            const payload = {
              document_type: 'contract',
              name: contractName,
              version: version,
              file_url: fileUrl,
              data: null,
              total_amount: null,
              is_signed: data.is_signed || false,
            };

            const result = await apiRequest('POST', `/api/deals/${dealId}/documents`, payload);
            results.push(result);
            version++;
          }

          if (results.length === 0) {
            throw new Error('Не удалось загрузить ни одного файла');
          }

          return results;
        }
      } finally {
        setIsUploading(false);
      }
    },
    onSuccess: () => {
      const count = uploadedFiles.length;
      toast({
        title: "Успешно",
        description: isEditing
          ? "Договор обновлён"
          : count > 1
            ? `Создано ${count} договоров`
            : "Договор создан",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/deals', dealId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', dealId] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || `Не удалось ${isEditing ? 'обновить' : 'создать'} договор`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: ContractFormData) => {
    // Validate file presence for new contracts
    if (!isEditing && uploadedFiles.length === 0) {
      toast({
        title: "Требуется файл",
        description: "Пожалуйста, загрузите PDF или DOCX файл договора",
        variant: "destructive",
      });
      return;
    }

    saveContract.mutate(data);
  };

  const handleViewFile = () => {
    if (existingFileUrl) {
      window.open(existingFileUrl, '_blank');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" data-testid={`dialog-${isEditing ? 'edit' : 'create'}-contract`}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Редактировать' : 'Создать'} Договор</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Название договора</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Введите название договора"
                      data-testid="input-contract-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Файлы договора (PDF или DOCX)</FormLabel>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
                className="hidden"
                multiple
                data-testid="input-contract-file"
              />

              {/* Dropzone - always show */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary'
                }`}
                data-testid="dropzone-contract-file"
              >
                <Upload className={`w-8 h-8 mx-auto mb-2 ${isDragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-sm text-muted-foreground">
                  {isDragOver ? 'Отпустите для загрузки файлов' : 'Нажмите или перетащите файлы сюда'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  PDF или DOCX, до 10 МБ • Или используйте Ctrl+V
                </p>
              </div>

              {/* Existing file (for editing) */}
              {existingFileUrl && (
                <div className="border rounded-lg p-3 flex items-center gap-3" data-testid="existing-file-preview">
                  <FileText className="w-6 h-6 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-sm">
                      {existingFileUrl?.split('/').pop() || 'Договор'}
                    </p>
                    <p className="text-xs text-muted-foreground">Существующий файл</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={handleViewFile}
                      data-testid="button-view-file"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={removeExistingFile}
                      data-testid="button-remove-existing-file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Новые файлы ({uploadedFiles.length}):
                  </p>
                  {uploadedFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="border rounded-lg p-3 flex items-center gap-3" data-testid={`file-preview-${index}`}>
                      <FileText className="w-6 h-6 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-sm">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => removeFile(index)}
                        data-testid={`button-remove-file-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

            </div>

            <FormField
              control={form.control}
              name="is_signed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-is-signed"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Подписан</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saveContract.isPending || isUploading}
                data-testid="button-cancel"
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={saveContract.isPending || isUploading}
                data-testid="button-submit"
              >
                {isUploading
                  ? "Загрузка файла..."
                  : saveContract.isPending
                    ? (isEditing ? "Сохранение..." : "Создание...")
                    : (isEditing ? "Сохранить" : "Создать")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
