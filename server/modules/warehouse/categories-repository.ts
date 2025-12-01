import { db } from "../../db";
import { eq, isNull, asc } from "drizzle-orm";
import type {
  WarehouseCategory,
  InsertWarehouseCategory,
} from "@shared/schema";
import { warehouseCategories } from "@shared/schema";
import { nanoid } from "nanoid";

export class CategoriesRepository {
  /**
   * Получить все категории (с иерархией)
   */
  async getAllCategories(): Promise<WarehouseCategory[]> {
    return await db
      .select()
      .from(warehouseCategories)
      .orderBy(asc(warehouseCategories.order), asc(warehouseCategories.name));
  }

  /**
   * Получить корневые категории (parent_id = null)
   */
  async getRootCategories(): Promise<WarehouseCategory[]> {
    return await db
      .select()
      .from(warehouseCategories)
      .where(isNull(warehouseCategories.parent_id))
      .orderBy(asc(warehouseCategories.order), asc(warehouseCategories.name));
  }

  /**
   * Получить подкатегории для родительской категории
   */
  async getSubcategories(parentId: string): Promise<WarehouseCategory[]> {
    return await db
      .select()
      .from(warehouseCategories)
      .where(eq(warehouseCategories.parent_id, parentId))
      .orderBy(asc(warehouseCategories.order), asc(warehouseCategories.name));
  }

  /**
   * Получить категорию по ID
   */
  async getCategoryById(id: string): Promise<WarehouseCategory | undefined> {
    const result = await db
      .select()
      .from(warehouseCategories)
      .where(eq(warehouseCategories.id, id))
      .limit(1);
    return result[0];
  }

  /**
   * Создать категорию
   */
  async createCategory(
    data: InsertWarehouseCategory
  ): Promise<WarehouseCategory> {
    const id = nanoid();

    const categoryData = {
      ...data,
      id,
    };

    const result = await db
      .insert(warehouseCategories)
      .values(categoryData)
      .returning();
    return result[0];
  }

  /**
   * Обновить категорию
   */
  async updateCategory(
    id: string,
    data: Partial<InsertWarehouseCategory>
  ): Promise<WarehouseCategory | undefined> {
    const result = await db
      .update(warehouseCategories)
      .set({ ...data, updated_at: new Date() })
      .where(eq(warehouseCategories.id, id))
      .returning();

    return result[0];
  }

  /**
   * Удалить категорию
   */
  async deleteCategory(id: string): Promise<boolean> {
    // Проверить, есть ли подкатегории
    const subcategories = await this.getSubcategories(id);
    if (subcategories.length > 0) {
      throw new Error(
        `Невозможно удалить категорию: существуют подкатегории (${subcategories.length})`
      );
    }

    // TODO: Проверить, используется ли категория в товарах
    // Когда будет готов UI, можно добавить проверку

    const result = await db
      .delete(warehouseCategories)
      .where(eq(warehouseCategories.id, id))
      .returning();

    return result.length > 0;
  }

  /**
   * Получить дерево категорий (корневые + их подкатегории)
   */
  async getCategoryTree(): Promise<Array<WarehouseCategory & { children: WarehouseCategory[] }>> {
    const roots = await this.getRootCategories();
    const tree = [];

    for (const root of roots) {
      const children = await this.getSubcategories(root.id);
      tree.push({
        ...root,
        children,
      });
    }

    return tree;
  }
}

export const categoriesRepository = new CategoriesRepository();
