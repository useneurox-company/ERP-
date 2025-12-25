import { Router, Request, Response, NextFunction } from "express";
import {
  sipTrunksRepository,
  callScriptsRepository,
  elevenLabsAgentsRepository,
  callCampaignsRepository,
  campaignContactsRepository,
  callLogsRepository,
  callActionsRepository,
} from "./repository";
import { elevenLabsService } from "./elevenlabs";
import { liveKitService } from "./livekit";
import {
  insertSipTrunkSchema,
  insertCallScriptSchema,
  insertElevenLabsAgentSchema,
  insertCallCampaignSchema,
  insertCampaignContactSchema,
  insertCallLogSchema,
} from "@shared/schema";

export const router = Router();

// ============ SIP Trunks Routes (Exolve, etc.) ============

// GET /api/telephony/sip-trunks - get all SIP trunks
router.get("/api/telephony/sip-trunks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.query;
    const trunks = active === "true"
      ? await sipTrunksRepository.getActive()
      : await sipTrunksRepository.getAll();

    // Mask passwords in response
    const safeTrunks = trunks.map(t => ({
      ...t,
      password: t.password ? '********' : null,
    }));

    res.json(safeTrunks);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/sip-trunks/:id - get SIP trunk by id
router.get("/api/telephony/sip-trunks/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const trunk = await sipTrunksRepository.getById(id);
    if (!trunk) {
      return res.status(404).json({ error: "SIP trunk not found" });
    }
    // Mask password
    res.json({ ...trunk, password: trunk.password ? '********' : null });
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/sip-trunks - create SIP trunk and register with ElevenLabs
router.post("/api/telephony/sip-trunks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = insertSipTrunkSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }

    const data = parsed.data;

    // Check if ElevenLabs API is configured
    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured. Add ELEVENLABS_API_KEY to .env" });
    }

    // Create SIP trunk in ElevenLabs
    let elevenLabsTrunkId: string | undefined;
    try {
      const elevenLabsTrunk = await elevenLabsService.createSipTrunk({
        name: data.name,
        termination_uri: data.termination_uri,
        username: data.username || undefined,
        password: data.password || undefined,
        transport: (data.transport as 'udp' | 'tcp' | 'tls') || 'udp',
        from_number: data.from_number || undefined,
      });
      elevenLabsTrunkId = elevenLabsTrunk.sip_trunk_id;
    } catch (e: any) {
      console.error("Failed to create SIP trunk in ElevenLabs:", e);
      return res.status(400).json({
        error: "Failed to create SIP trunk in ElevenLabs",
        details: e.message
      });
    }

    // Save to our database
    const trunk = await sipTrunksRepository.create({
      ...data,
      elevenlabs_trunk_id: elevenLabsTrunkId,
      connection_status: 'unknown',
    });

    res.status(201).json({
      ...trunk,
      password: '********',
      message: "SIP trunk created successfully in ElevenLabs"
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/telephony/sip-trunks/:id - update SIP trunk
router.put("/api/telephony/sip-trunks/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = insertSipTrunkSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }

    const trunk = await sipTrunksRepository.update(id, parsed.data);
    if (!trunk) {
      return res.status(404).json({ error: "SIP trunk not found" });
    }
    res.json({ ...trunk, password: trunk.password ? '********' : null });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/telephony/sip-trunks/:id - delete SIP trunk
router.delete("/api/telephony/sip-trunks/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get trunk to find ElevenLabs ID
    const trunk = await sipTrunksRepository.getById(id);
    if (!trunk) {
      return res.status(404).json({ error: "SIP trunk not found" });
    }

    // Try to delete from ElevenLabs
    if (elevenLabsService.isConfigured() && trunk.elevenlabs_trunk_id) {
      try {
        await elevenLabsService.deleteSipTrunk(trunk.elevenlabs_trunk_id);
      } catch (e) {
        console.warn("Failed to delete SIP trunk from ElevenLabs:", e);
      }
    }

    const deleted = await sipTrunksRepository.delete(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/sip-trunks/:id/test - test SIP trunk connection
router.post("/api/telephony/sip-trunks/:id/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const trunk = await sipTrunksRepository.getById(id);
    if (!trunk) {
      return res.status(404).json({ error: "SIP trunk not found" });
    }

    if (!trunk.elevenlabs_trunk_id) {
      return res.status(400).json({ error: "SIP trunk not registered with ElevenLabs" });
    }

    // Try to get trunk status from ElevenLabs
    try {
      const elevenLabsTrunk = await elevenLabsService.getSipTrunk(trunk.elevenlabs_trunk_id);
      await sipTrunksRepository.updateConnectionStatus(id, 'connected');
      res.json({
        success: true,
        status: 'connected',
        elevenlabs_trunk: elevenLabsTrunk
      });
    } catch (e: any) {
      await sipTrunksRepository.updateConnectionStatus(id, 'error');
      res.json({
        success: false,
        status: 'error',
        error: e.message
      });
    }
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/calls/sip/initiate - initiate call via SIP trunk
router.post("/api/telephony/calls/sip/initiate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agent_id,
      sip_trunk_id,
      phone_number,
      client_name,
      deal_id,
      client_id,
      custom_data
    } = req.body;

    // Get agent
    const agent = await elevenLabsAgentsRepository.getById(agent_id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Get SIP trunk
    const trunk = await sipTrunksRepository.getById(sip_trunk_id);
    if (!trunk) {
      return res.status(404).json({ error: "SIP trunk not found" });
    }

    if (!trunk.elevenlabs_trunk_id) {
      return res.status(400).json({ error: "SIP trunk not registered with ElevenLabs" });
    }

    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured" });
    }

    // Prepare dynamic variables for personalization
    const variables: Record<string, string> = {};
    if (client_name) variables.client_name = client_name;
    if (custom_data) {
      const parsed = typeof custom_data === 'string' ? JSON.parse(custom_data) : custom_data;
      Object.assign(variables, parsed);
    }

    // Initiate call via SIP trunk
    const result = await elevenLabsService.makePersonalizedCallViaSip(
      agent.elevenlabs_agent_id,
      trunk.elevenlabs_trunk_id,
      phone_number,
      variables,
      trunk.from_number || undefined
    );

    // Log the call
    const callLog = await callLogsRepository.create({
      agent_id: agent.id,
      script_id: agent.script_id || undefined,
      deal_id: deal_id || undefined,
      client_id: client_id || undefined,
      elevenlabs_conversation_id: result.conversation_id,
      phone_number: phone_number,
      direction: 'outbound',
      status: 'initiated',
      started_at: new Date(),
      metadata: JSON.stringify({ sip_trunk_id: trunk.id, provider: trunk.provider }),
    });

    // Update SIP trunk connection status
    await sipTrunksRepository.updateConnectionStatus(trunk.id, 'connected');

    res.status(201).json({
      call_id: callLog.id,
      conversation_id: result.conversation_id,
      status: 'initiated',
      sip_trunk: trunk.name,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/calls/phone/initiate - initiate call via phone number (Twilio integration)
router.post("/api/telephony/calls/phone/initiate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      agent_id,
      phone_number,
      client_name,
      deal_id,
      client_id,
      custom_data
    } = req.body;

    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured" });
    }

    // Get agent
    const agent = await elevenLabsAgentsRepository.getById(agent_id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Get phone number ID from env or agent
    const phoneNumberId = process.env.ELEVENLABS_SIP_TRUNK_ID;
    if (!phoneNumberId) {
      return res.status(400).json({ error: "ELEVENLABS_SIP_TRUNK_ID not configured" });
    }

    // Prepare dynamic variables for personalization
    const variables: Record<string, string> = {};
    if (client_name) variables.client_name = client_name;
    if (custom_data) {
      const parsed = typeof custom_data === 'string' ? JSON.parse(custom_data) : custom_data;
      Object.assign(variables, parsed);
    }

    // Initiate call via Twilio phone number
    const result = await elevenLabsService.initiateOutboundCall({
      agent_id: agent.elevenlabs_agent_id,
      agent_phone_number_id: phoneNumberId,
      to_number: phone_number,
      conversation_initiation_client_data: Object.keys(variables).length > 0
        ? { dynamic_variables: variables }
        : undefined,
    });

    // Log the call
    const callLog = await callLogsRepository.create({
      agent_id: agent.id,
      script_id: agent.script_id || undefined,
      deal_id: deal_id || undefined,
      client_id: client_id || undefined,
      elevenlabs_conversation_id: result.conversation_id,
      phone_number: phone_number,
      direction: 'outbound',
      status: 'initiated',
      started_at: new Date(),
      metadata: JSON.stringify({ phone_number_id: phoneNumberId }),
    });

    res.status(201).json({
      call_id: callLog.id,
      conversation_id: result.conversation_id,
      status: 'initiated',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/elevenlabs/sip-trunks - get SIP trunks from ElevenLabs
router.get("/api/telephony/elevenlabs/sip-trunks", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured" });
    }
    const trunks = await elevenLabsService.getSipTrunks();
    res.json(trunks);
  } catch (error) {
    next(error);
  }
});

// ============ Call Scripts Routes ============

// GET /api/telephony/scripts - get all scripts
router.get("/api/telephony/scripts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.query;
    const scripts = active === "true"
      ? await callScriptsRepository.getActive()
      : await callScriptsRepository.getAll();
    res.json(scripts);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/scripts/:id - get script by id
router.get("/api/telephony/scripts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const script = await callScriptsRepository.getById(id);
    if (!script) {
      return res.status(404).json({ error: "Script not found" });
    }
    res.json(script);
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/scripts - create script
router.post("/api/telephony/scripts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = insertCallScriptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const script = await callScriptsRepository.create(parsed.data);
    res.status(201).json(script);
  } catch (error) {
    next(error);
  }
});

// PUT /api/telephony/scripts/:id - update script
router.put("/api/telephony/scripts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = insertCallScriptSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const script = await callScriptsRepository.update(id, parsed.data);
    if (!script) {
      return res.status(404).json({ error: "Script not found" });
    }
    res.json(script);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/telephony/scripts/:id - delete script
router.delete("/api/telephony/scripts/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await callScriptsRepository.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Script not found" });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============ ElevenLabs Agents Routes ============

// GET /api/telephony/agents - get all agents
router.get("/api/telephony/agents", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.query;
    const agents = active === "true"
      ? await elevenLabsAgentsRepository.getActive()
      : await elevenLabsAgentsRepository.getAll();
    res.json(agents);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/agents/:id - get agent by id
router.get("/api/telephony/agents/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const agent = await elevenLabsAgentsRepository.getById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/agents - create agent
router.post("/api/telephony/agents", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = insertElevenLabsAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const agent = await elevenLabsAgentsRepository.create(parsed.data);
    res.status(201).json(agent);
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/agents/create-from-script - create agent from script via ElevenLabs API
router.post("/api/telephony/agents/create-from-script", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { script_id, phone_number_id, phone_number } = req.body;

    // Get the script
    const script = await callScriptsRepository.getById(script_id);
    if (!script) {
      return res.status(404).json({ error: "Script not found" });
    }

    // Check ElevenLabs API configuration
    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured" });
    }

    // Create agent in ElevenLabs
    const elevenLabsAgent = await elevenLabsService.createAgentFromScript({
      name: script.name,
      system_prompt: script.system_prompt,
      first_message: script.first_message || undefined,
      voice_id: script.voice_id || undefined,
      language: script.language,
      llm_model: script.llm_model || undefined,
    });

    // Save agent reference in our database
    const agent = await elevenLabsAgentsRepository.create({
      name: script.name,
      elevenlabs_agent_id: elevenLabsAgent.agent_id,
      script_id: script_id,
      phone_number_id: phone_number_id,
      phone_number: phone_number,
    });

    res.status(201).json(agent);
  } catch (error) {
    next(error);
  }
});

// PUT /api/telephony/agents/:id - update agent
router.put("/api/telephony/agents/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = insertElevenLabsAgentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const agent = await elevenLabsAgentsRepository.update(id, parsed.data);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json(agent);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/telephony/agents/:id - delete agent
router.delete("/api/telephony/agents/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Get agent to find ElevenLabs ID
    const agent = await elevenLabsAgentsRepository.getById(id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // Try to delete from ElevenLabs (ignore errors if not configured)
    if (elevenLabsService.isConfigured()) {
      try {
        await elevenLabsService.deleteAgent(agent.elevenlabs_agent_id);
      } catch (e) {
        console.warn("Failed to delete agent from ElevenLabs:", e);
      }
    }

    const deleted = await elevenLabsAgentsRepository.delete(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============ Call Campaigns Routes ============

// GET /api/telephony/campaigns - get all campaigns
router.get("/api/telephony/campaigns", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.query;
    const campaigns = status
      ? await callCampaignsRepository.getByStatus(status as string)
      : await callCampaignsRepository.getAll();
    res.json(campaigns);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/campaigns/:id - get campaign by id with stats
router.get("/api/telephony/campaigns/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const campaign = await callCampaignsRepository.getByIdWithStats(id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/campaigns - create campaign
router.post("/api/telephony/campaigns", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = insertCallCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const campaign = await callCampaignsRepository.create(parsed.data);
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

// PUT /api/telephony/campaigns/:id - update campaign
router.put("/api/telephony/campaigns/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = insertCallCampaignSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    const campaign = await callCampaignsRepository.update(id, parsed.data);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json(campaign);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/telephony/campaigns/:id - delete campaign
router.delete("/api/telephony/campaigns/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted = await callCampaignsRepository.delete(id);
    if (!deleted) {
      return res.status(404).json({ error: "Campaign not found" });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ============ Campaign Contacts Routes ============

// GET /api/telephony/campaigns/:id/contacts - get campaign contacts
router.get("/api/telephony/campaigns/:id/contacts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const contacts = await campaignContactsRepository.getByCampaign(id);
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/campaigns/:id/contacts - add contacts to campaign
router.post("/api/telephony/campaigns/:id/contacts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { contacts } = req.body;

    if (!Array.isArray(contacts)) {
      return res.status(400).json({ error: "contacts must be an array" });
    }

    // Add campaign_id to each contact
    const contactsWithCampaign = contacts.map((c: any) => ({
      ...c,
      campaign_id: id,
    }));

    const created = await campaignContactsRepository.createMany(contactsWithCampaign);

    // Update campaign stats
    await callCampaignsRepository.updateStats(id);

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/telephony/campaigns/:id/contacts - remove all contacts from campaign
router.delete("/api/telephony/campaigns/:id/contacts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const count = await campaignContactsRepository.deleteByCampaign(id);

    // Update campaign stats
    await callCampaignsRepository.updateStats(id);

    res.json({ success: true, deleted: count });
  } catch (error) {
    next(error);
  }
});

// ============ Call Logs Routes ============

// GET /api/telephony/calls - get all call logs
router.get("/api/telephony/calls", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaign_id, deal_id, client_id, limit } = req.query;

    let calls;
    if (campaign_id) {
      calls = await callLogsRepository.getByCampaign(campaign_id as string);
    } else if (deal_id) {
      calls = await callLogsRepository.getByDeal(deal_id as string);
    } else if (client_id) {
      calls = await callLogsRepository.getByClient(client_id as string);
    } else {
      calls = await callLogsRepository.getAll(limit ? parseInt(limit as string) : 100);
    }

    res.json(calls);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/calls/:id - get call by id
router.get("/api/telephony/calls/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const call = await callLogsRepository.getById(id);
    if (!call) {
      return res.status(404).json({ error: "Call not found" });
    }
    res.json(call);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/calls/:id/actions - get call actions
router.get("/api/telephony/calls/:id/actions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const actions = await callActionsRepository.getByCall(id);
    res.json(actions);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/stats - get call statistics
router.get("/api/telephony/stats", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { campaign_id } = req.query;
    const stats = await callLogsRepository.getStats(campaign_id as string | undefined);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// ============ Make Calls ============

// POST /api/telephony/calls/initiate - initiate a single call
router.post("/api/telephony/calls/initiate", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agent_id, phone_number, client_name, deal_id, client_id, custom_data } = req.body;

    // Get agent
    const agent = await elevenLabsAgentsRepository.getById(agent_id);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    if (!agent.phone_number_id) {
      return res.status(400).json({ error: "Agent has no phone number configured" });
    }

    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured" });
    }

    // Prepare dynamic variables for personalization
    const variables: Record<string, string> = {};
    if (client_name) variables.client_name = client_name;
    if (custom_data) {
      const parsed = typeof custom_data === 'string' ? JSON.parse(custom_data) : custom_data;
      Object.assign(variables, parsed);
    }

    // Initiate call via ElevenLabs
    const result = await elevenLabsService.makePersonalizedCall(
      agent.elevenlabs_agent_id,
      agent.phone_number_id,
      phone_number,
      variables
    );

    // Log the call
    const callLog = await callLogsRepository.create({
      agent_id: agent.id,
      script_id: agent.script_id || undefined,
      deal_id: deal_id || undefined,
      client_id: client_id || undefined,
      elevenlabs_conversation_id: result.conversation_id,
      phone_number: phone_number,
      direction: 'outbound',
      status: 'initiated',
      started_at: new Date(),
    });

    res.status(201).json({
      call_id: callLog.id,
      conversation_id: result.conversation_id,
      status: 'initiated',
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/campaigns/:id/start - start campaign calling
router.post("/api/telephony/campaigns/:id/start", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const campaign = await callCampaignsRepository.getById(id);
    if (!campaign) {
      return res.status(404).json({ error: "Campaign not found" });
    }

    if (!campaign.agent_id) {
      return res.status(400).json({ error: "Campaign has no agent configured" });
    }

    // Update campaign status
    await callCampaignsRepository.update(id, { status: 'running' });

    res.json({ success: true, message: "Campaign started" });
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/campaigns/:id/pause - pause campaign
router.post("/api/telephony/campaigns/:id/pause", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await callCampaignsRepository.update(id, { status: 'paused' });
    res.json({ success: true, message: "Campaign paused" });
  } catch (error) {
    next(error);
  }
});

// ============ ElevenLabs Integration Routes ============

// GET /api/telephony/elevenlabs/status - check API status
router.get("/api/telephony/elevenlabs/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = elevenLabsService.getApiKeyStatus();
    res.json({
      ...status,
      defaultAgentId: elevenLabsService.getDefaultAgentId(),
      defaultSipTrunkId: elevenLabsService.getDefaultSipTrunkId(),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/elevenlabs/test - test connection to ElevenLabs API
router.post("/api/telephony/elevenlabs/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await elevenLabsService.testConnection();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/elevenlabs/voices - get available voices
router.get("/api/telephony/elevenlabs/voices", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured" });
    }
    const voices = await elevenLabsService.getVoices();
    res.json(voices);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/elevenlabs/phone-numbers - get available phone numbers
router.get("/api/telephony/elevenlabs/phone-numbers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured" });
    }
    const phoneNumbers = await elevenLabsService.getPhoneNumbers();
    res.json(phoneNumbers);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/elevenlabs/agents - get agents from ElevenLabs
router.get("/api/telephony/elevenlabs/agents", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!elevenLabsService.isConfigured()) {
      return res.status(400).json({ error: "ElevenLabs API key not configured" });
    }
    const agents = await elevenLabsService.getAgents();
    res.json(agents);
  } catch (error) {
    next(error);
  }
});

// ============ Webhooks ============

// POST /api/telephony/webhooks/elevenlabs - handle ElevenLabs webhooks
router.post("/api/telephony/webhooks/elevenlabs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { event_type, conversation_id, data } = req.body;

    console.log(`ElevenLabs webhook received: ${event_type}`, { conversation_id });

    switch (event_type) {
      case 'conversation.started':
        await callLogsRepository.updateByConversationId(conversation_id, {
          status: 'answered',
          answered_at: new Date(),
        });
        break;

      case 'conversation.ended':
        const { duration, transcript, summary, sentiment } = data || {};
        await callLogsRepository.updateByConversationId(conversation_id, {
          status: 'completed',
          ended_at: new Date(),
          duration_seconds: duration,
          transcript: transcript,
          summary: summary,
          sentiment: sentiment,
        });

        // Update campaign contact status if this was a campaign call
        const call = await callLogsRepository.getByElevenLabsConversationId(conversation_id);
        if (call?.campaign_contact_id) {
          await campaignContactsRepository.updateStatus(call.campaign_contact_id, 'completed', call.id);
          if (call.campaign_id) {
            await callCampaignsRepository.updateStats(call.campaign_id);
          }
        }
        break;

      case 'conversation.failed':
        await callLogsRepository.updateByConversationId(conversation_id, {
          status: 'failed',
          ended_at: new Date(),
          error_message: data?.error || 'Unknown error',
        });
        break;

      default:
        console.log(`Unhandled webhook event: ${event_type}`);
    }

    res.json({ received: true });
  } catch (error) {
    next(error);
  }
});

// ============ LiveKit Voice Agent Routes ============

// POST /api/telephony/livekit/token - Generate access token for LiveKit room
router.post("/api/telephony/livekit/token", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!liveKitService.isConfigured()) {
      return res.status(400).json({ error: "LiveKit not configured. Add LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET to .env" });
    }

    const { roomName, identity, name } = req.body;

    if (!roomName || !identity) {
      return res.status(400).json({ error: "roomName and identity are required" });
    }

    const token = liveKitService.generateAccessToken({
      roomName,
      identity,
      name,
    });

    res.json({
      token,
      url: process.env.LIVEKIT_URL || "ws://localhost:7880",
      roomName,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/livekit/test-call - Create test room and return connection details
router.post("/api/telephony/livekit/test-call", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!liveKitService.isConfigured()) {
      return res.status(400).json({ error: "LiveKit not configured" });
    }

    const { userName } = req.body;
    const roomName = `voice-test-${Date.now()}`;
    const identity = userName || `user-${Date.now()}`;

    // Create room
    await liveKitService.createRoom(roomName);

    // Generate token
    const token = await liveKitService.generateAccessToken({
      roomName,
      identity,
      name: userName || "Test User",
    });

    res.json({
      roomName,
      token,
      url: process.env.LIVEKIT_URL || "ws://localhost:7880",
      identity,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/livekit/rooms - Get list of active rooms
router.get("/api/telephony/livekit/rooms", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!liveKitService.isConfigured()) {
      return res.status(400).json({ error: "LiveKit not configured" });
    }

    const rooms = await liveKitService.getRooms();
    res.json(rooms);
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/livekit/rooms/:roomName/participants - Get room participants
router.get("/api/telephony/livekit/rooms/:roomName/participants", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!liveKitService.isConfigured()) {
      return res.status(400).json({ error: "LiveKit not configured" });
    }

    const { roomName } = req.params;
    const participants = await liveKitService.getRoomParticipants(roomName);

    res.json(participants);
  } catch (error) {
    next(error);
  }
});

// POST /api/telephony/livekit/rooms/:roomName/end - End a room
router.post("/api/telephony/livekit/rooms/:roomName/end", async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!liveKitService.isConfigured()) {
      return res.status(400).json({ error: "LiveKit not configured" });
    }

    const { roomName } = req.params;
    await liveKitService.deleteRoom(roomName);

    res.json({ success: true, message: `Room ${roomName} ended` });
  } catch (error) {
    next(error);
  }
});

// GET /api/telephony/livekit/status - Get LiveKit service status
router.get("/api/telephony/livekit/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = liveKitService.getStatus();
    res.json(status);
  } catch (error) {
    next(error);
  }
});
