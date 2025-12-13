import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { discordService } from '../services/discordService.js';
import { discordBotService } from '../services/discordBotService.js';
import { DiscordConnection, Lead, Contact, TelemetryEvent, DiscordMessage, User } from '../models/index.js';

/**
 * Get Discord connection status
 * GET /api/v1/integrations/discord/status
 */
export const getConnectionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const connection = await DiscordConnection.findOne({ userId, isActive: true });

    if (!connection) {
      successResponse(res, {
        connected: false,
        botActive: discordBotService.isActive(),
        message: 'Discord not connected',
      });
      return;
    }

    successResponse(res, {
      connected: true,
      botActive: discordBotService.isActive(),
      guildId: connection.discordGuildId,
      guildName: connection.discordGuildName,
      username: connection.discordUsername,
      connectedAt: connection.connectedAt,
      lastSyncAt: connection.lastSyncAt,
      syncedMembersCount: connection.syncedMembersCount || 0,
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to get Discord connection status', 500);
  }
};

/**
 * Get Discord OAuth URL
 * GET /api/v1/integrations/discord/oauth-url
 */
export const getOAuthURL = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
    const url = discordService.generateOAuthURL(state);

    successResponse(res, { url });
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to generate OAuth URL', 500);
  }
};

/**
 * Handle OAuth callback
 * GET/POST /api/v1/integrations/discord/callback
 */
export const handleOAuthCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Discord sends as GET with query params
    const code = req.query.code || req.body.code;
    const state = req.query.state || req.body.state;

    if (!code) {
      errorResponse(res, 'Authorization code is required', 400);
      return;
    }

    // Decode state to get userId
    let userId: string;
    try {
      const decodedState = JSON.parse(Buffer.from(state as string, 'base64').toString());
      userId = decodedState.userId;
      
      if (!userId) {
        throw new Error('Missing userId in state');
      }
    } catch (error) {
      console.error('Failed to decode state:', error);
      errorResponse(res, 'Invalid state parameter', 400);
      return;
    }

    // Exchange code for tokens
    const tokenData = await discordService.exchangeCodeForToken(code);

    // Get user information
    const discordUser = await discordService.getCurrentUser(tokenData.access_token);

    // Get user's guilds
    const guilds = await discordService.getUserGuilds(tokenData.access_token);

    // For now, use the first guild (or you can let user select)
    const guild = guilds[0];

    let guildInfo = null;
    if (guild) {
      try {
        guildInfo = await discordService.getGuild(guild.id);
      } catch (err) {
        console.log('Could not fetch guild info, using basic info from OAuth');
        guildInfo = guild;
      }
    }

    // Validate userId exists in User collection
    const { User } = await import('../models/index.js');
    const user = await User.findById(userId);
    if (!user) {
      console.error(`❌ Invalid userId in OAuth state: ${userId} - User does not exist!`);
      errorResponse(res, 'Invalid user ID in OAuth state', 400);
      return;
    }
    console.log(`✅ OAuth callback - Validated userId: ${userId} (user: ${user.email})`);
    
    const whopCompanyId = user.whopCompanyId;
    console.log(`🏢 User's Whop Company ID: ${whopCompanyId || 'NOT SET'}`);

    // MULTI-TENANT LOGIC: Check if company already has a Discord guild set
    let companyGuildId = null;
    let companyGuildName = null;
    
    if (whopCompanyId) {
      // Find any active Discord connection for this company
      const companyConnection = await DiscordConnection.findOne({
        whopCompanyId,
        isActive: true,
        discordGuildId: { $exists: true, $ne: null },
      }).sort({ connectedAt: 1 }); // Get the FIRST connection (company owner's)
      
      if (companyConnection) {
        companyGuildId = companyConnection.discordGuildId;
        companyGuildName = companyConnection.discordGuildName;
        console.log(`🏢 Found company Discord guild: ${companyGuildName} (${companyGuildId})`);
        console.log(`📌 Team member will inherit this guild instead of their own`);
      } else {
        console.log(`🆕 First user in company connecting Discord - will set company guild`);
      }
    }

    // Determine which guild to use
    let selectedGuildId: string | undefined;
    let selectedGuildName: string | undefined;
    
    if (companyGuildId) {
      // Use company's guild (team member inheriting)
      selectedGuildId = companyGuildId;
      selectedGuildName = companyGuildName || undefined;
      console.log(`✅ Using company guild: ${selectedGuildName} (${selectedGuildId})`);
    } else {
      // First user in company OR no whopCompanyId - use their first guild
      selectedGuildId = guild?.id;
      selectedGuildName = guildInfo?.name || guild?.name;
      console.log(`✅ Using user's guild: ${selectedGuildName} (${selectedGuildId})`);
    }

    // Check if connection already exists for this userId
    let connection = await DiscordConnection.findOne({ userId });

    if (connection) {
      // Update existing connection
      console.log(`🔄 Updating existing Discord connection for userId: ${userId}`);
      connection.discordUserId = discordUser.id;
      connection.discordUsername = `${discordUser.username}#${discordUser.discriminator}`;
      connection.discordGuildId = selectedGuildId;
      connection.discordGuildName = selectedGuildName;
      connection.whopCompanyId = whopCompanyId;
      connection.accessToken = tokenData.access_token;
      connection.refreshToken = tokenData.refresh_token;
      connection.isActive = true;
      connection.connectedAt = new Date();
      await connection.save();
      console.log(`✅ Connection updated - guildId: ${selectedGuildId}, guildName: ${selectedGuildName}`);
    } else {
      // Create new connection
      console.log(`🆕 Creating new Discord connection for userId: ${userId}`);
      connection = await DiscordConnection.create({
        userId: String(userId),
        whopCompanyId,
        discordUserId: discordUser.id,
        discordUsername: `${discordUser.username}#${discordUser.discriminator}`,
        discordGuildId: selectedGuildId,
        discordGuildName: selectedGuildName,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        isActive: true,
        connectedAt: new Date(),
      });
      console.log(`✅ Connection created - guildId: ${selectedGuildId}, guildName: ${selectedGuildName}`);
    }

    // Start bot if not already running
    if (!discordBotService.isActive()) {
      try {
        await discordBotService.startBot();
      } catch (error: any) {
        console.error('Failed to start bot:', error.message);
        // Don't fail the connection if bot fails to start
      }
    }

    // Track telemetry
    await TelemetryEvent.create({
      userId,
      eventType: 'discord_connected',
      eventData: {
        guildId: guild?.id,
        guildName: guildInfo?.name || guild?.name,
        username: discordUser.username,
      },
    });

    // Redirect to frontend callback page with success
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/integrations/discord/callback?success=true`;
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Discord OAuth callback error:', error);
    // Redirect to frontend callback page with error
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/settings/integrations/discord/callback?error=${encodeURIComponent(error.message || 'Failed to connect Discord')}`;
    res.redirect(redirectUrl);
  }
};

/**
 * Disconnect Discord account
 * POST /api/v1/integrations/discord/disconnect
 */
export const disconnectDiscord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const connection = await DiscordConnection.findOne({ userId });

    if (!connection) {
      errorResponse(res, 'Discord connection not found', 404);
      return;
    }

    connection.isActive = false;
    await connection.save();

    successResponse(res, null, 'Discord disconnected successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to disconnect Discord', 500);
  }
};

/**
 * Sync members from Discord
 * POST /api/v1/integrations/discord/sync-members
 */
export const syncDiscordMembers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    // Check connection
    const connection = await DiscordConnection.findOne({ userId, isActive: true });
    if (!connection) {
      errorResponse(res, 'Discord not connected. Please connect first.', 400);
      return;
    }

    // Get user's whopCompanyId
    const user = await User.findById(userId);
    const whopCompanyId = user?.whopCompanyId;

    if (!connection.discordGuildId) {
      errorResponse(res, 'No guild associated with this connection', 400);
      return;
    }

    console.log('Starting Discord member sync for user:', userId);
    console.log('Guild ID:', connection.discordGuildId);
    console.log('Guild Name:', connection.discordGuildName);

    // Validate guild access first
    try {
      const guildInfo = await discordService.getGuild(connection.discordGuildId);
      console.log(`✅ Bot has access to guild: ${guildInfo.name} (${guildInfo.id})`);
    } catch (error: any) {
      console.error('❌ Bot cannot access guild:', error.response?.data || error.message);
      errorResponse(
        res,
        `Discord bot cannot access this guild. Please make sure the bot is invited to the server. Guild ID: ${connection.discordGuildId}`,
        400
      );
      return;
    }

    // Fetch members from Discord
    const members = await discordService.getGuildMembers(connection.discordGuildId, 1000);

    console.log(`Found ${members.length} members from Discord`);

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    // Process each member
    for (const member of members) {
      try {
        // Skip bots
        if (member.user.bot) {
          skippedCount++;
          continue;
        }

        // Check if lead already exists
        const existingLead = await Lead.findOne({
          userId,
          discordUserId: member.user.id,
        });

        const leadData: any = {
          userId,
          name: member.user.username,
          discordUserId: member.user.id,
          discordUsername: `${member.user.username}#${member.user.discriminator}`,
          source: 'discord' as const,
          status: 'new' as const,
          tags: ['discord_member', ...(member.roles || []).map((r: string) => `role:${r}`)],
          notes: `Synced from Discord server: ${connection.discordGuildName}`,
          lastContactDate: member.joined_at ? new Date(member.joined_at) : new Date(),
        };
        
        // Add whopCompanyId if user has one
        if (whopCompanyId) {
          leadData.whopCompanyId = whopCompanyId;
        }

        if (existingLead) {
          // Update existing lead
          Object.assign(existingLead, leadData);
          await existingLead.save();
          updatedCount++;
          console.log('Updated lead:', leadData.discordUsername);
        } else {
          // Create new lead
          await Lead.create(leadData);
          createdCount++;
          console.log('Created lead:', leadData.discordUsername);

          // Track telemetry for first lead
          if (createdCount === 1) {
            await TelemetryEvent.create({
              userId,
              eventType: 'discord_member_synced',
              eventData: {
                guildId: connection.discordGuildId,
                memberCount: members.length,
              },
            });
          }
        }
      } catch (error) {
        console.error('Error processing member:', member.user.id, error);
        skippedCount++;
      }
    }

    // Update connection sync status
    connection.lastSyncAt = new Date();
    connection.syncedMembersCount = createdCount + updatedCount;
    await connection.save();

    console.log('Discord sync completed:', {
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
    });

    successResponse(
      res,
      {
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
        total: members.length,
        lastSyncAt: connection.lastSyncAt,
      },
      `Successfully synced ${createdCount + updatedCount} members from Discord`
    );
  } catch (error: any) {
    console.error('Discord sync error:', error);
    errorResponse(res, error.message || 'Failed to sync Discord members', 500);
  }
};

/**
 * Get Discord messages
 * GET /api/v1/integrations/discord/messages
 */
export const getDiscordMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { leadId, channelId, isRead, limit = 50, page = 1 } = req.query;

    const query: any = { userId };
    if (leadId) query.leadId = leadId;
    if (channelId) query.discordChannelId = channelId;
    if (isRead !== undefined) query.isRead = isRead === 'true';

    const skip = (Number(page) - 1) * Number(limit);

    const messages = await DiscordMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(skip);

    const total = await DiscordMessage.countDocuments(query);

    successResponse(res, {
      messages,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch Discord messages', 500);
  }
};

/**
 * Send Discord message
 * POST /api/v1/integrations/discord/send-message
 */
export const sendDiscordMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { channelId, content, discordUserId } = req.body;

    if (!content) {
      errorResponse(res, 'Message content is required', 400);
      return;
    }

    // Check connection
    const connection = await DiscordConnection.findOne({ userId, isActive: true });
    if (!connection) {
      errorResponse(res, 'Discord not connected', 400);
      return;
    }

    // Check if bot is running
    if (!discordBotService.isActive()) {
      errorResponse(res, 'Discord bot is not active', 500);
      return;
    }

    let sentMessage;

    if (discordUserId) {
      // Send DM
      sentMessage = await discordBotService.sendDM(discordUserId, content, userId);
    } else if (channelId) {
      // Send to channel
      sentMessage = await discordBotService.sendMessage(channelId, content, userId);
    } else {
      errorResponse(res, 'Either channelId or discordUserId is required', 400);
      return;
    }

    successResponse(res, { message: sentMessage }, 'Message sent successfully');
  } catch (error: any) {
    console.error('Send message error:', error);
    errorResponse(res, error.message || 'Failed to send message', 500);
  }
};

/**
 * Mark message as read
 * PATCH /api/v1/integrations/discord/messages/:id/read
 */
export const markMessageAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const message = await DiscordMessage.findOne({ _id: id, userId });

    if (!message) {
      errorResponse(res, 'Message not found', 404);
      return;
    }

    message.isRead = true;
    await message.save();

    successResponse(res, { message }, 'Message marked as read');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to mark message as read', 500);
  }
};

/**
 * Start Discord bot
 * POST /api/v1/integrations/discord/start-bot
 */
export const startBot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (discordBotService.isActive()) {
      successResponse(res, { active: true }, 'Bot is already running');
      return;
    }

    await discordBotService.startBot();
    successResponse(res, { active: true }, 'Bot started successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to start bot', 500);
  }
};

/**
 * Stop Discord bot
 * POST /api/v1/integrations/discord/stop-bot
 */
export const stopBot = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!discordBotService.isActive()) {
      successResponse(res, { active: false }, 'Bot is not running');
      return;
    }

    await discordBotService.stopBot();
    successResponse(res, { active: false }, 'Bot stopped successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to stop bot', 500);
  }
};

export default {
  getConnectionStatus,
  getOAuthURL,
  handleOAuthCallback,
  disconnectDiscord,
  syncDiscordMembers,
  getDiscordMessages,
  sendDiscordMessage,
  markMessageAsRead,
  startBot,
  stopBot,
};
