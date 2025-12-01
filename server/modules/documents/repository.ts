import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import type { Document, InsertDocument } from "@shared/schema";
import { documents } from "@shared/schema";

export class DocumentsRepository {
  async getAllDocuments(type?: string, projectId?: string): Promise<Document[]> {
    let conditions = [];
    
    if (type) {
      conditions.push(eq(documents.type, type as any));
    }
    
    if (projectId) {
      conditions.push(eq(documents.project_id, projectId));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(documents).where(and(...conditions));
    }
    
    return await db.select().from(documents);
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    const result = await db.select().from(documents).where(eq(documents.id, id));
    return result[0];
  }

  async createDocument(data: InsertDocument): Promise<Document> {
    const result = await db.insert(documents).values(data).returning();
    return result[0];
  }

  async updateDocument(id: string, data: Partial<InsertDocument>): Promise<Document | undefined> {
    const result = await db.update(documents)
      .set({ ...data, updated_at: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return result[0];
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id)).returning();
    return result.length > 0;
  }
}

export const documentsRepository = new DocumentsRepository();
