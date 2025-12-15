import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { DiscordMessage } from '../src/models/DiscordMessage.js';

dotenv.config();

async function fixMessageOwnership() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Get all messages
    const messages = await DiscordMessage.find({}).lean();
    console.log(`Found ${messages.length} messages\n`);

    let fixedCount = 0;
    let skippedCount = 0;

    for (const message of messages) {
      // Get the lead for this message
      const lead = await Lead.findById(message.leadId);
      
      if (!lead) {
        console.log(`⚠️  Message ${message._id} has no lead, skipping`);
        skippedCount++;
        continue;
      }

      // Check if message userId matches lead userId
      if (message.userId.toString() !== lead.userId.toString()) {
        console.log(`🔧 Fixing message ${message._id}:`);
        console.log(`   Lead: ${lead.name} (${lead._id})`);
        console.log(`   Message userId: ${message.userId} → ${lead.userId}`);
        console.log(`   Content: "${message.content?.substring(0, 30) || 'no content'}"`);

        // Update message userId to match lead userId
        await DiscordMessage.updateOne(
          { _id: message._id },
          { $set: { userId: lead.userId } }
        );

        fixedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\n✅ Fixed ${fixedCount} messages`);
    console.log(`⏭️  Skipped ${skippedCount} messages (already correct)`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixMessageOwnership();
