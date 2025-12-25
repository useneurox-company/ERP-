/**
 * LiveKit Voice Agent Integration Service
 *
 * Handles integration with LiveKit server for real-time voice communication
 * with AI Voice Agent (Yandex STT/TTS + GPT-4o-mini)
 */

import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

interface LiveKitConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

interface TokenParams {
  roomName: string;
  identity: string;
  name?: string;
}

export class LiveKitService {
  private url: string;
  private apiKey: string;
  private apiSecret: string;
  private roomService: RoomServiceClient;

  constructor(config?: Partial<LiveKitConfig>) {
    this.url = config?.url || process.env.LIVEKIT_URL || "ws://localhost:7880";
    this.apiKey = config?.apiKey || process.env.LIVEKIT_API_KEY || "";
    this.apiSecret = config?.apiSecret || process.env.LIVEKIT_API_SECRET || "";

    if (!this.apiKey || !this.apiSecret) {
      console.warn("⚠️  LiveKit credentials not configured");
    }

    // Initialize Room Service Client for server-side operations
    // Always use direct HTTP connection to localhost:7880 for server-side API
    // (not the public WebSocket URL which might be proxied through nginx)
    const apiUrl = process.env.LIVEKIT_API_URL || 'http://localhost:7880';
    this.roomService = new RoomServiceClient(
      apiUrl,
      this.apiKey,
      this.apiSecret
    );
  }

  /**
   * Generate access token for client to connect to LiveKit room
   */
  async generateAccessToken(params: TokenParams): Promise<string> {
    const { roomName, identity, name } = params;

    const token = new AccessToken(this.apiKey, this.apiSecret, {
      identity,
      name: name || identity,
      ttl: 3600, // 1 hour
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const jwt = await token.toJwt();
    console.log('✅ Generated JWT token, length:', jwt.length);

    return jwt;
  }

  /**
   * Create a new room for voice conversation
   */
  async createRoom(roomName: string): Promise<any> {
    try {
      const room = await this.roomService.createRoom({
        name: roomName,
        emptyTimeout: 600, // 10 minutes
        maxParticipants: 10,
      });
      return room;
    } catch (error: any) {
      // Room might already exist
      if (error.message?.includes('already exists')) {
        console.log(`Room ${roomName} already exists, continuing...`);
        return { name: roomName };
      }
      throw error;
    }
  }

  /**
   * Get list of active rooms
   */
  async getRooms(): Promise<any[]> {
    try {
      const rooms = await this.roomService.listRooms();
      return rooms;
    } catch (error) {
      console.error("Error getting rooms:", error);
      return [];
    }
  }

  /**
   * Get participants in a room
   */
  async getRoomParticipants(roomName: string): Promise<any[]> {
    try {
      const participants = await this.roomService.listParticipants(roomName);
      return participants;
    } catch (error) {
      console.error(`Error getting participants for room ${roomName}:`, error);
      return [];
    }
  }

  /**
   * Check if Voice Agent is in the room
   */
  async isAgentInRoom(roomName: string): Promise<boolean> {
    try {
      const participants = await this.getRoomParticipants(roomName);
      return participants.some(p =>
        p.identity?.includes('agent') ||
        p.identity?.includes('bot') ||
        p.name?.toLowerCase().includes('agent')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a room
   */
  async deleteRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
    } catch (error) {
      console.error(`Error deleting room ${roomName}:`, error);
    }
  }

  /**
   * Check if LiveKit is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      configured: this.isConfigured(),
      url: this.url,
      apiKeyMasked: this.apiKey ? `${this.apiKey.slice(0, 4)}...` : 'not set',
    };
  }
}

// Export singleton instance
export const liveKitService = new LiveKitService();
