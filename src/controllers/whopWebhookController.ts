import { Request, Response } from 'express';
import { whopService } from '../services/whopService.js';
import { whopMessageService } from '../services/whopMessageService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { CONSTANTS } from '../config/constants.js';
import { Lead, Contact, User } from '../models/index.js';
import { getIO } from '../socket/index.js';

/**
 * Handle Whop membership webhooks (AUTO-CREATE LEADS)
 * POST /api/v1/whop/webhooks/membership
 * 
 * Events:
 * - membership.created → Auto-create lead
 * - membership.updated → Update lead
 * - membership.deleted / membership.cancelled → Archive lead
 */
export const handleMembershipWebhook = async (req: Request, res: Response) => {
  try {
    const payload = Array.isArray(req.body) ? req.body[0] : req.body;
    
    console.log('🔔 Whop Membership Webhook received:', JSON.stringify(payload, null, 2));

    // Extract event type
    const event = payload?.event || payload?.type || null;
    
    // Extract membership data
    const membership = payload?.data || payload?.membership || payload;
    const user_id = membership?.user_id || membership?.user?.id || null;
    const company_id = membership?.company_id || membership?.company?.id || CONSTANTS.WHOP_COMPANY_ID;
    const membership_id = membership?.id || null;

    if (!event) {
      console.warn('⚠️  Webhook received without event type');
      return successResponse(res, { message: 'Webhook acknowledged' }, '', 202);
    }

    console.log(`📍 Event: ${event} | User: ${user_id} | Company: ${company_id}`);

    // Handle different membership events
    switch (event) {
      case 'membership.created':
      case 'membership_activated':           // ✅ Whop event name
      case 'membership.activated':
      case 'membership.went_valid':
        await handleMembershipCreated(membership, company_id);
        break;

      case 'membership.updated':
      case 'membership_updated':
        await handleMembershipUpdated(membership, company_id);
        break;

      case 'membership.deleted':
      case 'membership.cancelled':
      case 'membership_deactivated':         // ✅ Whop event name
      case 'membership.deactivated':
      case 'membership.went_invalid':
      case 'membership_cancelled':
        await handleMembershipDeleted(membership, company_id);
        break;

      default:
        console.log(`ℹ️  Unhandled event type: ${event}`);
    }

    return successResponse(res, {
      message: 'Membership webhook processed',
      event,
      user_id,
      membership_id,
    });
  } catch (error: any) {
    console.error('❌ Membership Webhook Error:', error);
    return errorResponse(res, 'Failed to process membership webhook', 500);
  }
};

/**
 * Auto-create lead when new membership is created
 */
async function handleMembershipCreated(membership: any, company_id: string) {
  try {
    console.log('✨ Creating lead from new membership...');

    // Extract member details
    const user_id = membership?.user_id || membership?.user?.id;
    const membership_id = membership?.id;
    let user_email = membership?.user?.email || membership?.email;
    let user_name = membership?.user?.username || membership?.user?.name || membership?.username;

    // Fetch full user details from Whop API if needed
    if (!user_email || !user_name) {
      try {
        const whopUser = await whopService.whop.users.retrieve(user_id);
        user_email = user_email || (whopUser as any).email;
        user_name = user_name || (whopUser as any).username || (whopUser as any).name;
      } catch (fetchError) {
        console.warn('⚠️  Could not fetch full user details:', fetchError);
      }
    }

    // Default name if still not found
    if (!user_name) {
      const joinDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      user_name = `Whop Member (${joinDate})`;
    }

    console.log(`👤 Member: ${user_name} (${user_email})`);

    // Find the internal user (creator) for this company
    // We need to associate the lead with a user in our system
    let creator = await User.findOne({ whopCompanyId: company_id });
    
    // ✅ Fallback: If test webhook or company not found, use any user for testing
    let actualCompanyId = company_id;
    if (!creator) {
      console.warn(`⚠️  No user found for company ${company_id}, using fallback for testing...`);
      creator = await User.findOne({}).sort({ createdAt: -1 }); // Get most recent user
      
      if (!creator) {
        console.error(`❌ No users in system at all!`);
        return;
      }
      // Use the fallback user's REAL whopCompanyId instead of fake test ID
      actualCompanyId = creator.whopCompanyId;
      console.log(`✅ Using fallback user: ${creator.email} (whopCompanyId: ${actualCompanyId})`);
    }

    const userId = creator._id.toString();

    // Check if lead already exists
    let existingLead = await Lead.findOne({
      whopCompanyId: actualCompanyId,
      $or: [
        { whopMembershipId: membership_id },
        { whopCustomerId: user_id },
        ...(user_email ? [{ email: user_email.toLowerCase() }] : []),
      ],
    });

    if (existingLead) {
      console.log(`ℹ️  Lead already exists: ${existingLead.name}`);
      // Update existing lead to 'won' status
      existingLead.status = 'won';
      existingLead.whopMembershipId = membership_id;
      existingLead.whopCustomerId = user_id;
      if (!existingLead.wonAt) existingLead.wonAt = new Date();
      await existingLead.save();
      console.log(`✅ Updated existing lead to 'won' status`);
      return;
    }

    // Create new lead
    const newLead = await Lead.create({
      userId,
      whopCompanyId: actualCompanyId, // Use real company ID, not fake test ID
      name: user_name,
      email: user_email || undefined,
      source: 'whop',
      status: 'won', // Whop members are paying customers
      whopMembershipId: membership_id,
      whopCustomerId: user_id,
      wonAt: new Date(),
      tags: ['Whop Customer', 'Auto-imported'],
      notes: `Automatically created from Whop membership\nMembership ID: ${membership_id}\nJoined: ${new Date().toLocaleDateString()}`,
    });

    console.log(`✅ Lead created automatically: ${newLead.name} (ID: ${newLead._id})`);

    // Emit Socket.IO event for real-time update
    const io = getIO();
    io.to(actualCompanyId).emit('lead:created', { lead: newLead });

  } catch (error) {
    console.error('❌ Error creating lead from membership:', error);
  }
}

/**
 * Update lead when membership is updated
 */
async function handleMembershipUpdated(membership: any, company_id: string) {
  try {
    console.log('🔄 Updating lead from membership update...');

    const membership_id = membership?.id;
    const user_id = membership?.user_id || membership?.user?.id;

    // Find existing lead
    const lead = await Lead.findOne({
      whopCompanyId: company_id,
      $or: [
        { whopMembershipId: membership_id },
        { whopCustomerId: user_id },
      ],
    });

    if (!lead) {
      console.log(`ℹ️  No lead found for membership ${membership_id}, creating new one...`);
      await handleMembershipCreated(membership, company_id);
      return;
    }

    // Update lead details if changed
    const user_email = membership?.user?.email || membership?.email;
    const user_name = membership?.user?.username || membership?.user?.name || membership?.username;

    if (user_email && lead.email !== user_email) {
      lead.email = user_email;
    }
    if (user_name && lead.name !== user_name) {
      lead.name = user_name;
    }

    await lead.save();
    console.log(`✅ Lead updated: ${lead.name}`);

  } catch (error) {
    console.error('❌ Error updating lead:', error);
  }
}

/**
 * Archive/mark lead as lost when membership is deleted/cancelled
 */
async function handleMembershipDeleted(membership: any, company_id: string) {
  try {
    console.log('🗑️  Archiving lead from membership deletion...');

    const membership_id = membership?.id;
    const user_id = membership?.user_id || membership?.user?.id;

    // Find existing lead
    const lead = await Lead.findOne({
      whopCompanyId: company_id,
      $or: [
        { whopMembershipId: membership_id },
        { whopCustomerId: user_id },
      ],
    });

    if (!lead) {
      console.log(`ℹ️  No lead found for deleted membership ${membership_id}`);
      return;
    }

    // Mark as lost (customer cancelled)
    lead.status = 'lost';
    lead.notes = (lead.notes || '') + `\n\n[${new Date().toLocaleDateString()}] Membership cancelled/deleted`;
    
    await lead.save();
    console.log(`✅ Lead marked as lost: ${lead.name}`);

  } catch (error) {
    console.error('❌ Error archiving lead:', error);
  }
}

/**
 * Handle Whop app install / membership webhooks.
 * Whop's dashboard "Test webhook" sometimes sends an array of events
 * (e.g. [{ id: 'hook_...', event: 'membership_activated', ... }]).
 * The original handler expected a flat body with `user_id` which causes
 * a 400 when the test payload is the array form. This handler is defensive
 * and will attempt to extract a user id from a few common locations.
 */
export const handleAppInstall = async (req: Request, res: Response) => {
  try {
    // Normalize payload (handle array-style test payloads from Whop dashboard)
    const payload = Array.isArray(req.body) ? req.body[0] : req.body;

    // Extract user_id from multiple possible locations
    const user_id =
      payload?.user_id ||
      payload?.user?.id ||
      payload?.data?.user_id ||
      payload?.data?.user?.id ||
      payload?.payload?.user_id ||
      payload?.payload?.user?.id ||
      payload?.membership?.user_id ||
      payload?.membership?.user?.id ||
      payload?.customer?.id ||
      null;

    // Extract company_id from multiple possible locations
    const company_id =
      payload?.company_id ||
      payload?.company?.id ||
      payload?.data?.company_id ||
      payload?.data?.company?.id ||
      payload?.payload?.company_id ||
      payload?.payload?.company?.id ||
      payload?.membership?.company_id ||
      payload?.membership?.company?.id ||
      CONSTANTS.WHOP_COMPANY_ID || // Fallback to default company ID
      null;

    // If no user_id, reject the webhook
    if (!user_id) {
      console.warn('⚠️ Webhook received without user_id:', JSON.stringify(payload));
      return successResponse(res, {
        message: 'Webhook received (no user_id in payload)',
      }, 'Test webhook acknowledged', 202);
    }

    // If no company_id, reject the webhook
    if (!company_id) {
      console.warn('⚠️ Webhook received without company_id:', JSON.stringify(payload));
      return errorResponse(res, 'Missing company_id in webhook payload', 400);
    }

    // Get or create support channel for the user
    let channel = await whopService.getSupportChannel(user_id, company_id);

    if (!channel) {
      channel = await whopService.createSupportChannel(user_id, company_id);
    }

    // Extract channel ID from response (handles different SDK response shapes)
    const channelAny: any = channel;
    const channelId = channelAny?.id || channelAny?.channel_id || channelAny?.data?.id || null;

    if (!channelId) {
      console.error('❌ Failed to get support channel ID:', JSON.stringify(channel));
      return errorResponse(res, 'Failed to create or retrieve support channel', 500);
    }

    // Send comprehensive onboarding message to the support channel
    const onboardingMessage = `Welcome to PaveOS! 🎉

We're excited to have you on board. PaveOS helps you manage your creator business with powerful CRM features.

**Getting Started:**
1. Sync your Whop customers to automatically create contacts and leads
2. Connect Discord to track conversations and manage leads
3. Set up your pipeline to track deals from start to finish
4. Use Analytics to understand your business performance

**Key Features:**
• Automatic customer sync from Whop
• Discord DM tracking and lead management
• Deal pipeline and revenue tracking
• Contact management and notes

Need help? Just reply to this message and our team will assist you.`;

    try {
      await whopService.sendSupportMessage(channelId, onboardingMessage);
      console.log(`✅ Onboarding message sent to channel ${channelId} for user ${user_id}`);
    } catch (messageError: any) {
      console.error('❌ Failed to send onboarding message:', messageError);
      // Don't fail the webhook if message sending fails
    }

    console.log(`✅ Onboarding webhook processed for user: ${user_id}`);

    return successResponse(res, {
      message: 'Onboarding message sent successfully',
      user_id,
      channel_id: channelId,
    });
  } catch (error: any) {
    console.error('❌ Webhook Error:', error?.message || error);
    return errorResponse(res, 'Failed to process webhook', 500);
  }
};
// Temporary file - content to be merged into whopWebhookController.ts

/**
 * Handle Whop message webhooks (RECEIVE CUSTOMER REPLIES)
 * POST /api/v1/whop/webhooks/messages
 * 
 * Events:
 * - message.created → Customer sent a reply
 * - message.updated → Message was edited
 * - message.deleted → Message was deleted
 */
export const handleMessageWebhook = async (req: Request, res: Response) => {
  try {
    const payload = Array.isArray(req.body) ? req.body[0] : req.body;
    
    console.log('🔔 Whop Message Webhook received:', JSON.stringify(payload, null, 2));

    // Extract event type
    const event = payload?.event || payload?.type || null;
    
    if (!event) {
      console.warn('⚠️  Webhook received without event type');
      return successResponse(res, { message: 'Webhook acknowledged' }, '', 202);
    }

    console.log(`📍 Message Event: ${event}`);

    // Handle different message events
    switch (event) {
      case 'message.created':
      case 'message_created':
        await handleMessageCreated(payload);
        break;

      case 'message.updated':
      case 'message_updated':
        console.log('ℹ️  Message updated - no action needed');
        break;

      case 'message.deleted':
      case 'message_deleted':
        console.log('ℹ️  Message deleted - no action needed');
        break;

      default:
        console.log(`ℹ️  Unhandled message event: ${event}`);
    }

    return successResponse(res, {
      message: 'Message webhook processed',
      event,
    });
  } catch (error: any) {
    console.error('❌ Message Webhook Error:', error);
    return errorResponse(res, 'Failed to process message webhook', 500);
  }
};

/**
 * Handle incoming message from customer
 */
async function handleMessageCreated(payload: any) {
  try {
    console.log('📨 Processing incoming message...');
    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    // Process message via whopMessageService
    const result = await whopMessageService.handleIncomingMessage(payload);

    if (!result) {
      console.log('ℹ️  Message not processed (likely from creator/system)');
      return;
    }

    console.log(`✅ Incoming message processed for lead: ${result.leadId}`);
    console.log(`💾 Message saved with DB ID: ${result.message.dbMessageId}`);

    // ✅ Emit Socket.IO event for real-time update
    try {
      const io = getIO();
      
      // Emit to company room (all users in this company)
      io.to(result.whopCompanyId).emit('whop:message', {
        leadId: result.leadId,
        message: result.message,
        lead: result.lead,
        source: 'whop',
        direction: 'incoming',
        createdAt: new Date().toISOString(),
      });
      
      // Also emit to specific lead room (if anyone is viewing this lead)
      io.to(`lead:${result.leadId}`).emit('whop:message', {
        leadId: result.leadId,
        message: result.message,
        lead: result.lead,
        source: 'whop',
        direction: 'incoming',
        createdAt: new Date().toISOString(),
      });
      
      console.log(`📡 Socket.IO event emitted for lead: ${result.leadId}`);
    } catch (socketError) {
      console.error('⚠️ Failed to emit Socket.IO event (non-critical):', socketError);
    }

  } catch (error) {
    console.error('❌ Error handling message.created:', error);
  }
}
