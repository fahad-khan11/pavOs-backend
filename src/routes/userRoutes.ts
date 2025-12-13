import { Router } from 'express';
import userController from '../controllers/userController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// All user routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/me', userController.getCurrentUser);

/**
 * @route   PUT /api/v1/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.put('/me', userController.updateCurrentUser);

/**
 * @route   DELETE /api/v1/users/me
 * @desc    Delete current user account
 * @access  Private
 */
router.delete('/me', userController.deleteCurrentUser);

export default router;
