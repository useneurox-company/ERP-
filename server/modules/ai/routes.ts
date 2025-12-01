import { Router } from "express";
import { aiService } from "./service";
import { aiRepository } from "./repository";
import { insertAiCorrectionSchema, insertMaterialPriceSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

const router = Router();

router.post("/api/ai/chat", async (req, res) => {
  try {
    const { dealId, userId, message } = req.body;
    
    if (!dealId || !userId || !message) {
      res.status(400).json({ error: "dealId, userId, and message are required" });
      return;
    }

    const result = await aiService.chat(dealId, userId, message);
    res.json(result);
  } catch (error: any) {
    console.error("Error in AI chat:", error);
    res.status(500).json({ error: error.message || "AI chat failed" });
  }
});

router.post("/api/ai/analyze", async (req, res) => {
  try {
    const { dealId, userId, base64Pdf, message } = req.body;
    
    if (!dealId || !userId || !base64Pdf) {
      res.status(400).json({ error: "dealId, userId, and base64Pdf are required" });
      return;
    }

    const result = await aiService.analyzePdf(base64Pdf, dealId, userId, message);
    res.json(result);
  } catch (error: any) {
    console.error("Error analyzing PDF:", error);
    res.status(500).json({ error: error.message || "PDF analysis failed" });
  }
});

router.get("/api/ai/:dealId/history", async (req, res) => {
  try {
    const { dealId } = req.params;
    const history = await aiService.getChatHistory(dealId);
    res.json(history);
  } catch (error: any) {
    console.error("Error getting chat history:", error);
    res.status(500).json({ error: error.message || "Failed to get history" });
  }
});

router.post("/api/ai/corrections", async (req, res) => {
  try {
    const validationResult = insertAiCorrectionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const correction = await aiService.saveCorrection(validationResult.data);
    res.status(201).json(correction);
  } catch (error: any) {
    console.error("Error saving correction:", error);
    res.status(500).json({ error: error.message || "Failed to save correction" });
  }
});

router.get("/api/ai/materials", async (req, res) => {
  try {
    const materials = await aiService.getMaterialPrices();
    res.json(materials);
  } catch (error: any) {
    console.error("Error getting materials:", error);
    res.status(500).json({ error: error.message || "Failed to get materials" });
  }
});

router.post("/api/ai/materials", async (req, res) => {
  try {
    const validationResult = insertMaterialPriceSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const material = await aiRepository.createMaterialPrice(validationResult.data);
    res.status(201).json(material);
  } catch (error: any) {
    console.error("Error creating material:", error);
    res.status(500).json({ error: error.message || "Failed to create material" });
  }
});

router.put("/api/ai/materials/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertMaterialPriceSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const material = await aiRepository.updateMaterialPrice(id, validationResult.data);
    
    if (!material) {
      res.status(404).json({ error: "Material not found" });
      return;
    }

    res.json(material);
  } catch (error: any) {
    console.error("Error updating material:", error);
    res.status(500).json({ error: error.message || "Failed to update material" });
  }
});

export default router;
