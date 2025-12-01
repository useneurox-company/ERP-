import { Router } from "express";
import { documentsRepository } from "./repository";
import { insertDocumentSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export const router = Router();

// ========== Document Endpoints ==========

// GET /api/documents - Get all documents
router.get("/api/documents", async (req, res) => {
  try {
    const { type, project_id } = req.query;
    const documents = await documentsRepository.getAllDocuments(
      type as string | undefined,
      project_id as string | undefined
    );
    res.json(documents);
  } catch (error) {
    console.error("Error fetching documents:", error);
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// GET /api/documents/:id - Get document by ID
router.get("/api/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const document = await documentsRepository.getDocumentById(id);
    
    if (!document) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    
    res.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// POST /api/documents - Create new document
router.post("/api/documents", async (req, res) => {
  try {
    const validationResult = insertDocumentSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newDocument = await documentsRepository.createDocument(validationResult.data);
    res.status(201).json(newDocument);
  } catch (error) {
    console.error("Error creating document:", error);
    res.status(500).json({ error: "Failed to create document" });
  }
});

// PUT /api/documents/:id - Update document
router.put("/api/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertDocumentSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const updatedDocument = await documentsRepository.updateDocument(id, validationResult.data);
    
    if (!updatedDocument) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    
    res.json(updatedDocument);
  } catch (error) {
    console.error("Error updating document:", error);
    res.status(500).json({ error: "Failed to update document" });
  }
});

// DELETE /api/documents/:id - Delete document
router.delete("/api/documents/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await documentsRepository.deleteDocument(id);
    
    if (!deleted) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});
