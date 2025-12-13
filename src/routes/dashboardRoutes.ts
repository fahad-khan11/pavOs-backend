import { Router } from 'express';
import dashboardController from '../controllers/dashboardController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/v1/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private
 */
router.get('/stats', dashboardController.getDashboardStats);

/**
 * @route   GET /api/v1/dashboard/recent-activity
 * @desc    Get recent activity
 * @access  Private
 */
router.get('/recent-activity', dashboardController.getRecentActivity);

/**
 * @route   GET /api/v1/dashboard/upcoming-deliverables
 * @desc    Get upcoming deliverables
 * @access  Private
 */
router.get('/upcoming-deliverables', dashboardController.getUpcomingDeliverables);

/**
 * @route   GET /api/v1/dashboard/revenue-chart
 * @desc    Get revenue chart data
 * @access  Private
 */
router.get('/revenue-chart', dashboardController.getRevenueChart);

/**
 * @route   GET /api/v1/dashboard/analytics
 * @desc    Get analytics data for leads/pipeline
 * @access  Private
 */
router.get('/analytics', dashboardController.getAnalytics);

export default router;
