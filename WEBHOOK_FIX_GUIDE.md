# Whop Membership Webhook Not Firing - Fix Guide

## Problem

✅ **Webhook works in test mode** (Whop dashboard test feature)  
❌ **Webhook doesn't fire in production** when real customers join products

## Root Cause

You configured a **COMPANY webhook** instead of an **APP webhook**.

**Difference:**
- **Company Webhook**: Only fires for events on YOUR company (where you created the webhook)
- **App Webhook**: Fires for events on ANY company that has your app installed

When you test using Whop's test feature, it uses YOUR company ID, so it works.  
When a real customer joins on ANOTHER company, the webhook doesn't fire because it's not configured for that company.

## Solution

### Option 1: Use App Webhooks (RECOMMENDED)

This is the proper way to handle multi-company scenarios.

#### Step 1: Create App Webhook

1. Go to: https://whop.com/apps/developer/{your_app_id}
2. Click **"Webhooks"** tab (inside your specific app)
3. Click **"Create Webhook"**
4. Enter URL: `https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership`
5. Select events:
   - ✅ `membership_activated`
   - ✅ `membership_deactivated`
6. **API Version**: Select `v1`
7. Click **"Save"**

#### Step 2: Request Permissions

**CRITICAL:** App webhooks require explicit permissions!

1. In your app dashboard, go to **"Permissions"** tab
2. Click **"Add Permissions"**
3. Search and select:
   ```
   webhook_receive:membership_activated
   webhook_receive:membership_deactivated
   ```
4. Add description:
   ```
   "PaveOS automatically creates leads when customers join products. 
   We need webhook permissions to receive membership events from companies 
   that have installed PaveOS."
   ```
5. Click **"Save"** at bottom
6. Wait for **Whop approval** (usually 1-24 hours)

#### Step 3: After Approval

Once Whop approves the permissions:

1. Go to the company where PaveOS is installed
2. **Uninstall** PaveOS app
3. **Reinstall** PaveOS app (this accepts new permissions)
4. Now webhooks will work for that company!

---

### Option 2: Manual Member Sync (WORKAROUND)

If you can't wait for webhook approval, use manual sync:

#### Sync All Members API

**Endpoint:** `GET /api/v1/whop/sync-members?companyId={whopCompanyId}`

**How to use:**

1. Get your Whop company ID (looks like `biz_xxxxxxxxxxxxx`)

2. Call the sync endpoint:
   ```bash
   curl -X GET "https://pavos-backend.onrender.com/api/v1/whop/sync-members?companyId=biz_xxxxxxxxxxxxx" \
     -H "Authorization: Bearer YOUR_JWT_TOKEN"
   ```

3. This will:
   - Fetch ALL active memberships from Whop
   - Create leads for members that don't exist
   - Update existing leads to 'won' status

**Response:**
```json
{
  "success": true,
  "message": "Member sync completed",
  "results": {
    "total": 10,
    "created": 7,
    "updated": 3,
    "skipped": 0,
    "errors": []
  }
}
```

#### Frontend Integration

Add a "Sync Members" button in your dashboard:

```typescript
const syncMembers = async () => {
  const response = await api.get('/whop/sync-members');
  toast({
    title: 'Sync Complete',
    description: `Created ${response.data.results.created} new leads`,
  });
};

// Add button
<Button onClick={syncMembers}>
  🔄 Sync Whop Members
</Button>
```

---

## Verification

### Check Webhook is Working

1. **Have a test customer join your product**

2. **Check Render logs:**
   - Go to: https://dashboard.render.com/web/{your-service}/logs
   - Search for: `"Whop Membership Webhook received"`

3. **If you see logs:**
   ✅ Webhook is firing!
   - Check if lead was created
   - Look for error messages

4. **If you see NOTHING:**
   ❌ Webhook not firing
   - Verify you're using **App webhooks** (not company webhooks)
   - Verify **permissions are approved**
   - Verify app is **reinstalled** on target company

### Check Whop Webhook Deliveries

1. Go to Whop App Dashboard → Webhooks
2. Click on your membership webhook
3. View **"Recent Deliveries"** tab
4. Check:
   - ✅ Are webhooks being sent?
   - ✅ What's the response code? (should be 200)
   - ❌ If 404 or 500, there's an issue with your endpoint

---

## Current Webhook Configuration

**URL:** `https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership`

**Accepted Events:**
- `membership_activated`
- `membership_deactivated`
- `membership.created`
- `membership.updated`
- `membership.deleted`
- `membership.cancelled`

**Handler:** `src/controllers/whopWebhookController.ts` → `handleMembershipWebhook()`

**What it does:**
1. Receives webhook from Whop
2. Extracts user ID and membership ID
3. Fetches user details from Whop API
4. Creates lead in database
5. Sets status to 'won'
6. Emits Socket.IO event for real-time update

---

## Quick Checklist

- [ ] Create **App Webhook** in Whop app dashboard
- [ ] Request `webhook_receive:membership_activated` permission
- [ ] Request `webhook_receive:membership_deactivated` permission
- [ ] Wait for Whop approval (check email)
- [ ] Reinstall app on target company
- [ ] Test with real customer joining product
- [ ] Verify lead appears in PaveOS
- [ ] Check Render logs for webhook receipt

---

## Alternative: Polling (Not Recommended)

If webhooks absolutely don't work, you could poll Whop API:

```typescript
// Check for new memberships every 5 minutes
setInterval(async () => {
  const memberships = await whop.memberships.list({ 
    company_id: companyId,
    valid: true 
  });
  // Compare with database and create missing leads
}, 5 * 60 * 1000);
```

**But this is NOT recommended because:**
- ❌ High API usage
- ❌ Delayed lead creation
- ❌ Rate limiting issues
- ❌ More complex code

Webhooks are the proper solution!

---

## Still Having Issues?

### Enable Enhanced Logging

The webhook controller now includes enhanced logging:
- Full webhook payload
- Request headers
- Request method and URL
- Processing steps

Check Render logs for detailed information.

### Contact Whop Support

If webhooks still don't work after following all steps:

**Email:** support@whop.com  
**Subject:** "App webhooks not firing for membership_activated"  
**Include:**
- Your App ID: `app_MdbIY95AMK4gcL`
- Webhook URL: `https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership`
- Test company ID where you installed the app
- Screenshot of webhook configuration
- Screenshot of requested permissions

---

## Summary

**Problem:** Company webhooks only work for YOUR company, not for customers' companies.

**Solution:** Use **App webhooks** with proper permissions so webhooks fire for ALL companies that install your app.

**Workaround:** Use `/api/v1/whop/sync-members` endpoint to manually import members.
