import { useQuery } from "@tanstack/react-query";
import { DocumentGrid, type Document as GridDocument } from "@/components/documents/DocumentGrid";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, FolderOpen, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { Document } from "@shared/schema";

export default function Documents() {
  const { toast } = useToast();

  const { data: documents = [], isLoading, error } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  if (error) {
    toast({
      title: "Ошибка загрузки",
      description: "Не удалось загрузить документы",
      variant: "destructive",
    });
  }

  // Преобразуем документы в формат для DocumentGrid
  const transformDocuments = (): GridDocument[] => {
    return documents.map(doc => {
      // Определяем расширение файла
      let fileType = doc.type;

      // Преобразуем типы документов в расширения файлов
      const typeMapping: Record<string, string> = {
        "КП": "pdf",
        "quote": "pdf",
        "Договор": "doc",
        "contract": "doc",
        "Счет": "xls",
        "invoice": "xls",
        "КД": "dwg",
        "drawing": "dwg",
        "other": "pdf",
      };

      fileType = typeMapping[doc.type] || "pdf";

      // Если в имени файла есть расширение, используем его
      if (doc.name.includes('.')) {
        const parts = doc.name.split('.');
        fileType = parts[parts.length - 1].toLowerCase();
      }

      return {
        id: doc.id,
        name: doc.name,
        type: fileType,
        size: typeof doc.size === 'string' ? parseInt(doc.size) : doc.size || undefined,
        createdAt: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
        updatedAt: doc.updated_at ? new Date(doc.updated_at).toISOString() : undefined,
        downloadUrl: doc.file_path ? `/api/documents/${doc.id}/download` : undefined,
        folder: doc.project_id ? `Проект ${doc.project_id.slice(0, 8)}` : undefined,
      };
    });
  };

  // Получаем уникальные папки (проекты)
  const getFolders = (): string[] => {
    const folders = new Set<string>();
    documents.forEach(doc => {
      if (doc.project_id) {
        folders.add(`Проект ${doc.project_id.slice(0, 8)}`);
      }
    });
    return Array.from(folders);
  };

  const handleDocumentView = async (doc: GridDocument) => {
    // Открываем документ в новой вкладке
    if (doc.downloadUrl) {
      window.open(doc.downloadUrl, '_blank');
    }
  };

  const handleDocumentDownload = async (doc: GridDocument) => {
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

  const handleDocumentDelete = async (doc: GridDocument) => {
    // TODO: Реализовать удаление документа через API
    try {
      const response = await fetch(`/api/documents/${doc.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: "Успешно",
          description: `Документ "${doc.name}" удален`,
        });
        // Перезагрузить список документов
        window.location.reload();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (error) {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить документ",
        variant: "destructive",
      });
    }
  };

  const handleUpload = () => {
    // TODO: Реализовать загрузку документов
    toast({
      title: "Загрузка",
      description: "Функция загрузки будет добавлена позже",
    });
  };

  const handleOpenDrive = () => {
    window.open('https://drive.google.com', '_blank');
  };

  // Статистика
  const docsByType = documents.reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const uniqueProjects = new Set(documents.filter(d => d.project_id).map(d => d.project_id));

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">Загрузка документов...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок и действия */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold">Документы</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            Управление документами в стиле Google Drive
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleOpenDrive}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4" />
          Открыть Google Drive
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <p className="text-2xl font-bold">{documents.length}</p>
              <p className="text-sm text-muted-foreground">Всего документов</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-3">
                <FolderOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-2xl font-bold">{uniqueProjects.size}</p>
              <p className="text-sm text-muted-foreground">Проектов</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-2xl font-bold">{docsByType["contract"] || docsByType["Договор"] || 0}</p>
              <p className="text-sm text-muted-foreground">Договоров</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 mb-3">
                <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-2xl font-bold">{docsByType["drawing"] || docsByType["КД"] || 0}</p>
              <p className="text-sm text-muted-foreground">Чертежей</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Сетка документов в стиле Google Drive */}
      <DocumentGrid
        documents={transformDocuments()}
        folders={getFolders()}
        onDocumentView={handleDocumentView}
        onDocumentDownload={handleDocumentDownload}
        onDocumentDelete={handleDocumentDelete}
        onUpload={handleUpload}
        title="Все документы"
        emptyMessage="Пока нет загруженных документов"
      />
    </div>
  );
}