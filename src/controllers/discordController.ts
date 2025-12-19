import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { discordService } from '../services/discordService.js';
import { discordBotService } from '../services/discordBotService.js';
import { DiscordConnection, Lead, Contact, TelemetryEvent, DiscordMessage, User, DiscordLeadChannel } from '../models/index.js';
import {
  createLeadChannel,
  sendMessageToChannel,
  getLeadChannel,
  getCompanyChannels,
  archiveLeadChannel,
} from '../services/discordChannelService.js';

/**
 * Get Discord connection status
 * GET /api/v1/integrations/discord/status
 */
export const getConnectionStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();

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
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();
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

    // ✅ CRITICAL FIX: Filter guilds to only include ones where our bot has access
    console.log(`📋 User has ${guilds.length} Discord servers`);
    
    const botClient = discordBotService.getClient();
    
    if (!botClient || !discordBotService.isActive()) {
      console.error('❌ Discord bot is not running!');
      errorResponse(
        res,
        'Discord bot is not running. Please contact support.',
        500
      );
      return;
    }
    
    const accessibleGuilds = guilds.filter((g: any) => {
      const hasAccess = botClient.guilds.cache.has(g.id);
      console.log(`   ${hasAccess ? '✅' : '❌'} ${g.name} (${g.id}) - Bot ${hasAccess ? 'HAS' : 'DOES NOT HAVE'} access`);
      return hasAccess;
    });

    if (accessibleGuilds.length === 0) {
      console.error('❌ Bot does not have access to any of user\'s guilds!');
      
      // Generate bot invite URL
      const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${process.env.DISCORD_PERMISSIONS}&scope=bot`;
      
      errorResponse(
        res,
        `Discord bot is not in any of your servers. Please invite the bot first: ${botInviteUrl}`,
        400
      );
      return;
    }

    console.log(`✅ Found ${accessibleGuilds.length} accessible guilds`);

    // ✅ FIXED: Prioritize guilds where user is OWNER or has ADMIN permissions
    // This prevents connecting to servers owned by other users
    const OWNER_PERMISSION = 0x1; // 1 << 0
    const ADMINISTRATOR_PERMISSION = 0x8; // 1 << 3
    
    // Sort guilds: Owner first, then Admin, then others
    const sortedGuilds = accessibleGuilds.sort((a: any, b: any) => {
      const aIsOwner = a.owner === true;
      const bIsOwner = b.owner === true;
      
      if (aIsOwner && !bIsOwner) return -1;
      if (!aIsOwner && bIsOwner) return 1;
      
      const aIsAdmin = (parseInt(a.permissions || '0') & ADMINISTRATOR_PERMISSION) !== 0;
      const bIsAdmin = (parseInt(b.permissions || '0') & ADMINISTRATOR_PERMISSION) !== 0;
      
      if (aIsAdmin && !bIsAdmin) return -1;
      if (!aIsAdmin && bIsAdmin) return 1;
      
      return 0;
    });

    // Use the best guild (owner > admin > member)
    const guild = sortedGuilds[0];
    
    console.log(`🎯 Selected guild: ${guild.name} (Owner: ${guild.owner}, Admin: ${(parseInt(guild.permissions || '0') & ADMINISTRATOR_PERMISSION) !== 0})`);
    console.log('\n📋 All accessible guilds (sorted by priority):');
    sortedGuilds.forEach((g: any, idx: number) => {
      const isOwner = g.owner === true;
      const isAdmin = (parseInt(g.permissions || '0') & ADMINISTRATOR_PERMISSION) !== 0;
      const role = isOwner ? '👑 Owner' : isAdmin ? '🛡️ Admin' : '👤 Member';
      console.log(`   ${idx + 1}. ${g.name} - ${role}`);
    });

    let guildInfo = null;
    if (guild) {
      try {
        guildInfo = await discordService.getGuild(guild.id);
        console.log(`✅ Using guild: ${guildInfo.name} (${guild.id})`);
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

    // ✅ FIX: MULTI-TENANT LOGIC with proper validation
    // Check if company already has a Discord guild set BY ANOTHER ACTIVE USER
    let companyGuildId = null;
    let companyGuildName = null;
    
    if (whopCompanyId) {
      // Find any OTHER active Discord connection for this company (exclude current user)
      const companyConnection = await DiscordConnection.findOne({
        userId: { $ne: userId }, // ✅ FIX: Exclude current user to avoid self-reference
        whopCompanyId,
        isActive: true,
        discordGuildId: { $exists: true, $ne: null },
      }).sort({ connectedAt: 1 }); // Get the FIRST connection (company owner's)
      
      if (companyConnection) {
        // ✅ FIX: Verify bot still has access to this guild before inheriting
        try {
          const botClient = discordBotService.getClient();
          const isAccessible = botClient && botClient.guilds.cache.has(companyConnection.discordGuildId!);
          
          if (isAccessible) {
            companyGuildId = companyConnection.discordGuildId;
            companyGuildName = companyConnection.discordGuildName;
            console.log(`🏢 Found company Discord guild: ${companyGuildName} (${companyGuildId})`);
            console.log(`📌 Team member will inherit this guild instead of their own`);
          } else {
            console.log(`⚠️  Company guild ${companyConnection.discordGuildId} is no longer accessible by bot`);
            console.log(`   Will use user's new guild instead`);
          }
        } catch (error) {
          console.log(`⚠️  Could not verify company guild access, will use user's guild`);
        }
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

    // ✅ FIX: Verify the selected guild is accessible by bot before saving
    if (selectedGuildId) {
      const botClient = discordBotService.getClient();
      const isAccessible = botClient && botClient.guilds.cache.has(selectedGuildId);
      
      if (!isAccessible) {
        console.error(`❌ Bot does not have access to selected guild: ${selectedGuildId}`);
        console.error(`   User must invite bot to this Discord server first`);
        
        const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${process.env.DISCORD_PERMISSIONS}&scope=bot`;
        
        errorResponse(
          res,
          `Discord bot is not in the server "${selectedGuildName}". Please invite the bot first using this link: ${botInviteUrl}`,
          400
        );
        return;
      }
    }

    // Check if connection already exists for this userId
    let connection = await DiscordConnection.findOne({ userId });

    if (connection) {
      // ✅ FIX: Update existing connection with complete data refresh
      console.log(`🔄 Updating existing Discord connection for userId: ${userId}`);
      console.log(`   Previous Guild: ${connection.discordGuildName} (${connection.discordGuildId})`);
      console.log(`   New Guild: ${selectedGuildName} (${selectedGuildId})`);
      
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
      whopCompanyId,  // ✅ Required field
      eventType: 'discord_connected',
      eventData: {
        guildId: guild?.id,
        guildName: guildInfo?.name || guild?.name,
        username: discordUser.username,
      },
    });

    // ✅ FIX: Close the OAuth popup window instead of redirectingg
    // This prevents breaking out of the Whop iframe
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Discord Connected</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            .success-icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              font-size: 2rem;
              margin-bottom: 0.5rem;
            }
            p {
              font-size: 1.1rem;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="success-icon">✅</div>
            <h1>Discord Connected!</h1>
            <p>You can close this window and return to your dashboard.</p>
          </div>
          <script>
            // Send success message to parent window
            if (window.opener) {
              window.opener.postMessage({ type: 'discord-connected', success: true }, '*');
              setTimeout(() => window.close(), 2000);
            } else {
              // If not in popup, redirect back to dashboard
              setTimeout(() => {
                window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard';
              }, 2000);
            }
          </script>
        </body>
      </html>
    `;
    res.send(successHtml);
  } catch (error: any) {
    console.error('Discord OAuth callback error:', error);
    
    // Send error page that closes the popup
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Discord Connection Failed</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 2rem;
            }
            .error-icon {
              font-size: 4rem;
              margin-bottom: 1rem;
            }
            h1 {
              font-size: 2rem;
              margin-bottom: 0.5rem;
            }
            p {
              font-size: 1.1rem;
              opacity: 0.9;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error-icon">❌</div>
            <h1>Connection Failed</h1>
            <p>${error.message || 'Failed to connect Discord'}</p>
            <p style="font-size: 0.9rem; margin-top: 1rem;">You can close this window and try again.</p>
          </div>
          <script>
            // Send error message to parent window
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'discord-connected', 
                success: false, 
                error: '${error.message || 'Failed to connect Discord'}' 
              }, '*');
              setTimeout(() => window.close(), 3000);
            } else {
              setTimeout(() => {
                window.location.href = '${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard';
              }, 3000);
            }
          </script>
        </body>
      </html>
    `;
    res.send(errorHtml);
  }
};

/**
 * Disconnect Discord account
 * POST /api/v1/integrations/discord/disconnect
 */
export const disconnectDiscord = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();

    const connection = await DiscordConnection.findOne({ userId });

    if (!connection) {
      errorResponse(res, 'Discord connection not found', 404);
      return;
    }

    console.log(`🔌 Disconnecting Discord for userId: ${userId}`);
    console.log(`   Old Guild: ${connection.discordGuildName} (${connection.discordGuildId})`);

    // ✅ FIX: Clear all Discord-related data on disconnect
    connection.isActive = false;
    connection.discordGuildId = undefined;
    connection.discordGuildName = undefined;
    connection.accessToken = undefined;
    connection.refreshToken = undefined;
    connection.lastSyncAt = undefined;
    connection.syncedMembersCount = 0;
    connection.syncedChannelsCount = 0;
    
    await connection.save();

    console.log(`✅ Discord connection cleared and deactivated`);

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
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();

    // Check connection
    const connection = await DiscordConnection.findOne({ userId, isActive: true });
    if (!connection) {
      errorResponse(res, 'Discord not connected. Please connect first.', 400);
      return;
    }

    if (!connection.discordGuildId) {
      errorResponse(res, 'No guild associated with this connection', 400);
      return;
    }

    console.log('\n🔄 Starting Discord member sync');
    console.log(`   User ID: ${userId}`);
    console.log(`   Whop Company ID: ${whopCompanyId}`);
    console.log(`   Guild ID: ${connection.discordGuildId}`);
    console.log(`   Guild Name: ${connection.discordGuildName}`);

    // ✅ FIX: Validate bot has access to the guild BEFORE attempting sync
    const botClient = discordBotService.getClient();
    if (!botClient || !discordBotService.isActive()) {
      errorResponse(res, 'Discord bot is not running. Please contact support.', 500);
      return;
    }

    const hasAccess = botClient.guilds.cache.has(connection.discordGuildId);
    if (!hasAccess) {
      console.error(`❌ Bot does not have access to guild: ${connection.discordGuildId}`);
      const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${process.env.DISCORD_PERMISSIONS}&scope=bot`;
      
      errorResponse(
        res,
        `Discord bot is not in the server "${connection.discordGuildName}". Please invite the bot first: ${botInviteUrl}`,
        400
      );
      return;
    }

    console.log(`   ✅ Bot has access to guild`);

    // Validate guild access via Discord API
    try {
      const guildInfo = await discordService.getGuild(connection.discordGuildId);
      console.log(`   ✅ Bot has API access to guild: ${guildInfo.name} (${guildInfo.id})`);
    } catch (error: any) {
      console.error('   ❌ Bot cannot access guild via API:', error.response?.data || error.message);
      errorResponse(
        res,
        `Discord bot cannot access this guild. Please make sure the bot is invited to the server. Guild ID: ${connection.discordGuildId}`,
        400
      );
      return;
    }

    // Fetch members from Discord
    const members = await discordService.getGuildMembers(connection.discordGuildId, 1000);

    console.log(`   📊 Found ${members.length} members from Discord`);

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

        // ✅ MULTI-TENANT FIX: Check if lead already exists for THIS company AND this Discord user
        // This allows the same Discord user to be a lead in multiple companies
        const existingLead = await Lead.findOne({
          whopCompanyId,  // THIS company's leads
          discordUserId: member.user.id,  // For this Discord member
        });
        
        // ✅ MULTI-TENANT: Same Discord user can be a lead in different companies
        // No need to check if owned by other users - each company manages their own leads
        // Example: Discord user "john#1234" can be a lead in Company A AND Company B

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
              whopCompanyId: whopCompanyId || '',  // ✅ Required field (empty string if not set)
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
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();
    const { leadId, channelId, isRead, limit = 50, page = 1 } = req.query;

    // ✅ FIXED: Use whopCompanyId for proper multi-tenant scoping
    const query: any = { whopCompanyId };
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
 * 
 * ✅ UPDATED: Supports both channel-based (new, deterministic) and DM-based (legacy) sending
 * - If leadId is provided: Uses channel-based routing (recommended)
 * - If discordUserId is provided: Uses DM-based routing (legacy, backward compatible)
 */
export const sendDiscordMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();
    const { channelId, content, discordUserId, leadId } = req.body;

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

    const client = discordBotService.getClient();
    if (!client) {
      errorResponse(res, 'Discord client not available', 500);
      return;
    }

    // ✅ whopCompanyId already available from earlier user resolution

    // ✅ NEW: Channel-based sending (deterministic routing)
    if (leadId) {
      console.log(`📤 Sending message to lead ${leadId} via dedicated channel (channel-based routing)`);
      
      // ✅ FIX: Validate bot has access to guild before attempting channel creation
      if (!connection.discordGuildId) {
        errorResponse(res, 'No Discord server linked. Please reconnect Discord.', 400);
        return;
      }

      const hasGuildAccess = client.guilds.cache.has(connection.discordGuildId);
      if (!hasGuildAccess) {
        console.error(`❌ Bot does not have access to guild: ${connection.discordGuildId}`);
        console.error(`   Guild Name: ${connection.discordGuildName || 'Unknown'}`);
        console.error(`   This likely means the connection has stale data from an old server.`);
        console.error(`   User needs to disconnect and reconnect to a valid server.`);
        
        const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${process.env.DISCORD_PERMISSIONS}&scope=bot`;
        
        errorResponse(
          res,
          `Discord bot is not in the server "${connection.discordGuildName || 'Unknown'}". Please disconnect and reconnect Discord, or invite the bot: ${botInviteUrl}`,
          400
        );
        return;
      }

      console.log(`✅ Bot has access to guild: ${connection.discordGuildName} (${connection.discordGuildId})`);
      
      try {
        // ✅ AUTO-CREATE: Check if channel exists, create if not
        let leadChannel = await getLeadChannel(leadId);
        
        if (!leadChannel) {
          console.log(`📢 No channel exists for lead ${leadId}, creating one automatically...`);
          
          try {
            leadChannel = await createLeadChannel(leadId, userId, whopCompanyId || '', client);
            console.log(`✅ Auto-created channel: ${leadChannel.discordChannelName} (${leadChannel.discordChannelId})`);
          } catch (createError: any) {
            console.error('Failed to auto-create channel:', createError);
            errorResponse(res, `Failed to create Discord channel: ${createError.message}`, 500);
            return;
          }
        }
        
        // Now send the message to the channel
        const messageId = await sendMessageToChannel(
          leadId,
          content,
          userId,
          whopCompanyId || '',
          client
        );

        successResponse(res, { messageId, method: 'channel', channelCreated: !leadChannel }, 'Message sent successfully via lead channel');
        return;
      } catch (error: any) {
        console.error('Channel-based send failed:', error);
        errorResponse(res, error.message || 'Failed to send message via channel', 500);
        return;
      }
    }

    // ⚠️ LEGACY: DM-based sending (backward compatibility)
    if (discordUserId) {
      console.log(`📤 Sending DM to Discord user ${discordUserId} (legacy DM-based routing)`);
      
      try {
        const sentMessage = await discordBotService.sendDM(discordUserId, content, userId);

        if (!sentMessage) {
          errorResponse(res, 'Failed to send DM. User may have DMs disabled.', 500);
          return;
        }

        successResponse(res, { message: sentMessage, method: 'dm' }, 'Message sent successfully via DM');
        return;
      } catch (error: any) {
        console.error('DM send failed:', error);
        
        if (error.message?.includes('Cannot send messages to this user')) {
          errorResponse(res, 'Cannot send DM to this user. They may have DMs disabled or blocked the bot.', 400);
        } else {
          errorResponse(res, error.message || 'Failed to send DM', 500);
        }
        return;
      }
    }

    // Neither leadId nor discordUserId provided
    errorResponse(res, 'Either leadId (recommended) or discordUserId (legacy) is required', 400);
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
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();
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

// ========================================
// ✅ NEW: CHANNEL-BASED ENDPOINTS
// ========================================

/**
 * Create a dedicated Discord channel for a lead
 * POST /api/v1/integrations/discord/channels
 * Body: { leadId: string }
 */
export const createChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();
    const { leadId } = req.body;

    if (!leadId) {
      errorResponse(res, 'leadId is required', 400);
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

    const client = discordBotService.getClient();
    if (!client) {
      errorResponse(res, 'Discord client not available', 500);
      return;
    }

    // ✅ whopCompanyId already available from earlier user resolution

    if (!whopCompanyId) {
      errorResponse(res, 'User does not have a Whop company ID', 400);
      return;
    }

    // Verify lead exists and belongs to this user
    const lead = await Lead.findOne({ _id: leadId, userId });
    if (!lead) {
      errorResponse(res, 'Lead not found or does not belong to this user', 404);
      return;
    }

    // Check if channel already exists
    const existingChannel = await getLeadChannel(leadId);
    if (existingChannel) {
      successResponse(res, { channel: existingChannel }, 'Channel already exists for this lead');
      return;
    }

    // Create the channel
    console.log(`📢 Creating Discord channel for lead ${leadId}`);
    const channel = await createLeadChannel(leadId, userId, whopCompanyId, client);

    // Track telemetry
    await TelemetryEvent.create({
      userId,
      whopCompanyId,  // ✅ Required field
      eventType: 'discord_channel_created',
      eventData: {
        leadId,
        channelId: channel.discordChannelId,
        channelName: channel.discordChannelName,
      },
    });

    successResponse(res, { channel }, 'Channel created successfully');
  } catch (error: any) {
    console.error('Create channel error:', error);
    errorResponse(res, error.message || 'Failed to create channel', 500);
  }
};

/**
 * Get channel details for a specific lead
 * GET /api/v1/integrations/discord/channels/:leadId
 */
export const getChannelForLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();
    const { leadId } = req.params;

    // Verify lead belongs to this user
    const lead = await Lead.findOne({ _id: leadId, userId });
    if (!lead) {
      errorResponse(res, 'Lead not found or does not belong to this user', 404);
      return;
    }

    // Get channel
    const channel = await getLeadChannel(leadId);

    if (!channel) {
      successResponse(res, { channel: null }, 'No channel found for this lead');
      return;
    }

    successResponse(res, { channel }, 'Channel retrieved successfully');
  } catch (error: any) {
    console.error('Get channel error:', error);
    errorResponse(res, error.message || 'Failed to get channel', 500);
  }
};

/**
 * Get all channels for the user's company
 * GET /api/v1/integrations/discord/channels
 */
export const getCompanyChannelsList = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ✅ REFACTORED: Use Whop identifiers from request
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();

    // Get user's whopCompanyId (already have it from request, but keeping for consistency)
    // const user = await User.findById(userId);
    // const whopCompanyId = user?.whopCompanyId;

    if (!whopCompanyId) {
      errorResponse(res, 'User does not have a Whop company ID', 400);
      return;
    }

    // Get all channels for this company
    const channels = await getCompanyChannels(whopCompanyId);

    successResponse(res, { channels, count: channels.length }, 'Channels retrieved successfully');
  } catch (error: any) {
    console.error('Get company channels error:', error);
    errorResponse(res, error.message || 'Failed to get channels', 500);
  }
};

/**
 * Archive a channel
 * DELETE /api/v1/integrations/discord/channels/:leadId
 */
export const archiveChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // ✅ REFACTORED: Use Whop identifiers to resolve internal userId
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();
    const { leadId } = req.params;
    const { reason } = req.body;

    // Verify lead belongs to this user
    const lead = await Lead.findOne({ _id: leadId, userId });
    if (!lead) {
      errorResponse(res, 'Lead not found or does not belong to this user', 404);
      return;
    }

    // Archive the channel
    await archiveLeadChannel(leadId, reason || 'Archived by user');

    // Track telemetry
    await TelemetryEvent.create({
      userId,
      whopCompanyId: lead.whopCompanyId || '',  // ✅ Required field (from lead)
      eventType: 'discord_channel_archived',
      eventData: {
        leadId,
        reason: reason || 'Archived by user',
      },
    });

    successResponse(res, null, 'Channel archived successfully');
  } catch (error: any) {
    console.error('Archive channel error:', error);
    errorResponse(res, error.message || 'Failed to archive channel', 500);
  }
};

/**
 * ✅ NEW: Debug endpoint to view all Discord connections and validate state
 * GET /api/v1/integrations/discord/debug
 */
export const debugDiscordConnections = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    
    const userId = user._id.toString();

    // Get all connections for this user (active and inactive)
    const allConnections = await DiscordConnection.find({ userId }).sort({ connectedAt: -1 });
    
    // Get bot status
    const botActive = discordBotService.isActive();
    const botClient = discordBotService.getClient();
    const botGuilds = botClient ? Array.from(botClient.guilds.cache.values()).map(g => ({
      id: g.id,
      name: g.name,
      memberCount: g.memberCount,
    })) : [];

    // Get company connections if in a company
    let companyConnections: any[] = [];
    if (whopCompanyId) {
      companyConnections = await DiscordConnection.find({ 
        whopCompanyId, 
        isActive: true 
      }).sort({ connectedAt: 1 });
    }

    const debugInfo = {
      user: {
        userId,
        email: user.email,
        whopCompanyId,
      },
      bot: {
        active: botActive,
        guildCount: botGuilds.length,
        guilds: botGuilds,
      },
      connections: {
        total: allConnections.length,
        active: allConnections.filter(c => c.isActive).length,
        inactive: allConnections.filter(c => !c.isActive).length,
        list: allConnections.map(c => ({
          id: c._id,
          isActive: c.isActive,
          discordGuildId: c.discordGuildId,
          discordGuildName: c.discordGuildName,
          discordUsername: c.discordUsername,
          whopCompanyId: c.whopCompanyId,
          connectedAt: c.connectedAt,
          botHasAccess: c.discordGuildId ? botClient?.guilds.cache.has(c.discordGuildId) : false,
        })),
      },
      company: {
        whopCompanyId,
        connections: companyConnections.map(c => ({
          userId: c.userId,
          discordGuildId: c.discordGuildId,
          discordGuildName: c.discordGuildName,
          connectedAt: c.connectedAt,
          botHasAccess: c.discordGuildId ? botClient?.guilds.cache.has(c.discordGuildId) : false,
        })),
      },
    };

    successResponse(res, debugInfo, 'Discord connection debug info');
  } catch (error: any) {
    console.error('Debug Discord connections error:', error);
    errorResponse(res, error.message || 'Failed to get debug info', 500);
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
  // ✅ NEW: Channel-based endpoints
  createChannel,
  getChannelForLead,
  getCompanyChannelsList,
  archiveChannel,
  // ✅ NEW: Debug endpoint
  debugDiscordConnections,
};
