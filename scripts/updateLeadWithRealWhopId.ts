import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/index.js';

// Load environment variables
dotenv.config();

/**
 * Update a specific lead with your real Whop user ID
 * Usage: npx tsx scripts/updateLeadWithRealWhopId.ts <leadId>
 */
async function updateLead() {
  try {
    // Get lead ID from command line argument
    const leadId = process.argv[2];
    
    if (!leadId) {
      console.log('❌ Please provide a lead ID');
      console.log('Usage: npx tsx scripts/updateLeadWithRealWhopId.ts <leadId>');
      process.exit(1);
    }

    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI not found in environment variables');
    }

    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Your real Whop user ID (from auth logs)
    const REAL_WHOP_USER_ID = 'user_2xMmlLQ5kDrmi';

    // Find the lead
    const lead = await Lead.findById(leadId);

    if (!lead) {
      console.log(`❌ Lead not found: ${leadId}`);
      process.exit(1);
    }

    console.log(`\n📝 Current lead data:`);
    console.log(`   ID: ${lead._id}`);
    console.log(`   Name: ${lead.name}`);
    console.log(`   WhopCustomerId: ${(lead as any).whopCustomerId}`);
    console.log(`   Source: ${lead.source}`);

    // Update with real Whop user ID
    (lead as any).whopCustomerId = REAL_WHOP_USER_ID;
    
    await lead.save();

    console.log(`\n✅ Lead updated successfully!`);
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

updateLead();
