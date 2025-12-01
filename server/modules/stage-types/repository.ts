import { db } from '../../db';
import { stage_types } from '@shared/schema';
import type { InsertStageType, StageType } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class StageTypesRepository {
  /**
   * Получить все активные типы этапов
   */
  async getActiveStageTypes(): Promise<StageType[]> {
    return await db.query.stage_types.findMany({
      where: (st, { eq }) => eq(st.is_active, 1),
      orderBy: (st, { asc }) => [asc(st.name)],
    });
  }

  /**
   * Получить все типы этапов (включая неактивные)
   */
  async getAllStageTypes(): Promise<StageType[]> {
    return await db.query.stage_types.findMany({
      orderBy: (st, { asc }) => [asc(st.name)],
    });
  }

  /**
   * Получить тип этапа по ID
   */
  async getStageTypeById(id: string): Promise<StageType | undefined> {
    return await db.query.stage_types.findFirst({
      where: (st, { eq }) => eq(st.id, id),
    });
  }

  /**
   * Получить тип этапа по коду
   */
  async getStageTypeByCode(code: string): Promise<StageType | undefined> {
    return await db.query.stage_types.findFirst({
      where: (st, { eq }) => eq(st.code, code),
    });
  }

  /**
   * Создать новый тип этапа
   */
  async createStageType(data: InsertStageType): Promise<StageType> {
    const [stageType] = await db.insert(stage_types).values(data).returning();
    return stageType;
  }

  /**
   * Обновить тип этапа
   */
  async updateStageType(id: string, data: Partial<InsertStageType>): Promise<StageType | undefined> {
    const [updated] = await db
      .update(stage_types)
      .set({ ...data, updated_at: new Date() })
      .where(eq(stage_types.id, id))
      .returning();
    return updated;
  }

  /**
   * Удалить тип этапа (мягкое удаление - устанавливаем is_active = 0)
   */
  async deactivateStageType(id: string): Promise<boolean> {
    const [updated] = await db
      .update(stage_types)
      .set({ is_active: 0, updated_at: new Date() })
      .where(eq(stage_types.id, id))
      .returning();
    return !!updated;
  }

  /**
   * Активировать тип этапа
   */
  async activateStageType(id: string): Promise<boolean> {
    const [updated] = await db
      .update(stage_types)
      .set({ is_active: 1, updated_at: new Date() })
      .where(eq(stage_types.id, id))
      .returning();
    return !!updated;
  }
}

export const stageTypesRepository = new StageTypesRepository();
