import { Router } from "express";
import { customFieldsRepository } from "./repository";
import { insertCustomFieldDefinitionSchema, insertDealCustomFieldSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export const router = Router();

// GET /api/custom-field-definitions - получить все определения полей
router.get("/api/custom-field-definitions", async (req, res) => {
  try {
    const definitions = await customFieldsRepository.getDefinitions();
    res.json(definitions);
  } catch (error) {
    console.error("Error fetching custom field definitions:", error);
    res.status(500).json({ error: "Failed to fetch custom field definitions" });
  }
});

// POST /api/custom-field-definitions - создать новое определение поля
router.post("/api/custom-field-definitions", async (req, res) => {
  try {
    // Normalize options: trim and filter empty strings
    const data = { ...req.body };
    if (data.options && Array.isArray(data.options)) {
      data.options = data.options
        .map((opt: string) => opt.trim())
        .filter((opt: string) => opt.length > 0);
    }
    
    const validation = insertCustomFieldDefinitionSchema.safeParse(data);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: fromZodError(validation.error).message 
      });
    }

    const definition = await customFieldsRepository.createDefinition(validation.data);
    res.status(201).json(definition);
  } catch (error) {
    console.error("Error creating custom field definition:", error);
    res.status(500).json({ error: "Failed to create custom field definition" });
  }
});

// PUT /api/custom-field-definitions/:id - обновить определение поля
router.put("/api/custom-field-definitions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Normalize options: trim and filter empty strings
    const data = { ...req.body };
    if (data.options && Array.isArray(data.options)) {
      data.options = data.options
        .map((opt: string) => opt.trim())
        .filter((opt: string) => opt.length > 0);
    }
    
    const validation = insertCustomFieldDefinitionSchema.partial().safeParse(data);
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: fromZodError(validation.error).message 
      });
    }

    const definition = await customFieldsRepository.updateDefinition(id, validation.data);
    
    if (!definition) {
      return res.status(404).json({ error: "Custom field definition not found" });
    }

    res.json(definition);
  } catch (error) {
    console.error("Error updating custom field definition:", error);
    res.status(500).json({ error: "Failed to update custom field definition" });
  }
});

// DELETE /api/custom-field-definitions/:id - удалить определение поля
router.delete("/api/custom-field-definitions/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await customFieldsRepository.deleteDefinition(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting custom field definition:", error);
    res.status(500).json({ error: "Failed to delete custom field definition" });
  }
});

// GET /api/deals/:dealId/custom-fields - получить значения полей для сделки
router.get("/api/deals/:dealId/custom-fields", async (req, res) => {
  try {
    const { dealId } = req.params;
    const fields = await customFieldsRepository.getDealCustomFields(dealId);
    res.json(fields);
  } catch (error) {
    console.error("Error fetching deal custom fields:", error);
    res.status(500).json({ error: "Failed to fetch deal custom fields" });
  }
});

// POST /api/deals/:dealId/custom-fields - установить значение поля для сделки
router.post("/api/deals/:dealId/custom-fields", async (req, res) => {
  try {
    const { dealId } = req.params;
    const validation = insertDealCustomFieldSchema.safeParse({
      ...req.body,
      deal_id: dealId,
    });
    
    if (!validation.success) {
      return res.status(400).json({ 
        error: fromZodError(validation.error).message 
      });
    }

    const field = await customFieldsRepository.setDealCustomField(validation.data);
    res.status(201).json(field);
  } catch (error) {
    console.error("Error setting deal custom field:", error);
    res.status(500).json({ error: "Failed to set deal custom field" });
  }
});

// DELETE /api/deals/:dealId/custom-fields/:fieldId - удалить значение поля
router.delete("/api/deals/:dealId/custom-fields/:fieldId", async (req, res) => {
  try {
    const { fieldId } = req.params;
    await customFieldsRepository.deleteDealCustomField(fieldId);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting deal custom field:", error);
    res.status(500).json({ error: "Failed to delete deal custom field" });
  }
});
