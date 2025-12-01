import { Router } from "express";
import { financeRepository } from "./repository";
import { insertFinancialTransactionSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export const router = Router();

// ========== Finance Endpoints ==========

// GET /api/finance/transactions - Get all financial transactions
router.get("/api/finance/transactions", async (req, res) => {
  try {
    const { type, from, to } = req.query;
    
    const fromDate = from ? new Date(from as string) : undefined;
    const toDate = to ? new Date(to as string) : undefined;
    
    const transactions = await financeRepository.getAllFinancialTransactions(
      type as string | undefined,
      fromDate,
      toDate
    );
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching financial transactions:", error);
    res.status(500).json({ error: "Failed to fetch financial transactions" });
  }
});

// POST /api/finance/transactions - Create financial transaction
router.post("/api/finance/transactions", async (req, res) => {
  try {
    const validationResult = insertFinancialTransactionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newTransaction = await financeRepository.createFinancialTransaction(validationResult.data);
    res.status(201).json(newTransaction);
  } catch (error) {
    console.error("Error creating financial transaction:", error);
    res.status(500).json({ error: "Failed to create financial transaction" });
  }
});

// GET /api/finance/stats - Get financial statistics
router.get("/api/finance/stats", async (req, res) => {
  try {
    const stats = await financeRepository.getFinancialStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching financial stats:", error);
    res.status(500).json({ error: "Failed to fetch financial stats" });
  }
});

// GET /api/finance/projects/:projectId - Get project financials
router.get("/api/finance/projects/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const financials = await financeRepository.getProjectFinancials(projectId);
    res.json(financials);
  } catch (error) {
    console.error("Error fetching project financials:", error);
    res.status(500).json({ error: "Failed to fetch project financials" });
  }
});
