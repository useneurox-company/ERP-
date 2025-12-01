import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUserId } from "@/lib/queryClient";
import {
  Calendar,
  Clock,
  User,
  Paperclip,
  Download,
  Trash2,
  Send,
  Upload,
  FileIcon,
  X,
  Briefcase,
  ExternalLink,
  Layers,
  Package
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { useLocation } from "wouter";
import { FilePreview } from "@/components/FilePreview";

interface TaskDetailDialogProps {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  deadline: string | null;
  assignee_id: string | null;
  assignee?: {
    id: string;
    username: string;
    full_name: string | null;
  };
  project_id: string | null;
  project_stage_id: string | null;
  deal_id: string | null;
  project_item_id: string | null;
  project?: {
    id: string;
    name: string;
  };
  stage?: {
    id: string;
    name: string;
  };
  project_item?: {
    id: string;
    name: string;
    article: string | null;
    quantity: number;
  };
  created_at: string;
  updated_at: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string;
  created_at: string;
  uploaded_by_user?: {
    id: string;
    username: string;
    full_name: string | null;
  };
}

interface Comment {
  id: string;
  content: string;
  author_id: string;
  created_at: string;
  author?: {
    id: string;
    username: string;
    full_name: string | null;
  };
}

const statusOptions = [
  { value: "new", label: "Новая", color: "bg-slate-500", textColor: "text-white" },
  { value: "pending", label: "В ожидании", color: "bg-gray-500", textColor: "text-white" },
  { value: "in_progress", label: "В работе", color: "bg-blue-500", textColor: "text-white" },
  { value: "pending_review", label: "На проверке", color: "bg-yellow-500", textColor: "text-white" },
  { value: "completed", label: "Завершена", color: "bg-green-500", textColor: "text-white" },
  { value: "rejected", label: "Отклонена", color: "bg-red-500", textColor: "text-white" },
  { value: "cancelled", label: "Отменена", color: "bg-gray-400", textColor: "text-white" },
  { value: "on_hold", label: "Приостановлена", color: "bg-purple-500", textColor: "text-white" },
];

const priorityOptions = [
  { value: "low", label: "Низкий", color: "bg-green-500", textColor: "text-white" },
  { value: "medium", label: "Средний", color: "bg-yellow-500", textColor: "text-white" },
  { value: "high", label: "Высокий", color: "bg-orange-500", textColor: "text-white" },
  { value: "urgent", label: "Срочный", color: "bg-red-500", textColor: "text-white" },
];

export function TaskDetailDialog({ taskId, open, onOpenChange }: TaskDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [newComment, setNewComment] = useState("");

  // Fetch task details
  const { data: task, isLoading: taskLoading } = useQuery<Task>({
    queryKey: [`/api/tasks/${taskId}`],
    enabled: !!taskId && open,
  });

  // Fetch attachments
  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey: [`/api/tasks/${taskId}/attachments`],
    enabled: !!taskId && open,
  });

  // Fetch comments
  const { data: comments = [] } = useQuery<Comment[]>({
    queryKey: [`/api/tasks/${taskId}/comments`],
    enabled: !!taskId && open,
  });

  // Fetch all users for assignee selector
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    enabled: open,
  });

  // Fetch deal if task is linked to a deal
  const { data: deal } = useQuery<any>({
    queryKey: [`/api/deals/${task?.deal_id}`],
    enabled: !!task?.deal_id && open,
  });

  // Fetch project if task is linked to a project (only if not already in task)
  const { data: project } = useQuery<any>({
    queryKey: [`/api/projects/${task?.project_id}`],
    enabled: !!task?.project_id && !task?.project && open,
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (updates: Partial<Task>) => {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update task");
      return response.json();
    },
    onSuccess: () => {
      // Invalidate task details
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });

      // Invalidate project tasks if linked to project
      if (task?.project_id) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', task.project_id, 'tasks'] });
      }

      // Invalidate project item tasks if linked to project item
      if (task?.project_item_id && task?.project_id) {
        queryClient.invalidateQueries({
          queryKey: [`/api/projects/${task.project_id}/items/${task.project_item_id}/tasks`]
        });
      }

      // Invalidate stage tasks if linked to stage
      if (task?.project_stage_id) {
        queryClient.invalidateQueries({ queryKey: [`/api/stages/${task.project_stage_id}/tasks`] });
      }

      // Invalidate deal tasks if linked to deal
      if (task?.deal_id) {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${task.deal_id}/tasks`] });
      }

      toast({ title: "Задача обновлена" });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить задачу", variant: "destructive" });
    },
  });

  // Upload attachment mutation
  const uploadAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      const userId = getCurrentUserId();

      if (!userId) {
        throw new Error("User not authenticated");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("Failed to upload file");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/attachments`] });
      toast({ title: "Файл загружен" });
      setSelectedFiles([]);
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось загрузить файл", variant: "destructive" });
    },
  });

  // Delete attachment mutation
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const response = await fetch(`/api/tasks/${taskId}/attachments/${attachmentId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete attachment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/attachments`] });
      toast({ title: "Файл удален" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось удалить файл", variant: "destructive" });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const userId = getCurrentUserId();

      if (!userId) {
        throw new Error("User not authenticated");
      }

      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          author_id: userId,
        }),
      });
      if (!response.ok) throw new Error("Failed to add comment");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/comments`] });
      setNewComment("");
      toast({ title: "Комментарий добавлен" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось добавить комментарий", variant: "destructive" });
    },
  });

  const handleSaveEdit = () => {
    updateTaskMutation.mutate({
      title: editedTitle,
      description: editedDescription,
    });
  };

  const handleStatusChange = (status: string) => {
    updateTaskMutation.mutate({ status });
  };

  const handlePriorityChange = (priority: string) => {
    updateTaskMutation.mutate({ priority });
  };

  const handleAssigneeChange = (assignee_id: string) => {
    updateTaskMutation.mutate({ assignee_id });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...filesArray]);
    }
  };

  const handleUploadFiles = async () => {
    for (const file of selectedFiles) {
      await uploadAttachmentMutation.mutateAsync(file);
    }
  };

  const handleAddComment = () => {
    if (newComment.trim()) {
      addCommentMutation.mutate(newComment);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const newFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          // Валидация размера (10MB = 10 * 1024 * 1024)
          if (file.size > 10 * 1024 * 1024) {
            toast({
              title: "Ошибка",
              description: `Файл ${file.name} превышает максимальный размер 10MB`,
              variant: "destructive",
            });
            continue;
          }
          newFiles.push(file);
        }
      }
    }

    if (newFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...newFiles]);
      toast({
        title: "Файл добавлен",
        description: `Добавлено файлов из буфера обмена: ${newFiles.length}`,
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (!task && !taskLoading) return null;

  const currentStatus = statusOptions.find(s => s.value === task?.status);
  const currentPriority = priorityOptions.find(p => p.value === task?.priority);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4">
        {taskLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-muted-foreground">Загрузка...</div>
          </div>
        ) : task ? (
          <>
            {/* Header */}
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {isEditing ? (
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="text-xl font-semibold"
                    />
                  ) : (
                    <DialogTitle className="text-lg">{task.title}</DialogTitle>
                  )}
                </div>
                <div className="flex gap-2">
                  <Badge className={`${currentStatus?.color} ${currentStatus?.textColor}`}>
                    {currentStatus?.label}
                  </Badge>
                  <Badge className={`${currentPriority?.color} ${currentPriority?.textColor}`}>
                    {currentPriority?.label}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            {/* Main Content - Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-3">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 space-y-4">
                {/* Description */}
                <Card className="p-3">
                  <h3 className="font-semibold text-sm mb-2">Описание</h3>
                  {isEditing ? (
                    <Textarea
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      rows={4}
                      placeholder="Добавьте описание задачи..."
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {task.description || "Нет описания"}
                    </p>
                  )}
                  {isEditing ? (
                    <div className="flex gap-2 mt-4">
                      <Button size="sm" onClick={handleSaveEdit}>
                        Сохранить
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                        Отмена
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setEditedTitle(task.title);
                        setEditedDescription(task.description || "");
                        setIsEditing(true);
                      }}
                    >
                      Редактировать
                    </Button>
                  )}
                </Card>

                {/* Attachments */}
                <Card className="p-3" onPaste={handlePaste} tabIndex={0}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      Файлы ({attachments.length})
                    </h3>
                    <label>
                      <Input
                        type="file"
                        multiple
                        onChange={handleFileSelect}
                        className="hidden"
                      />
                      <Button size="sm" variant="outline" asChild>
                        <span className="cursor-pointer">
                          <Upload className="h-4 w-4 mr-2" />
                          Добавить файл
                        </span>
                      </Button>
                    </label>
                  </div>

                  {/* Selected files to upload */}
                  {selectedFiles.length > 0 && (
                    <div className="mb-4 p-3 bg-muted rounded-md">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">Выбрано файлов: {selectedFiles.length}</p>
                        <Button size="sm" onClick={handleUploadFiles}>
                          Загрузить все
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="truncate">{file.name}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Uploaded attachments */}
                  {attachments.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {attachments.map((attachment) => (
                        <FilePreview
                          key={attachment.id}
                          file={{
                            id: attachment.id,
                            file_name: attachment.file_name,
                            file_size: attachment.file_size,
                            mime_type: attachment.mime_type,
                            created_at: attachment.created_at
                          }}
                          downloadUrl={`/api/tasks/${taskId}/attachments/${attachment.id}/download`}
                          onDownload={() => window.open(`/api/tasks/${taskId}/attachments/${attachment.id}/download`, "_blank")}
                          onDelete={() => deleteAttachmentMutation.mutate(attachment.id)}
                          compact
                        />
                      ))}
                    </div>
                  ) : selectedFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Файлы отсутствуют. Используйте Ctrl+V для вставки из буфера обмена. Максимальный размер файла: 10 МБ
                    </p>
                  ) : null}
                </Card>

                {/* Comments */}
                <Card className="p-3">
                  <h3 className="font-semibold text-sm mb-3">Комментарии ({comments.length})</h3>
                  <div className="space-y-3 mb-3">
                    {comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {comment.author?.full_name?.[0] || comment.author?.username?.[0] || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {comment.author?.full_name || comment.author?.username}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {comment.created_at && !isNaN(new Date(comment.created_at).getTime())
                                ? format(new Date(comment.created_at), "d MMM yyyy HH:mm", { locale: ru })
                                : ""}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {comment.content}
                          </p>
                        </div>
                      </div>
                    ))}
                    {comments.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Комментариев пока нет
                      </p>
                    )}
                  </div>

                  {/* Add comment */}
                  <div className="flex gap-2">
                    <Textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Добавить комментарий..."
                      rows={2}
                      className="flex-1"
                    />
                    <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Right Column - Sidebar */}
              <div className="space-y-4">
                {/* Status */}
                <Card className="p-3">
                  <label className="text-sm font-medium mb-2 block">Статус</label>
                  <Select value={task.status} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${option.color}`} />
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>

                {/* Priority */}
                <Card className="p-3">
                  <label className="text-sm font-medium mb-2 block">Приоритет</label>
                  <Select value={task.priority} onValueChange={handlePriorityChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${option.color}`} />
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>

                {/* Assignee */}
                <Card className="p-3">
                  <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Исполнитель
                  </label>
                  <Select value={task.assignee_id || "none"} onValueChange={handleAssigneeChange}>
                    <SelectTrigger>
                      <SelectValue>
                        {task.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {task.assignee.full_name?.[0] || task.assignee.username[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span>{task.assignee.full_name || task.assignee.username}</span>
                          </div>
                        ) : (
                          "Не назначен"
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не назначен</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name || user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Card>

                {/* Deadline */}
                <Card className="p-3">
                  <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Срок выполнения
                  </label>
                  {task.deadline ? (
                    <div className="text-base font-semibold">
                      {format(new Date(task.deadline), "d MMMM yyyy", { locale: ru })}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">Не установлен</div>
                  )}
                </Card>

                {/* Timestamps */}
                <Card className="p-3">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Создана: {format(new Date(task.created_at), "d MMM yyyy", { locale: ru })}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Обновлена: {format(new Date(task.updated_at), "d MMM yyyy", { locale: ru })}</span>
                    </div>
                  </div>
                </Card>

                {/* Related Entity */}
                {(task.deal_id || task.project_id || task.project_stage_id || task.project_item_id) && (
                  <Card className="p-3">
                    <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Связано с
                    </label>
                    <div className="space-y-2">
                      {deal && (
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-auto py-3"
                          onClick={() => {
                            onOpenChange(false);
                            // Navigate to sales page with deal query param
                            setLocation(`/sales?dealId=${deal.id}`);
                          }}
                        >
                          <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground">Сделка</span>
                            <span className="font-medium text-sm truncate w-full text-left">
                              {deal.client_name}
                            </span>
                            {deal.order_number && (
                              <span className="text-xs text-muted-foreground">
                                Заказ #{deal.order_number}
                              </span>
                            )}
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </Button>
                      )}
                      {(task.project || project) && (
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-2 h-auto py-3"
                          onClick={() => {
                            onOpenChange(false);
                            setLocation(`/projects/${(task.project || project).id}`);
                          }}
                        >
                          <Briefcase className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex flex-col items-start gap-1 flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground">Проект</span>
                            <span className="font-medium text-sm truncate w-full text-left">
                              {(task.project || project).name}
                            </span>
                            {(task.project || project).project_number && (
                              <span className="text-xs text-muted-foreground">
                                №{(task.project || project).project_number}
                              </span>
                            )}
                          </div>
                          <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        </Button>
                      )}
                      {task.stage && (
                        <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                          <Layers className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground">Этап проекта</span>
                            <span className="text-sm font-medium truncate">
                              {task.stage.name}
                            </span>
                          </div>
                        </div>
                      )}
                      {task.project_item && (
                        <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md">
                          <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <span className="text-xs text-muted-foreground">Позиция проекта</span>
                            <span className="text-sm font-medium truncate">
                              {task.project_item.name}
                            </span>
                            {task.project_item.article && (
                              <span className="text-xs text-muted-foreground">
                                Артикул: {task.project_item.article}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              Количество: {task.project_item.quantity} шт.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
