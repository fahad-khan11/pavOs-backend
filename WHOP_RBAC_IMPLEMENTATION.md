# Whop Multi-Tenant Role-Based Access Control (RBAC) Implementation Guide

## Overview

This implementation adds **Whop's official role-based access control** to your PaveOS backend while maintaining strict **multi-tenant isolation** (whopCompanyId + userId filtering).

## Whop Roles Hierarchy

Based on [Whop's official documentation](https://docs.whop.com/manage-your-business/team-management/manage-team-roles):

1. **Owner** - Full access to everything
2. **Admin** - All permissions except payouts, API keys, OAuth, analytics
3. **Sales Manager** - View users/payments, create checkout links, moderator permissions
4. **Moderator** - Delete messages, mute/ban users, delete comments

## Changes Made

### 1. Database Schema Updates

#### `User` Model (`src/models/User.ts`)
Added new fields:
```typescript
{
  whopAuthorizedUserId: String,  // Whop's authorized user ID (ausr_xxx)
  whopRole: WhopRole,             // owner | admin | sales_manager | moderator
}
```

#### `WhopRole` Type (`src/types/index.ts`)
```typescript
export type WhopRole = 'owner' | 'admin' | 'sales_manager' | 'moderator' | 'app_manager' | 'support' | 'manager';
```

### 2. Authentication Flow Updates

#### `authController.ts` - `whopAuth` endpoint
Enhanced to fetch and store Whop roles:

```typescript
// NEW: Fetch authorized user role from Whop API
const authorizedUser = await whopService.getAuthorizedUser(whopCompanyId, whopUserId);
if (authorizedUser) {
  whopRole = authorizedUser.role;  // owner, admin, sales_manager, moderator
  whopAuthorizedUserId = authorizedUser.id;
}

// Store in User model
user.whopRole = whopRole;
user.whopAuthorizedUserId = whopAuthorizedUserId;

// Include in JWT
const accessToken = generateAccessToken({
  userId: user._id.toString(),
  email: user.email,
  role: user.role,
  whopRole: user.whopRole,  // NEW
});
```

### 3. Whop Service Enhancement

#### `whopService.ts` - New method
```typescript
/**
 * Get authorized user information (includes role in company)
 */
async getAuthorizedUser(companyId: string, userId: string): Promise<{ id: string; role: string; user: any } | null> {
  const authorizedUsers = await this.whop.authorizedUsers.list({
    company_id: companyId,
  });
  
  return authorizedUsers.data.find((au: any) => au.user?.id === userId);
}
```

**Whop API Endpoint Used**: `GET /authorized_users`
**Required Permission**: `company:authorized_user:read`

### 4. Authorization Middleware

Created `src/middlewares/whopAuthorization.ts` with:

#### A. Permission-Based Authorization
```typescript
import { requireWhopPermission } from '../middlewares/whopAuthorization.js';

// Require specific permissions
router.get('/users/export', 
  authenticate,
  requireWhopPermission('users:export'),  // Only owner/admin
  exportUsers
);
```

#### B. Role-Based Authorization
```typescript
import { requireWhopRole } from '../middlewares/whopAuthorization.js';

// Require minimum role level
router.post('/settings/api-keys', 
  authenticate,
  requireWhopRole('owner'),  // Owner only
  manageApiKeys
);
```

## Permission Matrix

| Permission | Moderator | Sales Manager | Admin | Owner |
|-----------|-----------|---------------|-------|-------|
| `chat:moderate` | ✅ | ✅ | ✅ | ✅ |
| `users:view` | ❌ | ✅ | ✅ | ✅ |
| `users:export` | ❌ | ❌ | ✅ | ✅ |
| `products:manage` | ❌ | ❌ | ✅ | ✅ |
| `refunds:issue` | ❌ | ❌ | ✅ | ✅ |
| `team:invite_admins` | ❌ | ❌ | ❌ | ✅ |
| `payouts:access` | ❌ | ❌ | ❌ | ✅ |
| `api_keys:manage` | ❌ | ❌ | ❌ | ✅ |
| `analytics:view` | ❌ | ❌ | ❌ | ✅ |

Full permission list in `src/middlewares/whopAuthorization.ts`.

## Usage Examples

### Example 1: Protect Contact Export (Admin/Owner only)

```typescript
// src/routes/contactRoutes.ts
import { requireWhopPermission } from '../middlewares/whopAuthorization.js';

router.get('/contacts/export',
  authenticate,
  requireWhopPermission('users:export'),
  exportContacts
);
```

### Example 2: Protect Analytics (Owner only)

```typescript
// src/routes/dashboardRoutes.ts
import { requireWhopRole } from '../middlewares/whopAuthorization.js';

router.get('/dashboard/analytics',
  authenticate,
  requireWhopRole('owner'),
  getAnalytics
);
```

### Example 3: Allow Sales Managers to View Payments

```typescript
// src/routes/paymentRoutes.ts
router.get('/payments',
  authenticate,
  requireWhopPermission('payments:view'),  // Sales Manager+
  getPayments
);
```

### Example 4: Check Role in Controller

```typescript
// src/controllers/settingsController.ts
import { hasPermission } from '../middlewares/whopAuthorization.js';

export const updateSettings = async (req: AuthRequest, res: Response) => {
  const whopRole = req.whopRole;
  
  // Only owners can change certain settings
  if (!hasPermission(whopRole, 'settings:manage')) {
    return errorResponse(res, 'Only owners can modify these settings', 403);
  }
  
  // Proceed...
};
```

## Multi-Tenant Isolation

**CRITICAL**: Role checks do NOT replace multi-tenant filtering!

### ✅ CORRECT - Role + Tenant Filtering
```typescript
export const getLeads = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const whopCompanyId = req.whopCompanyId;
  
  // ✅ Filter by tenant FIRST
  const query: any = { userId };
  if (whopCompanyId) {
    query.$or = [
      { whopCompanyId },
      { whopCompanyId: { $exists: false } }
    ];
  }
  
  const leads = await Lead.find(query);
  // ...
};
```

### ❌ WRONG - Role Only (No Tenant Filter)
```typescript
// ❌ BAD: Skips multi-tenant isolation
const leads = await Lead.find({});  // Returns ALL companies' data!
```

## Testing Your Implementation

### 1. Test Role Fetch During Auth

```bash
# Login as a Whop user
POST /api/v1/auth/whop
{
  "whopUserId": "user_xxxxx",
  "whopCompanyId": "biz_xxxxx",
  "email": "test@example.com",
  "name": "Test User"
}

# Check logs for:
# "🔐 User role in company: owner (authorized user ID: ausr_xxxxx)"
```

### 2. Test Role-Based Endpoint Protection

```bash
# As Moderator - should FAIL
GET /api/v1/contacts/export
Authorization: Bearer <moderator_token>
# Expected: 403 Forbidden

# As Admin - should SUCCEED
GET /api/v1/contacts/export
Authorization: Bearer <admin_token>
# Expected: 200 OK with CSV data
```

### 3. Test Role Update on Re-Auth

1. Change user's role in Whop dashboard (Dashboard > Team)
2. User logs in again via Whop
3. Check logs: "🔐 Updating user Whop role to: admin"
4. Verify new role in JWT payload

## API Configuration Required

### Whop App Permissions

In your Whop developer dashboard, ensure you've added:

1. `company:authorized_user:read` - Required to fetch team roles
2. `member:email:read` - Required to get user email

### Adding Permissions

1. Go to [Whop Developer Dashboard](https://whop.com/dashboard/developer)
2. Select your app
3. Click **Permissions** tab
4. Add permissions listed above
5. Reinstall app to approve new permissions

## Migration Guide

### For Existing Users

Run this migration to fetch roles for existing Whop users:

```typescript
// scripts/migrateWhopRoles.ts
import { User } from '../src/models/index.js';
import { whopService } from '../src/services/whopService.js';

const users = await User.find({ whopUserId: { $exists: true } });

for (const user of users) {
  const authorizedUser = await whopService.getAuthorizedUser(
    user.whopCompanyId!,
    user.whopUserId!
  );
  
  if (authorizedUser) {
    user.whopRole = authorizedUser.role;
    user.whopAuthorizedUserId = authorizedUser.id;
    await user.save();
    console.log(`✅ Updated ${user.email} to role: ${user.whopRole}`);
  }
}
```

Run with:
```bash
npx tsx scripts/migrateWhopRoles.ts
```

## Troubleshooting

### "Whop role not found" Error

**Cause**: User is accessing the app but is not a team member of the company.

**Solution**: 
- User must be added to the team in Whop Dashboard > Team
- Or, remove role requirements for non-team features

### Role Not Updating

**Cause**: JWT still has old role cached.

**Solution**: User must log out and log back in to get a fresh JWT with updated role.

### "Authorization check failed"

**Cause**: Missing permissions in Whop app.

**Solution**:
1. Check Whop app permissions include `company:authorized_user:read`
2. Reinstall app to approve permissions
3. Check server logs for detailed error

## Security Best Practices

1. **Never trust frontend** - Always check role on backend
2. **Combine with tenant filters** - Role ≠ bypassing multi-tenant isolation
3. **Fail closed** - If role is undefined, deny access
4. **Log access attempts** - Track who accessed what features
5. **Re-validate on sensitive operations** - Fetch fresh role from DB for critical actions

## Next Steps

1. ✅ **DONE**: Database schema updated with `whopRole` and `whopAuthorizedUserId`
2. ✅ **DONE**: Auth flow fetches and stores roles
3. ✅ **DONE**: Authorization middleware created
4. **TODO**: Apply role checks to protected endpoints:
   - Contact export
   - User export
   - Payment export
   - Settings management
   - API key management
   - Analytics access
5. **TODO**: Update frontend to show/hide features based on role
6. **TODO**: Add role display in user profile UI
7. **TODO**: Run migration for existing users

## Questions?

Refer to:
- [Whop Role Documentation](https://docs.whop.com/manage-your-business/team-management/manage-team-roles)
- [Whop API Reference - Authorized Users](https://docs.whop.com/api-reference/authorized-users/retrieve-authorized-user)
- Your implementation in `src/middlewares/whopAuthorization.ts`
