# Frontend Integration Guide - Discord DM Messages

## 🚀 Quick Start

When sending messages from CRM to Discord, **always use DMs** with the `discordUserId` field.

## ✅ Correct Usage

```typescript
// Send message to a lead
const sendDiscordMessage = async (lead: Lead, messageText: string) => {
  if (!lead.discordUserId) {
    throw new Error('This lead does not have a Discord account');
  }

  const response = await fetch(`${API_URL}/integrations/discord/send-message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      discordUserId: lead.discordUserId,  // ✅ Required
      content: messageText,                // ✅ Required
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to send message');
  }

  return await response.json();
};
```

## ❌ What NOT to Do

```typescript
// ❌ DON'T send channelId - it's no longer supported
await fetch(`${API_URL}/integrations/discord/send-message`, {
  method: 'POST',
  body: JSON.stringify({
    channelId: 'some_channel_id',  // ❌ This will fail
    content: messageText,
  }),
});

// ❌ DON'T send without discordUserId
await fetch(`${API_URL}/integrations/discord/send-message`, {
  method: 'POST',
  body: JSON.stringify({
    content: messageText,  // ❌ Missing discordUserId
  }),
});
```

## 📝 API Reference

### Endpoint
```
POST /api/v1/integrations/discord/send-message
```

### Request Headers
```json
{
  "Authorization": "Bearer YOUR_JWT_TOKEN",
  "Content-Type": "application/json"
}
```

### Request Body
```typescript
{
  discordUserId: string;  // Required - Discord user's ID (from lead.discordUserId)
  content: string;        // Required - Message text to send
}
```

### Success Response (200 OK)
```json
{
  "success": true,
  "message": "Message sent successfully via DM",
  "data": {
    "message": {
      "id": "1234567890",
      "content": "Your message text",
      "channelId": "...",
      "createdTimestamp": 1234567890000
    }
  }
}
```

### Error Responses

#### 400 - Missing discordUserId
```json
{
  "success": false,
  "error": "discordUserId is required. Messages are sent as DMs only."
}
```

#### 400 - DMs Disabled
```json
{
  "success": false,
  "error": "Cannot send DM to this user. They may have DMs disabled or blocked the bot."
}
```

#### 400 - Discord Not Connected
```json
{
  "success": false,
  "error": "Discord not connected"
}
```

#### 500 - Bot Not Running
```json
{
  "success": false,
  "error": "Discord bot is not active"
}
```

## 🎨 React Component Example

```tsx
import { useState } from 'react';
import { api } from '@/lib/api';

interface MessageInputProps {
  lead: Lead;
  onSuccess?: () => void;
}

export function DiscordMessageInput({ lead, onSuccess }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    if (!message.trim()) {
      setError('Message cannot be empty');
      return;
    }

    if (!lead.discordUserId) {
      setError('This lead does not have Discord connected');
      return;
    }

    setSending(true);
    setError('');

    try {
      await api.post('/integrations/discord/send-message', {
        discordUserId: lead.discordUserId,
        content: message,
      });

      setMessage('');
      onSuccess?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message..."
        className="border rounded p-2"
        rows={3}
        disabled={sending || !lead.discordUserId}
      />
      
      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      {!lead.discordUserId && (
        <div className="text-yellow-600 text-sm">
          ⚠️ This lead doesn't have Discord connected
        </div>
      )}

      <button
        onClick={handleSend}
        disabled={sending || !message.trim() || !lead.discordUserId}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {sending ? 'Sending...' : 'Send via Discord DM'}
      </button>
    </div>
  );
}
```

## 🛠️ Error Handling Best Practices

```typescript
const sendMessage = async (lead: Lead, content: string) => {
  try {
    const response = await api.post('/integrations/discord/send-message', {
      discordUserId: lead.discordUserId,
      content,
    });

    // Show success notification
    toast.success('Message sent to Discord!');
    return response.data;

  } catch (error: any) {
    const errorMessage = error.response?.data?.error || 'Failed to send message';

    // Handle specific errors
    if (errorMessage.includes('DMs disabled')) {
      toast.error('This user has DMs disabled. Ask them to enable DMs from server members.');
    } else if (errorMessage.includes('not connected')) {
      toast.error('Please connect Discord first');
    } else if (errorMessage.includes('discordUserId is required')) {
      toast.error('This lead does not have Discord information');
    } else {
      toast.error(errorMessage);
    }

    throw error;
  }
};
```

## ✅ Pre-Send Validation

```typescript
const canSendDiscordMessage = (lead: Lead): boolean => {
  return !!(lead.discordUserId && lead.discordUsername);
};

// Usage in component
{canSendDiscordMessage(lead) ? (
  <button onClick={() => sendMessage(lead, content)}>
    Send Discord DM
  </button>
) : (
  <div className="text-gray-500">
    Discord not connected for this lead
  </div>
)}
```

## 📊 TypeScript Types

```typescript
// Lead type (should match your existing type)
interface Lead {
  _id: string;
  name: string;
  discordUserId?: string;      // Required for sending messages
  discordUsername?: string;    // Display name
  source: string;
  // ... other fields
}

// API Request
interface SendDiscordMessageRequest {
  discordUserId: string;
  content: string;
}

// API Response
interface SendDiscordMessageResponse {
  success: boolean;
  message: string;
  data: {
    message: {
      id: string;
      content: string;
      channelId: string;
      createdTimestamp: number;
    };
  };
}

// Error Response
interface ApiErrorResponse {
  success: false;
  error: string;
}
```

## 🧪 Testing Checklist

- [ ] Send message to lead with Discord ID → ✅ Should work
- [ ] Send message to lead without Discord ID → ❌ Should show error
- [ ] Send empty message → ❌ Should validate before API call
- [ ] Send message when bot is offline → ❌ Should show "bot not active" error
- [ ] Send message to user with DMs disabled → ❌ Should show helpful error
- [ ] Check Discord DMs → ✅ Message should appear

## 🚨 Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "discordUserId is required" | Not sending `discordUserId` in request | Add `discordUserId: lead.discordUserId` to request body |
| "This lead does not have Discord" | Lead missing `discordUserId` field | Check if lead was created from Discord or has Discord connected |
| "DMs disabled" | Discord user has DMs turned off | Ask user to enable DMs in Discord privacy settings |
| "Discord not connected" | CRM user hasn't connected Discord | Go to Settings → Integrations → Connect Discord |

## 📝 Notes

1. **DM-Only Mode**: Messages are ONLY sent as Direct Messages, not to server channels
2. **Privacy**: DMs are private between bot and recipient
3. **Reliability**: Works without bot needing server access
4. **Multi-Tenant**: Each user only sees their own leads' messages
