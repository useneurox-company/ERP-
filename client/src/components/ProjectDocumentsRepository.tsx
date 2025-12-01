import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DocumentGrid, type Document } from "./documents/DocumentGrid";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, File, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserId } from "@/lib/queryClient";

interface ProjectDocumentsRepositoryProps {
  projectId: string;
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
}

interface StageDocuments {
  stage_id: string;
  stage_name: string;
  stage_type: string | null;
  stage_status: string;
  documents: DocumentFile[];
  document_count: number;
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

export function ProjectDocumentsRepository({ projectId }: ProjectDocumentsRepositoryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

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

    documentsData.stages.forEach(stage => {
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

        allDocuments.push({
          id: doc.id,
          name: doc.name,
          type: fileType,
          size: doc.size || undefined,
          createdAt: doc.created_at,
          previewUrl,
          downloadUrl: `/api/attachments/download/${doc.id}`,
          folder: stage.stage_name,
        });
      });
    });

    return allDocuments;
  };

  const getFolders = (): string[] => {
    if (!documentsData) return [];
    return documentsData.stages.map(stage => stage.stage_name);
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
        title: "Ошибка",
        description: "Не удалось загрузить документ",
        variant: "destructive",
      });
    }
  };

  const handleDocumentDelete = async (doc: Document) => {
    toast({
      title: "Удаление",
      description: "Функция удаления будет добавлена позже",
    });
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

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
  };

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
        <Card>
          <CardContent className="p-12">
            <div className="flex flex-col items-center justify-center text-center">
              <File className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Нет документов</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Документы проекта появятся здесь после загрузки
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
            </div>
          </CardContent>
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
          accept="*/*"
        />
      </>
    );
  }

  return (
    <>
      <DocumentGrid
        documents={transformDocuments()}
        folders={getFolders()}
        onDocumentView={handleDocumentView}
        onDocumentDownload={handleDocumentDownload}
        onDocumentDelete={handleDocumentDelete}
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
      />
    </>
  );
}
