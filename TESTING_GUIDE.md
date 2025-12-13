# 🧪 Multi-Tenant Testing Guide

## Quick Test: Verify Company Isolation

### Test 1: Check Current User's Company ID

```bash
# Start your backend server
cd paveOs-be
npm run dev
```

1. Login to your paveOS app via Whop
2. Check the backend logs, you should see:
```
✅ Auth: Success - userId: 693b225ac797c150c26a43cb
✅ Auth: Company ID: biz_a2NSfFZqnLucxQ
```

### Test 2: Sync Whop Customers

1. Go to Settings → Integrations → Whop
2. Click "Sync Whop Customers"
3. Check backend logs:

**Expected Output:**
```
Starting Whop sync for user: 693b225ac797c150c26a43cb, company: biz_a2NSfFZqnLucxQ
Company ID: biz_a2NSfFZqnLucxQ
Found 10 members from Whop for company: biz_a2NSfFZqnLucxQ
```

**Before Fix (WRONG):**
```
Company ID: biz_a2NSfFZqnLucxQ  ← Always the same hardcoded value
```

**After Fix (CORRECT):**
```
Company ID: biz_XYZ123  ← Different for each user's company
```

### Test 3: Verify Database Records

Open MongoDB and check:

```javascript
// Check if new contacts have whopCompanyId
db.contacts.find({ whopMembershipId: { $exists: true } }).limit(5)

// Expected: Each contact should have whopCompanyId field
{
  "_id": "...",
  "userId": "693b225ac797c150c26a43cb",
  "whopCompanyId": "biz_a2NSfFZqnLucxQ",  // ✅ Company ID present
  "name": "John Doe",
  "email": "john@example.com",
  ...
}
```

---

## Test Multiple Companies (Advanced)

### Scenario: David has 2 companies

1. **Company A: FitnessHub** (biz_ABC123)
2. **Company B: TechCourses** (biz_XYZ789)

### Steps:

#### Install paveOS on FitnessHub
1. Go to Whop → FitnessHub company dashboard
2. Install paveOS app
3. Login to paveOS
4. Sync customers

**Expected:**
- Whop sends: `{ whopUserId: "user_david", whopCompanyId: "biz_ABC123" }`
- Database creates User: `{ _id: "001", whopUserId: "user_david", whopCompanyId: "biz_ABC123" }`
- Syncs only FitnessHub's 500 members
- All contacts have: `whopCompanyId: "biz_ABC123"`

#### Install paveOS on TechCourses  
1. Go to Whop → TechCourses company dashboard
2. Install paveOS app (again!)
3. Login to paveOS (separate session)
4. Sync customers

**Expected:**
- Whop sends: `{ whopUserId: "user_david", whopCompanyId: "biz_XYZ789" }`
- Database creates User: `{ _id: "002", whopUserId: "user_david", whopCompanyId: "biz_XYZ789" }`
- Syncs only TechCourses' 300 members
- All contacts have: `whopCompanyId: "biz_XYZ789"`

#### Verify Isolation
```javascript
// Check FitnessHub contacts
db.contacts.find({ whopCompanyId: "biz_ABC123" }).count()
// Expected: 500

// Check TechCourses contacts
db.contacts.find({ whopCompanyId: "biz_XYZ789" }).count()
// Expected: 300

// Verify NO overlap
db.contacts.find({ 
  whopCompanyId: "biz_ABC123", 
  userId: "002"  // TechCourses user ID
}).count()
// Expected: 0 (zero cross-tenant data!)
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "whopCompanyId is undefined"

**Symptom:** Logs show `whopCompanyId: undefined`

**Solution:**
1. Logout and login again via Whop
2. Ensure user record has `whopCompanyId` field
3. Check: `db.users.findOne({ _id: "YOUR_USER_ID" })`

### Issue 2: "Fetching members for wrong company"

**Symptom:** Syncing members from different company

**Solution:**
1. Check WhopService logs for company_id parameter
2. Verify user.whopCompanyId is correct
3. Clear cache and retry

### Issue 3: "Cannot read property 'whopCompanyId' of null"

**Symptom:** Auth middleware error

**Solution:**
1. Make sure user exists in database
2. Check JWT token is valid
3. Verify User model has whopCompanyId field

---

## ✅ Success Criteria

Your implementation is correct if:

1. ✅ Each user has correct `whopCompanyId` in database
2. ✅ Sync logs show dynamic company ID (not hardcoded)
3. ✅ Each company's data is isolated (no cross-tenant access)
4. ✅ Multiple installations by same person create separate user records
5. ✅ All new contacts/leads have `whopCompanyId` field

---

## 📊 Quick Database Queries

```javascript
// Count users by company
db.users.aggregate([
  { $group: { _id: "$whopCompanyId", count: { $sum: 1 } } }
])

// Find contacts without company ID (old data)
db.contacts.find({ 
  whopCompanyId: { $exists: false },
  source: "whop"
}).count()

// Verify tenant isolation
db.contacts.find({ 
  whopCompanyId: "biz_ABC123" 
}).count()
```

---

## 🎯 Ready for Whop Submission

Before submitting to Whop, verify:

- [ ] Multiple test companies work correctly
- [ ] No cross-tenant data leakage
- [ ] All synced data has whopCompanyId
- [ ] Auth logs show correct company ID
- [ ] Database indexes are created

**All checks passed?** → Ready to submit to Whop! 🚀
