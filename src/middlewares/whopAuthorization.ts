import { Response, NextFunction } from 'express';
import { AuthRequest, WhopRole } from '../types/index.js';
import { errorResponse } from '../utils/response.js';

/**
 * Whop Role Hierarchy and Permissions
 * Based on: https://docs.whop.com/manage-your-business/team-management/manage-team-roles
 * 
 * Hierarchy (from highest to lowest):
 * 1. owner - Full access to everything
 * 2. admin - All permissions except payouts, API keys, OAuth, analytics
 * 3. sales_manager - View users/payments, create checkout links, moderator permissions
 * 4. moderator - Delete messages, mute/ban users, delete comments
 * 5. app_manager, support, manager - Custom roles (treat as moderator level)
 */

type WhopPermission = 
  // Moderator level
  | 'chat:moderate'
  | 'forum:moderate'
  
  // Sales Manager level
  | 'users:view'
  | 'payments:view'
  | 'checkout_links:create'
  | 'checkout_links:view'
  
  // Admin level
  | 'products:manage'
  | 'apps:manage'
  | 'store:manage'
  | 'refunds:issue'
  | 'marketing:manage'
  | 'team:invite_moderators'
  | 'team:invite_sales_managers'
  | 'finances:view'
  | 'settings:view'
  
  // Owner level
  | 'payouts:access'
  | 'api_keys:manage'
  | 'oauth:manage'
  | 'webhooks:manage'
  | 'analytics:view'
  | 'team:invite_admins'
  | 'team:invite_owners'
  | 'ownership:transfer'
  | 'settings:manage'
  | 'users:export'
  | 'payments:export';

/**
 * Define which roles have which permissions
 */
const ROLE_PERMISSIONS: Record<WhopRole, WhopPermission[]> = {
  owner: [
    // All permissions
    'chat:moderate', 'forum:moderate',
    'users:view', 'payments:view', 'checkout_links:create', 'checkout_links:view',
    'products:manage', 'apps:manage', 'store:manage', 'refunds:issue', 'marketing:manage',
    'team:invite_moderators', 'team:invite_sales_managers', 'finances:view', 'settings:view',
    'payouts:access', 'api_keys:manage', 'oauth:manage', 'webhooks:manage', 'analytics:view',
    'team:invite_admins', 'team:invite_owners', 'ownership:transfer', 'settings:manage',
    'users:export', 'payments:export'
  ],
  admin: [
    // All except owner-only permissions
    'chat:moderate', 'forum:moderate',
    'users:view', 'payments:view', 'checkout_links:create', 'checkout_links:view',
    'products:manage', 'apps:manage', 'store:manage', 'refunds:issue', 'marketing:manage',
    'team:invite_moderators', 'team:invite_sales_managers', 'finances:view', 'settings:view',
    'users:export', 'payments:export'
  ],
  sales_manager: [
    // Moderator + sales permissions
    'chat:moderate', 'forum:moderate',
    'users:view', 'payments:view', 'checkout_links:create', 'checkout_links:view'
  ],
  moderator: [
    // Community moderation only
    'chat:moderate', 'forum:moderate', 'checkout_links:view'
  ],
  app_manager: [
    // Same as moderator for now
    'chat:moderate', 'forum:moderate', 'checkout_links:view'
  ],
  support: [
    // Same as moderator for now
    'chat:moderate', 'forum:moderate', 'checkout_links:view'
  ],
  manager: [
    // Same as moderator for now
    'chat:moderate', 'forum:moderate', 'checkout_links:view'
  ]
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: WhopRole | undefined, permission: WhopPermission): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if a role is at least at a certain level
 * Hierarchy: owner > admin > sales_manager > moderator
 */
export function hasRoleLevel(role: WhopRole | undefined, minimumRole: WhopRole): boolean {
  if (!role) return false;
  
  const roleHierarchy: Record<WhopRole, number> = {
    owner: 100,
    admin: 80,
    sales_manager: 60,
    moderator: 40,
    app_manager: 40,
    support: 40,
    manager: 40
  };
  
  const userLevel = roleHierarchy[role] || 0;
  const requiredLevel = roleHierarchy[minimumRole] || 0;
  
  return userLevel >= requiredLevel;
}

/**
 * Middleware: Require specific Whop role level
 * Usage: requireWhopRole('admin') - requires admin or owner
 */
export function requireWhopRole(...allowedRoles: WhopRole[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      // ✅ REFACTORED: Use Whop identifiers to resolve user
      const whopUserId = req.whopUserId;
      const whopCompanyId = req.whopCompanyId;
      
      if (!whopUserId || !whopCompanyId) {
        errorResponse(res, 'Authentication required', 401);
        return;
      }

      // Fetch user's Whop role from database
      const { User } = await import('../models/index.js');
      const user = await (User as any).findByWhopIdentifiers(whopUserId, whopCompanyId).select('whopRole whopCompanyId');
      
      if (!user) {
        errorResponse(res, 'User not found', 404);
        return;
      }

      const whopRole = user.whopRole;
      
      if (!whopRole) {
        errorResponse(res, 'Whop role not found. This feature requires a Whop team member account.', 403);
        return;
      }

      // Check if user has one of the allowed roles
      const hasRole = allowedRoles.some(role => hasRoleLevel(whopRole, role));
      
      if (!hasRole) {
        errorResponse(
          res,
          `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${whopRole}`,
          403
        );
        return;
      }

      // Attach whopRole to request for use in controllers
      req.whopRole = whopRole;
      next();
    } catch (error: any) {
      console.error('Whop role authorization error:', error);
      errorResponse(res, 'Authorization check failed', 500);
    }
  };
}

/**
 * Middleware: Require specific permission
 * Usage: requireWhopPermission('users:export')
 */
export function requireWhopPermission(...requiredPermissions: WhopPermission[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.userId;
      
      if (!userId) {
        errorResponse(res, 'Authentication required', 401);
        return;
      }

      // Fetch user's Whop role from database
      const { User } = await import('../models/index.js');
      const user = await User.findById(userId).select('whopRole');
      
      if (!user) {
        errorResponse(res, 'User not found', 404);
        return;
      }

      const whopRole = user.whopRole;
      
      if (!whopRole) {
        errorResponse(res, 'Whop role not found. This feature requires a Whop team member account.', 403);
        return;
      }

      // Check if user has all required permissions
      const hasAllPermissions = requiredPermissions.every(perm => 
        hasPermission(whopRole, perm)
      );
      
      if (!hasAllPermissions) {
        errorResponse(
          res,
          `Access denied. Required permissions: ${requiredPermissions.join(', ')}. Your role: ${whopRole}`,
          403
        );
        return;
      }

      // Attach whopRole to request
      req.whopRole = whopRole;
      next();
    } catch (error: any) {
      console.error('Whop permission authorization error:', error);
      errorResponse(res, 'Authorization check failed', 500);
    }
  };
}

/**
 * Export permissions for use in controllers
 */
export { WhopPermission, ROLE_PERMISSIONS };
