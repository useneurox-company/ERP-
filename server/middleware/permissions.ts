import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users, roles, role_permissions, user_roles, stage_permissions, project_stages, stage_types, action_audit_log } from "@shared/schema";
import { eq, and, or } from "drizzle-orm";

export type PermissionType = "can_create_deals" | "can_edit_deals" | "can_delete_deals" | "can_delete_warehouse";
export type StageAction = "read" | "write" | "delete" | "start" | "complete";

export function checkPermission(permission: PermissionType) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get userId from header or query parameter
      // In production, this should come from authenticated session
      const userId = req.header("X-User-Id") || req.query.userId as string;

      if (!userId) {
        return res.status(401).json({
          error: "Не авторизован",
          message: "User ID not provided"
        });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(401).json({ error: "Пользователь не найден" });
      }

      // Admin user has all permissions
      if (user.username.toLowerCase() === 'admin') {
        (req as any).currentUser = user;
        return next();
      }

      // Check permissions through role_permissions table
      if (user.role_id) {
        // Determine module based on permission type
        const module = permission.includes('deals') ? 'sales' : 'warehouse';

        const [rolePermission] = await db
          .select()
          .from(role_permissions)
          .where(
            and(
              eq(role_permissions.role_id, user.role_id),
              eq(role_permissions.module, module)
            )
          );

        // Map permission names to role_permissions fields
        const permissionField = permission === 'can_create_deals' ? 'can_create' :
                               permission === 'can_edit_deals' ? 'can_edit' :
                               permission === 'can_delete_deals' ? 'can_delete' :
                               permission === 'can_delete_warehouse' ? 'can_delete' : null;

        if (rolePermission && permissionField && rolePermission[permissionField]) {
          // Store user in request for later use
          (req as any).currentUser = user;
          return next();
        }
      }

      // If no role or no permission, deny access
      return res.status(403).json({
        error: "Доступ запрещен",
        message: `У вас нет прав для этого действия`
      });
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ error: "Ошибка проверки прав доступа" });
    }
  };
}

/**
 * Middleware to check if user is admin or has warehouse permissions
 * For critical warehouse operations like confirming shipments
 */
export function checkAdminOnly() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.header("X-User-Id") || req.query.userId as string;

      if (!userId) {
        return res.status(401).json({
          error: "Не авторизован",
          message: "User ID not provided"
        });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));

      if (!user) {
        return res.status(401).json({ error: "Пользователь не найден" });
      }

      // Admin user by username has all permissions
      if (user.username.toLowerCase() === 'admin') {
        (req as any).currentUser = user;
        return next();
      }

      // Check if user has warehouse permissions through role
      if (user.role_id) {
        const [rolePermission] = await db
          .select()
          .from(role_permissions)
          .where(
            and(
              eq(role_permissions.role_id, user.role_id),
              eq(role_permissions.module, 'warehouse')
            )
          );

        // Allow if user has edit or delete permissions on warehouse
        if (rolePermission && (rolePermission.can_edit || rolePermission.can_delete)) {
          (req as any).currentUser = user;
          return next();
        }
      }

      return res.status(403).json({
        error: "Доступ запрещен",
        message: "У вас нет прав для этого действия"
      });
    } catch (error) {
      console.error("Admin check error:", error);
      res.status(500).json({ error: "Ошибка проверки прав доступа" });
    }
  };
}

/**
 * Check if user has permission to perform action on a stage
 * @param userId - User ID
 * @param stageId - Stage ID
 * @param action - Action to perform (read, write, delete, start, complete)
 * @returns true if user has permission, false otherwise
 */
export async function checkStagePermission(
  userId: string,
  stageId: string,
  action: StageAction
): Promise<{ hasPermission: boolean; reason?: string }> {
  try {
    // Get user
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) {
      return { hasPermission: false, reason: "Пользователь не найден" };
    }

    // Admin has all permissions
    if (user.username.toLowerCase() === 'admin') {
      return { hasPermission: true };
    }

    // Get stage with type info
    const [stage] = await db
      .select({
        stage: project_stages,
        stageType: stage_types,
      })
      .from(project_stages)
      .leftJoin(stage_types, eq(project_stages.stage_type_id, stage_types.id))
      .where(eq(project_stages.id, stageId));

    if (!stage || !stage.stageType) {
      return { hasPermission: false, reason: "Этап не найден" };
    }

    // If user is assignee of the stage, grant write access
    if (stage.stage.assignee_id === userId && (action === 'read' || action === 'write')) {
      return { hasPermission: true };
    }

    // Get user's roles for this project (and global roles)
    const userRolesList = await db
      .select()
      .from(user_roles)
      .where(
        and(
          eq(user_roles.user_id, userId),
          or(
            eq(user_roles.project_id, stage.stage.project_id),
            eq(user_roles.project_id, null as any) // global roles
          )
        )
      );

    if (userRolesList.length === 0) {
      return { hasPermission: false, reason: "У пользователя нет ролей в этом проекте" };
    }

    // Check permissions for each role
    for (const userRole of userRolesList) {
      const [permission] = await db
        .select()
        .from(stage_permissions)
        .where(
          and(
            eq(stage_permissions.role, userRole.role),
            eq(stage_permissions.stage_type_code, stage.stageType.code)
          )
        );

      if (permission) {
        const permissionField = `can_${action}` as keyof typeof permission;
        if (permission[permissionField]) {
          return { hasPermission: true };
        }
      }
    }

    return { hasPermission: false, reason: `Недостаточно прав для действия: ${action}` };
  } catch (error) {
    console.error("Stage permission check error:", error);
    return { hasPermission: false, reason: "Ошибка проверки прав" };
  }
}

/**
 * Middleware to check stage permissions
 * Usage: checkStagePermissionMiddleware('write')
 */
export function checkStagePermissionMiddleware(action: StageAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.header("X-User-Id") || req.query.userId as string;
      const stageId = req.params.stageId || req.body.stageId;

      if (!userId) {
        await logAuditAction(userId || 'unknown', action, 'stage', stageId, false, "User ID not provided", req);
        return res.status(401).json({
          error: "Не авторизован",
          message: "User ID not provided"
        });
      }

      if (!stageId) {
        await logAuditAction(userId, action, 'stage', stageId || 'unknown', false, "Stage ID not provided", req);
        return res.status(400).json({
          error: "Неверный запрос",
          message: "Stage ID not provided"
        });
      }

      const { hasPermission, reason } = await checkStagePermission(userId, stageId, action);

      if (!hasPermission) {
        await logAuditAction(userId, action, 'stage', stageId, false, reason, req);
        return res.status(403).json({
          error: "Доступ запрещен",
          message: reason || "У вас нет прав для этого действия"
        });
      }

      // Log successful action
      await logAuditAction(userId, action, 'stage', stageId, true, undefined, req);

      // Store user in request for later use
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      (req as any).currentUser = user;

      next();
    } catch (error) {
      console.error("Stage permission middleware error:", error);
      res.status(500).json({ error: "Ошибка проверки прав доступа" });
    }
  };
}

/**
 * Log audit action
 */
async function logAuditAction(
  userId: string,
  action: StageAction,
  entityType: string,
  entityId: string,
  success: boolean,
  reason: string | undefined,
  req: Request
) {
  try {
    await db.insert(action_audit_log).values({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      success,
      reason,
      ip_address: req.ip || req.socket.remoteAddress,
      user_agent: req.get('user-agent'),
    });
  } catch (error) {
    console.error("Failed to log audit action:", error);
    // Don't throw error, just log it
  }
}
