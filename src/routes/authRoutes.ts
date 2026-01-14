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

// ❌ DISABLED: Custom authentication methods are not used in Whop apps
// The app exclusively uses Whop session context

export default router;
