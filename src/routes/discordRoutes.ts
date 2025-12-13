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

// Bot control
router.post('/start-bot', startBot);
router.post('/stop-bot', stopBot);

export default router;
