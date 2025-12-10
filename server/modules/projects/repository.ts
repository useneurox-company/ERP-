import { db } from "../../db";
import { eq, asc, or, and, sql } from "drizzle-orm";
import type {
  Project, InsertProject,
  ProjectStage, InsertProjectStage,
  ProjectItem, InsertProjectItem,
  StageDependency, InsertStageDependency,
  ProcessTemplate, InsertProcessTemplate,
  TemplateStage, InsertTemplateStage,
  TemplateDependency, InsertTemplateDependency,
  StageMessage, InsertStageMessage,
  ProjectMessage, InsertProjectMessage,
  Document,
  StageDeadlineHistory, InsertStageDeadlineHistory,
  StageDocument, InsertStageDocument
} from "@shared/schema";
import {
  projects, project_stages, project_items,
  stage_dependencies, process_templates, template_stages,
  template_dependencies, stage_messages, project_messages, documents, users,
  stage_deadline_history, stage_documents, tasks, task_attachments
} from "@shared/schema";
import { salesRepository } from "../sales/repository";

export class ProjectsRepository {
  // Project methods
  async getAllProjects(): Promise<Array<any>> {
    const result = await db
      .select()
      .from(projects)
      .leftJoin(users, eq(projects.manager_id, users.id));

    const projectsWithManager = result.map(r => ({
      ...r.projects,
      manager_user: r.users ? {
        id: r.users.id,
        username: r.users.username,
        full_name: r.users.full_name,
        email: r.users.email,
      } : null,
    }));

    const projectsWithStages = await Promise.all(
      projectsWithManager.map(async (project) => {
        const stages = await this.getProjectStages(project.id);
        return { ...project, stages };
      })
    );
    return projectsWithStages;
  }

  async getProjectById(id: string): Promise<any | undefined> {
    const result = await db
      .select()
      .from(projects)
      .leftJoin(users, eq(projects.manager_id, users.id))
      .where(eq(projects.id, id));

    if (!result[0]) {
      return undefined;
    }

    const projectWithManager = {
      ...result[0].projects,
      manager_user: result[0].users ? {
        id: result[0].users.id,
        username: result[0].users.username,
        full_name: result[0].users.full_name,
        email: result[0].users.email,
      } : null,
    };

    const stages = await this.getProjectStages(id);
    return { ...projectWithManager, stages };
  }

  async getNextProjectNumber(): Promise<string> {
    // Generate continuous project number starting from 269
    // Get all projects
    const allProjects = await db.select({ project_number: projects.project_number }).from(projects);

    // Extract all numeric project numbers
    const allNumbers = allProjects
      .map(p => p.project_number)
      .filter(n => n && !isNaN(parseInt(n)))
      .map(n => parseInt(n!))
      .filter(n => !isNaN(n));

    // Find maximum number, ensure it's at least 268 so first number will be 269
    const maxNumber = allNumbers.length > 0
      ? Math.max(...allNumbers, 268)
      : 268;

    return String(maxNumber + 1);
  }

  async createProject(data: InsertProject): Promise<Project> {
    if (!data.project_number) {
      data.project_number = await this.getNextProjectNumber();
    }
    const result = await db.insert(projects).values(data).returning();
    return result[0];
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set({ ...data, updated_at: new Date().toISOString() })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    // Удаляем документы проекта (предотвращаем orphan records)
    await db.delete(documents).where(eq(documents.project_id, id));

    // Удаляем этапы проекта (которые удалят связанные зависимости и сообщения через CASCADE)
    await db.delete(project_stages).where(eq(project_stages.project_id, id));

    // Удаляем сам проект (items и messages удалятся через CASCADE)
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  }

  async getProjectsByStatus(status: string): Promise<Array<Project & { stages: ProjectStage[] }>> {
    const filteredProjects = await db.select().from(projects).where(eq(projects.status, status as any));
    const projectsWithStages = await Promise.all(
      filteredProjects.map(async (project) => {
        const stages = await this.getProjectStages(project.id);
        return { ...project, stages };
      })
    );
    return projectsWithStages;
  }

  async updateProjectProgress(projectId: string): Promise<Project | undefined> {
    const stages = await this.getProjectStages(projectId);
    
    if (stages.length === 0) {
      return this.updateProject(projectId, { progress: 0, duration_days: 0 });
    }
    
    const completedStages = stages.filter(stage => stage.status === "completed").length;
    const progress = Math.round((completedStages / stages.length) * 100);
    const durationDays = stages.reduce((sum, stage) => sum + (stage.duration_days || 0), 0);
    
    return this.updateProject(projectId, { progress, duration_days: durationDays });
  }

  // Project stage methods
  async getProjectStages(projectId: string): Promise<ProjectStage[]> {
    return await db.select()
      .from(project_stages)
      .where(eq(project_stages.project_id, projectId))
      .orderBy(asc(project_stages.order));
  }

  async getStageById(stageId: string): Promise<ProjectStage | null> {
    const result = await db.select()
      .from(project_stages)
      .where(eq(project_stages.id, stageId))
      .limit(1);
    return result[0] || null;
  }

  async getStagesByAssignee(assigneeId: string): Promise<Array<ProjectStage & { project: Project }>> {
    const stages = await db.select()
      .from(project_stages)
      .where(eq(project_stages.assignee_id, assigneeId))
      .orderBy(asc(project_stages.created_at));

    const stagesWithProjects = await Promise.all(
      stages.map(async (stage) => {
        const project = await this.getProjectById(stage.project_id);
        return { ...stage, project: project! };
      })
    );

    return stagesWithProjects.filter(s => s.project);
  }

  async getProjectsByAssignee(assigneeId: string): Promise<Array<any>> {
    // Получаем уникальные ID проектов с назначенными этапами
    const stages = await db.select({ project_id: project_stages.project_id })
      .from(project_stages)
      .where(eq(project_stages.assignee_id, assigneeId));

    const uniqueProjectIds = [...new Set(stages.map(s => s.project_id))];

    // Получаем полные данные проектов
    const projects = await Promise.all(
      uniqueProjectIds.map(id => this.getProjectById(id))
    );

    return projects.filter(p => p !== undefined);
  }

  async createProjectStage(data: InsertProjectStage): Promise<ProjectStage> {
    const result = await db.insert(project_stages).values(data).returning();
    await this.updateProjectProgress(data.project_id);
    return result[0];
  }

  async updateProjectStage(id: string, data: Partial<InsertProjectStage>): Promise<ProjectStage | undefined> {
    const result = await db.update(project_stages)
      .set({ ...data, updated_at: new Date().toISOString() })
      .where(eq(project_stages.id, id))
      .returning();

    if (result[0]) {
      await this.updateProjectProgress(result[0].project_id);
    }

    return result[0];
  }

  async deleteProjectStage(id: string): Promise<boolean> {
    const stage = await db.select().from(project_stages).where(eq(project_stages.id, id));
    
    if (stage.length === 0) {
      return false;
    }
    
    const projectId = stage[0].project_id;
    const result = await db.delete(project_stages).where(eq(project_stages.id, id)).returning();
    
    if (result.length > 0) {
      await this.updateProjectProgress(projectId);
    }
    
    return result.length > 0;
  }

  async startProject(id: string): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set({
        started_at: new Date().toISOString(),
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .where(eq(projects.id, id))
      .returning();

    if (result[0]) {
      const stages = await this.getProjectStages(id);
      const startDate = new Date(result[0].started_at!);

      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        const prevStages = stages.slice(0, i);
        const daysOffset = prevStages.reduce((sum, s) => sum + (s.duration_days || 0), 0);

        const plannedStart = new Date(startDate);
        plannedStart.setDate(plannedStart.getDate() + daysOffset);

        const plannedEnd = new Date(plannedStart);
        plannedEnd.setDate(plannedEnd.getDate() + (stage.duration_days || 0));

        await db.update(project_stages)
          .set({
            planned_start_date: plannedStart.toISOString(),
            planned_end_date: plannedEnd.toISOString(),
            updated_at: new Date().toISOString()
          })
          .where(eq(project_stages.id, stage.id));
      }
    }

    return result[0];
  }

  async pauseProject(id: string): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set({
        status: 'on_hold',
        updated_at: new Date().toISOString()
      })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async completeProject(id: string): Promise<Project | undefined> {
    const result = await db.update(projects)
      .set({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async startStage(id: string): Promise<ProjectStage | undefined> {
    // Проверка зависимостей перед запуском
    const dependencies = await db.select()
      .from(stage_dependencies)
      .where(eq(stage_dependencies.stage_id, id));

    // Проверяем, что все зависимые этапы завершены
    for (const dep of dependencies) {
      const [dependentStage] = await db.select()
        .from(project_stages)
        .where(eq(project_stages.id, dep.depends_on_stage_id));

      if (!dependentStage) {
        throw new Error(`Зависимый этап не найден`);
      }

      if (dependentStage.status !== 'completed') {
        throw new Error(
          `Невозможно запустить этап. Сначала завершите этап "${dependentStage.name}"`
        );
      }
    }

    // Если все проверки пройдены - запускаем этап
    const result = await db.update(project_stages)
      .set({
        actual_start_date: new Date().toISOString(),
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .where(eq(project_stages.id, id))
      .returning();
    return result[0];
  }

  async completeStage(id: string): Promise<ProjectStage | undefined> {
    const result = await db.update(project_stages)
      .set({
        actual_end_date: new Date().toISOString(),
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .where(eq(project_stages.id, id))
      .returning();
    
    if (result[0]) {
      await this.updateProjectProgress(result[0].project_id);
    }
    
    return result[0];
  }

  async getProjectTimeline(projectId: string): Promise<any> {
    const project = await this.getProjectById(projectId);
    if (!project) return null;

    const stages = await db.select().from(project_stages)
      .where(eq(project_stages.project_id, projectId))
      .orderBy(asc(project_stages.order));

    const timeline = stages.map(stage => {
      const delay = stage.actual_end_date && stage.planned_end_date 
        ? Math.ceil((new Date(stage.actual_end_date).getTime() - new Date(stage.planned_end_date).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      return {
        ...stage,
        delay_days: delay,
      };
    });

    const completedStages = stages.filter(s => s.status === 'completed');
    const inProgressStages = stages.filter(s => s.status === 'in_progress');
    const pendingStages = stages.filter(s => s.status === 'pending');

    const finalDeadline = stages.reduce((latest, stage) => {
      const endDate = stage.actual_end_date || stage.planned_end_date;
      if (!endDate) return latest;
      const date = new Date(endDate);
      return date > latest ? date : latest;
    }, new Date(0));

    return {
      project,
      stages: timeline,
      stats: {
        total: stages.length,
        completed: completedStages.length,
        in_progress: inProgressStages.length,
        pending: pendingStages.length,
        final_deadline: finalDeadline.getTime() > 0 ? finalDeadline : null,
      },
    };
  }

  async getProjectByDealId(dealId: string): Promise<Project | undefined> {
    const result = await db.select().from(projects).where(eq(projects.deal_id, dealId));
    return result[0];
  }

  async createProjectFromInvoice(
    dealId: string, 
    invoiceId: string, 
    deal: any, 
    invoice: any, 
    selectedPositionIndices?: number[],
    editedPositions?: any[],
    positionStagesData?: Record<string, { 
      stages: { id: string; name: string; order_index: number }[]; 
      dependencies: { stage_id: string; depends_on_stage_id: string }[] 
    }>
  ): Promise<Project> {
    // Используем номер заказа сделки как номер проекта
    const projectNumber = deal.order_number || undefined;

    const projectData: InsertProject = {
      name: `Проект №${deal.order_number || invoice.name}`,
      project_number: projectNumber,
      client_name: deal.client_name,
      deal_id: dealId,
      invoice_id: invoiceId,
      duration_days: 0,
      manager_id: deal.manager_id,
      status: "pending",
      progress: 0,
    };

    const project = await this.createProject(projectData);

    console.log("=== CREATE PROJECT FROM INVOICE ===");
    console.log("positionStagesData received:", JSON.stringify(positionStagesData, null, 2));
    console.log("positionStagesData keys:", positionStagesData ? Object.keys(positionStagesData) : "undefined");
    console.log("selectedPositionIndices:", selectedPositionIndices);
    console.log("editedPositions length:", editedPositions?.length);

    // Если переданы отредактированные позиции, используем их
    if (editedPositions && editedPositions.length > 0 && selectedPositionIndices && selectedPositionIndices.length > 0) {
      const positionsToAdd = selectedPositionIndices.map(index => editedPositions[index]).filter(p => p);
      
      const itemsData: InsertProjectItem[] = positionsToAdd.map((position: any, index: number) => ({
        project_id: project.id,
        name: position.name,
        article: position.article || undefined,
        quantity: position.quantity || 1,
        price: position.price,
        source_document_id: invoiceId,
        order: index,
        image_url: position.imageUrl || undefined,
      }));

      if (itemsData.length > 0) {
        const createdItems = await db.insert(project_items).values(itemsData).returning();

        // Создать этапы и зависимости для каждой позиции, если они есть
        if (positionStagesData && selectedPositionIndices) {
          console.log("=== CREATING STAGES FOR POSITIONS (editedPositions branch) ===");
          for (let i = 0; i < selectedPositionIndices.length; i++) {
            const positionIndex = selectedPositionIndices[i];
            const itemId = createdItems[i]?.id;
            console.log(`Position ${i}: positionIndex=${positionIndex}, itemId=${itemId}`);
            console.log(`Looking for key: "${positionIndex.toString()}"`);
            const stagesData = positionStagesData[positionIndex.toString()];
            console.log(`stagesData for position ${positionIndex}:`, stagesData ? `${stagesData.stages?.length || 0} stages` : "undefined");

            if (itemId && stagesData?.stages && stagesData.stages.length > 0) {
              console.log(`Creating ${stagesData.stages.length} stages for item ${itemId}`);
              await this.createStagesWithDependencies(
                project.id,
                itemId,
                stagesData.stages,
                stagesData.dependencies
              );
            } else {
              console.log(`Skipping: itemId=${itemId}, hasStagesData=${!!stagesData}, stagesCount=${stagesData?.stages?.length || 0}`);
            }
          }
        } else {
          console.log("Skipping stage creation: positionStagesData or selectedPositionIndices missing");
        }
      }
    }
    // Иначе используем оригинальные позиции из счета
    else if (invoice.data?.positions && Array.isArray(invoice.data.positions)) {
      let positionsToAdd = invoice.data.positions;
      
      // Если указаны индексы позиций, фильтруем только выбранные
      if (selectedPositionIndices && selectedPositionIndices.length > 0) {
        positionsToAdd = invoice.data.positions.filter((_: any, index: number) => 
          selectedPositionIndices.includes(index)
        );
      }

      const itemsData: InsertProjectItem[] = positionsToAdd.map((position: any, index: number) => ({
        project_id: project.id,
        name: position.name,
        article: position.article || undefined,
        quantity: position.quantity || 1,
        price: position.price,
        source_document_id: invoiceId,
        order: index,
        image_url: position.imageUrl || undefined,
      }));

      if (itemsData.length > 0) {
        const createdItems = await db.insert(project_items).values(itemsData).returning();
        
        // Создать этапы и зависимости для каждой позиции, если они есть
        if (positionStagesData && selectedPositionIndices) {
          for (let i = 0; i < selectedPositionIndices.length; i++) {
            const positionIndex = selectedPositionIndices[i];
            const itemId = createdItems[i]?.id;
            const stagesData = positionStagesData[positionIndex.toString()];
            
            if (itemId && stagesData?.stages && stagesData.stages.length > 0) {
              await this.createStagesWithDependencies(
                project.id, 
                itemId, 
                stagesData.stages, 
                stagesData.dependencies
              );
            }
          }
        }
      }
    }

    return project;
  }

  private async createStagesWithDependencies(
    projectId: string,
    itemId: string,
    stages: {
      id: string;
      name: string;
      order_index: number;
      duration_days?: number;
      assignee_id?: string;
      cost?: number;
      description?: string;
      stage_type_id?: string;
      template_data?: any;
    }[],
    dependencies: { stage_id: string; depends_on_stage_id: string }[]
  ): Promise<void> {
    // Карта для сопоставления временных ID с реальными ID этапов
    const stageIdMap = new Map<string, string>();

    // Создать все этапы
    for (const stage of stages) {
      const newStage = await this.createProjectStage({
        project_id: projectId,
        item_id: itemId,
        name: stage.name,
        status: "pending",
        order: stage.order_index,
        duration_days: stage.duration_days,
        assignee_id: stage.assignee_id,
        cost: stage.cost,
        description: stage.description,
        stage_type_id: stage.stage_type_id,
        type_data: stage.template_data ? JSON.stringify(stage.template_data) : undefined,
      });

      stageIdMap.set(stage.id, newStage.id);
    }
    
    // Создать зависимости между этапами
    if (dependencies && dependencies.length > 0) {
      for (const dep of dependencies) {
        const realStageId = stageIdMap.get(dep.stage_id);
        const realDependsOnStageId = stageIdMap.get(dep.depends_on_stage_id);
        
        if (realStageId && realDependsOnStageId) {
          await this.createStageDependency({
            stage_id: realStageId,
            depends_on_stage_id: realDependsOnStageId,
          });
        }
      }
    }
  }

  // Project Items methods
  async getProjectItems(projectId: string): Promise<ProjectItem[]> {
    return await db.select()
      .from(project_items)
      .where(eq(project_items.project_id, projectId))
      .orderBy(asc(project_items.order));
  }

  async getProjectItemById(itemId: string): Promise<ProjectItem | undefined> {
    const result = await db.select().from(project_items).where(eq(project_items.id, itemId));
    return result[0];
  }

  async createProjectItem(data: InsertProjectItem): Promise<ProjectItem> {
    const result = await db.insert(project_items).values(data).returning();
    return result[0];
  }

  async updateProjectItem(itemId: string, data: Partial<InsertProjectItem>): Promise<ProjectItem | undefined> {
    // Filter out undefined values - SQLite can't handle them
    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined)
    );

    const result = await db.update(project_items)
      .set({ ...cleanData, updated_at: new Date().toISOString() })
      .where(eq(project_items.id, itemId))
      .returning();
    return result[0];
  }

  async deleteProjectItem(itemId: string): Promise<boolean> {
    await db.delete(project_stages).where(eq(project_stages.item_id, itemId));
    const result = await db.delete(project_items).where(eq(project_items.id, itemId)).returning();
    return result.length > 0;
  }

  async getItemStages(itemId: string): Promise<ProjectStage[]> {
    return await db.select()
      .from(project_stages)
      .where(eq(project_stages.item_id, itemId))
      .orderBy(asc(project_stages.order));
  }

  // Stage Dependencies methods
  async getProjectDependencies(projectId: string): Promise<StageDependency[]> {
    const stages = await this.getProjectStages(projectId);
    const stageIds = stages.map(s => s.id);
    
    if (stageIds.length === 0) {
      return [];
    }

    const dependencies: StageDependency[] = [];
    for (const stageId of stageIds) {
      const deps = await db.select()
        .from(stage_dependencies)
        .where(eq(stage_dependencies.stage_id, stageId));
      dependencies.push(...deps);
    }
    
    return dependencies;
  }

  async createStageDependency(data: InsertStageDependency): Promise<StageDependency> {
    const result = await db.insert(stage_dependencies).values(data).returning();
    return result[0];
  }

  async deleteStageDependency(dependencyId: string): Promise<boolean> {
    const result = await db.delete(stage_dependencies)
      .where(eq(stage_dependencies.id, dependencyId))
      .returning();
    return result.length > 0;
  }

  async getStageDependencies(stageId: string): Promise<StageDependency[]> {
    return await db.select()
      .from(stage_dependencies)
      .where(eq(stage_dependencies.stage_id, stageId));
  }

  async checkStageBlockers(stageId: string): Promise<{
    isBlocked: boolean;
    blockers: Array<{ id: string; name: string; status: string }>;
  }> {
    const dependencies = await this.getStageDependencies(stageId);

    if (dependencies.length === 0) {
      return { isBlocked: false, blockers: [] };
    }

    const blockers = [];
    for (const dep of dependencies) {
      const [dependentStage] = await db.select()
        .from(project_stages)
        .where(eq(project_stages.id, dep.depends_on_stage_id));

      if (dependentStage && dependentStage.status !== 'completed') {
        blockers.push({
          id: dependentStage.id,
          name: dependentStage.name,
          status: dependentStage.status,
        });
      }
    }

    return {
      isBlocked: blockers.length > 0,
      blockers,
    };
  }

  // Process Templates methods
  async getAllTemplates(): Promise<ProcessTemplate[]> {
    return await db.select().from(process_templates).orderBy(asc(process_templates.created_at));
  }

  async getTemplateById(templateId: string): Promise<ProcessTemplate | undefined> {
    const result = await db.select().from(process_templates).where(eq(process_templates.id, templateId));
    return result[0];
  }

  async createTemplate(data: InsertProcessTemplate): Promise<ProcessTemplate> {
    const result = await db.insert(process_templates).values(data).returning();
    return result[0];
  }

  async updateTemplate(templateId: string, data: Partial<InsertProcessTemplate>): Promise<ProcessTemplate | undefined> {
    const result = await db.update(process_templates)
      .set({ ...data, updated_at: new Date() })
      .where(eq(process_templates.id, templateId))
      .returning();
    return result[0];
  }

  async deleteTemplate(templateId: string): Promise<boolean> {
    const result = await db.delete(process_templates)
      .where(eq(process_templates.id, templateId))
      .returning();
    return result.length > 0;
  }

  // Template Stages methods
  async getTemplateStages(templateId: string): Promise<TemplateStage[]> {
    return await db.select()
      .from(template_stages)
      .where(eq(template_stages.template_id, templateId))
      .orderBy(asc(template_stages.order));
  }

  async createTemplateStage(data: InsertTemplateStage): Promise<TemplateStage> {
    const result = await db.insert(template_stages).values(data).returning();
    return result[0];
  }

  async updateTemplateStage(stageId: string, data: Partial<InsertTemplateStage>): Promise<TemplateStage | undefined> {
    const result = await db.update(template_stages)
      .set({ ...data, updated_at: new Date() })
      .where(eq(template_stages.id, stageId))
      .returning();
    return result[0];
  }

  async deleteTemplateStage(stageId: string): Promise<boolean> {
    const result = await db.delete(template_stages)
      .where(eq(template_stages.id, stageId))
      .returning();
    return result.length > 0;
  }

  // Template Dependencies methods
  async getTemplateDependencies(templateId: string): Promise<TemplateDependency[]> {
    const stages = await this.getTemplateStages(templateId);
    const stageIds = stages.map(s => s.id);
    
    if (stageIds.length === 0) {
      return [];
    }

    const dependencies: TemplateDependency[] = [];
    for (const stageId of stageIds) {
      const deps = await db.select()
        .from(template_dependencies)
        .where(eq(template_dependencies.template_stage_id, stageId));
      dependencies.push(...deps);
    }
    
    return dependencies;
  }

  async createTemplateDependency(data: InsertTemplateDependency): Promise<TemplateDependency> {
    const result = await db.insert(template_dependencies).values(data).returning();
    return result[0];
  }

  async deleteTemplateDependency(dependencyId: string): Promise<boolean> {
    const result = await db.delete(template_dependencies)
      .where(eq(template_dependencies.id, dependencyId))
      .returning();
    return result.length > 0;
  }

  // Apply Template to Item
  async applyTemplateToItem(templateId: string, itemId: string): Promise<{ stages: ProjectStage[], dependencies: StageDependency[] }> {
    const item = await this.getProjectItemById(itemId);
    if (!item) {
      throw new Error("Project item not found");
    }

    const templateStages = await this.getTemplateStages(templateId);
    const templateDeps = await this.getTemplateDependencies(templateId);

    const stageIdMap = new Map<string, string>();
    const createdStages: ProjectStage[] = [];

    for (const templateStage of templateStages) {
      const newStage = await this.createProjectStage({
        project_id: item.project_id,
        item_id: itemId,
        name: templateStage.name,
        description: templateStage.description || undefined,
        cost: templateStage.cost || undefined,
        status: "pending",
        order: templateStage.order,
        stage_type_id: templateStage.stage_type_id || undefined,
        duration_days: templateStage.duration_days || undefined,
        assignee_id: templateStage.assignee_id || undefined,
        type_data: templateStage.template_data || undefined,
      });
      stageIdMap.set(templateStage.id, newStage.id);
      createdStages.push(newStage);
    }

    const createdDependencies: StageDependency[] = [];

    for (const templateDep of templateDeps) {
      const newStageId = stageIdMap.get(templateDep.template_stage_id);
      const dependsOnStageId = stageIdMap.get(templateDep.depends_on_template_stage_id);

      if (newStageId && dependsOnStageId) {
        const newDep = await this.createStageDependency({
          stage_id: newStageId,
          depends_on_stage_id: dependsOnStageId,
        });
        createdDependencies.push(newDep);
      }
    }

    return { stages: createdStages, dependencies: createdDependencies };
  }

  // Stage Messages methods
  async getStageMessages(stageId: string) {
    return await db.select({
      id: stage_messages.id,
      stage_id: stage_messages.stage_id,
      user_id: stage_messages.user_id,
      message: stage_messages.message,
      created_at: stage_messages.created_at,
      user_name: users.username,
    })
      .from(stage_messages)
      .leftJoin(users, eq(stage_messages.user_id, users.id))
      .where(eq(stage_messages.stage_id, stageId))
      .orderBy(asc(stage_messages.created_at));
  }

  async createStageMessage(data: InsertStageMessage): Promise<StageMessage> {
    const result = await db.insert(stage_messages).values(data).returning();
    return result[0];
  }

  // Stage Documents methods
  async getStageDocuments(stageId: string): Promise<Document[]> {
    return await db.select()
      .from(documents)
      .where(eq(documents.project_stage_id, stageId))
      .orderBy(asc(documents.created_at));
  }

  async createStageDocument(data: InsertStageDocument): Promise<StageDocument> {
    const result = await db.insert(stage_documents).values(data).returning();
    return result[0];
  }


  async getProjectDocuments(projectId: string) {
    const stages = await this.getProjectStages(projectId);
    const stageIds = stages.map(s => s.id);

    if (stageIds.length === 0) return [];

    const allDocs = [];

    // Получаем документы из таблицы documents
    for (const stageId of stageIds) {
      const docs = await db.select({
        id: documents.id,
        name: documents.name,
        type: documents.type,
        file_path: documents.file_path,
        size: documents.size,
        project_stage_id: documents.project_stage_id,
        uploaded_by: documents.uploaded_by,
        created_at: documents.created_at,
        stage_name: project_stages.name,
        user_name: users.username,
      })
        .from(documents)
        .leftJoin(project_stages, eq(documents.project_stage_id, project_stages.id))
        .leftJoin(users, eq(documents.uploaded_by, users.id))
        .where(eq(documents.project_stage_id, stageId))
        .orderBy(asc(documents.created_at));
      allDocs.push(...docs);
    }

    return allDocs;
  }

  /**
   * Получает все документы проекта с группировкой по этапам и подсветкой недавних
   */
  async getProjectDocumentsGrouped(projectId: string, userId?: string) {
    const project = await this.getProjectById(projectId);

    // Проверяем право на просмотр финансовых документов
    let canViewFinancial = false;
    if (userId) {
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (user) {
        // Admin всегда видит всё
        canViewFinancial = user.username.toLowerCase() === 'admin' || user.can_view_financial === true;
      }
    }
    const stages = await this.getProjectStages(projectId);

    // Получаем все позиции проекта для связи item_id -> item_name
    const items = await db.select()
      .from(project_items)
      .where(eq(project_items.project_id, projectId));

    const itemsMap = new Map(items.map(item => [item.id, item.name]));

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDocIds: string[] = [];

    // Группируем документы по этапам
    const stagesWithDocs = await Promise.all(stages.map(async (stage) => {
      // Получаем обычные документы
      const docs = await db.select({
        id: documents.id,
        name: documents.name,
        type: documents.type,
        file_path: documents.file_path,
        size: documents.size,
        uploaded_by: documents.uploaded_by,
        created_at: documents.created_at,
        user_name: users.username,
        user_full_name: users.full_name,
      })
        .from(documents)
        .leftJoin(users, eq(documents.uploaded_by, users.id))
        .where(eq(documents.project_stage_id, stage.id))
        .orderBy(asc(documents.created_at));

      // Получаем медиа-файлы этапа (фото, видео, аудио)
      const mediaFiles = await db.select({
        id: stage_documents.id,
        name: stage_documents.file_name,
        type: stage_documents.document_type,
        file_path: stage_documents.file_url,
        size: stage_documents.file_size,
        uploaded_by: stage_documents.uploaded_by,
        created_at: stage_documents.created_at,
        user_name: users.username,
        user_full_name: users.full_name,
      })
        .from(stage_documents)
        .leftJoin(users, eq(stage_documents.uploaded_by, users.id))
        .where(eq(stage_documents.stage_id, stage.id))
        .orderBy(asc(stage_documents.created_at));

      // Получаем attachments из задач этого этапа
      // Задачи могут быть привязаны либо к этапу напрямую (project_stage_id)
      // либо к позиции (project_item_id), если этап связан с позицией через item_id
      let taskAttachments = [];

      // Сначала получаем задачи привязанные к этапу напрямую
      const stageTaskAttachments = await db.select({
        id: task_attachments.id,
        name: task_attachments.file_name,
        type: task_attachments.mime_type,
        file_path: task_attachments.file_path,
        size: task_attachments.file_size,
        uploaded_by: task_attachments.uploaded_by,
        created_at: task_attachments.created_at,
        user_name: users.username,
        user_full_name: users.full_name,
      })
        .from(task_attachments)
        .leftJoin(tasks, eq(task_attachments.task_id, tasks.id))
        .leftJoin(users, eq(task_attachments.uploaded_by, users.id))
        .where(eq(tasks.project_stage_id, stage.id))
        .orderBy(asc(task_attachments.created_at));

      taskAttachments = [...stageTaskAttachments];

      // Если у этапа есть item_id, получаем также задачи привязанные к позиции
      if (stage.item_id) {
        const itemTaskAttachments = await db.select({
          id: task_attachments.id,
          name: task_attachments.file_name,
          type: task_attachments.mime_type,
          file_path: task_attachments.file_path,
          size: task_attachments.file_size,
          uploaded_by: task_attachments.uploaded_by,
          created_at: task_attachments.created_at,
          user_name: users.username,
          user_full_name: users.full_name,
        })
          .from(task_attachments)
          .leftJoin(tasks, eq(task_attachments.task_id, tasks.id))
          .leftJoin(users, eq(task_attachments.uploaded_by, users.id))
          .where(eq(tasks.project_item_id, stage.item_id))
          .orderBy(asc(task_attachments.created_at));

        // Объединяем результаты, исключая дубликаты
        const existingIds = new Set(taskAttachments.map(t => t.id));
        itemTaskAttachments.forEach(attachment => {
          if (!existingIds.has(attachment.id)) {
            taskAttachments.push(attachment);
          }
        });
      }

      // Объединяем все файлы
      const allFiles = [
        ...docs.map(d => ({ ...d, source: 'document' as const, thumbnail_url: null as string | null })),
        ...mediaFiles.map(m => ({ ...m, source: 'media' as const, thumbnail_url: null as string | null })),
        ...taskAttachments.map(t => ({ ...t, source: 'task' as const, thumbnail_url: null as string | null }))
      ];

      // Находим недавно загруженные
      allFiles.forEach(file => {
        if (file.created_at && new Date(file.created_at) > twentyFourHoursAgo) {
          recentDocIds.push(file.id);
        }
      });

      return {
        stage_id: stage.id,
        stage_name: stage.name,
        stage_type: stage.stage_type_id,
        stage_status: stage.status,
        item_id: stage.item_id || null,
        item_name: stage.item_id ? itemsMap.get(stage.item_id) || null : null,
        documents: allFiles,
        document_count: allFiles.length,
      };
    }));

    // Фильтруем только этапы с документами
    const stagesWithDocuments = stagesWithDocs.filter(s => s.document_count > 0);

    // Получаем документы задач, привязанных к позициям без этапов
    const projectItems = await db.select()
      .from(project_items)
      .where(eq(project_items.project_id, projectId));

    console.log('[Documents] Found project items:', projectItems.length);

    for (const item of projectItems) {
      // Проверяем, есть ли у позиции этапы
      const itemStagesCount = await db.select({ count: sql<number>`count(*)` })
        .from(project_stages)
        .where(eq(project_stages.item_id, item.id));

      const stageCount = Number(itemStagesCount[0]?.count || 0);
      console.log(`[Documents] Item ${item.id} has ${stageCount} stages (raw: ${JSON.stringify(itemStagesCount)})`);
      console.log(`[Documents] stageCount type: ${typeof stageCount}, value: ${stageCount}, is zero: ${stageCount === 0}`);

      // Если у позиции нет этапов, ищем задачи привязанные напрямую к позиции
      if (stageCount === 0) {
        console.log(`[Documents] Processing item ${item.id} without stages`);
        try {
          // Сначала получаем задачи позиции
          const itemTasks = await db.select({ id: tasks.id })
            .from(tasks)
            .where(eq(tasks.project_item_id, item.id));

          console.log(`[Documents] Found ${itemTasks.length} tasks for item ${item.id}`);

          if (itemTasks.length > 0) {
            // Теперь получаем вложения для этих задач
            const taskIds = itemTasks.map(t => t.id);
            const itemTaskAttachments = await db.select({
              id: task_attachments.id,
              name: task_attachments.file_name,
              type: task_attachments.mime_type,
              file_path: task_attachments.file_path,
              size: task_attachments.file_size,
              uploaded_by: task_attachments.uploaded_by,
              created_at: task_attachments.created_at,
              user_name: users.username,
              user_full_name: users.full_name,
            })
              .from(task_attachments)
              .leftJoin(users, eq(task_attachments.uploaded_by, users.id))
              .where(sql`${task_attachments.task_id} IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})`)
              .orderBy(asc(task_attachments.created_at));

            console.log(`[Documents] Item ${item.id} has ${itemTaskAttachments.length} task attachments`);

            if (itemTaskAttachments.length > 0) {
              // Преобразуем в формат документов
              const taskFiles = itemTaskAttachments.map(t => ({
                ...t,
                source: 'task' as const,
                thumbnail_url: null
              }));

              // Проверяем недавно загруженные
              taskFiles.forEach(file => {
                if (file.created_at && new Date(file.created_at) > twentyFourHoursAgo) {
                  recentDocIds.push(file.id);
                }
              });

              // Создаем виртуальный этап для позиции
              stagesWithDocuments.push({
                stage_id: `item-${item.id}`,
                stage_name: `Документы позиции: ${item.name}`,
                stage_type: 'item',
                stage_status: 'active',
                item_id: item.id,
                item_name: item.name,
                documents: taskFiles,
                document_count: taskFiles.length,
              });
            }
          }
        } catch (error) {
          console.error(`[Documents] Error fetching attachments for item ${item.id}:`, error);
        }
      }
    }

    // Получаем документы из задач, привязанных напрямую к проекту (без этапов и позиций)
    try {
      const projectDirectTasks = await db.select({ id: tasks.id })
        .from(tasks)
        .where(and(
          eq(tasks.project_id, projectId),
          sql`${tasks.project_stage_id} IS NULL`,
          sql`${tasks.project_item_id} IS NULL`
        ));

      console.log(`[Documents] Found ${projectDirectTasks.length} direct project tasks for project ${projectId}`);

      if (projectDirectTasks.length > 0) {
        const taskIds = projectDirectTasks.map(t => t.id);
        const projectTaskAttachments = await db.select({
          id: task_attachments.id,
          name: task_attachments.file_name,
          type: task_attachments.mime_type,
          file_path: task_attachments.file_path,
          size: task_attachments.file_size,
          uploaded_by: task_attachments.uploaded_by,
          created_at: task_attachments.created_at,
          user_name: users.username,
          user_full_name: users.full_name,
        })
          .from(task_attachments)
          .leftJoin(users, eq(task_attachments.uploaded_by, users.id))
          .where(sql`${task_attachments.task_id} IN (${sql.join(taskIds.map(id => sql`${id}`), sql`, `)})`)
          .orderBy(asc(task_attachments.created_at));

        console.log(`[Documents] Found ${projectTaskAttachments.length} attachments from direct project tasks`);

        if (projectTaskAttachments.length > 0) {
          const taskFiles = projectTaskAttachments.map(t => ({
            ...t,
            source: 'task' as const,
            thumbnail_url: null
          }));

          // Проверяем недавно загруженные
          taskFiles.forEach(file => {
            if (file.created_at && new Date(file.created_at) > twentyFourHoursAgo) {
              recentDocIds.push(file.id);
            }
          });

          // Добавляем виртуальный этап для документов задач проекта
          stagesWithDocuments.push({
            stage_id: `project-tasks-${projectId}`,
            stage_name: 'Документы задач проекта',
            stage_type: 'project-tasks',
            stage_status: 'active',
            item_id: null,
            item_name: null,
            documents: taskFiles,
            document_count: taskFiles.length,
          });
        }
      }
    } catch (error) {
      console.error(`[Documents] Error fetching direct project task attachments:`, error);
    }

    // Получаем документы сделки, если проект связан со сделкой
    let dealDocumentsStage = null;
    let financialDocumentsStage = null;  // Отдельный stage для фин документов
    let attachmentStages: any[] = [];  // Массив для stages вложений по позициям

    if (project?.deal_id) {
      // Получаем документы сделки (КП, договоры, счета)
      const dealDocs = await salesRepository.getDealDocuments(project.deal_id);

      if (dealDocs.length > 0) {
        // Разделяем на финансовые и обычные документы на основе флага is_financial из БД
        const financialDocs = dealDocs.filter(doc => doc.is_financial === true || doc.is_financial === 1);
        const regularDocs = dealDocs.filter(doc => doc.is_financial !== true && doc.is_financial !== 1);

        // Финансовые документы - в отдельный stage (только если есть права)
        if (financialDocs.length > 0 && canViewFinancial) {
          const financialFiles = financialDocs.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: 'document' as const,
            file_path: doc.file_url,
            size: null,
            uploaded_by: null,
            created_at: doc.created_at,
            user_name: null,
            user_full_name: null,
            source: 'deal' as const,
            deal_document_type: doc.document_type,
            thumbnail_url: null,
            is_financial: doc.is_financial === true || doc.is_financial === 1,
          }));

          // Проверяем недавно загруженные
          financialFiles.forEach(file => {
            if (file.created_at && new Date(file.created_at) > twentyFourHoursAgo) {
              recentDocIds.push(file.id);
            }
          });

          financialDocumentsStage = {
            stage_id: 'financial-documents',
            stage_name: 'Фин документы',
            stage_type: 'financial',
            stage_status: 'active',
            item_id: null,
            item_name: null,
            documents: financialFiles,
            document_count: financialFiles.length,
            is_restricted: true,  // Флаг для UI - показывает что доступ ограничен
          };
        }

        // Обычные документы сделки
        if (regularDocs.length > 0) {
          const dealFiles = regularDocs.map(doc => ({
            id: doc.id,
            name: doc.name,
            type: 'document' as const,
            file_path: doc.file_url,
            size: null,
            uploaded_by: null,
            created_at: doc.created_at,
            user_name: null,
            user_full_name: null,
            source: 'deal' as const,
            deal_document_type: doc.document_type,
            thumbnail_url: null,
            is_financial: doc.is_financial === true || doc.is_financial === 1,
          }));

          dealFiles.forEach(file => {
            if (file.created_at && new Date(file.created_at) > twentyFourHoursAgo) {
              recentDocIds.push(file.id);
            }
          });

          dealDocumentsStage = {
            stage_id: 'deal-documents',
            stage_name: 'Документы сделки',
            stage_type: 'deal',
            stage_status: 'active',
            item_id: null,
            item_name: null,
            documents: dealFiles,
            document_count: dealFiles.length,
          };
        }
      }

      // Получаем вложения сделки (загруженные файлы)
      const dealAttachments = await salesRepository.getDealAttachments(project.deal_id);
      console.log(`[Documents] Found ${dealAttachments.length} deal attachments for deal ${project.deal_id}`);

      if (dealAttachments.length > 0) {
        // Получаем позиции проекта для названий
        const projectItems = await this.getProjectItems(projectId);
        const itemsMap = new Map(projectItems.map(item => [item.id, item.name]));

        // Разделяем на финансовые и обычные вложения
        const financialAttachments = dealAttachments.filter(att => att.is_financial === true);
        const regularAttachments = dealAttachments.filter(att => att.is_financial !== true);

        // Финансовые вложения добавляем к financialDocumentsStage (только если есть права)
        if (financialAttachments.length > 0 && canViewFinancial) {
          const financialFiles = financialAttachments.map(att => ({
            id: att.id,
            name: att.file_name,
            type: att.mime_type || 'document',
            file_path: att.file_path,
            size: att.file_size,
            uploaded_by: att.uploaded_by,
            created_at: att.created_at,
            user_name: null,
            user_full_name: null,
            source: 'deal' as const,
            deal_document_type: 'attachment',
            thumbnail_url: null,
            is_financial: true,
          }));

          financialFiles.forEach(file => {
            if (file.created_at && new Date(file.created_at) > twentyFourHoursAgo) {
              recentDocIds.push(file.id);
            }
          });

          // Добавляем к существующему financialDocumentsStage или создаём новый
          if (financialDocumentsStage) {
            financialDocumentsStage.documents.push(...financialFiles);
            financialDocumentsStage.document_count += financialFiles.length;
          } else {
            financialDocumentsStage = {
              stage_id: 'financial-documents',
              stage_name: 'Фин документы',
              stage_type: 'financial',
              stage_status: 'active',
              item_id: null,
              item_name: null,
              documents: financialFiles,
              document_count: financialFiles.length,
              is_restricted: true,
            };
          }
        }

        // Группируем обычные вложения по item_id
        const attachmentsByItem = new Map<string | null, typeof regularAttachments>();
        for (const att of regularAttachments) {
          const key = att.item_id || null;
          if (!attachmentsByItem.has(key)) {
            attachmentsByItem.set(key, []);
          }
          attachmentsByItem.get(key)!.push(att);
        }

        // Создаём stages для каждой группы (присваиваем внешней переменной)
        for (const [itemId, atts] of attachmentsByItem.entries()) {
          const attachmentFiles = atts.map(att => ({
            id: att.id,
            name: att.file_name,
            type: att.mime_type || 'document',
            file_path: att.file_path,
            size: att.file_size,
            uploaded_by: att.uploaded_by,
            created_at: att.created_at,
            user_name: null,
            user_full_name: null,
            source: 'deal' as const,
            deal_document_type: 'attachment',
            thumbnail_url: null,
            is_financial: false,
          }));

          // Проверяем недавно загруженные вложения
          attachmentFiles.forEach(file => {
            if (file.created_at && new Date(file.created_at) > twentyFourHoursAgo) {
              recentDocIds.push(file.id);
            }
          });

          const itemName = itemId ? itemsMap.get(itemId) || null : null;
          const stageName = itemName ? `${itemName} / Загруженные файлы` : 'Загруженные файлы';

          attachmentStages.push({
            stage_id: itemId ? `deal-attachments-${itemId}` : 'deal-attachments',
            stage_name: stageName,
            stage_type: 'deal-attachments',
            stage_status: 'active',
            item_id: itemId,
            item_name: itemName,
            documents: attachmentFiles,
            document_count: attachmentFiles.length,
          });
        }

        // Сортируем: сначала stages с позицией, потом общие
        if (attachmentStages.length > 1) {
          attachmentStages.sort((a, b) => {
            if (a.item_id === null && b.item_id !== null) return 1;
            if (a.item_id !== null && b.item_id === null) return -1;
            return 0;
          });
        }
      }
    }

    // Объединяем: фин документы (первыми), загруженные файлы, документы сделки, документы этапов
    const allStages = [
      ...(financialDocumentsStage ? [financialDocumentsStage] : []),  // Фин документы первыми (если есть права)
      ...attachmentStages,  // Все stages с вложениями (сгруппированные по item_id)
      ...(dealDocumentsStage ? [dealDocumentsStage] : []),
      ...stagesWithDocuments
    ];

    return {
      stages: allStages,
      recentDocuments: recentDocIds,
      totalDocuments: allStages.reduce((sum, s) => sum + s.document_count, 0),
    };
  }

  // Project Messages methods
  async getProjectMessages(projectId: string) {
    return await db.select({
      id: project_messages.id,
      project_id: project_messages.project_id,
      user_id: project_messages.user_id,
      message: project_messages.message,
      created_at: project_messages.created_at,
      user_name: users.username,
    })
      .from(project_messages)
      .leftJoin(users, eq(project_messages.user_id, users.id))
      .where(eq(project_messages.project_id, projectId))
      .orderBy(asc(project_messages.created_at));
  }

  async createProjectMessage(data: InsertProjectMessage): Promise<ProjectMessage> {
    const result = await db.insert(project_messages).values(data).returning();
    return result[0];
  }

  // Reorder item stages atomically
  async reorderItemStages(itemId: string, stageIds: string[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (let i = 0; i < stageIds.length; i++) {
        await tx.update(project_stages)
          .set({ order: i })
          .where(eq(project_stages.id, stageIds[i]));
      }
    });
  }

  // ===== Deadline Management Methods =====

  /**
   * Сохраняет изменение срока этапа в историю
   */
  async recordDeadlineChange(data: InsertStageDeadlineHistory): Promise<StageDeadlineHistory> {
    const result = await db.insert(stage_deadline_history).values(data).returning();
    return result[0];
  }

  /**
   * Получает историю изменений сроков этапа
   */
  async getStageDeadlineHistory(stageId: string): Promise<StageDeadlineHistory[]> {
    return await db.select()
      .from(stage_deadline_history)
      .where(eq(stage_deadline_history.stage_id, stageId))
      .orderBy(asc(stage_deadline_history.created_at));
  }

  /**
   * Рассчитывает финальный срок проекта с учетом параллельных работ
   */
  async calculateProjectFinalDeadline(projectId: string): Promise<Date | null> {
    const stages = await this.getProjectStages(projectId);
    const dependencies = await this.getProjectDependencies(projectId);

    if (stages.length === 0) {
      return null;
    }

    // Строим граф зависимостей для расчета критического пути
    const stageEndDates = new Map<string, Date>();

    // Рекурсивная функция для расчета даты окончания этапа
    const calculateStageEnd = (stageId: string, visited = new Set<string>()): Date | null => {
      if (visited.has(stageId)) {
        // Циклическая зависимость - пропускаем
        return null;
      }
      visited.add(stageId);

      if (stageEndDates.has(stageId)) {
        return stageEndDates.get(stageId)!;
      }

      const stage = stages.find(s => s.id === stageId);
      if (!stage) return null;

      // Находим зависимости этого этапа
      const stageDeps = dependencies.filter(d => d.stage_id === stageId);

      if (stageDeps.length === 0) {
        // Нет зависимостей - используем planned_end_date или рассчитываем от начала проекта
        const endDate = stage.planned_end_date ? new Date(stage.planned_end_date) : null;
        if (endDate) {
          stageEndDates.set(stageId, endDate);
        }
        return endDate;
      }

      // Находим максимальную дату окончания среди зависимых этапов
      let maxDependencyEnd: Date | null = null;

      for (const dep of stageDeps) {
        const depEndDate = calculateStageEnd(dep.depends_on_stage_id, new Set(visited));
        if (depEndDate && (!maxDependencyEnd || depEndDate > maxDependencyEnd)) {
          maxDependencyEnd = depEndDate;
        }
      }

      if (maxDependencyEnd && stage.duration_days) {
        // Добавляем длительность текущего этапа к максимальной дате зависимостей
        const endDate = new Date(maxDependencyEnd);
        endDate.setDate(endDate.getDate() + stage.duration_days);
        stageEndDates.set(stageId, endDate);
        return endDate;
      } else if (stage.planned_end_date) {
        const endDate = new Date(stage.planned_end_date);
        stageEndDates.set(stageId, endDate);
        return endDate;
      }

      return null;
    };

    // Рассчитываем даты окончания для всех этапов
    for (const stage of stages) {
      calculateStageEnd(stage.id);
    }

    // Находим максимальную дату среди всех этапов
    let maxEndDate: Date | null = null;
    for (const endDate of stageEndDates.values()) {
      if (!maxEndDate || endDate > maxEndDate) {
        maxEndDate = endDate;
      }
    }

    return maxEndDate;
  }

  /**
   * Автоматически сдвигает сроки всех зависимых этапов
   */
  async autoShiftDependentStages(
    stageId: string,
    userId: string,
    userName: string
  ): Promise<{ shiftedStages: ProjectStage[]; history: StageDeadlineHistory[] }> {
    const allStages = await db.select()
      .from(project_stages)
      .where(eq(project_stages.project_id,
        (await db.select({ project_id: project_stages.project_id })
          .from(project_stages)
          .where(eq(project_stages.id, stageId))
          .limit(1))[0].project_id
      ));

    const dependencies = await db.select()
      .from(stage_dependencies)
      .where(eq(stage_dependencies.depends_on_stage_id, stageId));

    const shiftedStages: ProjectStage[] = [];
    const historyEntries: StageDeadlineHistory[] = [];

    // Получаем обновленный этап для расчета сдвига
    const [updatedStage] = await db.select()
      .from(project_stages)
      .where(eq(project_stages.id, stageId));

    if (!updatedStage || !updatedStage.planned_end_date) {
      return { shiftedStages, history: historyEntries };
    }

    // Рекурсивно сдвигаем зависимые этапы
    const shiftStage = async (depStageId: string, minStartDate: Date) => {
      const [stage] = await db.select()
        .from(project_stages)
        .where(eq(project_stages.id, depStageId));

      if (!stage || !stage.planned_start_date) return;

      const currentStart = new Date(stage.planned_start_date);

      // Если текущее начало раньше минимально возможного - сдвигаем
      if (currentStart < minStartDate) {
        const daysDiff = Math.ceil((minStartDate.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24));

        const newStart = new Date(minStartDate);
        const newEnd = stage.planned_end_date ? new Date(stage.planned_end_date) : null;
        if (newEnd) {
          newEnd.setDate(newEnd.getDate() + daysDiff);
        }

        // Сохраняем историю
        const historyEntry = await this.recordDeadlineChange({
          stage_id: depStageId,
          changed_by: userId,
          changed_by_name: userName,
          old_planned_start: stage.planned_start_date,
          new_planned_start: newStart,
          old_planned_end: stage.planned_end_date,
          new_planned_end: newEnd,
          reason: `Автоматический сдвиг из-за изменения срока этапа "${updatedStage.name}"`,
          is_auto_shift: true,
        });
        historyEntries.push(historyEntry);

        // Обновляем этап
        const [updated] = await db.update(project_stages)
          .set({
            planned_start_date: newStart,
            planned_end_date: newEnd,
            updated_at: new Date(),
          })
          .where(eq(project_stages.id, depStageId))
          .returning();

        shiftedStages.push(updated);

        // Рекурсивно сдвигаем этапы, зависимые от текущего
        const nextDeps = await db.select()
          .from(stage_dependencies)
          .where(eq(stage_dependencies.depends_on_stage_id, depStageId));

        for (const nextDep of nextDeps) {
          if (newEnd) {
            await shiftStage(nextDep.stage_id, newEnd);
          }
        }
      }
    };

    // Сдвигаем все прямые зависимости
    for (const dep of dependencies) {
      await shiftStage(dep.stage_id, new Date(updatedStage.planned_end_date));
    }

    return { shiftedStages, history: historyEntries };
  }

  /**
   * Обновляет срок этапа с автоматическим сдвигом зависимых и сохранением истории
   */
  async updateStageDeadlineWithAutoShift(
    stageId: string,
    newPlannedStart: Date | null,
    newPlannedEnd: Date | null,
    userId: string,
    userName: string,
    reason?: string
  ): Promise<{
    updatedStage: ProjectStage;
    shiftedStages: ProjectStage[];
    history: StageDeadlineHistory[];
  }> {
    // Получаем текущее состояние этапа
    const [currentStage] = await db.select()
      .from(project_stages)
      .where(eq(project_stages.id, stageId));

    if (!currentStage) {
      throw new Error('Stage not found');
    }

    // Сохраняем историю изменения
    const historyEntry = await this.recordDeadlineChange({
      stage_id: stageId,
      changed_by: userId,
      changed_by_name: userName,
      old_planned_start: currentStage.planned_start_date,
      new_planned_start: newPlannedStart,
      old_planned_end: currentStage.planned_end_date,
      new_planned_end: newPlannedEnd,
      reason: reason || 'Изменение сроков этапа',
      is_auto_shift: false,
    });

    // Обновляем этап
    const [updatedStage] = await db.update(project_stages)
      .set({
        planned_start_date: newPlannedStart,
        planned_end_date: newPlannedEnd,
        updated_at: new Date(),
      })
      .where(eq(project_stages.id, stageId))
      .returning();

    // Автоматически сдвигаем зависимые этапы
    const { shiftedStages, history: autoShiftHistory } = await this.autoShiftDependentStages(
      stageId,
      userId,
      userName
    );

    return {
      updatedStage,
      shiftedStages,
      history: [historyEntry, ...autoShiftHistory],
    };
  }
}

export const projectsRepository = new ProjectsRepository();
