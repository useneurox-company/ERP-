import { db } from '../../db';
import { stage_documents } from '@shared/schema';
import type { InsertStageDocument, StageDocument } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class StageDocumentsRepository {
  /**
   * Получить все документы этапа
   */
  async getStageDocuments(stageId: string): Promise<StageDocument[]> {
    return await db.query.stage_documents.findMany({
      where: (sd, { eq }) => eq(sd.stage_id, stageId),
      orderBy: (sd, { desc }) => [desc(sd.created_at)],
    });
  }

  /**
   * Получить документы этапа по типу медиа
   */
  async getStageDocumentsByType(stageId: string, mediaType: string): Promise<StageDocument[]> {
    return await db.query.stage_documents.findMany({
      where: (sd, { eq, and }) => and(
        eq(sd.stage_id, stageId),
        eq(sd.media_type, mediaType)
      ),
      orderBy: (sd, { desc }) => [desc(sd.created_at)],
    });
  }

  /**
   * Получить документ по ID
   */
  async getStageDocumentById(id: string): Promise<StageDocument | undefined> {
    return await db.query.stage_documents.findFirst({
      where: (sd, { eq }) => eq(sd.id, id),
    });
  }

  /**
   * Создать новый документ
   */
  async createStageDocument(data: InsertStageDocument): Promise<StageDocument> {
    const [document] = await db.insert(stage_documents).values(data).returning();
    return document;
  }

  /**
   * Обновить документ
   */
  async updateStageDocument(id: string, data: Partial<InsertStageDocument>): Promise<StageDocument | undefined> {
    const [updated] = await db
      .update(stage_documents)
      .set({ ...data, updated_at: new Date() })
      .where(eq(stage_documents.id, id))
      .returning();
    return updated;
  }

  /**
   * Удалить документ
   */
  async deleteStageDocument(id: string): Promise<boolean> {
    const [deleted] = await db
      .delete(stage_documents)
      .where(eq(stage_documents.id, id))
      .returning();
    return !!deleted;
  }

  /**
   * Удалить все документы этапа
   */
  async deleteAllStageDocuments(stageId: string): Promise<number> {
    const deleted = await db
      .delete(stage_documents)
      .where(eq(stage_documents.stage_id, stageId))
      .returning();
    return deleted.length;
  }

  /**
   * Получить статистику по медиа этапа
   */
  async getStageMediaStats(stageId: string): Promise<{
    total: number;
    photos: number;
    videos: number;
    audio: number;
    documents: number;
  }> {
    const allDocs = await this.getStageDocuments(stageId);

    return {
      total: allDocs.length,
      photos: allDocs.filter(d => d.media_type === 'photo').length,
      videos: allDocs.filter(d => d.media_type === 'video').length,
      audio: allDocs.filter(d => d.media_type === 'audio').length,
      documents: allDocs.filter(d => d.media_type === 'document').length,
    };
  }
}

export const stageDocumentsRepository = new StageDocumentsRepository();
