import { Request, Response, NextFunction } from 'express';
import { User } from '../models/index.js';

/**
 * Get current user's profile (from database - already synced from Whop during login)
 * This returns the profile of the authenticated user who installed PaveOS
 */
export const getWhopProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const whopUserId = (req.user as any)?.whopUserId;
    const whopCompanyId = (req.user as any)?.whopCompanyId;

    if (!whopUserId || !whopCompanyId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    console.log(`📋 Fetching profile for user: ${whopUserId}, company: ${whopCompanyId}`);

    // Get user from database (already synced from Whop during login)
    const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log(`✅ Profile found: ${user.name} (${user.email})`);

    return res.status(200).json({
      success: true,
      data: {
        id: user.whopUserId,
        email: user.email,
        name: user.name,
        companyId: user.whopCompanyId,
        role: user.whopRole || 'user',
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (error: any) {
    console.error('❌ Error fetching user profile:', error);
    
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user profile',
      error: error.message,
    });
  }
};
