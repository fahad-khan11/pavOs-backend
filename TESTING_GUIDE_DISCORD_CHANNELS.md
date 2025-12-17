# Discord Channel-Based Architecture - Testing Guide

## 📋 Overview

This guide provides comprehensive testing procedures for the Discord channel-based messaging implementation. Follow these tests in order to verify all functionality works correctly.

---

## 🔧 Prerequisites

Before testing, ensure:
- ✅ Backend server is running (`npm run dev`)
- ✅ Frontend is running (`npm run dev`)
- ✅ MongoDB is running and accessible
- ✅ Discord bot is configured and running
- ✅ You have a Discord server where the bot has been invited
- ✅ You have valid test user credentials

---

## 🧪 Test Suite 1: Backend API Tests

### Test 1.1: Create Discord Channel for Lead

**Endpoint**: `POST /api/v1/integrations/discord/channels`

**Test Steps**:
```bash
# 1. Get your auth token (login first)
TOKEN="your_jwt_token_here"
LEAD_ID="your_lead_id_here"

# 2. Create a channel
curl -X POST http://localhost:5000/api/v1/integrations/discord/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"leadId\": \"$LEAD_ID\"}"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "channel": {
      "id": "...",
      "userId": "...",
      "whopCompanyId": "...",
      "leadId": "507f1f77bcf86cd799439011",
      "discordGuildId": "1234567890",
      "discordChannelId": "9876543210",
      "discordChannelName": "john-doe-abc123",
      "channelCreatedAt": "2025-12-17T10:30:00.000Z",
      "messageCount": 0,
      "isActive": true,
      "createdAt": "2025-12-17T10:30:00.000Z",
      "updatedAt": "2025-12-17T10:30:00.000Z"
    }
  },
  "message": "Channel created successfully"
}
```

**Verification**:
- ✅ HTTP 200 status code
- ✅ Response has `channel` object
- ✅ Channel exists in Discord server
- ✅ Channel is private (not visible in channel list by default)
- ✅ Channel name matches pattern: `{lead-name}-{timestamp}`

**Error Cases to Test**:
```bash
# Missing leadId
curl -X POST http://localhost:5000/api/v1/integrations/discord/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{}"
# Expected: 400 Bad Request - "leadId is required"

# Invalid leadId
curl -X POST http://localhost:5000/api/v1/integrations/discord/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"leadId\": \"invalid_id\"}"
# Expected: 404 Not Found - "Lead not found"

# Channel already exists
curl -X POST http://localhost:5000/api/v1/integrations/discord/channels \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"leadId\": \"$LEAD_ID\"}"
# Expected: 200 OK - "Channel already exists for this lead"
```

---

### Test 1.2: Send Message via Channel (New Method)

**Endpoint**: `POST /api/v1/integrations/discord/send-message`

**Test Steps**:
```bash
# Send a message using leadId (new channel-based routing)
curl -X POST http://localhost:5000/api/v1/integrations/discord/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"leadId\": \"$LEAD_ID\",
    \"content\": \"Hello from the CRM! This is a test message.\"
  }"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "messageId": "1234567890123456789",
    "method": "channel"
  },
  "message": "Message sent successfully via lead channel"
}
```

**Verification**:
- ✅ HTTP 200 status code
- ✅ Response has `messageId` and `method: 'channel'`
- ✅ Message appears in Discord channel
- ✅ Message saved in database with correct `whopCompanyId` and `leadId`
- ✅ Socket.IO event emitted to `lead:{leadId}` room

---

### Test 1.3: Send Message via DM (Legacy Method)

**Endpoint**: `POST /api/v1/integrations/discord/send-message`

**Test Steps**:
```bash
# Send a message using discordUserId (legacy DM-based routing)
DISCORD_USER_ID="discord_user_id_here"

curl -X POST http://localhost:5000/api/v1/integrations/discord/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"discordUserId\": \"$DISCORD_USER_ID\",
    \"content\": \"Hello via DM! This is a legacy test.\"
  }"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "...",
      "content": "Hello via DM! This is a legacy test.",
      ...
    },
    "method": "dm"
  },
  "message": "Message sent successfully via DM"
}
```

**Verification**:
- ✅ HTTP 200 status code
- ✅ Response has `method: 'dm'`
- ✅ Message sent as Discord DM
- ✅ Backward compatibility maintained

---

### Test 1.4: Get Channel for Lead

**Endpoint**: `GET /api/v1/integrations/discord/channels/:leadId`

**Test Steps**:
```bash
# Get channel details
curl http://localhost:5000/api/v1/integrations/discord/channels/$LEAD_ID \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "channel": {
      "id": "...",
      "leadId": "507f1f77bcf86cd799439011",
      "discordChannelId": "9876543210",
      "discordChannelName": "john-doe-abc123",
      "messageCount": 5,
      "lastMessageAt": "2025-12-17T14:25:00.000Z",
      ...
    }
  },
  "message": "Channel retrieved successfully"
}
```

**Verification**:
- ✅ HTTP 200 status code
- ✅ Channel details returned
- ✅ Message count matches actual messages

---

### Test 1.5: Get All Company Channels

**Endpoint**: `GET /api/v1/integrations/discord/channels`

**Test Steps**:
```bash
# Get all channels for the user's company
curl http://localhost:5000/api/v1/integrations/discord/channels \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "id": "...",
        "leadId": "...",
        "discordChannelName": "lead-1-abc123",
        "messageCount": 10,
        ...
      },
      {
        "id": "...",
        "leadId": "...",
        "discordChannelName": "lead-2-def456",
        "messageCount": 5,
        ...
      }
    ],
    "count": 2
  },
  "message": "Channels retrieved successfully"
}
```

**Verification**:
- ✅ HTTP 200 status code
- ✅ All channels for company returned
- ✅ Count matches array length

---

### Test 1.6: Archive Channel

**Endpoint**: `DELETE /api/v1/integrations/discord/channels/:leadId`

**Test Steps**:
```bash
# Archive a channel
curl -X DELETE http://localhost:5000/api/v1/integrations/discord/channels/$LEAD_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"reason\": \"Lead converted to customer\"}"
```

**Expected Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Channel archived successfully"
}
```

**Verification**:
- ✅ HTTP 200 status code
- ✅ Channel marked as `isActive: false` in database
- ✅ Channel no longer appears in active channels list

---

## 🎨 Test Suite 2: Frontend Integration Tests

### Test 2.1: Import Service and Types

**File**: Any React component

```typescript
import { discordService, DiscordLeadChannel, Lead } from '@/lib/services/discordService';

// Test 1: TypeScript autocomplete works
const testTypes = () => {
  const channel: DiscordLeadChannel = {
    id: '',
    userId: '',
    whopCompanyId: '',
    leadId: '',
    discordGuildId: '',
    discordChannelId: '',
    discordChannelName: '',
    channelCreatedAt: '',
    messageCount: 0,
    isActive: true,
    createdAt: '',
    updatedAt: ''
  };
  
  // TypeScript should show all properties
  console.log(channel.discordChannelName);
};
```

**Verification**:
- ✅ No TypeScript errors
- ✅ Autocomplete shows all properties
- ✅ Types imported successfully

---

### Test 2.2: Create Channel from Frontend

**File**: Lead detail component

```typescript
const TestCreateChannel = () => {
  const [channel, setChannel] = useState<DiscordLeadChannel | null>(null);
  const [loading, setLoading] = useState(false);
  const leadId = "your_lead_id";

  const handleCreate = async () => {
    setLoading(true);
    try {
      const newChannel = await discordService.createChannel(leadId);
      console.log('✅ Channel created:', newChannel);
      setChannel(newChannel);
      alert(`Channel created: ${newChannel.discordChannelName}`);
    } catch (error) {
      console.error('❌ Failed to create channel:', error);
      alert('Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button onClick={handleCreate} disabled={loading}>
      {loading ? 'Creating...' : 'Create Discord Channel'}
    </button>
  );
};
```

**Verification**:
- ✅ Button creates channel successfully
- ✅ Loading state works
- ✅ Channel object has all expected properties
- ✅ Error handling works

---

### Test 2.3: Send Message from Frontend

**File**: Message composer component

```typescript
const TestSendMessage = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const leadId = "your_lead_id";

  const handleSend = async () => {
    if (!content.trim()) return;
    
    setLoading(true);
    try {
      // ✅ NEW: Send via leadId (channel-based)
      const result = await discordService.sendMessage({
        leadId: leadId,
        content: content
      });
      
      console.log('✅ Message sent:', result);
      console.log('Method used:', result.method); // Should be 'channel'
      
      setLastResult(result);
      setContent('');
      alert(`Message sent via ${result.method}`);
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <textarea 
        value={content} 
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your message..."
      />
      <button onClick={handleSend} disabled={loading || !content.trim()}>
        {loading ? 'Sending...' : 'Send Message'}
      </button>
      {lastResult && (
        <p>Last message sent via: {lastResult.method}</p>
      )}
    </div>
  );
};
```

**Verification**:
- ✅ Message sends successfully
- ✅ Result shows `method: 'channel'`
- ✅ Message appears in Discord
- ✅ Message appears in CRM (check database)

---

### Test 2.4: Get Channel Status

**File**: Lead detail component

```typescript
const TestGetChannel = () => {
  const [channel, setChannel] = useState<DiscordLeadChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const leadId = "your_lead_id";

  useEffect(() => {
    const loadChannel = async () => {
      try {
        const channelData = await discordService.getChannelForLead(leadId);
        console.log('Channel data:', channelData);
        setChannel(channelData);
      } catch (error) {
        console.error('Failed to load channel:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadChannel();
  }, [leadId]);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {channel ? (
        <div>
          <p>Channel: {channel.discordChannelName}</p>
          <p>Messages: {channel.messageCount}</p>
          <p>Last Message: {channel.lastMessageAt || 'Never'}</p>
        </div>
      ) : (
        <p>No channel exists for this lead</p>
      )}
    </div>
  );
};
```

**Verification**:
- ✅ Channel loads successfully
- ✅ Channel data displays correctly
- ✅ Null state handled properly

---

## 🔄 Test Suite 3: End-to-End Integration Tests

### Test 3.1: Complete Lead Messaging Flow

**Steps**:

1. **Create a new lead**
   ```
   - Navigate to Leads page
   - Click "Create New Lead"
   - Fill in: Name, Email, Discord Username (optional)
   - Save
   - Note the lead ID
   ```

2. **Create Discord channel**
   ```
   - Open lead detail page
   - Click "Create Discord Channel" button
   - Wait for success message
   - Verify channel appears in Discord server
   ```

3. **Send message from CRM**
   ```
   - Type a message in the message composer
   - Click "Send Message"
   - Verify "Message sent via channel" confirmation
   - Check Discord: Message should appear in the lead's channel
   ```

4. **Lead responds in Discord**
   ```
   - In Discord, have the lead send a message in their channel
   - Wait 2-3 seconds
   - Refresh the lead detail page in CRM
   - Verify lead's message appears in the conversation
   ```

5. **Verify ownership**
   ```
   - Check that the message is associated with the correct CRM user
   - Verify it does NOT appear for other users in the company
   ```

**Expected Results**:
- ✅ All messages route correctly
- ✅ Real-time updates via Socket.IO
- ✅ No cross-user message leakage
- ✅ Lead's `discordJoinedChannel` set to true after first message

---

### Test 3.2: Multi-Tenant Isolation

**Setup**: You need two separate Whop companies with different Discord servers.

**Steps**:

1. **Company A: User A**
   ```
   - Login as User A (Company A)
   - Connect Discord (Server A)
   - Create lead "Lead A1"
   - Create Discord channel for Lead A1
   - Send message to Lead A1
   ```

2. **Company B: User B**
   ```
   - Login as User B (Company B) in incognito window
   - Connect Discord (Server B - different server!)
   - Create lead "Lead B1"
   - Create Discord channel for Lead B1
   - Send message to Lead B1
   ```

3. **Verify Isolation**
   ```
   - User A should NOT see Lead B1's channel
   - User B should NOT see Lead A1's channel
   - Messages from Lead A1 should go to User A only
   - Messages from Lead B1 should go to User B only
   ```

**Expected Results**:
- ✅ Each company has their own Discord server
- ✅ Channels are isolated per company
- ✅ Messages route to correct company/user
- ✅ No cross-company data leakage

---

### Test 3.3: Backward Compatibility (Legacy DM)

**Steps**:

1. **Send message via legacy method**
   ```typescript
   // Use discordUserId instead of leadId
   const result = await discordService.sendMessage({
     discordUserId: 'discord_user_id_here',
     content: 'Test legacy DM'
   });
   
   console.log(result.method); // Should be 'dm'
   ```

2. **Verify**
   ```
   - Message sent as DM (not in channel)
   - Response shows method: 'dm'
   - Message saved in database
   - Old functionality still works
   ```

**Expected Results**:
- ✅ Legacy DM method still works
- ✅ No breaking changes
- ✅ Both methods coexist peacefully

---

## 📊 Test Suite 4: Performance Tests

### Test 4.1: Channel Creation Speed

```typescript
const testChannelCreationSpeed = async () => {
  const leadIds = ['lead1', 'lead2', 'lead3', 'lead4', 'lead5'];
  const times: number[] = [];
  
  for (const leadId of leadIds) {
    const start = Date.now();
    try {
      await discordService.createChannel(leadId);
      const duration = Date.now() - start;
      times.push(duration);
      console.log(`Channel ${leadId}: ${duration}ms`);
    } catch (error) {
      console.error(`Failed to create channel for ${leadId}:`, error);
    }
  }
  
  const average = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`Average creation time: ${average}ms`);
  
  // Expected: < 2000ms average
  expect(average).toBeLessThan(2000);
};
```

**Acceptance Criteria**:
- ✅ Average creation time < 2 seconds
- ✅ No failures
- ✅ All channels created successfully

---

### Test 4.2: Message Routing Speed

```typescript
const testMessageRoutingSpeed = async () => {
  const leadId = 'test_lead_id';
  const times: number[] = [];
  
  for (let i = 0; i < 20; i++) {
    const start = Date.now();
    try {
      await discordService.sendMessage({
        leadId: leadId,
        content: `Test message ${i}`
      });
      const duration = Date.now() - start;
      times.push(duration);
      console.log(`Message ${i}: ${duration}ms`);
    } catch (error) {
      console.error(`Failed to send message ${i}:`, error);
    }
  }
  
  const average = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`Average send time: ${average}ms`);
  
  // Expected: < 500ms average
  expect(average).toBeLessThan(500);
};
```

**Acceptance Criteria**:
- ✅ Average send time < 500ms
- ✅ No failures
- ✅ All messages delivered

---

## 🐛 Test Suite 5: Error Handling

### Test 5.1: Invalid Inputs

```typescript
// Test 1: Missing leadId
try {
  await discordService.createChannel('');
} catch (error) {
  console.log('✅ Caught error: leadId required');
}

// Test 2: Invalid leadId format
try {
  await discordService.createChannel('invalid_id_123');
} catch (error) {
  console.log('✅ Caught error: Invalid lead ID');
}

// Test 3: Lead not found
try {
  await discordService.createChannel('000000000000000000000000');
} catch (error) {
  console.log('✅ Caught error: Lead not found');
}

// Test 4: Empty message content
try {
  await discordService.sendMessage({
    leadId: 'valid_lead_id',
    content: ''
  });
} catch (error) {
  console.log('✅ Caught error: Content required');
}
```

**Acceptance Criteria**:
- ✅ All errors caught and handled gracefully
- ✅ User-friendly error messages
- ✅ No crashes or unhandled exceptions

---

### Test 5.2: Network Failures

```typescript
// Simulate network failure
const testNetworkFailure = async () => {
  // Disconnect network (or stop backend server)
  
  try {
    await discordService.sendMessage({
      leadId: 'test_lead',
      content: 'Test'
    });
  } catch (error) {
    console.log('✅ Network error handled:', error.message);
    // Should show user-friendly error
  }
};
```

**Acceptance Criteria**:
- ✅ Network errors caught
- ✅ User notified with clear message
- ✅ No data corruption

---

## ✅ Test Checklist

Use this checklist to track your testing progress:

### Backend Tests
- [ ] Create channel - success case
- [ ] Create channel - duplicate detection
- [ ] Create channel - invalid lead ID
- [ ] Send message via leadId - success
- [ ] Send message via discordUserId - legacy works
- [ ] Get channel for lead - exists
- [ ] Get channel for lead - doesn't exist
- [ ] Get all company channels
- [ ] Archive channel

### Frontend Tests
- [ ] TypeScript types work
- [ ] Create channel from UI
- [ ] Send message from UI (new method)
- [ ] Send message from UI (legacy method)
- [ ] Display channel status
- [ ] Load company channels list
- [ ] Error handling in UI

### Integration Tests
- [ ] End-to-end message flow
- [ ] Multi-tenant isolation verified
- [ ] Backward compatibility confirmed
- [ ] Socket.IO real-time updates work

### Performance Tests
- [ ] Channel creation < 2s average
- [ ] Message sending < 500ms average
- [ ] Database queries use indexes

### Error Handling
- [ ] Invalid inputs handled
- [ ] Network failures handled
- [ ] Missing permissions handled

---

## 📝 Test Report Template

After completing tests, fill out this report:

```
# Discord Channel Implementation Test Report

**Date**: YYYY-MM-DD
**Tester**: [Your Name]
**Environment**: Development / Staging / Production

## Test Summary
- Total Tests: X
- Passed: Y
- Failed: Z
- Skipped: W

## Backend API Tests
- Create Channel: ✅ / ❌
- Send Message (Channel): ✅ / ❌
- Send Message (DM): ✅ / ❌
- Get Channel: ✅ / ❌
- List Channels: ✅ / ❌
- Archive Channel: ✅ / ❌

## Frontend Tests
- TypeScript Integration: ✅ / ❌
- UI Components: ✅ / ❌
- Error Handling: ✅ / ❌

## Integration Tests
- End-to-End Flow: ✅ / ❌
- Multi-Tenant Isolation: ✅ / ❌
- Backward Compatibility: ✅ / ❌

## Performance Metrics
- Average Channel Creation Time: XXXms
- Average Message Send Time: XXXms
- Database Query Performance: Good / Needs Optimization

## Issues Found
1. [Issue description]
2. [Issue description]

## Recommendations
1. [Recommendation]
2. [Recommendation]

## Sign-off
- Developer: _______________
- QA: _______________
- Product Owner: _______________
```

---

## 🎯 Success Criteria

The implementation is considered successful when:

✅ **Functionality**:
- All API endpoints work correctly
- Frontend integration complete
- No TypeScript errors
- Error handling robust

✅ **Performance**:
- Channel creation < 2s
- Message routing < 500ms
- Database queries indexed

✅ **Security**:
- Multi-tenant isolation verified
- No cross-company data leakage
- Permission checks working

✅ **Compatibility**:
- Legacy DM method still works
- No breaking changes
- Smooth migration path

✅ **User Experience**:
- Real-time message updates
- Clear error messages
- Intuitive UI flow

---

**Happy Testing!** 🚀
