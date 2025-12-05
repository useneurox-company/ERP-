import { Router } from "express";
import { montageRepository } from "./repository";
import { insertMontageOrderSchema, insertMontageItemSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

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
