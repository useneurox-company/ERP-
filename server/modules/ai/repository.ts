import { db } from "../../db";
import { eq, desc } from "drizzle-orm";
import type { 
  AiChatMessage, InsertAiChatMessage,
  AiCorrection, InsertAiCorrection,
  MaterialPrice, InsertMaterialPrice
} from "@shared/schema";
import { ai_chat_messages, ai_corrections, material_prices } from "@shared/schema";

export class AiRepository {
  async getChatMessages(dealId: string): Promise<AiChatMessage[]> {
    return await db.select()
      .from(ai_chat_messages)
      .where(eq(ai_chat_messages.deal_id, dealId))
      .orderBy(ai_chat_messages.created_at);
  }

  async createChatMessage(data: InsertAiChatMessage): Promise<AiChatMessage> {
    const result = await db.insert(ai_chat_messages).values(data).returning();
    return result[0];
  }

  async getCorrections(dealId?: string): Promise<AiCorrection[]> {
    if (dealId) {
      return await db.select()
        .from(ai_corrections)
        .where(eq(ai_corrections.deal_id, dealId))
        .orderBy(desc(ai_corrections.created_at));
    }
    return await db.select()
      .from(ai_corrections)
      .orderBy(desc(ai_corrections.created_at))
      .limit(100);
  }

  async createCorrection(data: InsertAiCorrection): Promise<AiCorrection> {
    const result = await db.insert(ai_corrections).values(data).returning();
    return result[0];
  }

  async getMaterialPrices(): Promise<MaterialPrice[]> {
    return await db.select().from(material_prices);
  }

  async updateMaterialPrice(id: string, data: Partial<InsertMaterialPrice>): Promise<MaterialPrice | undefined> {
    const result = await db.update(material_prices)
      .set({ ...data, updated_at: new Date() })
      .where(eq(material_prices.id, id))
      .returning();
    return result[0];
  }

  async createMaterialPrice(data: InsertMaterialPrice): Promise<MaterialPrice> {
    const result = await db.insert(material_prices).values(data).returning();
    return result[0];
  }
}

export const aiRepository = new AiRepository();
