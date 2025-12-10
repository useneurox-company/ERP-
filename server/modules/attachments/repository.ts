import { db } from "../../db";
import { deal_attachments, deal_documents, stage_documents, task_attachments, documents, project_supplier_documents, type InsertDealAttachment, type DealAttachment } from "@shared/schema";
import { eq, and } from "drizzle-orm";

// Универсальный тип для любого вложения
export interface UniversalAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number | null;
  mime_type?: string | null;
  source: 'deal' | 'deal_document' | 'stage' | 'task' | 'document' | 'supplier_document';
}

export const attachmentsRepository = {
  async getDealAttachments(dealId: string): Promise<DealAttachment[]> {
    return await db.select().from(deal_attachments).where(eq(deal_attachments.deal_id, dealId));
  },

  async getDealAttachmentById(id: string): Promise<DealAttachment | undefined> {
    const [attachment] = await db.select().from(deal_attachments).where(eq(deal_attachments.id, id));
    return attachment;
  },

  async createDealAttachment(data: InsertDealAttachment): Promise<DealAttachment> {
    const [newAttachment] = await db.insert(deal_attachments).values(data).returning();
    return newAttachment;
  },

  async deleteDealAttachment(id: string): Promise<boolean> {
    const result = await db.delete(deal_attachments).where(eq(deal_attachments.id, id)).returning();
    return result.length > 0;
  },

  async getDealAttachmentsByDealAndUser(dealId: string, userId: string): Promise<DealAttachment[]> {
    return await db.select()
      .from(deal_attachments)
      .where(
        and(
          eq(deal_attachments.deal_id, dealId),
          eq(deal_attachments.uploaded_by, userId)
        )
      );
  },

  // Универсальный поиск документа по ID во всех таблицах
  async getAnyAttachmentById(id: string): Promise<UniversalAttachment | undefined> {
    // 1. Проверяем в deal_attachments
    const [dealAttachment] = await db.select().from(deal_attachments).where(eq(deal_attachments.id, id));
    if (dealAttachment) {
      return {
        id: dealAttachment.id,
        file_name: dealAttachment.file_name,
        file_path: dealAttachment.file_path,
        file_size: dealAttachment.file_size,
        mime_type: dealAttachment.mime_type,
        source: 'deal'
      };
    }

    // 1.5 Проверяем в deal_documents (КП, договоры, счета сделок)
    const [dealDoc] = await db.select().from(deal_documents).where(eq(deal_documents.id, id));
    if (dealDoc) {
      return {
        id: dealDoc.id,
        file_name: dealDoc.name,
        file_path: dealDoc.file_url,
        file_size: null,
        mime_type: dealDoc.media_type || 'application/pdf',
        source: 'deal_document'
      };
    }

    // 2. Проверяем в stage_documents
    const [stageDoc] = await db.select().from(stage_documents).where(eq(stage_documents.id, id));
    if (stageDoc) {
      return {
        id: stageDoc.id,
        file_name: stageDoc.file_name || '',
        file_path: stageDoc.file_path || stageDoc.file_url || '',
        file_size: stageDoc.file_size,
        mime_type: stageDoc.mime_type || stageDoc.media_type,
        source: 'stage'
      };
    }

    // 3. Проверяем в task_attachments
    const [taskAttachment] = await db.select().from(task_attachments).where(eq(task_attachments.id, id));
    if (taskAttachment) {
      return {
        id: taskAttachment.id,
        file_name: taskAttachment.file_name,
        file_path: taskAttachment.file_path,
        file_size: taskAttachment.file_size,
        mime_type: taskAttachment.mime_type,
        source: 'task'
      };
    }

    // 4. Проверяем в documents (обычные документы проектов)
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (doc) {
      return {
        id: doc.id,
        file_name: doc.name,
        file_path: doc.file_path,
        file_size: doc.size,
        mime_type: doc.type,
        source: 'document'
      };
    }

    // 5. Проверяем в project_supplier_documents (документы поставщиков)
    const [supplierDoc] = await db.select().from(project_supplier_documents).where(eq(project_supplier_documents.id, id));
    if (supplierDoc) {
      return {
        id: supplierDoc.id,
        file_name: supplierDoc.file_name,
        file_path: supplierDoc.file_path,
        file_size: supplierDoc.file_size,
        mime_type: supplierDoc.mime_type,
        source: 'supplier_document'
      };
    }

    return undefined;
  },

  // Обновить флаг is_financial для вложения
  async updateAttachmentFinancial(id: string, isFinancial: boolean): Promise<DealAttachment | undefined> {
    const [updated] = await db.update(deal_attachments)
      .set({ is_financial: isFinancial })
      .where(eq(deal_attachments.id, id))
      .returning();
    return updated;
  },

  // Обновить флаг is_financial для deal_document (КП, договоры, счета)
  async updateDealDocumentFinancial(id: string, isFinancial: boolean): Promise<boolean> {
    const result = await db.update(deal_documents)
      .set({ is_financial: isFinancial ? 1 : 0 })
      .where(eq(deal_documents.id, id))
      .returning();
    return result.length > 0;
  },

  // Универсальное удаление документа из любой таблицы
  async deleteAnyAttachment(id: string, source: UniversalAttachment['source']): Promise<boolean> {
    let result: any[] = [];

    switch (source) {
      case 'deal':
        result = await db.delete(deal_attachments).where(eq(deal_attachments.id, id)).returning();
        break;
      case 'deal_document':
        result = await db.delete(deal_documents).where(eq(deal_documents.id, id)).returning();
        break;
      case 'stage':
        result = await db.delete(stage_documents).where(eq(stage_documents.id, id)).returning();
        break;
      case 'task':
        result = await db.delete(task_attachments).where(eq(task_attachments.id, id)).returning();
        break;
      case 'document':
        result = await db.delete(documents).where(eq(documents.id, id)).returning();
        break;
      case 'supplier_document':
        result = await db.delete(project_supplier_documents).where(eq(project_supplier_documents.id, id)).returning();
        break;
    }

    return result.length > 0;
  }
};
