import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { syncWhopMembers, testMembershipWebhook } from '../controllers/whopSyncController.js';

const router = express.Router();

/**
 * @route   GET /api/v1/whop/sync-members
 * @desc    Manually sync all members from Whop company
 * @access  Private
 */
router.get('/sync-members', authenticate, syncWhopMembers);

/**
 * @route   POST /api/v1/whop/test-webhook
 * @desc    Test membership webhook with custom data
 * @access  Private
 */
router.post('/test-webhook', authenticate, testMembershipWebhook);

export default router;
