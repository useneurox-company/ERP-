import { db } from "../../db";
import { eq } from "drizzle-orm";
import type { Installer, InsertInstaller } from "@shared/schema";
import { installers } from "@shared/schema";

export class InstallersRepository {
  async getAll(): Promise<Installer[]> {
    return await db.select().from(installers).orderBy(installers.name);
  }

  async getActive(): Promise<Installer[]> {
    return await db.select().from(installers)
      .where(eq(installers.is_active, true))
      .orderBy(installers.name);
  }

  async getById(id: string): Promise<Installer | undefined> {
    const result = await db.select().from(installers).where(eq(installers.id, id));
    return result[0];
  }

  async create(data: InsertInstaller): Promise<Installer> {
    const result = await db.insert(installers).values(data).returning();
    return result[0];
  }

  async update(id: string, data: Partial<InsertInstaller>): Promise<Installer | undefined> {
    const result = await db.update(installers)
      .set({ ...data, updated_at: new Date() })
      .where(eq(installers.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(installers).where(eq(installers.id, id)).returning();
    return result.length > 0;
  }
}

export const installersRepository = new InstallersRepository();
