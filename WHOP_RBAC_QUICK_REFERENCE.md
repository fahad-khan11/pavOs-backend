# Quick Reference: Apply Whop RBAC to Your Controllers

## Import Statements

Add these to your route files:

```typescript
import { requireWhopRole, requireWhopPermission } from '../middlewares/whopAuthorization.js';
```

## Common Patterns by Feature

### 1. Dashboard & Analytics (Owner Only)

```typescript
// src/routes/dashboardRoutes.ts
router.get('/dashboard/analytics', 
  authenticate,
  requireWhopRole('owner'),  // Only owners can view analytics
  getAnalytics
);
```

### 2. Contact/User Export (Admin/Owner)

```typescript
// src/routes/contactRoutes.ts
router.get('/contacts/export',
  authenticate,
  requireWhopPermission('users:export'),  // Admin or Owner
  exportContacts
);

router.get('/contacts',
  authenticate,  // All team members can view
  getContacts
);
```

### 3. Payment Management

```typescript
// src/routes/paymentRoutes.ts

// View payments - Sales Manager+
router.get('/payments',
  authenticate,
  requireWhopPermission('payments:view'),
  getPayments
);

// Export payments - Admin/Owner only
router.get('/payments/export',
  authenticate,
  requireWhopPermission('payments:export'),
  exportPayments
);

// Issue refunds - Admin/Owner only
router.post('/payments/:id/refund',
  authenticate,
  requireWhopPermission('refunds:issue'),
  issueRefund
);
```

### 4. Product/Deal Management

```typescript
// src/routes/dealRoutes.ts

// All team members can view deals
router.get('/deals',
  authenticate,
  getDeals
);

// All team members can create deals
router.post('/deals',
  authenticate,
  createDeal
);

// Only Admin/Owner can delete deals
router.delete('/deals/:id',
  authenticate,
  requireWhopRole('admin'),
  deleteDeal
);
```

### 5. Team Management

```typescript
// src/routes/teamRoutes.ts

// Invite moderators/sales managers - Admin+
router.post('/team/invite',
  authenticate,
  requireWhopPermission('team:invite_moderators'),
  inviteTeamMember
);

// Invite admins - Owner only
router.post('/team/invite/admin',
  authenticate,
  requireWhopPermission('team:invite_admins'),
  inviteAdmin
);
```

### 6. Settings

```typescript
// src/routes/settingsRoutes.ts

// View settings - Admin+
router.get('/settings',
  authenticate,
  requireWhopPermission('settings:view'),
  getSettings
);

// Update settings - Owner only
router.put('/settings',
  authenticate,
  requireWhopPermission('settings:manage'),
  updateSettings
);

// Manage API keys - Owner only
router.post('/settings/api-keys',
  authenticate,
  requireWhopPermission('api_keys:manage'),
  manageApiKeys
);
```

### 7. Marketing Features

```typescript
// src/routes/marketingRoutes.ts

// Create checkout links - Sales Manager+
router.post('/checkout-links',
  authenticate,
  requireWhopPermission('checkout_links:create'),
  createCheckoutLink
);

// View checkout links - All team members
router.get('/checkout-links',
  authenticate,
  requireWhopPermission('checkout_links:view'),
  getCheckoutLinks
);

// Manage marketing campaigns - Admin+
router.post('/marketing/campaigns',
  authenticate,
  requireWhopPermission('marketing:manage'),
  createCampaign
);
```

## Recommended Protection Levels

### Public (All Authenticated Users)
- View own deals/contacts/leads
- Create deals/contacts/leads
- View own messages
- Update own profile

### Moderator Level
- Delete messages
- Mute/ban users
- Delete comments
- View checkout links

### Sales Manager Level
- View all users (no export)
- View all payments (no export)
- Create checkout links
- View revenue stats

### Admin Level
- Export users/payments
- Manage products
- Issue refunds
- Invite moderators/sales managers
- View settings
- Manage marketing

### Owner Level
- Access payouts
- Manage API keys/OAuth/Webhooks
- View analytics
- Invite admins/owners
- Modify settings
- Transfer ownership

## Checking Role in Controllers

If you need conditional logic based on role:

```typescript
import { hasPermission, hasRoleLevel } from '../middlewares/whopAuthorization.js';

export const getDashboard = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;
  const whopRole = req.whopRole;
  
  // Basic stats for everyone
  const stats = await getDashboardStats(userId);
  
  // Advanced analytics only for owners
  if (hasPermission(whopRole, 'analytics:view')) {
    stats.analytics = await getAdvancedAnalytics(userId);
  }
  
  // Financial data only for admins+
  if (hasRoleLevel(whopRole, 'admin')) {
    stats.financials = await getFinancials(userId);
  }
  
  successResponse(res, stats);
};
```

## Your Existing Controllers

### dashboardController.ts

```typescript
// Current: No role restrictions
// Recommended changes:

// Stats - All team members ✅
router.get('/stats', authenticate, getDashboardStats);

// Analytics - Owner only 🔐
router.get('/analytics', authenticate, requireWhopRole('owner'), getAnalytics);

// Revenue chart - Sales Manager+ 🔐
router.get('/revenue-chart', authenticate, requireWhopPermission('payments:view'), getRevenueChart);
```

### contactController.ts

```typescript
// View/Create - All team members ✅
router.get('/contacts', authenticate, getContacts);
router.post('/contacts', authenticate, createContact);

// Export - Admin/Owner only 🔐
router.get('/contacts/export', authenticate, requireWhopPermission('users:export'), exportContacts);

// Sync from Whop - Admin+ 🔐
router.post('/contacts/sync', authenticate, requireWhopRole('admin'), syncWhopContacts);
```

### dealController.ts

```typescript
// View/Create/Update - All team members ✅
router.get('/deals', authenticate, getDeals);
router.post('/deals', authenticate, createDeal);
router.put('/deals/:id', authenticate, updateDeal);

// Delete - Admin+ 🔐
router.delete('/deals/:id', authenticate, requireWhopRole('admin'), deleteDeal);
```

### leadController.ts

```typescript
// View/Create/Update - All team members ✅
router.get('/leads', authenticate, getLeads);
router.post('/leads', authenticate, createLead);
router.put('/leads/:id', authenticate, updateLead);

// Export - Admin+ 🔐
router.get('/leads/export', authenticate, requireWhopPermission('users:export'), exportLeads);

// Bulk import - Admin+ 🔐
router.post('/leads/import', authenticate, requireWhopRole('admin'), importLeads);
```

## Testing Checklist

- [ ] Owner can access all endpoints
- [ ] Admin cannot access owner-only features (analytics, API keys)
- [ ] Sales Manager can view payments but not export
- [ ] Moderator can only moderate, not view financial data
- [ ] Non-team members get proper error messages
- [ ] Multi-tenant isolation still works (users only see their company data)

## Notes

1. **Role checks are ADDITIVE to multi-tenant filtering** - Always filter by `whopCompanyId` + `userId` first!
2. **Roles are optional** - If a user doesn't have a Whop role, they can still use basic features
3. **For Whop-only features** - Use role checks
4. **For core CRM features** - Keep accessible to all authenticated users
