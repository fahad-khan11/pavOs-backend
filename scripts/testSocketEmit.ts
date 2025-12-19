import { io as ioClient } from 'socket.io-client';

const socket = ioClient('http://localhost:5000', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('✅ Connected to Socket.IO server');
  console.log('🔌 Socket ID:', socket.id);

  const leadId = '6940511e9d607703bf69392b';
  
  // Join the lead room
  console.log(`🚪 Joining room: lead:${leadId}`);
  socket.emit('lead:join', { leadId });

  // Listen for messages
  socket.on('discord:message', (data) => {
    console.log('📨 Received discord:message event:');
    console.log('   Content:', data.content);
    console.log('   LeadId:', data.leadId);
    console.log('   Direction:', data.direction);
    console.log('   Full data:', JSON.stringify(data, null, 2));
  });

  console.log('👂 Listening for discord:message events...');
  console.log('💬 Send a message from Discord to test!');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

socket.on('disconnect', () => {
  console.log('❌ Disconnected from Socket.IO server');
});
