import { db } from "../../db";
import { eq } from "drizzle-orm";
import type { CompanySettings, InsertCompanySettings, User, InsertUser } from "@shared/schema";
import { company_settings, users } from "@shared/schema";
import bcrypt from "bcrypt";

export class SettingsRepository {
  async getCompanySettings(): Promise<CompanySettings | undefined> {
    const result = await db.select().from(company_settings).limit(1);
    return result[0];
  }

  async updateCompanySettings(data: Partial<InsertCompanySettings>): Promise<CompanySettings | undefined> {
    const existingSettings = await this.getCompanySettings();
    
    if (existingSettings) {
      const result = await db.update(company_settings)
        .set({ ...data, updated_at: new Date() })
        .where(eq(company_settings.id, existingSettings.id))
        .returning();
      return result[0];
    } else {
      const result = await db.insert(company_settings).values(data as InsertCompanySettings).returning();
      return result[0];
    }
  }

  async getAllUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const updateData = { ...data };
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const result = await db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    if (!result[0]) return undefined;
    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }
}

export const settingsRepository = new SettingsRepository();
