import { whopService } from './whopService.js';
import { Lead, User, DiscordMessage } from '../models/index.js';
import mongoose from 'mongoose';

/**
 * Whop Direct Messaging Service
 * Handles sending and receiving messages via Whop's Support Channels API
 * 
 * Architecture:
 * 1. Create Support Channel (DM) between company and customer
 * 2. Send messages via Whop Messages API
 * 3. Receive customer replies via webhooks
 */

interface WhopMessageData {
  leadId: string;
  whopCompanyId: string;
  userId: string;
  content: string;
  direction: 'outbound' | 'inbound';
  whopChannelId?: string;
  whopMessageId?: string;
}

class WhopMessageService {
  /**
   * Create or get existing Support Channel (DM) for a lead
   * @param lead - Lead document
   * @param whopCompanyId - Company ID
   */
  private async getOrCreateSupportChannel(lead: any, whopCompanyId: string): Promise<string> {
    try {
      // Return existing channel if already created
      if (lead.whopSupportChannelId) {
        console.log(`✅ Using existing support channel: ${lead.whopSupportChannelId}`);
        return lead.whopSupportChannelId;
      }

      // Create new support channel (DM)
      console.log(`📞 Creating support channel for customer: ${lead.whopCustomerId}`);
      
      const channel = await whopService.whop.supportChannels.create({
        company_id: whopCompanyId,
        user_id: lead.whopCustomerId,
      });

      console.log(`✅ Support channel created: ${channel.id}`);

      // Save channel ID to lead
      lead.whopSupportChannelId = channel.id;
      await lead.save();

      return channel.id;
    } catch (error: any) {
      console.error('❌ Error creating support channel:', error);
      throw new Error(`Failed to create support channel: ${error.message}`);
    }
  }

  /**
   * Send a direct message to a Whop customer
   * @param leadId - Lead ID in your database
   * @param message - Message content (supports Markdown)
   * @param senderUserId - Internal user ID (creator)
   * @param whopCompanyId - Company ID for multi-tenant
   */
  async sendDirectMessage(
    leadId: string,
    message: string,
    senderUserId: string,
    whopCompanyId: string
  ): Promise<any> {
    try {
      // Get lead details
      const lead = await Lead.findOne({
        _id: leadId,
        whopCompanyId,
      });

      if (!lead) {
        throw new Error('Lead not found or does not belong to this company');
      }

      // Verify lead has Whop customer ID
      if (!lead.whopCustomerId) {
        throw new Error('Lead does not have a Whop customer ID. Cannot send Whop DM.');
      }

      console.log(`📤 Sending Whop DM to lead: ${lead.name} (${lead.whopCustomerId})`);

      // Step 1: Get or create support channel
      const channelId = await this.getOrCreateSupportChannel(lead, whopCompanyId);

      // Step 2: Send message via Whop Messages API
      const whopMessage = await whopService.whop.messages.create({
        channel_id: channelId,
        content: message,  // Supports Markdown formatting
      });

      console.log(`✅ Message sent via Whop: ${whopMessage.id}`);

      // Step 3: Save message to database
      const savedMessage = await DiscordMessage.create({
        userId: senderUserId,
        whopCompanyId,
        leadId: lead._id.toString(),
        whopChannelId: channelId,
        whopMessageId: whopMessage.id,
        authorUsername: 'You', // Sender is the business user
        content: message,
        direction: 'outgoing',
        source: 'whop',
        isRead: true, // Outgoing messages are marked as read
        metadata: {
          whopCustomerId: lead.whopCustomerId,
          whopCustomerName: lead.name,
        },
      });

      console.log(`💾 Message saved to database: ${savedMessage._id}`);

      // Step 4: Update lead's last message timestamp
      (lead as any).lastWhopMessageAt = new Date();
      await lead.save();

      // Return message data
      return {
        success: true,
        channelId,
        messageId: whopMessage.id,
        dbMessageId: savedMessage._id.toString(),
        content: message,
        timestamp: new Date(),
        lead: {
          id: lead._id.toString(),
          name: lead.name,
          whopCustomerId: lead.whopCustomerId,
        },
      };
    } catch (error: any) {
      console.error('❌ Error sending Whop DM:', error);
      throw new Error(`Failed to send Whop DM: ${error.message}`);
    }
  }

  /**
   * Get conversation history for a lead from Whop
   * @param leadId - Lead ID
   * @param whopCompanyId - Company ID for scoping
   * @param limit - Number of messages to fetch (default: 50)
   */
  async getConversationHistory(
    leadId: string,
    whopCompanyId: string,
    limit: number = 50
  ): Promise<any[]> {
    try {
      const lead = await Lead.findOne({
        _id: leadId,
        whopCompanyId,
      });

      if (!lead || !(lead as any).whopSupportChannelId) {
        console.log('ℹ️  No conversation history - channel not created yet');
        return [];
      }

      console.log(`📜 Fetching conversation history for channel: ${(lead as any).whopSupportChannelId}`);

      // Fetch messages from Whop API
      const messagesResponse = await whopService.whop.messages.list({
        channel_id: (lead as any).whopSupportChannelId,
        first: limit,
      });

      const messages = messagesResponse.data || [];

      console.log(`✅ Retrieved ${messages.length} messages`);

      // Transform to consistent format
      return messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        createdAt: msg.created_at,
        sender: msg.user?.username || 'Unknown',
        senderUserId: msg.user?.id,
        direction: msg.user?.id === lead.whopCustomerId ? 'inbound' : 'outbound',
      }));
    } catch (error: any) {
      console.error('❌ Error fetching conversation history:', error);
      throw error;
    }
  }

  /**
   * Handle incoming Whop message (from webhook)
   * @param webhookPayload - Payload from Whop message.created webhook
   */
  async handleIncomingMessage(webhookPayload: any): Promise<any> {
    try {
      console.log('📥 Received Whop message webhook');

      const messageData = webhookPayload?.data || webhookPayload;
      const channelId = messageData?.channel_id;
      const messageContent = messageData?.content;
      const senderId = messageData?.user?.id || messageData?.user_id;
      const messageId = messageData?.id;

      if (!channelId || !senderId) {
        console.warn('⚠️  Invalid webhook payload - missing channel_id or sender_id');
        return null;
      }

      // Find lead by support channel ID
      const lead = await Lead.findOne({
        whopSupportChannelId: channelId,
      });

      if (!lead) {
        console.warn(`⚠️  Lead not found for channel: ${channelId}`);
        return null;
      }

      // Check if message is from customer (not from creator/bot)
      const isFromCustomer = senderId === lead.whopCustomerId;

      if (!isFromCustomer) {
        console.log('ℹ️  Message from creator/system - ignoring');
        return null;
      }

      console.log(`📨 Incoming message from customer: ${lead.name}`);

      // Save incoming message to database
      const savedMessage = await DiscordMessage.create({
        userId: lead.userId,
        whopCompanyId: lead.whopCompanyId,
        leadId: lead._id.toString(),
        whopChannelId: channelId,
        whopMessageId: messageId,
        authorUsername: lead.name,
        content: messageContent,
        direction: 'incoming',
        source: 'whop',
        isRead: false, // Incoming messages start as unread
        metadata: {
          whopCustomerId: senderId,
          whopCustomerName: lead.name,
        },
      });

      console.log(`💾 Incoming message saved to database: ${savedMessage._id}`);

      // Update lead's last message timestamp
      (lead as any).lastWhopMessageAt = new Date();
      await lead.save();

      return {
        success: true,
        leadId: lead._id.toString(),
        whopCompanyId: lead.whopCompanyId,
        message: {
          id: messageId,
          dbMessageId: savedMessage._id.toString(),
          content: messageContent,
          senderId,
          channelId,
          direction: 'incoming',
          timestamp: new Date(),
        },
        lead: {
          id: lead._id.toString(),
          name: lead.name,
          email: lead.email,
        },
      };
    } catch (error: any) {
      console.error('❌ Error handling incoming Whop message:', error);
      throw error;
    }
  }

  /**
   * List all support channels for a company
   * @param whopCompanyId - Company ID
   */
  async listSupportChannels(whopCompanyId: string): Promise<any[]> {
    try {
      console.log(`📋 Listing support channels for company: ${whopCompanyId}`);

      const channelsResponse = await whopService.whop.supportChannels.list({
        company_id: whopCompanyId,
      });

      return channelsResponse.data || [];
    } catch (error: any) {
      console.error('❌ Error listing support channels:', error);
      throw error;
    }
  }

  /**
   * Check if Whop messaging API is available
   */
  isWhopMessagingAvailable(): boolean {
    const hasMessages = typeof whopService.whop.messages !== 'undefined';
    const hasSupportChannels = typeof whopService.whop.supportChannels !== 'undefined';
    
    const available = hasMessages && hasSupportChannels;
    console.log('🔍 Whop Messaging API available:', available);
    
    return available;
  }

  /**
   * Poll for new messages from a Whop support channel
   * Used when webhooks are not available
   * @param leadId - Lead ID
   * @param whopCompanyId - Company ID
   */
  async pollForNewMessages(leadId: string, whopCompanyId: string): Promise<void> {
    try {
      const lead = await Lead.findOne({
        _id: leadId,
        whopCompanyId,
      });

      if (!lead || !(lead as any).whopSupportChannelId) {
        return; // No channel yet
      }

      const channelId = (lead as any).whopSupportChannelId;

      // Fetch latest messages from Whop
      const messagesResponse = await whopService.whop.messages.list({
        channel_id: channelId,
        first: 10, // Check last 10 messages
      });

      const whopMessages = messagesResponse.data || [];
      console.log(`📥 Polling found ${whopMessages.length} messages in channel ${channelId}`);

      for (const whopMessage of whopMessages) {
        // Type assertion for Whop message properties
        const message = whopMessage as any;
        
        // ✅ CRITICAL FIX: Check if message already exists in database FIRST
        // This prevents duplicate processing even if sender ID logic fails
        const existingMessage = await DiscordMessage.findOne({
          whopMessageId: message.id,
        });

        if (existingMessage) {
          console.log(`⏭️ Message ${message.id} already in database, skipping`);
          continue; // Already saved
        }

        // Get sender ID (could be in different properties)
        const senderId = message.user_id || message.user?.id || message.author_id;
        
        if (!senderId) {
          console.log(`⏭️ Message ${message.id} has no sender ID, skipping`);
          continue; // Skip if no sender ID
        }

        // ✅ FIX: Check if message is from customer (not from us)
        // The customer's Whop user ID should match the lead's whopCustomerId
        const customerWhopId = (lead as any).whopCustomerId;
        const isFromCustomer = senderId === customerWhopId;

        console.log(`🔍 Message ${message.id}: sender=${senderId}, customer=${customerWhopId}, isFromCustomer=${isFromCustomer}`);

        if (!isFromCustomer) {
          console.log(`⏭️ Skipping outgoing message (not from customer)`);
          continue; // Skip our own messages (sent by company)
        }

        // Save new incoming message
        const savedMessage = await DiscordMessage.create({
          userId: lead.userId,
          whopCompanyId,
          leadId: lead._id.toString(),
          whopChannelId: channelId,
          whopMessageId: message.id,
          authorUsername: lead.name,
          content: message.content || '',
          direction: 'incoming',
          source: 'whop',
          isRead: false,
          metadata: {
            whopCustomerId: senderId,
            whopCustomerName: lead.name,
          },
        });

        console.log(`💾 New message polled and saved: ${savedMessage._id} from lead: ${lead.name}`);

        // Emit Socket.IO event for real-time update
        try {
          const { getIO } = await import('../socket/index.js');
          const io = getIO();

          io.to(whopCompanyId).emit('whop:message', {
            leadId: lead._id.toString(),
            message: {
              id: message.id,
              dbMessageId: savedMessage._id.toString(),
              content: message.content,
              senderId: senderId,
              channelId,
              direction: 'incoming',
              timestamp: new Date(),
            },
            lead: {
              id: lead._id.toString(),
              name: lead.name,
              email: lead.email,
            },
            source: 'whop',
            direction: 'incoming',
            createdAt: new Date().toISOString(),
          });

          io.to(`lead:${lead._id.toString()}`).emit('whop:message', {
            leadId: lead._id.toString(),
            message: {
              id: message.id,
              dbMessageId: savedMessage._id.toString(),
              content: message.content,
            },
            source: 'whop',
            direction: 'incoming',
            createdAt: new Date().toISOString(),
          });

          console.log(`📡 Socket.IO event emitted for polled message`);
        } catch (socketError) {
          console.error('⚠️ Failed to emit Socket.IO event:', socketError);
        }

        // Update lead's last message timestamp
        (lead as any).lastWhopMessageAt = new Date();
        await lead.save();
      }
    } catch (error: any) {
      console.error(`❌ Error polling messages for lead ${leadId}:`, error.message);
    }
  }
}

export const whopMessageService = new WhopMessageService();
export default whopMessageService;
