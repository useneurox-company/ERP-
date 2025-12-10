import { Router } from "express";
import { montageRepository } from "./repository";
import { insertMontageOrderSchema, insertMontageItemSchema, insertMontageStatusSchema, insertMontageItemStatusSchema, montage_statuses, montage_orders, montage_item_statuses, montage_items } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { db } from "../../db";
import { eq, asc, and, ne, inArray, isNotNull } from "drizzle-orm";
import { activityLogsRepository } from "../tasks/repository";

export const router = Router();

// === MONTAGE ORDERS ===

// GET /api/montage - Get all orders
router.get("/api/montage", async (req, res) => {
  try {
    const { status } = req.query;
    const orders = status
      ? await montageRepository.getOrdersByStatus(status as string)
      : await montageRepository.getAllOrders();
    res.json(orders);
  } catch (error) {
    console.error("Error fetching montage orders:", error);
    res.status(500).json({ error: "Failed to fetch montage orders" });
  }
});

// GET /api/montage/stats - Get statistics
router.get("/api/montage/stats", async (req, res) => {
  try {
    const stats = await montageRepository.getStats();
    res.json(stats);
  } catch (error) {
    console.error("Error fetching montage stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// === MONTAGE STATUSES (must be before /:id) ===

// GET /api/montage/statuses - Get all active statuses
router.get("/api/montage/statuses", async (req, res) => {
  try {
    const statuses = await db.select()
      .from(montage_statuses)
      .where(eq(montage_statuses.is_active, true))
      .orderBy(asc(montage_statuses.order));
    res.json(statuses);
  } catch (error) {
    console.error("Error fetching montage statuses:", error);
    res.status(500).json({ error: "Failed to fetch statuses" });
  }
});

// POST /api/montage/statuses - Create new status
router.post("/api/montage/statuses", async (req, res) => {
  try {
    const validationResult = insertMontageStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    // Get max order
    const maxOrderResult = await db.select({ maxOrder: montage_statuses.order })
      .from(montage_statuses)
      .orderBy(asc(montage_statuses.order));
    const maxOrder = maxOrderResult.length > 0
      ? Math.max(...maxOrderResult.map(r => r.maxOrder)) + 1
      : 0;

    const newStatus = await db.insert(montage_statuses)
      .values({
        ...validationResult.data,
        order: validationResult.data.order ?? maxOrder,
      })
      .returning();

    res.status(201).json(newStatus[0]);
  } catch (error) {
    console.error("Error creating montage status:", error);
    res.status(500).json({ error: "Failed to create status" });
  }
});

// PUT /api/montage/statuses/:id - Update status
router.put("/api/montage/statuses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertMontageStatusSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const updatedStatus = await db.update(montage_statuses)
      .set({
        ...validationResult.data,
        updated_at: new Date(),
      })
      .where(eq(montage_statuses.id, id))
      .returning();

    if (!updatedStatus[0]) {
      res.status(404).json({ error: "Status not found" });
      return;
    }

    res.json(updatedStatus[0]);
  } catch (error) {
    console.error("Error updating montage status:", error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// DELETE /api/montage/statuses/:id - Delete status
router.delete("/api/montage/statuses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if status is system
    const status = await db.select()
      .from(montage_statuses)
      .where(eq(montage_statuses.id, id));

    if (!status[0]) {
      res.status(404).json({ error: "Status not found" });
      return;
    }

    if (status[0].is_system) {
      res.status(400).json({ error: "Cannot delete system status" });
      return;
    }

    // Check if any orders use this status
    const ordersWithStatus = await db.select()
      .from(montage_orders)
      .where(eq(montage_orders.status, status[0].code));

    if (ordersWithStatus.length > 0) {
      res.status(400).json({
        error: `Cannot delete status: ${ordersWithStatus.length} order(s) use this status`
      });
      return;
    }

    await db.delete(montage_statuses)
      .where(eq(montage_statuses.id, id));

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting montage status:", error);
    res.status(500).json({ error: "Failed to delete status" });
  }
});

// === MONTAGE ITEM STATUSES ===

// GET /api/montage/item-statuses - Get all active item statuses
router.get("/api/montage/item-statuses", async (req, res) => {
  try {
    const statuses = await db.select()
      .from(montage_item_statuses)
      .where(eq(montage_item_statuses.is_active, true))
      .orderBy(asc(montage_item_statuses.order));
    res.json(statuses);
  } catch (error) {
    console.error("Error fetching montage item statuses:", error);
    res.status(500).json({ error: "Failed to fetch item statuses" });
  }
});

// POST /api/montage/item-statuses - Create new item status
router.post("/api/montage/item-statuses", async (req, res) => {
  try {
    const validationResult = insertMontageItemStatusSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    // Get max order
    const maxOrderResult = await db.select({ maxOrder: montage_item_statuses.order })
      .from(montage_item_statuses)
      .orderBy(asc(montage_item_statuses.order));
    const maxOrder = maxOrderResult.length > 0
      ? Math.max(...maxOrderResult.map(r => r.maxOrder)) + 1
      : 0;

    const newStatus = await db.insert(montage_item_statuses)
      .values({
        ...validationResult.data,
        order: validationResult.data.order ?? maxOrder,
      })
      .returning();

    res.status(201).json(newStatus[0]);
  } catch (error) {
    console.error("Error creating montage item status:", error);
    res.status(500).json({ error: "Failed to create item status" });
  }
});

// PUT /api/montage/item-statuses/:id - Update item status
router.put("/api/montage/item-statuses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertMontageItemStatusSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const updatedStatus = await db.update(montage_item_statuses)
      .set({
        ...validationResult.data,
        updated_at: new Date(),
      })
      .where(eq(montage_item_statuses.id, id))
      .returning();

    if (!updatedStatus[0]) {
      res.status(404).json({ error: "Item status not found" });
      return;
    }

    res.json(updatedStatus[0]);
  } catch (error) {
    console.error("Error updating montage item status:", error);
    res.status(500).json({ error: "Failed to update item status" });
  }
});

// DELETE /api/montage/item-statuses/:id - Delete item status
router.delete("/api/montage/item-statuses/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Check if status exists and is not system
    const status = await db.select()
      .from(montage_item_statuses)
      .where(eq(montage_item_statuses.id, id));

    if (!status[0]) {
      res.status(404).json({ error: "Item status not found" });
      return;
    }

    if (status[0].is_system) {
      res.status(400).json({ error: "Cannot delete system status" });
      return;
    }

    // Check if any items use this status
    const itemsWithStatus = await db.select()
      .from(montage_items)
      .where(eq(montage_items.status, status[0].code));

    if (itemsWithStatus.length > 0) {
      res.status(400).json({
        error: `Cannot delete status: ${itemsWithStatus.length} item(s) use this status`
      });
      return;
    }

    await db.delete(montage_item_statuses)
      .where(eq(montage_item_statuses.id, id));

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting montage item status:", error);
    res.status(500).json({ error: "Failed to delete item status" });
  }
});

// POST /api/montage/item-statuses/seed - Seed initial item statuses
router.post("/api/montage/item-statuses/seed", async (req, res) => {
  try {
    const defaultStatuses = [
      { code: 'warehouse', name: 'На складе', color: 'blue', bg_color: 'bg-blue-200', text_color: 'text-blue-700', order: 0, is_system: true },
      { code: 'on_site', name: 'На объекте', color: 'yellow', bg_color: 'bg-yellow-200', text_color: 'text-yellow-700', order: 1, is_system: false },
      { code: 'completed', name: 'Готово', color: 'green', bg_color: 'bg-green-200', text_color: 'text-green-700', order: 2, is_system: true },
    ];

    const results = [];
    for (const status of defaultStatuses) {
      // Check if status already exists
      const existing = await db.select().from(montage_item_statuses).where(eq(montage_item_statuses.code, status.code));
      if (existing.length === 0) {
        const newStatus = await db.insert(montage_item_statuses).values(status).returning();
        results.push(newStatus[0]);
      } else {
        results.push(existing[0]);
      }
    }

    res.json({ message: 'Item statuses seeded', statuses: results });
  } catch (error) {
    console.error("Error seeding item statuses:", error);
    res.status(500).json({ error: "Failed to seed item statuses" });
  }
});

// GET /api/montage/available/:projectId - Get available orders for project
router.get("/api/montage/available/:projectId", async (req, res) => {
  try {
    const { projectId } = req.params;
    const orders = await montageRepository.getAvailableOrdersForItem(projectId);
    res.json(orders);
  } catch (error) {
    console.error("Error fetching available orders:", error);
    res.status(500).json({ error: "Failed to fetch available orders" });
  }
});

// GET /api/montage/:id - Get order by ID
router.get("/api/montage/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const order = await montageRepository.getOrderById(id);

    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching montage order:", error);
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// POST /api/montage - Create new order
router.post("/api/montage", async (req, res) => {
  try {
    const { installer_ids, ...orderData } = req.body;
    const validationResult = insertMontageOrderSchema.safeParse(orderData);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newOrder = await montageRepository.createOrder(validationResult.data);

    // Set installers if provided
    if (installer_ids && Array.isArray(installer_ids) && installer_ids.length > 0) {
      await montageRepository.setOrderInstallers(newOrder.id, installer_ids);
    }

    // Log activity for project
    if (newOrder.project_id) {
      const userId = req.headers["x-user-id"] as string;
      try {
        await activityLogsRepository.logActivity({
          entity_type: "project",
          entity_id: newOrder.project_id,
          action_type: "montage_created",
          user_id: userId || null,
          description: `Создан заказ на монтаж "${newOrder.name || ''}"`,
        });
      } catch (logError) {
        console.error("Error logging montage creation activity:", logError);
      }
    }

    // Get full order with installers
    const fullOrder = await montageRepository.getOrderById(newOrder.id);
    res.status(201).json(fullOrder);
  } catch (error) {
    console.error("Error creating montage order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// PUT /api/montage/:id - Update order
router.put("/api/montage/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { installer_ids, ...orderData } = req.body;
    const validationResult = insertMontageOrderSchema.partial().safeParse(orderData);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const updatedOrder = await montageRepository.updateOrder(id, validationResult.data);

    if (!updatedOrder) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    // Update installers if provided
    if (installer_ids !== undefined && Array.isArray(installer_ids)) {
      await montageRepository.setOrderInstallers(id, installer_ids);
    }

    // Get full order with installers
    const fullOrder = await montageRepository.getOrderById(id);
    res.json(fullOrder);
  } catch (error) {
    console.error("Error updating montage order:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
});

// DELETE /api/montage/:id - Delete order
router.delete("/api/montage/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await montageRepository.deleteOrder(id);

    if (!deleted) {
      res.status(404).json({ error: "Order not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting montage order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

// === MONTAGE ITEMS ===

// GET /api/montage/items/assigned - Get assigned project_item_ids (already in active montage orders)
router.get("/api/montage/items/assigned", async (req, res) => {
  try {
    const { project_id } = req.query;

    if (!project_id) {
      res.status(400).json({ error: "project_id is required" });
      return;
    }

    // Находим все project_item_id которые уже в активных заказах на монтаж
    // (статус не 'cancelled' и не 'completed')
    const assignedItems = await db
      .select({ project_item_id: montage_items.project_item_id })
      .from(montage_items)
      .innerJoin(montage_orders, eq(montage_items.montage_order_id, montage_orders.id))
      .where(
        and(
          eq(montage_orders.project_id, project_id as string),
          ne(montage_orders.status, 'cancelled'),
          ne(montage_orders.status, 'completed'),
          isNotNull(montage_items.project_item_id)
        )
      );

    // Возвращаем массив ID
    const assignedIds = assignedItems
      .map(item => item.project_item_id)
      .filter((id): id is string => id !== null);

    res.json(assignedIds);
  } catch (error) {
    console.error("Error fetching assigned items:", error);
    res.status(500).json({ error: "Failed to fetch assigned items" });
  }
});

// GET /api/montage/:orderId/items - Get items for order
router.get("/api/montage/:orderId/items", async (req, res) => {
  try {
    const { orderId } = req.params;
    const items = await montageRepository.getOrderItems(orderId);
    res.json(items);
  } catch (error) {
    console.error("Error fetching montage items:", error);
    res.status(500).json({ error: "Failed to fetch items" });
  }
});

// POST /api/montage/:orderId/items - Add item to order
router.post("/api/montage/:orderId/items", async (req, res) => {
  try {
    const { orderId } = req.params;
    const validationResult = insertMontageItemSchema.safeParse({
      ...req.body,
      montage_order_id: orderId,
    });

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newItem = await montageRepository.addItemToOrder(validationResult.data);

    // Log activity for project
    const order = await montageRepository.getOrderById(orderId);
    if (order?.project_id) {
      const userId = req.headers["x-user-id"] as string;
      try {
        await activityLogsRepository.logActivity({
          entity_type: "project",
          entity_id: order.project_id,
          action_type: "montage_item_added",
          user_id: userId || null,
          description: `Добавлена позиция в заказ на монтаж "${order.name || ''}"`,
        });
      } catch (logError) {
        console.error("Error logging montage item addition activity:", logError);
      }
    }

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error adding montage item:", error);
    res.status(500).json({ error: "Failed to add item" });
  }
});

// PUT /api/montage/items/:itemId - Update item
router.put("/api/montage/items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const validationResult = insertMontageItemSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const updatedItem = await montageRepository.updateItem(itemId, validationResult.data);

    if (!updatedItem) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.json(updatedItem);
  } catch (error) {
    console.error("Error updating montage item:", error);
    res.status(500).json({ error: "Failed to update item" });
  }
});

// DELETE /api/montage/items/:itemId - Remove item from order
router.delete("/api/montage/items/:itemId", async (req, res) => {
  try {
    const { itemId } = req.params;
    const deleted = await montageRepository.removeItem(itemId);

    if (!deleted) {
      res.status(404).json({ error: "Item not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error removing montage item:", error);
    res.status(500).json({ error: "Failed to remove item" });
  }
});

// === SPECIAL ENDPOINT: Send item to montage ===

// POST /api/montage/send-to-montage - Create order with item or add to existing
router.post("/api/montage/send-to-montage", async (req, res) => {
  try {
    const { project_item_id, quantity, cost, montage_order_id, new_order } = req.body;

    if (!project_item_id) {
      res.status(400).json({ error: "project_item_id is required" });
      return;
    }

    let orderId = montage_order_id;

    // Create new order if needed
    if (new_order) {
      const orderValidation = insertMontageOrderSchema.safeParse(new_order);
      if (!orderValidation.success) {
        const errorMessage = fromZodError(orderValidation.error).toString();
        res.status(400).json({ error: errorMessage });
        return;
      }

      const newOrder = await montageRepository.createOrder(orderValidation.data);
      orderId = newOrder.id;
    }

    if (!orderId) {
      res.status(400).json({ error: "Either montage_order_id or new_order is required" });
      return;
    }

    // Add item to order
    const item = await montageRepository.addItemToOrder({
      montage_order_id: orderId,
      project_item_id,
      quantity: quantity || 1,
      cost: cost || null,
      status: 'pending',
      notes: null,
    });

    // Get full order with items
    const order = await montageRepository.getOrderById(orderId);

    res.status(201).json({ order, item });
  } catch (error) {
    console.error("Error sending to montage:", error);
    res.status(500).json({ error: "Failed to send to montage" });
  }
});
