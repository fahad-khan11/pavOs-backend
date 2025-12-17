import { Response } from 'express';
import { Deal, Activity, TelemetryEvent, Contact, User } from '../models/index.js';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse, paginatedResponse } from '../utils/response.js';

/**
 * ✅ REFACTORED: Whop-only authentication
 * Get all deals with filters
 * GET /api/v1/deals?stage=&status=&page=1&limit=20
 */
export const getAllDeals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { stage, status, page = 1, limit = 100 } = req.query;

    // ✅ SECURITY: Filter by whopCompanyId to enforce multi-tenant isolation
    const query: any = { whopCompanyId };

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
 * ✅ REFACTORED: Whop-only authentication
 * Get deal by ID
 * GET /api/v1/deals/:id
 */
export const getDealById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;

    // ✅ SECURITY: Filter by whopCompanyId to prevent cross-tenant access
    const deal = await Deal.findOne({ _id: id, whopCompanyId });

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
 * ✅ REFACTORED: Whop-only authentication
 * Create new deal
 * POST /api/v1/deals
 */
export const createDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    const dealData = req.body;

    // ✅ Resolve internal userId from Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    const userId = user._id.toString();

    // If contactId is provided, get contact details (enforce tenant boundary)
    if (dealData.contactId) {
      const contact = await Contact.findOne({ _id: dealData.contactId, whopCompanyId });
      if (contact) {
        dealData.contactName = contact.name;
        dealData.company = contact.company;
      }
    }

    // Create deal with whopCompanyId for multi-tenant isolation
    const deal = await Deal.create({
      ...dealData,
      creatorId: userId,
      whopCompanyId,
      createdDate: new Date(),
    });

    // Log activity
    await Activity.create({
      userId,
      whopCompanyId,
      type: 'deal_created',
      title: 'Deal Created',
      description: `Created deal: ${deal.brandName}`,
      relatedEntityType: 'deal',
      relatedEntityId: deal._id.toString(),
    });

    // Check if this is user's first deal
    const dealCount = await Deal.countDocuments({ whopCompanyId });
    if (dealCount === 1) {
      await TelemetryEvent.create({
        userId,
        whopCompanyId,
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
 * ✅ REFACTORED: Whop-only authentication
 * Update deal
 * PUT /api/v1/deals/:id
 */
export const updateDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;
    const updates = req.body;

    // ✅ Resolve internal userId from Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    const userId = user._id.toString();

    // If contactId is being updated, get contact details (enforce tenant boundary)
    if (updates.contactId) {
      const contact = await Contact.findOne({ _id: updates.contactId, whopCompanyId });
      if (contact) {
        updates.contactName = contact.name;
        updates.company = contact.company;
      }
    }

    // ✅ SECURITY: Filter by whopCompanyId to prevent cross-tenant access
    const deal = await Deal.findOneAndUpdate(
      { _id: id, whopCompanyId },
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
      whopCompanyId,
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
 * ✅ REFACTORED: Whop-only authentication
 * Update deal stage (for pipeline drag and drop)
 * PATCH /api/v1/deals/:id/stage
 */
export const updateDealStage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;
    const { stage } = req.body;

    // ✅ Resolve internal userId from Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    const userId = user._id.toString();

    // ✅ SECURITY: Filter by whopCompanyId to prevent cross-tenant access
    const deal = await Deal.findOneAndUpdate(
      { _id: id, whopCompanyId },
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
      whopCompanyId,
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
        whopCompanyId,
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
 * ✅ REFACTORED: Whop-only authentication
 * Delete deal
 * DELETE /api/v1/deals/:id
 */
export const deleteDeal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;

    // ✅ SECURITY: Filter by whopCompanyId to prevent cross-tenant access
    const deal = await Deal.findOneAndDelete({ _id: id, whopCompanyId });

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
