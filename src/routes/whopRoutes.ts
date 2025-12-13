import { Router } from 'express';
import whopController from '../controllers/whopController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/integrations/whop/status
 * @desc    Get Whop connection status
 * @access  Private
 */
router.get('/status', whopController.getConnectionStatus);

/**
 * @route   POST /api/v1/integrations/whop/connect
 * @desc    Connect Whop account
 * @access  Private
 */
router.post('/connect', whopController.connectWhop);

/**
 * @route   POST /api/v1/integrations/whop/disconnect
 * @desc    Disconnect Whop account
 * @access  Private
 */
router.post('/disconnect', whopController.disconnectWhop);

/**
 * @route   POST /api/v1/integrations/whop/sync
 * @desc    Sync customers from Whop
 * @access  Private
 */
router.post('/sync', whopController.syncWhopCustomers);

export default router;
