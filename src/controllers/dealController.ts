import { Response } from 'express';
import { Deal, Activity, TelemetryEvent, Contact } from '../models/index.js';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

/**
 * Get all deals with filters
 * GET /api/v1/deals?stage=&status=&page=1&limit=20
 */
export const getAllDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { stage, status, page = 1, limit = 100 } = req.query;

    // Build query
    const query: any = { creatorId: userId };

    // Filter by stage
    if (stage && stage !== 'all') {
      query.stage = stage;
    }

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    // Pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Get deals
    const deals = await Deal.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const total = await Deal.countDocuments(query);

    paginatedResponse(res, deals, pageNum, limitNum, total);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch deals', 500);
  }
};

/**
 * Get deal by ID
 * GET /api/v1/deals/:id
 */
export const getDealById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const deal = await Deal.findOne({ _id: id, creatorId: userId });

    if (!deal) {
      errorResponse(res, 'Deal not found', 404);
      return;
    }

    successResponse(res, deal.toJSON());
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch deal', 500);
  }
};

/**
 * Create new deal
 * POST /api/v1/deals
 */
export const createDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const dealData = req.body;

    // If contactId is provided, get contact details
    if (dealData.contactId) {
      const contact = await Contact.findOne({ _id: dealData.contactId, userId });
      if (contact) {
        dealData.contactName = contact.name;
        dealData.company = contact.company;
      }
    }

    // Create deal
    const deal = await Deal.create({
      ...dealData,
      creatorId: userId,
      createdDate: new Date(),
    });

    // Log activity
    await Activity.create({
      userId,
      type: 'deal_created',
      title: 'Deal Created',
      description: `Created deal: ${deal.brandName}`,
      relatedEntityType: 'deal',
      relatedEntityId: deal._id.toString(),
    });

    // Check if this is user's first deal
    const dealCount = await Deal.countDocuments({ creatorId: userId });
    if (dealCount === 1) {
      await TelemetryEvent.create({
        userId,
        eventType: 'first_deal_created',
        eventData: { dealValue: deal.dealValue, brandName: deal.brandName },
      });
    }

    successResponse(res, deal.toJSON(), 'Deal created successfully', 201);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to create deal', 500);
  }
};

/**
 * Update deal
 * PUT /api/v1/deals/:id
 */
export const updateDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const updates = req.body;

    // If contactId is being updated, get contact details
    if (updates.contactId) {
      const contact = await Contact.findOne({ _id: updates.contactId, userId });
      if (contact) {
        updates.contactName = contact.name;
        updates.company = contact.company;
      }
    }

    const deal = await Deal.findOneAndUpdate(
      { _id: id, creatorId: userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!deal) {
      errorResponse(res, 'Deal not found', 404);
      return;
    }

    // Log activity
    await Activity.create({
      userId,
      type: 'deal_updated',
      title: 'Deal Updated',
      description: `Updated deal: ${deal.brandName}`,
      relatedEntityType: 'deal',
      relatedEntityId: deal._id.toString(),
    });

    successResponse(res, deal.toJSON(), 'Deal updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to update deal', 500);
  }
};

/**
 * Update deal stage (for pipeline drag and drop)
 * PATCH /api/v1/deals/:id/stage
 */
export const updateDealStage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const { stage } = req.body;

    const deal = await Deal.findOneAndUpdate(
      { _id: id, creatorId: userId },
      { stage },
      { new: true, runValidators: true }
    );

    if (!deal) {
      errorResponse(res, 'Deal not found', 404);
      return;
    }

    // Log activity
    await Activity.create({
      userId,
      type: 'deal_updated',
      title: 'Deal Stage Updated',
      description: `Moved ${deal.brandName} to ${stage}`,
      relatedEntityType: 'deal',
      relatedEntityId: deal._id.toString(),
      metadata: { previousStage: deal.stage, newStage: stage },
    });

    // Track deal won
    if (stage === 'Completed') {
      await TelemetryEvent.create({
        userId,
        eventType: 'deal_won',
        eventData: { dealValue: deal.dealValue, brandName: deal.brandName },
      });
    }

    successResponse(res, deal.toJSON(), 'Deal stage updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to update deal stage', 500);
  }
};

/**
 * Delete deal
 * DELETE /api/v1/deals/:id
 */
export const deleteDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const deal = await Deal.findOneAndDelete({ _id: id, creatorId: userId });

    if (!deal) {
      errorResponse(res, 'Deal not found', 404);
      return;
    }

    successResponse(res, null, 'Deal deleted successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to delete deal', 500);
  }
};

export default {
  getAllDeals,
  getDealById,
  createDeal,
  updateDeal,
  updateDealStage,
  deleteDeal,
};
