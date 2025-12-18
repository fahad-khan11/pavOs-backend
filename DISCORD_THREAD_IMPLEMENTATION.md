# Discord Thread-Based Lead Channels - Implementation Guide

## Overview

This implementation creates **private Discord threads** for each lead inside a shared intake channel, providing better organization and scalability compared to individual channels per lead.

## Architecture

### Thread-Based System

```
Discord Server
└── #leads (Intake Channel - Private)
    ├── 🧵 john-doe (Private Thread - Lead 1)
    ├── 🧵 jane-smith (Private Thread - Lead 2)
    ├── 🧵 bob-johnson (Private Thread - Lead 3)
    └── ... (All lead threads)
```

### Key Benefits

✅ **Single Intake Channel**: One `#leads` channel per Discord server (auto-created if missing)  
✅ **Private Threads**: Each lead gets a private thread (only visible to invited members)  
✅ **Permission Isolation**: Bot + Staff + Lead user only (no @everyone access)  
✅ **Auto-Archive**: Threads auto-archive after 7 days of inactivity  
✅ **Scalable**: No channel limit issues (Discord has thread limits, not channel limits)  
✅ **Backward Compatible**: Uses existing `DiscordLeadChannel` schema (thread ID stored as `discordChannelId`)  

---

## Database Schema (Unchanged)

The implementation uses the **existing** `DiscordLeadChannel` model with no schema changes:

```typescript
{
  leadId: string;              // CRM lead ID
  discordChannelId: string;    // ✅ NOW STORES THREAD ID (not channel ID)
  discordGuildId: string;      // Discord server ID
  whopCompanyId: string;       // Multi-tenant isolation
  discordUserId?: string;      // Lead's Discord user (if exists)
  discordUsername?: string;    // Lead's Discord username
  isActive: boolean;           // Thread active/archived status
  messageCount: number;        // Messages in thread
  lastMessageAt: Date;         // Last message timestamp
}
```

**Key Change**: `discordChannelId` now stores the **thread ID** instead of a channel ID. This maintains full backward compatibility with routing logic, frontend, and database queries.

---

## Configuration

### Environment Variables

Add to your `.env`:

```bash
# Discord Configuration
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_REDIRECT_URI=https://your-domain.com/api/v1/integrations/discord/callback

# Optional: CRM Staff Role ID
# If set, all members with this role will be added to every lead thread
DISCORD_CRM_STAFF_ROLE_ID=1234567890123456789

# Optional: Intake Channel Name (defaults to "leads")
# This is the channel where all lead threads will be created
DISCORD_INTAKE_CHANNEL_NAME=leads
```

### Bot Permissions Required

The Discord bot must have these permissions:
- `Manage Channels` (16) - To create the intake channel
- `View Channels` (1024) - To see and access channels
- `Send Messages` (2048) - To send messages in threads
- `Read Message History` (65536) - To read previous messages
- `Create Public Threads` (34359738368) - To create threads
- `Create Private Threads` (68719476736) - To create private threads
- `Manage Threads` (17179869184) - To manage thread settings

**Total Permission Integer**: `275146468368` (already includes thread permissions)

---

## How It Works

### Thread Creation Flow

1. **Check for Existing Thread**
   - Query: `DiscordLeadChannel.findOne({ leadId, isActive: true })`
   - If exists: Return existing thread
   - If not: Proceed to create

2. **Find or Create Intake Channel**
   - Search for channel named `#leads` (or `DISCORD_INTAKE_CHANNEL_NAME`)
   - If not found: Create intake channel with permissions:
     - @everyone: DENY ViewChannel (makes it private)
     - Bot: ALLOW ViewChannel, SendMessages, ManageThreads
     - CRM Staff: ALLOW ViewChannel, SendMessages, ManageThreads

3. **Create Private Thread**
   ```typescript
   const thread = await intakeChannel.threads.create({
     name: `🧵 ${leadName}`,
     autoArchiveDuration: 10080, // 7 days
     type: ChannelType.PrivateThread,
     invitable: false,
   });
   ```

4. **Add Members to Thread**
   - Bot (automatic)
   - All CRM Staff role members (if `DISCORD_CRM_STAFF_ROLE_ID` configured)
   - Lead's Discord user (if `lead.discordUserId` exists and user is in server)

5. **Save to Database**
   - Create `DiscordLeadChannel` document with `discordChannelId = thread.id`
   - Update `Lead` with `discordChannelId = thread.id`
   - Increment `DiscordConnection.syncedChannelsCount`

### Message Sending Flow

1. **Find Lead Thread**
   - Query: `DiscordLeadChannel.findOne({ leadId, isActive: true })`
   - Get thread ID from `discordChannelId`

2. **Fetch Thread**
   ```typescript
   const thread = await client.channels.fetch(discordChannelId);
   if (!thread.isThread()) throw new Error('Not a thread');
   ```

3. **Unarchive if Needed**
   ```typescript
   if (thread.archived) {
     await thread.setArchived(false);
   }
   ```

4. **Send Message**
   ```typescript
   await thread.send(content);
   ```

5. **Save to Database**
   - Create `DiscordMessage` record
   - Update `DiscordLeadChannel.messageCount` and `lastMessageAt`

### Message Receiving Flow

Message handler in `discordBotService.ts` already works with threads because:
- Threads have their own unique `channelId` (the thread ID)
- `message.channelId` returns the thread ID
- Database lookup: `DiscordLeadChannel.findOne({ discordChannelId: message.channelId })`
- ✅ **No changes needed to message routing logic!**

---

## Permission Model

### Intake Channel Permissions

| Entity | ViewChannel | SendMessages | ManageThreads |
|--------|-------------|--------------|---------------|
| @everyone | ❌ DENY | (inherited) | (inherited) |
| Discord Bot | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| CRM Staff Role | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |

### Thread Permissions

Private threads inherit permissions from the parent channel, but **only invited members** can see them.

**Thread Members**:
1. ✅ Discord Bot (always)
2. ✅ All CRM Staff role members (if `DISCORD_CRM_STAFF_ROLE_ID` configured)
3. ✅ Lead's Discord user (if `lead.discordUserId` exists and in server)

**Non-Members**: Cannot see or access the thread (even if they have access to `#leads` channel)

---

## Testing Guide

### 1. Test Thread Creation

```bash
# Send a message to a lead from Whop UI
POST /api/v1/integrations/discord/send-message
{
  "leadId": "69427b92d7481c76b520ab89",
  "content": "Hello from Whop!"
}
```

**Expected Results**:
- ✅ Intake channel `#leads` exists (or is created)
- ✅ Private thread created with name `🧵 lead-name`
- ✅ Bot is member of thread
- ✅ CRM Staff members are added to thread (if role configured)
- ✅ Lead user is added to thread (if they're in the server)
- ✅ Message appears in thread
- ✅ Message syncs to Whop UI

### 2. Verify Thread Privacy

In Discord:
1. **As @everyone member**: Cannot see `#leads` channel or any threads
2. **As CRM Staff member**: Can see `#leads` channel and all lead threads
3. **As lead user**: Can only see their specific thread (not others)
4. **As bot**: Can see and manage all threads

### 3. Test Auto-Unarchive

1. Wait for thread to auto-archive (or manually archive it)
2. Send message from Whop UI to that lead
3. Verify:
   - ✅ Thread is automatically unarchived
   - ✅ Message is delivered
   - ✅ Thread remains active

### 4. Test Message Routing (Incoming)

1. As lead user, send message in their thread
2. Verify:
   - ✅ Message appears in Whop UI instantly
   - ✅ Message saved to database
   - ✅ `DiscordMessage.direction = 'incoming'`
   - ✅ `discordLeadChannel.messageCount` incremented

### 5. Check Logs

Look for these log messages:
```
✅ Created intake channel: leads (1234567890)
✅ Created private thread: 🧵 john-doe (9876543210) for lead 69427b...
✅ Adding staff member username#1234 to thread 9876543210
✅ Adding lead user leaduser#5678 to thread 9876543210
✅ Sent message to lead thread: leadId=69427b..., threadId=9876543210
```

---

## Migration from Private Channels

### Existing Private Channels (Pre-Thread)

Channels created **before** this update will:
- ✅ Continue to work normally (backward compatible)
- ✅ Messages route correctly (same `discordChannelId` lookup)
- ✅ Appear in Whop UI as expected

### New Threads (Post-Thread)

Leads created **after** this update will:
- ✅ Get private threads inside `#leads` channel
- ✅ Use same database schema (no migration needed)
- ✅ Work identically from Whop UI perspective

### Gradual Migration Strategy

**Option 1: Natural Migration** (Recommended)
- Keep existing channels as-is
- New leads automatically get threads
- Gradually leads move to thread-based system

**Option 2: Force Migration**
- Delete old channels (they'll be recreated as threads on next message)
- Run migration script to update all leads

**Option 3: Hybrid Mode**
- Keep both systems running
- Old leads use channels
- New leads use threads

---

## Troubleshooting

### Issue: "No intake channel found"

**Symptom**: 
```
Error: No intake channel found
```

**Solution**:
The intake channel is **auto-created** on first thread creation. If you see this error, check:
1. ✅ Bot has `Manage Channels` permission
2. ✅ Bot role is positioned above @everyone
3. ✅ `DISCORD_INTAKE_CHANNEL_NAME` is valid (alphanumeric, no spaces)

### Issue: CRM Staff Can't See Threads

**Solutions**:
1. ✅ Verify `DISCORD_CRM_STAFF_ROLE_ID` is set in `.env`
2. ✅ Confirm staff members have the role assigned
3. ✅ Check that staff members are **in the Discord server**
4. ✅ Verify role ID is correct (copy from Discord Developer Mode)
5. ✅ Restart backend after changing env variables

### Issue: Thread Auto-Archives Too Quickly

**Solution**:
Threads auto-archive based on `autoArchiveDuration` (currently 7 days for non-boosted servers).

To change:
- Edit `autoArchiveDuration` in `createLeadChannel()` function
- Options: `60` (1 hour), `1440` (1 day), `4320` (3 days), `10080` (7 days)

### Issue: Lead User Not Added to Thread

**Possible Causes**:
1. ❌ `lead.discordUserId` is null/undefined
2. ❌ Lead user is not in the Discord server
3. ❌ Bot lacks permission to fetch guild members

**Solution**:
Enable bot intents:
```bash
DISCORD_BOT_INTENTS=3276799  # Includes GUILD_MEMBERS intent
```

### Issue: Thread Messages Not Syncing to UI

**Debug Steps**:
1. Check backend logs for `✅ Saved outgoing message to database`
2. Verify `DiscordLeadChannel.discordChannelId` matches thread ID
3. Check frontend WebSocket connection
4. Verify `DiscordMessage` records are created with correct `leadId`

---

## API Endpoints (Unchanged)

All existing endpoints work identically with threads:

### Create Thread (Same as Create Channel)

```http
POST /api/v1/integrations/discord/channels
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadId": "69427b92d7481c76b520ab89"
}
```

### Get Thread for Lead

```http
GET /api/v1/integrations/discord/channels/:leadId
Authorization: Bearer <token>
```

### Archive Thread

```http
DELETE /api/v1/integrations/discord/channels/:leadId
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Lead converted to customer"
}
```

---

## Code Changes Summary

### Modified Files

1. **`src/services/discordChannelService.ts`**
   - Changed `createLeadChannel()` to create threads instead of channels
   - Added intake channel auto-creation logic
   - Changed `sendMessageToChannel()` to work with threads
   - Updated `archiveLeadChannel()` to archive threads in Discord
   - Added `inviteLeadToThread()` helper function

2. **`.env.example`**
   - Added `DISCORD_INTAKE_CHANNEL_NAME` configuration

3. **`DISCORD_THREAD_IMPLEMENTATION.md`** (NEW)
   - Complete implementation documentation

### Unchanged Files

✅ **Database Models**: No schema changes  
✅ **Controllers**: No changes needed  
✅ **Routes**: No changes needed  
✅ **Frontend**: No changes needed  
✅ **Message Routing**: Already works with threads  
✅ **WebSocket**: No changes needed  

---

## Best Practices

### 1. Configure Intake Channel Name

✅ **DO**: Use a clear, professional name like `leads`, `inbox`, or `support`  
❌ **DON'T**: Use special characters or spaces

### 2. Use CRM Staff Role

✅ **DO**: Create a dedicated "CRM Staff" role for your team  
✅ **DO**: Add all team members who need to access lead threads  
❌ **DON'T**: Give everyone Administrator role

### 3. Thread Naming

✅ **DO**: Use lead names for easy identification  
✅ **DO**: Include emoji (🧵) for visual distinction  
❌ **DON'T**: Use overly long names (Discord has a limit)

### 4. Thread Management

✅ **DO**: Let threads auto-archive naturally  
✅ **DO**: Unarchive threads when new messages arrive  
❌ **DON'T**: Manually delete threads (you lose message history)

### 5. Monitoring

✅ **DO**: Monitor logs for thread creation errors  
✅ **DO**: Track thread count per server  
✅ **DO**: Set up alerts for permission errors  

---

## Performance Considerations

### Thread Limits

Discord has the following limits:
- **Active Threads**: 1,000 per server
- **Archived Threads**: Unlimited
- **Thread Members**: 50 for private threads (without boost)

### Auto-Archive Strategy

Threads auto-archive after 7 days by default:
- ✅ Reduces active thread count
- ✅ Threads auto-unarchive when new messages arrive
- ✅ No manual cleanup needed

### Scalability

Thread-based approach scales better than channels:
- ✅ No 500-channel limit per server
- ✅ Better Discord UI organization
- ✅ Faster channel list loading
- ✅ Lower memory usage

---

## Security Considerations

### Multi-Tenant Isolation

Each thread is tied to:
- `whopCompanyId` - Company owns the lead
- `leadId` - Specific lead for the thread
- `discordGuildId` - Specific Discord server

This ensures:
- Company A cannot see Company B's lead threads
- Leads from different companies are isolated
- Proper access control per company's Discord server

### Permission Hierarchy

1. **Intake channel**: Private to @everyone, visible to bot + staff
2. **Threads**: Private by nature (only invited members can see)
3. **Thread members**: Bot + Staff + Specific Lead only

### Least Privilege

- Bot uses `Manage Channels` and `Manage Threads`, NOT `Administrator`
- Staff role gets thread access only, not server-wide permissions
- Lead users only see their own thread, not others

---

## Summary

This implementation provides:
- ✅ **One intake channel** per Discord server (`#leads`)
- ✅ **Private threads** for each lead inside the intake channel
- ✅ **Permission isolation** (bot + staff + lead only)
- ✅ **Auto-archive/unarchive** for efficient thread management
- ✅ **Backward compatibility** with existing database schema
- ✅ **No changes to routing, controllers, or frontend**
- ✅ **Scalable** (1,000+ active threads, unlimited archived)

**Next Steps**:
1. Configure `DISCORD_INTAKE_CHANNEL_NAME` in your `.env` (optional)
2. Configure `DISCORD_CRM_STAFF_ROLE_ID` in your `.env` (recommended)
3. Restart backend server
4. Send first message to a lead (intake channel auto-creates)
5. Monitor logs for successful thread creation
6. Test by viewing threads in Discord

For support or questions, refer to the main Discord implementation documentation.
