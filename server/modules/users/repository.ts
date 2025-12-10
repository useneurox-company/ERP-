import { db } from "../../db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import type { User, InsertUser } from "@shared/schema";
import { users } from "@shared/schema";
import { nanoid } from "nanoid";

export class UsersRepository {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    if (!result[0]) return undefined;
    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.username, username));
    if (!result[0]) return undefined;
    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const now = new Date();
    const id = nanoid();

    // Use Drizzle ORM insert for cross-database compatibility
    await db.insert(users).values({
      id,
      username: insertUser.username,
      password: hashedPassword,
      email: insertUser.email || null,
      full_name: insertUser.full_name || null,
      role_id: insertUser.role_id || null,
      phone: insertUser.phone || null,
      is_active: insertUser.is_active !== false,
      created_at: now,
      updated_at: now,
    });

    const result = await db.select().from(users).where(eq(users.id, id));
    if (!result[0]) throw new Error('Failed to create user');
    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
  }

  async validatePassword(username: string, password: string): Promise<boolean> {
    const result = await db.select().from(users).where(eq(users.username, username));
    if (!result[0]) return false;
    return await bcrypt.compare(password, result[0].password);
  }

  async getAllUsers(): Promise<User[]> {
    const result = await db.select().from(users);
    return result.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const now = new Date();
    const updateData: any = { updated_at: now };

    // Build update object
    if (data.email !== undefined) {
      updateData.email = data.email || null;
    }
    if (data.full_name !== undefined) {
      updateData.full_name = data.full_name || null;
    }
    if (data.phone !== undefined) {
      updateData.phone = data.phone || null;
    }
    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }
    if (data.can_view_financial !== undefined) {
      updateData.can_view_financial = data.can_view_financial;
    }

    // Use Drizzle ORM update for cross-database compatibility
    await db.update(users)
      .set(updateData)
      .where(eq(users.id, id));

    const result = await db.select().from(users).where(eq(users.id, id));
    if (!result[0]) return undefined;
    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id)).returning();
    return result.length > 0;
  }

  async getUsersWithRoles(): Promise<Array<User & { role?: any }>> {
    const allUsers = await this.getAllUsers();
    const { roles } = await import("@shared/schema");

    const usersWithRoles = await Promise.all(
      allUsers.map(async (user) => {
        if (!user.role_id) {
          return { ...user, role: null };
        }
        const roleResult = await db.select().from(roles).where(eq(roles.id, user.role_id));
        return {
          ...user,
          role: roleResult[0] || null,
        };
      })
    );

    return usersWithRoles;
  }

  async assignRole(userId: string, roleId: string | null): Promise<User | undefined> {
    const now = new Date();

    // Use Drizzle ORM update for cross-database compatibility
    await db.update(users)
      .set({ role_id: roleId, updated_at: now })
      .where(eq(users.id, userId));

    const result = await db.select().from(users).where(eq(users.id, userId));
    if (!result[0]) return undefined;
    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
  }

  async setUserStatus(userId: string, isActive: boolean): Promise<User | undefined> {
    const now = new Date();

    // Use Drizzle ORM update for cross-database compatibility
    await db.update(users)
      .set({ is_active: isActive, updated_at: now })
      .where(eq(users.id, userId));

    const result = await db.select().from(users).where(eq(users.id, userId));
    if (!result[0]) return undefined;
    const { password, ...userWithoutPassword } = result[0];
    return userWithoutPassword;
  }

  async getUserPermissions(roleId: string | null): Promise<any[]> {
    if (!roleId) return [];

    const { role_permissions } = await import("@shared/schema");
    const permissions = await db.select().from(role_permissions).where(eq(role_permissions.role_id, roleId));
    return permissions;
  }

  // User-specific permissions methods
  async getUserIndividualPermissions(userId: string): Promise<any[]> {
    const { user_permissions } = await import("@shared/schema");
    const permissions = await db.select().from(user_permissions).where(eq(user_permissions.user_id, userId));
    return permissions;
  }

  async getIndividualPermissionForModule(userId: string, module: string): Promise<any> {
    const { user_permissions } = await import("@shared/schema");
    const result = await db.select()
      .from(user_permissions)
      .where(sql`${user_permissions.user_id} = ${userId} AND ${user_permissions.module} = ${module}`);
    return result[0];
  }

  async upsertUserPermission(
    userId: string,
    module: string,
    permissions: {
      can_view?: boolean;
      can_create?: boolean;
      can_edit?: boolean;
      can_delete?: boolean;
      view_all?: boolean;
      hide_prices?: boolean;
    }
  ): Promise<any> {
    const { user_permissions } = await import("@shared/schema");
    const existing = await this.getIndividualPermissionForModule(userId, module);
    const now = new Date();

    if (existing) {
      // Update existing permission using Drizzle ORM
      await db.update(user_permissions)
        .set({
          can_view: permissions.can_view || false,
          can_create: permissions.can_create || false,
          can_edit: permissions.can_edit || false,
          can_delete: permissions.can_delete || false,
          view_all: permissions.view_all || false,
          hide_prices: permissions.hide_prices || false,
          updated_at: now,
        })
        .where(sql`${user_permissions.user_id} = ${userId} AND ${user_permissions.module} = ${module}`);
    } else {
      // Insert new permission using Drizzle ORM
      const { nanoid } = await import("nanoid");
      const id = nanoid();
      await db.insert(user_permissions).values({
        id,
        user_id: userId,
        module,
        can_view: permissions.can_view || false,
        can_create: permissions.can_create || false,
        can_edit: permissions.can_edit || false,
        can_delete: permissions.can_delete || false,
        view_all: permissions.view_all || false,
        hide_prices: permissions.hide_prices || false,
        created_at: now,
        updated_at: now,
      });
    }

    return await this.getIndividualPermissionForModule(userId, module);
  }

  async deleteUserPermission(userId: string, module: string): Promise<boolean> {
    const { user_permissions } = await import("@shared/schema");
    const result = await db.delete(user_permissions)
      .where(sql`${user_permissions.user_id} = ${userId} AND ${user_permissions.module} = ${module}`)
      .returning();
    return result.length > 0;
  }
}

export const usersRepository = new UsersRepository();
