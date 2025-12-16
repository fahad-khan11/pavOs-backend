import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DiscordMessage } from '../src/models/DiscordMessage.js';
import { getIO } from '../src/socket/index.js';

dotenv.config();

async function emitMissedMessages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Find messages created in the last hour that might have been missed
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const messages = await DiscordMessage.find({
      createdAt: { $gte: oneHourAgo },
      leadId: { $exists: true, $ne: null }
    }).sort({ createdAt: 1 });

    console.log(`📨 Found ${messages.length} messages from last hour\n`);

    const io = getIO();

    for (const msg of messages) {
      const room = `lead:${String(msg.leadId)}`;
      console.log(`📡 Emitting to room ${room}: "${msg.content?.substring(0, 30)}..."`);
      
      io.to(room).emit("discord:message", {
        ...msg.toJSON(),
      });
    }

    console.log(`\n✅ Emitted ${messages.length} messages`);
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

emitMissedMessages();
