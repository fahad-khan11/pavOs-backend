#!/usr/bin/env node
/**
 * Fix Stale Discord Connections
 * 
 * This script identifies and fixes Discord connections that have stale guild data
 * (guild IDs that the bot no longer has access to).
 * 
 * Usage:
 *   npm run fix-stale-connections
 *   npm run fix-stale-connections -- --auto-fix
 */

import { DiscordConnection } from '../src/models/index.js';
import { discordBotService } from '../src/services/discordBotService.js';
import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

async function fixStaleConnections() {
  console.log('\n🔍 Checking for stale Discord connections\n');
  console.log('='.repeat(60));

  const autoFix = process.argv.includes('--auto-fix');
  
  try {
    // Connect to database
    console.log('\n1️⃣  Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('   ✅ Connected');

    // Start Discord bot
    console.log('\n2️⃣  Starting Discord bot...');
    if (!discordBotService.isActive()) {
      await discordBotService.start();
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    console.log('   ✅ Bot is active');

    const botClient = discordBotService.getClient();
    if (!botClient) {
      console.error('   ❌ Bot client not available');
      return;
    }

    const botGuilds = Array.from(botClient.guilds.cache.values());
    console.log(`\n   🤖 Bot is in ${botGuilds.length} server(s):`);
    botGuilds.forEach(guild => {
      console.log(`      - ${guild.name} (${guild.id})`);
    });

    // Get all active connections
    console.log('\n3️⃣  Checking active Discord connections...');
    const activeConnections = await DiscordConnection.find({ isActive: true });
    console.log(`   📊 Found ${activeConnections.length} active connection(s)`);

    if (activeConnections.length === 0) {
      console.log('\n   ℹ️  No active connections found');
      return;
    }

    // Check each connection
    let staleCount = 0;
    const staleConnections = [];

    for (const conn of activeConnections) {
      if (!conn.discordGuildId) {
        console.log(`\n   ⚠️  Connection ${conn._id}:`);
        console.log(`      User ID: ${conn.userId}`);
        console.log(`      Status: No guild ID set`);
        staleConnections.push(conn);
        staleCount++;
        continue;
      }

      const hasAccess = botClient.guilds.cache.has(conn.discordGuildId);
      
      if (!hasAccess) {
        console.log(`\n   ❌ STALE Connection ${conn._id}:`);
        console.log(`      User ID: ${conn.userId}`);
        console.log(`      Guild ID: ${conn.discordGuildId}`);
        console.log(`      Guild Name: ${conn.discordGuildName || 'Unknown'}`);
        console.log(`      Status: Bot no longer has access`);
        staleConnections.push(conn);
        staleCount++;
      } else {
        console.log(`\n   ✅ Valid Connection ${conn._id}:`);
        console.log(`      User ID: ${conn.userId}`);
        console.log(`      Guild: ${conn.discordGuildName} (${conn.discordGuildId})`);
        console.log(`      Status: Bot has access`);
      }
    }

    if (staleCount === 0) {
      console.log('\n✅ No stale connections found! All connections are valid.\n');
      return;
    }

    console.log(`\n\n⚠️  Found ${staleCount} stale connection(s)\n`);
    console.log('='.repeat(60));

    if (autoFix) {
      console.log('\n🔧 Auto-fix mode enabled. Cleaning stale connections...\n');
      
      for (const conn of staleConnections) {
        console.log(`   Fixing connection ${conn._id}...`);
        
        conn.isActive = false;
        conn.discordGuildId = undefined;
        conn.discordGuildName = undefined;
        conn.accessToken = undefined;
        conn.refreshToken = undefined;
        conn.lastSyncAt = undefined;
        conn.syncedMembersCount = 0;
        conn.syncedChannelsCount = 0;
        
        await conn.save();
        
        console.log(`   ✅ Cleaned connection ${conn._id}`);
      }
      
      console.log(`\n✅ Fixed ${staleCount} stale connection(s)\n`);
      console.log('📋 Next steps:');
      console.log('   1. Users should reconnect Discord via the UI');
      console.log('   2. Select a server that the bot is in');
      console.log('   3. Verify connection works\n');
      
    } else {
      console.log('\n💡 To fix these connections, run:\n');
      console.log('   npm run fix-stale-connections -- --auto-fix\n');
      console.log('Or manually:');
      console.log('   1. Ask users to disconnect Discord in the UI');
      console.log('   2. Ask users to reconnect to a valid server');
      console.log('   3. Make sure bot is invited to that server\n');
    }

    console.log('🔗 Bot invite link:');
    console.log(`   https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=${process.env.DISCORD_PERMISSIONS || '275415957504'}&scope=bot\n`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

// Run
fixStaleConnections()
  .then(() => {
    console.log('Done. Exiting...\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
