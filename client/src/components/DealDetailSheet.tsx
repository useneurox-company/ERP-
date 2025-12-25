import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Loader2, User as UserIcon } from "lucide-react";
import { insertDealSchema, type Deal, type User } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DealDetailSheetProps {
  deal: Deal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DealDetailSheet({ deal, open, onOpenChange }: DealDetailSheetProps) {
  const [newTag, setNewTag] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const form = useForm({
    resolver: zodResolver(insertDealSchema),
    defaultValues: {
      title: deal?.title || "",
      client_name: deal?.client_name || "",
      company: deal?.company || "",
      amount: deal?.amount || "",
      stage: deal?.stage || "new",
      deadline: deal?.deadline ? new Date(deal.deadline).toISOString().slice(0, 16) : "",
      manager_id: deal?.manager_id || "",
      tags: deal?.tags || [],
    },
  });

  useEffect(() => {
    if (deal) {
      form.reset({
        title: deal.title || "",
        client_name: deal.client_name || "",
        company: deal.company || "",
        amount: deal.amount || "",
        stage: deal.stage || "new",
        deadline: deal.deadline ? new Date(deal.deadline).toISOString().slice(0, 16) : "",
        manager_id: deal.manager_id || "",
        tags: deal.tags || [],
      });
    }
  }, [deal, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const dealData = {
        ...data,
        title: data.title || null,
        amount: data.amount || null,
        company: data.company || null,
        deadline: data.deadline ? new Date(data.deadline).toISOString() : null,
        manager_id: data.manager_id || null,
        tags: data.tags.length > 0 ? data.tags : null,
      };
      await apiRequest("PUT", `/api/deals/${deal?.id}`, dealData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ['/api/activity-logs', 'deal', deal?.id] });
      toast({
        title: "Успешно",
        description: "Сделка обновлена",
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/deals/${deal?.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      toast({
        title: "Успешно",
        description: "Сделка удалена",
      });
      setShowDeleteDialog(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Ошибка",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    updateMutation.mutate(data);
  });

  const handleAddTag = () => {
    if (newTag.trim()) {
      const currentTags = (form.getValues("tags") as string[]) || [];
      form.setValue("tags", [...currentTags, newTag.trim()] as any);
      setNewTag("");
    }
  };

  const handleRemoveTag = (index: number) => {
    const currentTags = (form.getValues("tags") as string[]) || [];
    form.setValue("tags", currentTags.filter((_: string, i: number) => i !== index) as any);
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const stageLabels: Record<string, string> = {
    new: "Новые",
    meeting: "Встреча назначена",
    proposal: "КП отправлено",
    contract: "Договор",
    won: "Выиграна",
    lost: "Проиграна",
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle data-testid="text-sheet-title">Детали сделки</SheetTitle>
            <SheetDescription data-testid="text-sheet-description">
              Редактирование информации о сделке
            </SheetDescription>
            {deal && (deal as any).manager_user && (
              <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                <UserIcon className="h-4 w-4" />
                <span>
                  Менеджер: <span className="font-medium text-foreground">
                    {(deal as any).manager_user.full_name || (deal as any).manager_user.username}
                  </span>
                </span>
              </div>
            )}
          </SheetHeader>

          <Form {...form}>
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название сделки</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="Например: Кухня для Ивановых"
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Клиент</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Имя клиента"
                        data-testid="input-client-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Компания</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Название компании" 
                        data-testid="input-company"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сумма</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="number" 
                        placeholder="0.00" 
                        data-testid="input-amount"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Стадия</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-stage">
                          <SelectValue placeholder="Выберите стадию" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="new" data-testid="option-stage-new">
                          {stageLabels.new}
                        </SelectItem>
                        <SelectItem value="meeting" data-testid="option-stage-meeting">
                          {stageLabels.meeting}
                        </SelectItem>
                        <SelectItem value="proposal" data-testid="option-stage-proposal">
                          {stageLabels.proposal}
                        </SelectItem>
                        <SelectItem value="contract" data-testid="option-stage-contract">
                          {stageLabels.contract}
                        </SelectItem>
                        <SelectItem value="won" data-testid="option-stage-won">
                          {stageLabels.won}
                        </SelectItem>
                        <SelectItem value="lost" data-testid="option-stage-lost">
                          {stageLabels.lost}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Срок</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="datetime-local" 
                        data-testid="input-deadline"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="manager_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Менеджер</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-manager">
                          <SelectValue placeholder="Выберите менеджера" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem 
                            key={user.id} 
                            value={user.id}
                            data-testid={`option-manager-${user.id}`}
                          >
                            {user.full_name || user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Теги</FormLabel>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <Input
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          placeholder="Добавить тег"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddTag();
                            }
                          }}
                          data-testid="input-new-tag"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleAddTag}
                          data-testid="button-add-tag"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(field.value as string[] | undefined)?.map((tag: string, index: number) => (
                          <Badge 
                            key={index} 
                            variant="secondary"
                            data-testid={`tag-${index}`}
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(index)}
                              className="ml-1 hover:text-destructive"
                              data-testid={`button-remove-tag-${index}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex gap-2 pt-4">
                <Button 
                  type="submit" 
                  disabled={updateMutation.isPending}
                  className="flex-1"
                  data-testid="button-save-deal"
                >
                  {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Сохранить
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteMutation.isPending}
                  data-testid="button-delete-deal"
                >
                  Удалить
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent data-testid="dialog-delete-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-title">
              Подтвердите удаление
            </AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              Вы уверены, что хотите удалить эту сделку? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
