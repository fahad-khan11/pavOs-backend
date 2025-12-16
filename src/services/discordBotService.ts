import { Client, GatewayIntentBits, Events, Message, PartialMessage, Partials } from 'discord.js';
import { CONSTANTS } from '../config/constants.js';
import { DiscordMessage } from '../models/DiscordMessage.js';
import { Lead } from '../models/Lead.js';
import { DiscordConnection } from '../models/DiscordConnection.js';
import { TelemetryEvent } from '../models/TelemetryEvent.js';
import { User } from '../models/User.js';
import { getIO } from '../socket/index.js';


class DiscordBotService {
  private client: Client | null = null;
  private isRunning: boolean = false;

  constructor() {
    console.log('Discord Bot Service initialized');
  }

  /**
   * Start the Discord bot
   */
  async startBot() {
    if (this.isRunning) {
      console.log('⚠️  Discord bot is already running');
      return;
    }

    try {
      console.log('\n🚀 Starting Discord bot...');
      console.log('   📡 Initializing client with intents...');

      // Create client with necessary intents and partials for DM support
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.GuildMembers,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent,
        ],
        partials: [
          Partials.Channel, // Required for DM channels
          Partials.Message, // Required for uncached messages
        ],
      });

      // Set up event handlers
      this.setupEventHandlers();

      // Login to Discord
      console.log('   🔐 Logging into Discord...');
      await this.client.login(CONSTANTS.DISCORD_BOT_TOKEN);

      this.isRunning = true;
      console.log('✅ Discord bot started successfully\n');
    } catch (error: any) {
      console.error('❌ Failed to start Discord bot:', error.message);
      console.error('   Stack:', error.stack);
      throw new Error(`Failed to start Discord bot: ${error.message}`);
    }
  }

  /**
   * Stop the Discord bot
   */
  async stopBot() {
    if (!this.isRunning || !this.client) {
      console.log('Discord bot is not running');
      return;
    }

    try {
      console.log('Stopping Discord bot...');
      this.client.destroy();
      this.client = null;
      this.isRunning = false;
      console.log('Discord bot stopped');
    } catch (error: any) {
      console.error('Error stopping Discord bot:', error.message);
      throw new Error(`Failed to stop Discord bot: ${error.message}`);
    }
  }

  /**
   * Check if bot is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get bot client (for direct access if needed)
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Setup all event handlers
   */
  private setupEventHandlers() {
    if (!this.client) return;

    console.log('🔧 Setting up Discord bot event handlers...');

    // Bot ready event
    this.client.on(Events.ClientReady, () => {
      console.log(`✅ Discord bot logged in as ${this.client?.user?.tag}`);
      console.log(`   Bot ID: ${this.client?.user?.id}`);
      console.log(`📡 Bot is now listening for messages (DMs and guild messages)`);
      console.log(`⚠️  IMPORTANT: Make sure MESSAGE CONTENT INTENT is enabled in Discord Developer Portal!`);
    });

    // Debug: Log ALL raw MESSAGE_CREATE events
    this.client.on('raw' as any, (packet: any) => {
      if (packet.t === 'MESSAGE_CREATE') {
        console.log('\n📥 Raw MESSAGE_CREATE event:', {
          author: packet.d.author?.username,
          authorId: packet.d.author?.id,
          hasContent: !!packet.d.content,
          content: packet.d.content || '[NO CONTENT - Enable MESSAGE CONTENT INTENT!]',
          channelId: packet.d.channel_id,
          isDM: !packet.d.guild_id,
        });
      }
    });

    // Message create event (new messages)
    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessageCreate(message);
    });
    console.log('   ✅ MessageCreate handler registered');

    // Message update event (edited messages)
    this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
      await this.handleMessageUpdate(oldMessage, newMessage);
    });

    // Guild member add (new member joins)
    this.client.on(Events.GuildMemberAdd, async (member) => {
      await this.handleMemberJoin(member);
    });

    // Error handling
    this.client.on(Events.Error, (error) => {
      console.error('Discord bot error:', error);
    });

    // Warn event
    this.client.on(Events.Warn, (info) => {
      console.warn('Discord bot warning:', info);
    });
  }

  /**
   * Handle new message creation
   */
  private async handleMessageCreate(message: Message | PartialMessage) {
    try {
      // If message is partial, fetch full message
      if (message.partial) {
        console.log('📩 Received partial message, fetching full message...');
        try {
          message = await message.fetch();
        } catch (error) {
          console.error('❌ Failed to fetch partial message:', error);
          return;
        }
      }

      // Ensure we have author information
      if (!message.author) {
        console.log('⚠️  Message has no author, skipping');
        return;
      }

      console.log(`\n🔔 MESSAGE RECEIVED from ${message.author.tag} (${message.author.id})`);
      console.log(`   Content: "${message.content}"`);
      console.log(`   Is Bot: ${message.author.bot}`);

      // Ignore bot messages
      if (message.author.bot) {
        console.log('   ⏭️  Skipping bot message');
        return;
      }

      // Check if message is a DM
      const isDM = message.channel.isDMBased();
      console.log(`   DM: ${isDM}`);

      let connection;

      if (isDM) {
        // For DMs: Find the Discord connection that matches the RECIPIENT
        // The recipient is the Discord user that this DM was sent TO (not the sender)
        console.log('   🔍 Looking for Discord connection for DM recipient...');
        
        // In a DM, message.channel.recipient is the other party
        // But we need to find which of our users received this DM
        // We'll check if we have a connection with the sender's Discord ID
        // If the sender is messaging our bot user, we need to find who owns this conversation
        
        // For incoming DMs, we need to find which team member is being contacted
        // Strategy: Find active connection first, then look for existing lead for that connection
        console.log('   🔍 Finding active Discord connection...');
        connection = await DiscordConnection.findOne({ isActive: true }).sort({ connectedAt: 1 });
        
        if (!connection) {
          console.log('   ❌ No active Discord connection found');
        } else {
          console.log(`   ✅ Found active connection for userId: ${connection.userId}`);
          
          // ✅ MULTI-TENANT FIX: Check if lead exists for THIS user's connection only
          const existingLead = await Lead.findOne({
            userId: connection.userId, // ✅ Filter by connection owner
            discordUserId: message.author.id,
            source: 'discord',
          }).sort({ updatedAt: -1 });
          
          if (existingLead) {
            console.log(`   ✅ Found existing lead ${existingLead._id} for this user`);
          } else {
            console.log(`   📝 No existing lead found for this user (will create if needed)`);
          }
        }

        if (connection) {
          console.log(`   Connection details: userId=${connection.userId}, guildId=${connection.discordGuildId}`);
        }

        // AUTO-FIX: If no connection found, create one for the most recent user
        if (!connection) {
          console.log('   🔍 No connection found, looking for most recent user in database...');
          const { User } = await import('../models');
          const mostRecentUser = await User.findOne({}).sort({ lastLogin: -1, createdAt: -1 });

          if (mostRecentUser) {
            console.log(`   💡 AUTO-CREATING Discord connection for most recent user:`);
            console.log(`      - Email: ${mostRecentUser.email}`);
            console.log(`      - UserId: ${String(mostRecentUser._id)}`);
            console.log(`      - Last Login: ${mostRecentUser.lastLogin}`);

            connection = await DiscordConnection.create({
              userId: String(mostRecentUser._id),
              whopCompanyId: mostRecentUser.whopCompanyId,
              discordUserId: message.author.id,
              discordUsername: message.author.tag,
              isActive: true,
              connectedAt: new Date(),
            });
            console.log('   ✅ Discord connection created - Messages will now be saved to this user');
          } else {
            console.log('   ❌ No users found in database - Cannot create connection');
          }
        }
      } else {
        // For guild messages, find connection for specific guild
        console.log(`   🔍 Looking for connection for guild ${message.guildId}...`);
        connection = await this.findConnectionForGuild(message.guildId || '');
        console.log(`   ${connection ? '✅' : '❌'} Guild connection found`);
        
        if (connection) {
          // Validate the connection's userId exists
          const { User } = await import('../models');
          const user = await User.findById(connection.userId);
          if (!user) {
            console.error(`   ❌ Connection userId ${connection.userId} does not exist! Skipping message.`);
            console.error(`   💡 Solution: Disconnect and reconnect Discord to fix the connection.`);
            connection = null;
          } else {
            console.log(`   ✅ Connection userId ${connection.userId} validated - user exists: ${user.email}`);
          }
        }
      }

      if (!connection) {
        console.log('   ⚠️  FINAL: No connection exists - message will NOT be saved');
        console.log('   💡 Solution: Go to app settings and connect Discord\n');
        return;
      }

      // Check if this is from a new lead FIRST, so we can associate the message with the lead
      const connectionUserId = String(connection.userId); // Ensure userId is a string
      console.log(`   👤 Checking/creating lead for userId: ${connectionUserId}...`);
      const lead = await this.checkAndCreateLead(message, connectionUserId);

      // ✅ FIXED: Save message with the LEAD's userId, not the connection's userId
      // This ensures messages are owned by the lead owner, not whoever's bot received it
      const messageUserId = lead ? String(lead.userId) : connectionUserId;
      console.log(`   💾 Saving message to database with userId: ${messageUserId}...`);
      await this.saveMessage(message, messageUserId, 'incoming', lead ? String(lead._id) : undefined);

      console.log('   ✅ Message processing complete\n');

    } catch (error: any) {
      console.error('❌ Error handling message create:', error);
      console.error('   Stack:', error.stack);
    }
  }

  /**
   * Handle message updates (edits)
   */
  private async handleMessageUpdate(
    oldMessage: Message | PartialMessage,
    newMessage: Message | PartialMessage
  ) {
    try {
      // Update message in database if it exists
      const discordMessageId = newMessage.id;

      await DiscordMessage.findOneAndUpdate(
        { discordMessageId },
        {
          content: newMessage.content || oldMessage.content,
          updatedAt: new Date(),
        }
      );

      console.log(`✏️ Message updated: ${discordMessageId}`);
    } catch (error: any) {
      console.error('Error handling message update:', error);
    }
  }

  /**
   * Handle new member joining guild
   */
  private async handleMemberJoin(member: any) {
    try {
      console.log(`👋 New member joined: ${member.user.tag}`);

      // Find connection for this guild
      const connection = await DiscordConnection.findOne({
        discordGuildId: member.guild.id,
        isActive: true,
      });

      if (!connection) return;

      // Get user's whopCompanyId
      const user = await User.findById(connection.userId);
      const whopCompanyId = user?.whopCompanyId;

      // Auto-create lead for new member
      const existingLead = await Lead.findOne({
        userId: connection.userId,
        discordUserId: member.user.id,
      });

      if (!existingLead) {
        const leadData: any = {
          userId: connection.userId,
          name: member.user.username,
          discordUserId: member.user.id,
          discordUsername: member.user.tag,
          source: 'discord',
          status: 'new',
          tags: ['new_member'],
          notes: `Joined server on ${new Date().toISOString()}`,
        };
        
        // Add whopCompanyId if user has one
        if (whopCompanyId) {
          leadData.whopCompanyId = whopCompanyId;
        }
        
        await Lead.create(leadData);

        console.log(`✅ Created new lead for ${member.user.tag}`);

        // Track telemetry
        await TelemetryEvent.create({
          userId: connection.userId,
          eventType: 'lead_created',
          eventData: {
            source: 'discord',
            leadName: member.user.username,
          },
        });
      }
    } catch (error: any) {
      console.error('Error handling member join:', error);
    }
  }

  /**
   * Find connection for a guild
   * Returns the most recent active connection for the guild
   */
  private async findConnectionForGuild(guildId: string) {
    if (!guildId) return null;

    // Get the most recent active connection for this guild
    const connection = await DiscordConnection.findOne({
      discordGuildId: guildId,
      isActive: true,
    }).sort({ connectedAt: -1 }); // Get most recently connected

    if (connection) {
      // Validate that the userId exists in the User collection
      const { User } = await import('../models');
      const user = await User.findById(connection.userId);
      
      if (!user) {
        console.error(`⚠️  Connection found but userId ${connection.userId} does not exist in User collection!`);
        console.error(`   This connection will be skipped. Please reconnect Discord.`);
        return null;
      }
      
      console.log(`   ✅ Connection validated - userId exists: ${connection.userId}`);
    }

    return connection;
  }

  /**
   * Save message to database
   */
 private async saveMessage(
  message: Message,
  userId: string,
  direction: 'incoming' | 'outgoing',
  leadId?: string
) {
  try {
    // If leadId not provided, try to find lead
    let lead = null;
    if (leadId) {
      lead = await Lead.findById(leadId);
    } else {
      // Fallback: find lead by userId and discordUserId
      lead = await Lead.findOne({
        userId,
        discordUserId: message.author.id,
      });
    }

    // Extract attachments
    const attachments = message.attachments.map((att) => ({
      url: att.url,
      filename: att.name || 'unknown',
      size: att.size,
      contentType: att.contentType || 'unknown',
    }));

    // Use findOneAndUpdate with upsert to handle race conditions
    // This ensures we don't get duplicate key errors
    const updateData: any = {
      $set: {
        userId,
        discordChannelId: message.channelId,
        authorDiscordId: message.author.id,
        authorUsername: message.author.tag,
        content: message.content || '[No content]',
        direction,
        metadata: {
          guildId: message.guildId,
          channelName: message.channel.isDMBased() ? 'DM' : (message.channel as any).name,
          timestamp: message.createdTimestamp,
        },
        attachments,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        discordMessageId: message.id,
        isRead: direction === 'outgoing' ? true : false,
        tags: [],
        createdAt: new Date(),
      },
    };

    // Update leadId if provided
    if (lead?._id) {
      updateData.$set.leadId = lead._id.toString();
    }

    const discordMessage = await DiscordMessage.findOneAndUpdate(
      { discordMessageId: message.id },
      updateData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    // Update lead's last contact date
    if (lead) {
      lead.lastContactDate = new Date();
      await lead.save();
    }

    try {
      const { getIO } = await import('../socket/index.js');
      const io = getIO();

      if (lead?._id) {
        const room = `lead:${String(lead._id)}`;
        console.log(`📡 Emitting Socket.IO event to room: ${room}`);
        console.log(`   Message: "${discordMessage.content.substring(0, 30)}..."`);
        console.log(`   Direction: ${discordMessage.direction}`);
        console.log(`   LeadId: ${lead._id}`);
        
        io.to(room).emit("discord:message", {
          ...discordMessage.toJSON(),
        });
        
        console.log(`   ✅ Socket event emitted successfully`);
      } else {
        console.log(`   ⚠️  No lead found - skipping socket emit`);
      }
    } catch (socketError) {
      console.error("❌ Socket.IO emit failed:", socketError);
    }

    console.log(`💾 Saved message to database: ${message.id}${lead ? ` with leadId: ${String(lead._id)}` : ''}`);
    return discordMessage;
  } catch (error: any) {
    // Handle duplicate key errors gracefully
    if (error.code === 11000 || error.codeName === 'DuplicateKey') {
      console.log(`⚠️ Message ${message.id} already exists, fetching existing record`);
      const existing = await DiscordMessage.findOne({ discordMessageId: message.id });
      if (existing) {
        // Update leadId if it was missing
        if (!existing.leadId && leadId) {
          existing.leadId = leadId;
          await existing.save();
        }
        return existing;
      }
    }
    console.error('Error saving message:', error);
    throw error;
  }
}

  /**
   * Check if message is from a new lead and create if needed
   * For DMs, we look for leads across all users to ensure we use the same lead
   */
  private async checkAndCreateLead(message: Message, userId: string) {
    try {
      const isDM = message.channel.isDMBased();
      
      if (isDM) {
        // ✅ CRITICAL FIX: Check if the message sender is ALREADY a user of our app
        // If they have their own Discord connection, they should NOT be a lead for someone else!
        const senderConnection = await DiscordConnection.findOne({
          discordUserId: message.author.id,
          isActive: true,
        });
        
        if (senderConnection) {
          console.log(`   ⚠️  Message sender ${message.author.tag} is ALREADY a user (userId: ${senderConnection.userId})`);
          console.log(`   ⚠️  This is a conversation between TWO app users - skipping lead creation`);
          console.log(`   💡 Both users should message each other through the app, not directly on Discord`);
          return null; // Don't create a lead for another app user
        }
        
        // ✅ MULTI-TENANT FIX: Only check for leads belonging to THIS user
        const userIdStr = String(userId);
        console.log(`   🔍 Checking for existing lead by discordUserId=${message.author.id} for userId=${userIdStr}...`);
        let existingLead = await Lead.findOne({
          userId: userIdStr, // ✅ Filter by current user
          discordUserId: message.author.id,
        });

        if (existingLead) {
          console.log(`   ✅ Found existing lead: ${existingLead._id} (${existingLead.name})`);
          return existingLead;
        }

        // No lead exists, create one for the current user
        console.log(`   🆕 No existing lead found, creating new lead for userId=${userIdStr}...`);
        
        // Get user's whopCompanyId if available
        const user = await User.findById(userIdStr);
        const whopCompanyId = user?.whopCompanyId;
        if (whopCompanyId) {
          console.log(`   📎 Adding whopCompanyId: ${whopCompanyId} to lead`);
        }
        
        const leadData: any = {
          userId: userIdStr,
          name: message.author.username,
          discordUserId: message.author.id,
          discordUsername: message.author.tag,
          source: 'discord',
          status: 'new',
          tags: ['discord_dm'],
          notes: `First contact via Discord DM: "${message.content.substring(0, 100)}..."`,
          lastContactDate: new Date(),
        };
        
        if (whopCompanyId) {
          leadData.whopCompanyId = whopCompanyId;
        }
        
        const newLead = await Lead.create(leadData);

        console.log(`   ✅ Created new lead: ${newLead._id} - ${message.author.tag}`);

        // Track telemetry
        await TelemetryEvent.create({
          userId,
          eventType: 'lead_created',
          eventData: {
            source: 'discord',
            leadName: message.author.username,
            firstMessage: message.content.substring(0, 100),
          },
        });

        return newLead;
      } else {
        // ✅ MULTI-TENANT FIX: Only check for leads belonging to THIS user
        const userIdStr = String(userId);
        console.log(`   🔍 Checking for existing lead by discordUserId=${message.author.id} for userId=${userIdStr}...`);
        
        // First, try to find a lead created from conversation (discord_guild or discord_dm tags)
        let existingLead = await Lead.findOne({
          userId: userIdStr, // ✅ Filter by current user
          discordUserId: message.author.id,
          tags: { $in: ['discord_guild', 'discord_dm'] },
        }).sort({ createdAt: 1 });
        
        // If no conversation lead exists, fall back to any lead (including sync-created)
        if (!existingLead) {
          console.log(`   No conversation lead found, looking for any lead for this user...`);
          existingLead = await Lead.findOne({
            userId: userIdStr, // ✅ Filter by current user
            discordUserId: message.author.id,
          }).sort({ createdAt: 1 });
        }

        if (existingLead) {
          console.log(`   ✅ Found existing lead: ${existingLead._id} (${existingLead.name})`);
          return existingLead;
        }

        // No lead exists, create one for the connection owner (userId from connection)
        console.log(`   🆕 No existing lead found, creating new lead for userId=${userIdStr} (connection owner)...`);
        
        // Get user's whopCompanyId if available
        const user = await User.findById(userIdStr);
        const whopCompanyId = user?.whopCompanyId;
        if (whopCompanyId) {
          console.log(`   📎 Adding whopCompanyId: ${whopCompanyId} to lead`);
        }
        
        const leadData: any = {
          userId: userIdStr,
          name: message.author.username,
          discordUserId: message.author.id,
          discordUsername: message.author.tag,
          source: 'discord',
          status: 'new',
          tags: ['discord_guild'],
          notes: `First contact via Discord guild: "${message.content.substring(0, 100)}..."`,
          lastContactDate: new Date(),
        };
        
        if (whopCompanyId) {
          leadData.whopCompanyId = whopCompanyId;
        }
        
        const newLead = await Lead.create(leadData);

        console.log(`   ✅ Created new lead: ${newLead._id} - ${message.author.tag} for userId: ${userIdStr}`);
        return newLead;
      }
    } catch (error: any) {
      console.error('Error creating lead:', error);
      return null;
    }
  }

  /**
   * Send a message via the bot
   */
  async sendMessage(channelId: string, content: string, userId: string) {
    try {
      if (!this.client || !this.isRunning) {
        throw new Error('Bot is not running');
      }

      const channel = await this.client.channels.fetch(channelId);

      if (!channel || !channel.isTextBased()) {
        throw new Error('Invalid channel');
      }

      // Use type assertion after checking isTextBased
      const textChannel = channel as any;
      const sentMessage = await textChannel.send(content);

      // Find lead for this channel/author if it's a DM
      let leadId: string | undefined;
      if (channel.isDMBased()) {
        // For DMs, find lead by the recipient's Discord ID
        // The recipient is the other user in the DM (not the bot)
        const dmChannel = channel as any; // Type assertion for DM channel
        const recipientId = dmChannel.recipientId || dmChannel.recipient?.id;
        if (recipientId && recipientId !== this.client?.user?.id) {
          // ✅ MULTI-TENANT FIX: Filter by userId
          const lead = await Lead.findOne({ 
            userId: userId, // ✅ Only find leads for this user
            discordUserId: recipientId 
          });
          leadId = lead?._id ? String(lead._id) : undefined;
        }
      }

      // Save sent message to database
      await this.saveMessage(sentMessage as Message, userId, 'outgoing', leadId);

      // Track telemetry
      await TelemetryEvent.create({
        userId,
        eventType: 'discord_message_sent',
        eventData: {
          channelId,
          messageLength: content.length,
        },
      });

      console.log(`📤 Sent message to channel ${channelId}`);
      return sentMessage;
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }

  /**
   * Send DM to a user
   * Uses the same leadId and userId as the incoming messages (the connection owner)
   */
async sendDM(discordUserId: string, content: string, creatorUserId: string) {
  let sentMessage: any = null;
  try {
    if (!this.client || !this.isRunning) {
      throw new Error('Bot is not running');
    }

    const user = await this.client.users.fetch(discordUserId);
    sentMessage = await user.send(content);

    // Find the lead for this Discord user - prioritize conversation-created leads over sync-created leads
    // ✅ MULTI-TENANT FIX: Only find leads belonging to the creator (connection owner)
    console.log(`🔍 Looking for lead for discordUserId=${discordUserId}, creatorUserId=${creatorUserId}...`);
    
    const creatorUserIdStr = String(creatorUserId);
    
    // First, try to find a lead created from conversation (discord_guild or discord_dm tags)
    let lead = await Lead.findOne({
      userId: creatorUserIdStr, // ✅ Filter by creator's userId
      discordUserId: discordUserId,
      tags: { $in: ['discord_guild', 'discord_dm'] },
    }).sort({ createdAt: 1 });
    
    // If no conversation lead exists, fall back to any lead (including sync-created)
    if (!lead) {
      console.log(`   No conversation lead found, looking for any lead for this user...`);
      lead = await Lead.findOne({
        userId: creatorUserIdStr, // ✅ Filter by creator's userId
        discordUserId: discordUserId,
      }).sort({ createdAt: 1 });
    }

    // If no lead exists, create one for the creator (fallback case)
    if (!lead) {
      const creatorConnection = await DiscordConnection.findOne({ userId: creatorUserIdStr, isActive: true });
      if (!creatorConnection) {
        console.error(`❌ No active Discord connection found for userId: ${creatorUserIdStr}`);
        return null;
      }
      
      // Get user's whopCompanyId
      const creatorUser = await User.findById(creatorUserIdStr);
      const whopCompanyId = creatorUser?.whopCompanyId;
      
      console.log(`🆕 No lead found, creating new lead for creatorUserId=${creatorUserIdStr}...`);
      const leadData: any = {
        userId: creatorUserIdStr,
        name: user.username,
        discordUserId: discordUserId,
        discordUsername: user.tag,
        source: 'discord',
        status: 'new',
        tags: ['discord_dm'],
        notes: `Lead created when bot sent first message to user`,
        lastContactDate: new Date(),
      };
      
      // Add whopCompanyId if user has one
      if (whopCompanyId) {
        leadData.whopCompanyId = whopCompanyId;
      }
      
      lead = await Lead.create(leadData);
      console.log(`✅ Created new lead: ${String(lead._id)} with userId: ${lead.userId}`);
    } else {
      console.log(`✅ Found existing lead: ${String(lead._id)} (belongs to userId=${lead.userId})`);
      console.log(`   Using this lead's userId (${lead.userId}) and leadId (${String(lead._id)}) for outgoing message`);
    }

    // Save sent message to database - use the lead's userId and leadId (connection owner)
    const message = sentMessage as Message;
    const leadUserId = String(lead.userId); // Use the lead's userId (connection owner)

    // Extract attachments
    const attachments = message.attachments.map((att) => ({
      url: att.url,
      filename: att.name || 'unknown',
      size: att.size,
      contentType: att.contentType || 'unknown',
    }));

    // Use findOneAndUpdate with upsert to handle race conditions and duplicates
    // This ensures we don't get duplicate key errors
    const updateData: any = {
      $set: {
        userId: leadUserId, // Use lead's userId (connection owner), not creator's userId
        discordChannelId: message.channelId,
        authorDiscordId: message.author.id, // Bot's ID
        authorUsername: message.author.tag, // Bot's username
        content: message.content || content,
        direction: 'outgoing',
        metadata: {
          recipientDiscordId: discordUserId,
          recipientUsername: user.tag,
          channelName: 'DM',
          timestamp: message.createdTimestamp,
        },
        attachments,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        discordMessageId: message.id,
        isRead: true,
        tags: [],
        createdAt: new Date(),
      },
    };

    // Set leadId in $set (not $setOnInsert) so it updates on both insert and update
    if (lead?._id) {
      updateData.$set.leadId = String(lead._id);
    }

    const discordMessage = await DiscordMessage.findOneAndUpdate(
      { discordMessageId: message.id },
      updateData,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    try {
      const { getIO } = await import('../socket/index.js');
      const io = getIO();

      if (lead?._id) {
        io.to(`lead:${String(lead._id)}`).emit("discord:message", {
          ...discordMessage.toJSON(),
        });
      }
    } catch (socketError) {
      console.error("Socket.IO emit failed:", socketError);
    }

    lead.lastContactDate = new Date();
    await lead.save();

    console.log(`📤 Sent DM to user ${discordUserId}`);
    console.log(`   Message saved with userId: ${leadUserId}, leadId: ${String(lead._id)}`);
    return sentMessage;
  } catch (error: any) {
    // Handle duplicate key errors gracefully
    if (error.code === 11000 || error.codeName === 'DuplicateKey') {
      const messageId = sentMessage ? (sentMessage as Message).id : 'unknown';
      console.log(`⚠️ Message ${messageId} already exists, continuing...`);
      // Message already exists, which is fine - just return the sent message if we have it
      if (sentMessage) {
        return sentMessage;
      }
    }
    console.error('Error sending DM:', error);
    throw new Error(`Failed to send DM: ${error.message}`);
  }
}


}

// Export singleton instance
export const discordBotService = new DiscordBotService();
export default discordBotService;
