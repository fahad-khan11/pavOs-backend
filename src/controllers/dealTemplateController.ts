import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import DealTemplate from '../models/DealTemplate.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { logger } from '../config/logger.js';

/**
 * @desc    Get all deal templates
 * @route   GET /api/v1/deal-templates
 * @access  Private
 */
export const getAllTemplates = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { category } = req.query;

    const filter: any = {};
    if (category) {
      filter.category = category;
    }

    const templates = await DealTemplate.find(filter).sort({ isDefault: -1, name: 1 });

    successResponse(res, templates, 'Deal templates retrieved successfully');
  } catch (error: any) {
    logger.error('Get deal templates error:', error);
    errorResponse(res, 'Failed to retrieve deal templates', 500);
  }
};

/**
 * @desc    Get single deal template
 * @route   GET /api/v1/deal-templates/:id
 * @access  Private
 */
export const getTemplateById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await DealTemplate.findById(id);

    if (!template) {
      errorResponse(res, 'Deal template not found', 404);
      return;
    }

    successResponse(res, template, 'Deal template retrieved successfully');
  } catch (error: any) {
    logger.error('Get deal template error:', error);
    errorResponse(res, 'Failed to retrieve deal template', 500);
  }
};

/**
 * @desc    Create deal template (Admin only for now)
 * @route   POST /api/v1/deal-templates
 * @access  Private
 */
export const createTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      name,
      description,
      category,
      defaultValue,
      valueRange,
      defaultStage,
      deliverables,
    } = req.body;

    const template = await DealTemplate.create({
      name,
      description,
      category,
      defaultValue,
      valueRange,
      defaultStage,
      deliverables,
      isDefault: false, // User-created templates are not default
    });

    successResponse(res, template, 'Deal template created successfully', 201);
  } catch (error: any) {
    logger.error('Create deal template error:', error);
    errorResponse(res, error.message || 'Failed to create deal template', 500);
  }
};

/**
 * @desc    Update deal template
 * @route   PUT /api/v1/deal-templates/:id
 * @access  Private
 */
export const updateTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await DealTemplate.findById(id);

    if (!template) {
      errorResponse(res, 'Deal template not found', 404);
      return;
    }

    // Prevent updating default templates (only allow admins in future)
    if (template.isDefault) {
      errorResponse(res, 'Cannot modify default templates', 403);
      return;
    }

    const updatedTemplate = await DealTemplate.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    successResponse(res, updatedTemplate, 'Deal template updated successfully');
  } catch (error: any) {
    logger.error('Update deal template error:', error);
    errorResponse(res, error.message || 'Failed to update deal template', 500);
  }
};

/**
 * @desc    Delete deal template
 * @route   DELETE /api/v1/deal-templates/:id
 * @access  Private
 */
export const deleteTemplate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const template = await DealTemplate.findById(id);

    if (!template) {
      errorResponse(res, 'Deal template not found', 404);
      return;
    }

    // Prevent deleting default templates
    if (template.isDefault) {
      errorResponse(res, 'Cannot delete default templates', 403);
      return;
    }

    await DealTemplate.findByIdAndDelete(id);

    successResponse(res, null, 'Deal template deleted successfully');
  } catch (error: any) {
    logger.error('Delete deal template error:', error);
    errorResponse(res, 'Failed to delete deal template', 500);
  }
};
