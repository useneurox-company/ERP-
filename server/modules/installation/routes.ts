import { Router } from "express";
import { installationRepository } from "./repository";
import { insertInstallationSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export const router = Router();

// GET /api/installations - Get all installations
router.get("/api/installations", async (req, res) => {
  try {
    const { status } = req.query;
    const installations = await installationRepository.getAllInstallations(status as string | undefined);
    res.json(installations);
  } catch (error) {
    console.error("Error fetching installations:", error);
    res.status(500).json({ error: "Failed to fetch installations" });
  }
});

// GET /api/installations/:id - Get installation by ID
router.get("/api/installations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const installation = await installationRepository.getInstallationById(id);
    
    if (!installation) {
      res.status(404).json({ error: "Installation not found" });
      return;
    }
    
    res.json(installation);
  } catch (error) {
    console.error("Error fetching installation:", error);
    res.status(500).json({ error: "Failed to fetch installation" });
  }
});

// POST /api/installations - Create new installation
router.post("/api/installations", async (req, res) => {
  try {
    const validationResult = insertInstallationSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newInstallation = await installationRepository.createInstallation(validationResult.data);
    res.status(201).json(newInstallation);
  } catch (error) {
    console.error("Error creating installation:", error);
    res.status(500).json({ error: "Failed to create installation" });
  }
});

// PUT /api/installations/:id - Update installation
router.put("/api/installations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertInstallationSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const updatedInstallation = await installationRepository.updateInstallation(id, validationResult.data);
    
    if (!updatedInstallation) {
      res.status(404).json({ error: "Installation not found" });
      return;
    }
    
    res.json(updatedInstallation);
  } catch (error) {
    console.error("Error updating installation:", error);
    res.status(500).json({ error: "Failed to update installation" });
  }
});

// DELETE /api/installations/:id - Delete installation
router.delete("/api/installations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await installationRepository.deleteInstallation(id);
    
    if (!deleted) {
      res.status(404).json({ error: "Installation not found" });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting installation:", error);
    res.status(500).json({ error: "Failed to delete installation" });
  }
});
