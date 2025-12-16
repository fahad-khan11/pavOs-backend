import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { DiscordMessage } from '../src/models/DiscordMessage.js';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function diagnoseMessageIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    const leadId = '69419293cb8d2d061eb263f6';
    const messageId = '694192ce2a3181d860f04b04';
    const discordUserId = '1449815818140516614';

    // Get the lead
    const lead = await Lead.findById(leadId).lean();
    const leadOwner = await User.findById(lead?.userId);

    console.log('📋 LEAD:');
    console.log(`   ID: ${lead?._id}`);
    console.log(`   Name: ${lead?.name}`);
    console.log(`   Discord User: ${lead?.discordUserId}`);
    console.log(`   Owner: ${leadOwner?.email} (${lead?.userId})`);
    console.log(`   Company: ${lead?.whopCompanyId}\n`);

    // Get the message
    const message = await DiscordMessage.findById(messageId).lean();
    const messageOwner = await User.findById(message?.userId);

    console.log('💬 MESSAGE:');
    console.log(`   ID: ${message?._id}`);
    console.log(`   Content: "${message?.content}"`);
    console.log(`   Author Discord: ${message?.authorDiscordId}`);
    console.log(`   LeadId: ${message?.leadId}`);
    console.log(`   UserId: ${messageOwner?.email} (${message?.userId})`);
    console.log(`   Direction: ${message?.direction}\n`);

    // Check match
    const match = lead?.userId.toString() === message?.userId.toString();
    console.log(`🔍 MATCH: ${match ? '✅ YES' : '❌ NO'}`);
    
    if (!match) {
      console.log(`\n⚠️  MISMATCH!`);
      console.log(`   Lead owned by: ${leadOwner?.email}`);
      console.log(`   Message owned by: ${messageOwner?.email}`);
      console.log(`   → Message will be FILTERED OUT by backend query!\n`);
    }

    // Check Discord connections
    console.log('🔌 DISCORD CONNECTIONS:');
    const connections = await DiscordConnection.find({ isActive: true }).lean();
    for (const conn of connections) {
      const user = await User.findById(conn.userId);
      console.log(`   ${conn.discordUsername} → ${user?.email}`);
      console.log(`      UserId: ${conn.userId}`);
      console.log(`      Guild: ${conn.discordGuildName}\n`);
    }

    // Check if there's a lead for the message sender (saad_dev123)
    console.log('🔍 Checking for leads with this Discord user:');
    const allLeads = await Lead.find({ discordUserId }).lean();
    console.log(`   Found ${allLeads.length} leads for discordUserId ${discordUserId}:\n`);
    
    for (const l of allLeads) {
      const owner = await User.findById(l.userId);
      console.log(`   Lead ${l._id}:`);
      console.log(`      Owner: ${owner?.email} (${l.userId})`);
      console.log(`      Company: ${l.whopCompanyId}`);
      console.log(`      Created: ${l.createdAt}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

diagnoseMessageIssue();
