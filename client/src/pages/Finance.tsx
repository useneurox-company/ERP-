import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { FinancialTransaction } from "@shared/schema";

interface FinancialStats {
  totalIncome: number;
  totalExpense: number;
  profit: number;
  profitability: number;
}

interface ProjectFinancials {
  projectId: string;
  projectName?: string;
  totalIncome: number;
  totalExpense: number;
  profit: number;
}

export default function Finance() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<FinancialStats>({
    queryKey: ["/api/finance/stats"],
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery<FinancialTransaction[]>({
    queryKey: ["/api/finance/transactions"],
  });

  if (statsError) {
    toast({
      title: "Ошибка загрузки",
      description: "Не удалось загрузить финансовые данные",
      variant: "destructive",
    });
  }

  const isLoading = statsLoading || transactionsLoading;

  const expenses = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, t) => {
      const category = t.category;
      const amount = parseFloat(t.amount);
      const existing = acc.find(e => e.category === category);
      if (existing) {
        existing.amount += amount;
      } else {
        acc.push({ category, amount, type: "variable" });
      }
      return acc;
    }, [] as { category: string; amount: number; type: string }[]);

  const projectFinancials = transactions.reduce((acc, t) => {
    if (!t.project_id) return acc;
    
    const existing = acc.find(p => p.projectId === t.project_id);
    const amount = parseFloat(t.amount);
    
    if (existing) {
      if (t.type === "income") {
        existing.totalIncome += amount;
      } else {
        existing.totalExpense += amount;
      }
    } else {
      acc.push({
        projectId: t.project_id,
        totalIncome: t.type === "income" ? amount : 0,
        totalExpense: t.type === "expense" ? amount : 0,
        profit: 0,
      });
    }
    return acc;
  }, [] as ProjectFinancials[]);

  projectFinancials.forEach(p => {
    p.profit = p.totalIncome - p.totalExpense;
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `₽${(value / 1000000).toFixed(1)}М`;
    }
    return `₽${value.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-semibold">Финансы и отчеты</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">Управление расходами и доходами</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" data-testid={`skeleton-stat-${i}`} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Выручка за месяц"
            value={formatCurrency(stats?.totalIncome || 0)}
            change="+8% от прошлого"
            changeType="positive"
            icon={DollarSign}
          />
          <StatCard
            title="Расходы за месяц"
            value={formatCurrency(stats?.totalExpense || 0)}
            change="+5% от прошлого"
            changeType="negative"
            icon={TrendingDown}
          />
          <StatCard
            title="Прибыль"
            value={formatCurrency(stats?.profit || 0)}
            change="+12% от прошлого"
            changeType="positive"
            icon={TrendingUp}
          />
          <StatCard
            title="Рентабельность"
            value={`${(stats?.profitability || 0).toFixed(1)}%`}
            change="+2% от прошлого"
            changeType="positive"
            icon={Wallet}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Структура расходов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : expenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Нет данных о расходах</p>
            ) : (
              expenses.map((expense, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{expense.category}</span>
                      <Badge variant="outline" className="text-xs w-fit">
                        {expense.type === "fixed" ? "Постоянный" : "Переменный"}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">₽{expense.amount.toLocaleString()}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Рентабельность проектов</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-48" />
            ) : projectFinancials.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Нет данных по проектам</p>
            ) : (
              projectFinancials.map((project) => {
                const margin = project.totalIncome > 0 
                  ? ((project.profit / project.totalIncome) * 100).toFixed(1)
                  : "0";
                return (
                  <div key={project.projectId} className="p-3 rounded-md bg-muted/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Проект</span>
                      <Badge variant="outline" className="font-mono">#{project.projectId.slice(0, 8)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Выручка:</span>
                        <span className="ml-2 font-medium">₽{project.totalIncome.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Расходы:</span>
                        <span className="ml-2 font-medium">₽{project.totalExpense.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Прибыль:</span>
                        <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                          ₽{project.profit.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Маржа:</span>
                        <span className="ml-2 font-medium">{margin}%</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
