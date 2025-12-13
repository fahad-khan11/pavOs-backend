import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types/index.js';
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

    console.log('✅ Auth: Success - userId:', decoded.userId);

    // Attach user info to request
    req.user = decoded;
    req.userId = decoded.userId;

    // ✅ MULTI-TENANT: Fetch and attach user's whopCompanyId for tenant isolation
    try {
      const { User } = await import('../models/index.js');
      const user = await User.findById(decoded.userId).select('whopCompanyId').lean();
      if (user && user.whopCompanyId) {
        req.whopCompanyId = user.whopCompanyId;
        console.log('✅ Auth: Company ID:', user.whopCompanyId);
      }
    } catch (error) {
      console.log('⚠️  Could not fetch company ID:', error);
      // Continue without company ID for backward compatibility
    }

    next();
  } catch (error) {
    console.error('❌ Auth error:', error);
    errorResponse(res, 'Authentication failed', 401);
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Not authenticated', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      errorResponse(res, 'Not authorized to access this resource', 403);
      return;
    }

    next();
  };
};

export default { authenticate, authorize };
