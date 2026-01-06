# Whop Webhook Not Triggering - Debugging Guide

## Problem
- ✅ Test webhooks work (when you click "Test" in Whop dashboard)
- ❌ Real webhooks DON'T work (when customer actually joins product)
- Customer joined via: `https://whop.com/checkout/plan_lJBMufbqd2bR0`
- Lead is NOT appearing in PaveOS

## Root Cause Analysis

### Why Test Works
When you click "Test Webhook" in Whop:
1. Whop sends **fake data** to your URL
2. Your server receives it ✅
3. Creates a fake lead ✅
4. **This proves your server endpoint works!**

### Why Production Doesn't Work
When real customer joins:
1. Customer completes checkout
2. Whop creates membership
3. **Whop SHOULD send webhook** ❌ NOT HAPPENING
4. Your server never receives anything
5. No lead created

## Possible Causes & Solutions

### 1. Wrong Webhook Type (MOST LIKELY)

**Problem:** You created a **Company Webhook** instead of **App Webhook**

**Company Webhook:**
- Only fires for events on YOUR company
- If customer joins another company's product → webhook doesn't fire
- Location: `whop.com/dashboard/developer` (base level)

**App Webhook:**
- Fires for events on ANY company that has your app installed
- Requires special permissions
- Location: `whop.com/apps/developer/app_MdbIY95AMK4gcL` (inside your app)

**Solution:**
1. Go to your PaveOS app: https://whop.com/apps/developer/app_MdbIY95AMK4gcL
2. Click "Webhooks" tab
3. Click "Create Webhook"
4. Enter URL: `https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership`
5. Select event: `membership_activated`
6. **CRITICAL:** Go to "Permissions" tab
7. Click "Add Permissions"
8. Select: `webhook_receive:membership_activated`
9. Save and submit for review

### 2. Webhook URL Issues

**Check these:**
- ✅ URL is publicly accessible (not localhost)
- ✅ URL uses HTTPS (not HTTP)
- ✅ Server is running and deployed
- ✅ No firewall blocking requests

**Your webhook URL:**
```
https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership
```

**Test it manually:**
```bash
curl -X POST https://pavos-backend.onrender.com/api/v1/webhooks/whop/membership \
  -H "Content-Type: application/json" \
  -d '{
    "event": "membership_activated",
    "data": {
      "id": "mem_test123",
      "user_id": "user_test123",
      "company_id": "biz_9CBBQph398IKfd"
    }
  }'
```

### 3. Webhook Not Enabled for This Event

**Check:**
1. Go to webhook settings in Whop
2. Verify `membership_activated` is checked
3. Verify webhook is **active** (not disabled)

### 4. Company ID Mismatch

**Your company ID:** `biz_9CBBQph398IKfd`

When customer joins, Whop needs to know:
- Which company owns the product?
- Is PaveOS installed on that company?
- Should webhook be sent?

**Check:**
1. Product `plan_lJBMufbqd2bR0` belongs to company `biz_9CBBQph398IKfd`?
2. PaveOS app is installed on that company?
3. Webhook is configured for app (not just company)?

## How to Debug

### Step 1: Check Whop Webhook Logs
1. Go to Whop dashboard → Webhooks
2. Click on your webhook
3. Check "Recent Deliveries" or "Logs"
4. See if webhook was sent and what response code

### Step 2: Check Your Server Logs
```bash
# SSH into your Render server or check logs
tail -f logs/combined.log | grep -i webhook
```

### Step 3: Test Webhook Manually
Use Whop's "Test Webhook" feature:
1. Go to webhook in Whop dashboard
2. Click "Test"
3. Should see logs in your server ✅

### Step 4: Create Real Membership
1. Have someone (or you with different email) purchase
2. Check Whop dashboard - is membership created?
3. Check webhook logs - was webhook sent?
4. Check your server logs - was webhook received?

## Expected Flow

### When Customer Joins Product:

```
Customer clicks checkout link
     ↓
Customer completes payment
     ↓
Whop creates membership record
     ↓
[WEBHOOK SHOULD FIRE HERE] ← Currently failing
     ↓
Whop sends POST to your webhook URL
     ↓
Your server receives webhook
     ↓
handleMembershipWebhook() processes it
     ↓
Lead created in PaveOS
     ↓
Customer appears in leads list
```

## Quick Test

Run this to create a test lead manually:
```bash
curl -X POST http://localhost:5000/api/v1/webhooks/whop/membership \
  -H "Content-Type: application/json" \
  -d '{
    "event": "membership_activated",
    "data": {
      "id": "mem_testcustomer123",
      "user_id": "user_testcustomer123",
      "company_id": "biz_9CBBQph398IKfd",
      "user": {
        "email": "testcustomer@example.com",
        "username": "testcustomer"
      }
    }
  }'
```

## Next Steps

1. **Verify webhook type** (App vs Company)
2. **Add webhook permissions** if using App webhooks
3. **Check Whop webhook delivery logs** 
4. **Monitor your server logs** during next purchase
5. **Test with real purchase** to confirm fix

## Need More Help?

If webhook still doesn't fire:
1. Share screenshot of Whop webhook configuration
2. Share screenshot of Whop webhook delivery logs
3. Share server logs during a test purchase
4. Confirm your app is installed on the company
