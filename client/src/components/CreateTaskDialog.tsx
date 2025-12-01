import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, X, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  stageId?: string;
  dealId?: string;
  projectItemId?: string;
  itemName?: string;
  onSuccess?: () => void;
}

export function CreateTaskDialog({ open, onOpenChange, projectId, stageId, dealId, projectItemId, itemName, onSuccess }: CreateTaskDialogProps) {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium',
    deadline: '',
    assignee_id: '',
  });

  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  // File handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      const newFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...newFiles]);
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
      setFiles(prev => [...prev, ...newFiles]);
      toast({
        title: "Файл добавлен",
        description: `Добавлено файлов из буфера обмена: ${newFiles.length}`,
      });
    }
  };

  const createTaskMutation = useMutation({
    mutationFn: async (taskData: any) => {
      const payload = {
        title: taskData.title,
        description: taskData.description || null,
        status: 'new',
        priority: taskData.priority,
        deadline: taskData.deadline || null,
        assignee_id: taskData.assignee_id === 'none' || !taskData.assignee_id ? null : taskData.assignee_id,
        project_id: projectId || null,
        project_stage_id: stageId || null,
        deal_id: dealId || null,
        project_item_id: projectItemId || null,
        created_by: user?.id,
      };

      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to create task');
      return response.json();
    },
    onSuccess: async (newTask) => {
      // Upload files if any
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('userId', user?.id || '');

          try {
            await fetch(`/api/tasks/${newTask.id}/attachments`, {
              method: 'POST',
              body: formData,
            });
          } catch (error) {
            console.error('Failed to upload file:', error);
          }
        }
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      if (stageId) {
        queryClient.invalidateQueries({ queryKey: [`/api/stages/${stageId}/tasks`] });
      }
      if (dealId) {
        queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/tasks`] });
      }
      if (projectItemId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/items/${projectItemId}/tasks`] });
      }
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['/api/projects', projectId, 'tasks'] });
      }

      // Reset form
      onOpenChange(false);
      setNewTask({
        title: '',
        description: '',
        priority: 'medium',
        deadline: '',
        assignee_id: '',
      });
      setFiles([]);

      toast({
        title: "Задача создана",
        description: "Новая задача успешно добавлена к этапу",
      });

      if (onSuccess) {
        onSuccess();
      }
    },
    onError: () => {
      toast({
        title: "Ошибка",
        description: "Не удалось создать задачу",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTask.title.trim()) {
      createTaskMutation.mutate(newTask);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Создать задачу</DialogTitle>
          <DialogDescription>
            {projectItemId && itemName
              ? `Задача будет привязана к позиции: ${itemName}`
              : dealId
              ? "Задача будет привязана к текущей сделке"
              : stageId
              ? "Задача будет автоматически привязана к текущему этапу проекта"
              : "Создайте новую задачу"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="task-title">Название *</Label>
            <Input
              id="task-title"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="Введите название задачи"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-description">Описание</Label>
            <Textarea
              id="task-description"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Опишите задачу"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="task-priority">Приоритет</Label>
              <Select
                value={newTask.priority}
                onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Низкий</SelectItem>
                  <SelectItem value="medium">Средний</SelectItem>
                  <SelectItem value="high">Высокий</SelectItem>
                  <SelectItem value="urgent">Срочный</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="task-deadline">Дедлайн</Label>
              <Input
                id="task-deadline"
                type="date"
                value={newTask.deadline}
                onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-assignee">Исполнитель</Label>
            <Select
              value={newTask.assignee_id}
              onValueChange={(value) => setNewTask({ ...newTask, assignee_id: value })}
            >
              <SelectTrigger id="task-assignee">
                <SelectValue placeholder="Выберите исполнителя" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name || u.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label>Файлы</Label>
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onPaste={handlePaste}
              onClick={() => fileInputRef.current?.click()}
              tabIndex={0}
            >
              <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Перетащите файлы сюда, кликните для выбора или используйте Ctrl+V
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Максимальный размер файла: 10MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Selected Files */}
            {files.length > 0 && (
              <div className="space-y-2 mt-3">
                {files.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                  >
                    <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => handleRemoveFile(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Отмена
            </Button>
            <Button
              type="submit"
              disabled={!newTask.title.trim() || createTaskMutation.isPending}
            >
              {createTaskMutation.isPending ? "Создание..." : "Создать задачу"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
