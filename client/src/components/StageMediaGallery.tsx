import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Upload, X, Image as ImageIcon, Video, Mic, File, Loader2, Camera, Play, Pause, MessageCircle, ChevronDown, ChevronUp, Send, ZoomIn } from "lucide-react";
import type { StageDocument } from "@shared/schema";
import { saveMediaBlob, getMediaBlob, deleteMediaBlob } from "@/lib/mediaStorage";
import { useLightbox } from "@/contexts/LightboxContext";

interface StageMediaGalleryProps {
  stageId: string;
  mediaType: 'photo' | 'video' | 'audio' | 'document';
  title: string;
  icon: React.ReactNode;
  acceptedTypes: string;
  readOnly?: boolean;
}

export function StageMediaGallery({
  stageId,
  mediaType,
  title,
  icon,
  acceptedTypes,
  readOnly = false
}: StageMediaGalleryProps) {
  const { toast } = useToast();
  const { openLightbox } = useLightbox();
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Для медиа (фото, видео, аудио)
  const [mediaURLs, setMediaURLs] = useState<Record<string, string>>({});
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  // Для комментариев
  const [mediaComments, setMediaComments] = useState<Record<string, any[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [addingComment, setAddingComment] = useState<Record<string, boolean>>({});

  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  // Получаем документы по типу
  const { data: documents = [], isLoading } = useQuery<StageDocument[]>({
    queryKey: ['/api/stages', stageId, 'documents', 'type', mediaType],
    enabled: !!stageId,
  });

  // Мутация для загрузки файла
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }

      // Создаем запись в БД
      const result = await apiRequest('POST', `/api/stages/${stageId}/documents`, {
        media_type: mediaType,
        file_name: file.name,
        file_path: `/uploads/${stageId}/${file.name}`, // Заглушка
        file_size: file.size,
        mime_type: file.type,
        uploaded_by: user.id,
      });

      // Сохраняем файл в IndexedDB для локального хранения
      if (mediaType === 'photo' || mediaType === 'video' || mediaType === 'audio') {
        const documentId = result.id;
        await saveMediaBlob(documentId, file);

        // Создаем URL для отображения
        const url = URL.createObjectURL(file);
        setMediaURLs(prev => ({ ...prev, [documentId]: url }));
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents', 'type', mediaType] });
      queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents', 'stats'] });
      toast({ description: "Файл загружен" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка загрузки файла",
        variant: "destructive"
      });
    },
  });

  // Мутация для удаления файла
  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      await apiRequest('DELETE', `/api/stage-documents/${documentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents', 'type', mediaType] });
      queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents', 'stats'] });
      toast({ description: "Файл удален" });
    },
    onError: (error: Error) => {
      toast({
        description: error.message || "Ошибка удаления файла",
        variant: "destructive"
      });
    },
  });

  // Мутация для добавления комментария
  const addCommentMutation = useMutation({
    mutationFn: async ({ mediaId, comment }: { mediaId: string; comment: string }) => {
      if (!user?.id) {
        throw new Error("User not authenticated");
      }
      return await apiRequest('POST', `/api/stages/${stageId}/media/${mediaId}/comment`, {
        comment,
        user_id: user.id,
      });
    },
    onSuccess: async (newComment, variables) => {
      // Перезагружаем комментарии для этого медиа
      const comments = await apiRequest('GET', `/api/stages/${stageId}/media/${variables.mediaId}/comments`);
      setMediaComments(prev => ({ ...prev, [variables.mediaId]: comments }));
      setNewComment(prev => ({ ...prev, [variables.mediaId]: '' }));
      setAddingComment(prev => ({ ...prev, [variables.mediaId]: false }));
      toast({ description: "Комментарий добавлен" });
    },
    onError: (error: Error, variables) => {
      setAddingComment(prev => ({ ...prev, [variables.mediaId]: false }));
      toast({
        description: error.message || "Ошибка добавления комментария",
        variant: "destructive"
      });
    },
  });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (readOnly) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync(file);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileUpload(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDelete = async (documentId: string) => {
    if (confirm("Удалить этот файл?")) {
      // Удаляем из IndexedDB если это медиа файл
      if (mediaType === 'photo' || mediaType === 'video' || mediaType === 'audio') {
        try {
          await deleteMediaBlob(documentId);
          // Освобождаем URL
          if (mediaURLs[documentId]) {
            URL.revokeObjectURL(mediaURLs[documentId]);
            setMediaURLs(prev => {
              const newUrls = { ...prev };
              delete newUrls[documentId];
              return newUrls;
            });
          }
        } catch (error) {
          console.error('Error deleting media blob:', error);
        }
      }
      deleteMutation.mutate(documentId);
    }
  };

  // Обработка добавления комментария
  const handleAddComment = (mediaId: string) => {
    const comment = newComment[mediaId]?.trim();
    if (!comment || readOnly) return;

    setAddingComment(prev => ({ ...prev, [mediaId]: true }));
    addCommentMutation.mutate({ mediaId, comment });
  };

  // Форматирование времени
  const formatTime = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'только что';
    if (diffMins < 60) return `${diffMins} мин назад`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ч назад`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} дн назад`;

    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Загружаем медиа из IndexedDB при загрузке документов
  useEffect(() => {
    if ((mediaType === 'photo' || mediaType === 'video' || mediaType === 'audio') && documents.length > 0) {
      documents.forEach(async (doc) => {
        if (!mediaURLs[doc.id]) {
          try {
            const blob = await getMediaBlob(doc.id);
            if (blob) {
              const url = URL.createObjectURL(blob);
              setMediaURLs(prev => ({ ...prev, [doc.id]: url }));
            }
          } catch (error) {
            console.error('Error loading media blob:', error);
          }
        }
      });
    }
  }, [documents, mediaType]);

  // Загружаем комментарии для каждого документа
  useEffect(() => {
    if (documents.length > 0 && (mediaType === 'photo' || mediaType === 'video')) {
      documents.forEach(async (doc) => {
        try {
          const comments = await apiRequest('GET', `/api/stages/${stageId}/media/${doc.id}/comments`);
          setMediaComments(prev => ({ ...prev, [doc.id]: comments }));
        } catch (error) {
          console.error('Error loading comments:', error);
        }
      });
    }
  }, [documents, stageId, mediaType]);

  // Очистка URLs при unmount
  useEffect(() => {
    return () => {
      Object.values(mediaURLs).forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const fileName = `recording-${Date.now()}.webm`;

        // В реальном приложении здесь была бы загрузка на сервер
        // Пока создаем запись с заглушкой
        const documentData = {
          media_type: mediaType,
          file_name: fileName,
          file_path: `/uploads/${stageId}/${fileName}`, // Заглушка
          file_size: audioBlob.size,
          mime_type: 'audio/webm',
          uploaded_by: user?.id,
        };

        setUploading(true);
        try {
          const result = await apiRequest('POST', `/api/stages/${stageId}/documents`, documentData);

          // Сохраняем аудио Blob в IndexedDB
          const documentId = result.id;
          await saveMediaBlob(documentId, audioBlob);

          // Создаем URL для воспроизведения
          const url = URL.createObjectURL(audioBlob);
          setMediaURLs(prev => ({ ...prev, [documentId]: url }));

          queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents'] });
          queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents', 'type', mediaType] });
          queryClient.invalidateQueries({ queryKey: ['/api/stages', stageId, 'documents', 'stats'] });
          toast({ description: 'Аудио записано и загружено' });
        } catch (error) {
          console.error('Upload error:', error);
          toast({
            description: 'Ошибка загрузки аудио',
            variant: 'destructive'
          });
        } finally {
          setUploading(false);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      toast({ description: "Запись голоса началась" });
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        description: "Не удалось получить доступ к микрофону",
        variant: "destructive"
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      toast({ description: "Запись завершена" });
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Список файлов */}
      {documents.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {documents.map((doc) => (
            <Card key={doc.id} className="relative group hover:shadow-md transition-shadow">
              <CardContent className="p-3">
                <div className="flex flex-col items-center gap-2">
                  {/* Медиа файлы или иконка */}
                  {mediaType === 'photo' && mediaURLs[doc.id] ? (
                    <div
                      className="w-full aspect-square bg-accent rounded-md overflow-hidden cursor-pointer relative group/photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Собираем все фото галереи для навигации
                        const photoImages = documents
                          .filter(d => mediaURLs[d.id])
                          .map(d => ({
                            url: mediaURLs[d.id],
                            title: d.file_name || undefined
                          }));
                        const currentIdx = documents.findIndex(d => d.id === doc.id);
                        openLightbox(photoImages, currentIdx >= 0 ? currentIdx : 0);
                      }}
                    >
                      <img
                        src={mediaURLs[doc.id]}
                        alt={doc.file_name ?? ''}
                        className="w-full h-full object-cover"
                      />
                      {/* Иконка увеличения при наведении */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                        <ZoomIn className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  ) : mediaType === 'video' && mediaURLs[doc.id] ? (
                    <div className="w-full aspect-square bg-accent rounded-md overflow-hidden">
                      <video
                        controls
                        src={mediaURLs[doc.id]}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : mediaType === 'audio' && mediaURLs[doc.id] ? (
                    <div className="w-full">
                      <audio
                        controls
                        src={mediaURLs[doc.id]}
                        className="w-full"
                        style={{ height: '40px' }}
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-accent rounded-md flex items-center justify-center">
                      {mediaType === 'photo' && <ImageIcon className="w-12 h-12 text-muted-foreground" />}
                      {mediaType === 'video' && <Video className="w-12 h-12 text-muted-foreground" />}
                      {mediaType === 'audio' && <Mic className="w-12 h-12 text-muted-foreground" />}
                      {mediaType === 'document' && <File className="w-12 h-12 text-muted-foreground" />}
                    </div>
                  )}

                  {/* Название файла */}
                  <p className="text-xs text-center truncate w-full" title={doc.file_name ?? undefined}>
                    {doc.file_name}
                  </p>

                  {/* Размер файла */}
                  {doc.file_size && (
                    <Badge variant="secondary" className="text-xs">
                      {(doc.file_size / 1024).toFixed(1)} KB
                    </Badge>
                  )}

                  {/* Комментарии к фото/видео */}
                  {(mediaType === 'photo' || mediaType === 'video') && (
                    <div className="w-full mt-2 border-t pt-2">
                      {/* Кнопка раскрытия комментариев */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-between text-xs h-8 px-2"
                        onClick={() => setExpandedComments(prev => ({ ...prev, [doc.id]: !prev[doc.id] }))}
                      >
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-4 h-4" />
                          Комментарии ({mediaComments[doc.id]?.length || 0})
                        </span>
                        {expandedComments[doc.id] ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>

                      {/* Список комментариев */}
                      {expandedComments[doc.id] && (
                        <div className="mt-2 space-y-2">
                          {/* Существующие комментарии */}
                          {mediaComments[doc.id]?.map((comment) => (
                            <div key={comment.id} className="bg-accent/50 rounded p-2 text-xs">
                              <div className="flex justify-between items-start gap-2 mb-1">
                                <span className="font-medium text-foreground">
                                  {comment.user_name || comment.username}
                                </span>
                                <span className="text-muted-foreground text-[10px]">
                                  {formatTime(comment.created_at)}
                                </span>
                              </div>
                              <p className="text-foreground" style={{ fontSize: '13px' }}>
                                {comment.comment}
                              </p>
                            </div>
                          ))}

                          {/* Поле добавления нового комментария */}
                          {!readOnly && (
                            <div className="flex gap-2">
                              <Input
                                value={newComment[doc.id] || ''}
                                onChange={(e) => setNewComment(prev => ({ ...prev, [doc.id]: e.target.value }))}
                                placeholder="Добавить комментарий..."
                                className="flex-1 text-xs h-9"
                                style={{ fontSize: '14px' }}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    handleAddComment(doc.id);
                                  }
                                }}
                                disabled={addingComment[doc.id]}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddComment(doc.id)}
                                disabled={!newComment[doc.id]?.trim() || addingComment[doc.id]}
                                className="h-9 px-3"
                              >
                                {addingComment[doc.id] ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Кнопка удаления */}
                  {!readOnly && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Зона загрузки */}
      {!readOnly && (
        <div className="space-y-2">
          {/* Кнопки для мобильных устройств (фото/видео) */}
          {(mediaType === 'photo' || mediaType === 'video') && (
            <div className="grid grid-cols-1 gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 flex items-center justify-center gap-2"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="w-5 h-5" />
                <span className="text-sm">
                  {mediaType === 'photo' ? 'Снять фото или выбрать' : 'Записать видео или выбрать'}
                </span>
              </Button>
            </div>
          )}

          {/* Кнопки для аудио записи */}
          {mediaType === 'audio' && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={isRecording ? "destructive" : "outline"}
                className="w-full h-12 flex items-center justify-center gap-2"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={uploading}
              >
                <Mic className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`} />
                <span className="text-sm">
                  {isRecording ? `Остановить ${formatRecordingTime(recordingTime)}` : 'Записать голос'}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 flex items-center justify-center gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || isRecording}
              >
                <Upload className="w-5 h-5" />
                <span className="text-sm">Выбрать файл</span>
              </Button>
            </div>
          )}

          {/* Стандартная зона загрузки для документов и desktop */}
          <div
            className={`relative border-2 border-dashed rounded-lg p-3 transition-all duration-200 ${
              isDragging
                ? 'border-primary bg-primary/10 scale-[1.02]'
                : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50'
            } ${(mediaType === 'photo' || mediaType === 'video' || mediaType === 'audio') ? 'hidden md:block' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex flex-col items-center gap-1.5">
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <p className="text-xs font-medium">Загрузка...</p>
                </>
              ) : (
                <>
                  <Upload className={`w-6 h-6 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="text-center">
                    <p className="text-xs font-medium">
                      Перетащите или нажмите
                    </p>
                  </div>
                </>
              )}

              <Input
                ref={fileInputRef}
                type="file"
                multiple
                accept={acceptedTypes}
                onChange={(e) => handleFileUpload(e.target.files)}
                disabled={uploading}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
          </div>

          {/* Скрытый input для камеры (мобильные устройства) */}
          {(mediaType === 'photo' || mediaType === 'video') && (
            <Input
              ref={cameraInputRef}
              type="file"
              accept={acceptedTypes}
              capture={mediaType === 'photo' ? 'environment' : 'user'}
              multiple
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={uploading}
              className="hidden"
            />
          )}
        </div>
      )}

      {/* Пустое состояние */}
      {documents.length === 0 && readOnly && (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">Нет загруженных файлов</p>
        </div>
      )}
    </div>
  );
}
