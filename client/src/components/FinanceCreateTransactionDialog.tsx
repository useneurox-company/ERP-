import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { insertFinancialTransactionSchema, type Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface FinanceCreateTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const incomeCategories = [
  "Продажа мебели",
  "Аванс",
  "Окончательная оплата",
  "Услуги по установке",
];

const expenseCategories = [
  "Зарплата",
  "Материалы",
  "Аренда",
  "Коммунальные услуги",
  "Транспорт",
  "Инструменты",
];

export function FinanceCreateTransactionDialog({ 
  open, 
  onOpenChange 
}: FinanceCreateTransactionDialogProps) {
  const [transactionType, setTransactionType] = useState<"income" | "expense">("income");
  const { toast } = useToast();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const form = useForm({
    resolver: zodResolver(insertFinancialTransactionSchema),
    defaultValues: {
      type: "income" as const,
      amount: "",
      category: "",
      description: "",
      project_id: "",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const transactionData = {
        ...data,
        type: transactionType,
        amount: data.amount.toString(),
        project_id: data.project_id || null,
        description: data.description || null,
        date: new Date(data.date).toISOString(),
      };
      await apiRequest("POST", "/api/finance/transactions", transactionData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/stats"] });
      toast({
        title: "Успешно",
        description: "Транзакция создана",
      });
      form.reset();
      setTransactionType("income");
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
    createMutation.mutate(data);
  });

  const handleTypeChange = (type: "income" | "expense") => {
    setTransactionType(type);
    form.setValue("category", "");
  };

  const categories = transactionType === "income" ? incomeCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-finance-dialog-title">Новая транзакция</DialogTitle>
          <DialogDescription data-testid="text-finance-dialog-description">
            Добавление финансовой операции
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <FormLabel>Тип транзакции</FormLabel>
              <Tabs 
                value={transactionType} 
                onValueChange={(v) => handleTypeChange(v as "income" | "expense")}
                className="w-full mt-2"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="income" data-testid="tab-transaction-type-income">
                    Доход
                  </TabsTrigger>
                  <TabsTrigger value="expense" data-testid="tab-transaction-type-expense">
                    Расход
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

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
                      step="0.01"
                      placeholder="0.00" 
                      data-testid="input-finance-amount"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Категория</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl>
                      <SelectTrigger data-testid="select-finance-category">
                        <SelectValue placeholder="Выберите категорию" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem 
                          key={category} 
                          value={category}
                          data-testid={`option-finance-category-${category}`}
                        >
                          {category}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Описание (опционально)</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Дополнительная информация о транзакции"
                      rows={3}
                      data-testid="textarea-finance-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="project_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Проект (опционально)</FormLabel>
                  <Select onValueChange={(value) => field.onChange(value === "none" ? null : value)} value={field.value || "none"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-finance-project">
                        <SelectValue placeholder="Выберите проект" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none" data-testid="option-finance-project-none">
                        Без проекта
                      </SelectItem>
                      {projects.map((project) => (
                        <SelectItem 
                          key={project.id} 
                          value={project.id}
                          data-testid={`option-finance-project-${project.id}`}
                        >
                          {project.name} - {project.client_name}
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
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Дата</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      type="date" 
                      data-testid="input-finance-date"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1"
                data-testid="button-cancel-finance-transaction"
              >
                Отмена
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="flex-1"
                data-testid="button-submit-finance-transaction"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
