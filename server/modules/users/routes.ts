import { Router } from "express";
import { usersRepository } from "./repository";
import { insertUserSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { permissionsService } from "../permissions/service";
import { checkAdminOnly } from "../../middleware/permissions";

export const router = Router();

// GET /api/users - Get all users
router.get("/api/users", checkAdminOnly(), async (req, res) => {
  try {
    const includeRoles = req.query.includeRoles === 'true';

    if (includeRoles) {
      const users = await usersRepository.getUsersWithRoles();
      res.json(users);
    } else {
      const users = await usersRepository.getAllUsers();
      res.json(users);
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /api/users - Create new user
router.post("/api/users", checkAdminOnly(), async (req, res) => {
  try {
    const validationResult = insertUserSchema.safeParse(req.body);

    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }

    if (!validationResult.data.password || validationResult.data.password.trim() === "") {
      res.status(400).json({ error: "Password is required" });
      return;
    }

    const newUser = await usersRepository.createUser(validationResult.data);
    res.status(201).json(newUser);
  } catch (error: any) {
    console.error("Error creating user:", error);
    // Handle both SQLite and PostgreSQL unique constraint errors
    if (
      (error.message && error.message.includes("UNIQUE constraint failed")) || // SQLite
      (error.code === '23505') || // PostgreSQL unique_violation
      (error.message && error.message.includes("duplicate key value")) // PostgreSQL message
    ) {
      // Determine which field caused the error
      if (error.message && (error.message.includes("username") || error.detail?.includes("username"))) {
        res.status(400).json({ error: "Username already exists" });
      } else if (error.message && (error.message.includes("email") || error.detail?.includes("email"))) {
        res.status(400).json({ error: "Email already exists" });
      } else {
        res.status(400).json({ error: "User with this username or email already exists" });
      }
    } else {
      res.status(500).json({ error: "Failed to create user" });
    }
  }
});

// GET /api/users/:id - Get user by ID
router.get("/api/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await usersRepository.getUser(id);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get user permissions from role_permissions table
    const permissions = await usersRepository.getUserPermissions(user.role_id);

    // Check specific permissions for deals and projects
    // Support both 'sales' and 'deals' module names for compatibility
    const salesPerms = permissions.find(p => p.module === 'sales' || p.module === 'deals');
    const projectsPerms = permissions.find(p => p.module === 'projects');

    res.json({
      ...user,
      can_create_deals: salesPerms?.can_create || false,
      can_edit_deals: salesPerms?.can_edit || false,
      can_delete_deals: salesPerms?.can_delete || false,
      can_view_deals: salesPerms?.can_view || false,
      can_create_projects: projectsPerms?.can_create || false,
      can_edit_projects: projectsPerms?.can_edit || false,
      can_delete_projects: projectsPerms?.can_delete || false,
      can_view_projects: projectsPerms?.can_view || false,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// PUT /api/users/:id - Update user
router.put("/api/users/:id", checkAdminOnly(), async (req, res) => {
  try {
    const { id } = req.params;
    const validationResult = insertUserSchema.partial().safeParse(req.body);
    
    if (!validationResult.success) {
      const errorMessage = fromZodError(validationResult.error).toString();
      res.status(400).json({ error: errorMessage });
      return;
    }
    
    if (validationResult.data.password !== undefined && validationResult.data.password.trim() === "") {
      res.status(400).json({ error: "Password cannot be empty" });
      return;
    }
    
    const updatedUser = await usersRepository.updateUser(id, validationResult.data);
    
    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id - Delete user
router.delete("/api/users/:id", checkAdminOnly(), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await usersRepository.deleteUser(id);
    
    if (!deleted) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// PUT /api/users/:id/role - Assign role to user
router.put("/api/users/:id/role", checkAdminOnly(), async (req, res) => {
  try {
    const { id } = req.params;
    const { roleId } = req.body;

    if (roleId !== null && typeof roleId !== "string") {
      res.status(400).json({ error: "Invalid roleId" });
      return;
    }

    const updatedUser = await usersRepository.assignRole(id, roleId);

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error assigning role to user:", error);
    res.status(500).json({ error: "Failed to assign role" });
  }
});

// PUT /api/users/:id/status - Update user active status
router.put("/api/users/:id/status", checkAdminOnly(), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({ error: "isActive must be a boolean" });
      return;
    }

    const updatedUser = await usersRepository.setUserStatus(id, isActive);

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

// GET /api/users/:userId/permissions - Get all permissions (role + individual)
router.get("/api/users/:userId/permissions", checkAdminOnly(), async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await usersRepository.getUser(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Get role permissions
    const rolePermissions = await usersRepository.getUserPermissions(user.role_id);

    // Get individual permissions
    const individualPermissions = await usersRepository.getUserIndividualPermissions(userId);

    res.json({
      rolePermissions: rolePermissions || [],
      individualPermissions: individualPermissions || [],
    });
  } catch (error) {
    console.error("Error fetching user permissions:", error);
    res.status(500).json({ error: "Failed to fetch user permissions" });
  }
});

// PUT /api/users/:userId/permissions/:module - Set/update permission for module
router.put("/api/users/:userId/permissions/:module", checkAdminOnly(), async (req, res) => {
  try {
    const { userId, module } = req.params;
    const permissions = req.body;

    const user = await usersRepository.getUser(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updatedPermission = await usersRepository.upsertUserPermission(
      userId,
      module,
      permissions
    );

    res.json(updatedPermission);
  } catch (error) {
    console.error("Error updating user permission:", error);
    res.status(500).json({ error: "Failed to update user permission" });
  }
});

// DELETE /api/users/:userId/permissions/:module - Delete individual permission
router.delete("/api/users/:userId/permissions/:module", checkAdminOnly(), async (req, res) => {
  try {
    const { userId, module } = req.params;

    const user = await usersRepository.getUser(userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const deleted = await usersRepository.deleteUserPermission(userId, module);

    if (!deleted) {
      res.status(404).json({ error: "Permission not found" });
      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting user permission:", error);
    res.status(500).json({ error: "Failed to delete user permission" });
  }
});
