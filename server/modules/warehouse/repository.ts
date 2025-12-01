import { db } from "../../db";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import type { WarehouseItem, InsertWarehouseItem, WarehouseTransaction, InsertWarehouseTransaction } from "@shared/schema";
import { warehouse_items, warehouse_transactions, warehouse_reservations, shipment_items, shipments } from "@shared/schema";
import { nanoid } from "nanoid";
import { notificationsRepository } from "./notifications.repository";

export class WarehouseRepository {
  async getAllWarehouseItems(category?: string, status?: string): Promise<WarehouseItem[]> {
    let conditions = [];

    if (category) {
      conditions.push(eq(warehouse_items.category_id, category as any));
    }
    
    if (status) {
      conditions.push(eq(warehouse_items.status, status as any));
    }
    
    if (conditions.length > 0) {
      return await db.select().from(warehouse_items).where(and(...conditions));
    }
    
    return await db.select().from(warehouse_items);
  }

  async getWarehouseItemById(id: string): Promise<WarehouseItem | undefined> {
    const result = await db.select().from(warehouse_items).where(eq(warehouse_items.id, id));
    return result[0];
  }

  async createWarehouseItem(data: InsertWarehouseItem): Promise<WarehouseItem> {
    const id = nanoid();

    // Автогенерация SKU и barcode если не указаны
    const itemData = {
      ...data,
      id,
      sku: data.sku || `SKU-${id.substring(0, 8).toUpperCase()}`,
      barcode: data.barcode || id,
    };

    const result = await db.insert(warehouse_items).values(itemData).returning();
    await this.updateItemStatus(result[0].id);
    return result[0];
  }

  async updateWarehouseItem(id: string, data: Partial<InsertWarehouseItem>): Promise<WarehouseItem | undefined> {
    const result = await db.update(warehouse_items)
      .set({ ...data, updated_at: new Date() })
      .where(eq(warehouse_items.id, id))
      .returning();
    
    if (result[0]) {
      await this.updateItemStatus(id);
    }
    
    return result[0];
  }

  async deleteWarehouseItem(id: string): Promise<boolean> {
    // Check if item is used in any shipments
    const shipmentsWithItem = await db
      .select({
        shipment_id: shipment_items.shipment_id,
        status: shipments.status,
      })
      .from(shipment_items)
      .leftJoin(shipments, eq(shipment_items.shipment_id, shipments.id))
      .where(eq(shipment_items.item_id, id));

    if (shipmentsWithItem.length > 0) {
      // Check if any shipments are confirmed or cancelled
      const nonDraftShipments = shipmentsWithItem.filter(
        s => s.status === 'confirmed' || s.status === 'cancelled'
      );

      if (nonDraftShipments.length > 0) {
        throw new Error(
          'Невозможно удалить позицию: товар используется в подтвержденных или отмененных отгрузках. ' +
          `Найдено отгрузок: ${nonDraftShipments.length}`
        );
      }

      // Delete from draft shipments
      await db
        .delete(shipment_items)
        .where(eq(shipment_items.item_id, id));
    }

    // Delete transactions
    await db.delete(warehouse_transactions).where(eq(warehouse_transactions.item_id, id));

    // Delete the item itself
    const result = await db.delete(warehouse_items).where(eq(warehouse_items.id, id)).returning();
    return result.length > 0;
  }

  async createTransaction(data: InsertWarehouseTransaction): Promise<WarehouseTransaction> {
    const item = await this.getWarehouseItemById(data.item_id);

    if (!item) {
      throw new Error("Warehouse item not found");
    }

    const currentQuantity = parseFloat(item.quantity);
    const transactionQuantity = parseFloat(data.quantity);
    const newQuantity = data.type === "in"
      ? currentQuantity + transactionQuantity
      : currentQuantity - transactionQuantity;

    await this.updateWarehouseItem(data.item_id, { quantity: newQuantity.toString() });

    // Если это расход (out) и есть project_id, автоматически снять резервы для проекта
    if (data.type === "out" && data.project_id) {
      await this.autoReleaseReservations(data.item_id, data.project_id, transactionQuantity);
    }

    const result = await db.insert(warehouse_transactions).values(data).returning();
    return result[0];
  }

  /**
   * Автоматически снять резервы при выдаче товара в производство
   */
  private async autoReleaseReservations(itemId: string, projectId: string, quantity: number): Promise<void> {
    // Найти активные резервы для этого товара и проекта
    const reservations = await db
      .select()
      .from(warehouse_reservations)
      .where(
        and(
          eq(warehouse_reservations.item_id, itemId),
          eq(warehouse_reservations.project_id, projectId),
          sql`${warehouse_reservations.status} IN ('pending', 'confirmed')`
        )
      )
      .orderBy(asc(warehouse_reservations.created_at));

    let remainingQuantity = quantity;

    // Снять резервы по очереди
    for (const reservation of reservations) {
      if (remainingQuantity <= 0) break;

      const releaseQuantity = Math.min(reservation.quantity, remainingQuantity);

      if (releaseQuantity >= reservation.quantity) {
        // Снять резерв полностью
        await db
          .update(warehouse_reservations)
          .set({
            status: "released",
            released_at: new Date(),
            updated_at: new Date(),
          })
          .where(eq(warehouse_reservations.id, reservation.id));
      } else {
        // Частичное снятие - уменьшить количество резерва
        await db
          .update(warehouse_reservations)
          .set({
            quantity: reservation.quantity - releaseQuantity,
            updated_at: new Date(),
          })
          .where(eq(warehouse_reservations.id, reservation.id));
      }

      remainingQuantity -= releaseQuantity;
    }

    // Пересчитать reserved_quantity
    await this.recalculateReservedQuantity(itemId);
  }

  /**
   * Пересчитать зарезервированное количество для товара
   */
  private async recalculateReservedQuantity(itemId: string): Promise<void> {
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

    await db
      .update(warehouse_items)
      .set({
        reserved_quantity: reservedQuantity,
        updated_at: new Date(),
      })
      .where(eq(warehouse_items.id, itemId));
  }

  async getWarehouseTransactions(itemId: string): Promise<WarehouseTransaction[]> {
    return await db.select()
      .from(warehouse_transactions)
      .where(eq(warehouse_transactions.item_id, itemId))
      .orderBy(asc(warehouse_transactions.created_at));
  }

  async updateItemStatus(itemId: string): Promise<WarehouseItem | undefined> {
    const item = await this.getWarehouseItemById(itemId);

    if (!item) {
      return undefined;
    }

    // Учитываем зарезервированное количество при расчете доступного
    const quantity = parseFloat(item.quantity);
    const reservedQuantity = parseFloat(String(item.reserved_quantity || 0));
    const availableQuantity = quantity - reservedQuantity;
    const minStock = parseFloat(item.min_stock || "0");

    let newStatus: "normal" | "low" | "critical";

    if (availableQuantity <= 0) {
      newStatus = "critical";
    } else if (availableQuantity <= minStock) {
      newStatus = "low";
    } else {
      newStatus = "normal";
    }

    if (newStatus !== item.status) {
      const result = await db.update(warehouse_items)
        .set({ status: newStatus, updated_at: new Date() })
        .where(eq(warehouse_items.id, itemId))
        .returning();

      // Trigger notifications if tracking is enabled and status is low or critical
      if (result[0] && result[0].track_min_stock && (newStatus === "low" || newStatus === "critical")) {
        await this.triggerStockNotification(result[0], newStatus);
      }

      return result[0];
    }

    return item;
  }

  /**
   * Trigger stock notification for low or critical stock levels
   */
  private async triggerStockNotification(item: WarehouseItem, status: "low" | "critical"): Promise<void> {
    try {
      // Check if a notification was already sent recently
      const recentNotification = await notificationsRepository.getRecentNotification(item.id, status);

      if (recentNotification) {
        // Don't send duplicate notifications within 24 hours
        return;
      }

      // Get notification recipients (warehouse keepers and administrators)
      const recipients = await notificationsRepository.getNotificationRecipients();

      // Create notification for each recipient
      for (const userId of recipients) {
        await notificationsRepository.createNotification({
          item_id: item.id,
          item_name: item.name,
          status,
          quantity: parseFloat(item.quantity),
          min_stock: parseFloat(item.min_stock || "0"),
          user_id: userId,
          read: false,
        });
      }

      console.log(`📢 Stock notification sent for ${item.name} - Status: ${status}`);
    } catch (error) {
      console.error("Failed to send stock notification:", error);
      // Don't throw - notification failure shouldn't break the stock update
    }
  }

  /**
   * Создать упаковку (package)
   */
  async createPackage(data: {
    name: string;
    project_name: string;
    package_details: Array<{ name: string; quantity: number }>;
    location?: string;
    notes?: string;
  }): Promise<WarehouseItem> {
    const id = nanoid();

    const packageData = {
      id,
      name: data.name,
      sku: `PKG-${id.substring(0, 8).toUpperCase()}`,
      barcode: id,
      quantity: 1, // Упаковка - это 1 единица
      unit: "упак",
      category_id: null, // Упаковки будут без категории до миграции
      project_name: data.project_name,
      package_details: JSON.stringify(data.package_details),
      location: data.location || "",
      description: data.notes || "",
      price: 0,
      min_stock: 0,
      status: "normal",
      supplier: null,
      reserved_quantity: 0,
      project_id: null,
    };

    const result = await db.insert(warehouse_items).values(packageData as any).returning();
    return result[0];
  }
}

export const warehouseRepository = new WarehouseRepository();
