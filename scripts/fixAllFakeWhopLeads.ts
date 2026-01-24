import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/index.js';

// Load environment variables
dotenv.config();

/**
 * Update ALL leads with fake Whop user IDs to use your real Whop user ID
 * This fixes all test leads created from webhook tests
 */
async function updateAllFakeLeads() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Your real Whop user ID (from auth logs)
    const REAL_WHOP_USER_ID = 'user_2xMmlLQ5kDrmi';
    const FAKE_USER_ID_PATTERN = /^user_x+$/; // Matches user_xxxxxxxxxxxxx

    // Find all leads with fake Whop user IDs
    const fakeLeads = await Lead.find({
      whopCustomerId: FAKE_USER_ID_PATTERN,
    });

    console.log(`\n🔍 Found ${fakeLeads.length} leads with fake Whop user IDs\n`);

    if (fakeLeads.length === 0) {
      console.log('✅ No fake leads found. All good!');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Update each lead
    let updated = 0;
    for (const lead of fakeLeads) {
      console.log(`📝 Updating lead: ${lead.name} (${lead._id})`);
      console.log(`   Old ID: ${(lead as any).whopCustomerId}`);
      
      (lead as any).whopCustomerId = REAL_WHOP_USER_ID;
      await lead.save();
      
      console.log(`   New ID: ${REAL_WHOP_USER_ID} ✅\n`);
      updated++;
    }

    console.log(`\n✅ Updated ${updated} leads successfully!`);
    console.log(`   All test leads now use your real Whop user ID`);
    console.log(`   You can test Whop messaging with any of them`);
    console.log(`\n📌 Note: Messages will be sent to YOUR Whop DMs`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

updateAllFakeLeads();
