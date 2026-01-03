import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

/**
 * Update the test lead with fake Whop IDs to use your real Whop user ID
 * This allows you to test real messaging in Whop UI
 */
async function updateTestLeadToReal() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const FAKE_USER_ID = 'user_xxxxxxxxxxxxx';
    const REAL_USER_ID = 'user_2xMmlLQ5kDrmi'; // Your real Whop user ID
    const COMPANY_ID = 'biz_9CBBQph398IKfd';

    // Find the test lead
    const testLead = await Lead.findOne({
      whopCustomerId: FAKE_USER_ID,
      whopCompanyId: COMPANY_ID,
    });

    if (!testLead) {
      console.log('❌ No test lead found with fake user ID');
      console.log(`   Looking for: whopCustomerId=${FAKE_USER_ID}`);
      console.log(`   In company: ${COMPANY_ID}\n`);
      
      // Show all Whop leads
      const allWhopLeads = await Lead.find({
        source: 'whop',
        whopCompanyId: COMPANY_ID,
      });
      
      console.log(`📊 Found ${allWhopLeads.length} Whop leads in company:\n`);
      allWhopLeads.forEach((lead: any, index) => {
        console.log(`${index + 1}. ${lead.name}`);
        console.log(`   ID: ${lead._id}`);
        console.log(`   Customer ID: ${lead.whopCustomerId}`);
        console.log('');
      });
      
      await mongoose.disconnect();
      return;
    }

    console.log('🔍 Found test lead:\n');
    console.log(`   Name: ${(testLead as any).name}`);
    console.log(`   ID: ${testLead._id}`);
    console.log(`   Customer ID: ${(testLead as any).whopCustomerId} (FAKE)`);
    console.log(`   Membership ID: ${(testLead as any).whopMembershipId || 'null'}`);
    console.log(`   Support Channel: ${(testLead as any).whopSupportChannelId || 'null'}\n`);

    console.log('🔄 Updating to real Whop user ID...\n');

    // Update the lead
    (testLead as any).whopCustomerId = REAL_USER_ID;
    (testLead as any).name = 'Saad Mustafa (Real Test)'; // Update name to indicate it's real
    (testLead as any).whopSupportChannelId = null; // Reset channel ID so it creates a new one
    
    await testLead.save();

    console.log('✅ Lead updated successfully!\n');
    console.log('📝 New details:');
    console.log(`   Name: ${(testLead as any).name}`);
    console.log(`   Customer ID: ${(testLead as any).whopCustomerId} (REAL)`);
    console.log(`   Support Channel: Reset to null\n`);

    console.log('🎉 Now you can:');
    console.log('1. Go to your CRM UI');
    console.log('2. Find the lead: "Saad Mustafa (Real Test)"');
    console.log('3. Send a message');
    console.log('4. ✅ Message will appear in YOUR Whop account!');
    console.log('5. ✅ You can reply in Whop and it will sync back!\n');

    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateTestLeadToReal();
