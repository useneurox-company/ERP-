import { db } from "../../db";
import { eq, and, desc, sql } from "drizzle-orm";
import type {
  WarehouseReservation,
  InsertWarehouseReservation,
  WarehouseItem,
} from "@shared/schema";
import { warehouse_reservations, warehouse_items } from "@shared/schema";

export class ReservationsRepository {
  /**
   * Создать резервирование
   */
  async createReservation(
    data: InsertWarehouseReservation
  ): Promise<WarehouseReservation> {
    // Проверить доступное количество
    const item = await db
      .select()
      .from(warehouse_items)
      .where(eq(warehouse_items.id, data.item_id))
      .limit(1);

    if (!item[0]) {
      throw new Error("Товар не найден");
    }

    const available = item[0].quantity - item[0].reserved_quantity;
    if (available < data.quantity) {
      throw new Error(
        `Недостаточно товара. Доступно: ${available}, запрошено: ${data.quantity}`
      );
    }

    // Создать резервирование
    const result = await db
      .insert(warehouse_reservations)
      .values(data)
      .returning();

    // Обновить reserved_quantity
    await this.recalculateReservedQuantity(data.item_id);

    return result[0];
  }

  /**
   * Получить все резервирования для товара
   */
  async getReservationsByItem(itemId: string): Promise<WarehouseReservation[]> {
    return await db
      .select()
      .from(warehouse_reservations)
      .where(eq(warehouse_reservations.item_id, itemId))
      .orderBy(desc(warehouse_reservations.created_at));
  }

  /**
   * Получить все резервирования для проекта
   */
  async getReservationsByProject(
    projectId: string
  ): Promise<WarehouseReservation[]> {
    return await db
      .select()
      .from(warehouse_reservations)
      .where(eq(warehouse_reservations.project_id, projectId))
      .orderBy(desc(warehouse_reservations.created_at));
  }

  /**
   * Получить резервирование по ID
   */
  async getReservationById(
    id: string
  ): Promise<WarehouseReservation | undefined> {
    const result = await db
      .select()
      .from(warehouse_reservations)
      .where(eq(warehouse_reservations.id, id))
      .limit(1);
    return result[0];
  }

  /**
   * Обновить статус резервирования
   */
  async updateReservationStatus(
    id: string,
    status: "pending" | "confirmed" | "released" | "cancelled"
  ): Promise<WarehouseReservation | undefined> {
    const updateData: any = {
      status,
      updated_at: new Date(),
    };

    // Если статус "released" или "cancelled", установить released_at
    if (status === "released" || status === "cancelled") {
      updateData.released_at = new Date();
    }

    const result = await db
      .update(warehouse_reservations)
      .set(updateData)
      .where(eq(warehouse_reservations.id, id))
      .returning();

    if (result[0]) {
      // Пересчитать reserved_quantity для товара
      await this.recalculateReservedQuantity(result[0].item_id);
    }

    return result[0];
  }

  /**
   * Снять резерв (перевести в статус "released")
   */
  async releaseReservation(
    id: string
  ): Promise<WarehouseReservation | undefined> {
    return await this.updateReservationStatus(id, "released");
  }

  /**
   * Отменить резерв (перевести в статус "cancelled")
   */
  async cancelReservation(
    id: string
  ): Promise<WarehouseReservation | undefined> {
    return await this.updateReservationStatus(id, "cancelled");
  }

  /**
   * Подтвердить резерв (перевести в статус "confirmed")
   */
  async confirmReservation(
    id: string
  ): Promise<WarehouseReservation | undefined> {
    return await this.updateReservationStatus(id, "confirmed");
  }

  /**
   * Удалить резервирование
   */
  async deleteReservation(id: string): Promise<boolean> {
    const reservation = await this.getReservationById(id);
    if (!reservation) {
      return false;
    }

    const result = await db
      .delete(warehouse_reservations)
      .where(eq(warehouse_reservations.id, id))
      .returning();

    if (result.length > 0) {
      // Пересчитать reserved_quantity
      await this.recalculateReservedQuantity(reservation.item_id);
      return true;
    }

    return false;
  }

  /**
   * Пересчитать зарезервированное количество для товара
   */
  async recalculateReservedQuantity(itemId: string): Promise<void> {
    // Получить сумму активных резервов (pending и confirmed)
    const result = await db
      .select({
        total: sql<number>`COALESCE(SUM(${warehouse_reservations.quantity}), 0)`,
      })
      .from(warehouse_reservations)
      .where(
        and(
          eq(warehouse_reservations.item_id, itemId),
          sql`${warehouse_reservations.status} IN ('pending', 'confirmed')`
        )
      );

    const reservedQuantity = result[0]?.total || 0;

    // Обновить reserved_quantity в warehouse_items
    await db
      .update(warehouse_items)
      .set({
        reserved_quantity: reservedQuantity,
        updated_at: new Date(),
      })
      .where(eq(warehouse_items.id, itemId));
  }

  /**
   * Получить доступное количество товара (quantity - reserved_quantity)
   */
  async getAvailableQuantity(itemId: string): Promise<number> {
    const item = await db
      .select()
      .from(warehouse_items)
      .where(eq(warehouse_items.id, itemId))
      .limit(1);

    if (!item[0]) {
      return 0;
    }

    return Math.max(0, item[0].quantity - item[0].reserved_quantity);
  }
}

export const reservationsRepository = new ReservationsRepository();
