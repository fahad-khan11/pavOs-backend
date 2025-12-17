import express from 'express';
import {
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
} from '../controllers/discordController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// OAuth callback doesn't require authentication (it's the callback from Discord)
router.get('/callback', handleOAuthCallback);
router.post('/callback', handleOAuthCallback);

// All other routes require authentication
router.use(authenticate);

// Connection management
router.get('/status', getConnectionStatus);
router.get('/oauth-url', getOAuthURL);
router.post('/disconnect', disconnectDiscord);

// Member sync
router.post('/sync-members', syncDiscordMembers);

// Messages
router.get('/messages', getDiscordMessages);
router.post('/send-message', sendDiscordMessage);
router.patch('/messages/:id/read', markMessageAsRead);

// ✅ NEW: Channel management (deterministic routing)
router.post('/channels', createChannel); // Create channel for a lead
router.get('/channels', getCompanyChannelsList); // Get all company channels
router.get('/channels/:leadId', getChannelForLead); // Get channel for specific lead
router.delete('/channels/:leadId', archiveChannel); // Archive a channel

// Bot control
router.post('/start-bot', startBot);
router.post('/stop-bot', stopBot);

export default router;
