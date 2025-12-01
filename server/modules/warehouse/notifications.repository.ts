import { db } from "../../db";
import { stock_notifications, users, roles } from "@shared/schema";
import type { InsertStockNotification, StockNotification } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

export class NotificationsRepository {
  /**
   * Create a stock notification
   */
  async createNotification(data: InsertStockNotification): Promise<StockNotification> {
    const [notification] = await db
      .insert(stock_notifications)
      .values(data)
      .returning();

    return notification;
  }

  /**
   * Check if a notification was already sent for this item and status
   * Returns the last notification if it exists and was sent within the last 24 hours
   */
  async getRecentNotification(
    itemId: string,
    status: string
  ): Promise<StockNotification | null> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [notification] = await db
      .select()
      .from(stock_notifications)
      .where(
        and(
          eq(stock_notifications.item_id, itemId),
          eq(stock_notifications.status, status)
        )
      )
      .orderBy(desc(stock_notifications.created_at))
      .limit(1);

    if (notification && new Date(notification.created_at) > twentyFourHoursAgo) {
      return notification;
    }

    return null;
  }

  /**
   * Get all warehouse keepers and administrators
   * These are the users who should receive stock notifications
   */
  async getNotificationRecipients(): Promise<string[]> {
    // Find all users with warehouse keeper or administrator roles
    const warehouseUsers = await db
      .select({ user_id: users.id })
      .from(users)
      .innerJoin(roles, eq(users.role_id, roles.id))
      .where(
        // Looking for roles named "Warehouse Keeper", "Кладовщик", "Administrator", or "Администратор"
        // You can adjust these role names based on your actual role setup
        and(
          eq(users.is_active, true)
        )
      );

    // For now, return all active users since we don't have specific role filtering set up
    // In a production system, you'd filter by actual role names
    return warehouseUsers.map((u) => u.user_id);
  }

  /**
   * Get notification history for an item
   */
  async getItemNotifications(itemId: string): Promise<StockNotification[]> {
    return await db
      .select()
      .from(stock_notifications)
      .where(eq(stock_notifications.item_id, itemId))
      .orderBy(desc(stock_notifications.created_at));
  }

  /**
   * Get all unread notifications for a user
   */
  async getUnreadNotifications(userId: string): Promise<StockNotification[]> {
    return await db
      .select()
      .from(stock_notifications)
      .where(
        and(
          eq(stock_notifications.user_id, userId),
          eq(stock_notifications.read, false)
        )
      )
      .orderBy(desc(stock_notifications.created_at));
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await db
      .update(stock_notifications)
      .set({ read: true })
      .where(eq(stock_notifications.id, notificationId));
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string): Promise<void> {
    await db
      .update(stock_notifications)
      .set({ read: true })
      .where(eq(stock_notifications.user_id, userId));
  }
}

export const notificationsRepository = new NotificationsRepository();
