import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { DiscordMessage } from '../src/models/DiscordMessage.js';
import { Lead } from '../src/models/Lead.js';

dotenv.config();

async function fixBrokenMessage() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    const messageId = '694192ce2a3181d860f04b04';
    const leadId = '69419293cb8d2d061eb263f6';

    // Get the lead
    const lead = await Lead.findById(leadId);
    if (!lead) {
      console.log('❌ Lead not found!');
      return;
    }

    console.log(`📋 Lead: ${lead.name} (owner: ${lead.userId})\n`);

    // Fix the message
    const message = await DiscordMessage.findById(messageId);
    if (!message) {
      console.log('❌ Message not found!');
      return;
    }

    console.log(`💬 Fixing message: "${message.content}"`);
    console.log(`   Old userId: ${message.userId}`);
    console.log(`   Old leadId: ${message.leadId || 'NONE'}`);
    
    // Update with correct values
    message.userId = lead.userId;
    message.leadId = lead._id.toString();
    await message.save();

    console.log(`   New userId: ${message.userId} ✅`);
    console.log(`   New leadId: ${message.leadId} ✅`);
    console.log(`\n✅ Message fixed!`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixBrokenMessage();
