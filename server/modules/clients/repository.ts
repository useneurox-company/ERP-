import { db } from "../../db";
import { eq, sql } from "drizzle-orm";
import type { Client, InsertClient } from "@shared/schema";
import { clients, deals, projects } from "@shared/schema";
import { nanoid } from "nanoid";

export class ClientsRepository {
  async getAll(): Promise<Client[]> {
    return await db.select().from(clients).orderBy(clients.name);
  }

  async getActive(): Promise<Client[]> {
    return await db.select().from(clients).where(eq(clients.is_active, true)).orderBy(clients.name);
  }

  async getById(id: string): Promise<Client | undefined> {
    const result = await db.select().from(clients).where(eq(clients.id, id));
    return result[0];
  }

  async getByIdWithStats(id: string): Promise<any> {
    const client = await this.getById(id);
    if (!client) return undefined;

    // Get deals count and total amount (match by client_name)
    const dealsStats = await db
      .select({
        count: sql<number>`count(*)::int`,
        total_amount: sql<number>`coalesce(sum(${deals.amount}), 0)::numeric`,
      })
      .from(deals)
      .where(sql`lower(${deals.client_name}) = lower(${client.name})`);

    // Get projects count (match by client_name)
    const projectsStats = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(projects)
      .where(sql`lower(${projects.client_name}) = lower(${client.name})`);

    return {
      ...client,
      deals_count: dealsStats[0]?.count || 0,
      total_amount: dealsStats[0]?.total_amount || 0,
      projects_count: projectsStats[0]?.count || 0,
    };
  }

  async create(data: InsertClient): Promise<Client> {
    const id = nanoid();
    const result = await db.insert(clients).values({ ...data, id }).returning();
    return result[0];
  }

  async update(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const result = await db.update(clients)
      .set({ ...data, updated_at: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(clients).where(eq(clients.id, id)).returning();
    return result.length > 0;
  }

  // Get client's deals (by client name match)
  async getClientDeals(clientId: string): Promise<any[]> {
    const client = await this.getById(clientId);
    if (!client) return [];

    return await db
      .select()
      .from(deals)
      .where(sql`lower(${deals.client_name}) = lower(${client.name})`)
      .orderBy(sql`${deals.created_at} DESC`);
  }

  // Get client's projects (by client name match)
  async getClientProjects(clientId: string): Promise<any[]> {
    const client = await this.getById(clientId);
    if (!client) return [];

    return await db
      .select()
      .from(projects)
      .where(sql`lower(${projects.client_name}) = lower(${client.name})`)
      .orderBy(sql`${projects.created_at} DESC`);
  }
}

export const clientsRepository = new ClientsRepository();
