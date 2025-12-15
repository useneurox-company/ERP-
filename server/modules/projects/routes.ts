import { Router } from "express";
import { projectsRepository } from "./repository";
import {
  insertProjectSchema, insertProjectStageSchema, insertProjectItemSchema,
  insertStageDependencySchema, insertProcessTemplateSchema, insertTemplateStageSchema,
  insertTemplateDependencySchema, insertStageMessageSchema, insertProjectMessageSchema, insertStageDocumentSchema, project_stages,
  project_items, projects, tasks, project_supplier_documents, insertProjectSupplierDocumentSchema
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { salesRepository } from "../sales/repository";
import { z } from "zod";
import { db } from "../../db";
import { eq, sql, and, desc } from "drizzle-orm";
import { activityLogsRepository, tasksRepository } from "../tasks/repository";
import { stageTypesRepository } from "../stage-types/repository";
import { localFileStorage } from "../../localFileStorage";

export const router = Router();

// Функция для подсчёта задач проекта
async function getProjectTaskStats(projectId: string) {
  const result = await db
    .select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'completed')::int`
    })
    .from(tasks)
    .where(eq(tasks.project_id, projectId));

  const total = result[0]?.total || 0;
  const completed = result[0]?.completed || 0;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { tasks_total: total, tasks_completed: completed, tasks_progress: progress };
}

// GET /api/projects - Get all projects or filter by status
router.get("/api/projects", async (req, res) => {
  try {
    const { status, userId, userRole } = req.query;

    let projectsList: any[];

    // Если пользователь - замерщик (или роль с view_all=false), показываем только проекты с назначенными этапами
    if (userId && userRole === 'Замерщик') {
      const projectsWithAssignedStages = await projectsRepository.getProjectsByAssignee(userId as string);

      // Фильтруем по статусу если указан
      if (status && typeof status === "string") {
        projectsList = projectsWithAssignedStages.filter(p => p.status === status);
      } else {
        projectsList = projectsWithAssignedStages;
      }
    } else {
      // Для админов и менеджеров - показываем все проекты
      if (status && typeof status === "string") {
        projectsList = await projectsRepository.getProjectsByStatus(status);
      } else {
        projectsList = await projectsRepository.getAllProjects();
      }
    }

    // Добавляем статистику по задачам для каждого проекта
    const projectsWithTaskStats = await Promise.all(
      projectsList.map(async (project) => {
        const taskStats = await getProjectTaskStats(project.id);
        return { ...project, ...taskStats };
      })
    );

    res.json(projectsWithTaskStats);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

// GET /api/projects/by-deal/:dealId - Get project by deal ID
router.get("/api/projects/by-deal/:dealId", async (req, res) => {
  try {
    const { dealId } = req.params;
    const project = await projectsRepository.getProjectByDealId(dealId);

    // Return null instead of 404 if project not found (not all deals have projects)
    res.json(project || null);
  } catch (error) {
    console.error("Error fetching project by deal:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// GET /api/projects/:id - Get project by ID with stages
router.get("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const project = await projectsRepository.getProjectById(id);
    
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    
    res.json(project);
  } catch (error) {
    console.error("Error fetching project:", error);
    res.status(500).json({ error: "Failed to fetch project" });
  }
});

// POST /api/projects - Create new project
router.post("/api/projects", async (req, res) => {
  try {
    const validationResult = insertProjectSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newProject = await projectsRepository.createProject(validationResult.data);
    res.status(201).json(newProject);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

// POST /api/projects/from-invoice - Create project from invoice
router.post("/api/projects/from-invoice", async (req, res) => {
  try {
    const requestSchema = z.object({
      dealId: z.string(),
      invoiceId: z.string(),
      selectedPositions: z.array(z.number()).optional(),
      editedPositions: z.array(z.any()).optional(),
      positionStagesData: z.record(z.object({
        stages: z.array(z.object({
          id: z.string(),
          name: z.string(),
          order_index: z.number(),
          duration_days: z.number().optional(),
          assignee_id: z.string().optional(),
          cost: z.number().optional(),
          description: z.string().optional(),
          stage_type_id: z.string().optional(),
          template_data: z.any().optional(),
        })),
        dependencies: z.array(z.object({
          stage_id: z.string(),
          depends_on_stage_id: z.string(),
        })),
      })).optional(),
    });

    const validationResult = requestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const { dealId, invoiceId, selectedPositions, editedPositions, positionStagesData } = validationResult.data;

    const deal = await salesRepository.getDealById(dealId);
    if (!deal) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }

    const invoice = await salesRepository.getDealDocumentById(invoiceId);
    if (!invoice) {
      res.status(404).json({ error: "Invoice not found" });
      return;
    }

    if (invoice.document_type !== "invoice") {
      res.status(400).json({ error: "Document is not an invoice" });
      return;
    }

    const existingProject = await projectsRepository.getProjectByDealId(dealId);
    const userId = req.headers["x-user-id"] as string;

    // If project exists and positionStagesData is provided, update the stages
    if (existingProject && positionStagesData) {
      console.log("Project exists, updating stages...");

      // Delete old stages for the affected positions and create new ones
      for (const [positionIndexStr, stageData] of Object.entries(positionStagesData)) {
        const positionIndex = parseInt(positionIndexStr);

        // Get items (positions) for this project to find the correct item_id
        const items = await projectsRepository.getProjectItems(existingProject.id);
        if (items && items.length > positionIndex) {
          const item = items[positionIndex];

          // Delete old stages for this item
          const oldStages = await projectsRepository.getProjectStages(existingProject.id);
          const stagesToDelete = oldStages.filter(s => s.item_id === item.id);

          for (const stage of stagesToDelete) {
            await projectsRepository.deleteProjectStage(stage.id);
          }

          // Create new stages
          if (stageData.stages && stageData.stages.length > 0) {
            await projectsRepository.createStagesWithDependencies(
              existingProject.id,
              item.id,
              stageData.stages,
              stageData.dependencies || []
            );
          }
        }
      }

      // Log activity
      await activityLogsRepository.logActivity({
        entity_type: "deal",
        entity_id: dealId,
        action_type: "updated",
        user_id: userId,
        description: `Обновлены этапы проекта "${existingProject.name}"`,
      });

      res.status(200).json(existingProject);
      return;
    }

    // If project exists but no stages data provided, just return existing project
    if (existingProject) {
      res.status(200).json(existingProject);
      return;
    }

    // Create new project
    const project = await projectsRepository.createProjectFromInvoice(
      dealId,
      invoiceId,
      deal,
      invoice,
      selectedPositions,
      editedPositions,
      positionStagesData
    );

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "deal",
      entity_id: dealId,
      action_type: "created",
      user_id: userId,
      description: `Создан проект "${project.name}" из ${invoice.document_type === 'invoice' ? 'счета' : 'КП'}`,
    });

    res.status(201).json(project);
  } catch (error) {
    console.error("Error creating project from invoice:", error);
    res.status(500).json({ error: "Failed to create project from invoice" });
  }
});

// PUT /api/projects/:id - Update project
router.put("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const validationResult = insertProjectSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const updatedProject = await projectsRepository.updateProject(id, validationResult.data);

    if (!updatedProject) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: id,
      action_type: "updated",
      user_id: req.body.user_id || null,
      field_changed: null,
      old_value: null,
      new_value: null,
      description: `Обновлён проект "${updatedProject.name}"`,
    });

    res.json(updatedProject);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id - Delete project
router.delete("/api/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Получаем информацию о проекте перед удалением для логирования
    const project = await projectsRepository.getProjectById(id);

    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Удаляем проект
    const deleted = await projectsRepository.deleteProject(id);

    if (!deleted) {
      res.status(500).json({ error: "Failed to delete project" });
      return;
    }

    // Логируем активность удаления (не блокируем удаление если логирование падает)
    try {
      // Используем null для user_id чтобы избежать FK constraint errors
      // Пользователь может уже не существовать в базе
      await activityLogsRepository.logActivity({
        entity_type: "project",
        entity_id: id,
        action_type: "deleted",
        user_id: null,
        field_changed: null,
        old_value: project.name,
        new_value: null,
        description: `Удалён проект "${project.name}"`,
      });
    } catch (logError) {
      console.warn("Failed to log project deletion activity:", logError);
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// GET /api/my-tasks/:userId - Get stages assigned to user
router.get("/api/my-tasks/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const stages = await projectsRepository.getStagesByAssignee(userId);
    res.json(stages);
  } catch (error) {
    console.error("Error fetching user tasks:", error);
    res.status(500).json({ error: "Failed to fetch user tasks" });
  }
});

// GET /api/my-measurement-tasks/:userId - Get measurement tasks for measurer (simplified)
router.get("/api/my-measurement-tasks/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Get only stages assigned to this user with project info
    const stagesWithProjects = await db
      .select({
        stage_id: project_stages.id,
        stage_name: project_stages.name,
        stage_status: project_stages.status,
        stage_type_id: project_stages.stage_type_id,
        deadline: project_stages.planned_end_date,
        type_data: project_stages.type_data,
        project_id: projects.id,
        project_name: projects.name,
        client_name: projects.client_name,
      })
      .from(project_stages)
      .leftJoin(projects, eq(projects.id, project_stages.project_id))
      .where(eq(project_stages.assignee_id, userId));

    // Map to simplified task format
    const tasks = stagesWithProjects.map((row) => {
      // Parse type_data to extract address
      let address = '';
      if (row.type_data) {
        try {
          const typeData = typeof row.type_data === 'string'
            ? JSON.parse(row.type_data)
            : row.type_data;
          address = typeData.address || '';
        } catch (e) {
          // Ignore parse errors
        }
      }

      return {
        id: row.stage_id,
        project_id: row.project_id,
        project_name: row.project_name,
        client_name: row.client_name,
        stage_name: row.stage_name,
        status: row.stage_status,
        deadline: row.deadline,
        address: address,
      };
    });

    res.json(tasks);
  } catch (error) {
    console.error("Error fetching measurer tasks:", error);
    res.status(500).json({ error: "Failed to fetch measurer tasks" });
  }
});

// GET /api/projects/:id/stages - Get all stages for a project
router.get("/api/projects/:id/stages", async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await projectsRepository.getProjectById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    
    const stages = await projectsRepository.getProjectStages(id);
    res.json(stages);
  } catch (error) {
    console.error("Error fetching project stages:", error);
    res.status(500).json({ error: "Failed to fetch project stages" });
  }
});

// POST /api/projects/:id/stages - Create stage for project
router.post("/api/projects/:id/stages", async (req, res) => {
  try {
    const { id } = req.params;

    const project = await projectsRepository.getProjectById(id);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const validationResult = insertProjectStageSchema.safeParse({
      ...req.body,
      project_id: id
    });

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newStage = await projectsRepository.createProjectStage(validationResult.data);

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: id,
      action_type: "created",
      user_id: req.body.user_id || null,
      field_changed: "stage",
      old_value: null,
      new_value: newStage.name,
      description: `Создан этап "${newStage.name}"`,
    });

    res.status(201).json(newStage);
  } catch (error) {
    console.error("Error creating project stage:", error);
    res.status(500).json({ error: "Failed to create project stage" });
  }
});

// PUT /api/projects/stages/:stageId - Update stage
router.put("/api/projects/stages/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params;

    const validationResult = insertProjectStageSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    // Get old stage before updating (for logging)
    const oldStageResult = await db
      .select()
      .from(project_stages)
      .where(eq(project_stages.id, stageId))
      .limit(1);
    const oldStage = oldStageResult[0];

    const updatedStage = await projectsRepository.updateProjectStage(stageId, validationResult.data);

    if (!updatedStage) {
      res.status(404).json({ error: "Project stage not found" });
      return;
    }

    // Log activity for deadline changes
    if (validationResult.data.deadline) {
      await activityLogsRepository.logActivity({
        entity_type: "project",
        entity_id: updatedStage.project_id,
        action_type: "deadline_changed",
        user_id: req.body.user_id || null,
        field_changed: "deadline",
        old_value: null,
        new_value: validationResult.data.deadline.toString(),
        description: `Изменён дедлайн этапа "${updatedStage.name}"`,
      });
    }

    // Log measurement_date changes in type_data
    if (validationResult.data.type_data && oldStage) {
      try {
        const oldTypeData = oldStage.type_data
          ? (typeof oldStage.type_data === 'string' ? JSON.parse(oldStage.type_data) : oldStage.type_data)
          : {};
        const newTypeData = typeof validationResult.data.type_data === 'string'
          ? JSON.parse(validationResult.data.type_data)
          : validationResult.data.type_data;

        const oldMeasurementDate = oldTypeData.measurement_date;
        const newMeasurementDate = newTypeData.measurement_date;

        if (oldMeasurementDate !== newMeasurementDate && newMeasurementDate) {
          await activityLogsRepository.logActivity({
            entity_type: "project",
            entity_id: updatedStage.project_id,
            action_type: "measurement_date_changed",
            user_id: req.body.user_id || null,
            field_changed: "measurement_date",
            old_value: oldMeasurementDate || null,
            new_value: newMeasurementDate,
            description: `Изменена дата замера для этапа "${updatedStage.name}"`,
          });
        }
      } catch (e) {
        console.error("Error parsing type_data for logging:", e);
      }
    }

    // Log general stage update if no specific field was logged
    if (!validationResult.data.deadline && !validationResult.data.type_data) {
      await activityLogsRepository.logActivity({
        entity_type: "project",
        entity_id: updatedStage.project_id,
        action_type: "stage_updated",
        user_id: req.body.user_id || null,
        field_changed: null,
        old_value: null,
        new_value: null,
        description: `Обновлён этап "${updatedStage.name}"`,
      });
    }

    res.json(updatedStage);
  } catch (error) {
    console.error("Error updating project stage:", error);
    res.status(500).json({ error: "Failed to update project stage" });
  }
});

// DELETE /api/projects/stages/:stageId - Delete stage
router.delete("/api/projects/stages/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params;
    const rawUserRole = req.headers['x-user-role'] as string;
    // Decode URI-encoded role name (handles Cyrillic characters)
    const userRole = rawUserRole ? decodeURIComponent(rawUserRole) : '';

    // Get stage info before deleting
    const stage = await db.select().from(project_stages).where(eq(project_stages.id, stageId)).limit(1);
    const stageInfo = stage[0];

    // Проверка: системный этап может удалять только администратор
    if (stageInfo?.is_system === 1 && userRole !== 'Администратор') {
      res.status(403).json({ error: "Системный этап может удалить только администратор" });
      return;
    }

    const deleted = await projectsRepository.deleteProjectStage(stageId);

    if (!deleted) {
      res.status(404).json({ error: "Project stage not found" });
      return;
    }

    // Log activity
    if (stageInfo) {
      await activityLogsRepository.logActivity({
        entity_type: "project",
        entity_id: stageInfo.project_id,
        action_type: "deleted",
        user_id: req.body.user_id || null,
        field_changed: "stage",
        old_value: stageInfo.name,
        new_value: null,
        description: `Удалён этап "${stageInfo.name}"`,
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project stage:", error);
    res.status(500).json({ error: "Failed to delete project stage" });
  }
});

// POST /api/projects/:id/start - Start project execution
router.post("/api/projects/:id/start", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedProject = await projectsRepository.startProject(id);

    if (!updatedProject) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: id,
      action_type: "started",
      user_id: req.body.user_id || null,
      field_changed: "status",
      old_value: "pending",
      new_value: "in_progress",
      description: `Проект "${updatedProject.name}" запущен`,
    });

    res.json(updatedProject);
  } catch (error) {
    console.error("Error starting project:", error);
    res.status(500).json({ error: "Failed to start project" });
  }
});

// POST /api/projects/:id/pause - Pause project execution
router.post("/api/projects/:id/pause", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedProject = await projectsRepository.pauseProject(id);

    if (!updatedProject) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: id,
      action_type: "paused",
      user_id: req.body.user_id || null,
      field_changed: "status",
      old_value: "in_progress",
      new_value: "on_hold",
      description: `Проект "${updatedProject.name}" приостановлен`,
    });

    res.json(updatedProject);
  } catch (error) {
    console.error("Error pausing project:", error);
    res.status(500).json({ error: "Failed to pause project" });
  }
});

// POST /api/projects/:id/complete - Complete project execution
router.post("/api/projects/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedProject = await projectsRepository.completeProject(id);

    if (!updatedProject) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: id,
      action_type: "completed",
      user_id: req.body.user_id || null,
      field_changed: "status",
      old_value: "in_progress",
      new_value: "completed",
      description: `Проект "${updatedProject.name}" завершен`,
    });

    res.json(updatedProject);
  } catch (error) {
    console.error("Error completing project:", error);
    res.status(500).json({ error: "Failed to complete project" });
  }
});

// POST /api/projects/stages/:stageId/start - Start stage execution
router.post("/api/projects/stages/:stageId/start", async (req, res) => {
  try {
    const { stageId } = req.params;
    const updatedStage = await projectsRepository.startStage(stageId);

    if (!updatedStage) {
      res.status(404).json({ error: "Project stage not found" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: updatedStage.project_id,
      action_type: "stage_started",
      user_id: req.body.user_id || null,
      field_changed: "stage_status",
      old_value: "pending",
      new_value: "in_progress",
      description: `Запущен этап "${updatedStage.name}"`,
    });

    res.json(updatedStage);
  } catch (error) {
    console.error("Error starting stage:", error);
    res.status(500).json({ error: "Failed to start stage" });
  }
});

// POST /api/projects/stages/:stageId/complete - Complete stage execution
router.post("/api/projects/stages/:stageId/complete", async (req, res) => {
  try {
    const { stageId } = req.params;
    const updatedStage = await projectsRepository.completeStage(stageId);

    if (!updatedStage) {
      res.status(404).json({ error: "Project stage not found" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: updatedStage.project_id,
      action_type: "stage_completed",
      user_id: req.body.user_id || null,
      field_changed: "stage_status",
      old_value: "in_progress",
      new_value: "completed",
      description: `Завершён этап "${updatedStage.name}"`,
    });

    res.json(updatedStage);
  } catch (error) {
    console.error("Error completing stage:", error);
    res.status(500).json({ error: "Failed to complete stage" });
  }
});

// GET /api/projects/:id/timeline - Get project timeline statistics
router.get("/api/projects/:id/timeline", async (req, res) => {
  try {
    const { id } = req.params;
    const timeline = await projectsRepository.getProjectTimeline(id);
    
    if (!timeline) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    
    res.json(timeline);
  } catch (error) {
    console.error("Error fetching project timeline:", error);
    res.status(500).json({ error: "Failed to fetch project timeline" });
  }
});

// GET /api/projects/stages/:stageId - Get single stage by ID
router.get("/api/projects/stages/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params;
    const result = await db.select().from(project_stages).where(eq(project_stages.id, stageId));
    
    if (!result[0]) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error("Error fetching stage:", error);
    res.status(500).json({ error: "Failed to fetch stage" });
  }
});

// ===== Project Items Routes =====

// GET /api/projects/:projectId/items - Get all items for a project
router.get("/api/projects/:projectId/items", async (req, res) => {
  try {
    const { projectId } = req.params;
    const items = await projectsRepository.getProjectItems(projectId);
    res.json(items);
  } catch (error) {
    console.error("Error fetching project items:", error);
    res.status(500).json({ error: "Failed to fetch project items" });
  }
});

// POST /api/projects/:projectId/items - Create new item
router.post("/api/projects/:projectId/items", async (req, res) => {
  try {
    const { projectId } = req.params;

    const validationResult = insertProjectItemSchema.safeParse({
      ...req.body,
      project_id: projectId
    });

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newItem = await projectsRepository.createProjectItem(validationResult.data);

    // Автоматически создаём этап "Снабжение" для новой позиции
    try {
      const procurementStageType = await stageTypesRepository.getStageTypeByCode('procurement');
      if (procurementStageType) {
        await projectsRepository.createProjectStage({
          project_id: projectId,
          item_id: newItem.id,
          stage_type_id: procurementStageType.id,
          name: procurementStageType.name,
          status: 'pending',
          order: 0,
          is_system: 1 // Системный этап, удаление только для админа
        });
      }
    } catch (stageError) {
      console.error("Error auto-creating procurement stage:", stageError);
      // Не прерываем создание позиции если этап не создался
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: projectId,
      action_type: "created",
      user_id: req.body.user_id || null,
      field_changed: "item",
      old_value: null,
      new_value: newItem.name,
      description: `Добавлена позиция "${newItem.name}"`,
    });

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating project item:", error);
    res.status(500).json({ error: "Failed to create project item" });
  }
});

// GET /api/projects/items/:itemId - Get single project item by ID
router.get("/api/projects/items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const item = await projectsRepository.getProjectItemById(itemId);

    if (!item) {
      res.status(404).json({ error: "Project item not found" });
      return;
    }

    res.json(item);
  } catch (error) {
    console.error("Error fetching project item:", error);
    res.status(500).json({ error: "Failed to fetch project item" });
  }
});

// PUT /api/projects/:projectId/items/:itemId - Update item
router.put("/api/projects/:projectId/items/:itemId", async (req, res) => {
  try {
    const { itemId, projectId } = req.params;

    const validationResult = insertProjectItemSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const updatedItem = await projectsRepository.updateProjectItem(itemId, validationResult.data);

    if (!updatedItem) {
      res.status(404).json({ error: "Project item not found" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: projectId,
      action_type: "updated",
      user_id: req.body.user_id || null,
      field_changed: "item",
      old_value: null,
      new_value: updatedItem.name,
      description: `Обновлена позиция "${updatedItem.name}"`,
    });

    res.json(updatedItem);
  } catch (error) {
    console.error("Error updating project item:", error);
    res.status(500).json({ error: "Failed to update project item" });
  }
});

// DELETE /api/projects/:projectId/items/:itemId - Delete item
router.delete("/api/projects/:projectId/items/:itemId", async (req, res) => {
  try {
    const { itemId, projectId } = req.params;

    // Get item info before deleting
    const item = await db.select().from(project_items).where(eq(project_items.id, itemId)).limit(1);
    const itemInfo = item[0];

    const deleted = await projectsRepository.deleteProjectItem(itemId);

    if (!deleted) {
      res.status(404).json({ error: "Project item not found" });
      return;
    }

    // Log activity
    if (itemInfo) {
      await activityLogsRepository.logActivity({
        entity_type: "project",
        entity_id: projectId,
        action_type: "deleted",
        user_id: req.body.user_id || null,
        field_changed: "item",
        old_value: itemInfo.name,
        new_value: null,
        description: `Удалена позиция "${itemInfo.name}"`,
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project item:", error);
    res.status(500).json({ error: "Failed to delete project item" });
  }
});

// POST /api/projects/:projectId/items/:itemId/stages - Create stage for specific item
router.post("/api/projects/:projectId/items/:itemId/stages", async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    
    const validationResult = insertProjectStageSchema.safeParse({
      ...req.body,
      project_id: projectId,
      item_id: itemId
    });
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newStage = await projectsRepository.createProjectStage(validationResult.data);
    res.status(201).json(newStage);
  } catch (error) {
    console.error("Error creating stage for item:", error);
    res.status(500).json({ error: "Failed to create stage for item" });
  }
});

// GET /api/projects/:projectId/items/:itemId/stages - Get stages for specific item
router.get("/api/projects/:projectId/items/:itemId/stages", async (req, res) => {
  try {
    const { projectId, itemId } = req.params;
    let stages = await projectsRepository.getItemStages(itemId);

    // Автоматически создаём этап "Снабжение" если его нет
    const procurementStageType = await stageTypesRepository.getStageTypeByCode('procurement');
    if (procurementStageType) {
      const hasProcurement = stages.some(s => s.stage_type_id === procurementStageType.id);
      if (!hasProcurement) {
        try {
          const newStage = await projectsRepository.createProjectStage({
            project_id: projectId,
            item_id: itemId,
            stage_type_id: procurementStageType.id,
            name: procurementStageType.name,
            status: 'pending',
            order: 0,
            is_system: 1
          });
          stages = [newStage, ...stages];
          console.log(`[Projects] Auto-created procurement stage for item ${itemId}`);
        } catch (stageError) {
          console.error("Error auto-creating procurement stage:", stageError);
        }
      }
    }

    res.json(stages);
  } catch (error) {
    console.error("Error fetching item stages:", error);
    res.status(500).json({ error: "Failed to fetch item stages" });
  }
});

// PATCH /api/projects/:projectId/items/:itemId/stages/reorder - Reorder stages atomically
router.patch("/api/projects/:projectId/items/:itemId/stages/reorder", async (req, res) => {
  try {
    const { itemId } = req.params;
    
    const requestSchema = z.object({
      stageIds: z.array(z.string()).min(1, "stageIds array must not be empty")
    });
    
    const validationResult = requestSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const { stageIds } = validationResult.data;
    
    // Validate that all stageIds belong to this item
    const itemStages = await projectsRepository.getItemStages(itemId);
    const itemStageIds = itemStages.map(s => s.id);
    
    // Check if count matches
    if (stageIds.length !== itemStages.length) {
      res.status(400).json({ 
        error: `Invalid stageIds count. Expected ${itemStages.length}, got ${stageIds.length}` 
      });
      return;
    }
    
    // Check if all stageIds belong to this item
    const invalidIds = stageIds.filter(id => !itemStageIds.includes(id));
    if (invalidIds.length > 0) {
      res.status(400).json({ 
        error: `Some stage IDs do not belong to this item: ${invalidIds.join(', ')}` 
      });
      return;
    }
    
    // Perform atomic reorder
    await projectsRepository.reorderItemStages(itemId, stageIds);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error reordering item stages:", error);
    res.status(500).json({ error: "Failed to reorder item stages" });
  }
});

// ===== Stage Dependencies Routes =====

// GET /api/projects/:projectId/dependencies - Get all dependencies for a project
router.get("/api/projects/:projectId/dependencies", async (req, res) => {
  try {
    const { projectId } = req.params;
    const dependencies = await projectsRepository.getProjectDependencies(projectId);
    res.json(dependencies);
  } catch (error) {
    console.error("Error fetching project dependencies:", error);
    res.status(500).json({ error: "Failed to fetch project dependencies" });
  }
});

// POST /api/stages/:stageId/dependencies - Create dependency
router.post("/api/stages/:stageId/dependencies", async (req, res) => {
  try {
    const { stageId } = req.params;
    
    const validationResult = insertStageDependencySchema.safeParse({
      stage_id: stageId,
      depends_on_stage_id: req.body.depends_on_stage_id
    });
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newDependency = await projectsRepository.createStageDependency(validationResult.data);
    res.status(201).json(newDependency);
  } catch (error) {
    console.error("Error creating stage dependency:", error);
    res.status(500).json({ error: "Failed to create stage dependency" });
  }
});

// DELETE /api/stages/dependencies/:dependencyId - Delete dependency
router.delete("/api/stages/dependencies/:dependencyId", async (req, res) => {
  try {
    const { dependencyId } = req.params;
    const deleted = await projectsRepository.deleteStageDependency(dependencyId);

    if (!deleted) {
      res.status(404).json({ error: "Stage dependency not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting stage dependency:", error);
    res.status(500).json({ error: "Failed to delete stage dependency" });
  }
});

// GET /api/stages/:stageId/blockers - Check if stage is blocked by dependencies
router.get("/api/stages/:stageId/blockers", async (req, res) => {
  try {
    const { stageId } = req.params;
    const blockerInfo = await projectsRepository.checkStageBlockers(stageId);
    res.json(blockerInfo);
  } catch (error) {
    console.error("Error checking stage blockers:", error);
    res.status(500).json({ error: "Failed to check stage blockers" });
  }
});

// ===== Process Templates Routes =====

// GET /api/process-templates - Get all templates
router.get("/api/process-templates", async (req, res) => {
  try {
    const templates = await projectsRepository.getAllTemplates();
    res.json(templates);
  } catch (error) {
    console.error("Error fetching process templates:", error);
    res.status(500).json({ error: "Failed to fetch process templates" });
  }
});

// POST /api/process-templates - Create template
router.post("/api/process-templates", async (req, res) => {
  try {
    const validationResult = insertProcessTemplateSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newTemplate = await projectsRepository.createTemplate(validationResult.data);
    res.status(201).json(newTemplate);
  } catch (error) {
    console.error("Error creating process template:", error);
    res.status(500).json({ error: "Failed to create process template" });
  }
});

// GET /api/process-templates/:templateId - Get template with stages and dependencies
router.get("/api/process-templates/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const template = await projectsRepository.getTemplateById(templateId);
    if (!template) {
      res.status(404).json({ error: "Process template not found" });
      return;
    }
    
    const stages = await projectsRepository.getTemplateStages(templateId);
    const dependencies = await projectsRepository.getTemplateDependencies(templateId);
    
    res.json({ ...template, stages, dependencies });
  } catch (error) {
    console.error("Error fetching process template:", error);
    res.status(500).json({ error: "Failed to fetch process template" });
  }
});

// PUT /api/process-templates/:templateId - Update template
router.put("/api/process-templates/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const validationResult = insertProcessTemplateSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const updatedTemplate = await projectsRepository.updateTemplate(templateId, validationResult.data);
    
    if (!updatedTemplate) {
      res.status(404).json({ error: "Process template not found" });
      return;
    }
    
    res.json(updatedTemplate);
  } catch (error) {
    console.error("Error updating process template:", error);
    res.status(500).json({ error: "Failed to update process template" });
  }
});

// DELETE /api/process-templates/:templateId - Delete template
router.delete("/api/process-templates/:templateId", async (req, res) => {
  try {
    const { templateId } = req.params;
    const deleted = await projectsRepository.deleteTemplate(templateId);
    
    if (!deleted) {
      res.status(404).json({ error: "Process template not found" });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting process template:", error);
    res.status(500).json({ error: "Failed to delete process template" });
  }
});

// POST /api/process-templates/:templateId/apply - Apply template to item
router.post("/api/process-templates/:templateId/apply", async (req, res) => {
  try {
    const { templateId } = req.params;
    const { item_id } = req.body;

    if (!item_id) {
      res.status(400).json({ error: "item_id is required" });
      return;
    }

    const template = await projectsRepository.getTemplateById(templateId);
    const result = await projectsRepository.applyTemplateToItem(templateId, item_id);

    // Get project_id from item
    const itemData = await db.select().from(project_items).where(eq(project_items.id, item_id)).limit(1);
    if (itemData[0] && template) {
      await activityLogsRepository.logActivity({
        entity_type: "project",
        entity_id: itemData[0].project_id,
        action_type: "created",
        user_id: req.body.user_id || null,
        field_changed: "business_process",
        old_value: null,
        new_value: template.name,
        description: `Применён бизнес-процесс "${template.name}"`,
      });
    }

    res.status(201).json(result);
  } catch (error) {
    console.error("Error applying template:", error);
    res.status(500).json({ error: "Failed to apply template" });
  }
});

// ===== Template Stages Routes =====

// GET /api/process-templates/:templateId/stages - Get template stages
router.get("/api/process-templates/:templateId/stages", async (req, res) => {
  try {
    const { templateId } = req.params;
    const stages = await projectsRepository.getTemplateStages(templateId);
    res.json(stages);
  } catch (error) {
    console.error("Error fetching template stages:", error);
    res.status(500).json({ error: "Failed to fetch template stages" });
  }
});

// POST /api/process-templates/:templateId/stages - Create template stage
router.post("/api/process-templates/:templateId/stages", async (req, res) => {
  try {
    const { templateId } = req.params;
    
    const validationResult = insertTemplateStageSchema.safeParse({
      ...req.body,
      template_id: templateId
    });
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newStage = await projectsRepository.createTemplateStage(validationResult.data);
    res.status(201).json(newStage);
  } catch (error) {
    console.error("Error creating template stage:", error);
    res.status(500).json({ error: "Failed to create template stage" });
  }
});

// PUT /api/template-stages/:stageId - Update template stage
router.put("/api/template-stages/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params;
    
    const validationResult = insertTemplateStageSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const updatedStage = await projectsRepository.updateTemplateStage(stageId, validationResult.data);
    
    if (!updatedStage) {
      res.status(404).json({ error: "Template stage not found" });
      return;
    }
    
    res.json(updatedStage);
  } catch (error) {
    console.error("Error updating template stage:", error);
    res.status(500).json({ error: "Failed to update template stage" });
  }
});

// DELETE /api/template-stages/:stageId - Delete template stage
router.delete("/api/template-stages/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params;
    const deleted = await projectsRepository.deleteTemplateStage(stageId);
    
    if (!deleted) {
      res.status(404).json({ error: "Template stage not found" });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template stage:", error);
    res.status(500).json({ error: "Failed to delete template stage" });
  }
});

// ===== Template Dependencies Routes =====

// POST /api/template-stages/:stageId/dependencies - Create template dependency
router.post("/api/template-stages/:stageId/dependencies", async (req, res) => {
  try {
    const { stageId } = req.params;
    
    const validationResult = insertTemplateDependencySchema.safeParse({
      template_stage_id: stageId,
      depends_on_template_stage_id: req.body.depends_on_template_stage_id
    });
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    const newDependency = await projectsRepository.createTemplateDependency(validationResult.data);
    res.status(201).json(newDependency);
  } catch (error) {
    console.error("Error creating template dependency:", error);
    res.status(500).json({ error: "Failed to create template dependency" });
  }
});

// DELETE /api/template-dependencies/:dependencyId - Delete template dependency
router.delete("/api/template-dependencies/:dependencyId", async (req, res) => {
  try {
    const { dependencyId } = req.params;
    const deleted = await projectsRepository.deleteTemplateDependency(dependencyId);
    
    if (!deleted) {
      res.status(404).json({ error: "Template dependency not found" });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting template dependency:", error);
    res.status(500).json({ error: "Failed to delete template dependency" });
  }
});

// ===== Stage Messages Routes =====

// GET /api/stages/:stageId/messages - Get stage messages
router.get("/api/stages/:stageId/messages", async (req, res) => {
  try {
    const { stageId } = req.params;
    const messages = await projectsRepository.getStageMessages(stageId);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching stage messages:", error);
    res.status(500).json({ error: "Failed to fetch stage messages" });
  }
});

// POST /api/stages/:stageId/messages - Create stage message
router.post("/api/stages/:stageId/messages", async (req, res) => {
  try {
    const { stageId } = req.params;

    const validationResult = insertStageMessageSchema.safeParse({
      stage_id: stageId,
      user_id: req.body.user_id,
      message: req.body.message
    });

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newMessage = await projectsRepository.createStageMessage(validationResult.data);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error creating stage message:", error);
    res.status(500).json({ error: "Failed to create stage message" });
  }
});

// ===== Project Messages Routes =====

// GET /api/projects/:projectId/messages - Get project messages
router.get("/api/projects/:projectId/messages", async (req, res) => {
  try {
    const { projectId } = req.params;
    const messages = await projectsRepository.getProjectMessages(projectId);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching project messages:", error);
    res.status(500).json({ error: "Failed to fetch project messages" });
  }
});

// POST /api/projects/:projectId/messages - Create project message
router.post("/api/projects/:projectId/messages", async (req, res) => {
  try {
    const { projectId } = req.params;

    const validationResult = insertProjectMessageSchema.safeParse({
      project_id: projectId,
      user_id: req.body.user_id,
      message: req.body.message
    });

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newMessage = await projectsRepository.createProjectMessage(validationResult.data);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error creating project message:", error);
    res.status(500).json({ error: "Failed to create project message" });
  }
});

// GET /api/stages/:stageId/documents - Get stage documents
router.get("/api/stages/:stageId/documents", async (req, res) => {
  try {
    const { stageId } = req.params;
    const documents = await projectsRepository.getStageDocuments(stageId);
    res.json(documents);
  } catch (error) {
    console.error("Error fetching stage documents:", error);
    res.status(500).json({ error: "Failed to fetch stage documents" });
  }
});

// GET /api/projects/:projectId/documents - Get all project documents
router.get("/api/projects/:projectId/documents", async (req, res) => {
  try {
    const { projectId } = req.params;
    const documents = await projectsRepository.getProjectDocuments(projectId);
    res.json(documents);
  } catch (error) {
    console.error("Error fetching project documents:", error);
    res.status(500).json({ error: "Failed to fetch project documents" });
  }
});

// GET /api/projects/:projectId/documents/grouped - Get all project documents grouped by stages
router.get("/api/projects/:projectId/documents/grouped", async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.headers["x-user-id"] as string || undefined;
    const documentsGrouped = await projectsRepository.getProjectDocumentsGrouped(projectId, userId);
    res.json(documentsGrouped);
  } catch (error) {
    console.error("Error fetching grouped project documents:", error);
    res.status(500).json({ error: "Failed to fetch grouped project documents" });
  }
});

// POST /api/projects/:projectId/documents/upload - Upload document to project (creates default stage if needed)
router.post("/api/projects/:projectId/documents/upload", async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }

    // Verify project exists
    const project = await projectsRepository.getProjectById(projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!req.body.file_url) {
      res.status(400).json({ error: "file_url is required" });
      return;
    }

    // Get or create default documents stage for this project
    let stages = await projectsRepository.getProjectStages(projectId);
    let documentStage = stages.find(s => s.name === "Документы" || s.stage_type === "documents");

    if (!documentStage) {
      // Create default documents stage
      documentStage = await projectsRepository.createProjectStage({
        project_id: projectId,
        name: "Документы",
        stage_type: "documents",
        status: "active",
        order: stages.length + 1,
      });
    }

    // Create document data
    const documentData = {
      stage_id: documentStage.id,
      uploaded_by: userId,
      file_name: req.body.file_name,
      file_url: req.body.file_url,
      file_size: req.body.file_size,
      mime_type: req.body.mime_type,
      document_type: req.body.document_type || 'document',
      media_type: req.body.media_type || 'document',
    };

    // Create document record
    const newDocument = await projectsRepository.createStageDocument(documentData);

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: projectId,
      action_type: "document_uploaded",
      user_id: userId,
      description: `Загружен документ: ${newDocument.file_name || 'без имени'}`,
    });

    res.status(201).json(newDocument);
  } catch (error) {
    console.error("Error uploading project document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// POST /api/stages/:stageId/documents - Upload document to stage
router.post("/api/stages/:stageId/documents", async (req, res) => {
  try {
    const { stageId } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }

    // Verify stage exists
    const stage = await projectsRepository.getStageById(stageId);
    if (!stage) {
      res.status(404).json({ error: "Stage not found" });
      return;
    }

    // Create document data
    const documentData = {
      stage_id: stageId,
      uploaded_by: userId,
      file_name: req.body.file_name,
      file_url: req.body.file_url,
      file_size: req.body.file_size,
      mime_type: req.body.mime_type,
      document_type: req.body.document_type || 'document',
      media_type: req.body.media_type || 'document',
    };

    if (!req.body.file_url) {
      res.status(400).json({ error: "file_url is required" });
      return;
    }

    // Create document record
    const newDocument = await projectsRepository.createStageDocument(documentData);

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: stage.project_id,
      action_type: "document_uploaded",
      user_id: userId,
      description: `Загружен документ: ${newDocument.file_name || 'без имени'}`,
    });

    res.status(201).json(newDocument);
  } catch (error) {
    console.error("Error uploading stage document:", error);
    res.status(500).json({ error: "Failed to upload document" });
  }
});

// ===== Deadline Management Routes =====

// GET /api/stages/:stageId/deadline-history - Get deadline change history for a stage
router.get("/api/stages/:stageId/deadline-history", async (req, res) => {
  try {
    const { stageId } = req.params;
    const history = await projectsRepository.getStageDeadlineHistory(stageId);
    res.json(history);
  } catch (error) {
    console.error("Error fetching deadline history:", error);
    res.status(500).json({ error: "Failed to fetch deadline history" });
  }
});

// GET /api/projects/:projectId/final-deadline - Calculate project final deadline
router.get("/api/projects/:projectId/final-deadline", async (req, res) => {
  try {
    const { projectId } = req.params;
    const finalDeadline = await projectsRepository.calculateProjectFinalDeadline(projectId);
    res.json({ finalDeadline });
  } catch (error) {
    console.error("Error calculating final deadline:", error);
    res.status(500).json({ error: "Failed to calculate final deadline" });
  }
});

// PUT /api/stages/:stageId/deadline - Update stage deadline with auto-shift
router.put("/api/stages/:stageId/deadline", async (req, res) => {
  try {
    const { stageId } = req.params;
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      res.status(401).json({ error: "User authentication required" });
      return;
    }

    const requestSchema = z.object({
      planned_start_date: z.string().nullable().optional().transform(val => val ? new Date(val) : null),
      planned_end_date: z.string().nullable().optional().transform(val => val ? new Date(val) : null),
      user_name: z.string(),
      reason: z.string().optional(),
    });

    const validationResult = requestSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const { planned_start_date, planned_end_date, user_name, reason } = validationResult.data;

    const result = await projectsRepository.updateStageDeadlineWithAutoShift(
      stageId,
      planned_start_date,
      planned_end_date,
      userId,
      user_name,
      reason
    );

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: result.updatedStage.project_id,
      action_type: "deadline_changed",
      user_id: userId,
      field_changed: "deadline",
      old_value: null,
      new_value: null,
      description: `Изменены сроки этапа "${result.updatedStage.name}"${result.shiftedStages.length > 0 ? `, автоматически сдвинуто этапов: ${result.shiftedStages.length}` : ''}`,
    });

    res.json(result);
  } catch (error) {
    console.error("Error updating stage deadline:", error);
    res.status(500).json({ error: "Failed to update stage deadline" });
  }
});

// ===== Tasks Routes =====

// GET /api/projects/:projectId/tasks - Get all tasks for a project
router.get("/api/projects/:projectId/tasks", async (req, res) => {
  try {
    const { projectId } = req.params;
    const tasks = await tasksRepository.getTasksByProject(projectId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching project tasks:", error);
    res.status(500).json({ error: "Failed to fetch project tasks" });
  }
});

// GET /api/stages/:stageId/tasks - Get all tasks for a stage
router.get("/api/stages/:stageId/tasks", async (req, res) => {
  try {
    const { stageId } = req.params;
    const tasks = await tasksRepository.getTasksByStage(stageId);
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching stage tasks:", error);
    res.status(500).json({ error: "Failed to fetch stage tasks" });
  }
});

// ===== Project Events (Activity Logs) =====

// GET /api/projects/:projectId/events - Get project events (activity logs)
router.get("/api/projects/:projectId/events", async (req, res) => {
  try {
    const { projectId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    // Get activity logs for this project
    const events = await activityLogsRepository.getActivityLogs('project', projectId, limit);
    res.json(events);
  } catch (error) {
    console.error("Error fetching project events:", error);
    res.status(500).json({ error: "Failed to fetch project events" });
  }
});

// ===== Ready for Montage =====

// PUT /api/project-items/:itemId/ready-for-montage - Toggle ready for montage status
router.put("/api/project-items/:itemId/ready-for-montage", async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.headers["x-user-id"] as string;

    // Get current item
    const item = await db.select().from(project_items).where(eq(project_items.id, itemId)).limit(1);

    if (!item[0]) {
      res.status(404).json({ error: "Project item not found" });
      return;
    }

    const currentItem = item[0];
    const newStatus = !currentItem.ready_for_montage;

    // Update the item
    const result = await db
      .update(project_items)
      .set({
        ready_for_montage: newStatus,
        updated_at: new Date()
      })
      .where(eq(project_items.id, itemId))
      .returning();

    if (!result[0]) {
      res.status(500).json({ error: "Failed to update item" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: currentItem.project_id,
      action_type: newStatus ? "item_ready_for_montage" : "item_not_ready_for_montage",
      user_id: userId || null,
      field_changed: "ready_for_montage",
      old_value: String(!newStatus),
      new_value: String(newStatus),
      description: newStatus
        ? `Изделие "${currentItem.name}" готово к монтажу`
        : `Изделие "${currentItem.name}" снято с готовности к монтажу`,
    });

    res.json(result[0]);
  } catch (error) {
    console.error("Error updating ready for montage status:", error);
    res.status(500).json({ error: "Failed to update ready for montage status" });
  }
});

// GET /api/projects/:projectId/items/ready-for-montage - Get items ready for montage
router.get("/api/projects/:projectId/items/ready-for-montage", async (req, res) => {
  try {
    const { projectId } = req.params;

    const items = await db
      .select()
      .from(project_items)
      .where(
        and(
          eq(project_items.project_id, projectId),
          eq(project_items.ready_for_montage, true)
        )
      );

    res.json(items);
  } catch (error) {
    console.error("Error fetching items ready for montage:", error);
    res.status(500).json({ error: "Failed to fetch items ready for montage" });
  }
});

// PUT /api/project-items/:itemId/status - Update item production status
router.put("/api/project-items/:itemId/status", async (req, res) => {
  try {
    const { itemId } = req.params;
    const { status } = req.body;
    const userId = req.headers["x-user-id"] as string;

    if (!status) {
      res.status(400).json({ error: "Status is required" });
      return;
    }

    // Get current item
    const item = await db.select().from(project_items).where(eq(project_items.id, itemId)).limit(1);

    if (!item[0]) {
      res.status(404).json({ error: "Project item not found" });
      return;
    }

    const currentItem = item[0];
    const oldStatus = currentItem.status || 'new';

    // Update the item
    const result = await db
      .update(project_items)
      .set({
        status: status,
        updated_at: new Date().toISOString()
      })
      .where(eq(project_items.id, itemId))
      .returning();

    if (!result[0]) {
      res.status(500).json({ error: "Failed to update item status" });
      return;
    }

    // Log activity
    await activityLogsRepository.logActivity({
      entity_type: "project",
      entity_id: currentItem.project_id,
      action_type: "item_status_changed",
      user_id: userId || null,
      field_changed: "status",
      old_value: oldStatus,
      new_value: status,
      description: `Статус изделия "${currentItem.name}" изменён: ${oldStatus} → ${status}`,
    });

    res.json(result[0]);
  } catch (error) {
    console.error("Error updating item status:", error);
    res.status(500).json({ error: "Failed to update item status" });
  }
});

// === SUPPLIER DOCUMENTS (Документы поставщиков) ===

// GET /api/projects/:projectId/supplier-documents - Get all supplier documents
router.get("/api/projects/:projectId/supplier-documents", async (req, res) => {
  try {
    const { projectId } = req.params;
    const documents = await db
      .select()
      .from(project_supplier_documents)
      .where(eq(project_supplier_documents.project_id, projectId))
      .orderBy(desc(project_supplier_documents.created_at));

    res.json(documents);
  } catch (error) {
    console.error("Error fetching supplier documents:", error);
    res.status(500).json({ error: "Failed to fetch supplier documents" });
  }
});

// POST /api/projects/:projectId/supplier-documents - Upload supplier document
router.post("/api/projects/:projectId/supplier-documents", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { file_name, file_path, file_size, mime_type } = req.body;

    if (!file_name || !file_path) {
      res.status(400).json({ error: "file_name and file_path are required" });
      return;
    }

    // Explicitly only insert allowed fields (no uploaded_by to avoid FK issues)
    const newDoc = await db
      .insert(project_supplier_documents)
      .values({
        project_id: projectId,
        file_name,
        file_path,
        file_size: file_size || null,
        mime_type: mime_type || null,
      })
      .returning();

    res.status(201).json(newDoc[0]);
  } catch (error) {
    console.error("Error creating supplier document:", error);
    res.status(500).json({ error: "Failed to create supplier document" });
  }
});

// DELETE /api/projects/:projectId/supplier-documents/:docId - Delete supplier document
router.delete("/api/projects/:projectId/supplier-documents/:docId", async (req, res) => {
  try {
    const { docId } = req.params;

    // Get the document to find file path
    const doc = await db
      .select()
      .from(project_supplier_documents)
      .where(eq(project_supplier_documents.id, docId))
      .limit(1);

    if (doc.length === 0) {
      res.status(404).json({ error: "Document not found" });
      return;
    }

    // Delete file from storage
    if (doc[0].file_path) {
      try {
        await localFileStorage.deleteFile(doc[0].file_path);
      } catch (e) {
        console.warn("Failed to delete file from storage:", e);
      }
    }

    // Delete from database
    await db
      .delete(project_supplier_documents)
      .where(eq(project_supplier_documents.id, docId));

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting supplier document:", error);
    res.status(500).json({ error: "Failed to delete supplier document" });
  }
});
