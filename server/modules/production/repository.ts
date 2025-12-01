import { db } from "../../db";
import { eq, asc } from "drizzle-orm";
import type { ProductionTask, InsertProductionTask, ProductionStage, InsertProductionStage } from "@shared/schema";
import { production_tasks, production_stages } from "@shared/schema";

export class ProductionRepository {
  async getAllProductionTasks(status?: string): Promise<Array<ProductionTask & { stages: ProductionStage[] }>> {
    let query = db.select().from(production_tasks);
    
    const allTasks = status 
      ? await query.where(eq(production_tasks.status, status as any))
      : await query;
    
    const tasksWithStages = await Promise.all(
      allTasks.map(async (task) => {
        const stages = await this.getProductionStages(task.id);
        return { ...task, stages };
      })
    );
    return tasksWithStages;
  }

  async getProductionTaskById(id: string): Promise<(ProductionTask & { stages: ProductionStage[] }) | undefined> {
    const result = await db.select().from(production_tasks).where(eq(production_tasks.id, id));
    const task = result[0];
    
    if (!task) {
      return undefined;
    }
    
    const stages = await this.getProductionStages(id);
    return { ...task, stages };
  }

  async createProductionTask(data: InsertProductionTask): Promise<ProductionTask> {
    const result = await db.insert(production_tasks).values(data).returning();
    return result[0];
  }

  async updateProductionTask(id: string, data: Partial<InsertProductionTask>): Promise<ProductionTask | undefined> {
    const result = await db.update(production_tasks)
      .set({ ...data, updated_at: new Date() })
      .where(eq(production_tasks.id, id))
      .returning();
    return result[0];
  }

  async deleteProductionTask(id: string): Promise<boolean> {
    await db.delete(production_stages).where(eq(production_stages.task_id, id));
    const result = await db.delete(production_tasks).where(eq(production_tasks.id, id)).returning();
    return result.length > 0;
  }

  async getProductionStages(taskId: string): Promise<ProductionStage[]> {
    return await db.select()
      .from(production_stages)
      .where(eq(production_stages.task_id, taskId))
      .orderBy(asc(production_stages.order));
  }

  async createProductionStage(data: InsertProductionStage): Promise<ProductionStage> {
    const result = await db.insert(production_stages).values(data).returning();
    await this.updateTaskProgress(data.task_id);
    return result[0];
  }

  async updateProductionStage(id: string, data: Partial<InsertProductionStage>): Promise<ProductionStage | undefined> {
    const result = await db.update(production_stages)
      .set({ ...data, updated_at: new Date() })
      .where(eq(production_stages.id, id))
      .returning();
    
    if (result[0]) {
      await this.updateTaskProgress(result[0].task_id);
    }
    
    return result[0];
  }

  async deleteProductionStage(id: string): Promise<boolean> {
    const stage = await db.select().from(production_stages).where(eq(production_stages.id, id));
    
    if (stage.length === 0) {
      return false;
    }
    
    const taskId = stage[0].task_id;
    const result = await db.delete(production_stages).where(eq(production_stages.id, id)).returning();
    
    if (result.length > 0) {
      await this.updateTaskProgress(taskId);
    }
    
    return result.length > 0;
  }

  async updateTaskProgress(taskId: string): Promise<ProductionTask | undefined> {
    const stages = await this.getProductionStages(taskId);
    
    if (stages.length === 0) {
      return this.updateProductionTask(taskId, { progress: 0 });
    }
    
    const completedStages = stages.filter(stage => stage.status === "completed").length;
    const progress = Math.round((completedStages / stages.length) * 100);
    
    return this.updateProductionTask(taskId, { progress });
  }
}

export const productionRepository = new ProductionRepository();
