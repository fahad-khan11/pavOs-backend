import { Client, ChannelType, PermissionFlagsBits, TextChannel, ThreadChannel, GuildMember } from 'discord.js';
import { DiscordConnection, DiscordLeadChannel, Lead, DiscordMessage } from '../models/index.js';
import logger from '../config/logger.js';
import { IDiscordLeadChannel } from '../types/index.js';

/**
 * Discord Channel Service - Thread-Based Lead Management
 * 
 * This service handles:
 * 1. Creating private threads for each lead inside a shared intake channel
 * 2. Sending messages to lead threads with CRM user attribution
 * 3. Managing thread lifecycle (creation, archiving)
 * 4. Permission isolation: Only bot, staff, and the specific lead can access their thread
 * 
 * Architecture:
 * - One intake channel (e.g., #leads) per Discord server
 * - Each lead gets a private thread inside the intake channel
 * - Database schema unchanged: discordChannelId stores the thread ID
 * - No DM routing by default (only if lead explicitly opts in)
 */

// Intake channel name - can be configured via env variable
const INTAKE_CHANNEL_NAME = process.env.DISCORD_INTAKE_CHANNEL_NAME || 'leads';

/**
 * Create a dedicated Discord thread for a lead inside the intake channel
 * @param leadId - The CRM lead ID
 * @param userId - The CRM user who initiated contact
 * @param whopCompanyId - The Whop company ID for multi-tenant isolation
 * @param client - Discord.js client instance
 * @returns Created DiscordLeadChannel document (with thread ID as discordChannelId)
 */
export async function createLeadChannel(
  leadId: string,
  userId: string,
  whopCompanyId: string,
  client: Client
): Promise<IDiscordLeadChannel> {
  try {
    // 1. Check if thread already exists for this lead
    const existingChannel = await DiscordLeadChannel.findOne({
      leadId,
      isActive: true,
    });

    if (existingChannel) {
      logger.info(`Thread already exists for lead ${leadId}: ${existingChannel.discordChannelId}`);
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

    // 4. Find or create the intake channel
    let intakeChannel = guild.channels.cache.find(
      channel => channel.name === INTAKE_CHANNEL_NAME && channel.type === ChannelType.GuildText
    ) as TextChannel | undefined;

    if (!intakeChannel) {
      logger.info(`Intake channel "${INTAKE_CHANNEL_NAME}" not found, creating it...`);
      
      // Create the intake channel with proper permissions
      const permissionOverwrites: any[] = [
        {
          // Deny @everyone from viewing the intake channel (makes it private)
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          // Allow bot to view, send messages, and manage threads
          id: client.user!.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.CreatePublicThreads,
            PermissionFlagsBits.CreatePrivateThreads,
            PermissionFlagsBits.ManageThreads,
          ],
        },
      ];

      // Add CRM Staff role if configured
      const crmStaffRoleId = process.env.DISCORD_CRM_STAFF_ROLE_ID;
      if (crmStaffRoleId) {
        const staffRole = guild.roles.cache.get(crmStaffRoleId);
        if (staffRole) {
          permissionOverwrites.push({
            id: crmStaffRoleId,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageThreads,
            ],
          });
          logger.info(`Adding CRM Staff role ${staffRole.name} to intake channel permissions`);
        }
      }

      intakeChannel = await guild.channels.create({
        name: INTAKE_CHANNEL_NAME,
        type: ChannelType.GuildText,
        reason: 'Intake channel for lead threads',
        permissionOverwrites,
      }) as TextChannel;

      logger.info(`✅ Created intake channel: ${intakeChannel.name} (${intakeChannel.id})`);
    }

    // 5. Get lead details for thread naming
    const lead = await Lead.findById(leadId);
    if (!lead) {
      throw new Error(`Lead ${leadId} not found`);
    }

    // 6. Generate thread name
    const threadName = generateThreadName(lead);

    // 7. Create a private thread inside the intake channel
    const thread = await intakeChannel.threads.create({
      name: threadName,
      autoArchiveDuration: 10080, // 7 days (max for non-boosted servers)
      type: ChannelType.PrivateThread, // Private thread (only visible to invited members)
      reason: `Private lead thread for ${lead.name} (${lead.email || lead.discordUsername})`,
      invitable: false, // Don't allow members to invite others
    });

    logger.info(`Created private thread: ${thread.name} (${thread.id}) for lead ${leadId}`);

    // 8. Set permissions on the thread
    // Note: Private threads inherit permissions from parent channel, but we can add specific members
    
    // Add bot (already has access via parent channel permissions)
    await thread.members.add(client.user!.id);

    // Add CRM Staff role members if configured
    const crmStaffRoleId = process.env.DISCORD_CRM_STAFF_ROLE_ID;
    if (crmStaffRoleId) {
      const staffRole = guild.roles.cache.get(crmStaffRoleId);
      if (staffRole) {
        // Add all members with the staff role to the thread
        const staffMembers = guild.members.cache.filter(member => 
          member.roles.cache.has(crmStaffRoleId)
        );
        
        for (const [, member] of staffMembers) {
          try {
            await thread.members.add(member.id);
            logger.info(`Added staff member ${member.user.username} to thread ${thread.id}`);
          } catch (error) {
            logger.warn(`Could not add staff member ${member.user.username} to thread:`, error);
          }
        }
      }
    }

    // Add lead's Discord user if they have one
    if (lead.discordUserId) {
      try {
        const member = await guild.members.fetch(lead.discordUserId);
        if (member) {
          await thread.members.add(lead.discordUserId);
          logger.info(`Added lead user ${lead.discordUsername} to thread ${thread.id}`);
          
          // Send welcome message
          await thread.send(`<@${lead.discordUserId}> Welcome! This is your private conversation thread. Feel free to message here.`);
        }
      } catch (error) {
        logger.warn(`Could not add lead user ${lead.discordUserId} to thread (not in guild or bot lacks permissions)`);
      }
    } else {
      // Send initial message to activate the thread
      await thread.send(`🧵 Lead thread created for **${lead.name}**\nLead ID: ${leadId}\nStart the conversation by sending a message from Whop UI.`);
    }

    // 9. Create DiscordLeadChannel mapping in database
    // ✅ IMPORTANT: discordChannelId now stores the THREAD ID (not a channel ID)
    const leadChannel = await DiscordLeadChannel.create({
      userId,
      whopCompanyId,
      leadId,
      discordGuildId: connection.discordGuildId,
      discordChannelId: thread.id, // ✅ Thread ID stored here
      discordChannelName: thread.name,
      discordUserId: lead.discordUserId,
      discordUsername: lead.discordUsername,
      channelCreatedAt: new Date(),
      isActive: true,
      messageCount: 0,
    });

    // 10. Update lead with thread ID
    await Lead.findByIdAndUpdate(leadId, {
      discordChannelId: thread.id, // ✅ Thread ID stored here
      discordInviteSent: lead.discordUserId ? true : false,
      discordJoinedChannel: lead.discordUserId ? true : false,
    });

    // 11. Update connection's synced channels count
    await DiscordConnection.findByIdAndUpdate(connection._id, {
      $inc: { syncedChannelsCount: 1 },
    });

    logger.info(`✅ Created lead thread mapping: leadId=${leadId}, threadId=${thread.id}`);

    return leadChannel.toObject();
  } catch (error) {
    logger.error('Error creating lead thread:', error);
    throw error;
  }
}

/**
 * Send a message to a lead's dedicated thread
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
    // 1. Find the lead thread
    const leadChannel = await DiscordLeadChannel.findOne({
      leadId,
      whopCompanyId,
      isActive: true,
    });

    if (!leadChannel) {
      throw new Error(`No active thread found for lead ${leadId}`);
    }

    // 2. Get the Discord thread (stored as discordChannelId in database)
    const thread = await client.channels.fetch(leadChannel.discordChannelId);
    
    if (!thread) {
      throw new Error(`Thread ${leadChannel.discordChannelId} not found`);
    }

    // 3. Verify it's a thread channel
    if (!thread.isThread()) {
      throw new Error(`Channel ${leadChannel.discordChannelId} is not a valid thread`);
    }

    const threadChannel = thread as ThreadChannel;

    // 4. Unarchive thread if it's archived
    if (threadChannel.archived) {
      logger.info(`Unarchiving thread ${threadChannel.id} for lead ${leadId}`);
      await threadChannel.setArchived(false);
    }

    // 5. Check if lead user should be invited to thread (if not already)
    const lead = await Lead.findById(leadId);
    
    if (lead && leadChannel.discordUserId && !lead.discordJoinedChannel) {
      await inviteLeadToThread(
        threadChannel,
        leadChannel.discordUserId,
        leadChannel.discordGuildId,
        client
      );
      
      // Update invite sent status
      await Lead.findByIdAndUpdate(leadId, {
        discordInviteSent: true,
        discordJoinedChannel: true,
      });
    }

    // 6. Send the message to the thread
    const discordMessage = await threadChannel.send(content);

    logger.info(`Sent message to lead thread: leadId=${leadId}, threadId=${leadChannel.discordChannelId}, messageId=${discordMessage.id}`);

    // 7. Save message to database (so it appears in UI)
    await DiscordMessage.create({
      userId,
      whopCompanyId,
      leadId,
      discordMessageId: discordMessage.id,
      discordChannelId: leadChannel.discordChannelId,
      discordGuildId: leadChannel.discordGuildId,
      authorDiscordId: client.user!.id, // Bot's Discord ID
      authorUsername: 'You', // Display name in UI
      content: content,
      direction: 'outgoing', // Message sent FROM CRM TO Discord
      isRead: true, // Mark as read since user sent it
      createdAt: new Date(),
    });

    logger.info(`✅ Saved outgoing message to database: messageId=${discordMessage.id}`);

    // 8. Update thread stats
    await DiscordLeadChannel.findByIdAndUpdate(leadChannel._id, {
      lastMessageAt: new Date(),
      $inc: { messageCount: 1 },
    });

    return discordMessage.id;
  } catch (error) {
    logger.error('Error sending message to thread:', error);
    throw error;
  }
}

/**
 * Invite a Discord user to their lead thread
 * @param thread - Discord thread channel
 * @param discordUserId - Discord user ID to invite
 * @param guildId - Discord guild ID
 * @param client - Discord.js client instance
 */
async function inviteLeadToThread(
  thread: ThreadChannel,
  discordUserId: string,
  guildId: string,
  client: Client
): Promise<void> {
  try {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Verify user is in the guild
    const member = await guild.members.fetch(discordUserId);
    if (!member) {
      throw new Error(`User ${discordUserId} not found in guild`);
    }

    // Add user to the thread
    await thread.members.add(discordUserId);

    logger.info(`Invited Discord user ${discordUserId} to thread ${thread.id}`);

    // Send a welcome message mentioning the user
    await thread.send(`<@${discordUserId}> You've been invited to this conversation! Feel free to message here.`);
  } catch (error) {
    logger.error(`Error inviting user ${discordUserId} to thread ${thread.id}:`, error);
    // Don't throw - this is a best-effort operation
  }
}

/**
 * Mark that a lead has joined their thread
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

    logger.info(`Marked lead ${leadId} as joined their thread`);
  } catch (error) {
    logger.error(`Error marking lead ${leadId} as joined:`, error);
  }
}

/**
 * Archive a lead thread (mark as inactive and archive in Discord)
 * @param leadId - The CRM lead ID
 * @param reason - Reason for archiving
 * @param client - Discord.js client instance (optional, for archiving in Discord)
 */
export async function archiveLeadChannel(
  leadId: string, 
  reason: string,
  client?: Client
): Promise<void> {
  try {
    const leadChannel = await DiscordLeadChannel.findOne({
      leadId,
      isActive: true,
    });

    if (!leadChannel) {
      logger.warn(`No active thread found for lead ${leadId} to archive`);
      return;
    }

    // Archive in Discord if client is provided
    if (client) {
      try {
        const thread = await client.channels.fetch(leadChannel.discordChannelId);
        if (thread && thread.isThread()) {
          const threadChannel = thread as ThreadChannel;
          await threadChannel.setArchived(true, reason);
          logger.info(`Archived thread in Discord: ${leadChannel.discordChannelId}`);
        }
      } catch (error) {
        logger.warn(`Could not archive thread ${leadChannel.discordChannelId} in Discord:`, error);
        // Continue with database archive even if Discord archive fails
      }
    }

    // Mark as inactive in database
    await DiscordLeadChannel.findByIdAndUpdate(leadChannel._id, {
      isActive: false,
    });

    logger.info(`Archived lead thread: leadId=${leadId}, threadId=${leadChannel.discordChannelId}, reason=${reason}`);
  } catch (error) {
    logger.error(`Error archiving lead thread ${leadId}:`, error);
    throw error;
  }
}

/**
 * Generate a valid Discord thread name from lead details
 * @param lead - Lead document
 * @returns Valid Discord thread name
 */
function generateThreadName(lead: any): string {
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

  // Add emoji for visual distinction
  return `🧵 ${baseName}`;
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
