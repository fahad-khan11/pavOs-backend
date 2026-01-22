import { Response } from 'express';
import { User } from '../models/index.js';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * ✅ REFACTORED: Whop-only authentication
 * Get current user profile
 * GET /api/v1/users/me
 */
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;

    // ✅ Resolve user by Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    successResponse(res, user.toJSON());
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to fetch user', 500);
  }
};

/**
 * ✅ REFACTORED: Whop-only authentication
 * Update current user profile
 * PUT /api/v1/users/me
 */
export const updateCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.email;
    delete updates.password;
    delete updates.role;
    delete updates.whopUserId;
    delete updates.whopCompanyId;
    delete updates.whopRole;

    // ✅ Resolve user by Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Update user
    Object.assign(user, updates);
    await user.save();

    successResponse(res, user.toJSON(), 'Profile updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to update profile', 500);
  }
};

/**
 * ✅ REFACTORED: Whop-only authentication
 * Delete current user account
 * DELETE /api/v1/users/me
 */
export const deleteCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const whopUserId = req.whopUserId!;
    const whopCompanyId = req.whopCompanyId!;

    // ✅ Resolve user by Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    // Delete user
    await User.findByIdAndDelete(user._id);

    successResponse(res, null, 'Account deleted successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to delete account', 500);
  }
};

export default {
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
};
