# Discord Server Reconnection Fix

## Problem Summary

When disconnecting from a Discord server and reconnecting to a new server, the system was persisting old server data and not properly linking to the new server. This caused issues where:

1. Old server (e.g., "saadmustafa") data remained in the connection
2. Reconnecting to a new server (e.g., "PavosTesting") still showed old server info
3. Member sync was attempting to sync from the old server

## Root Causes Identified

### 1. Incomplete Disconnect Logic ❌

**Problem**: The `disconnectDiscord` endpoint only set `isActive = false` but didn't clear guild data.

**Old Code**:
```typescript
connection.isActive = false;
await connection.save();
```

**Issue**: When reconnecting, the old `discordGuildId` and `discordGuildName` remained in the database, causing confusion.

### 2. Self-Referencing Company Guild ❌

**Problem**: When checking for company guild, the query included the current user's own connection.

**Old Code**:
```typescript
const companyConnection = await DiscordConnection.findOne({
  whopCompanyId,
  isActive: true,
  discordGuildId: { $exists: true, $ne: null },
});
```

**Issue**: If a user disconnected and reconnected, their own old connection would be found as the "company connection", causing them to inherit their own old guild ID.

### 3. No Guild Access Validation ❌

**Problem**: No validation that the bot actually has access to the selected guild before saving the connection.

**Issue**: System would save a guild ID even if the bot wasn't in that server, causing sync failures.

### 4. No Sync-Time Validation ❌

**Problem**: Member sync endpoint didn't verify bot access to guild before attempting sync.

**Issue**: Would attempt to sync members from a guild the bot couldn't access.

## Solutions Implemented

### 1. ✅ Complete Disconnect Logic

**File**: `src/controllers/discordController.ts` - `disconnectDiscord()`

**Changes**:
```typescript
// ✅ FIX: Clear all Discord-related data on disconnect
connection.isActive = false;
connection.discordGuildId = undefined;
connection.discordGuildName = undefined;
connection.accessToken = undefined;
connection.refreshToken = undefined;
connection.lastSyncAt = undefined;
connection.syncedMembersCount = 0;
connection.syncedChannelsCount = 0;

await connection.save();
```

**Benefit**: Complete cleanup ensures no stale data persists after disconnect.

### 2. ✅ Exclude Self from Company Guild Lookup

**File**: `src/controllers/discordController.ts` - `handleOAuthCallback()`

**Changes**:
```typescript
// ✅ FIX: Exclude current user to avoid self-reference
const companyConnection = await DiscordConnection.findOne({
  userId: { $ne: userId }, // ✅ Exclude current user
  whopCompanyId,
  isActive: true,
  discordGuildId: { $exists: true, $ne: null },
}).sort({ connectedAt: 1 });
```

**Benefit**: Prevents users from inheriting their own old guild when reconnecting.

### 3. ✅ Validate Company Guild Access

**File**: `src/controllers/discordController.ts` - `handleOAuthCallback()`

**Changes**:
```typescript
if (companyConnection) {
  // ✅ FIX: Verify bot still has access before inheriting
  const botClient = discordBotService.getClient();
  const isAccessible = botClient && botClient.guilds.cache.has(companyConnection.discordGuildId!);
  
  if (isAccessible) {
    companyGuildId = companyConnection.discordGuildId;
    companyGuildName = companyConnection.discordGuildName;
  } else {
    console.log(`⚠️  Company guild no longer accessible, using user's guild`);
  }
}
```

**Benefit**: Only inherit company guild if bot can actually access it.

### 4. ✅ Validate Selected Guild Before Saving

**File**: `src/controllers/discordController.ts` - `handleOAuthCallback()`

**Changes**:
```typescript
// ✅ FIX: Verify selected guild is accessible before saving
if (selectedGuildId) {
  const botClient = discordBotService.getClient();
  const isAccessible = botClient && botClient.guilds.cache.has(selectedGuildId);
  
  if (!isAccessible) {
    const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=275146468368&scope=bot`;
    
    errorResponse(
      res,
      `Discord bot is not in the server "${selectedGuildName}". Please invite the bot first using this link: ${botInviteUrl}`,
      400
    );
    return;
  }
}
```

**Benefit**: Prevents saving inaccessible guilds to database.

### 5. ✅ Enhanced Sync Validation

**File**: `src/controllers/discordController.ts` - `syncDiscordMembers()`

**Changes**:
```typescript
// ✅ FIX: Validate bot has access before sync
const botClient = discordBotService.getClient();
if (!botClient || !discordBotService.isActive()) {
  errorResponse(res, 'Discord bot is not running', 500);
  return;
}

const hasAccess = botClient.guilds.cache.has(connection.discordGuildId);
if (!hasAccess) {
  const botInviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=275146468368&scope=bot`;
  
  errorResponse(
    res,
    `Discord bot is not in the server "${connection.discordGuildName}". Please invite the bot first: ${botInviteUrl}`,
    400
  );
  return;
}
```

**Benefit**: Prevents sync attempts on inaccessible guilds with helpful error messages.

### 6. ✅ Enhanced Logging

**Changes**: Added comprehensive logging throughout the OAuth and sync flows:

```typescript
console.log(`🔄 Updating existing Discord connection for userId: ${userId}`);
console.log(`   Previous Guild: ${connection.discordGuildName} (${connection.discordGuildId})`);
console.log(`   New Guild: ${selectedGuildName} (${selectedGuildId})`);
```

**Benefit**: Easy debugging of connection state changes.

### 7. ✅ Debug Endpoint

**File**: `src/controllers/discordController.ts` - `debugDiscordConnections()`  
**Route**: `GET /api/v1/integrations/discord/debug`

**New endpoint that returns**:
```json
{
  "user": {
    "userId": "...",
    "email": "...",
    "whopCompanyId": "..."
  },
  "bot": {
    "active": true,
    "guildCount": 2,
    "guilds": [
      { "id": "...", "name": "PavosTesting", "memberCount": 5 }
    ]
  },
  "connections": {
    "total": 2,
    "active": 1,
    "inactive": 1,
    "list": [
      {
        "id": "...",
        "isActive": true,
        "discordGuildId": "...",
        "discordGuildName": "PavosTesting",
        "botHasAccess": true
      },
      {
        "id": "...",
        "isActive": false,
        "discordGuildId": null,
        "discordGuildName": null,
        "botHasAccess": false
      }
    ]
  },
  "company": {
    "whopCompanyId": "...",
    "connections": [...]
  }
}
```

**Benefit**: Complete visibility into connection state for debugging.

## Testing Steps

### 1. Test Complete Disconnect

```bash
# Disconnect from Discord
POST /api/v1/integrations/discord/disconnect

# Verify in database
db.discordconnections.findOne({ userId: "..." })
# Should show:
# - isActive: false
# - discordGuildId: null/undefined
# - discordGuildName: null/undefined
```

### 2. Test Reconnect to New Server

```bash
# 1. Disconnect from old server
POST /api/v1/integrations/discord/disconnect

# 2. Reconnect via OAuth
GET /api/v1/integrations/discord/oauth-url
# Follow OAuth flow, select NEW server

# 3. Verify connection
GET /api/v1/integrations/discord/status
# Should show NEW server info, not old

# 4. Check debug info
GET /api/v1/integrations/discord/debug
# Should show:
# - Active connection with new guild
# - Inactive connection with no guild
# - Bot has access to new guild
```

### 3. Test Member Sync

```bash
# After reconnecting to new server
POST /api/v1/integrations/discord/sync-members

# Should succeed and sync members from NEW server
# Check logs for guild validation messages
```

### 4. Test Company Guild Inheritance

**Scenario**: User A connects, then User B (in same company) connects

```bash
# User A connects to Server X
# User B connects to Server Y

# User B should inherit Server X (company guild)
# UNLESS Server X is no longer accessible by bot
# Then User B should use Server Y
```

## Files Modified

1. **`src/controllers/discordController.ts`**
   - `disconnectDiscord()` - Complete data clearing
   - `handleOAuthCallback()` - Guild validation and anti-self-reference
   - `syncDiscordMembers()` - Pre-sync validation
   - `debugDiscordConnections()` - New debug endpoint

2. **`src/routes/discordRoutes.ts`**
   - Added `GET /debug` route

## Expected Behavior After Fix

### Disconnect Flow
1. User clicks "Disconnect" in UI
2. Backend clears ALL Discord data from connection
3. Connection marked as inactive
4. No guild information persists

### Reconnect Flow
1. User starts OAuth flow
2. Backend checks if company has OTHER active connections
3. If yes AND bot has access: Inherit company guild
4. If no OR bot lacks access: Use user's selected guild
5. Validate bot has access to selected guild
6. If not accessible: Show error with bot invite link
7. If accessible: Save connection with new guild

### Sync Flow
1. User clicks "Sync Members"
2. Backend validates bot is running
3. Backend validates bot has access to guild
4. If not accessible: Show error with bot invite link
5. If accessible: Sync members from correct guild

## Logging Messages

Look for these in the console:

**Disconnect:**
```
🔌 Disconnecting Discord for userId: ...
   Old Guild: saadmustafa (1234567890)
✅ Discord connection cleared and deactivated
```

**Reconnect:**
```
🔄 Updating existing Discord connection for userId: ...
   Previous Guild: saadmustafa (1234567890)
   New Guild: PavosTesting (9876543210)
✅ Connection updated - guildId: 9876543210, guildName: PavosTesting
```

**Sync:**
```
🔄 Starting Discord member sync
   User ID: ...
   Whop Company ID: ...
   Guild ID: 9876543210
   Guild Name: PavosTesting
   ✅ Bot has access to guild
   ✅ Bot has API access to guild: PavosTesting
   📊 Found 5 members from Discord
```

## API Reference

### Debug Endpoint

```http
GET /api/v1/integrations/discord/debug
Authorization: Bearer <token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "bot": { ... },
    "connections": { ... },
    "company": { ... }
  }
}
```

**Use Case**: Diagnose connection issues, verify bot access, check company state

## Migration Notes

No database migration required. Existing connections will be cleaned up on next disconnect/reconnect cycle.

## Summary

The fixes ensure:
- ✅ Complete data clearing on disconnect
- ✅ No self-referencing when checking company guilds
- ✅ Guild access validation before saving connections
- ✅ Guild access validation before syncing members
- ✅ Helpful error messages with bot invite links
- ✅ Comprehensive logging for debugging
- ✅ Debug endpoint for troubleshooting

Users can now disconnect and reconnect to different servers without any persistence of old server data.
