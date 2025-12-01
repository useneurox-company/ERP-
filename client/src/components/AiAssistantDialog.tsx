import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Upload, Sparkles, FileText, User, Bot, AlertCircle } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AiChatMessage } from "@shared/schema";

interface AiAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  userId: string;
  dealName?: string;
}

export function AiAssistantDialog({
  open,
  onOpenChange,
  dealId,
  userId,
  dealName
}: AiAssistantDialogProps) {
  const [message, setMessage] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const { data: history = [], isLoading } = useQuery<AiChatMessage[]>({
    queryKey: ["/api/ai", dealId, "history"],
    enabled: open && !!dealId,
  });

  const chatMutation = useMutation({
    mutationFn: async (data: { message: string }) => {
      return await apiRequest("POST", `/api/ai/chat`, {
        dealId,
        userId,
        message: data.message,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai", dealId, "history"] });
      setMessage("");
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Ошибка",
        description: error.message || "Не удалось отправить сообщение",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
    } else {
      toast({
        variant: "destructive",
        title: "Неверный формат",
        description: "Пожалуйста, выберите PDF файл",
      });
    }
  };

  const analyzePdf = async () => {
    if (!pdfFile) return;

    setIsAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = e.target?.result?.toString();
          if (!result) {
            throw new Error("Не удалось прочитать файл");
          }
          const base64 = result.split(",")[1];
          if (!base64) {
            throw new Error("Не удалось извлечь данные из файла");
          }
          
          await apiRequest("POST", `/api/ai/analyze`, {
            dealId,
            userId,
            base64Pdf: base64,
            message: message || undefined,
          });

          queryClient.invalidateQueries({ queryKey: ["/api/ai", dealId, "history"] });
          setPdfFile(null);
          setMessage("");
          
          toast({
            title: "Анализ завершён",
            description: "Чертёж проанализирован, расчёт готов",
          });
        } catch (error: any) {
          toast({
            variant: "destructive",
            title: "Ошибка анализа",
            description: error.message || "Не удалось проанализировать PDF",
          });
        } finally {
          setIsAnalyzing(false);
        }
      };
      reader.onerror = () => {
        toast({
          variant: "destructive",
          title: "Ошибка загрузки",
          description: "Не удалось прочитать PDF файл",
        });
        setIsAnalyzing(false);
      };
      reader.readAsDataURL(pdfFile);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка загрузки файла",
        description: error.message || "Не удалось прочитать PDF",
      });
      setIsAnalyzing(false);
    }
  };

  const handleSend = () => {
    if (!message.trim()) return;
    chatMutation.mutate({ message });
  };

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [history]);

  const renderMessageContent = (content: string, role: string) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.items && parsed.totalCost) {
        return (
          <div className="space-y-3">
            {parsed.items.map((item: any, idx: number) => (
              <Card key={idx} className="p-3">
                <div className="font-medium text-sm">{item.name}</div>
                {item.description && (
                  <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                )}
                {item.materials && (
                  <div className="mt-2 space-y-1">
                    {item.materials.map((mat: any, midx: number) => (
                      <div key={midx} className="text-xs flex justify-between">
                        <span>{mat.name}</span>
                        <span className="text-muted-foreground">
                          {mat.quantity} {mat.unit} × {mat.price} руб
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {item.labor && (
                  <div className="text-xs mt-1 flex justify-between">
                    <span>Работа:</span>
                    <span className="text-muted-foreground">{item.labor} руб</span>
                  </div>
                )}
                <div className="text-sm font-semibold mt-2 flex justify-between border-t pt-2">
                  <span>Итого:</span>
                  <span>{item.total} руб</span>
                </div>
              </Card>
            ))}
            <div className="text-base font-bold flex justify-between mt-4 p-3 bg-primary/5 rounded-md">
              <span>Общая стоимость:</span>
              <span className="text-primary">{parsed.totalCost} руб</span>
            </div>
            {parsed.notes && (
              <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                {parsed.notes}
              </div>
            )}
          </div>
        );
      }
    } catch {
      // Not JSON, render as text
    }
    return <div className="text-sm whitespace-pre-wrap">{content}</div>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Ассистент {dealName && `- ${dealName}`}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Загрузите чертёж или задайте вопрос</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {renderMessageContent(msg.content, msg.role)}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="border-t pt-4 space-y-3">
          {pdfFile && (
            <Card className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm truncate max-w-[300px]">{pdfFile.name}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPdfFile(null)}
                data-testid="button-remove-pdf"
              >
                Удалить
              </Button>
            </Card>
          )}

          <div className="flex gap-2">
            <Input
              type="file"
              accept=".pdf"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isAnalyzing || chatMutation.isPending}
              data-testid="button-upload-pdf"
            >
              <Upload className="w-4 h-4" />
            </Button>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={pdfFile ? "Опишите задачу (опционально)..." : "Задайте вопрос..."}
              className="resize-none min-h-[60px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (pdfFile) {
                    analyzePdf();
                  } else {
                    handleSend();
                  }
                }
              }}
              data-testid="input-ai-message"
            />
            <Button
              size="icon"
              onClick={pdfFile ? analyzePdf : handleSend}
              disabled={(!message.trim() && !pdfFile) || isAnalyzing || chatMutation.isPending}
              data-testid="button-send-ai-message"
            >
              {isAnalyzing || chatMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
