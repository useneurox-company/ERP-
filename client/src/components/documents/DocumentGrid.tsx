import { useState } from "react";
import { DocumentCard } from "./DocumentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Grid3x3,
  List,
  Search,
  Upload,
  FolderOpen,
  Filter,
  Download,
  Trash2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Document {
  id: string;
  name: string;
  type: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  previewUrl?: string;
  downloadUrl?: string;
  folder?: string;
}

interface DocumentGridProps {
  documents: Document[];
  folders?: string[];
  onDocumentView?: (doc: Document) => void;
  onDocumentDownload?: (doc: Document) => void;
  onDocumentDelete?: (doc: Document) => void;
  onUpload?: () => void;
  title?: string;
  emptyMessage?: string;
  className?: string;
}

type ViewMode = "grid" | "list";
type SortBy = "name" | "date" | "size" | "type";

export function DocumentGrid({
  documents,
  folders = [],
  onDocumentView,
  onDocumentDownload,
  onDocumentDelete,
  onUpload,
  title = "Документы",
  emptyMessage = "Нет документов",
  className,
}: DocumentGridProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [selectedType, setSelectedType] = useState<string>("all");

  // Получаем уникальные типы файлов
  const fileTypes = Array.from(
    new Set(documents.map((doc) => doc.type.toLowerCase()))
  );

  // Фильтрация документов
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesFolder =
      selectedFolder === "all" || doc.folder === selectedFolder;
    const matchesType =
      selectedType === "all" || doc.type.toLowerCase() === selectedType;

    return matchesSearch && matchesFolder && matchesType;
  });

  // Сортировка документов
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "date":
        const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return dateB - dateA;
      case "size":
        return (b.size || 0) - (a.size || 0);
      case "type":
        return a.type.localeCompare(b.type);
      default:
        return 0;
    }
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Заголовок и действия */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{title}</h2>
        {onUpload && (
          <Button onClick={onUpload}>
            <Upload className="h-4 w-4 mr-2" />
            Загрузить документ
          </Button>
        )}
      </div>

      {/* Панель инструментов */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Поиск */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск документов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Фильтры */}
        <div className="flex gap-2">
          {/* Фильтр по папке */}
          {folders.length > 0 && (
            <Select value={selectedFolder} onValueChange={setSelectedFolder}>
              <SelectTrigger className="w-[150px]">
                <FolderOpen className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Папка" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все папки</SelectItem>
                {folders.map((folder) => (
                  <SelectItem key={folder} value={folder}>
                    {folder}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Фильтр по типу */}
          {fileTypes.length > 1 && (
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[150px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Тип" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                {fileTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Сортировка */}
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Сортировка" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date">По дате</SelectItem>
              <SelectItem value="name">По имени</SelectItem>
              <SelectItem value="size">По размеру</SelectItem>
              <SelectItem value="type">По типу</SelectItem>
            </SelectContent>
          </Select>

          {/* Переключатель вида */}
          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="rounded-r-none"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="rounded-l-none"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Статистика */}
      <div className="text-sm text-muted-foreground">
        Показано {sortedDocuments.length} из {documents.length} документов
      </div>

      {/* Документы */}
      {sortedDocuments.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {sortedDocuments.map((doc) => (
              <DocumentCard
                key={doc.id}
                {...doc}
                onView={() => onDocumentView?.(doc)}
                onDownload={() => onDocumentDownload?.(doc)}
                onDelete={() => onDocumentDelete?.(doc)}
              />
            ))}
          </div>
        ) : (
          <DocumentList
            documents={sortedDocuments}
            onDocumentView={onDocumentView}
            onDocumentDownload={onDocumentDownload}
            onDocumentDelete={onDocumentDelete}
          />
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">{emptyMessage}</p>
          {onUpload && (
            <Button onClick={onUpload} className="mt-4">
              <Upload className="h-4 w-4 mr-2" />
              Загрузить первый документ
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Компонент для отображения списком
function DocumentList({
  documents,
  onDocumentView,
  onDocumentDownload,
  onDocumentDelete,
}: {
  documents: Document[];
  onDocumentView?: (doc: Document) => void;
  onDocumentDownload?: (doc: Document) => void;
  onDocumentDelete?: (doc: Document) => void;
}) {
  return (
    <div className="space-y-2">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
          onClick={() => onDocumentView?.(doc)}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{doc.name}</p>
            <p className="text-sm text-muted-foreground">
              {doc.type.toUpperCase()} • {doc.size ? formatFileSize(doc.size) : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {onDocumentDownload && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDocumentDownload(doc);
                }}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            {onDocumentDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onDocumentDelete(doc);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatFileSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Экспорт для использования
export { DocumentCard };