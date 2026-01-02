import express from 'express';
import { handleAppInstall, handleMembershipWebhook, handleMessageWebhook } from '../controllers/whopWebhookController.js';

const router = express.Router();

// Legacy app install webhook
router.post('/app-install', handleAppInstall);

// ✅ NEW: Auto-create leads from membership webhooks
router.post('/membership', handleMembershipWebhook);
router.post('/memberships', handleMembershipWebhook);

// ✅ NEW: Receive customer messages (Whop DM replies)
router.post('/message', handleMessageWebhook);
router.post('/messages', handleMessageWebhook);

export default router;
