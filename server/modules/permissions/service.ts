import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { users, roles, role_permissions, user_permissions } from "@shared/schema";
import type { RolePermission } from "@shared/schema";

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export interface UserPermissions {
  userId: string;
  roleId: string | null;
  roleName: string | null;
  isActive: boolean;
  permissions: Map<string, {
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    view_all: boolean;
    hide_prices: boolean;
  }>;
}

export class PermissionsService {
  /**
   * Get all permissions for a user (merges role permissions with individual overrides)
   */
  async getUserPermissions(userId: string): Promise<UserPermissions | null> {
    // Get user with role
    const userResult = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!userResult[0]) {
      return null;
    }

    const user = userResult[0];

    // Start with empty permissions map
    const permissionsMap = new Map();

    // If user has a role, load role permissions first
    let role = null;
    if (user.role_id) {
      const roleResult = await db.select()
        .from(roles)
        .where(eq(roles.id, user.role_id))
        .limit(1);

      if (roleResult[0]) {
        role = roleResult[0];

        // Get all role permissions
        const rolePermissionsResult = await db.select()
          .from(role_permissions)
          .where(eq(role_permissions.role_id, user.role_id));

        // Add role permissions to map
        for (const perm of rolePermissionsResult) {
          permissionsMap.set(perm.module, {
            can_view: perm.can_view,
            can_create: perm.can_create,
            can_edit: perm.can_edit,
            can_delete: perm.can_delete,
            view_all: perm.view_all,
            hide_prices: perm.hide_prices,
          });
        }
      }
    }

    // Get individual user permissions (these override role permissions)
    const individualPermissionsResult = await db.select()
      .from(user_permissions)
      .where(eq(user_permissions.user_id, userId));

    // Override role permissions with individual permissions
    for (const perm of individualPermissionsResult) {
      permissionsMap.set(perm.module, {
        can_view: perm.can_view,
        can_create: perm.can_create,
        can_edit: perm.can_edit,
        can_delete: perm.can_delete,
        view_all: perm.view_all,
        hide_prices: perm.hide_prices,
      });
    }

    return {
      userId: user.id,
      roleId: user.role_id,
      roleName: role?.name || null,
      isActive: user.is_active ?? true,
      permissions: permissionsMap,
    };
  }

  /**
   * Check if user has specific permission for a module
   */
  async hasPermission(
    userId: string,
    module: string,
    action: PermissionAction
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    if (!userPermissions || !userPermissions.isActive) {
      return false;
    }

    const modulePermissions = userPermissions.permissions.get(module);
    if (!modulePermissions) {
      return false;
    }

    switch (action) {
      case 'view':
        return modulePermissions.can_view;
      case 'create':
        return modulePermissions.can_create;
      case 'edit':
        return modulePermissions.can_edit;
      case 'delete':
        return modulePermissions.can_delete;
      default:
        return false;
    }
  }

  /**
   * Check if user can view all data for a module or only their own
   */
  async canViewAll(userId: string, module: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    if (!userPermissions || !userPermissions.isActive) {
      return false;
    }

    const modulePermissions = userPermissions.permissions.get(module);
    if (!modulePermissions) {
      return false;
    }

    return modulePermissions.view_all;
  }

  /**
   * Get the permission level for a module
   */
  async getModulePermissions(userId: string, module: string) {
    const userPermissions = await this.getUserPermissions(userId);

    if (!userPermissions || !userPermissions.isActive) {
      return {
        can_view: false,
        can_create: false,
        can_edit: false,
        can_delete: false,
        view_all: false,
        hide_prices: false,
      };
    }

    return userPermissions.permissions.get(module) || {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false,
      view_all: false,
      hide_prices: false,
    };
  }

  /**
   * Check if prices should be hidden for a user in a specific module
   */
  async shouldHidePrices(userId: string, module: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    if (!userPermissions || !userPermissions.isActive) {
      return false;
    }

    const modulePermissions = userPermissions.permissions.get(module);
    if (!modulePermissions) {
      return false;
    }

    return modulePermissions.hide_prices;
  }

  /**
   * Check if prices should be hidden for any module
   */
  async shouldHidePricesAny(userId: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);

    if (!userPermissions || !userPermissions.isActive) {
      return false;
    }

    // Check if hide_prices is true for any module
    for (const [_, perms] of userPermissions.permissions) {
      if (perms.hide_prices) {
        return true;
      }
    }

    return false;
  }
}

export const permissionsService = new PermissionsService();
