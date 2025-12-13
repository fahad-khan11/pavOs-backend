import axios, { AxiosInstance } from 'axios';
import { CONSTANTS } from '../config/constants.js';

class DiscordService {
  private api: AxiosInstance;
  private readonly DISCORD_API_BASE = 'https://discord.com/api/v10';
  private readonly DISCORD_CDN_BASE = 'https://cdn.discordapp.com';

  constructor() {
    this.api = axios.create({
      baseURL: this.DISCORD_API_BASE,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    console.log('Discord Service initialized');
  }

  /**
   * Exchange OAuth2 code for access token
   */
  async exchangeCodeForToken(code: string) {
    try {
      console.log('Exchanging Discord OAuth code for token...');

      const params = new URLSearchParams({
        client_id: CONSTANTS.DISCORD_CLIENT_ID!,
        client_secret: CONSTANTS.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: CONSTANTS.DISCORD_REDIRECT_URI!,
      });

      const response = await axios.post(
        `${this.DISCORD_API_BASE}/oauth2/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      console.log('Successfully exchanged code for token');
      return response.data;
    } catch (error: any) {
      console.error('Discord OAuth Error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      throw new Error('Failed to exchange OAuth code for token');
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      const params = new URLSearchParams({
        client_id: CONSTANTS.DISCORD_CLIENT_ID!,
        client_secret: CONSTANTS.DISCORD_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });

      const response = await axios.post(
        `${this.DISCORD_API_BASE}/oauth2/token`,
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Discord Refresh Token Error:', error.response?.data || error.message);
      throw new Error('Failed to refresh Discord access token');
    }
  }

  /**
   * Get current user information (OAuth)
   */
  async getCurrentUser(accessToken: string) {
    try {
      const response = await this.api.get('/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Discord Get User Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch Discord user information');
    }
  }

  /**
   * Get user's guilds (servers)
   */
  async getUserGuilds(accessToken: string) {
    try {
      const response = await this.api.get('/users/@me/guilds', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Discord Get Guilds Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch Discord guilds');
    }
  }

  /**
   * Get guild information (using bot token)
   */
  async getGuild(guildId: string, botToken?: string) {
    try {
      const token = botToken || CONSTANTS.DISCORD_BOT_TOKEN;
      const response = await this.api.get(`/guilds/${guildId}`, {
        headers: {
          Authorization: `Bot ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Discord Get Guild Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch guild information');
    }
  }

  /**
   * Get guild members (using bot token)
   */
  async getGuildMembers(guildId: string, limit = 100, after?: string) {
    try {
      const params: any = { limit };
      if (after) params.after = after;

      const response = await this.api.get(`/guilds/${guildId}/members`, {
        headers: {
          Authorization: `Bot ${CONSTANTS.DISCORD_BOT_TOKEN}`,
        },
        params,
      });

      return response.data;
    } catch (error: any) {
      console.error('Discord Get Members Error:', error.response?.data || error.message);
      const errorMsg = error.response?.data?.message || error.message;
      if (errorMsg.includes('Unknown Guild') || error.response?.data?.code === 10004) {
        throw new Error(`Guild not found or bot not in guild (ID: ${guildId}). Make sure the Discord bot is invited to this server.`);
      }
      throw new Error('Failed to fetch guild members');
    }
  }

  /**
   * Get specific guild member
   */
  async getGuildMember(guildId: string, userId: string) {
    try {
      const response = await this.api.get(`/guilds/${guildId}/members/${userId}`, {
        headers: {
          Authorization: `Bot ${CONSTANTS.DISCORD_BOT_TOKEN}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Discord Get Member Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch guild member');
    }
  }

  /**
   * Get guild channels
   */
  async getGuildChannels(guildId: string) {
    try {
      const response = await this.api.get(`/guilds/${guildId}/channels`, {
        headers: {
          Authorization: `Bot ${CONSTANTS.DISCORD_BOT_TOKEN}`,
        },
      });

      return response.data;
    } catch (error: any) {
      console.error('Discord Get Channels Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch guild channels');
    }
  }

  /**
   * Send message to a channel
   */
  async sendMessage(channelId: string, content: string, embeds?: any[]) {
    try {
      const payload: any = { content };
      if (embeds) payload.embeds = embeds;

      const response = await this.api.post(
        `/channels/${channelId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bot ${CONSTANTS.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Discord Send Message Error:', error.response?.data || error.message);
      throw new Error('Failed to send Discord message');
    }
  }

  /**
   * Create DM channel with a user
   */
  async createDM(userId: string) {
    try {
      const response = await this.api.post(
        '/users/@me/channels',
        { recipient_id: userId },
        {
          headers: {
            Authorization: `Bot ${CONSTANTS.DISCORD_BOT_TOKEN}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Discord Create DM Error:', error.response?.data || error.message);
      throw new Error('Failed to create DM channel');
    }
  }

  /**
   * Send DM to a user
   */
  async sendDM(userId: string, content: string, embeds?: any[]) {
    try {
      // First create DM channel
      const dmChannel = await this.createDM(userId);

      // Then send message
      return await this.sendMessage(dmChannel.id, content, embeds);
    } catch (error: any) {
      console.error('Discord Send DM Error:', error);
      throw new Error('Failed to send DM to user');
    }
  }

  /**
   * Get messages from a channel
   */
  async getChannelMessages(channelId: string, limit = 50) {
    try {
      const response = await this.api.get(`/channels/${channelId}/messages`, {
        headers: {
          Authorization: `Bot ${CONSTANTS.DISCORD_BOT_TOKEN}`,
        },
        params: { limit },
      });

      return response.data;
    } catch (error: any) {
      console.error('Discord Get Messages Error:', error.response?.data || error.message);
      throw new Error('Failed to fetch channel messages');
    }
  }

  /**
   * Test bot connection
   */
  async testBotConnection() {
    try {
      const response = await this.api.get('/users/@me', {
        headers: {
          Authorization: `Bot ${CONSTANTS.DISCORD_BOT_TOKEN}`,
        },
      });

      console.log('Bot connected as:', response.data.username);
      return response.data;
    } catch (error: any) {
      console.error('Discord Bot Connection Error:', error.response?.data || error.message);
      throw new Error('Failed to connect Discord bot');
    }
  }

  /**
   * Generate OAuth URL for user authorization
   */
  generateOAuthURL(state?: string) {
    const params = new URLSearchParams({
      client_id: CONSTANTS.DISCORD_CLIENT_ID!,
      redirect_uri: CONSTANTS.DISCORD_REDIRECT_URI!,
      response_type: 'code',
      scope: CONSTANTS.DISCORD_OAUTH_SCOPES!,
    });

    if (state) params.append('state', state);

    return `${this.DISCORD_API_BASE}/oauth2/authorize?${params.toString()}`;
  }
}

export const discordService = new DiscordService();
export default discordService;
