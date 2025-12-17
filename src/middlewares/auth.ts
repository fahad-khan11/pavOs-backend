import { Response, NextFunction } from 'express';
import { AuthRequest, WhopRole } from '../types/index.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { errorResponse } from '../utils/response.js';

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Auth: No token provided for', req.method, req.path);
      errorResponse(res, 'No token provided', 401);
      return;
    }

    const token = authHeader.split(' ')[1];
    console.log('🔑 Auth: Verifying token for', req.method, req.path);

    // Verify token
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      console.log('❌ Auth: Invalid/expired token');
      errorResponse(res, 'Invalid or expired token', 401);
      return;
    }

    console.log('✅ Auth: Success - whopUserId:', decoded.whopUserId, 'whopCompanyId:', decoded.whopCompanyId);

    // ✅ REFACTORED: Attach Whop identifiers to request (primary auth mechanism)
    req.user = decoded;
    req.whopUserId = decoded.whopUserId;
    req.whopCompanyId = decoded.whopCompanyId;
    req.whopRole = decoded.whopRole;

    // ✅ REFACTORED: Resolve internal user ID for backward compatibility (DO NOT USE FOR AUTHORIZATION)
    try {
      const { User } = await import('../models/index.js');
      const user = await (User as any).findByWhopIdentifiers(decoded.whopUserId, decoded.whopCompanyId);
      if (user) {
        req._internalUserId = user._id.toString();
        console.log('✅ Auth: Internal userId:', user._id.toString(), '(for backward compatibility only)');
      } else {
        console.log('⚠️  Auth: User not found in database for whopUserId:', decoded.whopUserId, 'whopCompanyId:', decoded.whopCompanyId);
        errorResponse(res, 'User not found', 401);
        return;
      }
    } catch (error) {
      console.error('❌ Could not resolve user:', error);
      errorResponse(res, 'User resolution failed', 401);
      return;
    }

    next();
  } catch (error) {
    console.error('❌ Auth error:', error);
    errorResponse(res, 'Authentication failed', 401);
  }
};

// ✅ REFACTORED: Authorization now uses whopRole instead of internal role
export const authorize = (...allowedRoles: WhopRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Not authenticated', 401);
      return;
    }

    // ✅ REFACTORED: Check whopRole instead of internal role
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
