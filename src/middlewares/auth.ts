import { Response, NextFunction } from 'express';
import { AuthRequest, WhopRole } from '../types/index.js';
import { errorResponse } from '../utils/response.js';
import { Whop } from '@whop/sdk';

// Initialize Whop SDK
const whopSdk = new Whop({
  apiKey: process.env.WHOP_API_KEY || '',
});

/**
 * ✅ SIMPLIFIED WHOP AUTHENTICATION
 * 
 * Verifies Whop tokens directly from Authorization header
 * No proxy layer - frontend sends token directly
 */
export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Extract Whop identifiers from headers
    const whopUserIdHeader = req.headers['x-whop-user-id'];
    const whopCompanyIdHeader = req.headers['x-whop-company-id'];
    const authHeader = req.headers.authorization;

    console.log('🛡️ Auth Middleware:', {
      hasAuthHeader: !!authHeader,
      hasUserIdHeader: !!whopUserIdHeader,
      hasCompanyIdHeader: !!whopCompanyIdHeader,
      method: req.method,
      path: req.path
    });

    // Resolve user from database (moved up for dev mode)
    const { User } = await import('../models/index.js');

    // For localhost development: Accept headers without token verification
    if (whopUserIdHeader && whopCompanyIdHeader && !authHeader) {
      console.log('🔧 Development mode: Using headers without token verification');
      
      const whopUserId = Array.isArray(whopUserIdHeader) ? whopUserIdHeader[0] : whopUserIdHeader;
      const whopCompanyId = Array.isArray(whopCompanyIdHeader) ? whopCompanyIdHeader[0] : whopCompanyIdHeader;

      // Find user by Whop identifiers
      const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);

      if (!user) {
        console.error('❌ Auth: User not found for Whop identifiers:', { whopUserId, whopCompanyId });
        errorResponse(res, 'User not found', 401);
        return;
      }

      // Attach to request
      req.whopUserId = whopUserId;
      req.whopCompanyId = whopCompanyId;
      req.whopRole = user.whopRole;
      req._internalUserId = user._id.toString();
      req.user = {
        whopUserId: whopUserId,
        whopCompanyId,
        whopRole: user.whopRole,
        email: user.email,
        _internalUserId: user._id.toString()
      };

      console.log('✅ Auth: User authenticated via headers (dev mode)');
      next();
      return;
    }
    
    // Production: Verify Whop token
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth: No Whop token in Authorization header for', req.method, req.path);
      errorResponse(res, 'Whop token required. Please access this app through Whop.', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    
    try {
      // ✅ Verify token with Whop SDK
      const { userId } = await whopSdk.verifyUserToken(token);
      
      // Get Whop identifiers from headers (sent by frontend)
      const whopUserIdHeader = req.headers['x-whop-user-id'];
      const whopCompanyIdHeader = req.headers['x-whop-company-id'];
      
      const whopUserId = Array.isArray(whopUserIdHeader) ? whopUserIdHeader[0] : whopUserIdHeader;
      const whopCompanyId = Array.isArray(whopCompanyIdHeader) ? whopCompanyIdHeader[0] : whopCompanyIdHeader;
      
      // Verify the userId from token matches the header
      if (whopUserId && userId !== whopUserId) {
        console.log('⚠️  Auth: Token userId mismatch');
        errorResponse(res, 'Invalid token', 401);
        return;
      }
      
      if (!whopCompanyId) {
        console.log('⚠️  Auth: Missing company ID');
        errorResponse(res, 'Company ID required', 400);
        return;
      }
      
      console.log('🛡️ Auth: Token verified -', { userId, whopCompanyId });

      // Resolve user from database
      const { User } = await import('../models/index.js');
      const user = await (User as any).findByWhopIdentifiers(userId, whopCompanyId);

      if (!user) {
        console.log('⚠️  Auth: User not found in database');
        errorResponse(res, 'User not registered. Please reload the app.', 401);
        return;
      }

      // Attach Whop context to request
      req.whopUserId = userId;
      req.whopCompanyId = whopCompanyId;
      req.whopRole = user.whopRole;
      req._internalUserId = user._id.toString();
      
      // Populate req.user for backward compatibility
      req.user = {
        whopUserId: userId,
        whopCompanyId,
        whopRole: user.whopRole,
        email: user.email,
        _internalUserId: user._id.toString()
      };

      console.log('✅ Auth: User authenticated -', { 
        userId, 
        role: user.whopRole || 'none'
      });
      
      next();
    } catch (tokenError: any) {
      console.error('❌ Auth: Token verification failed:', tokenError.message);
      errorResponse(res, 'Invalid or expired token', 401);
    }
  } catch (error) {
    console.error('❌ Auth: Unexpected error:', error);
    errorResponse(res, 'Authentication failed', 500);
  }
};

/**
 * Authorization middleware - checks Whop role
 */
export const authorize = (...allowedRoles: WhopRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.whopUserId) {
      errorResponse(res, 'Not authenticated', 401);
      return;
    }

    if (allowedRoles.length > 0 && !req.whopRole) {
      console.log('⚠️  Auth: No Whop role found, denying access');
      errorResponse(res, 'Access denied', 403);
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.whopRole!)) {
      console.log(`⚠️  Auth: Role '${req.whopRole}' not in allowed roles:`, allowedRoles);
      errorResponse(res, 'Insufficient permissions', 403);
      return;
    }

    console.log('✅ Auth: Authorized with role:', req.whopRole);
    next();
  };
};

export default { authenticate, authorize };
