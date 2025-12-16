import { Router } from "express";
import { db } from "../../db";
import { users, roles, role_permissions } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export const router = Router();

// POST /api/auth/login - Авторизация пользователя
router.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Требуются логин и пароль" });
    }

    // Найти пользователя по username (case-insensitive)
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.username}) = LOWER(${username})`)
      .limit(1);

    if (!user) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    // Проверить активен ли пользователь
    if (!user.is_active) {
      return res.status(403).json({ message: "Пользователь заблокирован" });
    }

    // Проверить пароль
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Неверный логин или пароль" });
    }

    // Получить роль и права пользователя
    let userRole = null;
    let permissions: any[] = [];

    if (user.role_id) {
      const [role] = await db
        .select()
        .from(roles)
        .where(eq(roles.id, user.role_id))
        .limit(1);

      if (role) {
        userRole = role;

        // Получить права роли
        permissions = await db
          .select()
          .from(role_permissions)
          .where(eq(role_permissions.role_id, user.role_id));
      }
    }

    // Вернуть данные пользователя (без пароля)
    const { password: _, ...userWithoutPassword } = user;

    // Map permissions to boolean flags for frontend
    // Support both 'sales' and 'deals' module names for compatibility
    const salesPerms = permissions.find(p => p.module === 'sales' || p.module === 'deals');
    const projectsPerms = permissions.find(p => p.module === 'projects');

    res.json({
      user: {
        ...userWithoutPassword,
        can_create_deals: salesPerms?.can_create || false,
        can_edit_deals: salesPerms?.can_edit || false,
        can_delete_deals: salesPerms?.can_delete || false,
        can_view_deals: salesPerms?.can_view || false,
        can_create_projects: projectsPerms?.can_create || false,
        can_edit_projects: projectsPerms?.can_edit || false,
        can_delete_projects: projectsPerms?.can_delete || false,
        can_view_projects: projectsPerms?.can_view || false,
      },
      role: userRole,
      permissions: permissions,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Ошибка авторизации" });
  }
});

// POST /api/auth/logout - Выход из системы (для будущего расширения)
router.post("/api/auth/logout", async (req, res) => {
  res.json({ message: "Выход выполнен успешно" });
});
