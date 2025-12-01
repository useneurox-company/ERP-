import { db } from "../../db";
import { shipments, shipment_items, warehouse_items, warehouse_transactions } from "@shared/schema";
import type { Shipment, InsertShipment, ShipmentItem, InsertShipmentItem } from "@shared/schema";
import { eq, desc, and, or, sql } from "drizzle-orm";
import { genId } from "@shared/schema";

export class ShipmentsRepository {
  /**
   * Генерация номера накладной
   */
  async generateShipmentNumber(): Promise<string> {
    // Получаем последнюю накладную по всей базе
    const [lastShipment] = await db
      .select()
      .from(shipments)
      .orderBy(desc(shipments.created_at))
      .limit(1);

    let sequence = 1;
    if (lastShipment && lastShipment.shipment_number) {
      // Извлекаем номер из формата "ТН-X"
      const parts = lastShipment.shipment_number.split("-");
      if (parts.length === 2 && parts[0] === "ТН") {
        sequence = parseInt(parts[1]) + 1;
      }
    }

    return `ТН-${sequence}`;
  }

  /**
   * Создать накладную
   */
  async createShipment(data: InsertShipment): Promise<Shipment> {
    const shipmentNumber = await this.generateShipmentNumber();

    console.log('📦 Creating shipment with data:', JSON.stringify(data, null, 2));

    const valuesToInsert = {
      ...data,
      shipment_number: shipmentNumber,
      status: "draft",
    };

    console.log('📦 Values to insert:', JSON.stringify(valuesToInsert, null, 2));

    const [shipment] = await db
      .insert(shipments)
      .values(valuesToInsert)
      .returning();

    return shipment;
  }

  /**
   * Получить все накладные
   */
  async getAllShipments(status?: string): Promise<Shipment[]> {
    if (status) {
      return await db
        .select()
        .from(shipments)
        .where(eq(shipments.status, status))
        .orderBy(desc(shipments.created_at));
    }

    return await db
      .select()
      .from(shipments)
      .orderBy(desc(shipments.created_at));
  }

  /**
   * Получить накладную по ID с позициями
   */
  async getShipmentById(id: string): Promise<any> {
    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, id))
      .limit(1);

    if (!shipment) {
      return null;
    }

    const items = await db
      .select()
      .from(shipment_items)
      .where(eq(shipment_items.shipment_id, id));

    return {
      ...shipment,
      items,
    };
  }

  /**
   * Добавить позицию в накладную
   */
  async addItemToShipment(
    shipmentId: string,
    itemId: string,
    quantity: number
  ): Promise<ShipmentItem> {
    // Получаем данные товара
    const [item] = await db
      .select()
      .from(warehouse_items)
      .where(eq(warehouse_items.id, itemId))
      .limit(1);

    if (!item) {
      throw new Error("Товар не найден");
    }

    // Проверяем доступное количество
    const availableQty = parseFloat(item.quantity.toString());
    if (quantity > availableQty) {
      throw new Error(`Недостаточно товара на складе. Доступно: ${availableQty} ${item.unit}`);
    }

    // Добавляем позицию
    const [shipmentItem] = await db
      .insert(shipment_items)
      .values({
        shipment_id: shipmentId,
        item_id: itemId,
        item_name: item.name,
        item_sku: item.sku || "",
        quantity,
        unit: item.unit,
        is_package: !!item.package_details, // Упаковка определяется по наличию package_details
        package_details: item.package_details || null,
      })
      .returning();

    return shipmentItem;
  }

  /**
   * Удалить позицию из накладной
   */
  async removeItemFromShipment(shipmentId: string, itemId: string): Promise<void> {
    await db
      .delete(shipment_items)
      .where(
        and(
          eq(shipment_items.shipment_id, shipmentId),
          eq(shipment_items.id, itemId)
        )
      );
  }

  /**
   * Подтвердить отгрузку (списать товары)
   */
  async confirmShipment(shipmentId: string, userId: string): Promise<Shipment> {
    const shipmentData = await this.getShipmentById(shipmentId);
    if (!shipmentData) {
      throw new Error("Накладная не найдена");
    }

    if (shipmentData.status !== "draft") {
      throw new Error("Можно подтвердить только черновик накладной");
    }

    // Создаем транзакции "out" для всех позиций
    for (const item of shipmentData.items) {
      await db.insert(warehouse_transactions).values({
        item_id: item.item_id,
        type: "out",
        quantity: item.quantity.toString(),
        user_id: userId,
        notes: `Отгрузка по накладной ${shipmentData.shipment_number}`,
      });

      // Уменьшаем количество на складе
      const [warehouseItem] = await db
        .select()
        .from(warehouse_items)
        .where(eq(warehouse_items.id, item.item_id))
        .limit(1);

      if (warehouseItem) {
        const newQuantity =
          parseFloat(warehouseItem.quantity.toString()) - parseFloat(item.quantity.toString());

        await db
          .update(warehouse_items)
          .set({
            quantity: newQuantity,
            updated_at: new Date(),
          })
          .where(eq(warehouse_items.id, item.item_id));
      }
    }

    // Обновляем статус накладной
    const [updatedShipment] = await db
      .update(shipments)
      .set({
        status: "confirmed",
        confirmed_at: Math.floor(Date.now() / 1000), // Unix timestamp в секундах
        updated_at: new Date(),
      })
      .where(eq(shipments.id, shipmentId))
      .returning();

    return updatedShipment;
  }

  /**
   * Отменить отгрузку (возврат товаров)
   */
  async cancelShipment(shipmentId: string, userId: string): Promise<Shipment> {
    const shipmentData = await this.getShipmentById(shipmentId);
    if (!shipmentData) {
      throw new Error("Накладная не найдена");
    }

    if (shipmentData.status !== "confirmed") {
      throw new Error("Можно отменить только подтвержденную накладную");
    }

    // Создаем транзакции "in" для возврата товаров
    for (const item of shipmentData.items) {
      await db.insert(warehouse_transactions).values({
        item_id: item.item_id,
        type: "in",
        quantity: item.quantity.toString(),
        user_id: userId,
        notes: `Возврат по накладной ${shipmentData.shipment_number}`,
      });

      // Увеличиваем количество на складе
      const [warehouseItem] = await db
        .select()
        .from(warehouse_items)
        .where(eq(warehouse_items.id, item.item_id))
        .limit(1);

      if (warehouseItem) {
        const newQuantity =
          parseFloat(warehouseItem.quantity.toString()) + parseFloat(item.quantity.toString());

        await db
          .update(warehouse_items)
          .set({
            quantity: newQuantity,
            updated_at: new Date(),
          })
          .where(eq(warehouse_items.id, item.item_id));
      }
    }

    // Обновляем статус накладной
    const [updatedShipment] = await db
      .update(shipments)
      .set({
        status: "cancelled",
        cancelled_at: Math.floor(Date.now() / 1000), // Unix timestamp в секундах
        updated_at: new Date(),
      })
      .where(eq(shipments.id, shipmentId))
      .returning();

    return updatedShipment;
  }

  /**
   * Обновить накладную
   */
  async updateShipment(id: string, data: Partial<InsertShipment>): Promise<Shipment> {
    const [updated] = await db
      .update(shipments)
      .set({
        ...data,
        updated_at: new Date(),
      })
      .where(eq(shipments.id, id))
      .returning();

    return updated;
  }

  /**
   * Удалить накладную (только черновики и отменённые)
   */
  async deleteShipment(id: string): Promise<void> {
    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.id, id))
      .limit(1);

    if (!shipment) {
      throw new Error("Накладная не найдена");
    }

    if (shipment.status !== "draft" && shipment.status !== "cancelled") {
      throw new Error("Можно удалить только черновик или отмененную накладную");
    }

    await db.delete(shipments).where(eq(shipments.id, id));
  }
}

export const shipmentsRepository = new ShipmentsRepository();
