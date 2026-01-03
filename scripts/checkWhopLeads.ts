import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

async function checkWhopLeads() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all Whop leads
    const whopLeads = await Lead.find({
      source: 'whop',
      whopCompanyId: 'biz_9CBBQph398IKfd',
    });

    console.log(`📊 Found ${whopLeads.length} Whop leads:\n`);

    whopLeads.forEach((lead: any, index) => {
      console.log(`${index + 1}. ${lead.name}`);
      console.log(`   ID: ${lead._id}`);
      console.log(`   Source: ${lead.source}`);
      console.log(`   Whop Customer ID: ${lead.whopCustomerId || 'null'}`);
      console.log(`   Whop Membership ID: ${lead.whopMembershipId || 'null'}`);
      console.log(`   Support Channel ID: ${lead.whopSupportChannelId || 'null'}`);
      console.log(`   Created: ${lead.createdAt}`);
      console.log('');
    });

    console.log('💡 To test messaging:');
    console.log('1. Trigger Whop webhook to create a new lead');
    console.log('2. Or message an existing Whop lead in the UI');
    console.log('3. Watch for "🧪 Mock support channel created" in logs\n');

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkWhopLeads();
