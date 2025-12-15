# Discord Multi-Tenant Connection Fix

## Problem
When users connected Discord, the system was selecting the **wrong Discord server** because:
1. Bot is present in multiple servers (10 total)
2. System used `guilds[0]` - first accessible guild
3. No prioritization based on user's role/ownership

**Example:**
- saadmustafa connects Discord
- Bot is in 9 fahadfarman servers + 1 saadmustafa server
- System picks first accessible = fahadfarman's server ❌

## Root Cause

**File:** `src/controllers/discordController.ts`
**Line:** ~135 (before fix)

```typescript
// ❌ OLD CODE - Takes first accessible guild
const guild = accessibleGuilds[0];
```

This caused:
- Users connecting to OTHER users' Discord servers
- Wrong leads being created
- Cross-user data contamination

## Solution

### 1. Prioritize User's Own Servers

Added intelligent guild selection that prioritizes:
1. **Owner** - Servers the user owns (👑)
2. **Admin** - Servers where user has admin permissions (🛡️)
3. **Member** - Regular member servers (👤)

**New Code:**
```typescript
// ✅ NEW CODE - Prioritize user's own servers
const OWNER_PERMISSION = 0x1;
const ADMINISTRATOR_PERMISSION = 0x8;

const sortedGuilds = accessibleGuilds.sort((a: any, b: any) => {
  const aIsOwner = a.owner === true;
  const bIsOwner = b.owner === true;
  
  if (aIsOwner && !bIsOwner) return -1;
  if (!aIsOwner && bIsOwner) return 1;
  
  const aIsAdmin = (parseInt(a.permissions || '0') & ADMINISTRATOR_PERMISSION) !== 0;
  const bIsAdmin = (parseInt(b.permissions || '0') & ADMINISTRATOR_PERMISSION) !== 0;
  
  if (aIsAdmin && !bIsAdmin) return -1;
  if (!aIsAdmin && bIsAdmin) return 1;
  
  return 0;
});

const guild = sortedGuilds[0]; // Best guild (owner > admin > member)
```

### 2. Prevent Duplicate Leads

**File:** `src/controllers/discordController.ts` - `syncDiscordMembers()`
**Line:** ~467

```typescript
// ✅ Check if Discord user already belongs to another user
const leadOwnedByOtherUser = await Lead.findOne({
  userId: { $ne: userId },  // Different user
  discordUserId: member.user.id,  // Same Discord member
});

if (leadOwnedByOtherUser) {
  console.log(`⚠️  Skipping ${member.user.username} - already owned by another user`);
  skippedCount++;
  continue;
}
```

### 3. Fix Message Ownership

**File:** `src/services/discordBotService.ts` - `handleMessageCreate()`
**Line:** ~289

```typescript
// ❌ OLD CODE - Used connection owner's userId
await this.saveMessage(message, connectionUserId, 'incoming', ...);

// ✅ NEW CODE - Use lead owner's userId
const messageUserId = lead ? String(lead.userId) : connectionUserId;
await this.saveMessage(message, messageUserId, 'incoming', ...);
```

## Data Cleanup Scripts

Created scripts to fix existing bad data:

1. **fixDuplicateLeads.ts** - Remove duplicate leads for same Discord user
2. **fixMessageOwnership.ts** - Fix message userId to match lead owner
3. **showDiscordConnections.ts** - Show current connections
4. **checkBotGuilds.ts** - Show which servers bot is in

## Testing

### Before Fix
```
User: saadmustafa
Connected to: "fahadserver" ❌ (fahadfarman's server)
Leads showing: Both users' leads ❌
Messages: Wrong userId ❌
```

### After Fix
```
User: saadmustafa
Connected to: "saadkhan" ✅ (saadmustafa's server - he is owner)
Leads showing: Only saadmustafa's leads ✅
Messages: Correct userId ✅
```

## Verification

Run these commands to verify:

```bash
# 1. Check which servers bot is in
npx tsx scripts/checkBotGuilds.ts

# 2. Check current connections
npx tsx scripts/showDiscordConnections.ts

# 3. Verify lead ownership
npx tsx scripts/checkLeadOwnership.ts
```

## Next Steps

1. **Disconnect current wrong connections**
2. **Reconnect Discord** - Should now select YOUR server (where you're owner)
3. **Sync members** - Should create leads only for your company
4. **Verify** - Check that you only see your own leads

## Key Files Modified

- `src/controllers/discordController.ts` - Guild selection logic
- `src/services/discordBotService.ts` - Message ownership fix
- `scripts/fixDuplicateLeads.ts` - Data cleanup
- `scripts/fixMessageOwnership.ts` - Message ownership cleanup
