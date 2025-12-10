import { Router } from "express";
import { tasksRepository, activityLogsRepository } from "./repository";
import { insertTaskSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { unlink } from "fs/promises";

export const router = Router();

// Configure multer for file uploads
const UPLOAD_DIR = join(process.cwd(), ".local", "task_attachments");
if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Fix encoding for Cyrillic characters
    const originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// GET /api/tasks - get all tasks (with filters)
router.get("/api/tasks", async (req, res) => {
  try {
    const { status, priority, assignee_id } = req.query;

    let tasks = await tasksRepository.getAllTasks();

    // Apply filters
    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    if (priority) {
      tasks = tasks.filter(t => t.priority === priority);
    }
    if (assignee_id) {
      tasks = tasks.filter(t => t.assignee_id === assignee_id);
    }

    res.json(tasks);
  } catch (error) {
    console.error("[Tasks] Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// GET /api/tasks/:id - get single task
router.get("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const task = await tasksRepository.getTaskById(id);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error fetching task:", error);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// POST /api/tasks - create task
router.post("/api/tasks", async (req, res) => {
  try {
    console.log("[Tasks] Creating task with data:", JSON.stringify(req.body, null, 2));

    const validation = insertTaskSchema.safeParse(req.body);

    if (!validation.success) {
      console.error("[Tasks] Validation failed:", validation.error);
      const readableError = fromZodError(validation.error);
      res.status(400).json({ error: readableError.message });
      return;
    }

    console.log("[Tasks] Validation passed, creating task...");
    const task = await tasksRepository.createTask(validation.data);
    console.log("[Tasks] Task created successfully:", task?.id);

    // Log activity for project-related tasks
    if (task && task.related_entity_type === 'project' && task.related_entity_id) {
      try {
        await activityLogsRepository.logActivity({
          entity_type: "project",
          entity_id: task.related_entity_id,
          action_type: "task_created",
          user_id: task.created_by || null,
          description: `Создана задача "${task.title}"`,
        });
      } catch (logError) {
        console.error("[Tasks] Error logging task creation activity:", logError);
      }
    }

    res.status(201).json(task);
  } catch (error) {
    console.error("[Tasks] Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// PUT /api/tasks/:id - update task
router.put("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const task = await tasksRepository.updateTask(id, req.body);
    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// DELETE /api/tasks/:id - delete task
router.delete("/api/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await tasksRepository.deleteTask(id);
    res.status(204).send();
  } catch (error) {
    console.error("[Tasks] Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// POST /api/tasks/:id/submit - submit task for review
router.post("/api/tasks/:id/submit", async (req, res) => {
  try {
    const { id } = req.params;
    // Accept userId from body or headers (X-User-ID)
    const userId = req.body.userId || req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const task = await tasksRepository.submitTaskForReview(id, userId);

    // Log activity for project-related tasks
    if (task && task.related_entity_type === 'project' && task.related_entity_id) {
      try {
        await activityLogsRepository.logActivity({
          entity_type: "project",
          entity_id: task.related_entity_id,
          action_type: "task_submitted",
          user_id: userId,
          description: `Задача "${task.title}" отправлена на проверку`,
        });
      } catch (logError) {
        console.error("[Tasks] Error logging task submission activity:", logError);
      }
    }

    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error submitting task for review:", error);
    res.status(500).json({ error: "Failed to submit task for review" });
  }
});

// POST /api/tasks/:id/approve - approve task
router.post("/api/tasks/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerId } = req.body;

    if (!reviewerId) {
      res.status(400).json({ error: "Reviewer ID is required" });
      return;
    }

    const task = await tasksRepository.approveTask(id, reviewerId);

    // Log activity for project-related tasks
    if (task && task.related_entity_type === 'project' && task.related_entity_id) {
      try {
        await activityLogsRepository.logActivity({
          entity_type: "project",
          entity_id: task.related_entity_id,
          action_type: "task_completed",
          user_id: reviewerId,
          description: `Задача "${task.title}" выполнена`,
        });
      } catch (logError) {
        console.error("[Tasks] Error logging task approval activity:", logError);
      }
    }

    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error approving task:", error);
    res.status(500).json({ error: "Failed to approve task" });
  }
});

// POST /api/tasks/:id/reject - reject task
router.post("/api/tasks/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewerId, reason } = req.body;

    if (!reviewerId) {
      res.status(400).json({ error: "Reviewer ID is required" });
      return;
    }

    if (!reason) {
      res.status(400).json({ error: "Rejection reason is required" });
      return;
    }

    const task = await tasksRepository.rejectTask(id, reviewerId, reason);

    // Log activity for project-related tasks
    if (task && task.related_entity_type === 'project' && task.related_entity_id) {
      try {
        await activityLogsRepository.logActivity({
          entity_type: "project",
          entity_id: task.related_entity_id,
          action_type: "task_rejected",
          user_id: reviewerId,
          description: `Задача "${task.title}" отклонена: ${reason}`,
        });
      } catch (logError) {
        console.error("[Tasks] Error logging task rejection activity:", logError);
      }
    }

    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error rejecting task:", error);
    res.status(500).json({ error: "Failed to reject task" });
  }
});

// GET /api/tasks/:id/attachments - get task attachments
router.get("/api/tasks/:id/attachments", async (req, res) => {
  try {
    const { id } = req.params;
    const attachments = await tasksRepository.getTaskAttachments(id);
    res.json(attachments);
  } catch (error) {
    console.error("[Tasks] Error fetching attachments:", error);
    res.status(500).json({ error: "Failed to fetch attachments" });
  }
});

// POST /api/tasks/:id/attachments - upload attachment
router.post("/api/tasks/:id/attachments", upload.single('file'), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Fix encoding for Cyrillic characters
    const file_name = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

    const attachment = await tasksRepository.createTaskAttachment({
      task_id: id,
      file_name,
      file_path: req.file.path,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      uploaded_by: userId,
    });

    res.status(201).json(attachment);
  } catch (error) {
    console.error("[Tasks] Error uploading attachment:", error);
    res.status(500).json({ error: "Failed to upload attachment" });
  }
});

// GET /api/tasks/:id/attachments/:attachmentId/download - download attachment
router.get("/api/tasks/:id/attachments/:attachmentId/download", async (req, res) => {
  try {
    const { id, attachmentId } = req.params;

    // Get attachment info
    const attachments = await tasksRepository.getTaskAttachments(id);
    const attachment = attachments.find(a => a.id === attachmentId);

    if (!attachment) {
      res.status(404).json({ error: "Attachment not found" });
      return;
    }

    // Send file
    res.download(attachment.file_path, attachment.file_name, (err) => {
      if (err) {
        console.error("[Tasks] Error downloading file:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to download file" });
        }
      }
    });
  } catch (error) {
    console.error("[Tasks] Error downloading attachment:", error);
    res.status(500).json({ error: "Failed to download attachment" });
  }
});

// DELETE /api/tasks/:id/attachments/:attachmentId - delete attachment
router.delete("/api/tasks/:id/attachments/:attachmentId", async (req, res) => {
  try {
    const { attachmentId } = req.params;

    // Get attachment to delete file from disk
    const attachments = await tasksRepository.getTaskAttachments(req.params.id);
    const attachment = attachments.find(a => a.id === attachmentId);

    if (attachment) {
      // Delete file from disk
      try {
        await unlink(attachment.file_path);
      } catch (err) {
        console.error("[Tasks] Error deleting file from disk:", err);
      }
    }

    await tasksRepository.deleteTaskAttachment(attachmentId);
    res.status(204).send();
  } catch (error) {
    console.error("[Tasks] Error deleting attachment:", error);
    res.status(500).json({ error: "Failed to delete attachment" });
  }
});

// GET /api/tasks/:id/comments - get task comments
router.get("/api/tasks/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const comments = await tasksRepository.getTaskComments(id);
    res.json(comments);
  } catch (error) {
    console.error("[Tasks] Error fetching comments:", error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// POST /api/tasks/:id/comments - create comment
router.post("/api/tasks/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { content, author_id } = req.body;

    if (!content || !author_id) {
      res.status(400).json({ error: "Content and author_id are required" });
      return;
    }

    const comment = await tasksRepository.createTaskComment({
      task_id: id,
      content,
      author_id,
    });

    res.status(201).json(comment);
  } catch (error) {
    console.error("[Tasks] Error creating comment:", error);
    res.status(500).json({ error: "Failed to create comment" });
  }
});

// GET /api/tasks/:id/checklist - get task checklist
router.get("/api/tasks/:id/checklist", async (req, res) => {
  try {
    const { id } = req.params;
    const items = await tasksRepository.getTaskChecklist(id);
    res.json(items);
  } catch (error) {
    console.error("[Tasks] Error fetching checklist:", error);
    res.status(500).json({ error: "Failed to fetch checklist" });
  }
});

// POST /api/tasks/:id/checklist - create checklist item
router.post("/api/tasks/:id/checklist", async (req, res) => {
  try {
    const { id } = req.params;
    const { item_text, order } = req.body;

    if (!item_text) {
      res.status(400).json({ error: "item_text is required" });
      return;
    }

    const item = await tasksRepository.createChecklistItem({
      task_id: id,
      item_text,
      order: order || 0,
      is_completed: 0,
    });

    res.status(201).json(item);
  } catch (error) {
    console.error("[Tasks] Error creating checklist item:", error);
    res.status(500).json({ error: "Failed to create checklist item" });
  }
});

// PUT /api/tasks/:id/checklist/:itemId - update checklist item
router.put("/api/tasks/:id/checklist/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await tasksRepository.updateChecklistItem(itemId, req.body);
    res.json(item);
  } catch (error) {
    console.error("[Tasks] Error updating checklist item:", error);
    res.status(500).json({ error: "Failed to update checklist item" });
  }
});

// DELETE /api/tasks/:id/checklist/:itemId - delete checklist item
router.delete("/api/tasks/:id/checklist/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    await tasksRepository.deleteChecklistItem(itemId);
    res.status(204).send();
  } catch (error) {
    console.error("[Tasks] Error deleting checklist item:", error);
    res.status(500).json({ error: "Failed to delete checklist item" });
  }
});

// GET /api/projects/:projectId/items/:itemId/tasks - get tasks for project item
router.get("/api/projects/:projectId/items/:itemId/tasks", async (req, res) => {
  try {
    const { itemId } = req.params;
    const tasks = await tasksRepository.getTasksByProjectItem(itemId);
    res.json(tasks);
  } catch (error) {
    console.error("[Tasks] Error fetching tasks by project item:", error);
    res.status(500).json({ error: "Failed to fetch tasks for project item" });
  }
});
