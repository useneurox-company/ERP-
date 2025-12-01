import { db } from "../../db";
import { eq, and, asc } from "drizzle-orm";
import type {
  ProcessTemplate, InsertProcessTemplate,
  TemplateStage, InsertTemplateStage,
  TemplateDependency, InsertTemplateDependency,
  TemplateStageAttachment, InsertTemplateStageAttachment
} from "@shared/schema";
import {
  process_templates,
  template_stages,
  template_dependencies,
  template_stage_attachments
} from "@shared/schema";

export class TemplatesRepository {
  // Template methods
  async getAllTemplates(): Promise<ProcessTemplate[]> {
    return await db.select().from(process_templates).orderBy(asc(process_templates.name));
  }

  async getActiveTemplates(): Promise<ProcessTemplate[]> {
    return await db.select()
      .from(process_templates)
      .where(eq(process_templates.is_active, true))
      .orderBy(asc(process_templates.name));
  }

  async getTemplateById(id: string): Promise<ProcessTemplate | undefined> {
    const result = await db.select().from(process_templates).where(eq(process_templates.id, id));
    return result[0];
  }

  async createTemplate(data: InsertProcessTemplate): Promise<ProcessTemplate> {
    const result = await db.insert(process_templates).values(data).returning();
    return result[0];
  }

  async updateTemplate(id: string, data: Partial<InsertProcessTemplate>): Promise<ProcessTemplate | undefined> {
    const result = await db.update(process_templates)
      .set({ ...data, updated_at: new Date() })
      .where(eq(process_templates.id, id))
      .returning();
    return result[0];
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await db.delete(process_templates).where(eq(process_templates.id, id)).returning();
    return result.length > 0;
  }

  // Template stages methods
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

  async updateTemplateStage(id: string, data: Partial<InsertTemplateStage>): Promise<TemplateStage | undefined> {
    const result = await db.update(template_stages)
      .set({ ...data, updated_at: new Date() })
      .where(eq(template_stages.id, id))
      .returning();
    return result[0];
  }

  async deleteTemplateStage(id: string): Promise<boolean> {
    const result = await db.delete(template_stages).where(eq(template_stages.id, id)).returning();
    return result.length > 0;
  }

  async deleteTemplateStagesByTemplateId(templateId: string): Promise<void> {
    await db.delete(template_stages).where(eq(template_stages.template_id, templateId));
  }

  // Template dependencies methods
  async getTemplateDependencies(templateId: string): Promise<TemplateDependency[]> {
    // Get all stages for this template
    const stages = await this.getTemplateStages(templateId);
    const stageIds = stages.map(s => s.id);

    if (stageIds.length === 0) {
      return [];
    }

    // Get dependencies for these stages
    const allDeps = await db.select().from(template_dependencies);
    return allDeps.filter(dep => stageIds.includes(dep.template_stage_id));
  }

  async createTemplateDependency(data: InsertTemplateDependency): Promise<TemplateDependency> {
    const result = await db.insert(template_dependencies).values(data).returning();
    return result[0];
  }

  async deleteTemplateDependency(id: string): Promise<boolean> {
    const result = await db.delete(template_dependencies).where(eq(template_dependencies.id, id)).returning();
    return result.length > 0;
  }

  async deleteTemplateDependenciesByStageId(stageId: string): Promise<void> {
    await db.delete(template_dependencies)
      .where(
        and(
          eq(template_dependencies.template_stage_id, stageId)
        )
      );
  }

  // Template stage attachments methods
  async getStageAttachments(stageId: string): Promise<TemplateStageAttachment[]> {
    return await db.select()
      .from(template_stage_attachments)
      .where(eq(template_stage_attachments.template_stage_id, stageId))
      .orderBy(asc(template_stage_attachments.created_at));
  }

  async getAttachmentById(id: string): Promise<TemplateStageAttachment | undefined> {
    const result = await db.select()
      .from(template_stage_attachments)
      .where(eq(template_stage_attachments.id, id));
    return result[0];
  }

  async createStageAttachment(data: InsertTemplateStageAttachment): Promise<TemplateStageAttachment> {
    const result = await db.insert(template_stage_attachments).values(data).returning();
    return result[0];
  }

  async deleteStageAttachment(id: string): Promise<boolean> {
    const result = await db.delete(template_stage_attachments)
      .where(eq(template_stage_attachments.id, id))
      .returning();
    return result.length > 0;
  }

  async deleteStageAttachmentsByStageId(stageId: string): Promise<void> {
    await db.delete(template_stage_attachments)
      .where(eq(template_stage_attachments.template_stage_id, stageId));
  }

  // Get template with all its data
  async getTemplateWithDetails(templateId: string): Promise<{
    template: ProcessTemplate;
    stages: TemplateStage[];
    dependencies: TemplateDependency[];
  } | undefined> {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      return undefined;
    }

    const stages = await this.getTemplateStages(templateId);
    const dependencies = await this.getTemplateDependencies(templateId);

    return {
      template,
      stages,
      dependencies
    };
  }
}

export const templatesRepository = new TemplatesRepository();
