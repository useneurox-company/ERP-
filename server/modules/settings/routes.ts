import { Router } from "express";
import { settingsRepository } from "./repository";
import { insertCompanySettingsSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { checkAdminOnly } from "../../middleware/permissions";

export const router = Router();

// ========== Settings Endpoints ==========

// GET /api/settings/company - Get company settings
router.get("/api/settings/company", checkAdminOnly(), async (req, res) => {
  try {
    let settings = await settingsRepository.getCompanySettings();

    // Create default settings if they don't exist
    if (!settings) {
      settings = await settingsRepository.updateCompanySettings({
        company_name: "Мебельная фабрика Emerald",
        inn: "",
        address: "",
        phone: "",
      });
    }

    res.json(settings);
  } catch (error) {
    console.error("Error fetching company settings:", error);
    res.status(500).json({ error: "Failed to fetch company settings" });
  }
});

// PUT /api/settings/company - Update company settings
router.put("/api/settings/company", checkAdminOnly(), async (req, res) => {
  try {
    const validationResult = insertCompanySettingsSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const updatedSettings = await settingsRepository.updateCompanySettings(validationResult.data);
    res.json(updatedSettings);
  } catch (error) {
    console.error("Error updating company settings:", error);
    res.status(500).json({ error: "Failed to update company settings" });
  }
});
