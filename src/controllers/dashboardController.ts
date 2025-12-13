import { Response } from 'express';
import { Deal, Contact, Payment, Deliverable, Activity, Lead } from '../models/index.js';
import { AuthRequest, DashboardStats } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Get dashboard statistics
 * GET /api/v1/dashboard/stats
 */
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const whopCompanyId = req.whopCompanyId;

    // Get all deals
    const dealQuery: any = { creatorId: userId };
    if (whopCompanyId) {
      dealQuery.whopCompanyId = whopCompanyId;
    }
    const deals = await Deal.find(dealQuery);
    const activeDeals = deals.filter((d) => d.status === 'active');
    const completedDeals = deals.filter((d) => d.stage === 'Completed');

    // Calculate total revenue (completed deals)
    const totalRevenue = completedDeals.reduce((sum, deal) => sum + deal.dealValue, 0);

    // Calculate close rate
    const closeRate =
      deals.length > 0 ? Math.round((completedDeals.length / deals.length) * 100) : 0;

    // Get active contacts count
    const activeContacts = await Contact.countDocuments({ userId, status: 'active' });

    // Deals in progress (not completed)
    const dealsInProgress = activeDeals.length;

    // Calculate monthly and weekly revenue
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayOfWeek = new Date(now);
    firstDayOfWeek.setDate(now.getDate() - now.getDay());

    const monthlyDeals = completedDeals.filter((d) => d.createdAt >= firstDayOfMonth);
    const weeklyDeals = completedDeals.filter((d) => d.createdAt >= firstDayOfWeek);

    const monthlyRevenue = monthlyDeals.reduce((sum, deal) => sum + deal.dealValue, 0);
    const weeklyRevenue = weeklyDeals.reduce((sum, deal) => sum + deal.dealValue, 0);

    // Get pending and overdue payments
    const pendingPayments = await Payment.countDocuments({
      userId,
      paymentStatus: 'pending',
    });

    const overduePayments = await Payment.countDocuments({
      userId,
      paymentStatus: 'overdue',
    });

    const stats: DashboardStats = {
      totalRevenue,
      closeRate,
      activeContacts,
      dealsInProgress,
      monthlyRevenue,
      weeklyRevenue,
      pendingPayments,
      overduePayments,
    };

    successResponse(res, stats);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch dashboard stats', 500);
  }
};

/**
 * Get recent activity
 * GET /api/v1/dashboard/recent-activity?limit=10
 */
export const getRecentActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { limit = 10 } = req.query;

    const activities = await Activity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string));

    successResponse(res, activities);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch recent activity', 500);
  }
};

/**
 * Get upcoming deliverables
 * GET /api/v1/dashboard/upcoming-deliverables?limit=5
 */
export const getUpcomingDeliverables = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const userId = req.userId!;
    const { limit = 5 } = req.query;

    const deliverables = await Deliverable.find({
      userId,
      status: { $in: ['pending', 'in_progress'] },
    })
      .sort({ dueDate: 1 })
      .limit(parseInt(limit as string))
      .populate('dealId', 'brandName');

    successResponse(res, deliverables);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch upcoming deliverables', 500);
  }
};

/**
 * Get revenue chart data
 * GET /api/v1/dashboard/revenue-chart?period=7d|30d|90d
 */
export const getRevenueChart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const daysAgo = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - daysAgo);

    // Get completed deals in period
    const deals = await Deal.find({
      creatorId: userId,
      stage: 'Completed',
      createdAt: { $gte: startDate },
    }).sort({ createdAt: 1 });

    // Group by date
    const revenueByDate: { [key: string]: { revenue: number; deals: number } } = {};

    deals.forEach((deal) => {
      const dateStr = deal.createdAt.toISOString().split('T')[0];
      if (!revenueByDate[dateStr]) {
        revenueByDate[dateStr] = { revenue: 0, deals: 0 };
      }
      revenueByDate[dateStr].revenue += deal.dealValue;
      revenueByDate[dateStr].deals += 1;
    });

    // Convert to array
    const chartData = Object.keys(revenueByDate).map((date) => ({
      date,
      revenue: revenueByDate[date].revenue,
      deals: revenueByDate[date].deals,
    }));

    successResponse(res, chartData);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch revenue chart', 500);
  }
};

/**
 * Get analytics data for leads/pipeline
 * GET /api/v1/dashboard/analytics
 */
export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const whopCompanyId = req.whopCompanyId;

    // Get all leads for this user
    const leadQuery: any = { userId };
    if (whopCompanyId) {
      leadQuery.whopCompanyId = whopCompanyId;
    }
    const leads = await Lead.find(leadQuery);
    const wonLeads = leads.filter((l) => l.status === 'won');
    const lostLeads = leads.filter((l) => l.status === 'lost');
    const activeLeads = leads.filter((l) => l.status !== 'won' && l.status !== 'lost');

    // Get payments (from Whop sync)
    const payments = await Payment.find({
      userId,
      paymentStatus: 'paid',
      method: 'whop'
    });

    // Calculate total revenue from payments
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Calculate revenue from won leads (actualValue or estimatedValue)
    const leadRevenue = wonLeads.reduce((sum, l) => sum + (l.actualValue || l.estimatedValue || 0), 0);

    // Use the higher of the two (in case payments aren't synced yet)
    const revenue = Math.max(totalRevenue, leadRevenue);

    // Win rate
    const closedLeads = wonLeads.length + lostLeads.length;
    const winRate = closedLeads > 0 ? Math.round((wonLeads.length / closedLeads) * 100) : 0;

    // Active deals (leads in pipeline)
    const activeDeals = activeLeads.length;

    // Average deal size
    const avgDealSize = wonLeads.length > 0
      ? Math.round(revenue / wonLeads.length)
      : (activeLeads.length > 0
        ? Math.round(activeLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0) / activeLeads.length)
        : 0);

    // Lead source breakdown
    const sourceBreakdown: { [key: string]: { count: number; won: number; revenue: number } } = {};
    leads.forEach((lead) => {
      if (!sourceBreakdown[lead.source]) {
        sourceBreakdown[lead.source] = { count: 0, won: 0, revenue: 0 };
      }
      sourceBreakdown[lead.source].count++;
      if (lead.status === 'won') {
        sourceBreakdown[lead.source].won++;
        sourceBreakdown[lead.source].revenue += lead.actualValue || lead.estimatedValue || 0;
      }
    });

    // Pipeline breakdown by status
    const pipelineBreakdown: { [key: string]: { count: number; value: number } } = {
      new: { count: 0, value: 0 },
      in_conversation: { count: 0, value: 0 },
      proposal: { count: 0, value: 0 },
      negotiation: { count: 0, value: 0 },
      won: { count: 0, value: 0 },
      lost: { count: 0, value: 0 },
    };
    leads.forEach((lead) => {
      if (pipelineBreakdown[lead.status]) {
        pipelineBreakdown[lead.status].count++;
        pipelineBreakdown[lead.status].value += lead.actualValue || lead.estimatedValue || 0;
      }
    });

    // Monthly revenue trend (last 6 months)
    const monthlyRevenue: { month: string; revenue: number; deals: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthWonLeads = wonLeads.filter((l) => {
        const wonDate = l.wonAt || l.updatedAt;
        return wonDate >= monthStart && wonDate <= monthEnd;
      });

      const monthRevenue = monthWonLeads.reduce((sum, l) => sum + (l.actualValue || l.estimatedValue || 0), 0);

      monthlyRevenue.push({
        month: monthStart.toLocaleString('default', { month: 'short' }),
        revenue: monthRevenue,
        deals: monthWonLeads.length,
      });
    }

    successResponse(res, {
      totalRevenue: revenue,
      winRate,
      activeDeals,
      avgDealSize,
      totalLeads: leads.length,
      wonLeads: wonLeads.length,
      lostLeads: lostLeads.length,
      sourceBreakdown,
      pipelineBreakdown,
      monthlyRevenue,
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch analytics', 500);
  }
};

export default {
  getDashboardStats,
  getRecentActivity,
  getUpcomingDeliverables,
  getRevenueChart,
  getAnalytics,
};
