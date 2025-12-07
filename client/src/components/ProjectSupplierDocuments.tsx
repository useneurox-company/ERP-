import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Upload,
  FileText,
  Image,
  File,
  Download,
  Trash2,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserId } from "@/lib/queryClient";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProjectSupplierDocumentsProps {
  projectId: string;
}

interface SupplierDocument {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  thumbnail_url: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export function ProjectSupplierDocuments({ projectId }: ProjectSupplierDocumentsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SupplierDocument | null>(null);

  // Fetch documents
  const { data: documents = [], isLoading } = useQuery<SupplierDocument[]>({
    queryKey: ["/api/projects", projectId, "supplier-documents"],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/supplier-documents`);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!projectId,
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/projects/${projectId}/supplier-documents/${docId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete document");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "supplier-documents"] });
      toast({ title: "Документ удалён" });
      setDeleteDocId(null);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить документ", variant: "destructive" });
    },
  });

  // Upload handler
  const uploadFile = async (file: File) => {
    setIsUploading(true);

    try {
      // 1. Upload file to server
      const formData = new FormData();
      formData.append('file', file);

      const uploadResponse = await fetch('/api/objects/upload', {
        method: 'POST',
        headers: {
          'X-User-Id': getCurrentUserId(),
        },
        body: formData,
        credentials: 'include',
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error || 'Ошибка загрузки файла');
      }

      const uploadResult = await uploadResponse.json();

      // 2. Save metadata
      const metadataResponse = await fetch(`/api/projects/${projectId}/supplier-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getCurrentUserId(),
        },
        body: JSON.stringify({
          file_name: file.name,
          file_path: uploadResult.objectPath,
          file_size: file.size,
          mime_type: file.type,
        }),
        credentials: 'include',
      });

      if (!metadataResponse.ok) {
        const error = await metadataResponse.json();
        throw new Error(error.error || 'Ошибка сохранения документа');
      }

      toast({
        title: "Успешно",
        description: `Документ "${file.name}" загружен`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "supplier-documents"] });

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Ошибка загрузки",
        description: error instanceof Error ? error.message : "Не удалось загрузить документ",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    event.target.value = '';

    for (const file of fileList) {
      await uploadFile(file);
    }
  };

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
  }, [projectId]);

  // Download handler
  const handleDownload = (doc: SupplierDocument) => {
    window.open(`/api/attachments/download/${doc.id}`, '_blank');
  };

  // Get file icon based on mime type
  const getFileIcon = (mimeType: string | null, fileName: string) => {
    if (mimeType?.startsWith('image/')) {
      return <Image className="h-8 w-8 text-blue-500" />;
    }
    if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
      return <FileText className="h-8 w-8 text-red-500" />;
    }
    return <File className="h-8 w-8 text-gray-500" />;
  };

  // Check if file is an image
  const isImage = (mimeType: string | null) => {
    return mimeType?.startsWith('image/');
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card className="bg-zinc-900 border-zinc-800">
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Загрузка документов...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-lg">Документы поставщиков</CardTitle>
          <label htmlFor="supplier-docs-file-input" className="cursor-pointer">
            <Button
              asChild
              disabled={isUploading}
              size="sm"
              type="button"
            >
              <span>
                {isUploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Загрузить
              </span>
            </Button>
          </label>
          <input
            id="supplier-docs-file-input"
            ref={fileInputRef}
            type="file"
            className="sr-only"
            multiple
            onChange={handleFileSelect}
            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
          />
        </CardHeader>
        <CardContent>
          {/* Documents grid */}
          {documents.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative bg-zinc-800 rounded-lg p-3 border border-zinc-700 hover:border-zinc-600 transition-colors"
                >
                  {/* Preview / Icon */}
                  <div
                    className="aspect-square flex items-center justify-center bg-zinc-900 rounded-lg mb-2 overflow-hidden cursor-pointer"
                    onClick={() => isImage(doc.mime_type) ? setPreviewDoc(doc) : handleDownload(doc)}
                  >
                    {isImage(doc.mime_type) ? (
                      <img
                        src={`/api/attachments/preview/${doc.id}`}
                        alt={doc.file_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getFileIcon(doc.mime_type, doc.file_name)
                    )}
                  </div>

                  {/* File name */}
                  <p className="text-sm text-white truncate mb-1" title={doc.file_name}>
                    {doc.file_name}
                  </p>

                  {/* File info */}
                  <p className="text-xs text-gray-500">
                    {formatFileSize(doc.file_size)}
                    {doc.file_size && ' • '}
                    {formatDate(doc.created_at)}
                  </p>

                  {/* Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      className="h-7 w-7"
                      onClick={() => setDeleteDocId(doc.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Drag & Drop zone */}
          <div
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragging
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-zinc-700 hover:border-zinc-600'
            }`}
          >
            <Upload className={`h-10 w-10 mx-auto mb-3 ${isDragging ? 'text-emerald-500' : 'text-gray-500'}`} />
            <p className={`text-sm ${isDragging ? 'text-emerald-500' : 'text-gray-400'}`}>
              {isDragging ? 'Отпустите файлы здесь' : 'Перетащите файлы сюда или нажмите для выбора'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PDF, изображения, документы
            </p>
          </div>

          {documents.length === 0 && !isDragging && (
            <p className="text-center text-gray-500 text-sm mt-4">
              Документы поставщиков пока не загружены
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteDocId} onOpenChange={() => setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить документ?</AlertDialogTitle>
            <AlertDialogDescription>
              Это действие нельзя отменить. Документ будет удалён безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDocId && deleteMutation.mutate(deleteDocId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image preview modal */}
      {previewDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setPreviewDoc(null)}
          >
            <X className="h-6 w-6" />
          </Button>
          <img
            src={`/api/attachments/preview/${previewDoc.id}`}
            alt={previewDoc.file_name}
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
