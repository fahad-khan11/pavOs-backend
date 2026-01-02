import express from 'express';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadStats,
  sendWhopMessage,
  getWhopMessages,
  sendMessage, // ✅ NEW: Smart routing
} from '../controllers/leadController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Lead routes
router.get('/', getLeads);
router.get('/stats', getLeadStats); // Must be before /:id
router.get('/:id', getLeadById);
router.post('/', createLead);
router.patch('/:id', updateLead);
router.delete('/:id', deleteLead);

// Whop messaging routes
router.post('/:id/whop-message', sendWhopMessage);
router.get('/:id/whop-messages', getWhopMessages);

// ✅ SMART ROUTING: Auto-detect Whop or Discord and send accordingly
router.post('/:id/send-message', sendMessage);

export default router;
