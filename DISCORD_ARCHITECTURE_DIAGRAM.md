# Discord Thread-Based Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              WHOP UI (Frontend)                              │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Lead List   │  │ Lead Detail  │  │  Messages    │  │ Send Message │   │
│  │  Page        │  │  Page        │  │  Component   │  │  Button      │   │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                 │                  │                  │            │
└─────────┼─────────────────┼──────────────────┼──────────────────┼────────────┘
          │                 │                  │                  │
          │                 │                  │                  │
          ▼                 ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND API (Node.js + Express)                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      Discord Controller                             │    │
│  │  - GET /api/v1/integrations/discord/status                         │    │
│  │  - POST /api/v1/integrations/discord/send-message                  │    │
│  │  - POST /api/v1/integrations/discord/channels                      │    │
│  │  - GET /api/v1/integrations/discord/channels/:leadId               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                  Discord Channel Service                            │    │
│  │                                                                     │    │
│  │  createLeadChannel(leadId, userId, whopCompanyId, client)          │    │
│  │  ├─ Check if thread exists                                         │    │
│  │  ├─ Find or create intake channel (#leads)                         │    │
│  │  ├─ Create private thread inside intake channel                    │    │
│  │  ├─ Add bot as member                                              │    │
│  │  ├─ Add CRM staff members (if role configured)                     │    │
│  │  ├─ Add lead user (if exists in server)                            │    │
│  │  └─ Save thread mapping to database                                │    │
│  │                                                                     │    │
│  │  sendMessageToChannel(leadId, content, userId, whopCompanyId, ...)│    │
│  │  ├─ Find thread by leadId                                          │    │
│  │  ├─ Fetch Discord thread                                           │    │
│  │  ├─ Unarchive if archived                                          │    │
│  │  ├─ Send message to thread                                         │    │
│  │  ├─ Save message to database                                       │    │
│  │  └─ Update thread stats                                            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                     Discord Bot Service                             │    │
│  │                                                                     │    │
│  │  handleMessageCreate(message)                                      │    │
│  │  ├─ Check if message is in guild (not DM)                          │    │
│  │  ├─ Find DiscordConnection by guildId                              │    │
│  │  ├─ Find DiscordLeadChannel by channelId (thread ID)              │    │
│  │  ├─ Verify whopCompanyId matches (multi-tenant isolation)         │    │
│  │  ├─ Save message to database (direction: incoming)                │    │
│  │  └─ Emit WebSocket event to frontend                               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MongoDB Database                                  │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐│
│  │    Lead             │  │  DiscordLeadChannel │  │  DiscordMessage     ││
│  │                     │  │                     │  │                     ││
│  │  _id                │  │  leadId ───────────┼──│  leadId             ││
│  │  name               │  │  discordChannelId  │  │  discordMessageId   ││
│  │  email              │  │  (THREAD ID)       │  │  discordChannelId   ││
│  │  discordUserId      │  │  whopCompanyId     │  │  (THREAD ID)        ││
│  │  discordChannelId ──┼──│  discordGuildId    │  │  content            ││
│  │  (THREAD ID)        │  │  messageCount      │  │  direction          ││
│  │  whopCompanyId      │  │  lastMessageAt     │  │  authorDiscordId    ││
│  └─────────────────────┘  │  isActive          │  │  createdAt          ││
│                           └─────────────────────┘  └─────────────────────┘│
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │ DiscordConnection   │                                                    │
│  │                     │                                                    │
│  │  userId             │                                                    │
│  │  whopCompanyId      │                                                    │
│  │  discordGuildId     │                                                    │
│  │  discordUserId      │                                                    │
│  │  isActive           │                                                    │
│  └─────────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Discord Server (Guild)                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  #leads (Intake Channel - Private)                                  │    │
│  │  ├─ Permission: @everyone DENY ViewChannel                          │    │
│  │  ├─ Permission: Bot ALLOW ViewChannel, SendMessages, ManageThreads │    │
│  │  └─ Permission: CRM Staff ALLOW ViewChannel, SendMessages          │    │
│  │                                                                     │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │ 🧵 john-doe (Private Thread)                                 │ │    │
│  │  │  ├─ Type: PrivateThread                                      │ │    │
│  │  │  ├─ Members: Bot, CRM Staff, john-doe                        │ │    │
│  │  │  ├─ Auto-archive: 7 days                                     │ │    │
│  │  │  └─ Messages: [Message 1, Message 2, ...]                    │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  │                                                                     │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │ 🧵 jane-smith (Private Thread)                               │ │    │
│  │  │  ├─ Type: PrivateThread                                      │ │    │
│  │  │  ├─ Members: Bot, CRM Staff, jane-smith                      │ │    │
│  │  │  ├─ Auto-archive: 7 days                                     │ │    │
│  │  │  └─ Messages: [Message 1, Message 2, ...]                    │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  │                                                                     │    │
│  │  ┌──────────────────────────────────────────────────────────────┐ │    │
│  │  │ 🧵 bob-johnson (Private Thread - ARCHIVED)                   │ │    │
│  │  │  ├─ Type: PrivateThread                                      │ │    │
│  │  │  ├─ Members: Bot, CRM Staff, bob-johnson                     │ │    │
│  │  │  ├─ Status: Archived (auto-unarchives on new message)        │ │    │
│  │  │  └─ Messages: [Message 1, Message 2, ...]                    │ │    │
│  │  └──────────────────────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow: Sending a Message (Whop UI → Discord)

```
1. User clicks "Send" in Whop UI
   │
   ▼
2. POST /api/v1/integrations/discord/send-message
   │  { leadId, content }
   │
   ▼
3. discordController.sendMessage()
   │
   ▼
4. sendMessageToChannel(leadId, content, userId, whopCompanyId, client)
   │
   ├─ 5. Find DiscordLeadChannel by leadId
   │      → Get thread ID from discordChannelId
   │
   ├─ 6. Fetch thread from Discord (client.channels.fetch(threadId))
   │      → Verify it's a thread
   │      → Unarchive if archived
   │
   ├─ 7. Send message to thread (thread.send(content))
   │      → Get Discord message ID
   │
   ├─ 8. Save to database (DiscordMessage.create)
   │      → discordMessageId
   │      → discordChannelId (thread ID)
   │      → direction: "outgoing"
   │      → authorDiscordId: bot.id
   │
   ├─ 9. Update thread stats (DiscordLeadChannel.update)
   │      → Increment messageCount
   │      → Update lastMessageAt
   │
   └─ 10. Return message ID to frontend
         │
         ▼
11. Frontend displays message instantly (optimistic UI)
    └─ Replace temp ID with real ID from server
```

## Data Flow: Receiving a Message (Discord → Whop UI)

```
1. Lead user sends message in Discord thread
   │
   ▼
2. Discord bot receives MessageCreate event
   │
   ▼
3. handleMessageCreate(message)
   │
   ├─ 4. Check if message is in guild (not DM)
   │      → message.guildId exists
   │      → message.channelId is thread ID
   │
   ├─ 5. Find DiscordConnection by guildId
   │      → Get whopCompanyId
   │
   ├─ 6. Find DiscordLeadChannel by channelId (thread ID)
   │      → Get leadId
   │      → Verify whopCompanyId matches
   │
   ├─ 7. Save to database (DiscordMessage.create)
   │      → discordMessageId
   │      → discordChannelId (thread ID)
   │      → direction: "incoming"
   │      → authorDiscordId: message.author.id
   │
   ├─ 8. Update thread stats (DiscordLeadChannel.update)
   │      → Increment messageCount
   │      → Update lastMessageAt
   │
   └─ 9. Emit WebSocket event
         │  socket.to(userId).emit('discord:message', { ... })
         │
         ▼
10. Frontend receives WebSocket event
    └─ Display message in UI instantly
```

## Permission Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Discord Server Hierarchy                          │
└─────────────────────────────────────────────────────────────────────────┘
         │
         ├─ @everyone role
         │    └─ Permissions: DENY ViewChannel on #leads
         │       → Cannot see intake channel
         │       → Cannot see any threads
         │
         ├─ CRM Staff role (optional)
         │    └─ Permissions: ALLOW ViewChannel on #leads
         │       → Can see intake channel
         │       → Added as member to all threads
         │       → Can see and respond to all leads
         │
         └─ Bot role
              └─ Permissions: ALLOW ViewChannel, ManageThreads on #leads
                 → Can see intake channel
                 → Can create/manage threads
                 → Added as member to all threads

┌─────────────────────────────────────────────────────────────────────────┐
│                          Thread Permissions                              │
└─────────────────────────────────────────────────────────────────────────┘

Private Thread: 🧵 john-doe
├─ Type: PrivateThread (invite-only)
├─ Members:
│   ├─ Discord Bot (always)
│   ├─ CRM Staff Member 1 (if role configured)
│   ├─ CRM Staff Member 2 (if role configured)
│   └─ john-doe (if in server)
│
└─ Visibility:
    ├─ @everyone: ❌ Cannot see
    ├─ CRM Staff: ✅ Can see and send messages
    ├─ john-doe: ✅ Can see and send messages
    └─ Other users: ❌ Cannot see
```

## Multi-Tenant Isolation

```
Company A (whopCompanyId: company-a)
│
├─ Discord Server A (guildId: 111111)
│   └─ #leads
│       ├─ 🧵 lead-1-company-a
│       ├─ 🧵 lead-2-company-a
│       └─ 🧵 lead-3-company-a
│
└─ Database Records
    ├─ DiscordConnection { whopCompanyId: "company-a", guildId: "111111" }
    ├─ DiscordLeadChannel { whopCompanyId: "company-a", leadId: "lead-1" }
    ├─ DiscordLeadChannel { whopCompanyId: "company-a", leadId: "lead-2" }
    └─ DiscordLeadChannel { whopCompanyId: "company-a", leadId: "lead-3" }

Company B (whopCompanyId: company-b)
│
├─ Discord Server B (guildId: 222222)
│   └─ #leads
│       ├─ 🧵 lead-1-company-b
│       ├─ 🧵 lead-2-company-b
│       └─ 🧵 lead-3-company-b
│
└─ Database Records
    ├─ DiscordConnection { whopCompanyId: "company-b", guildId: "222222" }
    ├─ DiscordLeadChannel { whopCompanyId: "company-b", leadId: "lead-1" }
    ├─ DiscordLeadChannel { whopCompanyId: "company-b", leadId: "lead-2" }
    └─ DiscordLeadChannel { whopCompanyId: "company-b", leadId: "lead-3" }

✅ Isolation enforced at multiple levels:
   1. Different Discord servers (guildId)
   2. Different database whopCompanyId
   3. Message routing validates whopCompanyId match
   4. Frontend only shows company's own data
```

## Scalability Comparison

```
┌──────────────────────────────────────────────────────────────────────┐
│              BEFORE: Individual Channels per Lead                    │
└──────────────────────────────────────────────────────────────────────┘

Discord Server
├─ #lead-john-doe-abc123
├─ #lead-jane-smith-def456
├─ #lead-bob-johnson-ghi789
├─ ... (up to 500 channels max)
└─ ❌ LIMIT REACHED

Issues:
- ❌ 500 channel limit per server
- ❌ Cluttered Discord UI
- ❌ Hard to navigate
- ❌ Slow channel list loading

┌──────────────────────────────────────────────────────────────────────┐
│                AFTER: Threads in Intake Channel                      │
└──────────────────────────────────────────────────────────────────────┘

Discord Server
└─ #leads (1 intake channel)
    ├─ 🧵 john-doe
    ├─ 🧵 jane-smith
    ├─ 🧵 bob-johnson
    ├─ ... (up to 1,000 active threads)
    └─ [Archived Threads: unlimited]

Benefits:
- ✅ 1,000+ active threads
- ✅ Unlimited archived threads
- ✅ Clean Discord UI
- ✅ Easy navigation
- ✅ Fast loading
- ✅ Auto-archive/unarchive
```

---

**Legend:**
- `─`, `│`, `└`, `├`, `┌`, `┐`, `┘` : Box drawing characters
- `▼`, `→` : Flow direction
- `✅` : Success/Allowed
- `❌` : Failure/Denied
- `🧵` : Thread emoji
- `📋`, `📧`, `🆔`, `📊`, `📁` : Informational icons
