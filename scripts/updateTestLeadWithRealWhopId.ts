import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/index.js';

// Load environment variables
dotenv.config();

/**
 * Update the test lead with your real Whop user ID
 * This allows you to test Whop messaging with a real user that exists in Whop's system
 */
async function updateTestLead() {
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
    const TEST_LEAD_ID = '695811511a18e59352f273a6';

    // Find and update the test lead
    const lead = await Lead.findById(TEST_LEAD_ID);

    if (!lead) {
      console.log('❌ Test lead not found');
      process.exit(1);
    }

    console.log(`📝 Current lead data:`);
    console.log(`   Name: ${lead.name}`);
    console.log(`   WhopCustomerId: ${(lead as any).whopCustomerId}`);
    console.log(`   Source: ${lead.source}`);

    // Update with real Whop user ID
    (lead as any).whopCustomerId = REAL_WHOP_USER_ID;
    lead.name = 'Test User (Real Whop ID)'; // Update name to indicate it's for testing
    lead.email = 'test@example.com';
    
    await lead.save();

    console.log(`\n✅ Test lead updated successfully!`);
    console.log(`   New WhopCustomerId: ${REAL_WHOP_USER_ID}`);
    console.log(`   You can now test Whop messaging with this lead`);
    console.log(`\n📌 Note: This uses YOUR real Whop user ID, so you'll receive the test messages!`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

updateTestLead();
