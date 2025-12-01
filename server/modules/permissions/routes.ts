import { Router } from "express";
import { permissionsService } from "./service";

export const router = Router();

// GET /api/permissions/me - Get current user's permissions
router.get("/api/permissions/me", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const userPermissions = await permissionsService.getUserPermissions(userId);

    if (!userPermissions) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Convert Map to object for JSON serialization
    const permissionsObj: any = {};
    userPermissions.permissions.forEach((value, key) => {
      permissionsObj[key] = value;
    });

    res.json({
      userId: userPermissions.userId,
      roleId: userPermissions.roleId,
      roleName: userPermissions.roleName,
      isActive: userPermissions.isActive,
      permissions: permissionsObj,
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({ error: "Failed to fetch permissions" });
  }
});

// GET /api/permissions/me/:module - Get current user's permissions for a specific module
router.get("/api/permissions/me/:module", async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] as string;
    const { module } = req.params;

    if (!userId) {
      res.status(401).json({ error: "User not authenticated" });
      return;
    }

    const modulePermissions = await permissionsService.getModulePermissions(userId, module);

    res.json(modulePermissions);
  } catch (error) {
    console.error("Error fetching module permissions:", error);
    res.status(500).json({ error: "Failed to fetch module permissions" });
  }
});
