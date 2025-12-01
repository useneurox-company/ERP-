import { db } from "../../db";
import { eq, and, gte, lte } from "drizzle-orm";
import type { FinancialTransaction, InsertFinancialTransaction } from "@shared/schema";
import { financial_transactions } from "@shared/schema";

export class FinanceRepository {
  async getAllFinancialTransactions(type?: string, from?: Date, to?: Date): Promise<FinancialTransaction[]> {
    let conditions = [];
    
    if (type) {
      conditions.push(eq(financial_transactions.type, type as any));
    }
    
    if (from) {
      conditions.push(gte(financial_transactions.date, from));
    }
    
    if (to) {
      conditions.push(lte(financial_transactions.date, to));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(financial_transactions).where(and(...conditions));
    }
    
    return await db.select().from(financial_transactions);
  }

  async createFinancialTransaction(data: InsertFinancialTransaction): Promise<FinancialTransaction> {
    const result = await db.insert(financial_transactions).values(data).returning();
    return result[0];
  }

  async getFinancialStats(): Promise<{
    totalIncome: number;
    totalExpense: number;
    profit: number;
    profitability: number;
  }> {
    const allTransactions = await this.getAllFinancialTransactions();
    
    const totalIncome = allTransactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const totalExpense = allTransactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const profit = totalIncome - totalExpense;
    const profitability = totalIncome > 0 ? (profit / totalIncome) * 100 : 0;
    
    return {
      totalIncome,
      totalExpense,
      profit,
      profitability
    };
  }

  async getProjectFinancials(projectId: string): Promise<{
    totalIncome: number;
    totalExpense: number;
    profit: number;
  }> {
    const transactions = await db.select()
      .from(financial_transactions)
      .where(eq(financial_transactions.project_id, projectId));
    
    const totalIncome = transactions
      .filter(t => t.type === "income")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const totalExpense = transactions
      .filter(t => t.type === "expense")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const profit = totalIncome - totalExpense;
    
    return {
      totalIncome,
      totalExpense,
      profit
    };
  }
}

export const financeRepository = new FinanceRepository();
