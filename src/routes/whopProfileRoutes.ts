import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { getWhopProfile } from '../controllers/whopProfileController.js';

const router = express.Router();

/**
 * @route   GET /api/v1/whop/profile
 * @desc    Get current user's profile (synced from Whop during login)
 * @access  Private
 */
router.get('/profile', authenticate, getWhopProfile);

export default router;
