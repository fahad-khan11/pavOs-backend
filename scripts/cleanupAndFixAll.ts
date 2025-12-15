import { config } from 'dotenv';
import mongoose from 'mongoose';
import { DiscordConnection } from '../src/models/DiscordConnection.js';
import { Lead } from '../src/models/Lead.js';
import { User } from '../src/models/User.js';
import { DiscordMessage } from '../src/models/DiscordMessage.js';
import { Client, GatewayIntentBits } from 'discord.js';

config();

async function cleanupAndFix() {
  try {
    console.log('\n🔧 Complete Cleanup & Fix Script\n');
    console.log('='.repeat(80));
    
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Connect Discord bot
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    });
    await client.login(process.env.DISCORD_BOT_TOKEN);
    console.log('✅ Discord bot connected\n');

    const botGuilds = new Set(Array.from(client.guilds.cache.keys()));
    console.log(`📡 Bot has access to ${botGuilds.size} servers\n`);

    // Step 1: Fix all Discord connections to use accessible guilds
    console.log('🔧 STEP 1: Fixing Discord Connections\n');
    console.log('='.repeat(80));
    
    const connections = await DiscordConnection.find({});
    console.log(`Found ${connections.length} Discord connections\n`);

    for (const conn of connections) {
      const user = await User.findById(conn.userId);
      if (!user) {
        console.log(`⚠️  Connection ${conn._id} - User ${conn.userId} not found, skipping`);
        continue;
      }

      console.log(`\n👤 User: ${user.name} (${user.email})`);
      console.log(`   Current Guild: ${conn.discordGuildName} (${conn.discordGuildId})`);
      
      const hasAccess = botGuilds.has(conn.discordGuildId);
      
      if (!hasAccess) {
        console.log(`   ❌ Bot DOES NOT have access to this guild!`);
        
        // Find first accessible guild
        const guilds = Array.from(client.guilds.cache.values());
        if (guilds.length > 0) {
          const newGuild = guilds[0];
          console.log(`   🔧 Updating to: ${newGuild.name} (${newGuild.id})`);
          
          conn.discordGuildId = newGuild.id;
          conn.discordGuildName = newGuild.name;
          conn.syncedMembersCount = 0;
          conn.lastSyncAt = undefined;
          await conn.save();
          
          console.log(`   ✅ Updated!`);
        } else {
          console.log(`   ⚠️  No accessible guilds found - deactivating connection`);
          conn.isActive = false;
          await conn.save();
        }
      } else {
        console.log(`   ✅ Guild is accessible - no changes needed`);
      }
    }

    // Step 2: Fix leads to ensure whopCompanyId is set
    console.log('\n\n🔧 STEP 2: Fixing Lead whopCompanyId\n');
    console.log('='.repeat(80));
    
    const users = await User.find({ whopCompanyId: { $exists: true, $ne: null } });
    let fixedLeads = 0;

    for (const user of users) {
      const leadsToFix = await Lead.find({
        userId: user._id.toString(),
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' },
        ],
      });

      if (leadsToFix.length > 0) {
        console.log(`\n👤 ${user.name}: Fixing ${leadsToFix.length} leads`);
        for (const lead of leadsToFix) {
          lead.whopCompanyId = user.whopCompanyId;
          await lead.save();
          fixedLeads++;
        }
      }
    }

    if (fixedLeads > 0) {
      console.log(`\n✅ Fixed ${fixedLeads} leads\n`);
    } else {
      console.log(`\n✅ All leads have correct whopCompanyId\n`);
    }

    // Step 3: Remove duplicate leads
    console.log('\n🔧 STEP 3: Removing Duplicate Leads\n');
    console.log('='.repeat(80));
    
    const allLeads = await Lead.find({});
    const leadsByUser = new Map<string, Map<string, any[]>>();

    // Group leads by userId and discordUserId
    for (const lead of allLeads) {
      const userIdStr = lead.userId?.toString() || '';
      if (!userIdStr) continue;

      if (!leadsByUser.has(userIdStr)) {
        leadsByUser.set(userIdStr, new Map());
      }

      const userLeads = leadsByUser.get(userIdStr)!;
      const discordUserId = lead.discordUserId || `email:${lead.email}`;
      
      if (!userLeads.has(discordUserId)) {
        userLeads.set(discordUserId, []);
      }
      
      userLeads.get(discordUserId)!.push(lead);
    }

    let duplicatesRemoved = 0;
    
    for (const [userId, userLeads] of leadsByUser.entries()) {
      for (const [discordUserId, leads] of userLeads.entries()) {
        if (leads.length > 1) {
          const user = await User.findById(userId);
          console.log(`\n⚠️  User ${user?.name}: Found ${leads.length} duplicate leads for ${leads[0].name}`);
          
          // Keep the oldest
          leads.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          const keep = leads[0];
          const toDelete = leads.slice(1);
          
          console.log(`   ✓ Keeping: ${keep._id}`);
          for (const dup of toDelete) {
            console.log(`   ✗ Deleting: ${dup._id}`);
            await Lead.deleteOne({ _id: dup._id });
            duplicatesRemoved++;
          }
        }
      }
    }

    if (duplicatesRemoved > 0) {
      console.log(`\n✅ Removed ${duplicatesRemoved} duplicate leads\n`);
    } else {
      console.log(`\n✅ No duplicate leads found\n`);
    }

    // Step 4: Summary
    console.log('\n📊 FINAL STATUS\n');
    console.log('='.repeat(80));
    
    for (const user of users) {
      const userLeads = await Lead.find({ 
        userId: user._id.toString(),
        whopCompanyId: user.whopCompanyId 
      });
      
      const connection = await DiscordConnection.findOne({ 
        userId: user._id.toString(),
        isActive: true 
      });
      
      console.log(`\n👤 ${user.name}`);
      console.log(`   Company: ${user.whopCompanyId}`);
      console.log(`   Discord: ${connection ? `✅ Connected to ${connection.discordGuildName}` : '❌ Not connected'}`);
      console.log(`   Leads: ${userLeads.length}`);
      
      if (userLeads.length > 0) {
        console.log(`   Leads breakdown:`);
        userLeads.forEach(l => {
          console.log(`      - ${l.name} (${l.source}, ${l.status})`);
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Cleanup Complete!\n');
    console.log('🚀 Next Steps:');
    console.log('   1. Restart your backend server');
    console.log('   2. Disconnect and reconnect Discord in the UI');
    console.log('   3. Click "Sync Members" to import leads');
    console.log('   4. Leads should now appear!\n');

    await mongoose.disconnect();
    client.destroy();
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

cleanupAndFix();
