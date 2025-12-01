import { Router } from "express";
import { productionRepository } from "./repository";
import { insertProductionTaskSchema, insertProductionStageSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export const router = Router();

// ========== Production Endpoints ==========

// GET /api/production - Get all production tasks
router.get("/api/production", async (req, res) => {
  try {
    const { status } = req.query;
    const tasks = await productionRepository.getAllProductionTasks(status as string | undefined);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching production tasks:", error);
    res.status(500).json({ error: "Failed to fetch production tasks" });
  }
});

// GET /api/production/:id - Get production task by ID with stages
router.get("/api/production/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const task = await productionRepository.getProductionTaskById(id);
    
    if (!task) {
      res.status(404).json({ error: "Production task not found" });
      return;
    }
    
    res.json(task);
  } catch (error) {
    console.error("Error fetching production task:", error);
    res.status(500).json({ error: "Failed to fetch production task" });
  }
});

// POST /api/production - Create new production task
router.post("/api/production", async (req, res) => {
  try {
    const validationResult = insertProductionTaskSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newTask = await productionRepository.createProductionTask(validationResult.data);
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Error creating production task:", error);
    res.status(500).json({ error: "Failed to create production task" });
  }
});

// PUT /api/production/:id - Update production task
router.put("/api/production/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertProductionTaskSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const updatedTask = await productionRepository.updateProductionTask(id, validationResult.data);
    
    if (!updatedTask) {
      res.status(404).json({ error: "Production task not found" });
      return;
    }
    
    res.json(updatedTask);
  } catch (error) {
    console.error("Error updating production task:", error);
    res.status(500).json({ error: "Failed to update production task" });
  }
});

// DELETE /api/production/:id - Delete production task
router.delete("/api/production/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await productionRepository.deleteProductionTask(id);
    
    if (!deleted) {
      res.status(404).json({ error: "Production task not found" });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting production task:", error);
    res.status(500).json({ error: "Failed to delete production task" });
  }
});

// GET /api/production/:id/stages - Get all stages for a production task
router.get("/api/production/:id/stages", async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await productionRepository.getProductionTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Production task not found" });
      return;
    }
    
    const stages = await productionRepository.getProductionStages(id);
    res.json(stages);
  } catch (error) {
    console.error("Error fetching production stages:", error);
    res.status(500).json({ error: "Failed to fetch production stages" });
  }
});

// POST /api/production/:id/stages - Create stage for production task
router.post("/api/production/:id/stages", async (req, res) => {
  try {
    const { id } = req.params;
    
    const task = await productionRepository.getProductionTaskById(id);
    if (!task) {
      res.status(404).json({ error: "Production task not found" });
      return;
    }
    
    const validationResult = insertProductionStageSchema.safeParse({
      ...req.body,
      task_id: id
    });
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newStage = await productionRepository.createProductionStage(validationResult.data);
    res.status(201).json(newStage);
  } catch (error) {
    console.error("Error creating production stage:", error);
    res.status(500).json({ error: "Failed to create production stage" });
  }
});

// PUT /api/production/stages/:stageId - Update production stage
router.put("/api/production/stages/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params;
    const validationResult = insertProductionStageSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const updatedStage = await productionRepository.updateProductionStage(stageId, validationResult.data);
    
    if (!updatedStage) {
      res.status(404).json({ error: "Production stage not found" });
      return;
    }
    
    res.json(updatedStage);
  } catch (error) {
    console.error("Error updating production stage:", error);
    res.status(500).json({ error: "Failed to update production stage" });
  }
});

// DELETE /api/production/stages/:stageId - Delete production stage
router.delete("/api/production/stages/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params;
    const deleted = await productionRepository.deleteProductionStage(stageId);
    
    if (!deleted) {
      res.status(404).json({ error: "Production stage not found" });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting production stage:", error);
    res.status(500).json({ error: "Failed to delete production stage" });
  }
});
