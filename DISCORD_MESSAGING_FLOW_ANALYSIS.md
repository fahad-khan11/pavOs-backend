# Discord → Whop CRM Messaging Integration: Complete Flow Analysis

**Date:** December 17, 2025  
**Status:** Current implementation documentation (as-is analysis)

---

## Executive Summary

The Discord messaging integration enables bidirectional communication between Discord users and the Whop CRM. Messages are sent **exclusively via Direct Messages (DMs)** using a Discord bot that runs continuously on the backend server. The system does **NOT** support server/guild channel messaging due to the bot not being invited to user servers.

### Critical Limitations
1. ❌ **Bot is NOT in user Discord servers** - Cannot send to guild channels
2. ✅ **Bot CAN send Direct Messages** - Works without server access
3. ⚠️ **Users must have DMs enabled** - If disabled, messages fail
4. ⚠️ **Socket.IO required for real-time** - Messages appear instantly only with active WebSocket

---

## System Architecture

### Components
```
┌─────────────────────────────────────────────────────────────┐
│                    Whop Frontend (React)                    │
│  - Next.js app embedded in Whop iframe                     │
│  - Displays messages in lead detail page                   │
│  - Socket.IO client for real-time updates                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP API + WebSocket
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend Server (Node.js)                    │
│  - Express REST API                                         │
│  - Socket.IO server                                         │
│  - MongoDB for persistence                                 │
│  - Discord.js bot client (always running)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ Discord Gateway (WebSocket)
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                     Discord Platform                        │
│  - Bot user account (identity of message sender)           │
│  - DM channels (private conversations)                     │
│  - No guild/server access                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Part 1: Outbound Messages (Whop UI → Discord)

### User Journey
1. User opens a lead detail page in Whop CRM
2. Lead has `discordUserId` field populated (e.g., "123456789012345678")
3. User types message in chat input
4. User clicks Send button
5. Message appears in Discord user's DMs

### Technical Flow

#### Step 1: Frontend Message Submission
**File:** `pavOs-frontend/app/leads/[id]/page.tsx`

```typescript
const handleSendMessage = async () => {
  // Validation
  if (!messageContent.trim()) {
    toast.error("Please enter a message")
    return
  }

  if (!lead?.discordUserId) {
    toast.error("Cannot send message: Discord user ID not found for this lead")
    return
  }

  // API call
  await discordService.sendMessage({
    discordUserId: lead.discordUserId,  // REQUIRED field
    content: messageContent,
  })
}
```

**API Call:**
```http
POST /api/v1/integrations/discord/send-message
Content-Type: application/json

{
  "discordUserId": "123456789012345678",
  "content": "Hello from CRM!"
}
```

#### Step 2: Backend Controller Validation
**File:** `pavOs-backend/src/controllers/discordController.ts` (lines 628-690)

```typescript
export const sendDiscordMessage = async (req: AuthRequest, res: Response) => {
  const userId = req.userId!;  // CRM user ID (authenticated)
  const { content, discordUserId } = req.body;

  // Validation checks
  if (!content) {
    return errorResponse(res, 'Message content is required', 400);
  }

  if (!discordUserId) {
    return errorResponse(res, 'discordUserId is required. Messages are sent as DMs only.', 400);
  }

  // Check Discord connection exists
  const connection = await DiscordConnection.findOne({ 
    userId, 
    isActive: true 
  });
  
  if (!connection) {
    return errorResponse(res, 'Discord not connected', 400);
  }

  // Check bot is running
  if (!discordBotService.isActive()) {
    return errorResponse(res, 'Discord bot is not active', 500);
  }

  // Send DM via bot service
  const sentMessage = await discordBotService.sendDM(
    discordUserId, 
    content, 
    userId  // Creator user ID
  );

  return successResponse(res, { message: sentMessage });
}
```

**Key Points:**
- `userId` = CRM user who clicked Send (authenticated via JWT)
- `discordUserId` = Discord user ID of the lead/recipient
- No support for `channelId` - DMs only

#### Step 3: Discord Bot Service - Send DM
**File:** `pavOs-backend/src/services/discordBotService.ts` (lines 748-915)

```typescript
async sendDM(discordUserId: string, content: string, creatorUserId: string) {
  // 1. Fetch Discord user object
  const user = await this.client.users.fetch(discordUserId);
  
  // 2. Send DM (may fail if user has DMs disabled)
  const sentMessage = await user.send(content);
  
  // 3. Find or create lead for this conversation
  let lead = await Lead.findOne({
    userId: creatorUserId,  // CRM user who owns this lead
    discordUserId: discordUserId,
  });
  
  if (!lead) {
    // Create new lead if first message
    lead = await Lead.create({
      userId: creatorUserId,
      name: user.username,
      discordUserId: discordUserId,
      discordUsername: user.tag,
      source: 'discord',
      status: 'new',
      tags: ['discord_dm'],
    });
  }
  
  // 4. Save message to database
  await DiscordMessage.create({
    userId: creatorUserId,         // CRM user who owns this
    leadId: lead._id,              // Associated lead
    discordMessageId: sentMessage.id,
    discordChannelId: sentMessage.channelId,  // DM channel ID
    authorDiscordId: this.client.user.id,     // BOT's Discord ID
    authorUsername: this.client.user.tag,      // BOT's username
    content: content,
    direction: 'outgoing',
    isRead: true,  // Outgoing messages auto-marked read
  });
  
  // 5. Emit Socket.IO event for real-time UI update
  const io = getIO();
  io.to(`lead:${lead._id}`).emit("discord:message", discordMessage);
  
  return sentMessage;
}
```

**Identity of Message Sender:**
- **In Discord:** Message appears from the **Discord bot user** (e.g., "PaveOS Bot#1234")
- **In CRM:** Saved as `authorDiscordId` = bot's Discord user ID
- **Problem:** Lead cannot reply directly to the "sender" because the sender is the bot, not the CRM user

#### Step 4: Discord Delivery
- Discord receives message from bot user
- Message appears in recipient's DM inbox
- Shows as from bot (e.g., "PaveOS Bot")
- Recipient sees no indication of which CRM user sent it

### Failure Scenarios

**Error 1: User has DMs disabled**
```javascript
// Discord API error code 50007
{
  code: 50007,
  message: "Cannot send messages to this user"
}

// Backend response
{
  success: false,
  message: "Cannot send messages to this user. They may have DMs disabled or blocked the bot."
}
```

**Error 2: Invalid Discord User ID**
```javascript
{
  success: false,
  message: "Discord user not found: 123456789"
}
```

**Error 3: Bot not running**
```javascript
{
  success: false,
  message: "Discord bot is not active"
}
```

---

## Part 2: Inbound Messages (Discord → Whop UI)

### User Journey
1. Discord user sends a DM to the bot
2. Bot receives message via Discord Gateway
3. Bot saves message to MongoDB
4. Socket.IO emits real-time event
5. Message appears in Whop CRM (if user has page open)

### Technical Flow

#### Step 1: Discord Bot Event Listener
**File:** `pavOs-backend/src/services/discordBotService.ts` (lines 100-120)

```typescript
private setupEventHandlers() {
  // Bot listens for MESSAGE_CREATE events
  this.client.on(Events.MessageCreate, async (message) => {
    await this.handleMessageCreate(message);
  });
  
  // Also listens for message edits
  this.client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    await this.handleMessageUpdate(oldMessage, newMessage);
  });
}
```

**Required Discord Intents:**
```typescript
intents: [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildMembers,
  GatewayIntentBits.DirectMessages,        // ← Required for DMs
  GatewayIntentBits.MessageContent,        // ← Required to read message text
],
partials: [
  Partials.Channel,  // Required for DM channels
  Partials.Message,  // Required for uncached messages
]
```

**Critical Requirement:**
- **MESSAGE CONTENT INTENT** must be enabled in Discord Developer Portal
- Without this, `message.content` will be empty string
- This is a privileged intent requiring approval for >100 servers

#### Step 2: Message Processing Logic
**File:** `pavOs-backend/src/services/discordBotService.ts` (lines 158-295)

```typescript
private async handleMessageCreate(message: Message) {
  // 1. Ignore bot messages (prevent loops)
  if (message.author.bot) {
    console.log('Skipping bot message');
    return;
  }
  
  // 2. Check if message is DM or guild message
  const isDM = message.channel.isDMBased();
  
  let connection;
  
  if (isDM) {
    // For DMs: Find active Discord connection
    // ISSUE: We don't know which CRM user this DM is for!
    // Current logic: Use FIRST active connection
    connection = await DiscordConnection.findOne({ 
      isActive: true 
    }).sort({ connectedAt: 1 });
    
    if (!connection) {
      // Fallback: Auto-create connection for most recent user
      const mostRecentUser = await User.findOne({})
        .sort({ lastLogin: -1, createdAt: -1 });
      
      if (mostRecentUser) {
        connection = await DiscordConnection.create({
          userId: mostRecentUser._id,
          discordUserId: message.author.id,
          discordUsername: message.author.tag,
          isActive: true,
        });
      }
    }
  } else {
    // For guild messages: Find connection for this specific guild
    connection = await DiscordConnection.findOne({
      discordGuildId: message.guildId,
      isActive: true,
    });
  }
  
  if (!connection) {
    console.log('No connection found - message NOT saved');
    return;
  }
  
  // 3. Find or create lead for this Discord user
  let lead = await Lead.findOne({
    userId: connection.userId,
    discordUserId: message.author.id,
  });
  
  if (!lead) {
    // Auto-create lead for new DM sender
    lead = await Lead.create({
      userId: connection.userId,
      name: message.author.username,
      discordUserId: message.author.id,
      discordUsername: message.author.tag,
      source: 'discord',
      status: 'new',
      tags: ['discord_dm'],
      notes: `First contact via Discord DM: "${message.content.substring(0, 100)}..."`,
    });
  }
  
  // 4. Save message to database
  await this.saveMessage(message, connection.userId, 'incoming', lead._id);
}
```

#### Step 3: Message Storage
**File:** `pavOs-backend/src/services/discordBotService.ts` (lines 420-520)

```typescript
private async saveMessage(
  message: Message,
  userId: string,
  direction: 'incoming' | 'outgoing',
  leadId?: string
) {
  // Save to DiscordMessage collection
  const discordMessage = await DiscordMessage.create({
    userId: userId,                        // CRM user who owns this
    leadId: leadId,                        // Associated lead
    discordMessageId: message.id,          // Discord's message ID (unique)
    discordChannelId: message.channelId,   // DM channel ID
    authorDiscordId: message.author.id,    // Discord user who sent it
    authorUsername: message.author.tag,    // e.g., "john#1234"
    content: message.content,              // Message text
    direction: direction,                  // 'incoming' or 'outgoing'
    isRead: false,                         // Unread by default
    attachments: message.attachments.map(att => ({
      url: att.url,
      filename: att.name,
      size: att.size,
      contentType: att.contentType,
    })),
    metadata: {
      guildId: message.guildId,
      channelName: message.channel.isDMBased() ? 'DM' : message.channel.name,
      timestamp: message.createdTimestamp,
    },
  });
  
  // Update lead's last contact date
  if (lead) {
    lead.lastContactDate = new Date();
    await lead.save();
  }
  
  // Emit Socket.IO event for real-time update
  const io = getIO();
  io.to(`lead:${leadId}`).emit("discord:message", discordMessage.toJSON());
  
  console.log(`💾 Saved message to database: ${message.id}`);
  return discordMessage;
}
```

**Database Schema:** `DiscordMessage`
```typescript
{
  _id: ObjectId,
  userId: string,              // CRM user who owns this conversation
  leadId: string,              // Lead this message belongs to
  discordMessageId: string,    // Discord's unique message ID (indexed, unique)
  discordChannelId: string,    // DM channel ID or guild channel ID
  authorDiscordId: string,     // Discord user ID of sender
  authorUsername: string,      // Discord username (e.g., "john#1234")
  content: string,             // Message text
  direction: 'incoming' | 'outgoing',
  isRead: boolean,
  tags: string[],
  metadata: {
    guildId?: string,
    channelName: string,
    timestamp: number,
  },
  attachments: [{
    url: string,
    filename: string,
    size: number,
    contentType: string,
  }],
  createdAt: Date,
  updatedAt: Date,
}
```

#### Step 4: Real-Time Frontend Update
**File:** `pavOs-frontend/app/leads/[id]/page.tsx` (lines 140-180)

```typescript
// Socket.IO connection setup
useEffect(() => {
  if (socket && isConnected && lead?._id) {
    // Join lead-specific room
    socket.emit("lead:join", { leadId: lead._id });
    
    // Listen for new messages
    socket.on("discord:message", (newMessage) => {
      console.log("📨 Received real-time message:", newMessage);
      
      // Add to messages array
      setMessages(prev => [...prev, newMessage]);
      
      // Mark as read if incoming
      if (newMessage.direction === 'incoming' && !newMessage.isRead) {
        discordService.markAsRead(newMessage.id);
      }
    });
    
    return () => {
      socket.emit("lead:leave", { leadId: lead._id });
      socket.off("discord:message");
    };
  }
}, [socket, isConnected, lead?._id]);
```

**Socket.IO Room Pattern:**
```
Room name: "lead:{leadId}"
Example: "lead:507f1f77bcf86cd799439011"

Event: "discord:message"
Payload: { id, userId, leadId, content, direction, ... }
```

#### Step 5: Frontend Display
**File:** `pavOs-frontend/app/leads/[id]/page.tsx` (lines 660-700)

```tsx
{messages.map((message) => (
  <div
    key={message.id}
    className={`flex ${
      message.direction === "outgoing" 
        ? "justify-end"    // Right-aligned (sent from CRM)
        : "justify-start"  // Left-aligned (received from Discord)
    }`}
  >
    <div className={`
      max-w-[70%] rounded-lg px-4 py-2
      ${message.direction === "outgoing"
        ? "bg-primary text-primary-foreground"  // Blue
        : "bg-muted"                             // Gray
      }
    `}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold">
          {message.authorUsername}  {/* Shows Discord username */}
        </span>
        <span className="text-xs opacity-70">
          {format(new Date(message.createdAt), "MMM d, h:mm a")}
        </span>
      </div>
      <p className="text-sm">{message.content}</p>
    </div>
  </div>
))}
```

---

## Part 3: Why Some Messages Don't Appear

### Root Cause Analysis

#### Issue 1: No Active Discord Connection
**Symptom:** Incoming Discord messages are not saved to database

**Cause:**
```typescript
// In handleMessageCreate()
const connection = await DiscordConnection.findOne({ isActive: true });

if (!connection) {
  console.log('No connection found - message NOT saved');
  return;  // ← Message is dropped here
}
```

**Why it happens:**
- User hasn't connected Discord in CRM settings
- Connection was deactivated
- Connection's `userId` references deleted user

**Solution:** User must connect Discord via OAuth in app settings

#### Issue 2: Bot Not Running
**Symptom:** No messages are received at all

**Cause:**
```typescript
// In server.ts startup
try {
  await discordBotService.startBot();
} catch (error) {
  logger.warn('Discord bot failed to start');
  // Server continues without bot!
}
```

**Why it happens:**
- Invalid `DISCORD_BOT_TOKEN` environment variable
- Bot token revoked in Discord Developer Portal
- Network connectivity issues

**Check:** GET `/api/v1/integrations/discord/status` returns `botActive: false`

#### Issue 3: Message Content Intent Not Enabled
**Symptom:** Messages saved but `content` field is empty

**Cause:**
```typescript
// Discord API returns empty content if intent not enabled
{
  id: "123456789",
  content: "",  // ← Empty!
  author: { ... }
}
```

**Why it happens:**
- "Message Content Intent" not enabled in Discord Developer Portal
- This is a privileged intent
- Required for bots with >100 servers (needs verification)

**Fix:** Enable intent in Discord Developer Portal → Bot Settings

#### Issue 4: Socket.IO Not Connected
**Symptom:** Messages saved to DB but don't appear in UI without refresh

**Cause:**
```typescript
// Frontend checks
if (!socket || !isConnected) {
  // Real-time updates won't work
}
```

**Why it happens:**
- WebSocket connection failed (firewall/proxy)
- User's browser blocks WebSocket
- CORS issues with Socket.IO

**Check:** Look for green "Live" indicator in UI

#### Issue 5: Wrong Lead Association
**Symptom:** Message saved but appears in wrong lead's conversation

**Cause:**
```typescript
// Multi-user scenario
const connection = await DiscordConnection.findOne({ isActive: true })
  .sort({ connectedAt: 1 });  // ← Gets FIRST connection

// If User A and User B both have connections,
// ALL DMs go to User A's leads!
```

**Why it happens:**
- Multiple CRM users with active Discord connections
- System doesn't know which user a DM is intended for
- Uses "first connection" heuristic

**Current Limitation:** No way to route DMs to correct user

---

## Part 4: Technical Limitations

### 1. Bot Identity vs CRM User Identity

**Problem:**
- Messages sent from CRM show as from **bot user** in Discord
- Lead cannot distinguish between different CRM team members
- All outbound messages look identical

**Example:**
```
CRM User: "Sarah" clicks Send
Discord shows: "PaveOS Bot: Hello, how can I help?"
Lead thinks: "Who is this bot? Where's Sarah?"
```

**Why this happens:**
- Bot has single Discord account
- Discord DM API requires bot to send as itself
- No way to impersonate CRM user

**Workaround:**
- Add signature to messages: "- Sarah from Sales Team"
- Use bot username like "PaveOS [Sarah]" (but can't change per message)

### 2. DM-Only Limitation

**Problem:**
- Bot cannot send to Discord server channels
- All messages must be Direct Messages

**Why:**
- Bot is not invited to user's Discord servers
- Requires server admin to invite bot
- Requires `MANAGE_GUILD` permission

**Proof:**
```typescript
// discordController.ts (line 650)
if (!discordUserId) {
  return errorResponse(res, 
    'discordUserId is required. Messages are sent as DMs only.', 
    400
  );
}
```

**Trade-offs:**
| Feature | DMs | Guild Channels |
|---------|-----|----------------|
| Works without invite | ✅ Yes | ❌ No (requires invite) |
| User can disable | ✅ Yes | ❌ No |
| Privacy | ✅ Private | ❌ Public in server |
| Group messaging | ❌ No | ✅ Yes |

### 3. Multi-User DM Routing

**Problem:**
- Cannot determine which CRM user a DM is intended for
- Uses "first active connection" heuristic

**Scenario:**
```
CRM User A: Connected Discord (first)
CRM User B: Connected Discord (second)

Random Person → DMs bot → Saved to User A's leads ❌
```

**Current Logic:**
```typescript
const connection = await DiscordConnection.findOne({ isActive: true })
  .sort({ connectedAt: 1 });  // ← Always picks first
```

**Why this is wrong:**
- DM might be reply to User B's outbound message
- DM might be new conversation for User B
- No way to know from Discord data alone

**Possible solutions (not implemented):**
1. Use DM channel ID to track which user started conversation
2. Analyze message context (reply chains)
3. Allow manual lead assignment in UI

### 4. Message Content Intent Requirement

**Problem:**
- Reading message text requires privileged intent
- Requires Discord verification if >100 servers
- Can be revoked by Discord

**Impact:**
```javascript
// Without intent enabled
message.content === ""  // ← Empty!

// With intent enabled  
message.content === "Hello, I need help"  // ✅ Works
```

**How to enable:**
1. Go to Discord Developer Portal
2. Navigate to Bot settings
3. Enable "Message Content Intent"
4. If >100 servers, submit verification form

### 5. Socket.IO Dependency

**Problem:**
- Real-time updates only work with active WebSocket
- Many users won't see messages instantly

**Fallback:**
```typescript
// Messages ARE saved to database
// User can manually refresh to see them
<Button onClick={() => loadMessages()}>
  <RefreshCw className="h-4 w-4" />
</Button>
```

**Why Socket.IO can fail:**
- Corporate firewalls block WebSocket
- Proxy servers don't support WebSocket upgrade
- Mobile networks with aggressive connection reset
- Long polling fallback not configured

---

## Part 5: Data Flow Diagrams

### Outbound Message Flow (CRM → Discord)

```
┌─────────────┐
│  CRM User   │  1. Clicks "Send" in UI
│  (Sarah)    │
└──────┬──────┘
       │
       │ 2. POST /api/v1/integrations/discord/send-message
       │    { discordUserId: "123...", content: "Hello" }
       ▼
┌──────────────────────┐
│  discordController   │  3. Validates request
│  sendDiscordMessage  │  - Checks discordUserId exists
│                      │  - Checks bot is running
└──────┬───────────────┘
       │
       │ 4. await discordBotService.sendDM(...)
       ▼
┌──────────────────────┐
│  discordBotService   │  5. Fetch Discord user
│  sendDM()            │  6. user.send(content)
└──────┬───────────────┘
       │
       │ 7. Message sent via Discord API
       ▼
┌──────────────────────┐
│  Discord Platform    │  8. Delivers DM
│  (Bot User Account)  │  - From: "PaveOS Bot"
└──────┬───────────────┘     - To: Lead's DM inbox
       │
       │ 9. Message received
       ▼
┌──────────────────────┐
│   Lead's Discord     │  10. Shows message from bot
│   (john#1234)        │      "PaveOS Bot: Hello"
└──────────────────────┘

       │ Parallel: Save to database
       ▼
┌──────────────────────┐
│   MongoDB            │  11. DiscordMessage.create(...)
│   DiscordMessage     │      - userId: Sarah's ID
│                      │      - leadId: john's lead ID
│                      │      - authorDiscordId: Bot's ID
│                      │      - direction: 'outgoing'
└──────┬───────────────┘
       │
       │ 12. Socket.IO emit
       ▼
┌──────────────────────┐
│  Socket.IO Server    │  13. io.to(`lead:${leadId}`)
│                      │      .emit("discord:message", ...)
└──────┬───────────────┘
       │
       │ 14. WebSocket event
       ▼
┌──────────────────────┐
│  CRM Frontend        │  15. Message appears in UI
│  (Sarah's browser)   │      - Right-aligned (outgoing)
└──────────────────────┘      - Shows as sent
```

### Inbound Message Flow (Discord → CRM)

```
┌──────────────────────┐
│   Lead's Discord     │  1. Lead sends DM to bot
│   (john#1234)        │     "I need help with my order"
└──────┬───────────────┘
       │
       │ 2. Discord Gateway WebSocket
       ▼
┌──────────────────────┐
│  Discord Bot Client  │  3. Events.MessageCreate event
│  (always listening)  │     - message.author.id = john's ID
│                      │     - message.content = "I need help..."
└──────┬───────────────┘
       │
       │ 4. handleMessageCreate(message)
       ▼
┌──────────────────────┐
│  Message Handler     │  5. Determine context
│                      │     - isDM? → YES
│                      │     - Find active connection
└──────┬───────────────┘
       │
       │ 6. DiscordConnection.findOne({ isActive: true })
       ▼
┌──────────────────────┐
│  Connection Lookup   │  7. Returns Sarah's connection
│                      │     (first active connection found)
└──────┬───────────────┘
       │
       │ 8. Lead.findOne({ discordUserId: john's ID })
       ▼
┌──────────────────────┐
│  Lead Lookup/Create  │  9. Find or create lead
│                      │     - userId: Sarah's ID
│                      │     - discordUserId: john's ID
└──────┬───────────────┘
       │
       │ 10. saveMessage(message, userId, 'incoming', leadId)
       ▼
┌──────────────────────┐
│   MongoDB            │  11. DiscordMessage.create(...)
│   DiscordMessage     │      - userId: Sarah's ID
│                      │      - leadId: john's lead ID
│                      │      - authorDiscordId: john's ID
│                      │      - content: "I need help..."
│                      │      - direction: 'incoming'
│                      │      - isRead: false
└──────┬───────────────┘
       │
       │ 12. Socket.IO emit
       ▼
┌──────────────────────┐
│  Socket.IO Server    │  13. io.to(`lead:${leadId}`)
│                      │      .emit("discord:message", ...)
└──────┬───────────────┘
       │
       │ 14. WebSocket event (if connected)
       ▼
┌──────────────────────┐
│  CRM Frontend        │  15. Message appears in UI
│  (Sarah's browser)   │      - Left-aligned (incoming)
│                      │      - Shows "john#1234"
│                      │      - Notification sound (optional)
└──────────────────────┘
```

---

## Part 6: Configuration Requirements

### Environment Variables
```bash
# Required for bot to function
DISCORD_BOT_TOKEN=MTIzNDU2Nzg5MDEyMzQ1Njc4OQ.GxYzAb.1234567890...
DISCORD_CLIENT_ID=1234567890123456789
DISCORD_CLIENT_SECRET=AbCdEfGhIjKlMnOpQrStUvWxYz123456

# OAuth callback (must match Discord app settings)
DISCORD_REDIRECT_URI=https://api.paveos.com/api/v1/integrations/discord/callback

# Permissions needed for OAuth
DISCORD_OAUTH_SCOPES=identify email guilds guilds.members.read bot

# Bot permissions integer
DISCORD_PERMISSIONS=275146468368
```

### Discord Developer Portal Settings

**1. Bot Intents (Privileged)**
- ✅ **Message Content Intent** - REQUIRED to read message text
- ✅ Presence Intent - Optional (for user status)
- ✅ Server Members Intent - Required for guild member sync

**2. Bot Permissions**
- View Channels
- Send Messages
- Read Message History
- Embed Links
- Attach Files
- Use External Emojis
- Add Reactions

**3. OAuth2 Scopes**
- `bot` - Adds bot to servers
- `identify` - Read user ID and username
- `email` - Read user email
- `guilds` - Read user's servers
- `guilds.members.read` - Read server members

### MongoDB Indexes
```javascript
// DiscordMessage collection
{ discordMessageId: 1 }        // Unique index
{ userId: 1, createdAt: -1 }   // User's messages chronologically
{ leadId: 1, createdAt: -1 }   // Lead conversation
{ isRead: 1, userId: 1 }       // Unread messages per user

// DiscordConnection collection
{ userId: 1 }                  // Unique index
{ discordGuildId: 1 }          // Guild lookup
{ isActive: 1 }                // Active connections

// Lead collection
{ userId: 1, discordUserId: 1 } // Find lead by Discord ID
{ source: 1, status: 1 }        // Filter leads
```

---

## Part 7: Current Behavior Summary

### What Works ✅

1. **Sending DMs from CRM to Discord users**
   - CRM user clicks Send
   - Message delivered to Discord user's DM inbox
   - Message shows as from bot user
   - Message saved to database
   - Real-time update in CRM UI (if Socket.IO connected)

2. **Receiving DMs from Discord users**
   - Discord user sends DM to bot
   - Bot receives message via Gateway
   - Message saved to database
   - Lead auto-created if new sender
   - Real-time update in CRM UI (if Socket.IO connected)

3. **Message persistence**
   - All messages stored in MongoDB
   - Retrievable via GET /api/v1/integrations/discord/messages
   - Associated with correct lead
   - Can be marked as read/unread

4. **Lead auto-creation**
   - New Discord DM sender → Auto-create lead
   - Captures Discord username and ID
   - Sets status to "new"
   - Tags with "discord_dm"

### What Doesn't Work ❌

1. **Guild/Server channel messaging**
   - Cannot send to Discord server channels
   - Bot not invited to user servers
   - Only DMs are supported

2. **User identity in Discord**
   - All outbound messages show as from bot
   - Cannot indicate which CRM user sent message
   - Lead cannot distinguish between CRM team members

3. **Multi-user DM routing**
   - DMs always routed to first active connection
   - Cannot determine intended CRM recipient
   - Wrong user may receive conversation

4. **Message delivery guarantees**
   - If user has DMs disabled, message fails silently (error returned to API)
   - No retry mechanism
   - No delivery confirmation to CRM user

5. **Real-time updates without Socket.IO**
   - If WebSocket fails, no live updates
   - User must manually refresh
   - No notification of new messages

### Current Message Context

**In Discord DM (Lead's View):**
```
PaveOS Bot                                        Today at 2:15 PM
Hello! How can I help you today?

You                                               Today at 2:16 PM
I need help with my order

PaveOS Bot                                        Today at 2:17 PM
Let me check that for you
```

**In CRM UI (Team Member's View):**
```
┌─────────────────────────────────────────────────┐
│  Conversation with john#1234                    │
├─────────────────────────────────────────────────┤
│                                                 │
│  PaveOS Bot                       2:15 PM      │
│  Hello! How can I help you today?  ──────────► │
│                                                 │
│  ◄────────────  john#1234          2:16 PM      │
│                 I need help with my order       │
│                                                 │
│  PaveOS Bot                       2:17 PM      │
│  Let me check that for you         ──────────► │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Database Record:**
```json
{
  "_id": "507f1f77bcf86cd799439011",
  "userId": "693c51f957adb2211b6007aa",  // Sarah (CRM user)
  "leadId": "507f191e810c19729de860ea",   // john's lead
  "discordMessageId": "1234567890123456789",
  "discordChannelId": "9876543210987654321",
  "authorDiscordId": "111222333444555666",  // Bot's ID (outgoing) or john's ID (incoming)
  "authorUsername": "PaveOS Bot#1234",       // or "john#1234"
  "content": "Hello! How can I help you today?",
  "direction": "outgoing",
  "isRead": true,
  "metadata": {
    "channelName": "DM",
    "timestamp": 1702832100000
  },
  "createdAt": "2025-12-17T14:15:00.000Z"
}
```

---

## Conclusion

The Discord messaging integration **exclusively uses Direct Messages (DMs)** as the communication channel. The system relies on a Discord bot that:

1. **Runs continuously** on the backend server
2. **Listens for DM events** via Discord Gateway WebSocket
3. **Sends messages as the bot user** (not as individual CRM users)
4. **Routes all DMs to first active CRM connection** (limitation)
5. **Requires MESSAGE CONTENT intent** to read message text
6. **Depends on Socket.IO** for real-time UI updates

**Key Technical Constraint:** The bot is **NOT invited to Discord servers**, therefore it **CANNOT send messages to guild channels**. All communication flows through Discord's Direct Message API, which works without requiring server access but has the limitation that users can disable DMs.

Messages sent from the Whop UI appear in Discord as originating from the bot user account, and there is no current mechanism to indicate which specific CRM team member initiated the conversation.

---

**Document Version:** 1.0  
**Last Updated:** December 17, 2025  
**Author:** Technical Analysis (As-Is Documentation)
