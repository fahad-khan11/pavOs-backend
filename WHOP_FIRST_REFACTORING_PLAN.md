# Whop-First Authentication & Authorization Refactoring Plan

## 📋 Executive Summary

This document outlines a comprehensive refactoring of the paveOS backend API to use **whopUserId** and **whopCompanyId** as the sole sources of user identity and tenant isolation, eliminating all reliance on internal MongoDB `_id` fields and internal `role` enums for authorization.

## 🎯 Objectives

1. **Use whopUserId and whopCompanyId as Primary Identifiers**: All authentication, authorization, and data access must use these Whop-provided identifiers instead of internal MongoDB `_id` values.

2. **Use whopRole as Sole Authorization Source**: Remove all usage of the internal `UserRole` enum ('creator', 'manager', 'admin') and use only `WhopRole` from Whop's API ('owner', 'admin', 'sales_manager', 'moderator', 'app_manager', 'support', 'manager').

3. **Enforce Strict Multi-Tenant Isolation**: All database queries must filter by `whopCompanyId` to ensure zero cross-company data leakage.

4. **Maintain Backward Compatibility**: Preserve existing UI, routes, and response formats while changing the underlying implementation.

## ⚠️ Critical Implications

### Breaking Changes

1. **Non-Whop Users Will Be Deprecated**:
   - Regular email/password accounts
   - Google OAuth accounts
   - Demo accounts
   
   **Decision Required**: Should these be:
   - Completely disabled?
   - Migrated to Whop?
   - Kept for development/testing only?

2. **Existing Data Migration Required**:
   - All existing `Contact`, `Deal`, `Lead`, and other records must have `whopCompanyId` populated
   - Records without `whopCompanyId` will become inaccessible
   
   **Action Required**: Create migration script to:
   - Assign `whopCompanyId` to existing records based on their `userId`
   - Handle orphaned records
   - Validate data integrity

3. **JWT Token Structure Changes**:
   - Old: `{ userId: string, email: string, role: UserRole }`
   - New: `{ whopUserId: string, whopCompanyId: string, email: string, whopRole: WhopRole }`
   
   **Impact**: All existing JWT tokens will be invalidated; users must re-authenticate

## 📦 Implementation Plan

### Phase 1: Type System & Data Models ✅ STARTED

#### Changes Made:
1. **Updated `src/types/index.ts`**:
   - `JWTPayload` now uses `whopUserId` and `whopCompanyId` instead of `userId`
   - `AuthRequest` provides `whopUserId`, `whopCompanyId`, and `whopRole`
   - `IUser` marks `whopUserId` and `whopCompanyId` as required (with conditional logic)
   - All model interfaces (`IContact`, `IDeal`, `ILead`, `IDiscordMessage`) now require `whopCompanyId`

2. **Updated `src/models/User.ts`**:
   - Added compound unique index: `{ whopUserId: 1, whopCompanyId: 1 }`
   - Added static methods:
     - `findByWhopIdentifiers(whopUserId, whopCompanyId)` - Primary user lookup
     - `findOrCreateWhopUser(data)` - Auto-create users from Whop auth
   - Made `whopUserId` and `whopCompanyId` conditionally required (required unless Google/password user)

3. **Updated `src/middlewares/auth.ts`**:
   - `authenticate()` now resolves users by `whopUserId + whopCompanyId`
   - Sets `req.whopUserId`, `req.whopCompanyId`, `req.whopRole`
   - Internal `_id` is resolved for backward compatibility but should NOT be used
   - `authorize()` now checks `whopRole` instead of internal `role`

4. **Updated `src/controllers/authController.ts`**:
   - `whopAuth()` now generates JWT tokens with `whopUserId` and `whopCompanyId`
   - Uses `User.findByWhopIdentifiers()` and `User.findOrCreateWhopUser()`

#### Remaining Type System Work:
- ⚠️ Other auth methods (register, login, demo, Google OAuth) still use old token structure
- Need to either disable these or adapt them to the new structure

### Phase 2: Authentication Refactoring (IN PROGRESS)

#### Required Changes:

1. **`src/controllers/authController.ts`** - Update all auth methods:
   
   **Option A: Disable Non-Whop Auth** (Recommended if app is Whop-only):
   ```typescript
   export const register = async (req: AuthRequest, res: Response): Promise<void> => {
     errorResponse(res, 'Registration is disabled. Please use Whop authentication.', 403);
   };

   export const login = async (req: AuthRequest, res: Response): Promise<void> => {
     errorResponse(res, 'Login is disabled. Please use Whop authentication.', 403);
   };

   export const demoLogin = async (req: AuthRequest, res: Response): Promise<void> => {
     errorResponse(res, 'Demo login is disabled. Please use Whop authentication.', 403);
   };

   export const googleCallback = async (req: AuthRequest, res: Response): Promise<void> => {
     errorResponse(res, 'Google OAuth is disabled. Please use Whop authentication.', 403);
   };
   ```

   **Option B: Adapt Non-Whop Auth** (If backward compatibility is required):
   - Create a synthetic `whopUserId` and `whopCompanyId` for non-Whop users
   - Example: `whopUserId: "internal_${userId}"`, `whopCompanyId: "internal_default"`
   - This maintains compatibility but doesn't provide true multi-tenancy

2. **`src/utils/jwt.ts`** - No changes needed (already uses JWTPayload type)

3. **`src/config/passport.ts`** - Needs review if Google OAuth is still used

### Phase 3: Controller Refactoring (TODO)

All controllers must be updated to:
1. Resolve users via `whopUserId + whopCompanyId` instead of `userId`
2. Filter ALL queries by `whopCompanyId`
3. Use `whopRole` for authorization (not internal `role`)

#### Controllers to Update:

1. **`src/controllers/contactController.ts`**:
   ```typescript
   export const getAllContacts = async (req: AuthRequest, res: Response): Promise<void> => {
     const whopCompanyId = req.whopCompanyId!;
     
     // ✅ REFACTORED: Filter by whopCompanyId only
     const query: any = { whopCompanyId };
     
     // Apply additional filters (status, search, etc.)
     // ...
     
     const contacts = await Contact.find(query);
     successResponse(res, contacts);
   };

   export const createContact = async (req: AuthRequest, res: Response): Promise<void> => {
     const whopCompanyId = req.whopCompanyId!;
     const whopUserId = req.whopUserId!;
     
     // ✅ REFACTORED: Look up internal userId for Contact.userId field
     const user = await User.findByWhopIdentifiers(whopUserId, whopCompanyId);
     
     const contact = await Contact.create({
       ...req.body,
       userId: user._id.toString(),  // Legacy field
       whopCompanyId,  // Tenant boundary
     });
     
     successResponse(res, contact);
   };
   ```

2. **`src/controllers/dealController.ts`** - Similar pattern
3. **`src/controllers/leadController.ts`** - Similar pattern
4. **`src/controllers/dashboardController.ts`** - Similar pattern
5. **`src/controllers/discordController.ts`** - Similar pattern
6. **`src/controllers/whopController.ts`** - Similar pattern

#### Authorization Updates:

Replace all instances of:
```typescript
router.post('/export', authenticate, authorize('admin'), exportContacts);
```

With:
```typescript
router.post('/export', authenticate, authorize('owner', 'admin'), exportContacts);
```

### Phase 4: Data Model Updates (TODO)

Update all Mongoose models to enforce `whopCompanyId`:

1. **`src/models/Contact.ts`**:
   ```typescript
   whopCompanyId: {
     type: String,
     required: [true, 'Company ID is required'],  // ✅ Make required
     index: true,
   },
   ```

2. **`src/models/Deal.ts`** - Same change
3. **`src/models/Lead.ts`** - Same change
4. **`src/models/DiscordMessage.ts`** - Same change
5. **`src/models/Activity.ts`** - Add `whopCompanyId` field
6. **`src/models/Payment.ts`** - Add `whopCompanyId` field
7. **`src/models/Deliverable.ts`** - Add `whopCompanyId` field
8. **`src/models/Reminder.ts`** - Add `whopCompanyId` field
9. **`src/models/TelemetryEvent.ts`** - Add `whopCompanyId` field

### Phase 5: Service Layer Updates (TODO)

Update all services to use `whopUserId + whopCompanyId`:

1. **`src/services/discordBotService.ts`**:
   - Replace `userId` lookups with `whopUserId + whopCompanyId` lookups
   - Ensure all message routing uses `whopCompanyId` for tenant isolation

2. **`src/services/discordChannelService.ts`** - Similar updates

3. **`src/services/whopService.ts`** - Already company-scoped, verify all methods

### Phase 6: Data Migration (CRITICAL)

Create migration script: `scripts/migrateToWhopIdentifiers.ts`

```typescript
import { User, Contact, Deal, Lead, DiscordMessage } from '../src/models/index.js';

async function migrateToWhopIdentifiers() {
  console.log('🔄 Starting migration to Whop identifiers...\n');

  // Step 1: Find all users without whopUserId/whopCompanyId
  const legacyUsers = await User.find({
    $or: [
      { whopUserId: { $exists: false } },
      { whopCompanyId: { $exists: false } }
    ]
  });

  console.log(`Found ${legacyUsers.length} legacy users without Whop identifiers`);

  // Decision: What to do with these users?
  // Option 1: Delete them
  // Option 2: Assign synthetic Whop IDs
  // Option 3: Mark them as archived

  // Step 2: Populate whopCompanyId on all records
  const users = await User.find({ whopCompanyId: { $exists: true } });

  for (const user of users) {
    const userId = user._id.toString();
    const whopCompanyId = user.whopCompanyId!;

    // Update Contacts
    await Contact.updateMany(
      { userId, whopCompanyId: { $exists: false } },
      { $set: { whopCompanyId } }
    );

    // Update Deals
    await Deal.updateMany(
      { creatorId: userId, whopCompanyId: { $exists: false } },
      { $set: { whopCompanyId } }
    );

    // Update Leads
    await Lead.updateMany(
      { userId, whopCompanyId: { $exists: false } },
      { $set: { whopCompanyId } }
    );

    // Update Discord Messages
    await DiscordMessage.updateMany(
      { userId, whopCompanyId: { $exists: false } },
      { $set: { whopCompanyId } }
    );

    console.log(`✅ Migrated data for user: ${user.email} (company: ${whopCompanyId})`);
  }

  console.log('\n✅ Migration complete!');
}
```

### Phase 7: Testing & Validation (TODO)

1. **Unit Tests**:
   - Test `User.findByWhopIdentifiers()`
   - Test `User.findOrCreateWhopUser()`
   - Test JWT token generation with new structure
   - Test auth middleware with new identifiers

2. **Integration Tests**:
   - Test Whop OAuth flow end-to-end
   - Test multi-tenant isolation (User A cannot access Company B's data)
   - Test authorization with `whopRole`

3. **Manual Testing Checklist**:
   - [ ] Login via Whop works
   - [ ] JWT tokens contain `whopUserId` and `whopCompanyId`
   - [ ] Contacts are filtered by `whopCompanyId`
   - [ ] Deals are filtered by `whopCompanyId`
   - [ ] Leads are filtered by `whopCompanyId`
   - [ ] Discord messages are filtered by `whopCompanyId`
   - [ ] Role-based endpoints use `whopRole` correctly
   - [ ] No cross-company data leakage
   - [ ] Frontend still works (UI unchanged)

## 🚨 Rollout Strategy

### Prerequisites:
1. **Backup Database**: Full MongoDB backup before migration
2. **Staging Environment**: Test all changes in staging first
3. **User Communication**: Notify users of authentication changes

### Deployment Steps:

1. **Deploy Code Changes** (Non-Breaking):
   - Deploy Phase 1-2 changes (types, middleware, whopAuth)
   - Existing users can still log in with old tokens
   - New Whop logins use new token structure

2. **Run Data Migration** (Maintenance Window):
   - Run migration script to populate `whopCompanyId` on all records
   - Validate data integrity
   - Verify no orphaned records

3. **Deploy Controller Changes** (Breaking):
   - Deploy Phase 3-5 changes (controllers using new identifiers)
   - All users must re-authenticate
   - Invalidate all existing JWT tokens

4. **Monitor & Validate**:
   - Monitor error logs for authentication failures
   - Verify multi-tenant isolation
   - Check for missing `whopCompanyId` errors

## 📊 Current Status

### Completed ✅:
- Updated `src/types/index.ts` with new `JWTPayload` and `AuthRequest` structures
- Updated `src/models/User.ts` with Whop identifier requirements and helper methods
- Updated `src/middlewares/auth.ts` to use `whopUserId + whopCompanyId`
- Updated `src/controllers/authController.ts` `whopAuth()` method

### In Progress 🔄:
- Handling non-Whop auth methods (register, login, demo, Google OAuth)

### Pending ⏳:
- Controller refactoring (Contacts, Deals, Leads, Dashboard, Discord, Whop)
- Data model schema updates
- Service layer updates
- Data migration script
- Testing & validation
- Documentation updates

## 🤔 Key Decisions Needed

1. **What to do with non-Whop users?**
   - Option A: Disable all non-Whop auth methods (app becomes Whop-only)
   - Option B: Create synthetic Whop IDs for legacy users
   - Option C: Maintain dual authentication (complex, not recommended)

2. **How to handle existing data without whopCompanyId?**
   - Option A: Auto-migrate based on `userId` → `user.whopCompanyId`
   - Option B: Mark as archived/inaccessible
   - Option C: Delete orphaned records

3. **Deployment timeline?**
   - Gradual rollout (phased deployment)
   - Big bang (all at once with maintenance window)

## 📝 Next Steps

1. **Make Key Decisions** (above)
2. **Complete Phase 2** (Authentication refactoring)
3. **Implement Phase 3** (Controller refactoring)
4. **Create Migration Script** (Phase 6)
5. **Test in Staging**
6. **Deploy to Production**

## 📞 Support & Questions

If you need clarification on any part of this plan or want to proceed with a specific option, please let me know:
- Which authentication methods should remain?
- How to handle existing data?
- Preferred rollout strategy?

---

**Last Updated**: December 17, 2025
**Status**: Planning Complete, Implementation In Progress
**Risk Level**: HIGH (Breaking Changes, Data Migration Required)
