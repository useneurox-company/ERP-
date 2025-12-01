import { Router, Request, Response } from "express";
import { templatesRepository } from "./repository";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import {
  insertProcessTemplateSchema,
  insertTemplateStageSchema,
  insertTemplateDependencySchema
} from "@shared/schema";

export const router = Router();

// Get all templates
router.get("/api/templates", async (req, res) => {
  try {
    const templates = await templatesRepository.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    res.status(500).json({ error: "Failed to fetch templates" });
  }
});

// Get active templates only
router.get("/api/templates/active", async (req, res) => {
  try {
    const templates = await templatesRepository.getActiveTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Error fetching active templates:", error);
    res.status(500).json({ error: "Failed to fetch active templates" });
  }
});

// Get template by ID with details
router.get("/api/templates/:id", async (req, res) => {
  try {
    console.log(`[API] Fetching template: ${req.params.id}`);

    const template = await templatesRepository.getTemplateWithDetails(req.params.id);

    if (!template) {
      console.log(`[API] Template not found: ${req.params.id}`);
      return res.status(404).json({ error: "Template not found" });
    }

    console.log(`[API] Returning template response:`, {
      hasTemplate: !!template.template,
      templateName: template.template?.name,
      stagesCount: template.stages?.length || 0,
      dependenciesCount: template.dependencies?.length || 0
    });

    res.json(template);
  } catch (error) {
    console.error("[API] Error fetching template:", error);
    res.status(500).json({ error: "Failed to fetch template" });
  }
});

// Create template
router.post("/api/templates", async (req, res) => {
  try {
    const validatedData = insertProcessTemplateSchema.parse(req.body);
    const template = await templatesRepository.createTemplate(validatedData);
    res.status(201).json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    res.status(400).json({ error: "Failed to create template" });
  }
});

// Update template
router.put("/api/templates/:id", async (req, res) => {
  try {
    const validatedData = insertProcessTemplateSchema.partial().parse(req.body);
    const template = await templatesRepository.updateTemplate(req.params.id, validatedData);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.json(template);
  } catch (error) {
    console.error("Error updating template:", error);
    res.status(400).json({ error: "Failed to update template" });
  }
});

// Delete template
router.delete("/api/templates/:id", async (req, res) => {
  try {
    const deleted = await templatesRepository.deleteTemplate(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Template not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template:", error);
    res.status(500).json({ error: "Failed to delete template" });
  }
});

// Template stages routes
router.get("/api/templates/:templateId/stages", async (req, res) => {
  try {
    const stages = await templatesRepository.getTemplateStages(req.params.templateId);
    res.json(stages);
  } catch (error) {
    console.error("Error fetching template stages:", error);
    res.status(500).json({ error: "Failed to fetch template stages" });
  }
});

router.post("/api/templates/:templateId/stages", async (req, res) => {
  try {
    const dataWithTemplateId = {
      ...req.body,
      template_id: req.params.templateId
    };
    console.log("=== TEMPLATE STAGE CREATION ===");
    console.log("Request body:", JSON.stringify(req.body, null, 2));
    console.log("Template ID:", req.params.templateId);
    console.log("Data with template_id:", JSON.stringify(dataWithTemplateId, null, 2));

    const validatedData = insertTemplateStageSchema.parse(dataWithTemplateId);
    console.log("✓ Validation passed");
    console.log("Validated data:", JSON.stringify(validatedData, null, 2));

    const stage = await templatesRepository.createTemplateStage(validatedData);
    console.log("✓ Stage created successfully:", stage.id);
    res.status(201).json(stage);
  } catch (error) {
    console.error("✗ Error creating template stage");

    if (error instanceof z.ZodError) {
      console.error("Validation FAILED - Zod Error");
      console.error("Number of errors:", error.errors.length);
      error.errors.forEach((err, idx) => {
        console.error(`Error ${idx}:`, {
          path: err.path,
          code: err.code,
          message: err.message,
          expected: (err as any).expected,
          received: (err as any).received,
        });
      });
      return res.status(400).json({
        error: "Validation failed",
        errorCount: error.errors.length,
        errors: error.errors.map(e => ({
          path: e.path.join('.'),
          code: e.code,
          message: e.message
        })),
        receivedData: req.body
      });
    }
    console.error("Error type:", error instanceof Error ? "Error" : "Unknown");
    console.error("Error message:", error instanceof Error ? error.message : String(error));
    res.status(400).json({
      error: "Failed to create template stage",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.put("/api/templates/stages/:id", async (req, res) => {
  try {
    const validatedData = insertTemplateStageSchema.partial().parse(req.body);
    const stage = await templatesRepository.updateTemplateStage(req.params.id, validatedData);
    if (!stage) {
      return res.status(404).json({ error: "Template stage not found" });
    }
    res.json(stage);
  } catch (error) {
    console.error("Error updating template stage:", error);
    res.status(400).json({ error: "Failed to update template stage" });
  }
});

router.delete("/api/templates/stages/:id", async (req, res) => {
  try {
    await templatesRepository.deleteTemplateDependenciesByStageId(req.params.id);
    const deleted = await templatesRepository.deleteTemplateStage(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Template stage not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template stage:", error);
    res.status(500).json({ error: "Failed to delete template stage" });
  }
});

// Template dependencies routes
router.get("/api/templates/:templateId/dependencies", async (req, res) => {
  try {
    const dependencies = await templatesRepository.getTemplateDependencies(req.params.templateId);
    res.json(dependencies);
  } catch (error) {
    console.error("Error fetching template dependencies:", error);
    res.status(500).json({ error: "Failed to fetch template dependencies" });
  }
});

router.post("/api/templates/:templateId/dependencies", async (req, res) => {
  try {
    const validatedData = insertTemplateDependencySchema.parse(req.body);
    const dependency = await templatesRepository.createTemplateDependency(validatedData);
    res.status(201).json(dependency);
  } catch (error) {
    console.error("Error creating template dependency:", error);
    res.status(400).json({ error: "Failed to create template dependency" });
  }
});

router.delete("/api/templates/dependencies/:id", async (req, res) => {
  try {
    const deleted = await templatesRepository.deleteTemplateDependency(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: "Template dependency not found" });
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template dependency:", error);
    res.status(500).json({ error: "Failed to delete template dependency" });
  }
});

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads", "template-attachments");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow PDF, Word, and Excel files
  const allowedMimes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF, Word, and Excel files are allowed"));
  }
};

const upload = multer({ storage, fileFilter });

// Template stage attachments routes

// GET /api/templates/stages/:stageId/attachments - Get attachments for a stage
router.get("/api/templates/stages/:stageId/attachments", async (req: Request, res: Response) => {
  try {
    const attachments = await templatesRepository.getStageAttachments(req.params.stageId);
    res.json(attachments);
  } catch (error) {
    console.error("Error fetching stage attachments:", error);
    res.status(500).json({ error: "Failed to fetch stage attachments" });
  }
});

// POST /api/templates/stages/:stageId/attachments - Upload attachment
router.post("/api/templates/stages/:stageId/attachments", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const attachment = await templatesRepository.createStageAttachment({
      template_stage_id: req.params.stageId,
      file_name: req.file.originalname,
      file_path: `/uploads/template-attachments/${req.file.filename}`,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      uploaded_by: (req as any).userId, // Assumes auth middleware sets userId
    });

    res.status(201).json(attachment);
  } catch (error) {
    console.error("Error uploading attachment:", error);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

// DELETE /api/templates/stages/:stageId/attachments/:attachmentId - Delete attachment
router.delete("/api/templates/stages/:stageId/attachments/:attachmentId", async (req: Request, res: Response) => {
  try {
    const attachment = await templatesRepository.getAttachmentById(req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    // Delete file from storage
    const filePath = path.join(process.cwd(), attachment.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    const deleted = await templatesRepository.deleteStageAttachment(req.params.attachmentId);
    if (!deleted) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

// GET /api/templates/stages/:stageId/attachments/:attachmentId/download - Download attachment
router.get("/api/templates/stages/:stageId/attachments/:attachmentId/download", async (req: Request, res: Response) => {
  try {
    const attachment = await templatesRepository.getAttachmentById(req.params.attachmentId);
    if (!attachment) {
      return res.status(404).json({ error: "Attachment not found" });
    }

    const filePath = path.join(process.cwd(), attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    res.download(filePath, attachment.file_name);
  } catch (error) {
    console.error("Error downloading attachment:", error);
    res.status(500).json({ error: "Failed to download attachment" });
  }
});
