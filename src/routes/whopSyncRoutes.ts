import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { syncWhopMembers } from '../controllers/whopSyncController.js';

const router = express.Router();

/**
 * @route   GET /api/v1/whop/sync-members
 * @desc    Manually sync all members from Whop company
 * @access  Private
 */
router.get('/sync-members', authenticate, syncWhopMembers);

export default router;
