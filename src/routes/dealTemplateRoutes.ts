import express from 'express';
import * as dealTemplateController from '../controllers/dealTemplateController.js';
import { authenticate } from '../middlewares/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/deal-templates
 * @desc    Get all deal templates
 * @access  Private
 */
router.get('/', dealTemplateController.getAllTemplates);

/**
 * @route   GET /api/v1/deal-templates/:id
 * @desc    Get single deal template
 * @access  Private
 */
router.get('/:id', dealTemplateController.getTemplateById);

/**
 * @route   POST /api/v1/deal-templates
 * @desc    Create new deal template
 * @access  Private
 */
router.post('/', dealTemplateController.createTemplate);

/**
 * @route   PUT /api/v1/deal-templates/:id
 * @desc    Update deal template
 * @access  Private
 */
router.put('/:id', dealTemplateController.updateTemplate);

/**
 * @route   DELETE /api/v1/deal-templates/:id
 * @desc    Delete deal template
 * @access  Private
 */
router.delete('/:id', dealTemplateController.deleteTemplate);

export default router;
