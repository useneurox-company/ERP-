import { db } from "../../db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import type { MontageOrder, InsertMontageOrder, MontageItem, InsertMontageItem } from "@shared/schema";
import { montage_orders, montage_items, project_items, projects, installers, montage_order_installers } from "@shared/schema";

export class MontageRepository {
  // === MONTAGE ORDERS ===

  async getAllOrders(): Promise<any[]> {
    const orders = await db.select({
      id: montage_orders.id,
      order_number: montage_orders.order_number,
      project_id: montage_orders.project_id,
      address: montage_orders.address,
      client_name: montage_orders.client_name,
      client_phone: montage_orders.client_phone,
      scheduled_date: montage_orders.scheduled_date,
      scheduled_time: montage_orders.scheduled_time,
      deadline: montage_orders.deadline,
      status: montage_orders.status,
      installer_id: montage_orders.installer_id,
      total_cost: montage_orders.total_cost,
      notes: montage_orders.notes,
      created_at: montage_orders.created_at,
      updated_at: montage_orders.updated_at,
      project_name: projects.name,
      installer_name: installers.name,
    })
    .from(montage_orders)
    .leftJoin(projects, eq(montage_orders.project_id, projects.id))
    .leftJoin(installers, eq(montage_orders.installer_id, installers.id))
    .orderBy(desc(montage_orders.scheduled_date));

    // Get items count and installers for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        const orderInstallers = await this.getOrderInstallers(order.id);
        return {
          ...order,
          items,
          items_count: items.length,
          installers: orderInstallers,
        };
      })
    );

    return ordersWithItems;
  }

  async getOrdersByStatus(status: string): Promise<any[]> {
    const orders = await db.select({
      id: montage_orders.id,
      order_number: montage_orders.order_number,
      project_id: montage_orders.project_id,
      address: montage_orders.address,
      client_name: montage_orders.client_name,
      client_phone: montage_orders.client_phone,
      scheduled_date: montage_orders.scheduled_date,
      scheduled_time: montage_orders.scheduled_time,
      deadline: montage_orders.deadline,
      status: montage_orders.status,
      installer_id: montage_orders.installer_id,
      total_cost: montage_orders.total_cost,
      notes: montage_orders.notes,
      created_at: montage_orders.created_at,
      updated_at: montage_orders.updated_at,
      project_name: projects.name,
      installer_name: installers.name,
    })
    .from(montage_orders)
    .leftJoin(projects, eq(montage_orders.project_id, projects.id))
    .leftJoin(installers, eq(montage_orders.installer_id, installers.id))
    .where(eq(montage_orders.status, status))
    .orderBy(desc(montage_orders.scheduled_date));

    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const items = await this.getOrderItems(order.id);
        const orderInstallers = await this.getOrderInstallers(order.id);
        return {
          ...order,
          items,
          items_count: items.length,
          installers: orderInstallers,
        };
      })
    );

    return ordersWithItems;
  }

  async getOrderById(id: string): Promise<any | undefined> {
    const result = await db.select({
      id: montage_orders.id,
      order_number: montage_orders.order_number,
      project_id: montage_orders.project_id,
      address: montage_orders.address,
      client_name: montage_orders.client_name,
      client_phone: montage_orders.client_phone,
      scheduled_date: montage_orders.scheduled_date,
      scheduled_time: montage_orders.scheduled_time,
      deadline: montage_orders.deadline,
      status: montage_orders.status,
      installer_id: montage_orders.installer_id,
      total_cost: montage_orders.total_cost,
      notes: montage_orders.notes,
      created_at: montage_orders.created_at,
      updated_at: montage_orders.updated_at,
      project_name: projects.name,
      installer_name: installers.name,
    })
    .from(montage_orders)
    .leftJoin(projects, eq(montage_orders.project_id, projects.id))
    .leftJoin(installers, eq(montage_orders.installer_id, installers.id))
    .where(eq(montage_orders.id, id));

    if (!result[0]) return undefined;

    const items = await this.getOrderItems(id);
    const orderInstallers = await this.getOrderInstallers(id);
    return {
      ...result[0],
      items,
      installers: orderInstallers,
    };
  }

  async createOrder(data: InsertMontageOrder): Promise<MontageOrder> {
    // Generate order number
    const countResult = await db.select({ count: sql<number>`count(*)` }).from(montage_orders);
    const count = Number(countResult[0]?.count || 0);
    const orderNumber = `M-${String(count + 1).padStart(3, '0')}`;

    const result = await db.insert(montage_orders).values({
      ...data,
      order_number: orderNumber,
    }).returning();
    return result[0];
  }

  async updateOrder(id: string, data: Partial<InsertMontageOrder>): Promise<MontageOrder | undefined> {
    const result = await db.update(montage_orders)
      .set({ ...data, updated_at: new Date() })
      .where(eq(montage_orders.id, id))
      .returning();
    return result[0];
  }

  async deleteOrder(id: string): Promise<boolean> {
    const result = await db.delete(montage_orders).where(eq(montage_orders.id, id)).returning();
    return result.length > 0;
  }

  // === MONTAGE ITEMS ===

  async getOrderItems(orderId: string): Promise<any[]> {
    return await db.select({
      id: montage_items.id,
      montage_order_id: montage_items.montage_order_id,
      project_item_id: montage_items.project_item_id,
      quantity: montage_items.quantity,
      status: montage_items.status,
      cost: montage_items.cost,
      notes: montage_items.notes,
      created_at: montage_items.created_at,
      updated_at: montage_items.updated_at,
      // Project item details
      item_name: project_items.name,
      item_article: project_items.article,
      item_quantity: project_items.quantity,
      item_price: project_items.price,
      item_image_url: project_items.image_url,
      project_id: project_items.project_id,
    })
    .from(montage_items)
    .leftJoin(project_items, eq(montage_items.project_item_id, project_items.id))
    .where(eq(montage_items.montage_order_id, orderId));
  }

  async addItemToOrder(data: InsertMontageItem): Promise<MontageItem> {
    const result = await db.insert(montage_items).values(data).returning();
    return result[0];
  }

  async updateItem(id: string, data: Partial<InsertMontageItem>): Promise<MontageItem | undefined> {
    const result = await db.update(montage_items)
      .set({ ...data, updated_at: new Date() })
      .where(eq(montage_items.id, id))
      .returning();
    return result[0];
  }

  async removeItem(id: string): Promise<boolean> {
    const result = await db.delete(montage_items).where(eq(montage_items.id, id)).returning();
    return result.length > 0;
  }

  // === STATISTICS ===

  async getStats(): Promise<any> {
    const allOrders = await db.select().from(montage_orders);

    const stats = {
      total: allOrders.length,
      planned: allOrders.filter(o => o.status === 'planned').length,
      in_progress: allOrders.filter(o => o.status === 'in_progress').length,
      completed: allOrders.filter(o => o.status === 'completed').length,
      cancelled: allOrders.filter(o => o.status === 'cancelled').length,
      total_cost: allOrders.reduce((sum, o) => sum + (o.total_cost || 0), 0),
    };

    return stats;
  }

  // === AVAILABLE ORDERS FOR PROJECT ITEM ===

  async getAvailableOrdersForItem(projectId: string): Promise<any[]> {
    // Get orders that are planned and belong to the same project (or have no items yet)
    return await db.select({
      id: montage_orders.id,
      order_number: montage_orders.order_number,
      address: montage_orders.address,
      scheduled_date: montage_orders.scheduled_date,
      status: montage_orders.status,
    })
    .from(montage_orders)
    .where(
      and(
        eq(montage_orders.status, 'planned'),
        eq(montage_orders.project_id, projectId)
      )
    )
    .orderBy(desc(montage_orders.scheduled_date));
  }

  // === ORDER INSTALLERS (many-to-many) ===

  async getOrderInstallers(orderId: string): Promise<any[]> {
    return await db.select({
      id: montage_order_installers.id,
      installer_id: montage_order_installers.installer_id,
      installer_name: installers.name,
      installer_phone: installers.phone,
      installer_specialization: installers.specialization,
      installer_hourly_rate: installers.hourly_rate,
    })
    .from(montage_order_installers)
    .leftJoin(installers, eq(montage_order_installers.installer_id, installers.id))
    .where(eq(montage_order_installers.montage_order_id, orderId));
  }

  async setOrderInstallers(orderId: string, installerIds: string[]): Promise<void> {
    // Remove existing installers
    await db.delete(montage_order_installers)
      .where(eq(montage_order_installers.montage_order_id, orderId));

    // Add new installers
    if (installerIds.length > 0) {
      const values = installerIds.map(installerId => ({
        montage_order_id: orderId,
        installer_id: installerId,
      }));
      await db.insert(montage_order_installers).values(values);
    }
  }

  async addInstallerToOrder(orderId: string, installerId: string): Promise<void> {
    await db.insert(montage_order_installers).values({
      montage_order_id: orderId,
      installer_id: installerId,
    });
  }

  async removeInstallerFromOrder(orderId: string, installerId: string): Promise<void> {
    await db.delete(montage_order_installers)
      .where(
        and(
          eq(montage_order_installers.montage_order_id, orderId),
          eq(montage_order_installers.installer_id, installerId)
        )
      );
  }
}

export const montageRepository = new MontageRepository();
