import { Router } from 'express';
import contactController from '../controllers/contactController.js';
import { authenticate } from '../middlewares/auth.js';
import { validate } from '../middlewares/validator.js';
import {
  createContactValidator,
  updateContactValidator,
  idParamValidator,
  paginationValidator,
} from '../utils/validators.js';

const router = Router();

// All contact routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/contacts
 * @desc    Get all contacts with search and filters
 * @access  Private
 */
router.get('/', validate(paginationValidator), contactController.getAllContacts);

/**
 * @route   POST /api/v1/contacts
 * @desc    Create new contact
 * @access  Private
 */
router.post('/', validate(createContactValidator), contactController.createContact);

/**
 * @route   GET /api/v1/contacts/:id
 * @desc    Get contact by ID
 * @access  Private
 */
router.get('/:id', validate(idParamValidator), contactController.getContactById);

/**
 * @route   PUT /api/v1/contacts/:id
 * @desc    Update contact
 * @access  Private
 */
router.put('/:id', validate(updateContactValidator), contactController.updateContact);

/**
 * @route   DELETE /api/v1/contacts/:id
 * @desc    Delete contact
 * @access  Private
 */
router.delete('/:id', validate(idParamValidator), contactController.deleteContact);

export default router;
