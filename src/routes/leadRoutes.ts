import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { apiLimiter } from '../middlewares/rateLimiter.js';
import {
  createLead,
  getLeads,
} from '../controllers/leadController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
router.use(apiLimiter);

/**
 * Create a new lead in Whop and save to local DB
 * POST /pavos/api/v1/leads/create
 */
router.post('/create', createLead);

/**
 * Get all leads for company (combined from Whop API + MongoDB)
 * GET /pavos/api/v1/leads/fetch-all
 */
router.get('/fetch-all', getLeads);

export default router;
