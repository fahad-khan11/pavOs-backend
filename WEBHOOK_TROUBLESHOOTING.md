# Whop Webhook Troubleshooting Guide

## Issue: `membership_activated` webhook works in test mode but NOT in production

### Root Causes

**The webhook is configured as a COMPANY webhook, not an APP webhook.**

When you install your product on ANOTHER company:
- ❌ **Company webhooks** only fire for YOUR company (the creator)
- ✅ **App webhooks** fire for ALL companies that have your app installed

### Solution: Use App Webhooks

#### Step 1: Create App Webhook

1. Go to **Whop Dashboard** → **Developer** → **Your App**
   - URL: https://whop.com/apps/developer/{your_app_id}

2. Click **Webhooks** tab (inside your app)

3. Click **"Create Webhook"**

4. Enter webhook URL:
   ```
   https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership
   ```

5. Select events:
   - ✅ `membership_activated`
   - ✅ `membership_deactivated`

6. Click **Save**

#### Step 2: Request Webhook Permissions

**CRITICAL:** App webhooks require permissions!

1. In your app dashboard, go to **Permissions** tab

2. Click **"Add Permissions"**

3. Search for and add:
   - ✅ `webhook_receive:membership_activated`
   - ✅ `webhook_receive:membership_deactivated`

4. Provide justification:
   ```
   "PaveOS needs to automatically create leads when customers join products on companies that have installed our app."
   ```

5. Click **"Save"** at the bottom

6. **Wait for approval** (can take a few hours)

#### Step 3: Reinstall App (After Permissions Approved)

Once permissions are approved:

1. Go to the company where you installed PaveOS
2. **Uninstall** the app
3. **Reinstall** the app (this accepts new permissions)

Now when customers join products on that company, the webhook will fire!

---

## Testing

### Test with Whop Test Feature

1. Go to your App's Webhooks tab
2. Find your webhook
3. Click **"Test"**
4. Select `membership_activated` event
5. Click **"Send Test"**

Expected logs:
```
🔔 Whop Membership Webhook received: {...}
📍 Event: membership_activated | User: user_xxx | Company: biz_xxx
✨ Creating lead from new membership...
👤 Member: Test User
✅ Lead created successfully!
```

### Test in Production

1. Have a test customer join your product
2. Check Render logs: https://dashboard.render.com/web/{your-service}/logs
3. Look for webhook logs

If you see **NOTHING** in logs:
- ❌ Webhook is not firing
- Solution: Use **App webhooks** (not company webhooks)

If you see logs but **lead not created**:
- Check error messages in logs
- Likely issue: `whopCompanyId` mismatch

---

## Common Issues

### Issue 1: Webhook Only Works in Test Mode

**Problem:** Whop test webhooks use YOUR company ID, but production uses the CUSTOMER's company ID.

**Solution:** 
- Use App webhooks (fire for all installed companies)
- Or update your code to handle multiple companies

### Issue 2: No Webhook Permissions

**Error in Whop dashboard:**
```
"Your app does not have permission to receive this webhook"
```

**Solution:** Request `webhook_receive:membership_activated` permission

### Issue 3: Webhook URL Returns 404

**Test webhook URL:**
```bash
curl -X POST https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership \
  -H "Content-Type: application/json" \
  -d '{"event":"membership_activated","data":{"id":"mem_test","user_id":"user_test"}}'
```

Expected response: `200 OK`

If `404`: Check your routes are correctly mounted

### Issue 4: Lead Created But Not Visible

**Check:**
1. Lead's `whopCompanyId` matches logged-in user's company
2. Frontend filters leads by company
3. Database has lead with correct company ID

**Debug query:**
```javascript
db.leads.find({ source: 'whop' }).pretty()
```

---

## Current Configuration

### Webhook URL
```
https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership
```

### Supported Events
- `membership_activated`
- `membership_deactivated`
- `membership.created`
- `membership.updated`
- `membership.deleted`

### Route
```typescript
// src/routes/whopWebhookRoutes.ts
router.post('/membership', handleMembershipWebhook);
router.post('/memberships', handleMembershipWebhook);
```

### Handler
```typescript
// src/controllers/whopWebhookController.ts
export const handleMembershipWebhook = async (req, res) => {
  // Processes webhook and creates lead
}
```

---

## Quick Fix Checklist

- [ ] Create **App webhook** (not company webhook)
- [ ] Request `webhook_receive:membership_activated` permission
- [ ] Wait for permission approval
- [ ] Reinstall app on target company
- [ ] Test with real customer joining product
- [ ] Check Render logs for webhook receipt
- [ ] Verify lead appears in PaveOS dashboard

---

## Still Not Working?

### Enable Detailed Logging

Add to webhook handler:

```typescript
console.log('🔍 RAW WEBHOOK BODY:', JSON.stringify(req.body, null, 2));
console.log('🔍 HEADERS:', JSON.stringify(req.headers, null, 2));
```

### Check Whop Webhook Delivery Logs

1. Go to Whop App Dashboard → Webhooks
2. Click on your webhook
3. View **"Recent Deliveries"**
4. Check if webhooks are being sent
5. Check response codes (should be 200)

### Contact Whop Support

If webhooks still not firing:
- Email: support@whop.com
- Mention: "App webhooks not firing for membership_activated on installed companies"
- Provide: App ID, Webhook ID, Test company ID

---

## Expected Behavior

**When customer joins product on company with PaveOS installed:**

1. ✅ Whop fires `membership_activated` webhook
2. ✅ Your server receives POST request
3. ✅ Handler creates lead in database
4. ✅ Lead appears in PaveOS dashboard for that company
5. ✅ Company owner sees new lead immediately

**Current issue:** Step 1 not happening because webhook is Company-scoped instead of App-scoped.
