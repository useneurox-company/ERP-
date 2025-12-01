import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

/**
 * Authentication middleware that sets req.user from X-User-Id header
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    // Get userId from header or query parameter
    // In production, this should come from JWT or session
    const userId = req.header("X-User-Id") || req.query.userId as string;

    if (!userId) {
      // Don't block the request, just don't set user
      return next();
    }

    const [user] = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      full_name: users.full_name,
      role_id: users.role_id,
      is_active: users.is_active,
    }).from(users).where(eq(users.id, userId));

    if (user && user.is_active) {
      req.user = user;
    }

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    // Don't block the request on error
    next();
  }
}

/**
 * Middleware to require authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: "Не авторизован" });
  }
  next();
}