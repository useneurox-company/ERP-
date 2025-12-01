import type { Request, Response, NextFunction } from "express";
import { permissionsService, type PermissionAction } from "./service";

/**
 * Middleware to check if the authenticated user has permission to perform an action on a module
 */
export function requirePermission(module: string, action: PermissionAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const hasPermission = await permissionsService.hasPermission(userId, module, action);

      if (!hasPermission) {
        res.status(403).json({
          error: "Access denied",
          message: `You don't have permission to ${action} ${module}`
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Error checking permissions:", error);
      res.status(500).json({ error: "Failed to check permissions" });
    }
  };
}

/**
 * Middleware to check if user is active
 */
export function requireActiveUser() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (!userId) {
        res.status(401).json({ error: "User not authenticated" });
        return;
      }

      const userPermissions = await permissionsService.getUserPermissions(userId);

      if (!userPermissions || !userPermissions.isActive) {
        res.status(403).json({
          error: "Access denied",
          message: "Your account is inactive"
        });
        return;
      }

      next();
    } catch (error) {
      console.error("Error checking user status:", error);
      res.status(500).json({ error: "Failed to check user status" });
    }
  };
}

/**
 * Middleware to attach user permissions to request
 * This doesn't block the request, but makes permissions available to route handlers
 */
export function attachPermissions() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.headers["x-user-id"] as string;

      if (userId) {
        const userPermissions = await permissionsService.getUserPermissions(userId);
        (req as any).userPermissions = userPermissions;
      }

      next();
    } catch (error) {
      console.error("Error attaching permissions:", error);
      // Don't fail the request, just continue without permissions
      next();
    }
  };
}
