import { Router, Request, Response, NextFunction } from "express";
import { clientsRepository } from "./repository";
import { insertClientSchema } from "@shared/schema";

export const router = Router();

// GET /api/clients - get all clients (with optional ?active=true filter)
router.get("/api/clients", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.query;
    const clients = active === "true"
      ? await clientsRepository.getActive()
      : await clientsRepository.getAll();
    res.json(clients);
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id - get client by id with stats
router.get("/api/clients/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const client = await clientsRepository.getByIdWithStats(id);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id/deals - get client's deals
router.get("/api/clients/:id/deals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deals = await clientsRepository.getClientDeals(id);
    res.json(deals);
  } catch (error) {
    next(error);
  }
});

// GET /api/clients/:id/projects - get client's projects
router.get("/api/clients/:id/projects", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const projects = await clientsRepository.getClientProjects(id);
    res.json(projects);
  } catch (error) {
    next(error);
  }
});

// POST /api/clients - create new client
router.post("/api/clients", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const client = await clientsRepository.create(parsed.data);
    res.status(201).json(client);
  } catch (error) {
    next(error);
  }
});

// PUT /api/clients/:id - update client
router.put("/api/clients/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = insertClientSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const client = await clientsRepository.update(id, parsed.data);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json(client);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/clients/:id - delete client
router.delete("/api/clients/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await clientsRepository.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Client not found" });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});
