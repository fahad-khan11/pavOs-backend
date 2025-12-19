#!/usr/bin/env node
/**
 * Test Discord Reconnection Fix
 * 
 * This script helps verify that Discord reconnection works correctly:
 * 1. Shows current connection state
 * 2. Tests disconnect (clears all data)
 * 3. Shows state after disconnect
 * 4. Provides instructions for testing reconnect
 */

import dotenv from 'dotenv';
import { connect } from '../src/config/database.js';
import { DiscordConnection, User } from '../src/models/index.js';
import { discordBotService } from '../src/services/discordBotService.js';

dotenv.config();

async function testReconnectFix() {
  console.log('\n🧪 Testing Discord Reconnection Fix\n');
  console.log('='.repeat(60));

  try {
    // Connect to database
    console.log('\n1️⃣  Connecting to database...');
    await connect();
    console.log('   ✅ Connected');

    // Get user (use first user for testing)
    console.log('\n2️⃣  Finding test user...');
    const user = await User.findOne().sort({ createdAt: -1 });
    if (!user) {
      console.log('   ❌ No users found in database');
      return;
    }
    console.log(`   ✅ Found user: ${user.email}`);
    console.log(`   🆔 User ID: ${user._id}`);
    console.log(`   🏢 Company ID: ${user.whopCompanyId || 'Not set'}`);

    // Get all connections for this user
    console.log('\n3️⃣  Checking Discord connections...');
    const allConnections = await DiscordConnection.find({ userId: user._id.toString() });
    console.log(`   📊 Total connections: ${allConnections.length}`);
    
    if (allConnections.length === 0) {
      console.log('\n   ℹ️  No connections found. User needs to connect to Discord first.');
      console.log('   📝 Steps:');
      console.log('      1. Start the backend server');
      console.log('      2. Login to Whop UI');
      console.log('      3. Go to Settings → Integrations → Discord');
      console.log('      4. Click "Connect Discord"');
      return;
    }

    // Show connection details
    console.log('\n   Connection Details:');
    allConnections.forEach((conn, i) => {
      console.log(`\n   Connection ${i + 1}:`);
      console.log(`      ID: ${conn._id}`);
      console.log(`      Active: ${conn.isActive ? '✅ Yes' : '❌ No'}`);
      console.log(`      Guild ID: ${conn.discordGuildId || 'Not set'}`);
      console.log(`      Guild Name: ${conn.discordGuildName || 'Not set'}`);
      console.log(`      Discord User: ${conn.discordUsername || 'Not set'}`);
      console.log(`      Connected At: ${conn.connectedAt || 'Unknown'}`);
      console.log(`      Synced Members: ${conn.syncedMembersCount || 0}`);
    });

    // Check bot status
    console.log('\n4️⃣  Checking bot status...');
    if (!discordBotService.isActive()) {
      console.log('   ⚠️  Bot is not running. Starting bot...');
      try {
        await discordBotService.start();
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log('   ✅ Bot started');
      } catch (error: any) {
        console.log(`   ❌ Could not start bot: ${error.message}`);
        console.log('   ℹ️  You may need to check DISCORD_BOT_TOKEN in .env');
      }
    } else {
      console.log('   ✅ Bot is running');
    }

    // Check bot guild access
    const botClient = discordBotService.getClient();
    if (botClient) {
      const botGuilds = Array.from(botClient.guilds.cache.values());
      console.log(`\n   🤖 Bot is in ${botGuilds.length} Discord server(s):`);
      botGuilds.forEach(guild => {
        console.log(`      - ${guild.name} (${guild.id}) - ${guild.memberCount} members`);
      });

      // Check if bot has access to user's connected guilds
      console.log('\n   🔍 Checking bot access to connected guilds:');
      allConnections.forEach((conn, i) => {
        if (conn.discordGuildId) {
          const hasAccess = botClient.guilds.cache.has(conn.discordGuildId);
          console.log(`      Connection ${i + 1} (${conn.discordGuildName}): ${hasAccess ? '✅ Accessible' : '❌ Not accessible'}`);
        }
      });
    } else {
      console.log('   ⚠️  Bot client not available');
    }

    // Test disconnect (if user wants)
    console.log('\n\n5️⃣  Testing Disconnect Fix');
    console.log('   ' + '='.repeat(55));
    console.log('\n   To test the disconnect fix manually:');
    console.log('\n   1. Go to Whop UI → Settings → Integrations → Discord');
    console.log('   2. Click "Disconnect"');
    console.log('   3. Run this script again to verify data was cleared');
    console.log('\n   Expected after disconnect:');
    console.log('      - isActive: false');
    console.log('      - discordGuildId: null/undefined');
    console.log('      - discordGuildName: null/undefined');
    console.log('      - accessToken: null/undefined');
    console.log('      - refreshToken: null/undefined');

    console.log('\n\n6️⃣  Testing Reconnect Fix');
    console.log('   ' + '='.repeat(55));
    console.log('\n   To test the reconnect fix:');
    console.log('\n   1. Disconnect from Discord (if not already)');
    console.log('   2. Go to Whop UI → Settings → Integrations → Discord');
    console.log('   3. Click "Connect Discord"');
    console.log('   4. Select a DIFFERENT server than before');
    console.log('   5. Check logs for:');
    console.log('      🔄 Updating existing Discord connection');
    console.log('      Previous Guild: [old server]');
    console.log('      New Guild: [new server]');
    console.log('   6. Run this script again to verify new server is saved');

    console.log('\n\n7️⃣  Testing Member Sync');
    console.log('   ' + '='.repeat(55));
    console.log('\n   To test member sync with new server:');
    console.log('\n   1. After reconnecting to new server');
    console.log('   2. Go to Whop UI → Leads → Sync Discord Members');
    console.log('   3. Check logs for:');
    console.log('      🔄 Starting Discord member sync');
    console.log('      Guild Name: [new server]');
    console.log('      ✅ Bot has access to guild');
    console.log('   4. Verify members are synced from NEW server, not old');

    console.log('\n\n✅ TEST CHECKLIST\n');
    console.log('   Step 1: Run this script (DONE ✅)');
    console.log('   Step 2: Note current guild name: ' + (allConnections[0]?.discordGuildName || 'None'));
    console.log('   Step 3: Disconnect in UI (TODO)');
    console.log('   Step 4: Run script again, verify data cleared (TODO)');
    console.log('   Step 5: Reconnect to DIFFERENT server in UI (TODO)');
    console.log('   Step 6: Run script again, verify NEW server saved (TODO)');
    console.log('   Step 7: Sync members, verify from NEW server (TODO)');

    console.log('\n📋 Debug Endpoint Available:');
    console.log('   GET /api/v1/integrations/discord/debug');
    console.log('   Use this endpoint to see complete connection state\n');

  } catch (error: any) {
    console.error('\n❌ Test failed\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run test
testReconnectFix()
  .then(() => {
    console.log('Test completed. Exiting...\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
