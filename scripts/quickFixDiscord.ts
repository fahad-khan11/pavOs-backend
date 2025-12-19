import { config } from 'dotenv';
import mongoose from 'mongoose';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { Lead } from '../src/models/Lead.js';
import { Client, GatewayIntentBits } from 'discord.js';

config();

async function quickFix() {
  try {
    console.log('\n🔧 Quick Discord Fix\n');
    
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Get active Discord connection
    const connection = await DiscordConnection.findOne({ isActive: true });
    
    if (!connection) {
      console.log('❌ No active Discord connection found');
      await mongoose.disconnect();
      return;
    }

    console.log('📋 Current Connection:');
    console.log(`   User ID: ${connection.userId}`);
    console.log(`   Guild: ${connection.discordGuildName}`);
    console.log(`   Guild ID: ${connection.discordGuildId}\n`);

    // Connect Discord bot to check access
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });

    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('✅ Bot logged in\n');

    // Check if bot has access to the guild
    const hasAccess = client.guilds.cache.has(connection.discordGuildId);
    
    if (!hasAccess) {
      console.log('❌ PROBLEM: Bot does NOT have access to this server!');
      console.log('\n🔧 FIX: Updating to a server where bot HAS access...\n');
      
      console.log('Available servers:');
      const guilds = Array.from(client.guilds.cache.values());
      guilds.forEach((g, i) => {
        console.log(`   ${i + 1}. ${g.name} (${g.id}) - ${g.memberCount} members`);
      });

      if (guilds.length > 0) {
        // Use first available guild
        const newGuild = guilds[0];
        connection.discordGuildId = newGuild.id;
        connection.discordGuildName = newGuild.name;
        connection.syncedMembersCount = 0;
        connection.lastSyncAt = undefined;
        await connection.save();
        
        console.log(`\n✅ Updated connection to: ${newGuild.name}`);
        console.log(`   Guild ID: ${newGuild.id}\n`);
      }
    } else {
      console.log('✅ Bot has access to this server!\n');
    }

    // Check for duplicate leads
    console.log('🔍 Checking for duplicate leads...\n');
    const allLeads = await Lead.find({ userId: connection.userId });
    console.log(`Total leads: ${allLeads.length}`);

    // Group by discordUserId
    const leadsByDiscordUser = new Map<string, any[]>();
    allLeads.forEach(lead => {
      if (lead.discordUserId) {
        const existing = leadsByDiscordUser.get(lead.discordUserId) || [];
        existing.push(lead);
        leadsByDiscordUser.set(lead.discordUserId, existing);
      }
    });

    // Find duplicates
    let duplicatesFound = 0;
    for (const [discordUserId, leads] of leadsByDiscordUser.entries()) {
      if (leads.length > 1) {
        console.log(`\n⚠️  Duplicate leads for Discord user: ${leads[0].discordUsername}`);
        console.log(`   Found ${leads.length} copies:`);
        
        // Keep the oldest, delete the rest
        leads.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const keep = leads[0];
        const toDelete = leads.slice(1);
        
        console.log(`   ✓ Keeping: ${keep._id} (created ${keep.createdAt})`);
        for (const dup of toDelete) {
          console.log(`   ✗ Deleting: ${dup._id} (created ${dup.createdAt})`);
          await Lead.deleteOne({ _id: dup._id });
          duplicatesFound++;
        }
      }
    }

    if (duplicatesFound > 0) {
      console.log(`\n✅ Removed ${duplicatesFound} duplicate leads\n`);
    } else {
      console.log('\n✅ No duplicate leads found\n');
    }

    await mongoose.disconnect();
    client.destroy();
    
    console.log('='.repeat(60));
    console.log('\n✅ Fix complete!\n');
    console.log('Next steps:');
    console.log('1. Restart your backend server');
    console.log('2. Refresh your browser');
    console.log('3. Click "Sync Members" to import leads\n');
    
  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

quickFix();
