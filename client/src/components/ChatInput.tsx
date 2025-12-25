import { useState, useRef, KeyboardEvent, useCallback, ClipboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmojiPickerPopover } from "./EmojiPickerPopover";
import { useToast } from "@/hooks/use-toast";

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  placeholder?: string;
  userId?: string; // Required for image upload
}

export function ChatInput({ onSend, disabled = false, placeholder = "Введите сообщение...", userId }: ChatInputProps) {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const uploadImage = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/objects/upload', {
      method: 'POST',
      headers: {
        'x-user-id': userId || '',
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Ошибка загрузки изображения');
    }

    const data = await response.json();
    return data.objectPath;
  };

  const handleSend = async () => {
    const trimmedContent = content.trim();
    if ((!trimmedContent && !pastedImage) || disabled || isUploading) return;

    let messageToSend = trimmedContent;

    // Upload image if present
    if (pastedImage) {
      setIsUploading(true);
      try {
        const imageUrl = await uploadImage(pastedImage);
        messageToSend = messageToSend
          ? `${messageToSend}\n[img]${imageUrl}[/img]`
          : `[img]${imageUrl}[/img]`;
        setPastedImage(null);
        setImagePreview(null);
      } catch (error) {
        toast({
          description: "Ошибка загрузки изображения",
          variant: "destructive"
        });
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    onSend(messageToSend);
    setContent("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter без Shift - отправить
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);

    // Auto-resize
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  // Insert emoji at cursor position
  const handleEmojiSelect = (emoji: string) => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.substring(0, start) + emoji + content.substring(end);

    setContent(newContent);

    // Set cursor position after emoji
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);

      // Trigger resize
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }, 0);
  };

  const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPastedImage(file);
          const reader = new FileReader();
          reader.onload = (event) => {
            setImagePreview(event.target?.result as string);
          };
          reader.readAsDataURL(file);
          toast({ description: "Изображение добавлено. Нажмите отправить." });
        }
        break;
      }
    }
  }, [toast]);

  const handleRemoveImage = useCallback(() => {
    setPastedImage(null);
    setImagePreview(null);
  }, []);

  return (
    <div className="border-t bg-background p-3 space-y-2">
      {/* Image preview */}
      {imagePreview && (
        <div className="relative inline-block mb-2">
          <img
            src={imagePreview}
            alt="Preview"
            className="max-h-32 rounded-lg border"
          />
          <Button
            size="icon"
            variant="destructive"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
            onClick={handleRemoveImage}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Message Input */}
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled || isUploading}
          className={cn(
            "min-h-[60px] max-h-[200px] resize-none",
            "text-sm",
            "focus-visible:ring-1"
          )}
          rows={2}
        />
        <EmojiPickerPopover
          onEmojiSelect={handleEmojiSelect}
          disabled={disabled || isUploading}
        />
        <Button
          onClick={handleSend}
          disabled={disabled || isUploading || (!content.trim() && !pastedImage)}
          size="sm"
          className="shrink-0 h-[60px]"
        >
          <Send className="w-4 h-4 mr-1.5" />
          Отправить
        </Button>
      </div>

      {/* Helper Text */}
      <p className="text-[10px] text-muted-foreground">
        <kbd className="px-1 py-0.5 text-[9px] bg-muted rounded border">Enter</kbd> для отправки,{" "}
        <kbd className="px-1 py-0.5 text-[9px] bg-muted rounded border">Shift+Enter</kbd> для новой строки,{" "}
        <kbd className="px-1 py-0.5 text-[9px] bg-muted rounded border">Ctrl+V</kbd> для вставки фото
      </p>
    </div>
  );
}
