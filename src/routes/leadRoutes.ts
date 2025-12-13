import express from 'express';
import {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadStats,
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

export default router;
