/**
 * Migration Script: Whop-Only Application Refactoring
 * 
 * This script migrates existing data to the new Whop-only architecture:
 * 1. Identifies users without Whop identifiers
 * 2. Populates whopCompanyId on all existing records
 * 3. Archives or deletes non-Whop users
 * 4. Validates data integrity
 * 
 * ⚠️ WARNING: This is a DESTRUCTIVE migration. Backup database first!
 * 
 * Usage:
 *   npx tsx scripts/migrateToWhopOnly.ts --dry-run    # Preview changes
 *   npx tsx scripts/migrateToWhopOnly.ts --execute    # Execute migration
 */

import { config } from 'dotenv';
import mongoose from 'mongoose';
import { User, Contact, Deal, Lead, DiscordMessage, Activity } from '../src/models/index.js';

config();

interface MigrationStats {
  usersWithWhop: number;
  usersWithoutWhop: number;
  contactsMigrated: number;
  dealsMigrated: number;
  leadsMigrated: number;
  messagesMigrated: number;
  activitiesMigrated: number;
  usersArchived: number;
  orphanedRecordsDeleted: number;
}

const stats: MigrationStats = {
  usersWithWhop: 0,
  usersWithoutWhop: 0,
  contactsMigrated: 0,
  dealsMigrated: 0,
  leadsMigrated: 0,
  messagesMigrated: 0,
  activitiesMigrated: 0,
  usersArchived: 0,
  orphanedRecordsDeleted: 0,
};

async function migrateToWhopOnly(dryRun: boolean = true) {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔄 WHOP-ONLY APPLICATION MIGRATION');
    console.log('='.repeat(80));
    console.log(`\nMode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚡ EXECUTE (changes will be applied)'}`);
    console.log('\n');

    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Analyze users
    console.log('📊 Step 1: Analyzing users...\n');
    const allUsers = await User.find({});
    const usersWithWhop = allUsers.filter(u => u.whopUserId && u.whopCompanyId);
    const usersWithoutWhop = allUsers.filter(u => !u.whopUserId || !u.whopCompanyId);

    stats.usersWithWhop = usersWithWhop.length;
    stats.usersWithoutWhop = usersWithoutWhop.length;

    console.log(`   Total users: ${allUsers.length}`);
    console.log(`   ✅ With Whop identifiers: ${usersWithWhop.length}`);
    console.log(`   ❌ Without Whop identifiers: ${usersWithoutWhop.length}\n`);

    if (usersWithoutWhop.length > 0) {
      console.log('   Users without Whop identifiers:');
      usersWithoutWhop.forEach(user => {
        console.log(`      - ${user.email} (ID: ${user._id})`);
        console.log(`        Created: ${user.createdAt}`);
        console.log(`        Google ID: ${user.googleId || 'N/A'}`);
        console.log(`        Has password: ${user.password ? 'Yes' : 'No'}\n`);
      });
    }

    // Step 2: Migrate Contact records
    console.log('📦 Step 2: Migrating Contact records...\n');
    for (const user of usersWithWhop) {
      const userId = user._id.toString();
      const whopCompanyId = user.whopCompanyId!;

      // Find contacts missing whopCompanyId
      const contacts = await Contact.find({
        userId,
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      if (contacts.length > 0) {
        console.log(`   User: ${user.email} (${whopCompanyId})`);
        console.log(`   Contacts to migrate: ${contacts.length}`);

        if (!dryRun) {
          await Contact.updateMany(
            {
              userId,
              $or: [
                { whopCompanyId: { $exists: false } },
                { whopCompanyId: null },
                { whopCompanyId: '' }
              ]
            },
            { $set: { whopCompanyId } }
          );
        }

        stats.contactsMigrated += contacts.length;
      }
    }
    console.log(`   ✅ Total contacts migrated: ${stats.contactsMigrated}\n`);

    // Step 3: Migrate Deal records
    console.log('💼 Step 3: Migrating Deal records...\n');
    for (const user of usersWithWhop) {
      const userId = user._id.toString();
      const whopCompanyId = user.whopCompanyId!;

      const deals = await Deal.find({
        creatorId: userId,
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      if (deals.length > 0) {
        console.log(`   User: ${user.email} (${whopCompanyId})`);
        console.log(`   Deals to migrate: ${deals.length}`);

        if (!dryRun) {
          await Deal.updateMany(
            {
              creatorId: userId,
              $or: [
                { whopCompanyId: { $exists: false } },
                { whopCompanyId: null },
                { whopCompanyId: '' }
              ]
            },
            { $set: { whopCompanyId } }
          );
        }

        stats.dealsMigrated += deals.length;
      }
    }
    console.log(`   ✅ Total deals migrated: ${stats.dealsMigrated}\n`);

    // Step 4: Migrate Lead records
    console.log('🎯 Step 4: Migrating Lead records...\n');
    for (const user of usersWithWhop) {
      const userId = user._id.toString();
      const whopCompanyId = user.whopCompanyId!;

      const leads = await Lead.find({
        userId,
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      if (leads.length > 0) {
        console.log(`   User: ${user.email} (${whopCompanyId})`);
        console.log(`   Leads to migrate: ${leads.length}`);

        if (!dryRun) {
          await Lead.updateMany(
            {
              userId,
              $or: [
                { whopCompanyId: { $exists: false } },
                { whopCompanyId: null },
                { whopCompanyId: '' }
              ]
            },
            { $set: { whopCompanyId } }
          );
        }

        stats.leadsMigrated += leads.length;
      }
    }
    console.log(`   ✅ Total leads migrated: ${stats.leadsMigrated}\n`);

    // Step 5: Migrate DiscordMessage records
    console.log('💬 Step 5: Migrating DiscordMessage records...\n');
    for (const user of usersWithWhop) {
      const userId = user._id.toString();
      const whopCompanyId = user.whopCompanyId!;

      const messages = await DiscordMessage.find({
        userId,
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      if (messages.length > 0) {
        console.log(`   User: ${user.email} (${whopCompanyId})`);
        console.log(`   Messages to migrate: ${messages.length}`);

        if (!dryRun) {
          await DiscordMessage.updateMany(
            {
              userId,
              $or: [
                { whopCompanyId: { $exists: false } },
                { whopCompanyId: null },
                { whopCompanyId: '' }
              ]
            },
            { $set: { whopCompanyId } }
          );
        }

        stats.messagesMigrated += messages.length;
      }
    }
    console.log(`   ✅ Total messages migrated: ${stats.messagesMigrated}\n`);

    // Step 6: Handle users without Whop identifiers
    console.log('🗑️  Step 6: Handling non-Whop users...\n');
    if (usersWithoutWhop.length > 0) {
      console.log(`   Found ${usersWithoutWhop.length} users without Whop identifiers`);
      console.log('   These users will be DELETED (they cannot access the Whop-only app)\n');

      for (const user of usersWithoutWhop) {
        const userId = user._id.toString();
        console.log(`   User: ${user.email}`);

        // Count orphaned records
        const userContacts = await Contact.countDocuments({ userId });
        const userDeals = await Deal.countDocuments({ creatorId: userId });
        const userLeads = await Lead.countDocuments({ userId });
        const userMessages = await DiscordMessage.countDocuments({ userId });

        console.log(`      Contacts: ${userContacts}`);
        console.log(`      Deals: ${userDeals}`);
        console.log(`      Leads: ${userLeads}`);
        console.log(`      Messages: ${userMessages}`);

        if (!dryRun) {
          // Delete all associated records
          await Contact.deleteMany({ userId });
          await Deal.deleteMany({ creatorId: userId });
          await Lead.deleteMany({ userId });
          await DiscordMessage.deleteMany({ userId });
          await Activity.deleteMany({ userId });

          // Delete the user
          await User.findByIdAndDelete(user._id);
        }

        stats.usersArchived++;
        stats.orphanedRecordsDeleted += userContacts + userDeals + userLeads + userMessages;
      }
      console.log(`   ✅ Total users deleted: ${stats.usersArchived}`);
      console.log(`   ✅ Total orphaned records deleted: ${stats.orphanedRecordsDeleted}\n`);
    }

    // Step 7: Validation
    console.log('✅ Step 7: Validation...\n');
    if (!dryRun) {
      const contactsWithoutCompany = await Contact.countDocuments({
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      const dealsWithoutCompany = await Deal.countDocuments({
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      const leadsWithoutCompany = await Lead.countDocuments({
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      const messagesWithoutCompany = await DiscordMessage.countDocuments({
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      console.log('   Validation Results:');
      console.log(`      Contacts without whopCompanyId: ${contactsWithoutCompany} ${contactsWithoutCompany === 0 ? '✅' : '❌'}`);
      console.log(`      Deals without whopCompanyId: ${dealsWithoutCompany} ${dealsWithoutCompany === 0 ? '✅' : '❌'}`);
      console.log(`      Leads without whopCompanyId: ${leadsWithoutCompany} ${leadsWithoutCompany === 0 ? '✅' : '❌'}`);
      console.log(`      Messages without whopCompanyId: ${messagesWithoutCompany} ${messagesWithoutCompany === 0 ? '✅' : '❌'}\n`);

      if (contactsWithoutCompany + dealsWithoutCompany + leadsWithoutCompany + messagesWithoutCompany === 0) {
        console.log('   ✅ All records have whopCompanyId!\n');
      } else {
        console.log('   ⚠️  WARNING: Some records still missing whopCompanyId\n');
      }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`\nMode: ${dryRun ? 'DRY RUN' : 'EXECUTED'}\n`);
    console.log(`Users with Whop: ${stats.usersWithWhop}`);
    console.log(`Users without Whop (deleted): ${stats.usersArchived}`);
    console.log(`\nRecords Migrated:`);
    console.log(`   Contacts: ${stats.contactsMigrated}`);
    console.log(`   Deals: ${stats.dealsMigrated}`);
    console.log(`   Leads: ${stats.leadsMigrated}`);
    console.log(`   Messages: ${stats.messagesMigrated}`);
    console.log(`\nOrphaned records deleted: ${stats.orphanedRecordsDeleted}`);
    console.log('\n' + '='.repeat(80));

    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN. No changes were made to the database.');
      console.log('To execute the migration, run: npx tsx scripts/migrateToWhopOnly.ts --execute\n');
    } else {
      console.log('\n✅ Migration complete!\n');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

if (!dryRun) {
  console.log('\n⚠️  WARNING: You are about to execute a DESTRUCTIVE migration!');
  console.log('This will:');
  console.log('  - Delete all users without Whop identifiers');
  console.log('  - Delete all their associated records');
  console.log('  - Make whopCompanyId required on all models\n');
  console.log('Make sure you have a database backup!\n');
  console.log('Press Ctrl+C now to cancel, or wait 5 seconds to continue...\n');

  setTimeout(() => {
    migrateToWhopOnly(false);
  }, 5000);
} else {
  migrateToWhopOnly(true);
}
