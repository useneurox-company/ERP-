import { db } from "../../db";
import { eq } from "drizzle-orm";
import type { Supplier, InsertSupplier } from "@shared/schema";
import { suppliers } from "@shared/schema";
import { nanoid } from "nanoid";

export class SuppliersRepository {
  async getAll(): Promise<Supplier[]> {
    return await db.select().from(suppliers).orderBy(suppliers.name);
  }

  async getActive(): Promise<Supplier[]> {
    return await db.select().from(suppliers).where(eq(suppliers.is_active, true)).orderBy(suppliers.name);
  }

  async getById(id: string): Promise<Supplier | undefined> {
    const result = await db.select().from(suppliers).where(eq(suppliers.id, id));
    return result[0];
  }

  async create(data: InsertSupplier): Promise<Supplier> {
    const id = nanoid();
    const result = await db.insert(suppliers).values({ ...data, id }).returning();
    return result[0];
  }

  async update(id: string, data: Partial<InsertSupplier>): Promise<Supplier | undefined> {
    const result = await db.update(suppliers)
      .set({ ...data, updated_at: new Date() })
      .where(eq(suppliers.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(suppliers).where(eq(suppliers.id, id)).returning();
    return result.length > 0;
  }
}

export const suppliersRepository = new SuppliersRepository();
