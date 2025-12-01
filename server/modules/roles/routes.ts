import { Router } from "express";
import { rolesRepository } from "./repository";
import { insertRoleSchema, insertRolePermissionSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";

export const router = Router();

// GET /api/roles - Get all roles
router.get("/api/roles", async (req, res) => {
  try {
    const roles = await rolesRepository.getAllRoles();
    res.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
});

// GET /api/roles/:id - Get role by ID
router.get("/api/roles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const role = await rolesRepository.getRoleById(id);

    if (!role) {
      res.status(404).json({ error: "Role not found" });
      return;
    }

    res.json(role);
  } catch (error) {
    console.error("Error fetching role:", error);
    res.status(500).json({ error: "Failed to fetch role" });
  }
});

// GET /api/roles/:id/permissions - Get role permissions
router.get("/api/roles/:id/permissions", async (req, res) => {
  try {
    const { id } = req.params;
    const roleWithPermissions = await rolesRepository.getRoleWithPermissions(id);

    if (!roleWithPermissions) {
      res.status(404).json({ error: "Role not found" });
      return;
    }

    res.json(roleWithPermissions);
  } catch (error) {
    console.error("Error fetching role permissions:", error);
    res.status(500).json({ error: "Failed to fetch role permissions" });
  }
});

// POST /api/roles - Create new role
router.post("/api/roles", async (req, res) => {
  try {
    const validationResult = insertRoleSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newRole = await rolesRepository.createRole(validationResult.data);
    res.status(201).json(newRole);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(500).json({ error: "Failed to create role" });
  }
});

// PUT /api/roles/:id - Update role
router.put("/api/roles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertRoleSchema.partial().safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const updatedRole = await rolesRepository.updateRole(id, validationResult.data);

    if (!updatedRole) {
      res.status(404).json({ error: "Role not found" });
      return;
    }

    res.json(updatedRole);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Failed to update role" });
  }
});

// DELETE /api/roles/:id - Delete role
router.delete("/api/roles/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await rolesRepository.deleteRole(id);

    if (!deleted) {
      res.status(404).json({ error: "Role not found" });
      return;
    }

    res.status(204).send();
  } catch (error: any) {
    console.error("Error deleting role:", error);
    if (error.message === 'Cannot delete system role') {
      res.status(400).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Failed to delete role" });
    }
  }
});

// PUT /api/roles/:roleId/permissions/:module - Update permissions for a module
router.put("/api/roles/:roleId/permissions/:module", async (req, res) => {
  try {
    const { roleId, module } = req.params;
    const { can_view, can_create, can_edit, can_delete, view_all } = req.body;

    const permissions: any = {};
    if (typeof can_view === "boolean") permissions.can_view = can_view;
    if (typeof can_create === "boolean") permissions.can_create = can_create;
    if (typeof can_edit === "boolean") permissions.can_edit = can_edit;
    if (typeof can_delete === "boolean") permissions.can_delete = can_delete;
    if (typeof view_all === "boolean") permissions.view_all = view_all;

    if (Object.keys(permissions).length === 0) {
      res.status(400).json({ error: "No valid permissions provided" });
      return;
    }

    const updatedPermission = await rolesRepository.upsertPermission(
      roleId,
      module,
      permissions
    );

    res.json(updatedPermission);
  } catch (error) {
    console.error("Error updating role permissions:", error);
    res.status(500).json({ error: "Failed to update permissions" });
  }
});

// POST /api/roles/:roleId/permissions - Create permission for role
router.post("/api/roles/:roleId/permissions", async (req, res) => {
  try {
    const { roleId } = req.params;
    const validationResult = insertRolePermissionSchema.safeParse({
      ...req.body,
      role_id: roleId,
    });

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    const newPermission = await rolesRepository.createPermission(validationResult.data);
    res.status(201).json(newPermission);
  } catch (error) {
    console.error("Error creating permission:", error);
    res.status(500).json({ error: "Failed to create permission" });
  }
});
