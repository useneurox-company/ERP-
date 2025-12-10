import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/contexts/LightboxContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Download,
  Eye,
  Trash2,
  MoreVertical,
  FileArchive,
  FileCode,
  FileVideo,
  FileAudio,
  ImageOff,
  Lock,
  Check,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";

// Безопасное форматирование даты
const safeFormatDate = (dateString: string | undefined, formatStr: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (!isValid(date)) return '';
  return format(date, formatStr, { locale: ru });
};

interface DocumentCardProps {
  id: string;
  name: string;
  type: string;
  size?: number;
  createdAt?: string;
  updatedAt?: string;
  previewUrl?: string;
  downloadUrl?: string;
  onView?: () => void;
  onDownload?: () => void;
  onDelete?: () => void;
  onToggleFinancial?: () => void;
  isFinancial?: boolean;
  className?: string;
}

const getFileIcon = (type: string) => {
  const iconMap: Record<string, any> = {
    pdf: FileText,
    doc: FileText,
    docx: FileText,
    txt: FileText,
    xls: FileSpreadsheet,
    xlsx: FileSpreadsheet,
    csv: FileSpreadsheet,
    png: FileImage,
    jpg: FileImage,
    jpeg: FileImage,
    gif: FileImage,
    svg: FileImage,
    zip: FileArchive,
    rar: FileArchive,
    "7z": FileArchive,
    mp4: FileVideo,
    avi: FileVideo,
    mov: FileVideo,
    mp3: FileAudio,
    wav: FileAudio,
    js: FileCode,
    ts: FileCode,
    tsx: FileCode,
    jsx: FileCode,
    html: FileCode,
    css: FileCode,
  };

  const extension = type.toLowerCase();
  const IconComponent = iconMap[extension] || File;

  return IconComponent;
};

const getFileTypeColor = (type: string) => {
  const colorMap: Record<string, string> = {
    pdf: "bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400",
    doc: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    docx: "bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
    xls: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
    xlsx: "bg-green-100 text-green-600 dark:bg-green-950 dark:text-green-400",
    png: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    jpg: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    jpeg: "bg-purple-100 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
    zip: "bg-yellow-100 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
  };

  return colorMap[type.toLowerCase()] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

// Компонент для предпросмотра документа
function DocumentPreview({
  type,
  previewUrl,
  downloadUrl,
  name,
  id
}: {
  type: string;
  previewUrl?: string;
  downloadUrl?: string;
  name: string;
  id: string;
}) {
  const [imageError, setImageError] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  const Icon = getFileIcon(type);
  const colorClass = getFileTypeColor(type);

  const isImage = ["png", "jpg", "jpeg", "gif", "svg", "bmp", "webp"].includes(type.toLowerCase());
  const isPdf = type.toLowerCase() === "pdf";
  const isDocument = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(type.toLowerCase());

  useEffect(() => {
    // Генерируем URL для превью в зависимости от типа
    if (isImage && downloadUrl) {
      // Для изображений используем сам файл
      setThumbnailUrl(downloadUrl);
    } else if (previewUrl) {
      // Если есть готовый URL превью
      setThumbnailUrl(previewUrl);
    } else if (id) {
      // Используем универсальный endpoint превью по ID
      setThumbnailUrl(`/api/attachments/preview/${id}`);
    }
  }, [downloadUrl, previewUrl, isImage, id]);

  // Если изображение и нет ошибки загрузки
  if (isImage && thumbnailUrl && !imageError) {
    return (
      <div className="w-full h-full relative bg-gray-50 dark:bg-gray-900">
        <img
          src={thumbnailUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            console.error(`Failed to load image preview: ${thumbnailUrl}`);
            setImageError(true);
          }}
        />
      </div>
    );
  }

  // Для PDF показываем превью первой страницы (генерируется на сервере)
  if (isPdf && thumbnailUrl && !imageError) {
    return (
      <div className="w-full h-full relative bg-gray-50 dark:bg-gray-900">
        <img
          src={thumbnailUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => {
            // Если не удалось загрузить превью, показываем иконку
            console.log(`[PDF Preview] Failed to load preview for: ${name}`);
            setImageError(true);
          }}
        />
        {/* Бейдж PDF в углу */}
        <div className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded font-medium">
          PDF
        </div>
      </div>
    );
  }

  // Для XLSX/XLS показываем превью первого листа (генерируется на сервере)
  const isXlsx = ["xls", "xlsx"].includes(type.toLowerCase());
  if (isXlsx && thumbnailUrl && !imageError) {
    return (
      <div className="w-full h-full relative bg-gray-50 dark:bg-gray-900">
        <img
          src={thumbnailUrl}
          alt={name}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => {
            console.log(`[XLSX Preview] Failed to load preview for: ${name}`);
            setImageError(true);
          }}
        />
        {/* Бейдж XLSX в углу */}
        <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded font-medium">
          XLSX
        </div>
      </div>
    );
  }

  // Для документов Office
  if (isDocument) {
    const docIcons: Record<string, any> = {
      doc: FileText,
      docx: FileText,
      xls: FileSpreadsheet,
      xlsx: FileSpreadsheet,
      ppt: FileText,
      pptx: FileText,
    };
    const DocIcon = docIcons[type.toLowerCase()] || FileText;
    const docColors: Record<string, string> = {
      doc: "text-blue-500",
      docx: "text-blue-500",
      xls: "text-green-500",
      xlsx: "text-green-500",
      ppt: "text-orange-500",
      pptx: "text-orange-500",
    };
    const docColor = docColors[type.toLowerCase()] || "text-gray-500";

    return (
      <div className={cn(
        "w-full h-full flex flex-col items-center justify-center",
        "bg-gradient-to-br from-gray-50 to-gray-100",
        "dark:from-gray-900 dark:to-gray-800"
      )}>
        <DocIcon className={cn("h-16 w-16 mb-2", docColor)} />
        <span className="text-xs font-medium uppercase text-muted-foreground">
          {type}
        </span>
      </div>
    );
  }

  // Для остальных файлов показываем иконку
  return (
    <div className={cn(
      "w-full h-full flex flex-col items-center justify-center",
      colorClass
    )}>
      <Icon className="h-16 w-16 mb-2" />
      <span className="text-xs font-medium uppercase">
        {type}
      </span>
    </div>
  );
}

export function DocumentCard({
  id,
  name,
  type,
  size,
  createdAt,
  updatedAt,
  previewUrl,
  downloadUrl,
  onView,
  onDownload,
  onDelete,
  onToggleFinancial,
  isFinancial,
  className,
}: DocumentCardProps) {
  const displayDate = updatedAt || createdAt;
  const { openLightbox } = useLightbox();

  // Проверяем, является ли файл изображением
  const isImage = ["png", "jpg", "jpeg", "gif", "svg", "bmp", "webp"].includes(type.toLowerCase());

  // Обработчик клика для просмотра - открываем lightbox для изображений
  const handleView = useCallback(() => {
    console.log('[DocumentCard] handleView:', { isImage, type, downloadUrl, name });
    if (isImage && downloadUrl) {
      console.log('[DocumentCard] Opening lightbox with:', downloadUrl);
      openLightbox([{ url: downloadUrl, title: name }], 0);
    } else if (onView) {
      console.log('[DocumentCard] Calling onView');
      onView();
    }
  }, [isImage, type, downloadUrl, name, openLightbox, onView]);

  return (
    <Card
      className={cn(
        "group relative overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer",
        className
      )}
      onClick={handleView}
    >
      {/* Превью область */}
      <div className="aspect-[4/3] relative bg-muted overflow-hidden">
        <DocumentPreview
          type={type}
          previewUrl={previewUrl}
          downloadUrl={downloadUrl}
          name={name}
          id={id}
        />

        {/* Иконка финансового документа */}
        {isFinancial && (
          <div className="absolute top-2 left-2 bg-amber-500 text-white p-1 rounded z-10" title="Финансовый документ">
            <Lock className="h-3 w-3" />
          </div>
        )}

        {/* Оверлей с действиями при наведении */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {(onView || isImage) && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                handleView();
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              Просмотр
            </Button>
          )}
          {onDownload && (
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onDownload();
              }}
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
          {/* Меню действий */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="secondary"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onToggleFinancial && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleFinancial(); }}>
                  <Lock className="h-4 w-4 mr-2" />
                  Фин. документ
                  {isFinancial && <Check className="h-4 w-4 ml-auto text-green-600" />}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Удалить
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Информация о файле */}
      <div className="p-3">
        <div className="flex items-start gap-2">
          {getFileIcon(type) && (
            <div className={cn("mt-0.5 shrink-0", getFileTypeColor(type).split(" ")[1])}>
              {(() => {
                const Icon = getFileIcon(type);
                return <Icon className="h-4 w-4" />;
              })()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate" title={name}>
              {name}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              {size && <span>{formatFileSize(size)}</span>}
              {size && displayDate && <span>•</span>}
              {displayDate && safeFormatDate(displayDate, "d MMM") && (
                <span>
                  {safeFormatDate(displayDate, "d MMM")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}