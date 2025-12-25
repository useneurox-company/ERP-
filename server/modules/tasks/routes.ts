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
    const { status, priority, assignee_id, archived } = req.query;

    let tasks = await tasksRepository.getAllTasks();

    // Filter by archived status (default: show non-archived)
    const showArchived = archived === 'true';
    tasks = tasks.filter(t => (t.is_archived || false) === showArchived);

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

// PUT /api/tasks/:id/archive - archive task
router.put("/api/tasks/:id/archive", async (req, res) => {
  try {
    const { id } = req.params;
    const task = await tasksRepository.updateTask(id, { is_archived: true });
    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error archiving task:", error);
    res.status(500).json({ error: "Failed to archive task" });
  }
});

// PUT /api/tasks/:id/unarchive - unarchive task
router.put("/api/tasks/:id/unarchive", async (req, res) => {
  try {
    const { id } = req.params;
    const task = await tasksRepository.updateTask(id, { is_archived: false });
    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error unarchiving task:", error);
    res.status(500).json({ error: "Failed to unarchive task" });
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

// ========================================
// NAMED CHECKLISTS (Именованные чеклисты)
// ========================================

// GET /api/tasks/:id/checklists - get all named checklists with items
router.get("/api/tasks/:id/checklists", async (req, res) => {
  try {
    const { id } = req.params;
    const checklists = await tasksRepository.getTaskChecklists(id);
    res.json(checklists);
  } catch (error) {
    console.error("[Tasks] Error fetching checklists:", error);
    res.status(500).json({ error: "Failed to fetch checklists" });
  }
});

// POST /api/tasks/:id/checklists - create named checklist
router.post("/api/tasks/:id/checklists", async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: "Checklist name is required" });
      return;
    }

    const checklist = await tasksRepository.createTaskChecklist({
      task_id: id,
      name,
    });

    res.status(201).json(checklist);
  } catch (error) {
    console.error("[Tasks] Error creating checklist:", error);
    res.status(500).json({ error: "Failed to create checklist" });
  }
});

// PUT /api/tasks/:id/checklists/:checklistId - update checklist (name, hide_completed)
router.put("/api/tasks/:id/checklists/:checklistId", async (req, res) => {
  try {
    const { checklistId } = req.params;
    const { name, hide_completed } = req.body;

    const checklist = await tasksRepository.updateTaskChecklist(checklistId, { name, hide_completed });
    res.json(checklist);
  } catch (error) {
    console.error("[Tasks] Error updating checklist:", error);
    res.status(500).json({ error: "Failed to update checklist" });
  }
});

// DELETE /api/tasks/:id/checklists/:checklistId - delete checklist and all items
router.delete("/api/tasks/:id/checklists/:checklistId", async (req, res) => {
  try {
    const { checklistId } = req.params;
    await tasksRepository.deleteTaskChecklist(checklistId);
    res.status(204).send();
  } catch (error) {
    console.error("[Tasks] Error deleting checklist:", error);
    res.status(500).json({ error: "Failed to delete checklist" });
  }
});

// POST /api/tasks/:id/checklists/:checklistId/items - add item to checklist
router.post("/api/tasks/:id/checklists/:checklistId/items", async (req, res) => {
  try {
    const { id, checklistId } = req.params;
    const { item_text, deadline, assignee_id } = req.body;

    if (!item_text) {
      res.status(400).json({ error: "Item text is required" });
      return;
    }

    const item = await tasksRepository.createChecklistItemForChecklist(checklistId, id, {
      item_text,
      deadline,
      assignee_id,
    });

    res.status(201).json(item);
  } catch (error) {
    console.error("[Tasks] Error creating checklist item:", error);
    res.status(500).json({ error: "Failed to create checklist item" });
  }
});

// PUT /api/tasks/:id/checklists/:checklistId/items/:itemId - update item
router.put("/api/tasks/:id/checklists/:checklistId/items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { item_text, is_completed, order, deadline, assignee_id } = req.body;

    const item = await tasksRepository.updateChecklistItemWithAssignee(itemId, {
      item_text,
      is_completed,
      order,
      deadline,
      assignee_id,
    });

    res.json(item);
  } catch (error) {
    console.error("[Tasks] Error updating checklist item:", error);
    res.status(500).json({ error: "Failed to update checklist item" });
  }
});

// DELETE /api/tasks/:id/checklists/:checklistId/items/:itemId - delete item
router.delete("/api/tasks/:id/checklists/:checklistId/items/:itemId", async (req, res) => {
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

// ========================================
// POOL METHODS (Пул исполнителей)
// ========================================

// GET /api/tasks/:id/pool - get task with pool info
router.get("/api/tasks/:id/pool", async (req, res) => {
  try {
    const { id } = req.params;
    const task = await tasksRepository.getTaskWithPool(id);

    if (!task) {
      res.status(404).json({ error: "Task not found" });
      return;
    }

    res.json(task);
  } catch (error) {
    console.error("[Tasks] Error fetching task with pool:", error);
    res.status(500).json({ error: "Failed to fetch task with pool" });
  }
});

// GET /api/tasks/:id/potential-assignees - get potential assignees
router.get("/api/tasks/:id/potential-assignees", async (req, res) => {
  try {
    const { id } = req.params;
    const assignees = await tasksRepository.getPotentialAssignees(id);
    res.json(assignees);
  } catch (error) {
    console.error("[Tasks] Error fetching potential assignees:", error);
    res.status(500).json({ error: "Failed to fetch potential assignees" });
  }
});

// POST /api/tasks/:id/potential-assignees - add potential assignees
router.post("/api/tasks/:id/potential-assignees", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_ids } = req.body;

    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      res.status(400).json({ error: "user_ids array is required" });
      return;
    }

    await tasksRepository.addPotentialAssignees(id, user_ids);

    // Update assignment_type to 'pool'
    await tasksRepository.updateTask(id, { assignment_type: 'pool', assignee_id: null });

    const assignees = await tasksRepository.getPotentialAssignees(id);
    res.status(201).json(assignees);
  } catch (error) {
    console.error("[Tasks] Error adding potential assignees:", error);
    res.status(500).json({ error: "Failed to add potential assignees" });
  }
});

// PUT /api/tasks/:id/potential-assignees - set potential assignees (replace all)
router.put("/api/tasks/:id/potential-assignees", async (req, res) => {
  try {
    const { id } = req.params;
    const { user_ids } = req.body;

    if (!user_ids || !Array.isArray(user_ids)) {
      res.status(400).json({ error: "user_ids array is required" });
      return;
    }

    await tasksRepository.setPotentialAssignees(id, user_ids);

    // Update assignment_type based on whether there are any assignees
    if (user_ids.length > 0) {
      await tasksRepository.updateTask(id, { assignment_type: 'pool', assignee_id: null });
    } else {
      await tasksRepository.updateTask(id, { assignment_type: 'single' });
    }

    const assignees = await tasksRepository.getPotentialAssignees(id);
    res.json(assignees);
  } catch (error) {
    console.error("[Tasks] Error setting potential assignees:", error);
    res.status(500).json({ error: "Failed to set potential assignees" });
  }
});

// DELETE /api/tasks/:id/potential-assignees/:userId - remove potential assignee
router.delete("/api/tasks/:id/potential-assignees/:userId", async (req, res) => {
  try {
    const { id, userId } = req.params;
    await tasksRepository.removePotentialAssignee(id, userId);

    // Check if any assignees left
    const remaining = await tasksRepository.getPotentialAssignees(id);
    if (remaining.length === 0) {
      await tasksRepository.updateTask(id, { assignment_type: 'single' });
    }

    res.status(204).send();
  } catch (error) {
    console.error("[Tasks] Error removing potential assignee:", error);
    res.status(500).json({ error: "Failed to remove potential assignee" });
  }
});

// POST /api/tasks/:id/take - take task from pool
router.post("/api/tasks/:id/take", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.body.userId || req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const task = await tasksRepository.takeTask(id, userId);

    // Log activity
    if (task && task.project_id) {
      try {
        await activityLogsRepository.logActivity({
          entity_type: "project",
          entity_id: task.project_id,
          action_type: "task_taken",
          user_id: userId,
          description: `Задача "${task.title}" взята из пула`,
        });
      } catch (logError) {
        console.error("[Tasks] Error logging task take activity:", logError);
      }
    }

    res.json(task);
  } catch (error: any) {
    console.error("[Tasks] Error taking task:", error);
    if (error.message === 'User is not in the potential assignees list') {
      res.status(403).json({ error: "You are not in the list of potential assignees for this task" });
    } else {
      res.status(500).json({ error: "Failed to take task" });
    }
  }
});

// GET /api/tasks/pool/available - get pool tasks available to current user
router.get("/api/tasks/pool/available", async (req, res) => {
  try {
    const userId = req.query.userId as string || req.headers['x-user-id'] as string;

    if (!userId) {
      res.status(400).json({ error: "User ID is required" });
      return;
    }

    const tasks = await tasksRepository.getPoolTasksForUser(userId);
    res.json(tasks);
  } catch (error) {
    console.error("[Tasks] Error fetching available pool tasks:", error);
    res.status(500).json({ error: "Failed to fetch available pool tasks" });
  }
});
