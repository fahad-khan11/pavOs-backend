import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { Lead, DiscordMessage } from '../models/index.js';

/**
 * Get all leads
 * GET /api/v1/leads
 */
export const getLeads = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const whopCompanyId = req.whopCompanyId;
    console.log('📋 getLeads - userId:', userId, 'whopCompanyId:', whopCompanyId);
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

    // ✅ MULTI-TENANT: Filter by BOTH userId AND whopCompanyId (Whop requirement)
    const query: any = { userId: String(userId) };
    
    // If user is a Whop user (has whopCompanyId), filter by company
    if (whopCompanyId) {
      query.whopCompanyId = whopCompanyId;
      console.log('✅ Multi-tenant filter applied: whopCompanyId =', whopCompanyId);
    }

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

    // Debug: Check all leads for this userId before filtering
    const allLeadsForUser = await Lead.find({ userId: String(userId) });
    console.log(`📋 getLeads - All leads for userId ${userId}: ${allLeadsForUser.length}`);
    allLeadsForUser.forEach((lead, idx) => {
      console.log(`   Lead ${idx + 1}: id=${lead._id}, name=${lead.name}, source=${lead.source}, tags=${lead.tags.join(',')}, userId=${lead.userId} (type: ${typeof lead.userId})`);
    });

    const leads = await Lead.find(query)
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Lead.countDocuments(query);

    console.log(`📋 getLeads - Query:`, JSON.stringify(query, null, 2));
    console.log(`📋 getLeads - Found ${leads.length} leads (total: ${total}) after filters`);

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
 * Get single lead by ID
 * GET /api/v1/leads/:id
 */
export const getLeadById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const whopCompanyId = req.whopCompanyId;
    const { id } = req.params;
    console.log('📄 getLeadById - userId:', userId, 'whopCompanyId:', whopCompanyId, 'leadId:', id);

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      errorResponse(res, 'Invalid lead ID format', 400);
      return;
    }

    // ✅ MULTI-TENANT: Filter by whopCompanyId if user is Whop user
    // For manual leads that don't have whopCompanyId, we allow access by userId only
    const query: any = { _id: id, userId };
    if (whopCompanyId) {
      // Allow leads with matching whopCompanyId OR no whopCompanyId (legacy/manual leads)
      query.$or = [
        { whopCompanyId },
        { whopCompanyId: { $exists: false } },
        { whopCompanyId: null }
      ];
    }

    const lead = await Lead.findOne(query);

    if (!lead) {
      errorResponse(res, 'Lead not found', 404);
      return;
    }

    // Get message history for this lead
    const messages = await DiscordMessage.find({ leadId: id })
      .sort({ createdAt: -1 })
      .limit(100);

    console.log(`📨 Found ${messages.length} messages for lead ${id}`);
    if (messages.length > 0) {
      messages.forEach((msg, idx) => {
        console.log(`   Message ${idx + 1}: direction=${msg.direction}, userId=${msg.userId}, author=${msg.authorUsername}, content="${msg.content.substring(0, 30)}..."`);
      });
    }

    successResponse(res, {
      lead,
      messages,
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch lead', 500);
  }
};

/**
 * Create new lead
 * POST /api/v1/leads
 */
export const createLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const whopCompanyId = req.whopCompanyId;
    
    const leadData: any = { ...req.body, userId };
    
    // ✅ Add whopCompanyId to manual leads if user is a Whop user
    if (whopCompanyId) {
      leadData.whopCompanyId = whopCompanyId;
      console.log(`✅ Adding whopCompanyId to manual lead: ${whopCompanyId}`);
    }

    const lead = await Lead.create(leadData);

    successResponse(res, lead, 'Lead created successfully', 201);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to create lead', 500);
  }
};

/**
 * Update lead
 * PATCH /api/v1/leads/:id
 */
export const updateLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const whopCompanyId = req.whopCompanyId;
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      errorResponse(res, 'Invalid lead ID format', 400);
      return;
    }

    // ✅ MULTI-TENANT: Filter by whopCompanyId if user is Whop user
    // For manual leads that don't have whopCompanyId, we allow access by userId only
    const query: any = { _id: id, userId };
    if (whopCompanyId) {
      // Allow leads with matching whopCompanyId OR no whopCompanyId (legacy/manual leads)
      query.$or = [
        { whopCompanyId },
        { whopCompanyId: { $exists: false } },
        { whopCompanyId: null }
      ];
    }

    const lead = await Lead.findOne(query);

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
 * Delete lead
 * DELETE /api/v1/leads/:id
 */
export const deleteLead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      errorResponse(res, 'Invalid lead ID format', 400);
      return;
    }

    const lead = await Lead.findOneAndDelete({ _id: id, userId });

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
 * Get lead statistics
 * GET /api/v1/leads/stats
 */
export const getLeadStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;

    const stats = await Lead.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$estimatedValue' },
        },
      },
    ]);

    const sourceStats = await Lead.aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$source',
          count: { $sum: 1 },
        },
      },
    ]);

    const total = await Lead.countDocuments({ userId });

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
