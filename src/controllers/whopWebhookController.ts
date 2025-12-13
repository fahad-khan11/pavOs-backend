import { Request, Response } from 'express';
import { whopService } from '../services/whopService.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { CONSTANTS } from '../config/constants.js';

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
