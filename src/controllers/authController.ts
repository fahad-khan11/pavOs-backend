import { Response } from 'express';
import { User, WhopConnection } from '../models/index.js';
import { AuthRequest, IUser } from '../types/index.js';
import { generateAccessToken, generateRefreshToken } from '../utils/jwt.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { TelemetryEvent } from '../models/index.js';
import { whopService } from '../services/whopService.js';

/**
 * Register new user
 * POST /api/v1/auth/register
 * 
 * ⚠️ DISABLED: This application is Whop-only. Use Whop OAuth instead.
 */
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  errorResponse(
    res, 
    'Registration is disabled. This application requires Whop authentication. Please use /api/v1/auth/whop', 
    403
  );
};

/**
 * Login user
 * POST /api/v1/auth/login
 * 
 * ⚠️ DISABLED: This application is Whop-only. Use Whop OAuth instead.
 */
export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  errorResponse(
    res, 
    'Login is disabled. This application requires Whop authentication. Please use /api/v1/auth/whop', 
    403
  );
};

/**
 * Demo login - Auto login with demo account
 * POST /api/v1/auth/demo
 * 
 * ⚠️ DISABLED: This application is Whop-only. Use Whop OAuth instead.
 */
export const demoLogin = async (req: AuthRequest, res: Response): Promise<void> => {
  errorResponse(
    res, 
    'Demo login is disabled. This application requires Whop authentication. Please use /api/v1/auth/whop', 
    403
  );
};

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const whopUserId = req.whopUserId;
    const whopCompanyId = req.whopCompanyId;

    if (whopUserId && whopCompanyId && refreshToken) {
      // ✅ REFACTORED: Find user by Whop identifiers
      const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
      if (user) {
        // Remove refresh token from user
        await User.findByIdAndUpdate(user._id, {
          $pull: { refreshTokens: refreshToken },
        });
      }
    }

    successResponse(res, null, 'Logged out successfully');
  } catch (error: any) {
    errorResponse(res, error.message || 'Logout failed', 500);
  }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh
 */
export const refreshAccessToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      errorResponse(res, 'Refresh token is required', 400);
      return;
    }

    // Verify refresh token
    const { verifyRefreshToken } = await import('../utils/jwt.js');
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      errorResponse(res, 'Invalid or expired refresh token', 401);
      return;
    }

    // ✅ REFACTORED: Find user by Whop identifiers
    const user = await (User as any).findByWhopIdentifiers(decoded.whopUserId, decoded.whopCompanyId);
    
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      errorResponse(res, 'Invalid refresh token', 401);
      return;
    }

    // ✅ REFACTORED: Generate new access token with Whop identifiers
    const accessToken = generateAccessToken({
      whopUserId: user.whopUserId,
      whopCompanyId: user.whopCompanyId,
      email: user.email,
      whopRole: user.whopRole,
      _internalUserId: user._id.toString(),
    });

    successResponse(res, { accessToken });
  } catch (error: any) {
    errorResponse(res, error.message || 'Token refresh failed', 500);
  }
};

/**
 * Google OAuth callback handler
 * GET /api/v1/auth/google/callback
 * 
 * ⚠️ DISABLED: This application is Whop-only. Use Whop OAuth instead.
 */
export const googleCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  const { CONSTANTS } = await import('../config/constants.js');
  res.redirect(`${CONSTANTS.FRONTEND_URL}/login?error=google_auth_disabled&message=This application requires Whop authentication`);
};

/**
 * Authenticate user from Whop
 * POST /api/v1/auth/whop
 */
export const whopAuth = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { whopUserId, whopCompanyId, email, name } = req.body;

    if (!whopUserId || !whopCompanyId) {
      errorResponse(res, 'Whop user ID and company ID are required', 400);
      return;
    }

    // If name is not provided, fetch it from Whop API
    let userName = name;
    let userEmail = email;
    let whopRole: string | undefined;
    let whopAuthorizedUserId: string | undefined;

    // Fetch user data and role from Whop API
    try {
      console.log(`Fetching user data from Whop API for userId: ${whopUserId}, companyId: ${whopCompanyId}`);
      const { whopService } = await import('../services/whopService.js');
      
      // Get basic user info
      const whopUser = await whopService.getUser(whopUserId);
      
      // Whop UserRetrieveResponse may have different property names
      // Try multiple possible fields for username
      if (!userName) {
        userName = (whopUser as any).username || 
                   (whopUser as any).name || 
                   (whopUser as any).display_name || 
                   (whopUser as any).full_name || 
                   'Whop User';
        console.log(`Fetched username from Whop: ${userName}`);
      }
      
      // Try multiple possible fields for email
      if (!userEmail) {
        userEmail = (whopUser as any).email || 
                    (whopUser as any).email_address || 
                    undefined;
        if (userEmail) {
          console.log(`Fetched email from Whop: ${userEmail}`);
        }
      }

      // 🔐 ROLE-BASED ACCESS CONTROL: Fetch authorized user role
      const authorizedUser = await whopService.getAuthorizedUser(whopCompanyId, whopUserId);
      if (authorizedUser) {
        whopRole = authorizedUser.role;
        whopAuthorizedUserId = authorizedUser.id;
        console.log(`🔐 User role in company: ${whopRole} (authorized user ID: ${whopAuthorizedUserId})`);
      } else {
        console.log(`⚠️  User ${whopUserId} is not a team member - treating as regular user`);
      }
    } catch (whopError) {
      console.error('Failed to fetch user/role from Whop API:', whopError);
      // Continue with provided data or defaults
    }

    // ✅ REFACTORED: Find user by BOTH whopUserId AND whopCompanyId
    // This allows the same person to have separate accounts for different companies
    let user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);

    if (!user) {
      // Auto-create user from Whop data for this specific company using the new helper
      user = await (User as any).findOrCreateWhopUser({
        whopUserId,
        whopCompanyId,
        email: userEmail,
        name: userName,
        whopRole,
        whopAuthorizedUserId,
      });

      console.log(`✅ Created new user for company ${whopCompanyId}: ${user.name} (${user.email}) with role: ${whopRole || 'none'}`);
    } else {
      // Update user data if provided and changed
      let needsUpdate = false;

      // Update name if provided and different
      if (userName && user.name !== userName) {
        user.name = userName;
        needsUpdate = true;
        console.log(`Updating user name to: ${userName}`);
      }

      // Update email if provided and different (and not a placeholder)
      if (userEmail && !userEmail.includes('@whop.user') && !userEmail.includes('@paveos.app') && user.email !== userEmail) {
        user.email = userEmail;
        needsUpdate = true;
        console.log(`Updating user email to: ${userEmail}`);
      }

      // Update Whop role if it changed
      if (whopRole && user.whopRole !== whopRole) {
        user.whopRole = whopRole as any;
        needsUpdate = true;
        console.log(`🔐 Updating user Whop role to: ${whopRole}`);
      }

      // Update authorized user ID
      if (whopAuthorizedUserId && user.whopAuthorizedUserId !== whopAuthorizedUserId) {
        user.whopAuthorizedUserId = whopAuthorizedUserId;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await user.save();
        console.log(`Updated user from Whop: ${user.name} (${user.email}) with role: ${user.whopRole || 'none'}`);
      }
    }

    // ✅ REFACTORED: Generate tokens with whopUserId and whopCompanyId as primary identifiers
    const accessToken = generateAccessToken({
      whopUserId: user.whopUserId,
      whopCompanyId: user.whopCompanyId,
      email: user.email,
      whopRole: user.whopRole,
      _internalUserId: user._id.toString(),  // For backward compatibility only
    });

    const refreshToken = generateRefreshToken({
      whopUserId: user.whopUserId,
      whopCompanyId: user.whopCompanyId,
      email: user.email,
      whopRole: user.whopRole,
      _internalUserId: user._id.toString(),  // For backward compatibility only
    });

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    // Track login event
    await TelemetryEvent.create({
      userId: user._id.toString(),
      whopCompanyId,  // ✅ Required field
      eventType: 'user_login',
      eventData: { email: user.email, provider: 'whop', whopCompanyId, whopRole: user.whopRole },
    });

    // Auto-create or update WhopConnection for this user
    try {
      let whopConnection = await WhopConnection.findOne({ userId: user._id.toString() });

      if (!whopConnection) {
        whopConnection = await WhopConnection.create({
          userId: user._id.toString(),
          whopUserId,
          whopCompanyId,
          isActive: true,
          connectedAt: new Date(),
        });
        console.log(`Auto-created WhopConnection for user: ${user.email}`);
      } else {
        // Update if needed
        whopConnection.whopUserId = whopUserId;
        whopConnection.whopCompanyId = whopCompanyId;
        whopConnection.isActive = true;
        await whopConnection.save();
        console.log(`Updated WhopConnection for user: ${user.email}`);
      }
    } catch (error) {
      console.error('Failed to create/update WhopConnection:', error);
      // Don't fail auth if WhopConnection fails
    }

    successResponse(res, {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        whopRole: user.whopRole,
        subscriptionPlan: user.subscriptionPlan,
      },
    });
  } catch (error: any) {
    console.error('Whop auth error:', error);
    errorResponse(res, 'Failed to authenticate with Whop', 500);
  }
};

export default {
  register,
  login,
  demoLogin,
  logout,
  refreshAccessToken,
  googleCallback,
  whopAuth,
};
