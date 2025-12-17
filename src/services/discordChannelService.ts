import { Client, ChannelType, PermissionFlagsBits, TextChannel, GuildMember } from 'discord.js';
import { DiscordConnection, DiscordLeadChannel, Lead, DiscordMessage } from '../models/index.js';
import logger from '../config/logger.js';
import { IDiscordLeadChannel } from '../types/index.js';

/**
 * Discord Channel Service - Manages lead-specific channels in Discord servers
 * 
 * This service handles:
 * 1. Creating dedicated channels for each lead
 * 2. Sending messages to lead channels with CRM user attribution
 * 3. Managing channel lifecycle (creation, archiving)
 * 4. Deterministic routing via guildId + channelId
 */

/**
 * Create a dedicated Discord channel for a lead
 * @param leadId - The CRM lead ID
 * @param userId - The CRM user who initiated contact
 * @param whopCompanyId - The Whop company ID for multi-tenant isolation
 * @param client - Discord.js client instance
 * @returns Created DiscordLeadChannel document
 */
export async function createLeadChannel(
  leadId: string,
  userId: string,
  whopCompanyId: string,
  client: Client
): Promise<IDiscordLeadChannel> {
  try {
    // 1. Check if channel already exists for this lead
    const existingChannel = await DiscordLeadChannel.findOne({
      leadId,
      isActive: true,
    });

    if (existingChannel) {
      logger.info(`Channel already exists for lead ${leadId}: ${existingChannel.discordChannelId}`);
      return existingChannel.toObject();
    }

    // 2. Get the Discord connection for this company
    const connection = await DiscordConnection.findOne({
      whopCompanyId,
      isActive: true,
    });

    if (!connection) {
      throw new Error(`No active Discord connection found for company ${whopCompanyId}`);
    }

    if (!connection.discordGuildId) {
      throw new Error(`Discord connection for company ${whopCompanyId} has no guild ID`);
    }

    // 3. Get the Discord guild
    const guild = client.guilds.cache.get(connection.discordGuildId);
    if (!guild) {
      throw new Error(`Bot is not in guild ${connection.discordGuildId}`);
    }

    // 4. Get lead details for channel naming
    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    // 5. Generate channel name (lowercase, no spaces, max 100 chars)
    const channelName = generateChannelName(lead);

    // 6. Create the channel in Discord
    // ✅ FIXED: Removed permissionOverwrites to avoid "Missing Permissions" error
    // Channel inherits default server permissions (industry-standard for SaaS Discord integrations)
    const discordChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      reason: `Lead channel for ${lead.name} (${lead.email || lead.discordUsername})`,
    });

    logger.info(`Created Discord channel: ${discordChannel.name} (${discordChannel.id}) for lead ${leadId}`);

    // 7. Create DiscordLeadChannel mapping in database
    const leadChannel = await DiscordLeadChannel.create({
      userId,
      whopCompanyId,
      leadId,
      discordGuildId: connection.discordGuildId,
      discordChannelId: discordChannel.id,
      discordChannelName: discordChannel.name,
      discordUserId: lead.discordUserId,
      discordUsername: lead.discordUsername,
      channelCreatedAt: new Date(),
      isActive: true,
      messageCount: 0,
    });

    // 8. Update lead with channel ID
    await Lead.findByIdAndUpdate(leadId, {
      discordChannelId: discordChannel.id,
      discordInviteSent: false, // Will be set to true when invite is sent
      discordJoinedChannel: false, // Will be set to true when lead joins
    });

    // 9. Update connection's synced channels count
    await DiscordConnection.findByIdAndUpdate(connection._id, {
      $inc: { syncedChannelsCount: 1 },
    });

    logger.info(`Created lead channel mapping: leadId=${leadId}, channelId=${discordChannel.id}`);

    return leadChannel.toObject();
  } catch (error) {
    logger.error('Error creating lead channel:', error);
    throw error;
  }
}

/**
 * Send a message to a lead's dedicated channel
 * @param leadId - The CRM lead ID
 * @param content - Message content
 * @param userId - The CRM user sending the message
 * @param whopCompanyId - The Whop company ID
 * @param client - Discord.js client instance
 * @returns Discord message ID
 */
export async function sendMessageToChannel(
  leadId: string,
  content: string,
  userId: string,
  whopCompanyId: string,
  client: Client
): Promise<string> {
  try {
    // 1. Find the lead channel
    const leadChannel = await DiscordLeadChannel.findOne({
      leadId,
      whopCompanyId,
      isActive: true,
    });

    if (!leadChannel) {
      throw new Error(`No active channel found for lead ${leadId}`);
    }

    // 2. Get the Discord channel
    const channel = await client.channels.fetch(leadChannel.discordChannelId);
    if (!channel || !channel.isTextBased()) {
      throw new Error(`Channel ${leadChannel.discordChannelId} not found or not text-based`);
    }

    // 3. If lead has Discord user ID, check if they've joined the channel
    const lead = await Lead.findById(leadId);
    
    if (lead && leadChannel.discordUserId && !lead.discordJoinedChannel) {
      await inviteLeadToChannel(
        leadChannel.discordChannelId,
        leadChannel.discordUserId,
        leadChannel.discordGuildId,
        client
      );
      
      // Update invite sent status
      await Lead.findByIdAndUpdate(leadId, {
        discordInviteSent: true,
      });
    }

    // 4. Send the message
    const textChannel = channel as TextChannel;
    const discordMessage = await textChannel.send(content);

    logger.info(`Sent message to lead channel: leadId=${leadId}, channelId=${leadChannel.discordChannelId}, messageId=${discordMessage.id}`);

    // 5. Save message to database (so it appears in UI)
    // ✅ FIXED: Use correct field names (authorDiscordId, authorUsername) matching DiscordMessage schema
    await DiscordMessage.create({
      userId,
      whopCompanyId,
      leadId,
      discordMessageId: discordMessage.id,
      discordChannelId: leadChannel.discordChannelId,
      discordGuildId: leadChannel.discordGuildId,
      authorDiscordId: client.user!.id, // Bot's Discord ID (the one sending the message)
      authorUsername: 'You', // Display name in UI
      content: content,
      direction: 'outgoing', // Message sent FROM CRM TO Discord
      isRead: true, // Mark as read since user sent it
      createdAt: new Date(),
    });

    logger.info(`✅ Saved outgoing message to database: messageId=${discordMessage.id}`);

    // 6. Update channel stats
    await DiscordLeadChannel.findByIdAndUpdate(leadChannel._id, {
      lastMessageAt: new Date(),
      $inc: { messageCount: 1 },
    });

    return discordMessage.id;
  } catch (error) {
    logger.error('Error sending message to channel:', error);
    throw error;
  }
}

/**
 * Invite a Discord user to their lead channel
 * @param channelId - Discord channel ID
 * @param discordUserId - Discord user ID to invite
 * @param guildId - Discord guild ID
 * @param client - Discord.js client instance
 */
async function inviteLeadToChannel(
  channelId: string,
  discordUserId: string,
  guildId: string,
  client: Client
): Promise<void> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || channel.type !== ChannelType.GuildText) {
      throw new Error(`Channel ${channelId} not found or not text-based`);
    }

    const textChannel = channel as TextChannel;

    // Add permission for the lead user to view and send messages
    await textChannel.permissionOverwrites.create(discordUserId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
    });

    logger.info(`Invited Discord user ${discordUserId} to channel ${channelId}`);

    // Send a welcome message mentioning the user
    await textChannel.send(`<@${discordUserId}> You've been invited to this conversation! Feel free to message here.`);
  } catch (error) {
    logger.error(`Error inviting user ${discordUserId} to channel ${channelId}:`, error);
    // Don't throw - this is a best-effort operation
  }
}

/**
 * Mark that a lead has joined their channel
 * @param leadId - The CRM lead ID
 */
export async function markLeadJoinedChannel(leadId: string): Promise<void> {
  try {
    await DiscordLeadChannel.findOneAndUpdate(
      { leadId, isActive: true },
      { discordJoinedChannel: true }
    );
    
    await Lead.findByIdAndUpdate(leadId, {
      discordJoinedChannel: true,
    });

    logger.info(`Marked lead ${leadId} as joined their channel`);
  } catch (error) {
    logger.error(`Error marking lead ${leadId} as joined:`, error);
  }
}

/**
 * Archive a lead channel (mark as inactive)
 * @param leadId - The CRM lead ID
 * @param reason - Reason for archiving
 */
export async function archiveLeadChannel(leadId: string, reason: string): Promise<void> {
  try {
    const leadChannel = await DiscordLeadChannel.findOne({
      leadId,
      isActive: true,
    });

    if (!leadChannel) {
      logger.warn(`No active channel found for lead ${leadId} to archive`);
      return;
    }

    await DiscordLeadChannel.findByIdAndUpdate(leadChannel._id, {
      isActive: false,
    });

    logger.info(`Archived lead channel: leadId=${leadId}, channelId=${leadChannel.discordChannelId}, reason=${reason}`);
  } catch (error) {
    logger.error(`Error archiving lead channel ${leadId}:`, error);
    throw error;
  }
}

/**
 * Generate a valid Discord channel name from lead details
 * @param lead - Lead document
 * @returns Valid Discord channel name
 */
function generateChannelName(lead: any): string {
  let baseName = lead.name || lead.discordUsername || lead.email || 'lead';
  
  // Remove non-alphanumeric characters except hyphens and underscores
  baseName = baseName.toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  // Ensure it doesn't start with a number (Discord requirement)
  if (/^\d/.test(baseName)) {
    baseName = 'lead-' + baseName;
  }

  // Truncate to 100 characters (Discord limit)
  if (baseName.length > 100) {
    baseName = baseName.substring(0, 100);
  }

  // Add timestamp suffix to ensure uniqueness
  const timestamp = Date.now().toString(36); // Base36 for shorter string
  return `${baseName}-${timestamp}`;
}

/**
 * Get lead channel details
 * @param leadId - The CRM lead ID
 * @returns DiscordLeadChannel document or null
 */
export async function getLeadChannel(leadId: string): Promise<IDiscordLeadChannel | null> {
  try {
    const leadChannel = await DiscordLeadChannel.findOne({
      leadId,
      isActive: true,
    });

    return leadChannel ? leadChannel.toObject() : null;
  } catch (error) {
    logger.error(`Error getting lead channel for ${leadId}:`, error);
    throw error;
  }
}

/**
 * Get all lead channels for a company
 * @param whopCompanyId - The Whop company ID
 * @returns Array of DiscordLeadChannel documents
 */
export async function getCompanyChannels(whopCompanyId: string): Promise<IDiscordLeadChannel[]> {
  try {
    const channels = await DiscordLeadChannel.find({
      whopCompanyId,
      isActive: true,
    }).sort({ createdAt: -1 });

    return channels.map(c => c.toObject());
  } catch (error) {
    logger.error(`Error getting company channels for ${whopCompanyId}:`, error);
    throw error;
  }
}
