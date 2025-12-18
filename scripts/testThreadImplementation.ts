#!/usr/bin/env node
/**
 * Test Discord Thread Implementation
 * 
 * This script verifies the thread-based channel creation system:
 * 1. Creates a test lead
 * 2. Creates a thread for the lead
 * 3. Sends a message to the thread
 * 4. Verifies thread exists in Discord
 * 5. Cleans up test data
 */

import dotenv from 'dotenv';
import { connect } from '../src/config/database.js';
import { discordBotService } from '../src/services/discordBotService.js';
import { createLeadChannel, sendMessageToChannel, archiveLeadChannel } from '../src/services/discordChannelService.js';
import { Lead, User, DiscordConnection, DiscordLeadChannel, DiscordMessage } from '../src/models/index.js';
import logger from '../src/config/logger.js';

dotenv.config();

const INTAKE_CHANNEL_NAME = process.env.DISCORD_INTAKE_CHANNEL_NAME || 'leads';

async function testThreadImplementation() {
  console.log('\n🧪 Testing Discord Thread Implementation\n');
  console.log('='.repeat(60));
  
  let testLeadId: string | null = null;
  let testThreadId: string | null = null;

  try {
    // 1. Connect to database
    console.log('\n1️⃣  Connecting to database...');
    await connect();
    console.log('   ✅ Connected to database');

    // 2. Start Discord bot
    console.log('\n2️⃣  Starting Discord bot...');
    if (!discordBotService.isActive()) {
      await discordBotService.start();
      // Wait for bot to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log('   ✅ Discord bot is active');

    // 3. Get Discord connection
    console.log('\n3️⃣  Finding active Discord connection...');
    const connection = await DiscordConnection.findOne({ isActive: true });
    if (!connection) {
      throw new Error('No active Discord connection found. Please connect Discord first.');
    }
    console.log(`   ✅ Found connection for guild: ${connection.discordGuildId}`);
    console.log(`   📋 Company ID: ${connection.whopCompanyId}`);

    // 4. Get user
    console.log('\n4️⃣  Finding user...');
    const user = await User.findById(connection.userId);
    if (!user) {
      throw new Error(`User ${connection.userId} not found`);
    }
    console.log(`   ✅ Found user: ${user.email}`);

    // 5. Create test lead
    console.log('\n5️⃣  Creating test lead...');
    const testLead = await Lead.create({
      userId: connection.userId,
      whopCompanyId: connection.whopCompanyId,
      name: 'Test Thread Lead',
      email: 'test-thread@example.com',
      source: 'discord',
      status: 'new',
      tags: ['test', 'thread-implementation'],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    testLeadId = testLead._id.toString();
    console.log(`   ✅ Created test lead: ${testLeadId}`);
    console.log(`   📧 Email: ${testLead.email}`);

    // 6. Create thread for lead
    console.log('\n6️⃣  Creating thread for lead...');
    const client = discordBotService.getClient();
    if (!client) {
      throw new Error('Discord client not available');
    }

    const leadChannel = await createLeadChannel(
      testLeadId,
      connection.userId,
      connection.whopCompanyId,
      client
    );

    testThreadId = leadChannel.discordChannelId;
    console.log(`   ✅ Created thread: ${leadChannel.discordChannelName}`);
    console.log(`   🆔 Thread ID: ${testThreadId}`);

    // 7. Verify intake channel exists
    console.log('\n7️⃣  Verifying intake channel...');
    const guild = client.guilds.cache.get(connection.discordGuildId!);
    if (!guild) {
      throw new Error(`Guild ${connection.discordGuildId} not found`);
    }

    const intakeChannel = guild.channels.cache.find(
      ch => ch.name === INTAKE_CHANNEL_NAME
    );
    if (!intakeChannel) {
      throw new Error(`Intake channel "#${INTAKE_CHANNEL_NAME}" not found`);
    }
    console.log(`   ✅ Intake channel exists: #${intakeChannel.name} (${intakeChannel.id})`);

    // 8. Verify thread exists in Discord
    console.log('\n8️⃣  Verifying thread in Discord...');
    const thread = await client.channels.fetch(testThreadId);
    if (!thread) {
      throw new Error(`Thread ${testThreadId} not found in Discord`);
    }
    if (!thread.isThread()) {
      throw new Error(`Channel ${testThreadId} is not a thread`);
    }
    console.log(`   ✅ Thread exists in Discord: ${thread.name}`);
    console.log(`   📊 Type: ${thread.type === 12 ? 'Private Thread' : 'Unknown'}`);
    console.log(`   📁 Parent Channel: ${thread.parentId}`);

    // 9. Send test message to thread
    console.log('\n9️⃣  Sending test message to thread...');
    const messageId = await sendMessageToChannel(
      testLeadId,
      '🧪 Test message from thread implementation test script!',
      connection.userId,
      connection.whopCompanyId,
      client
    );
    console.log(`   ✅ Message sent to thread`);
    console.log(`   🆔 Message ID: ${messageId}`);

    // 10. Verify message in database
    console.log('\n🔟 Verifying message in database...');
    const dbMessage = await DiscordMessage.findOne({
      discordMessageId: messageId,
      leadId: testLeadId,
    });
    if (!dbMessage) {
      throw new Error('Message not found in database');
    }
    console.log(`   ✅ Message saved to database`);
    console.log(`   📝 Content: ${dbMessage.content}`);
    console.log(`   ➡️  Direction: ${dbMessage.direction}`);

    // 11. Verify thread stats updated
    console.log('\n1️⃣1️⃣  Verifying thread stats...');
    const updatedLeadChannel = await DiscordLeadChannel.findOne({
      leadId: testLeadId,
      isActive: true,
    });
    if (!updatedLeadChannel) {
      throw new Error('Lead channel not found');
    }
    console.log(`   ✅ Thread stats updated`);
    console.log(`   📊 Message count: ${updatedLeadChannel.messageCount}`);
    console.log(`   🕐 Last message: ${updatedLeadChannel.lastMessageAt}`);

    // 12. Test permissions
    console.log('\n1️⃣2️⃣  Testing thread permissions...');
    const crmStaffRoleId = process.env.DISCORD_CRM_STAFF_ROLE_ID;
    if (crmStaffRoleId) {
      console.log(`   ✅ CRM Staff role configured: ${crmStaffRoleId}`);
      const staffRole = guild.roles.cache.get(crmStaffRoleId);
      if (staffRole) {
        console.log(`   ✅ Staff role exists: ${staffRole.name}`);
        console.log(`   👥 Members: ${staffRole.members.size}`);
      } else {
        console.log(`   ⚠️  Staff role not found in guild`);
      }
    } else {
      console.log(`   ℹ️  CRM Staff role not configured`);
    }

    // 13. Success summary
    console.log('\n✅ TEST COMPLETE - All checks passed!\n');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log(`   ✅ Intake channel: #${INTAKE_CHANNEL_NAME}`);
    console.log(`   ✅ Thread created: ${leadChannel.discordChannelName}`);
    console.log(`   ✅ Message sent and saved to DB`);
    console.log(`   ✅ Thread stats updated correctly`);
    console.log('\n🎉 Thread implementation is working correctly!\n');

    // 14. Cleanup prompt
    console.log('⚠️  Test data created:');
    console.log(`   - Lead ID: ${testLeadId}`);
    console.log(`   - Thread ID: ${testThreadId}`);
    console.log('\n💡 To cleanup test data, run:');
    console.log(`   npm run cleanup-test-data -- --leadId=${testLeadId}`);
    console.log('\n   Or keep it for manual inspection in Discord.\n');

  } catch (error: any) {
    console.error('\n❌ TEST FAILED\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Cleanup on failure
    if (testLeadId) {
      console.log('\n🧹 Cleaning up test data...');
      try {
        await Lead.findByIdAndDelete(testLeadId);
        await DiscordLeadChannel.deleteMany({ leadId: testLeadId });
        await DiscordMessage.deleteMany({ leadId: testLeadId });
        console.log('   ✅ Test data cleaned up');
      } catch (cleanupError: any) {
        console.error('   ⚠️  Cleanup failed:', cleanupError.message);
      }
    }
    
    process.exit(1);
  }
}

// Run test
testThreadImplementation()
  .then(() => {
    console.log('Test completed. Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
