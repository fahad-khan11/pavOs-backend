import express from 'express';
import { handleAppInstall, handleMembershipWebhook, handleMessageWebhook } from '../controllers/whopWebhookController.js';

const router = express.Router();

// 🔍 DEBUG: Log ALL incoming webhooks
router.use((req, res, next) => {
  console.log('');
  console.log('='.repeat(80));
  console.log('🔔 WHOP WEBHOOK RECEIVED');
  console.log('='.repeat(80));
  console.log('📍 Path:', req.path);
  console.log('📍 Method:', req.method);
  console.log('📍 Headers:', JSON.stringify(req.headers, null, 2));
  console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  console.log('='.repeat(80));
  console.log('');
  next();
});

// Legacy app install webhook
router.post('/app-install', handleAppInstall);

// ✅ NEW: Auto-create leads from membership webhooks
router.post('/membership', handleMembershipWebhook);
router.post('/memberships', handleMembershipWebhook);

// ✅ NEW: Receive customer messages (Whop DM replies)
router.post('/message', handleMessageWebhook);
router.post('/messages', handleMessageWebhook);

// 🔍 Catch-all for debugging - log any webhook we don't handle
router.post('/*', (req, res) => {
  console.log('⚠️  UNHANDLED WEBHOOK PATH:', req.path);
  console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ message: 'Webhook received but no handler found' });
});

export default router;
