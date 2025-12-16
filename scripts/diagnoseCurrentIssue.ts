import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { DiscordMessage } from '../src/models/DiscordMessage.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function diagnoseCurrentIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    const leadId = '6940511e9d607703bf69392b';
    const messageId = '694198df2a3181d860f04b19';

    // Get the lead
    const lead = await Lead.findById(leadId).lean();
    if (!lead) {
      console.log('❌ Lead not found!');
      return;
    }

    const leadOwner = await User.findById(lead.userId);

    console.log('📋 LEAD:');
    console.log(`   ID: ${lead._id}`);
    console.log(`   Name: ${lead.name}`);
    console.log(`   Discord User: ${lead.discordUserId}`);
    console.log(`   Owner: ${leadOwner?.email} (${lead.userId})`);
    console.log(`   Company: ${lead.whopCompanyId}\n`);

    // Get the message
    const message = await DiscordMessage.findById(messageId).lean();
    if (!message) {
      console.log('❌ Message not found!');
      return;
    }

    const messageOwner = await User.findById(message.userId);

    console.log('💬 MESSAGE:');
    console.log(`   ID: ${message._id}`);
    console.log(`   Content: "${message.content}"`);
    console.log(`   Author Discord: ${message.authorDiscordId}`);
    console.log(`   LeadId: ${message.leadId}`);
    console.log(`   UserId: ${messageOwner?.email} (${message.userId})`);
    console.log(`   Direction: ${message.direction}`);
    console.log(`   Created: ${message.createdAt}\n`);

    // Check match
    const leadMatch = lead._id.toString() === message.leadId;
    const userMatch = lead.userId.toString() === message.userId.toString();

    console.log('🔍 CHECKS:');
    console.log(`   LeadId matches: ${leadMatch ? '✅ YES' : '❌ NO'}`);
    console.log(`   UserId matches: ${userMatch ? '✅ YES' : '❌ NO'}\n`);

    if (!userMatch) {
      console.log('⚠️  MISMATCH! Message will be FILTERED OUT by backend query!');
      console.log(`   Lead owned by: ${leadOwner?.email}`);
      console.log(`   Message owned by: ${messageOwner?.email}\n`);
    }

    // Get ALL messages for this lead (without userId filter)
    console.log('📨 ALL messages for this leadId (no filter):');
    const allMessages = await DiscordMessage.find({ leadId }).lean();
    console.log(`   Total: ${allMessages.length} messages\n`);

    for (const msg of allMessages) {
      const owner = await User.findById(msg.userId);
      const match = msg.userId.toString() === lead.userId.toString();
      console.log(`   ${match ? '✅' : '❌'} "${msg.content}" (owner: ${owner?.email}, direction: ${msg.direction})`);
    }

    // Simulate backend query (what API returns)
    console.log('\n📡 SIMULATING BACKEND QUERY (what API returns):');
    const backendQuery = {
      leadId: leadId,
      userId: lead.userId
    };
    const backendMessages = await DiscordMessage.find(backendQuery).lean();
    console.log(`   Query: { leadId: "${leadId}", userId: "${lead.userId}" }`);
    console.log(`   Result: ${backendMessages.length} messages\n`);

    backendMessages.forEach((msg, idx) => {
      console.log(`   ${idx + 1}. "${msg.content}" (${msg.direction})`);
    });

    if (backendMessages.length !== allMessages.length) {
      console.log(`\n⚠️  FILTERED OUT: ${allMessages.length - backendMessages.length} messages`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

diagnoseCurrentIssue();
