import { Router } from 'express';
import authController from '../controllers/authController.js';
import { authLimiter } from '../middlewares/rateLimiter.js';

const router = Router();

// Apply rate limiting to auth routes
router.use(authLimiter);

/**
 * @route   POST /api/v1/auth/whop
 * @desc    Authenticate user from Whop (ONLY authentication method)
 * @access  Public
 */
router.post('/whop', authController.whopAuth);

/**
 * @route   POST /api/v1/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
// Token refresh endpoint removed - Whop handles token lifecycle

export default router;
