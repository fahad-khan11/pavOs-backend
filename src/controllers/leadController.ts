import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { Lead, DiscordMessage, Contact, User } from '../models/index.js';
import { whopMessageService } from '../services/whopMessageService.js';
import { discordService } from '../services/discordService.js';

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

/**
 * Send Whop message to lead
 * POST /api/v1/leads/:id/whop-message
 */
export const sendWhopMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const whopUserId = req.whopUserId!;
    const { id: leadId } = req.params;
    const { message } = req.body;

    // Validation
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      errorResponse(res, 'Message content is required', 400);
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      errorResponse(res, 'Invalid lead ID format', 400);
      return;
    }

    // Send message via Whop
    const result = await whopMessageService.sendDirectMessage(
      leadId,
      message.trim(),
      whopUserId,
      whopCompanyId
    );

    successResponse(res, {
      message: 'Whop message sent successfully',
      data: result,
    });
  } catch (error: any) {
    console.error('❌ sendWhopMessage error:', error);
    errorResponse(res, error.message || 'Failed to send Whop message', 500);
  }
};

/**
 * Get Whop conversation history for lead
 * GET /api/v1/leads/:id/whop-messages
 */
export const getWhopMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { id: leadId } = req.params;
    const { limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(leadId)) {
      errorResponse(res, 'Invalid lead ID format', 400);
      return;
    }

    // Get conversation history
    const messages = await whopMessageService.getConversationHistory(
      leadId,
      whopCompanyId,
      Number(limit)
    );

    successResponse(res, {
      messages,
      total: messages.length,
    });
  } catch (error: any) {
    console.error('❌ getWhopMessages error:', error);
    errorResponse(res, error.message || 'Failed to fetch Whop messages', 500);
  }
};

/**
 * ✅ SMART ROUTING: Auto-detect Whop or Discord and send accordingly
 * Send message to lead (auto-routes to Whop or Discord based on lead source)
 * POST /api/v1/leads/:id/send-message
 * 
 * Priority:
 * 1. Whop (if whopCustomerId exists) → Whop DM
 * 2. Discord (if discordUserId exists) → Discord message
 * 3. Error if neither exists
 */
export const sendMessage = async (req: AuthRequest, res: Response) => {
  try {
    const { id: leadId } = req.params;
    const { content } = req.body;  // ✅ FIXED: Accept 'content' to match frontend
    const userId = req._internalUserId;  // ✅ Use internal MongoDB user ID
    const whopCompanyId = req.whopCompanyId!;

    console.log(`📤 sendMessage: leadId=${leadId}, userId=${userId}, companyId=${whopCompanyId}, content=${content?.substring(0, 50)}...`);

    // Validation
    if (!content?.trim()) {
      return errorResponse(res, 'Message content is required', 400);
    }

    // ✅ SECURITY: Get lead with strict tenant isolation
    console.log(`🔍 Searching for lead: _id=${leadId}, whopCompanyId=${whopCompanyId}`);
    const lead = await Lead.findOne({ 
      _id: leadId, 
      whopCompanyId 
    });

    if (!lead) {
      console.error(`❌ Lead not found: _id=${leadId}, whopCompanyId=${whopCompanyId}`);
      return errorResponse(res, 'Lead not found', 404);
    }

    console.log(`🔍 Lead found: source=${lead.source}, whopCustomerId=${(lead as any).whopCustomerId}, discordUserId=${lead.discordUserId}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SMART ROUTING LOGIC
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    // Priority 1: Whop (if lead has whopCustomerId)
    if ((lead as any).whopCustomerId) {
      console.log('🟣 Routing to Whop DM...');
      
      try {
        const result = await whopMessageService.sendDirectMessage(
          leadId,
          content,  // ✅ FIXED: Use 'content' instead of 'message'
          userId!,
          whopCompanyId
        );
        
        console.log(`✅ Message sent via Whop: channelId=${result.channelId}, messageId=${result.messageId}`);
        
        return successResponse(res, {
          success: true,
          source: 'whop',
          channelId: result.channelId,
          messageId: result.messageId,
          leadId: leadId,
        }, 'Message sent via Whop');
      } catch (whopError: any) {
        console.error('❌ Whop message failed:', whopError);
        return errorResponse(res, `Failed to send Whop message: ${whopError.message}`, 500);
      }
    }
    
    // Priority 2: Discord (if lead has discordUserId)
    if (lead.discordUserId) {
      console.log('💬 Routing to Discord...');
      
      try {
        const result = await discordService.sendMessage(leadId, content);  // ✅ FIXED: Use 'content' instead of 'message'
        
        console.log(`✅ Message sent via Discord: messageId=${result.messageId}`);
        
        return successResponse(res, {
          success: true,
          source: 'discord',
          messageId: result.messageId,
          leadId: leadId,
        }, 'Message sent via Discord');
      } catch (discordError: any) {
        console.error('❌ Discord message failed:', discordError);
        return errorResponse(res, `Failed to send Discord message: ${discordError.message}`, 500);
      }
    }
    
    // No messaging source available
    console.warn('⚠️ Lead has no messaging source (whopCustomerId or discordUserId)');
    return errorResponse(
      res, 
      'Lead has no messaging source. Please ensure the lead has a Whop or Discord connection.', 
      400
    );

  } catch (error: any) {
    console.error('❌ sendMessage error:', error);
    return errorResponse(res, error.message || 'Failed to send message', 500);
  }
};

export default {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getLeadStats,
  sendWhopMessage,
  getWhopMessages,
  sendMessage, // ✅ NEW: Smart routing endpoint
};
