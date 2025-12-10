import { useState, useRef, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DocumentGrid, type Document } from "./documents/DocumentGrid";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, File, Upload, FolderUp, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserId, getCurrentUserRole } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  username: string;
  role?: string;
  can_view_financial?: boolean;
}

interface ProjectDocumentsRepositoryProps {
  projectId: string;
  selectedItemId?: string | null;  // Если указан - фильтруем по этой позиции
}

interface DocumentFile {
  id: string;
  name: string;
  type: string;
  file_path: string;
  size: number | null;
  uploaded_by: string | null;
  created_at: string;
  user_name: string | null;
  user_full_name: string | null;
  source: 'document' | 'media' | 'deal' | 'task';
  thumbnail_url?: string | null;
  deal_document_type?: string;
  is_financial?: boolean;
}

interface StageDocuments {
  stage_id: string;
  stage_name: string;
  stage_type: string | null;
  stage_status: string;
  item_id: string | null;
  item_name: string | null;
  documents: DocumentFile[];
  document_count: number;
  is_restricted?: boolean;  // Для финансовых документов
}

interface GroupedDocuments {
  stages: StageDocuments[];
  recentDocuments: string[];
  totalDocuments: number;
}

interface Project {
  id: string;
  deal_id: string | null;
  name: string;
}

export function ProjectDocumentsRepository({ projectId, selectedItemId }: ProjectDocumentsRepositoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Получаем данные текущего пользователя для проверки прав на финансовые документы
  const userId = getCurrentUserId();
  const { data: currentUser } = useQuery<User>({
    queryKey: ["/api/users", userId],
    enabled: !!userId,
  });

  // Проверяем права администратора
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'Администратор' || currentUser?.username?.toLowerCase() === 'admin';

  // Проверяем право на просмотр финансовых документов
  const canViewFinancial = isAdmin || currentUser?.can_view_financial === true;

  // Получаем данные проекта для deal_id
  const { data: projectData } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: !!projectId,
  });

  const { data: documentsData, isLoading } = useQuery<GroupedDocuments>({
    queryKey: ["/api/projects", projectId, "documents", "grouped"],
    enabled: !!projectId,
  });

  const transformDocuments = (): Document[] => {
    if (!documentsData) return [];

    const allDocuments: Document[] = [];

    // Фильтруем этапы по выбранной позиции
    let filteredStages = selectedItemId
      ? documentsData.stages.filter(stage => stage.item_id === selectedItemId)
      : documentsData.stages;

    // Фильтруем финансовые документы если нет прав
    // Примечание: Backend уже не присылает финансовые документы пользователям без прав,
    // но для подстраховки проверяем и на клиенте
    if (!canViewFinancial) {
      filteredStages = filteredStages.filter(stage => !stage.is_restricted);
    }

    filteredStages.forEach(stage => {
      stage.documents.forEach(doc => {
        let fileType = doc.type;
        if (doc.name.includes('.')) {
          const parts = doc.name.split('.');
          fileType = parts[parts.length - 1].toLowerCase();
        } else if (doc.type === 'photo') {
          fileType = 'jpg';
        } else if (doc.type === 'video') {
          fileType = 'mp4';
        } else if (doc.type === 'audio') {
          fileType = 'mp3';
        } else if (doc.type === 'document') {
          fileType = 'pdf';
        }

        let previewUrl = undefined;
        if (doc.id) {
          previewUrl = `/api/attachments/preview/${doc.id}`;
        }
        if (doc.thumbnail_url) {
          previewUrl = doc.thumbnail_url;
        }

        // Формируем папку: "Позиция / Этап" или просто "Этап"
        // Добавляем 🔒 для финансовых документов
        const baseFolderName = stage.item_name
          ? `${stage.item_name} / ${stage.stage_name}`
          : stage.stage_name;
        const folderName = stage.is_restricted
          ? `🔒 ${baseFolderName}`
          : baseFolderName;

        allDocuments.push({
          id: doc.id,
          name: doc.name,
          type: fileType,
          size: doc.size || undefined,
          createdAt: doc.created_at,
          previewUrl,
          downloadUrl: `/api/attachments/download/${doc.id}`,
          folder: folderName,
          isFinancial: doc.is_financial || stage.is_restricted,
        });
      });
    });

    return allDocuments;
  };

  const getFolders = (): string[] => {
    if (!documentsData) return [];

    // Фильтруем этапы по выбранной позиции
    let filteredStages = selectedItemId
      ? documentsData.stages.filter(stage => stage.item_id === selectedItemId)
      : documentsData.stages;

    // Фильтруем финансовые документы если нет прав
    if (!canViewFinancial) {
      filteredStages = filteredStages.filter(stage => !stage.is_restricted);
    }

    return filteredStages.map(stage => {
      const baseFolderName = stage.item_name
        ? `${stage.item_name} / ${stage.stage_name}`
        : stage.stage_name;
      return stage.is_restricted
        ? `🔒 ${baseFolderName}`
        : baseFolderName;
    });
  };

  const handleDocumentView = async (doc: Document) => {
    if (doc.downloadUrl) {
      window.open(doc.downloadUrl, '_blank');
    }
  };

  const handleDocumentDownload = async (doc: Document) => {
    if (!doc.downloadUrl) return;

    try {
      const response = await fetch(doc.downloadUrl);

      // Проверяем успешность ответа
      if (!response.ok) {
        let errorMessage = "Файл не найден на сервере";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Ignore
        }
        throw new Error(errorMessage);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Успешно",
        description: `Документ "${doc.name}" загружен`,
      });
    } catch (error) {
      toast({
        title: "Ошибка скачивания",
        description: error instanceof Error ? error.message : "Не удалось загрузить документ",
        variant: "destructive",
      });
    }
  };

  const handleDocumentDelete = async (doc: Document) => {
    // Проверяем права администратора
    if (!isAdmin) {
      toast({
        title: "Нет доступа",
        description: "Только администратор может удалять документы",
        variant: "destructive",
      });
      return;
    }

    // Подтверждение удаления
    if (!window.confirm(`Удалить документ "${doc.name}"? Это действие нельзя отменить.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/attachments/${doc.id}`, {
        method: 'DELETE',
        headers: {
          'X-User-Id': getCurrentUserId(),
          'X-User-Role': getCurrentUserRole(),
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка удаления');
      }

      toast({
        title: "Документ удалён",
        description: doc.name,
      });

      // Обновляем список документов
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "documents", "grouped"]
      });
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Ошибка удаления",
        description: error instanceof Error ? error.message : "Не удалось удалить документ",
        variant: "destructive",
      });
    }
  };

  const handleToggleFinancial = async (doc: Document) => {
    try {
      const newValue = !doc.isFinancial;
      const response = await fetch(`/api/attachments/${doc.id}/financial`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': getCurrentUserId(),
        },
        body: JSON.stringify({ is_financial: newValue }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка обновления');
      }

      toast({
        title: newValue ? "Документ помечен как финансовый" : "Документ снят с финансовых",
        description: doc.name,
      });

      // Обновляем список документов
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "documents", "grouped"]
      });
    } catch (error) {
      console.error('Toggle financial error:', error);
      toast({
        title: "Ошибка",
        description: error instanceof Error ? error.message : "Не удалось обновить документ",
        variant: "destructive",
      });
    }
  };

  const handleUpload = () => {
    if (!projectData?.deal_id) {
      toast({
        title: "Ошибка",
        description: "Проект не привязан к сделке",
        variant: "destructive",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  // Функция загрузки файла (используется и для input, и для drag & drop)
  const uploadFile = useCallback(async (file: File) => {
    if (!projectData?.deal_id) {
      toast({
        title: "Ошибка",
        description: "Проект не привязан к сделке",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // 1. Загружаем файл на сервер
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

      // 2. Сохраняем метаданные в сделку
      const metadataResponse = await fetch(`/api/deals/${projectData.deal_id}/attachments`, {
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
          document_type: 'attachment',
          item_id: selectedItemId || null,  // Привязка к позиции проекта
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

      // Обновляем список документов
      queryClient.invalidateQueries({
        queryKey: ["/api/projects", projectId, "documents", "grouped"]
      });

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
  }, [projectData?.deal_id, projectId, queryClient, toast]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    await uploadFile(file);
  };

  // Drag & Drop обработчики
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    if (!projectData?.deal_id) {
      toast({
        title: "Ошибка",
        description: "Проект не привязан к сделке",
        variant: "destructive",
      });
      return;
    }

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Загружаем все файлы последовательно
      for (let i = 0; i < files.length; i++) {
        await uploadFile(files[i]);
      }
    }
  }, [projectData?.deal_id, uploadFile, toast]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12">
          <div className="flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Загрузка документов...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!documentsData || documentsData.totalDocuments === 0) {
    return (
      <>
        <Card
          className={cn(
            "transition-all duration-200",
            isDragging && "border-primary border-2 bg-primary/5"
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              {isDragging ? (
                <>
                  <FolderUp className="h-12 w-12 text-primary mb-4 animate-bounce" />
                  <h3 className="text-lg font-semibold text-primary">Отпустите файлы здесь</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Файлы будут загружены в проект
                  </p>
                </>
              ) : (
                <>
                  <File className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Нет документов</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Перетащите файлы сюда или нажмите кнопку ниже
                  </p>
                  {projectData?.deal_id && (
                    <Button onClick={handleUpload} className="mt-4" disabled={isUploading}>
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Загрузить документ
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="*/*"
          multiple
        />
      </>
    );
  }

  return (
    <div
      className={cn(
        "relative",
        isDragging && "ring-2 ring-primary ring-offset-2 rounded-lg"
      )}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border-2 border-dashed border-primary">
          <div className="flex flex-col items-center text-center p-6">
            <FolderUp className="h-16 w-16 text-primary mb-4 animate-bounce" />
            <h3 className="text-xl font-semibold text-primary">Отпустите файлы здесь</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Файлы будут загружены в проект
            </p>
          </div>
        </div>
      )}

      <DocumentGrid
        documents={transformDocuments()}
        folders={getFolders()}
        onDocumentView={handleDocumentView}
        onDocumentDownload={handleDocumentDownload}
        onDocumentDelete={handleDocumentDelete}
        onToggleFinancial={handleToggleFinancial}
        canEditFinancial={canViewFinancial}
        onUpload={projectData?.deal_id ? handleUpload : undefined}
        title={`Документы проекта (${documentsData.totalDocuments})`}
        emptyMessage="В проекте пока нет документов"
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="*/*"
        multiple
      />
    </div>
  );
}
