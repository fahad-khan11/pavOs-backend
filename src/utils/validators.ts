import { body, param, query, ValidationChain } from 'express-validator';

// Auth validators
export const registerValidator: ValidationChain[] = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

export const loginValidator: ValidationChain[] = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

// Contact validators
export const createContactValidator: ValidationChain[] = [
  body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Name must be 2-100 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('company').trim().notEmpty().withMessage('Company is required'),
  body('position').trim().notEmpty().withMessage('Position is required'),
  body('status').optional().isIn(['active', 'prospect', 'inactive']).withMessage('Invalid status'),
  body('tags').optional().isArray().withMessage('Tags must be an array'),
  body('notes').optional().isString(),
];

export const updateContactValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid contact ID'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('company').optional().trim(),
  body('position').optional().trim(),
  body('status').optional().isIn(['active', 'prospect', 'inactive']),
  body('tags').optional().isArray(),
  body('notes').optional().isString(),
];

// Deal validators
export const createDealValidator: ValidationChain[] = [
  body('brandName').trim().notEmpty().withMessage('Brand name is required'),
  body('brandContact').trim().notEmpty().withMessage('Brand contact is required'),
  body('dealValue').isNumeric().isFloat({ min: 0 }).withMessage('Valid deal value is required'),
  body('stage')
    .optional()
    .isIn(['Lead', 'Contacted', 'Proposal', 'Negotiation', 'Contracted', 'Completed'])
    .withMessage('Invalid stage'),
  body('deadline').isISO8601().withMessage('Valid deadline is required'),
  body('contactId').optional().isMongoId().withMessage('Invalid contact ID'),
  body('probability').optional().isInt({ min: 0, max: 100 }).withMessage('Probability must be 0-100'),
  body('tags').optional().isArray(),
  body('notes').optional().isString(),
];

export const updateDealValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid deal ID'),
  body('brandName').optional().trim(),
  body('brandContact').optional().trim(),
  body('dealValue').optional().isNumeric().isFloat({ min: 0 }),
  body('stage')
    .optional()
    .isIn(['Lead', 'Contacted', 'Proposal', 'Negotiation', 'Contracted', 'Completed']),
  body('deadline').optional().isISO8601(),
  body('contactId').optional().isMongoId(),
  body('probability').optional().isInt({ min: 0, max: 100 }),
  body('status').optional().isIn(['active', 'completed']),
  body('tags').optional().isArray(),
  body('notes').optional().isString(),
];

export const updateDealStageValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid deal ID'),
  body('stage')
    .isIn(['Lead', 'Contacted', 'Proposal', 'Negotiation', 'Contracted', 'Completed'])
    .withMessage('Invalid stage'),
];

// Payment validators
export const createPaymentValidator: ValidationChain[] = [
  body('dealId').isMongoId().withMessage('Valid deal ID is required'),
  body('amount').isNumeric().isFloat({ min: 0 }).withMessage('Valid amount is required'),
  body('dueDate').isISO8601().withMessage('Valid due date is required'),
  body('currency').optional().isString().isLength({ min: 3, max: 3 }),
  body('notes').optional().isString(),
];

// Pagination validators
export const paginationValidator: ValidationChain[] = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be >= 1'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
];

// ID param validator
export const idParamValidator: ValidationChain[] = [
  param('id').isMongoId().withMessage('Invalid ID format'),
];

// CSV import validators
export const csvPreviewValidator: ValidationChain[] = [
  body('mapping').isObject().withMessage('Mapping must be an object'),
];

// Telemetry validators
export const trackEventValidator: ValidationChain[] = [
  body('eventType')
    .isIn([
      'user_registered',
      'user_login',
      'first_deal_created',
      'first_payment_received',
      'csv_import_completed',
      'stripe_connected',
      'whop_connected',
      'deal_won',
      'deal_lost',
    ])
    .withMessage('Invalid event type'),
  body('eventData').optional().isObject(),
];
