import { db } from "../../db";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import type {
  SipTrunk, InsertSipTrunk,
  CallScript, InsertCallScript,
  ElevenLabsAgent, InsertElevenLabsAgent,
  CallCampaign, InsertCallCampaign,
  CampaignContact, InsertCampaignContact,
  CallLog, InsertCallLog,
  CallAction, InsertCallAction
} from "@shared/schema";
import {
  sip_trunks,
  call_scripts,
  elevenlabs_agents,
  call_campaigns,
  campaign_contacts,
  call_logs,
  call_actions
} from "@shared/schema";
import { nanoid } from "nanoid";

// ============ SIP Trunks Repository ============
export class SipTrunksRepository {
  async getAll(): Promise<SipTrunk[]> {
    return await db.select().from(sip_trunks).orderBy(desc(sip_trunks.created_at));
  }

  async getActive(): Promise<SipTrunk[]> {
    return await db.select().from(sip_trunks)
      .where(eq(sip_trunks.is_active, true))
      .orderBy(sip_trunks.name);
  }

  async getById(id: string): Promise<SipTrunk | undefined> {
    const result = await db.select().from(sip_trunks).where(eq(sip_trunks.id, id));
    return result[0];
  }

  async getByElevenLabsTrunkId(trunkId: string): Promise<SipTrunk | undefined> {
    const result = await db.select().from(sip_trunks)
      .where(eq(sip_trunks.elevenlabs_trunk_id, trunkId));
    return result[0];
  }

  async create(data: InsertSipTrunk): Promise<SipTrunk> {
    const id = nanoid();
    const result = await db.insert(sip_trunks).values({ ...data, id }).returning();
    return result[0];
  }

  async update(id: string, data: Partial<InsertSipTrunk>): Promise<SipTrunk | undefined> {
    const result = await db.update(sip_trunks)
      .set({ ...data, updated_at: new Date() })
      .where(eq(sip_trunks.id, id))
      .returning();
    return result[0];
  }

  async updateConnectionStatus(id: string, status: string): Promise<void> {
    await db.update(sip_trunks)
      .set({
        connection_status: status,
        last_connected_at: status === 'connected' ? new Date() : undefined,
        updated_at: new Date(),
      })
      .where(eq(sip_trunks.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(sip_trunks).where(eq(sip_trunks.id, id)).returning();
    return result.length > 0;
  }
}

// ============ Call Scripts Repository ============
export class CallScriptsRepository {
  async getAll(): Promise<CallScript[]> {
    return await db.select().from(call_scripts).orderBy(desc(call_scripts.created_at));
  }

  async getActive(): Promise<CallScript[]> {
    return await db.select().from(call_scripts)
      .where(eq(call_scripts.is_active, true))
      .orderBy(call_scripts.name);
  }

  async getById(id: string): Promise<CallScript | undefined> {
    const result = await db.select().from(call_scripts).where(eq(call_scripts.id, id));
    return result[0];
  }

  async create(data: InsertCallScript): Promise<CallScript> {
    const id = nanoid();
    const result = await db.insert(call_scripts).values({ ...data, id }).returning();
    return result[0];
  }

  async update(id: string, data: Partial<InsertCallScript>): Promise<CallScript | undefined> {
    const result = await db.update(call_scripts)
      .set({ ...data, updated_at: new Date() })
      .where(eq(call_scripts.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(call_scripts).where(eq(call_scripts.id, id)).returning();
    return result.length > 0;
  }
}

// ============ ElevenLabs Agents Repository ============
export class ElevenLabsAgentsRepository {
  async getAll(): Promise<ElevenLabsAgent[]> {
    return await db.select().from(elevenlabs_agents).orderBy(desc(elevenlabs_agents.created_at));
  }

  async getActive(): Promise<ElevenLabsAgent[]> {
    return await db.select().from(elevenlabs_agents)
      .where(eq(elevenlabs_agents.is_active, true))
      .orderBy(elevenlabs_agents.name);
  }

  async getById(id: string): Promise<ElevenLabsAgent | undefined> {
    const result = await db.select().from(elevenlabs_agents).where(eq(elevenlabs_agents.id, id));
    return result[0];
  }

  async getByElevenLabsId(elevenLabsAgentId: string): Promise<ElevenLabsAgent | undefined> {
    const result = await db.select().from(elevenlabs_agents)
      .where(eq(elevenlabs_agents.elevenlabs_agent_id, elevenLabsAgentId));
    return result[0];
  }

  async create(data: InsertElevenLabsAgent): Promise<ElevenLabsAgent> {
    const id = nanoid();
    const result = await db.insert(elevenlabs_agents).values({ ...data, id }).returning();
    return result[0];
  }

  async update(id: string, data: Partial<InsertElevenLabsAgent>): Promise<ElevenLabsAgent | undefined> {
    const result = await db.update(elevenlabs_agents)
      .set({ ...data, updated_at: new Date() })
      .where(eq(elevenlabs_agents.id, id))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(elevenlabs_agents).where(eq(elevenlabs_agents.id, id)).returning();
    return result.length > 0;
  }
}

// ============ Call Campaigns Repository ============
export class CallCampaignsRepository {
  async getAll(): Promise<CallCampaign[]> {
    return await db.select().from(call_campaigns).orderBy(desc(call_campaigns.created_at));
  }

  async getByStatus(status: string): Promise<CallCampaign[]> {
    return await db.select().from(call_campaigns)
      .where(eq(call_campaigns.status, status))
      .orderBy(desc(call_campaigns.created_at));
  }

  async getById(id: string): Promise<CallCampaign | undefined> {
    const result = await db.select().from(call_campaigns).where(eq(call_campaigns.id, id));
    return result[0];
  }

  async getByIdWithStats(id: string): Promise<any> {
    const campaign = await this.getById(id);
    if (!campaign) return undefined;

    // Get contacts stats
    const contactsStats = await db
      .select({
        total: sql<number>`count(*)::int`,
        pending: sql<number>`count(*) filter (where ${campaign_contacts.status} = 'pending')::int`,
        completed: sql<number>`count(*) filter (where ${campaign_contacts.status} = 'completed')::int`,
        failed: sql<number>`count(*) filter (where ${campaign_contacts.status} = 'failed')::int`,
      })
      .from(campaign_contacts)
      .where(eq(campaign_contacts.campaign_id, id));

    return {
      ...campaign,
      contacts_stats: contactsStats[0] || { total: 0, pending: 0, completed: 0, failed: 0 },
    };
  }

  async create(data: InsertCallCampaign): Promise<CallCampaign> {
    const id = nanoid();
    const result = await db.insert(call_campaigns).values({ ...data, id }).returning();
    return result[0];
  }

  async update(id: string, data: Partial<InsertCallCampaign>): Promise<CallCampaign | undefined> {
    const result = await db.update(call_campaigns)
      .set({ ...data, updated_at: new Date() })
      .where(eq(call_campaigns.id, id))
      .returning();
    return result[0];
  }

  async updateStats(id: string): Promise<void> {
    // Count contacts
    const stats = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where ${campaign_contacts.status} = 'completed')::int`,
        failed: sql<number>`count(*) filter (where ${campaign_contacts.status} = 'failed')::int`,
      })
      .from(campaign_contacts)
      .where(eq(campaign_contacts.campaign_id, id));

    // Count successful calls
    const callStats = await db
      .select({
        successful: sql<number>`count(*) filter (where ${call_logs.outcome} = 'success')::int`,
      })
      .from(call_logs)
      .where(eq(call_logs.campaign_id, id));

    await db.update(call_campaigns)
      .set({
        total_contacts: stats[0]?.total || 0,
        completed_calls: stats[0]?.completed || 0,
        failed_calls: stats[0]?.failed || 0,
        successful_calls: callStats[0]?.successful || 0,
        updated_at: new Date(),
      })
      .where(eq(call_campaigns.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(call_campaigns).where(eq(call_campaigns.id, id)).returning();
    return result.length > 0;
  }
}

// ============ Campaign Contacts Repository ============
export class CampaignContactsRepository {
  async getByCampaign(campaignId: string): Promise<CampaignContact[]> {
    return await db.select().from(campaign_contacts)
      .where(eq(campaign_contacts.campaign_id, campaignId))
      .orderBy(campaign_contacts.created_at);
  }

  async getById(id: string): Promise<CampaignContact | undefined> {
    const result = await db.select().from(campaign_contacts).where(eq(campaign_contacts.id, id));
    return result[0];
  }

  async getNextPending(campaignId: string): Promise<CampaignContact | undefined> {
    const result = await db.select().from(campaign_contacts)
      .where(and(
        eq(campaign_contacts.campaign_id, campaignId),
        eq(campaign_contacts.status, 'pending')
      ))
      .orderBy(campaign_contacts.scheduled_at)
      .limit(1);
    return result[0];
  }

  async create(data: InsertCampaignContact): Promise<CampaignContact> {
    const id = nanoid();
    const result = await db.insert(campaign_contacts).values({ ...data, id }).returning();
    return result[0];
  }

  async createMany(contacts: InsertCampaignContact[]): Promise<CampaignContact[]> {
    const values = contacts.map(c => ({ ...c, id: nanoid() }));
    const result = await db.insert(campaign_contacts).values(values).returning();
    return result;
  }

  async update(id: string, data: Partial<InsertCampaignContact>): Promise<CampaignContact | undefined> {
    const result = await db.update(campaign_contacts)
      .set({ ...data, updated_at: new Date() })
      .where(eq(campaign_contacts.id, id))
      .returning();
    return result[0];
  }

  async updateStatus(id: string, status: string, lastCallId?: string): Promise<void> {
    await db.update(campaign_contacts)
      .set({
        status,
        last_call_id: lastCallId,
        call_attempts: sql`${campaign_contacts.call_attempts} + 1`,
        updated_at: new Date(),
      })
      .where(eq(campaign_contacts.id, id));
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(campaign_contacts).where(eq(campaign_contacts.id, id)).returning();
    return result.length > 0;
  }

  async deleteByCampaign(campaignId: string): Promise<number> {
    const result = await db.delete(campaign_contacts)
      .where(eq(campaign_contacts.campaign_id, campaignId))
      .returning();
    return result.length;
  }
}

// ============ Call Logs Repository ============
export class CallLogsRepository {
  async getAll(limit = 100): Promise<CallLog[]> {
    return await db.select().from(call_logs)
      .orderBy(desc(call_logs.created_at))
      .limit(limit);
  }

  async getByCampaign(campaignId: string): Promise<CallLog[]> {
    return await db.select().from(call_logs)
      .where(eq(call_logs.campaign_id, campaignId))
      .orderBy(desc(call_logs.created_at));
  }

  async getByDeal(dealId: string): Promise<CallLog[]> {
    return await db.select().from(call_logs)
      .where(eq(call_logs.deal_id, dealId))
      .orderBy(desc(call_logs.created_at));
  }

  async getByClient(clientId: string): Promise<CallLog[]> {
    return await db.select().from(call_logs)
      .where(eq(call_logs.client_id, clientId))
      .orderBy(desc(call_logs.created_at));
  }

  async getById(id: string): Promise<CallLog | undefined> {
    const result = await db.select().from(call_logs).where(eq(call_logs.id, id));
    return result[0];
  }

  async getByElevenLabsConversationId(conversationId: string): Promise<CallLog | undefined> {
    const result = await db.select().from(call_logs)
      .where(eq(call_logs.elevenlabs_conversation_id, conversationId));
    return result[0];
  }

  async create(data: InsertCallLog): Promise<CallLog> {
    const id = nanoid();
    const result = await db.insert(call_logs).values({ ...data, id }).returning();
    return result[0];
  }

  async update(id: string, data: Partial<InsertCallLog>): Promise<CallLog | undefined> {
    const result = await db.update(call_logs)
      .set({ ...data, updated_at: new Date() })
      .where(eq(call_logs.id, id))
      .returning();
    return result[0];
  }

  async updateByConversationId(conversationId: string, data: Partial<InsertCallLog>): Promise<CallLog | undefined> {
    const result = await db.update(call_logs)
      .set({ ...data, updated_at: new Date() })
      .where(eq(call_logs.elevenlabs_conversation_id, conversationId))
      .returning();
    return result[0];
  }

  async delete(id: string): Promise<boolean> {
    const result = await db.delete(call_logs).where(eq(call_logs.id, id)).returning();
    return result.length > 0;
  }

  // Analytics
  async getStats(campaignId?: string): Promise<any> {
    const whereClause = campaignId ? eq(call_logs.campaign_id, campaignId) : sql`1=1`;

    const stats = await db
      .select({
        total_calls: sql<number>`count(*)::int`,
        answered_calls: sql<number>`count(*) filter (where ${call_logs.status} = 'completed')::int`,
        failed_calls: sql<number>`count(*) filter (where ${call_logs.status} = 'failed')::int`,
        avg_duration: sql<number>`avg(${call_logs.duration_seconds})::numeric`,
        total_cost: sql<number>`sum(${call_logs.cost})::numeric`,
        positive_sentiment: sql<number>`count(*) filter (where ${call_logs.sentiment} = 'positive')::int`,
        negative_sentiment: sql<number>`count(*) filter (where ${call_logs.sentiment} = 'negative')::int`,
      })
      .from(call_logs)
      .where(whereClause);

    return stats[0];
  }
}

// ============ Call Actions Repository ============
export class CallActionsRepository {
  async getByCall(callId: string): Promise<CallAction[]> {
    return await db.select().from(call_actions)
      .where(eq(call_actions.call_id, callId))
      .orderBy(call_actions.timestamp_seconds);
  }

  async create(data: InsertCallAction): Promise<CallAction> {
    const id = nanoid();
    const result = await db.insert(call_actions).values({ ...data, id }).returning();
    return result[0];
  }

  async createMany(actions: InsertCallAction[]): Promise<CallAction[]> {
    const values = actions.map(a => ({ ...a, id: nanoid() }));
    const result = await db.insert(call_actions).values(values).returning();
    return result;
  }
}

// Export singleton instances
export const sipTrunksRepository = new SipTrunksRepository();
export const callScriptsRepository = new CallScriptsRepository();
export const elevenLabsAgentsRepository = new ElevenLabsAgentsRepository();
export const callCampaignsRepository = new CallCampaignsRepository();
export const campaignContactsRepository = new CampaignContactsRepository();
export const callLogsRepository = new CallLogsRepository();
export const callActionsRepository = new CallActionsRepository();
