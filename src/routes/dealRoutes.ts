import { Router } from 'express';
import dealController from '../controllers/dealController.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validator.js';
import {
  createDealValidator,
  updateDealValidator,
  updateDealStageValidator,
  idParamValidator,
  paginationValidator,
} from '../utils/validators.js';

const router = Router();

// All deal routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/deals
 * @desc    Get all deals with filters
 * @access  Private
 */
router.get('/', validate(paginationValidator), dealController.getAllDeals);

/**
 * @route   POST /api/v1/deals
 * @desc    Create new deal
 * @access  Private
 */
router.post('/', validate(createDealValidator), dealController.createDeal);

/**
 * @route   GET /api/v1/deals/:id
 * @desc    Get deal by ID
 * @access  Private
 */
router.get('/:id', validate(idParamValidator), dealController.getDealById);

/**
 * @route   PUT /api/v1/deals/:id
 * @desc    Update deal
 * @access  Private
 */
router.put('/:id', validate(updateDealValidator), dealController.updateDeal);

/**
 * @route   PATCH /api/v1/deals/:id/stage
 * @desc    Update deal stage (for pipeline drag-and-drop)
 * @access  Private
 */
router.patch('/:id/stage', validate(updateDealStageValidator), dealController.updateDealStage);

/**
 * @route   DELETE /api/v1/deals/:id
 * @desc    Delete deal
 * @access  Private
 */
router.delete('/:id', validate(idParamValidator), dealController.deleteDeal);

export default router;
