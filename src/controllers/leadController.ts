import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { Lead, DiscordMessage, Contact, User } from '../models/index.js';

/**
 * ✅ REFACTORED: Whop-only authentication
 * Get all leads
 * GET /api/v1/leads
 */
export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const {
      status,
      source,
      tags,
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    // ✅ SECURITY: Filter by whopCompanyId ONLY (strict tenant isolation)
    const query: any = { whopCompanyId };

    // Filters
    if (status) query.status = status;
    if (source) query.source = source;
    if (tags) {
      const tagArray = typeof tags === 'string' ? tags.split(',') : tags;
      query.tags = { $in: tagArray };
    }
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { discordUsername: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sort: any = {};
    sort[String(sortBy)] = sortOrder === 'asc' ? 1 : -1;

    const leads = await Lead.find(query)
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Lead.countDocuments(query);

    // Get unread counts for each lead
    const leadsWithUnread = await Promise.all(
      leads.map(async (lead) => {
        const unreadCount = await DiscordMessage.countDocuments({
          leadId: lead._id.toString(),
          isRead: false,
          direction: 'incoming',
        });
        return {
          ...lead.toJSON(),
          unreadCount,
        };
      })
    );

    successResponse(res, {
      leads: leadsWithUnread,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error: any) {
    console.error('❌ getLeads error:', error);
    errorResponse(res, error.message || 'Failed to fetch leads', 500);
  }
};

/**
 * ✅ REFACTORED: Whop-only authentication
 * Get single lead by ID
 * GET /api/v1/leads/:id
 */
export const getLeadById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      errorResponse(res, 'Invalid lead ID format', 400);
      return;
    }

    // ✅ SECURITY: Filter by whopCompanyId to prevent cross-tenant access
    const lead = await Lead.findOne({ _id: id, whopCompanyId });

    if (!lead) {
      errorResponse(res, 'Lead not found', 404);
      return;
    }

    // Get messages for this lead
    const messages = await DiscordMessage.find({ 
      leadId: id,
      whopCompanyId  // ✅ Enforce tenant boundary on messages too
    })
      .sort({ createdAt: -1 })
      .limit(100);

    successResponse(res, {
      lead,
      messages,
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch lead', 500);
  }
};

/**
 * ✅ REFACTORED: Whop-only authentication
 * Create new lead
 * POST /api/v1/leads
 */
export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    
    // ✅ Resolve internal userId from Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }
    const userId = user._id.toString();
    
    const leadData: any = { 
      ...req.body, 
      userId,
      whopCompanyId  // ✅ Always set whopCompanyId for strict tenant isolation
    };

    const lead = await Lead.create(leadData);

    successResponse(res, lead, 'Lead created successfully', 201);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to create lead', 500);
  }
};

/**
 * ✅ REFACTORED: Whop-only authentication
 * Update lead
 * PATCH /api/v1/leads/:id
 */
export const updateLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      errorResponse(res, 'Invalid lead ID format', 400);
      return;
    }

    // ✅ SECURITY: Filter by whopCompanyId to prevent cross-tenant access
    const lead = await Lead.findOne({ _id: id, whopCompanyId });

    if (!lead) {
      errorResponse(res, 'Lead not found', 404);
      return;
    }

    Object.assign(lead, req.body);
    await lead.save();

    successResponse(res, lead, 'Lead updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to update lead', 500);
  }
};

/**
 * ✅ REFACTORED: Whop-only authentication
 * Delete lead
 * DELETE /api/v1/leads/:id
 */
export const deleteLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      errorResponse(res, 'Invalid lead ID format', 400);
      return;
    }

    // ✅ SECURITY: Filter by whopCompanyId to prevent cross-tenant access
    const lead = await Lead.findOneAndDelete({ _id: id, whopCompanyId });

    if (!lead) {
      errorResponse(res, 'Lead not found', 404);
      return;
    }

    successResponse(res, null, 'Lead deleted successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to delete lead', 500);
  }
};

/**
 * ✅ REFACTORED: Whop-only authentication
 * Get lead statistics
 * GET /api/v1/leads/stats
 */
export const getLeadStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;

    // ✅ SECURITY: Aggregate by whopCompanyId
    const stats = await Lead.aggregate([
      { $match: { whopCompanyId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$estimatedValue' },
        },
      },
    ]);

    const sourceStats = await Lead.aggregate([
      { $match: { whopCompanyId } },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Lead.countDocuments({ whopCompanyId });

    successResponse(res, {
      total,
      byStatus: stats,
      bySource: sourceStats,
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch lead stats', 500);
  }
};

export default {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadStats,
};
