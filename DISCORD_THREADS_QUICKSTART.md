# Discord Thread-Based Lead Channels - Quick Start

## 🎯 Overview

This implementation creates **private Discord threads** for each lead inside a shared intake channel (`#leads`), replacing the previous system of individual channels per lead.

## ✨ What Changed

### Before (Private Channels)
```
Discord Server
├── #lead-john-doe-abc123 (Private Channel)
├── #lead-jane-smith-def456 (Private Channel)
├── #lead-bob-johnson-ghi789 (Private Channel)
└── ... (500+ channels = Discord limit reached)
```

### After (Thread-Based)
```
Discord Server
└── #leads (One Intake Channel)
    ├── 🧵 john-doe (Private Thread)
    ├── 🧵 jane-smith (Private Thread)
    ├── 🧵 bob-johnson (Private Thread)
    └── ... (1,000+ threads supported)
```

## 🚀 Quick Setup

### 1. Configure Environment Variables

Add to `.env`:

```bash
# Optional: Customize intake channel name (defaults to "leads")
DISCORD_INTAKE_CHANNEL_NAME=leads

# Optional: CRM Staff Role ID (for team access to all threads)
DISCORD_CRM_STAFF_ROLE_ID=1234567890123456789
```

### 2. Restart Backend

```bash
npm run dev
# or
pm2 restart pavos-backend
```

### 3. Send First Message

The intake channel will be **auto-created** when you send the first message to a lead from Whop UI.

## 🧪 Testing

### Test Thread Creation

```bash
npm run test:threads
```

This will:
- ✅ Create a test lead
- ✅ Create a thread in the intake channel
- ✅ Send a test message
- ✅ Verify everything works correctly

### Cleanup Test Data

```bash
# Delete test lead and database records
npm run cleanup-test-data -- --leadId=<lead-id>

# Also archive thread in Discord
npm run cleanup-test-data -- --leadId=<lead-id> --archive-discord
```

## 📋 Key Features

| Feature | Description |
|---------|-------------|
| **Single Intake Channel** | One `#leads` channel per Discord server |
| **Private Threads** | Each lead gets a private thread (ChannelType.PrivateThread) |
| **Auto-Create** | Intake channel created automatically on first use |
| **Auto-Archive** | Threads archive after 7 days of inactivity |
| **Auto-Unarchive** | Threads unarchive when new messages arrive |
| **Permission Isolation** | Only bot + staff + lead can access each thread |
| **Backward Compatible** | Same database schema, routing, and frontend |
| **Scalable** | 1,000+ active threads (vs 500 channel limit) |

## 🔐 Permissions

### Intake Channel (`#leads`)

| Role | Can See | Can Send | Can Manage |
|------|---------|----------|------------|
| @everyone | ❌ | ❌ | ❌ |
| Bot | ✅ | ✅ | ✅ |
| CRM Staff | ✅ | ✅ | ✅ |

### Individual Threads

**Only these can see each thread:**
- ✅ Discord Bot
- ✅ CRM Staff members (if role configured)
- ✅ Specific lead user (if in server)

**Everyone else:** Cannot see or access the thread

## 📊 Monitoring

### Check Logs

Look for these messages:

```
✅ Created intake channel: leads (1234567890)
✅ Created private thread: 🧵 john-doe (9876543210) for lead 69427b...
✅ Adding staff member username#1234 to thread 9876543210
✅ Sent message to lead thread: leadId=69427b..., threadId=9876543210
```

### Verify in Discord

1. **As CRM Staff**: You should see `#leads` channel with all lead threads inside
2. **As Regular Member**: You should NOT see `#leads` channel at all
3. **As Lead User**: You should only see your specific thread

## 🛠️ Troubleshooting

### Issue: "No intake channel found"

**This is normal!** The intake channel is auto-created on first thread creation.

If you want to create it manually:
1. Create a channel named `leads` in Discord
2. Make it private (@everyone denied)
3. Give bot and staff access

### Issue: CRM Staff Can't See Threads

**Solution:**
1. Set `DISCORD_CRM_STAFF_ROLE_ID` in `.env`
2. Ensure staff members have the role assigned
3. Restart backend
4. New threads will include staff members

**Note:** Existing threads won't retroactively add staff. Create new threads to test.

### Issue: Thread Auto-Archives Too Quickly

**Change the duration:**

Edit `src/services/discordChannelService.ts`, line ~113:

```typescript
autoArchiveDuration: 10080, // 7 days
// Options: 60 (1h), 1440 (1d), 4320 (3d), 10080 (7d)
```

## 📖 Documentation

- **Full Implementation Guide**: [DISCORD_THREAD_IMPLEMENTATION.md](./DISCORD_THREAD_IMPLEMENTATION.md)
- **Private Channels Guide**: [DISCORD_PRIVATE_CHANNELS.md](./DISCORD_PRIVATE_CHANNELS.md)
- **Main Testing Guide**: [TESTING_GUIDE.md](./TESTING_GUIDE.md)

## 🔄 Migration Notes

### Existing Private Channels

Channels created **before** this update:
- ✅ Continue to work normally (backward compatible)
- ✅ Messages route correctly
- ✅ No migration required

### New Leads

Leads created **after** this update:
- ✅ Get private threads automatically
- ✅ Work identically from Whop UI
- ✅ Stored in same database schema

### Gradual Migration

You can run **both systems** simultaneously:
- Old leads keep their channels
- New leads get threads
- Everything routes correctly

To force migration, delete old channels (they'll be recreated as threads on next message).

## ✅ Checklist

- [ ] Configure `DISCORD_INTAKE_CHANNEL_NAME` (optional, defaults to "leads")
- [ ] Configure `DISCORD_CRM_STAFF_ROLE_ID` (recommended for team access)
- [ ] Restart backend server
- [ ] Run `npm run test:threads` to verify
- [ ] Send message to a lead from Whop UI
- [ ] Check Discord for intake channel and thread
- [ ] Verify permissions work correctly

## 🎉 Benefits

1. **Scalability**: 1,000+ threads vs 500 channel limit
2. **Organization**: All leads in one place (`#leads`)
3. **Privacy**: Private threads (invite-only)
4. **Auto-Management**: Threads archive/unarchive automatically
5. **Backward Compatible**: No breaking changes
6. **Team Access**: Staff role gives access to all threads
7. **Clean UI**: Less channel clutter in Discord

## 💡 Tips

- Use emoji in thread names for visual organization (🧵)
- Let threads auto-archive naturally (they unarchive when needed)
- Monitor logs for thread creation and permission issues
- Use CRM Staff role for team members who need access to all leads
- Test with `npm run test:threads` before deploying to production

## 🆘 Support

If you encounter issues:
1. Check logs for error messages
2. Verify bot permissions in Discord
3. Ensure bot role is above @everyone
4. Check environment variables are set correctly
5. Run `npm run test:threads` for diagnostics

---

**Last Updated**: December 2025  
**Implementation**: Thread-Based Lead Channels  
**Status**: Production Ready ✅
