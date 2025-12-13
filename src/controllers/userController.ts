import { Response } from 'express';
import { User } from '../models/index.js';
import { AuthRequest } from '../types/index.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Get current user profile
 * GET /api/v1/users/me
 */
export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
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
 * Update current user profile
 * PUT /api/v1/users/me
 */
export const updateCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    const updates = req.body;

    // Don't allow updating certain fields
    delete updates.email;
    delete updates.password;
    delete updates.role;
    delete updates.refreshTokens;

    const user = await User.findByIdAndUpdate(userId, updates, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      errorResponse(res, 'User not found', 404);
      return;
    }

    successResponse(res, user.toJSON(), 'Profile updated successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Failed to update profile', 500);
  }
};

/**
 * Delete current user account
 * DELETE /api/v1/users/me
 */
export const deleteCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;

    await User.findByIdAndDelete(userId);

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
