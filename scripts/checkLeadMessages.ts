import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { DiscordMessage } from '../src/models/DiscordMessage.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function checkLeadMessages() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    const leadId = '694058039d607703bf693bc9';
    const messageId = '694058772a3181d860f04a4e';

    // Get the lead
    const lead = await Lead.findById(leadId).lean();
    if (!lead) {
      console.log('❌ Lead not found!');
      return;
    }

    const leadOwner = await User.findById(lead.userId);

    console.log('📋 Lead Info:');
    console.log(`   ID: ${lead._id}`);
    console.log(`   Name: ${lead.name}`);
    console.log(`   Discord: ${lead.discordUserId}`);
    console.log(`   Owner: ${leadOwner?.email} (${lead.userId})`);
    console.log(`   Company: ${lead.whopCompanyId || 'none'}\n`);

    // Get the message
    const message = await DiscordMessage.findById(messageId).lean();
    if (!message) {
      console.log('❌ Message not found!');
      return;
    }

    const messageOwner = await User.findById(message.userId);

    console.log('💬 Message Info:');
    console.log(`   ID: ${message._id}`);
    console.log(`   Content: "${message.content}"`);
    console.log(`   Direction: ${message.direction}`);
    console.log(`   Author: ${message.authorUsername} (${message.authorDiscordId})`);
    console.log(`   LeadId: ${message.leadId}`);
    console.log(`   UserId: ${messageOwner?.email} (${message.userId})`);
    console.log(`   Created: ${message.createdAt}\n`);

    // Check if they match
    const match = lead.userId.toString() === message.userId.toString();
    console.log(`🔍 Lead owner matches message owner: ${match ? '✅ YES' : '❌ NO'}`);

    if (!match) {
      console.log(`\n⚠️  MISMATCH DETECTED:`);
      console.log(`   Lead owned by: ${leadOwner?.email}`);
      console.log(`   Message owned by: ${messageOwner?.email}`);
      console.log(`   This message will be filtered out by multi-tenant logic!`);
    }

    // Get all messages for this lead
    console.log('\n📨 All messages for this lead:');
    const allMessages = await DiscordMessage.find({ leadId }).sort({ createdAt: 1 }).lean();
    
    for (const msg of allMessages) {
      const msgOwner = await User.findById(msg.userId);
      const ownerMatch = msg.userId.toString() === lead.userId.toString();
      console.log(`   ${ownerMatch ? '✅' : '❌'} "${msg.content}" (${msg.direction}, owner: ${msgOwner?.email})`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkLeadMessages();
