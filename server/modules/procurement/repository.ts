import { db } from "../../db";
import {
  procurement_comparisons,
  procurement_comparison_items,
  warehouse_items,
  suppliers,
  type InsertProcurementComparison,
  type InsertProcurementComparisonItem,
  type ProcurementComparison,
  type ProcurementComparisonItem,
  type Supplier
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

export const procurementRepository = {
  // Создать сравнение
  async createComparison(data: Omit<InsertProcurementComparison, 'id'>): Promise<ProcurementComparison> {
    const id = nanoid();
    const [comparison] = await db
      .insert(procurement_comparisons)
      .values({ id, ...data })
      .returning();
    return comparison;
  },

  // Получить сравнение по ID
  async getComparisonById(id: string): Promise<ProcurementComparison | null> {
    const [comparison] = await db
      .select()
      .from(procurement_comparisons)
      .where(eq(procurement_comparisons.id, id));
    return comparison || null;
  },

  // Получить сравнения по stage_id
  async getComparisonsByStageId(stageId: string): Promise<ProcurementComparison[]> {
    return await db
      .select()
      .from(procurement_comparisons)
      .where(eq(procurement_comparisons.stage_id, stageId));
  },

  // Обновить сравнение
  async updateComparison(id: string, data: Partial<InsertProcurementComparison>): Promise<ProcurementComparison | null> {
    const [updated] = await db
      .update(procurement_comparisons)
      .set({ ...data, updated_at: new Date() })
      .where(eq(procurement_comparisons.id, id))
      .returning();
    return updated || null;
  },

  // Удалить сравнение
  async deleteComparison(id: string): Promise<boolean> {
    const result = await db
      .delete(procurement_comparisons)
      .where(eq(procurement_comparisons.id, id));
    return true;
  },

  // ========== Items ==========

  // Создать позицию
  async createItem(data: Omit<InsertProcurementComparisonItem, 'id'>): Promise<ProcurementComparisonItem> {
    const id = nanoid();
    const [item] = await db
      .insert(procurement_comparison_items)
      .values({ id, ...data })
      .returning();
    return item;
  },

  // Создать много позиций
  async createManyItems(items: Omit<InsertProcurementComparisonItem, 'id'>[]): Promise<ProcurementComparisonItem[]> {
    if (items.length === 0) return [];

    const itemsWithIds = items.map(item => ({
      id: nanoid(),
      ...item
    }));

    return await db
      .insert(procurement_comparison_items)
      .values(itemsWithIds)
      .returning();
  },

  // Получить позиции сравнения
  async getItemsByComparisonId(comparisonId: string): Promise<ProcurementComparisonItem[]> {
    return await db
      .select()
      .from(procurement_comparison_items)
      .where(eq(procurement_comparison_items.comparison_id, comparisonId));
  },

  // Получить позицию по ID
  async getItemById(id: string): Promise<ProcurementComparisonItem | null> {
    const [item] = await db
      .select()
      .from(procurement_comparison_items)
      .where(eq(procurement_comparison_items.id, id));
    return item || null;
  },

  // Обновить позицию
  async updateItem(id: string, data: Partial<InsertProcurementComparisonItem>): Promise<ProcurementComparisonItem | null> {
    const [updated] = await db
      .update(procurement_comparison_items)
      .set(data)
      .where(eq(procurement_comparison_items.id, id))
      .returning();
    return updated || null;
  },

  // Получить все товары со склада
  async getAllWarehouseItems() {
    return await db
      .select()
      .from(warehouse_items);
  },

  // Получить всех поставщиков
  async getAllSuppliers(): Promise<Supplier[]> {
    return await db
      .select()
      .from(suppliers);
  },

  // Получить поставщика по ID
  async getSupplierById(id: string): Promise<Supplier | null> {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id));
    return supplier || null;
  },

  // Получить товар склада по ID
  async getWarehouseItemById(id: string) {
    const [item] = await db
      .select()
      .from(warehouse_items)
      .where(eq(warehouse_items.id, id));
    return item || null;
  },

  // Получить позиции добавленные в заказ
  async getItemsAddedToOrder(comparisonId: string): Promise<ProcurementComparisonItem[]> {
    return await db
      .select()
      .from(procurement_comparison_items)
      .where(
        and(
          eq(procurement_comparison_items.comparison_id, comparisonId),
          eq(procurement_comparison_items.added_to_order, 1)
        )
      );
  }
};
