import { db } from "../../db";
import { eq } from "drizzle-orm";
import type { Installation, InsertInstallation } from "@shared/schema";
import { installations } from "@shared/schema";

export class InstallationRepository {
  async getAllInstallations(status?: string): Promise<Installation[]> {
    if (status) {
      return await db.select().from(installations).where(eq(installations.status, status as any));
    }
    return await db.select().from(installations);
  }

  async getInstallationById(id: string): Promise<Installation | undefined> {
    const result = await db.select().from(installations).where(eq(installations.id, id));
    return result[0];
  }

  async createInstallation(data: InsertInstallation): Promise<Installation> {
    const result = await db.insert(installations).values(data).returning();
    return result[0];
  }

  async updateInstallation(id: string, data: Partial<InsertInstallation>): Promise<Installation | undefined> {
    const result = await db.update(installations)
      .set({ ...data, updated_at: new Date() })
      .where(eq(installations.id, id))
      .returning();
    return result[0];
  }

  async deleteInstallation(id: string): Promise<boolean> {
    const result = await db.delete(installations).where(eq(installations.id, id)).returning();
    return result.length > 0;
  }
}

export const installationRepository = new InstallationRepository();
