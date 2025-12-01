import { db } from '../../db';
import { salesPipelines, dealStages, custom_field_definitions } from '@shared/schema';
import type { InsertSalesPipeline, SalesPipeline, DealStage, CustomFieldDefinition } from '@shared/schema';
import { eq, desc, asc } from 'drizzle-orm';

export class SalesPipelinesRepository {
  // Get all pipelines
  async findAll(): Promise<SalesPipeline[]> {
    return await db
      .select()
      .from(salesPipelines)
      .orderBy(asc(salesPipelines.order));
  }

  // Get pipeline by ID
  async findById(id: string): Promise<SalesPipeline | undefined> {
    const results = await db
      .select()
      .from(salesPipelines)
      .where(eq(salesPipelines.id, id))
      .limit(1);

    return results[0];
  }

  // Get default pipeline
  async findDefault(): Promise<SalesPipeline | undefined> {
    const results = await db
      .select()
      .from(salesPipelines)
      .where(eq(salesPipelines.is_default, true))
      .limit(1);

    return results[0];
  }

  // Create pipeline
  async create(data: InsertSalesPipeline): Promise<SalesPipeline> {
    const result = await db
      .insert(salesPipelines)
      .values(data)
      .returning();

    return result[0];
  }

  // Update pipeline
  async update(id: string, data: Partial<InsertSalesPipeline>): Promise<SalesPipeline | undefined> {
    const result = await db
      .update(salesPipelines)
      .set({ ...data, updated_at: new Date() })
      .where(eq(salesPipelines.id, id))
      .returning();

    return result[0];
  }

  // Delete pipeline
  async delete(id: string): Promise<void> {
    await db
      .delete(salesPipelines)
      .where(eq(salesPipelines.id, id));
  }

  // Set pipeline as default (and unset others)
  async setAsDefault(id: string): Promise<void> {
    // Unset all other defaults
    await db
      .update(salesPipelines)
      .set({ is_default: false, updated_at: new Date() })
      .where(eq(salesPipelines.is_default, true));

    // Set this one as default
    await db
      .update(salesPipelines)
      .set({ is_default: true, updated_at: new Date() })
      .where(eq(salesPipelines.id, id));
  }

  // Get stages for a pipeline
  async findStages(pipelineId: string): Promise<DealStage[]> {
    return await db
      .select()
      .from(dealStages)
      .where(eq(dealStages.pipeline_id, pipelineId))
      .orderBy(asc(dealStages.order));
  }

  // Get custom fields for a pipeline
  async findCustomFields(pipelineId: string): Promise<CustomFieldDefinition[]> {
    return await db
      .select()
      .from(custom_field_definitions)
      .where(eq(custom_field_definitions.pipeline_id, pipelineId))
      .orderBy(asc(custom_field_definitions.order));
  }

  // Get global custom fields (pipeline_id is NULL)
  async findGlobalCustomFields(): Promise<CustomFieldDefinition[]> {
    const results = await db
      .select()
      .from(custom_field_definitions)
      .where(eq(custom_field_definitions.pipeline_id, null as any))
      .orderBy(asc(custom_field_definitions.order));

    return results;
  }
}

export const salesPipelinesRepository = new SalesPipelinesRepository();
