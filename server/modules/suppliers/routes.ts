import { Router } from "express";
import { suppliersRepository } from "./repository";
import { insertSupplierSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export const router = Router();

// GET /api/suppliers - Get all suppliers
router.get("/api/suppliers", async (req, res) => {
  try {
    const { active } = req.query;
    const suppliers = active === 'true'
      ? await suppliersRepository.getActive()
      : await suppliersRepository.getAll();
    res.json(suppliers);
  } catch (error) {
    console.error("Error fetching suppliers:", error);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});

// GET /api/suppliers/:id - Get supplier by ID
router.get("/api/suppliers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await suppliersRepository.getById(id);

    if (!supplier) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }

    res.json(supplier);
  } catch (error) {
    console.error("Error fetching supplier:", error);
    res.status(500).json({ error: "Failed to fetch supplier" });
  }
});

// POST /api/suppliers - Create new supplier
router.post("/api/suppliers", async (req, res) => {
  try {
    const parsed = insertSupplierSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: fromZodError(parsed.error).message });
      return;
    }

    const supplier = await suppliersRepository.create(parsed.data);
    res.status(201).json(supplier);
  } catch (error) {
    console.error("Error creating supplier:", error);
    res.status(500).json({ error: "Failed to create supplier" });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put("/api/suppliers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await suppliersRepository.update(id, req.body);

    if (!supplier) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }

    res.json(supplier);
  } catch (error) {
    console.error("Error updating supplier:", error);
    res.status(500).json({ error: "Failed to update supplier" });
  }
});

// DELETE /api/suppliers/:id - Delete supplier
router.delete("/api/suppliers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await suppliersRepository.delete(id);

    if (!deleted) {
      res.status(404).json({ error: "Supplier not found" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting supplier:", error);
    res.status(500).json({ error: "Failed to delete supplier" });
  }
});
