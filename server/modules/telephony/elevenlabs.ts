/**
 * ElevenLabs Conversational AI Integration Service
 *
 * This service handles all interactions with the ElevenLabs API for:
 * - Creating and managing conversational AI agents
 * - Initiating outbound calls via Twilio integration
 * - Receiving webhooks for call events
 * - Managing voice configurations
 */

interface ElevenLabsConfig {
  apiKey: string;
  baseUrl?: string;
  proxyUrl?: string;
}

interface CreateAgentRequest {
  name: string;
  conversation_config: {
    agent: {
      prompt: {
        prompt: string;
        llm?: string;
        temperature?: number;
        max_tokens?: number;
      };
      first_message?: string;
      language?: string;
    };
    tts?: {
      voice_id?: string;
    };
  };
}

interface OutboundCallRequest {
  agent_id: string;
  agent_phone_number_id: string;
  to_number: string;
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, string>;
  };
}

// SIP Trunk interfaces
interface SipTrunkConfig {
  name: string;
  termination_uri: string;  // e.g., sip.exolve.ru
  username?: string;
  password?: string;
  transport?: 'udp' | 'tcp' | 'tls';
  from_number?: string;
}

interface SipTrunk {
  sip_trunk_id: string;
  name: string;
  termination_uri: string;
  created_at_unix_secs: number;
}

interface SipOutboundCallRequest {
  agent_id: string;
  sip_trunk_id: string;
  to_number: string;
  from_number?: string;
  conversation_initiation_client_data?: {
    dynamic_variables?: Record<string, string>;
  };
}

interface Voice {
  voice_id: string;
  name: string;
  preview_url?: string;
  category?: string;
  labels?: Record<string, string>;
}

interface Agent {
  agent_id: string;
  name: string;
  created_at_unix_secs: number;
}

interface Conversation {
  conversation_id: string;
  agent_id: string;
  status: string;
  start_time_unix_secs?: number;
  end_time_unix_secs?: number;
  transcript?: string;
  metadata?: Record<string, any>;
}

export class ElevenLabsService {
  private apiKey: string;
  private baseUrl: string;
  private proxyUrl?: string;

  constructor(config?: Partial<ElevenLabsConfig>) {
    this.apiKey = config?.apiKey || process.env.ELEVENLABS_API_KEY || '';
    this.baseUrl = config?.baseUrl || process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io/v1';
    this.proxyUrl = config?.proxyUrl || process.env.ELEVENLABS_PROXY;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error (${response.status}): ${error}`);
      }

      return response.json();
    } catch (error: any) {
      // Добавляем информацию о прокси в ошибку если настроен
      if (this.proxyUrl) {
        throw new Error(`ElevenLabs API error (proxy: ${this.proxyUrl}): ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Test connection to ElevenLabs API
   */
  async testConnection(): Promise<{ success: boolean; message: string; details?: any }> {
    if (!this.apiKey) {
      return { success: false, message: 'API key not configured' };
    }

    try {
      const voices = await this.getVoices();
      return {
        success: true,
        message: `Connected successfully. Found ${voices.length} voices.`,
        details: {
          voiceCount: voices.length,
          apiKeyMasked: this.getApiKeyStatus().masked,
          baseUrl: this.baseUrl,
          proxyConfigured: !!this.proxyUrl,
        }
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message,
        details: {
          apiKeyMasked: this.getApiKeyStatus().masked,
          baseUrl: this.baseUrl,
          proxyConfigured: !!this.proxyUrl,
        }
      };
    }
  }

  /**
   * Get default agent ID from environment
   */
  getDefaultAgentId(): string | undefined {
    return process.env.ELEVENLABS_AGENT_ID;
  }

  /**
   * Get default SIP trunk ID from environment
   */
  getDefaultSipTrunkId(): string | undefined {
    return process.env.ELEVENLABS_SIP_TRUNK_ID;
  }

  // ============ Voices ============

  /**
   * Get all available voices
   */
  async getVoices(): Promise<Voice[]> {
    const response = await this.request<{ voices: Voice[] }>('/voices');
    return response.voices;
  }

  /**
   * Get voice by ID
   */
  async getVoice(voiceId: string): Promise<Voice> {
    return this.request<Voice>(`/voices/${voiceId}`);
  }

  // ============ Conversational AI Agents ============

  /**
   * Create a new conversational AI agent
   */
  async createAgent(data: CreateAgentRequest): Promise<Agent> {
    return this.request<Agent>('/convai/agents/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get all agents
   */
  async getAgents(): Promise<Agent[]> {
    const response = await this.request<{ agents: Agent[] }>('/convai/agents');
    return response.agents;
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId: string): Promise<Agent> {
    return this.request<Agent>(`/convai/agents/${agentId}`);
  }

  /**
   * Update agent configuration
   */
  async updateAgent(agentId: string, data: Partial<CreateAgentRequest>): Promise<Agent> {
    return this.request<Agent>(`/convai/agents/${agentId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId: string): Promise<void> {
    await this.request<void>(`/convai/agents/${agentId}`, {
      method: 'DELETE',
    });
  }

  // ============ Phone Calls (Twilio Integration) ============

  /**
   * Initiate an outbound call via Twilio
   */
  async initiateOutboundCall(data: OutboundCallRequest): Promise<{ conversation_id: string }> {
    return this.request<{ conversation_id: string }>('/convai/twilio/outbound-call', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get phone numbers associated with the account
   */
  async getPhoneNumbers(): Promise<any[]> {
    const response = await this.request<{ phone_numbers: any[] }>('/convai/phone-numbers');
    return response.phone_numbers;
  }

  // ============ SIP Trunk (Exolve and other providers) ============

  /**
   * Create a SIP trunk for connecting external telephony (e.g., Exolve)
   */
  async createSipTrunk(config: SipTrunkConfig): Promise<SipTrunk> {
    const body: any = {
      name: config.name,
      termination_uri: config.termination_uri,
      transport: config.transport || 'udp',
    };

    // Add authentication if provided
    if (config.username && config.password) {
      body.authentication = {
        type: 'digest',
        username: config.username,
        password: config.password,
      };
    }

    if (config.from_number) {
      body.from_number = config.from_number;
    }

    return this.request<SipTrunk>('/convai/sip-trunk', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Get all SIP trunks
   */
  async getSipTrunks(): Promise<SipTrunk[]> {
    const response = await this.request<{ sip_trunks: SipTrunk[] }>('/convai/sip-trunks');
    return response.sip_trunks || [];
  }

  /**
   * Get a specific SIP trunk
   */
  async getSipTrunk(sipTrunkId: string): Promise<SipTrunk> {
    return this.request<SipTrunk>(`/convai/sip-trunk/${sipTrunkId}`);
  }

  /**
   * Delete a SIP trunk
   */
  async deleteSipTrunk(sipTrunkId: string): Promise<void> {
    await this.request<void>(`/convai/sip-trunk/${sipTrunkId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Initiate an outbound call via SIP trunk (Exolve, etc.)
   */
  async initiateOutboundCallViaSip(data: SipOutboundCallRequest): Promise<{ conversation_id: string }> {
    const body: any = {
      agent_id: data.agent_id,
      sip_trunk_id: data.sip_trunk_id,
      to_number: data.to_number,
    };

    if (data.from_number) {
      body.from_number = data.from_number;
    }

    if (data.conversation_initiation_client_data) {
      body.conversation_initiation_client_data = data.conversation_initiation_client_data;
    }

    return this.request<{ conversation_id: string }>('/convai/sip-trunk/outbound-call', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /**
   * Make a personalized call via SIP trunk
   */
  async makePersonalizedCallViaSip(
    agentId: string,
    sipTrunkId: string,
    toNumber: string,
    variables: Record<string, string>,
    fromNumber?: string
  ): Promise<{ conversation_id: string }> {
    return this.initiateOutboundCallViaSip({
      agent_id: agentId,
      sip_trunk_id: sipTrunkId,
      to_number: toNumber,
      from_number: fromNumber,
      conversation_initiation_client_data: {
        dynamic_variables: variables,
      },
    });
  }

  // ============ Conversations ============

  /**
   * Get conversation by ID
   */
  async getConversation(conversationId: string): Promise<Conversation> {
    return this.request<Conversation>(`/convai/conversations/${conversationId}`);
  }

  /**
   * Get conversation transcript
   */
  async getConversationTranscript(conversationId: string): Promise<string> {
    const response = await this.request<{ transcript: string }>(
      `/convai/conversations/${conversationId}/transcript`
    );
    return response.transcript;
  }

  /**
   * Get conversation audio recording URL
   */
  async getConversationRecording(conversationId: string): Promise<string> {
    const response = await this.request<{ audio_url: string }>(
      `/convai/conversations/${conversationId}/audio`
    );
    return response.audio_url;
  }

  /**
   * Get all conversations for an agent
   */
  async getAgentConversations(agentId: string, limit = 100): Promise<Conversation[]> {
    const response = await this.request<{ conversations: Conversation[] }>(
      `/convai/agents/${agentId}/conversations?limit=${limit}`
    );
    return response.conversations;
  }

  // ============ Webhook Verification ============

  /**
   * Verify webhook signature (for incoming webhooks from ElevenLabs)
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return signature === expectedSignature;
  }

  // ============ Helper Methods ============

  /**
   * Create an agent from a call script
   */
  async createAgentFromScript(script: {
    name: string;
    system_prompt: string;
    first_message?: string;
    voice_id?: string;
    language?: string;
    llm_model?: string;
  }): Promise<Agent> {
    return this.createAgent({
      name: script.name,
      conversation_config: {
        agent: {
          prompt: {
            prompt: script.system_prompt,
            llm: script.llm_model || 'claude-3-5-sonnet',
          },
          first_message: script.first_message,
          language: script.language || 'ru',
        },
        tts: script.voice_id ? { voice_id: script.voice_id } : undefined,
      },
    });
  }

  /**
   * Make a call with dynamic variables for personalization
   */
  async makePersonalizedCall(
    agentId: string,
    phoneNumberId: string,
    toNumber: string,
    variables: Record<string, string>
  ): Promise<{ conversation_id: string }> {
    return this.initiateOutboundCall({
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: toNumber,
      conversation_initiation_client_data: {
        dynamic_variables: variables,
      },
    });
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get API key status (masked for security)
   */
  getApiKeyStatus(): { configured: boolean; masked?: string } {
    if (!this.apiKey) {
      return { configured: false };
    }
    return {
      configured: true,
      masked: `${this.apiKey.slice(0, 4)}...${this.apiKey.slice(-4)}`,
    };
  }
}

// Export singleton instance
export const elevenLabsService = new ElevenLabsService();

// Export types
export type {
  Voice,
  Agent,
  Conversation,
  CreateAgentRequest,
  OutboundCallRequest,
  SipTrunkConfig,
  SipTrunk,
  SipOutboundCallRequest
};
