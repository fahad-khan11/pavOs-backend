# Discord Private Lead Channels - Implementation Guide

## Overview

This implementation creates **private Discord text channels** for each lead, with proper permission isolation to ensure security and privacy in multi-tenant environments.

## Features

✅ **Private by Default**: Channels are hidden from @everyone  
✅ **Bot Access**: Discord bot can view, send messages, and read history  
✅ **CRM Staff Access**: Optional configurable role for internal team access  
✅ **Lead Access**: Automatically grants access to the lead's Discord user if available  
✅ **Multi-tenant Safe**: Each company's leads get isolated channels  
✅ **No Administrator Required**: Uses `Manage Channels` permission only  

---

## Permission Model

### Channel Permissions

Each lead channel has the following permission overwrites:

| Entity | ViewChannel | SendMessages | ReadMessageHistory |
|--------|-------------|--------------|-------------------|
| @everyone | ❌ DENY | (inherited) | (inherited) |
| Discord Bot | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| CRM Staff Role (optional) | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |
| Lead's Discord User (if exists) | ✅ ALLOW | ✅ ALLOW | ✅ ALLOW |

### Bot Permissions Required

The Discord bot must have these permissions:
- `Manage Channels` (16) - To create and manage channels
- `View Channels` (1024) - To see and access channels
- `Send Messages` (2048) - To send messages in channels
- `Read Message History` (65536) - To read previous messages

**Total Permission Integer**: `275146468368` (already configured)

---

## Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Discord Configuration
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_REDIRECT_URI=https://your-domain.com/api/v1/integrations/discord/callback

# Optional: CRM Staff Role ID
# If set, this role will have access to all lead channels
DISCORD_CRM_STAFF_ROLE_ID=1234567890123456789
```

### Setting Up CRM Staff Role

1. **Create a Discord Role** (if you don't have one):
   - Go to your Discord server → Server Settings → Roles
   - Click "Create Role"
   - Name it "CRM Staff" (or any name you prefer)
   - Don't give it any special permissions (channels will grant access explicitly)
   - Save the role

2. **Get the Role ID**:
   - Enable Discord Developer Mode: User Settings → Advanced → Developer Mode
   - Right-click the role in Server Settings → Roles
   - Click "Copy ID"

3. **Add to Environment**:
   ```bash
   DISCORD_CRM_STAFF_ROLE_ID=1234567890123456789
   ```

4. **Restart your backend**:
   ```bash
   npm run dev
   # or
   pm2 restart pavos-backend
   ```

---

## Discord Role Hierarchy

### ⚠️ IMPORTANT: Bot Role Positioning

For permission overwrites to work correctly, the **bot's role must be positioned ABOVE the @everyone role** in the Discord server's role hierarchy.

**Correct Setup**:
```
Server Owner
Administrator
Moderator
CRM Staff          ← Your staff role
PaveOS CRM Bot     ← Bot role (MUST be above @everyone)
──────────────────
@everyone          ← Base role
```

**To Configure**:
1. Go to Server Settings → Roles
2. Drag "PaveOS CRM Bot" role **above** @everyone
3. Save changes

### Why This Matters

Discord's permission system follows these rules:
1. **Deny overwrites** always take precedence over Allow
2. **Role hierarchy** determines which permissions apply
3. A bot can only manage permissions for roles **below** its own role

If the bot role is at the bottom (same level as @everyone), permission overwrites will fail.

---

## How It Works

### Channel Creation Flow

```typescript
// 1. Deny @everyone (makes channel private)
{
  id: guild.id,
  deny: [PermissionFlagsBits.ViewChannel],
}

// 2. Allow bot (always required)
{
  id: client.user.id,
  allow: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
  ],
}

// 3. Allow CRM Staff (if configured)
{
  id: process.env.DISCORD_CRM_STAFF_ROLE_ID,
  allow: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
  ],
}

// 4. Allow lead user (if they're in the server)
{
  id: lead.discordUserId,
  allow: [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
  ],
}
```

### Automatic Channel Creation

Channels are created automatically when:
- User sends first message to a lead from Whop UI
- Explicitly via `POST /api/v1/integrations/discord/channels` endpoint

### Channel Naming

Format: `{username}-{random-8-chars}`

Examples:
- `john-doe-abc12345`
- `saadmustafa0479-mj9vedy1`

---

## Testing Guide

### 1. Test Private Channel Creation

```bash
# Send a message to a lead from Whop UI
POST /api/v1/integrations/discord/send-message
{
  "leadId": "69427b92d7481c76b520ab89",
  "content": "Hello from Whop!"
}
```

**Expected Results**:
- ✅ Channel created in Discord server
- ✅ Channel is NOT visible to regular members
- ✅ Bot can see and send messages
- ✅ CRM Staff role members can see the channel (if role configured)
- ✅ Lead user can see the channel (if they're in the server)

### 2. Verify Permissions

In Discord:
1. **As a regular member**: Channel should be invisible
2. **As CRM Staff**: Channel should be visible in channel list
3. **As the lead**: Channel should be visible (if they're in server)
4. **As bot**: Should be able to send messages

### 3. Check Logs

Look for these log messages:
```
✅ Created private Discord channel: lead-username-xxx (1234567890) for lead 69427b...
✅ Adding CRM Staff role CRM Staff to channel permissions
✅ Adding lead user username#1234 to channel permissions
```

---

## Backward Compatibility

### ✅ Existing Channels

Channels created **before** this update will continue to work normally. They will:
- Have public visibility (default server permissions)
- Allow all server members to see them
- Function normally for message routing

### ✅ Migration Path

To make existing channels private:
1. Channels are **not automatically updated** (prevents disruption)
2. New channels will be private by default
3. To update existing channels manually, use Discord's channel settings:
   - Right-click channel → Edit Channel → Permissions
   - Add the same permission overwrites as documented above

### ✅ Optional Enforcement

If you want to enforce private channels for ALL leads:
- Delete old public channels (they'll be recreated as private on next message)
- Or manually update permissions via Discord UI

---

## Troubleshooting

### Issue: "Missing Permissions" Error

**Symptom**: 
```
DiscordAPIError[50013]: Missing Permissions
```

**Solutions**:
1. ✅ **Check Bot Role Position**: Bot role must be ABOVE @everyone
2. ✅ **Check Bot Permissions**: Bot must have "Manage Channels" permission
3. ✅ **Check Staff Role**: If using `DISCORD_CRM_STAFF_ROLE_ID`, ensure role exists

### Issue: CRM Staff Can't See Channels

**Solutions**:
1. ✅ Verify `DISCORD_CRM_STAFF_ROLE_ID` is set in `.env`
2. ✅ Confirm staff members have the role assigned
3. ✅ Check role ID is correct (copy from Discord Developer Mode)
4. ✅ Restart backend after changing env variables

### Issue: Lead User Can't See Channel

**Solutions**:
1. ✅ Verify lead is in the Discord server (not just a connection)
2. ✅ Check `lead.discordUserId` is populated in database
3. ✅ Bot must have permission to fetch guild members

### Issue: Channels Are Still Public

**Possible Causes**:
1. ❌ Created before this update (see Migration Path above)
2. ❌ Permission overwrites failed (check logs for errors)
3. ❌ Bot role hierarchy issue (bot role too low)

---

## Security Considerations

### ✅ Multi-tenant Isolation

Each channel is tied to:
- `whopCompanyId` - Company owns the lead
- `leadId` - Specific lead for the channel
- `discordGuildId` - Specific Discord server

This ensures:
- Company A cannot see Company B's lead channels
- Leads from different companies are isolated
- Proper access control per company's Discord server

### ✅ Permission Hierarchy

1. **Deny @everyone** - Broadest scope, blocks all by default
2. **Allow Bot** - Ensures bot always has access
3. **Allow Staff Role** - Optional, controlled by company
4. **Allow Lead User** - Per-lead access

### ✅ Least Privilege

- Bot uses `Manage Channels`, NOT `Administrator`
- Staff role gets channel access only, not server-wide permissions
- Lead users only see their own channel, not others

---

## API Endpoints

### Create Channel

```http
POST /api/v1/integrations/discord/channels
Authorization: Bearer <token>
Content-Type: application/json

{
  "leadId": "69427b92d7481c76b520ab89"
}
```

### Get Channel for Lead

```http
GET /api/v1/integrations/discord/channels/:leadId
Authorization: Bearer <token>
```

### Archive Channel

```http
DELETE /api/v1/integrations/discord/channels/:leadId
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Lead converted to customer"
}
```

---

## Best Practices

### 1. Configure CRM Staff Role

✅ **DO**: Set up a dedicated "CRM Staff" role for your team  
❌ **DON'T**: Give staff members Administrator role just for channel access

### 2. Role Hierarchy

✅ **DO**: Keep bot role above @everyone and below Administrator  
❌ **DON'T**: Put bot role at the very top (security risk)

### 3. Channel Cleanup

✅ **DO**: Archive channels when leads are won/lost  
❌ **DON'T**: Delete channels (you lose message history)

### 4. Monitoring

✅ **DO**: Monitor logs for permission errors  
✅ **DO**: Regularly audit channel permissions  
❌ **DON'T**: Ignore "Missing Permissions" errors

---

## Summary

This implementation provides:
- ✅ **Private lead channels** with proper access control
- ✅ **Optional CRM staff access** via configurable role
- ✅ **Automatic lead user access** when available
- ✅ **Multi-tenant security** with company isolation
- ✅ **Backward compatibility** with existing public channels
- ✅ **No Administrator required** - uses Manage Channels only

**Next Steps**:
1. Configure `DISCORD_CRM_STAFF_ROLE_ID` in your `.env`
2. Verify bot role position in Discord server
3. Test by sending a message to a lead
4. Monitor logs for successful channel creation

For support or questions, refer to the main Discord implementation documentation.
