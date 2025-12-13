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
 */
export const register = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      errorResponse(res, 'User already exists with this email', 400);
      return;
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
      role: 'creator',
      subscriptionPlan: 'Starter',
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    await user.save();

    // Track registration event
    await TelemetryEvent.create({
      userId: user._id.toString(),
      eventType: 'user_registered',
      eventData: { email: user.email, plan: user.subscriptionPlan },
    });

    // Return user and tokens
    successResponse(
      res,
      {
        user: user.toJSON(),
        accessToken,
        refreshToken,
      },
      'User registered successfully',
      201
    );
  } catch (error: any) {
    errorResponse(res, error.message || 'Registration failed', 500);
  }
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
export const login = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      errorResponse(res, 'Invalid email or password', 401);
      return;
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      errorResponse(res, 'Invalid email or password', 401);
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    // Track login event
    await TelemetryEvent.create({
      userId: user._id.toString(),
      eventType: 'user_login',
      eventData: { email: user.email },
    });

    // Return user and tokens (without password)
    successResponse(res, {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Login failed', 500);
  }
};

/**
 * Demo login - Auto login with demo account
 * POST /api/v1/auth/demo
 */
export const demoLogin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const demoEmail = 'demo@paveos.com';

    // Find or create demo user
    let user = await User.findOne({ email: demoEmail });

    if (!user) {
      // Create demo user with sample data
      user = await User.create({
        name: 'Demo User',
        email: demoEmail,
        password: 'demo123',
        role: 'creator',
        subscriptionPlan: 'Pro',
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Update login time
    user.lastLogin = new Date();
    await user.save();

    // Track demo login
    await TelemetryEvent.create({
      userId: user._id.toString(),
      eventType: 'user_login',
      eventData: { email: user.email, isDemo: true },
    });

    // Return user and tokens
    successResponse(res, {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'Demo login failed', 500);
  }
};

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;
    const userId = req.userId;

    if (userId && refreshToken) {
      // Remove refresh token from user
      await User.findByIdAndUpdate(userId, {
        $pull: { refreshTokens: refreshToken },
      });
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

    // Verify refresh token (implement verifyRefreshToken in jwt utils)
    const { verifyRefreshToken } = await import('../utils/jwt.js');
    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      errorResponse(res, 'Invalid or expired refresh token', 401);
      return;
    }

    // Check if refresh token exists in user's tokens
    const user = await User.findById(decoded.userId);
    if (!user || !user.refreshTokens.includes(refreshToken)) {
      errorResponse(res, 'Invalid refresh token', 401);
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    successResponse(res, { accessToken });
  } catch (error: any) {
    errorResponse(res, error.message || 'Token refresh failed', 500);
  }
};

/**
 * Google OAuth callback handler
 * GET /api/v1/auth/google/callback
 */
export const googleCallback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user as any;

    console.log('Google OAuth callback - User:', user ? 'Found' : 'Not found');

    if (!user || !user._id) {
      console.error('Google OAuth callback - No user in request');
      errorResponse(res, 'Authentication failed', 401);
      return;
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    console.log('Google OAuth callback - Tokens generated, redirecting to frontend');

    // Track login event
    await TelemetryEvent.create({
      userId: user._id.toString(),
      eventType: 'user_login',
      eventData: { email: user.email, provider: 'google' },
    });

    // Redirect to frontend with tokens
    const { CONSTANTS } = await import('../config/constants.js');
    const redirectUrl = `${CONSTANTS.FRONTEND_URL}/auth/callback?accessToken=${accessToken}&refreshToken=${refreshToken}`;
    res.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Google OAuth callback error:', error.message || error);
    const { CONSTANTS } = await import('../config/constants.js');
    res.redirect(`${CONSTANTS.FRONTEND_URL}/login?error=auth_failed`);
  }
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

    if (!userName || !userEmail) {
      try {
        console.log(`Fetching user data from Whop API for userId: ${whopUserId}`);
        const { whopService } = await import('../services/whopService.js');
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
      } catch (whopError) {
        console.error('Failed to fetch user from Whop API:', whopError);
        // Continue with provided data or defaults
      }
    }

    // ✅ MULTI-TENANT FIX: Find user by BOTH whopUserId AND whopCompanyId
    // This allows the same person to have separate accounts for different companies
    let user = await User.findOne({ whopUserId, whopCompanyId });

    if (!user) {
      // Auto-create user from Whop data for this specific company
      const finalEmail = userEmail || `whop_${whopUserId}_${whopCompanyId.slice(-6)}@paveos.app`;
      const finalName = userName || userEmail?.split('@')[0] || 'Whop User';

      user = await User.create({
        name: finalName,
        email: finalEmail,
        password: Math.random().toString(36).slice(-12), // Random password (won't be used)
        role: 'creator',
        subscriptionPlan: 'Pro', // Whop users get Pro plan
        whopUserId,
        whopCompanyId, // Store the specific company ID
      });

      console.log(`✅ Created new user for company ${whopCompanyId}: ${finalName} (${finalEmail})`);
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

      if (needsUpdate) {
        await user.save();
        console.log(`Updated user from Whop: ${user.name} (${user.email})`);
      }
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
    });

    // Save refresh token
    user.refreshTokens.push(refreshToken);
    user.lastLogin = new Date();
    await user.save();

    // Track login event
    await TelemetryEvent.create({
      userId: user._id.toString(),
      eventType: 'user_login',
      eventData: { email: user.email, provider: 'whop', whopCompanyId },
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
