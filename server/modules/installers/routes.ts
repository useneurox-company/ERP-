import { Router } from "express";
import { installersRepository } from "./repository";
import { insertInstallerSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export const router = Router();

// GET /api/installers - Get all installers
router.get("/api/installers", async (req, res) => {
  try {
    const { active } = req.query;
    const installers = active === 'true'
      ? await installersRepository.getActive()
      : await installersRepository.getAll();
    res.json(installers);
  } catch (error) {
    console.error("Error fetching installers:", error);
    res.status(500).json({ error: "Failed to fetch installers" });
  }
});

// GET /api/installers/:id - Get installer by ID
router.get("/api/installers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const installer = await installersRepository.getById(id);

    if (!installer) {
      res.status(404).json({ error: "Installer not found" });
      return;
    }

    res.json(installer);
  } catch (error) {
    console.error("Error fetching installer:", error);
    res.status(500).json({ error: "Failed to fetch installer" });
  }
});

// POST /api/installers - Create new installer
router.post("/api/installers", async (req, res) => {
  try {
    const validationResult = insertInstallerSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newInstaller = await installersRepository.create(validationResult.data);
    res.status(201).json(newInstaller);
  } catch (error) {
    console.error("Error creating installer:", error);
    res.status(500).json({ error: "Failed to create installer" });
  }
});

// PUT /api/installers/:id - Update installer
router.put("/api/installers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertInstallerSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const updatedInstaller = await installersRepository.update(id, validationResult.data);

    if (!updatedInstaller) {
      res.status(404).json({ error: "Installer not found" });
      return;
    }

    res.json(updatedInstaller);
  } catch (error) {
    console.error("Error updating installer:", error);
    res.status(500).json({ error: "Failed to update installer" });
  }
});

// DELETE /api/installers/:id - Delete installer
router.delete("/api/installers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await installersRepository.delete(id);

    if (!deleted) {
      res.status(404).json({ error: "Installer not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting installer:", error);
    res.status(500).json({ error: "Failed to delete installer" });
  }
});
