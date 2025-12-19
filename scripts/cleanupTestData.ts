#!/usr/bin/env node
/**
 * Cleanup Test Thread Data
 * 
 * This script removes test data created during thread implementation testing:
 * - Deletes test lead
 * - Removes thread mapping from database
 * - Deletes associated messages
 * - Optionally archives thread in Discord
 */

import dotenv from 'dotenv';
import { connect } from '../src/config/database.js';
import { discordBotService } from '../src/services/discordBotService.js';
import { archiveLeadChannel } from '../src/services/discordChannelService.js';
import { Lead, DiscordLeadChannel, DiscordMessage } from '../src/models/index.js';

dotenv.config();

async function cleanupTestData() {
  console.log('\n🧹 Cleaning up test thread data\n');
  console.log('='.repeat(60));

  try {
    // Get leadId from command line args
    const args = process.argv.slice(2);
    const leadIdArg = args.find(arg => arg.startsWith('--leadId='));
    
    let leadId: string | null = null;
    
    if (leadIdArg) {
      leadId = leadIdArg.split('=')[1];
      console.log(`\n📋 Cleaning up specific lead: ${leadId}\n`);
    } else {
      console.log('\n🔍 Finding test leads...\n');
      // Find all test leads
      await connect();
      const testLeads = await Lead.find({
        tags: { $in: ['test', 'thread-implementation'] }
      });
      
      if (testLeads.length === 0) {
        console.log('   ℹ️  No test leads found');
        return;
      }
      
      console.log(`   Found ${testLeads.length} test lead(s):\n`);
      testLeads.forEach((lead, i) => {
        console.log(`   ${i + 1}. ${lead.name} (${lead.email}) - ID: ${lead._id}`);
      });
      
      if (testLeads.length === 1) {
        leadId = testLeads[0]._id.toString();
        console.log(`\n   ✅ Auto-selecting lead: ${leadId}\n`);
      } else {
        console.log('\n   ℹ️  Multiple test leads found. Please specify one:');
        console.log('   npm run cleanup-test-data -- --leadId=<lead-id>\n');
        return;
      }
    }
    
    if (!leadId) {
      console.log('   ❌ No lead ID provided or found\n');
      console.log('Usage:');
      console.log('  npm run cleanup-test-data -- --leadId=<lead-id>\n');
      return;
    }

    // Connect to database
    await connect();
    
    // 1. Get lead details
    console.log('1️⃣  Finding lead...');
    const lead = await Lead.findById(leadId);
    if (!lead) {
      console.log(`   ⚠️  Lead ${leadId} not found (may already be deleted)`);
    } else {
      console.log(`   ✅ Found lead: ${lead.name} (${lead.email})`);
    }

    // 2. Get thread mapping
    console.log('\n2️⃣  Finding thread mapping...');
    const leadChannel = await DiscordLeadChannel.findOne({
      leadId,
      isActive: true,
    });
    
    if (!leadChannel) {
      console.log('   ⚠️  No active thread mapping found (may already be deleted)');
    } else {
      console.log(`   ✅ Found thread: ${leadChannel.discordChannelName}`);
      console.log(`   🆔 Thread ID: ${leadChannel.discordChannelId}`);
      
      // 3. Archive thread in Discord (optional)
      const shouldArchiveInDiscord = args.includes('--archive-discord');
      if (shouldArchiveInDiscord) {
        console.log('\n3️⃣  Archiving thread in Discord...');
        try {
          if (!discordBotService.isActive()) {
            await discordBotService.start();
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
          const client = discordBotService.getClient();
          if (client) {
            await archiveLeadChannel(leadId, 'Test cleanup', client);
            console.log('   ✅ Thread archived in Discord');
          } else {
            console.log('   ⚠️  Discord client not available, skipping Discord archive');
          }
        } catch (error: any) {
          console.log(`   ⚠️  Could not archive in Discord: ${error.message}`);
        }
      } else {
        console.log('\n3️⃣  Skipping Discord archive (add --archive-discord to archive)');
      }
    }

    // 4. Delete messages
    console.log('\n4️⃣  Deleting messages...');
    const deletedMessages = await DiscordMessage.deleteMany({ leadId });
    console.log(`   ✅ Deleted ${deletedMessages.deletedCount} message(s)`);

    // 5. Delete thread mapping
    console.log('\n5️⃣  Deleting thread mapping...');
    const deletedChannels = await DiscordLeadChannel.deleteMany({ leadId });
    console.log(`   ✅ Deleted ${deletedChannels.deletedCount} thread mapping(s)`);

    // 6. Delete lead
    console.log('\n6️⃣  Deleting lead...');
    const deletedLead = await Lead.findByIdAndDelete(leadId);
    if (deletedLead) {
      console.log(`   ✅ Deleted lead: ${deletedLead.name}`);
    } else {
      console.log('   ⚠️  Lead not found (may already be deleted)');
    }

    console.log('\n✅ CLEANUP COMPLETE\n');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log(`   ✅ Messages deleted: ${deletedMessages.deletedCount}`);
    console.log(`   ✅ Thread mappings deleted: ${deletedChannels.deletedCount}`);
    console.log(`   ✅ Lead deleted: ${deletedLead ? 'Yes' : 'Already gone'}`);
    
    if (leadChannel && !shouldArchiveInDiscord) {
      console.log('\n💡 Note: Thread still exists in Discord');
      console.log(`   Thread ID: ${leadChannel.discordChannelId}`);
      console.log('   To archive it, re-run with --archive-discord flag\n');
    }

  } catch (error: any) {
    console.error('\n❌ CLEANUP FAILED\n');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run cleanup
cleanupTestData()
  .then(() => {
    console.log('Cleanup completed. Exiting...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
