import { Response, NextFunction } from 'express';
import { AuthRequest, WhopRole } from '../types/index.js';
import { errorResponse } from '../utils/response.js';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // ✅ WHOP-ONLY: Only accept Whop context headers (no JWT tokens)
    const whopUserId = req.headers['x-whop-user-id'] as string;
    const whopCompanyId = req.headers['x-whop-company-id'] as string;

    if (!whopUserId || !whopCompanyId) {
      console.log('❌ Auth: No Whop context headers for', req.method, req.path);
      errorResponse(res, 'Authentication required. Please access this app through Whop.', 401);
      return;
    }

    console.log('🔑 Auth: Using Whop context -', { whopUserId, whopCompanyId, path: req.path });

    // Find user by Whop identifiers
    try {
      const { User } = await import('../models/index.js');
      const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);
      
      if (!user) {
        console.log('⚠️  Auth: User not found for Whop context:', { whopUserId, whopCompanyId });
        errorResponse(res, 'User not found. Please ensure you are logged in through Whop.', 401);
        return;
      }

      // Attach Whop identifiers to request
      req.whopUserId = whopUserId;
      req.whopCompanyId = whopCompanyId;
      req.whopRole = user.whopRole;
      req._internalUserId = user._id.toString();
      req.user = {
        whopUserId: user.whopUserId,
        whopCompanyId: user.whopCompanyId,
        email: user.email,
        whopRole: user.whopRole,
        _internalUserId: user._id.toString(),
      };
      
      console.log('✅ Auth: Authenticated -', user.email, 'role:', user.whopRole || 'member');
      next();
    } catch (error) {
      console.error('❌ Could not resolve user from Whop context:', error);
      errorResponse(res, 'Authentication failed', 401);
    }
  } catch (error) {
    console.error('❌ Auth error:', error);
    errorResponse(res, 'Authentication failed', 401);
  }
};

export const authorize = (...allowedRoles: WhopRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Not authenticated', 401);
      return;
    }

    if (allowedRoles.length > 0 && !req.whopRole) {
      console.log('⚠️  Auth: No whopRole found for user, denying access');
      errorResponse(res, 'Not authorized to access this resource', 403);
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.whopRole!)) {
      console.log(`⚠️  Auth: User role '${req.whopRole}' not in allowed roles:`, allowedRoles);
      errorResponse(res, 'Not authorized to access this resource', 403);
      return;
    }

    console.log('✅ Auth: User authorized with role:', req.whopRole);
    next();
  };
};

export default { authenticate, authorize };
