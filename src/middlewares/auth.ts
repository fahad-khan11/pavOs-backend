import { Response, NextFunction } from 'express';
import { AuthRequest, WhopRole } from '../types/index.js';
import { User } from '../models/index.js';
import { errorResponse } from '../utils/response.js';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  const whopUserId = req.headers['x-whop-user-id'] as string;
  const whopCompanyId = req.headers['x-whop-company-id'] as string;

  if (!whopUserId || !whopCompanyId) {
    errorResponse(res, 'Access via Whop required', 401);
    return;
  }

  try {
  
    let user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId);

    if (!user) {
      user = await (User as any).findOrCreateWhopUser({
        whopUserId,
        whopCompanyId,
        email: `whop_${whopUserId}_${whopCompanyId.slice(-6)}@paveos.app`,
        name: 'Whop User',
        whopRole: undefined, // Will be set if user is a team member
      });
    }

    // Attach user context to request
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

    next();
  } catch (error) {
    console.error('Auth failed:', error);
    errorResponse(res, 'Authentication failed', 401);
  }
};

/**
 * Role-based authorization middleware
 * Checks if authenticated user has required Whop role
 */
export const authorize = (...allowedRoles: WhopRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Not authenticated', 401);
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(req.whopRole!)) {
      errorResponse(res, 'Forbidden', 403);
      return;
    }

    next();
  };
};

export default { authenticate, authorize };
