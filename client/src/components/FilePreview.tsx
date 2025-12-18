import { useState, useEffect } from "react";
import { Download, Trash2, FileText, FileSpreadsheet, FileVideo, FileAudio, File, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilePreviewProps {
  file: {
    id: string;
    file_name: string;
    file_size: number;
    mime_type?: string;
    created_at: string;
  };
  onDownload?: () => void;
  onDelete?: () => void;
  downloadUrl?: string;
  previewUrl?: string;
  compact?: boolean;
}

// Утилита для определения типа файла
const getFileType = (fileName: string, mimeType?: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // Изображения
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) {
    return 'image';
  }

  // Видео
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'].includes(ext)) {
    return 'video';
  }

  // Аудио
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return 'audio';
  }

  // Документы
  if (['pdf'].includes(ext)) {
    return 'pdf';
  }

  if (['doc', 'docx'].includes(ext)) {
    return 'word';
  }

  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return 'excel';
  }

  if (['ppt', 'pptx'].includes(ext)) {
    return 'powerpoint';
  }

  if (['txt', 'md', 'json', 'xml', 'yml', 'yaml'].includes(ext)) {
    return 'text';
  }

  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return 'archive';
  }

  return 'unknown';
};

// Иконка для типа файла
const FileTypeIcon = ({ type, className }: { type: string; className?: string }) => {
  const iconClass = cn("w-full h-full", className);

  switch (type) {
    case 'pdf':
      return <FileText className={cn(iconClass, "text-red-500")} />;
    case 'word':
      return <FileText className={cn(iconClass, "text-blue-600")} />;
    case 'excel':
      return <FileSpreadsheet className={cn(iconClass, "text-green-600")} />;
    case 'powerpoint':
      return <FileText className={cn(iconClass, "text-orange-500")} />;
    case 'video':
      return <FileVideo className={cn(iconClass, "text-purple-500")} />;
    case 'audio':
      return <FileAudio className={cn(iconClass, "text-pink-500")} />;
    case 'text':
      return <FileText className={cn(iconClass, "text-gray-500")} />;
    case 'archive':
      return <File className={cn(iconClass, "text-yellow-600")} />;
    case 'image':
      return <ImageIcon className={cn(iconClass, "text-blue-500")} />;
    default:
      return <File className={cn(iconClass, "text-gray-400")} />;
  }
};

// Форматирование размера файла
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

// Цвет фона для типа файла
const getFileTypeBgColor = (type: string): string => {
  switch (type) {
    case 'pdf':
      return 'bg-red-50 dark:bg-red-950/20';
    case 'word':
      return 'bg-blue-50 dark:bg-blue-950/20';
    case 'excel':
      return 'bg-green-50 dark:bg-green-950/20';
    case 'powerpoint':
      return 'bg-orange-50 dark:bg-orange-950/20';
    case 'video':
      return 'bg-purple-50 dark:bg-purple-950/20';
    case 'audio':
      return 'bg-pink-50 dark:bg-pink-950/20';
    case 'image':
      return 'bg-blue-50 dark:bg-blue-950/20';
    default:
      return 'bg-gray-50 dark:bg-gray-950/20';
  }
};

export function FilePreview({ file, onDownload, onDelete, onImageClick, downloadUrl, previewUrl, compact = false }: FilePreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const fileType = getFileType(file.file_name, file.mime_type);
  const isImage = fileType === 'image';
  const isPdf = fileType === 'pdf';
  const isExcel = fileType === 'excel';

  // Генерируем URL для превью
  useEffect(() => {
    if (isImage && downloadUrl) {
      setThumbnailUrl(downloadUrl);
    } else if (previewUrl) {
      setThumbnailUrl(previewUrl);
    } else if (file.id && (isPdf || isExcel || isImage)) {
      // Используем API превью для PDF, Excel и изображений
      setThumbnailUrl(`/api/attachments/preview/${file.id}`);
    }
  }, [downloadUrl, previewUrl, isImage, isPdf, isExcel, file.id]);

  const handleDownload = () => {
    if (onDownload) {
      onDownload();
    } else if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  // Определяем, показывать ли превью
  const showPreview = thumbnailUrl && !imageError && (isImage || isPdf || isExcel);

  return (
    <div
      className={cn(
        "group relative rounded-lg border overflow-hidden transition-all duration-200",
        "hover:shadow-md hover:border-primary/50",
        compact ? "h-32" : "h-40"
      )}
    >
      {/* Preview Area */}
      <div className={cn(
        "relative w-full overflow-hidden",
        compact ? "h-20" : "h-28",
        getFileTypeBgColor(fileType)
      )}>
        {showPreview ? (
          <div className="relative w-full h-full">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={thumbnailUrl}
              alt={file.file_name}
              className={cn(
                "w-full h-full object-cover transition-opacity duration-300",
                imageLoaded ? "opacity-100" : "opacity-0",
                isImage && onImageClick && "cursor-pointer"
              )}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
              loading="lazy"
              onClick={() => isImage && onImageClick && thumbnailUrl && onImageClick(thumbnailUrl)}
            />
            {/* Бейдж типа файла */}
            {isPdf && (
              <div className="absolute top-1 left-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                PDF
              </div>
            )}
            {isExcel && (
              <div className="absolute top-1 left-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">
                XLSX
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <FileTypeIcon type={fileType} className="w-12 h-12" />
          </div>
        )}

        {/* Overlay with actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
          {onDownload || downloadUrl ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownload}
              className="h-8 w-8 p-0"
            >
              <Download className="w-4 h-4" />
            </Button>
          ) : null}
          {onDelete && (
            <Button
              size="sm"
              variant="destructive"
              onClick={onDelete}
              className="h-8 w-8 p-0"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* File Info */}
      <div className={cn("p-2 bg-background", compact ? "space-y-0.5" : "space-y-1")}>
        <p className={cn(
          "font-medium truncate",
          compact ? "text-xs" : "text-sm"
        )} title={file.file_name}>
          {file.file_name}
        </p>
        <p className={cn(
          "text-muted-foreground",
          compact ? "text-xs" : "text-xs"
        )}>
          {formatFileSize(file.file_size)}
        </p>
      </div>
    </div>
  );
}
