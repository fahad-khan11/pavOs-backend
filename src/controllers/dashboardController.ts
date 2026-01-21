import { Response } from 'express';
import { Deal, Contact, Payment, Deliverable, Activity, User } from '../models/index.js';
import { AuthRequest, DashboardStats } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * ✅ REFACTORED: Whop-only authentication
 * Get dashboard statistics
 * GET /api/v1/dashboard/stats
 */
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
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

    // ✅ SECURITY: All queries filtered by whopCompanyId
    const deals = await Deal.find({ whopCompanyId });
    const activeDeals = deals.filter((d) => d.status === 'active');
    const completedDeals = deals.filter((d) => d.stage === 'Completed');

    // Calculate total revenue (completed deals)
    const totalRevenue = completedDeals.reduce((sum, deal) => sum + deal.dealValue, 0);

    // Calculate close rate
    const closeRate =
      deals.length > 0 ? Math.round((completedDeals.length / deals.length) * 100) : 0;

    // Get active contacts count (filtered by whopCompanyId)
    const activeContacts = await Contact.countDocuments({ whopCompanyId, status: 'active' });

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

    // Get pending and overdue payments (filtered by whopCompanyId)
    const pendingPayments = await Payment.countDocuments({
      whopCompanyId,
      paymentStatus: 'pending',
    });

    const overduePayments = await Payment.countDocuments({
      whopCompanyId,
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
 * ✅ REFACTORED: Whop-only authentication
 * Get recent activity
 * GET /api/v1/dashboard/recent-activity?limit=10
 */
export const getRecentActivity = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { limit = 10 } = req.query;

    // ✅ SECURITY: Filter by whopCompanyId
    const activities = await Activity.find({ whopCompanyId })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string));

    successResponse(res, activities);
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch recent activity', 500);
  }
};

/**
 * ✅ REFACTORED: Whop-only authentication
 * Get upcoming deliverables
 * GET /api/v1/dashboard/upcoming-deliverables?limit=5
 */
export const getUpcomingDeliverables = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { limit = 5 } = req.query;

    // ✅ SECURITY: Filter by whopCompanyId
    const deliverables = await Deliverable.find({
      whopCompanyId,
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
 * ✅ REFACTORED: Whop-only authentication
 * Get revenue chart data
 * GET /api/v1/dashboard/revenue-chart?period=7d|30d|90d
 */
export const getRevenueChart = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    const daysAgo = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - daysAgo);

    // ✅ SECURITY: Get completed deals filtered by whopCompanyId
    const deals = await Deal.find({
      whopCompanyId,
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
 * ✅ REFACTORED: Whop-only authentication
 * Get analytics data for pipeline (based on Deals only)
 * GET /api/v1/dashboard/analytics
 */
export const getAnalytics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopCompanyId = req.whopCompanyId!;

    // Get all deals filtered by whopCompanyId
    const deals = await Deal.find({ whopCompanyId });
    const completedDeals = deals.filter((d) => d.stage === 'Completed');
    const activeDeals = deals.filter((d) => d.stage !== 'Completed' && d.status === 'active');

    // Get payments filtered by whopCompanyId
    const payments = await Payment.find({
      whopCompanyId,
      paymentStatus: 'paid',
    });

    // Calculate total revenue from payments
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);

    // Calculate revenue from completed deals
    const dealRevenue = completedDeals.reduce((sum, d) => sum + d.dealValue, 0);

    // Use the higher of the two
    const revenue = Math.max(totalRevenue, dealRevenue);

    // Close rate (completed vs total)
    const totalDealsCount = deals.length;
    const closeRate = totalDealsCount > 0 ? Math.round((completedDeals.length / totalDealsCount) * 100) : 0;

    // Average deal size
    const avgDealSize = completedDeals.length > 0
      ? Math.round(revenue / completedDeals.length)
      : (activeDeals.length > 0
        ? Math.round(activeDeals.reduce((sum, d) => sum + d.dealValue, 0) / activeDeals.length)
        : 0);

    // Stage breakdown
    const stageBreakdown: { [key: string]: { count: number; value: number } } = {
      Lead: { count: 0, value: 0 },
      Contacted: { count: 0, value: 0 },
      Proposal: { count: 0, value: 0 },
      Negotiation: { count: 0, value: 0 },
      Contracted: { count: 0, value: 0 },
      Completed: { count: 0, value: 0 },
    };
    
    deals.forEach((deal) => {
      if (stageBreakdown[deal.stage]) {
        stageBreakdown[deal.stage].count++;
        stageBreakdown[deal.stage].value += deal.dealValue || 0;
      }
    });

    // Monthly revenue trend (last 6 months)
    const monthlyRevenue: { month: string; revenue: number; deals: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthDeals = completedDeals.filter((d) => {
        const completedDate = d.updatedAt;
        return completedDate >= monthStart && completedDate <= monthEnd;
      });

      const monthRevenue = monthDeals.reduce((sum, d) => sum + d.dealValue, 0);

      monthlyRevenue.push({
        month: monthStart.toLocaleString('default', { month: 'short' }),
        revenue: monthRevenue,
        deals: monthDeals.length,
      });
    }

    successResponse(res, {
      totalRevenue: revenue,
      closeRate,
      activeDeals: activeDeals.length,
      avgDealSize,
      totalDeals: deals.length,
      completedDeals: completedDeals.length,
      stageBreakdown,
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
