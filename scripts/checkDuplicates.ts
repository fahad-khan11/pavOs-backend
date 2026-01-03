import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

async function checkDuplicates() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');

    const collection = db.collection('leads');

    // Find all leads with null discordUserId for this company
    const leads = await collection
      .find({
        whopCompanyId: 'biz_9CBBQph398IKfd',
        discordUserId: null,
      })
      .toArray();

    console.log(`\n🔍 Found ${leads.length} leads with null discordUserId for company biz_9CBBQph398IKfd:\n`);

    leads.forEach((lead, index) => {
      console.log(`${index + 1}. Lead ID: ${lead._id}`);
      console.log(`   Name: ${lead.name}`);
      console.log(`   Source: ${lead.source}`);
      console.log(`   Status: ${lead.status}`);
      console.log(`   WhopMembershipId: ${lead.whopMembershipId || 'null'}`);
      console.log(`   WhopCustomerId: ${lead.whopCustomerId || 'null'}`);
      console.log(`   DiscordUserId: ${lead.discordUserId || 'null'}`);
      console.log(`   Created: ${lead.createdAt}`);
      console.log('');
    });

    if (leads.length > 1) {
      console.log('❌ PROBLEM: Multiple leads with the same (whopCompanyId + discordUserId=null)!');
      console.log('');
      console.log('💡 SOLUTION: You need to:');
      console.log('   1. Delete duplicate leads (keep only one)');
      console.log('   2. OR add a unique identifier (like whopMembershipId) to the index');
      console.log('');
      console.log('🛠️  Suggested fix: Use whopMembershipId instead of discordUserId for Whop leads');
    } else if (leads.length === 1) {
      console.log('✅ Only one lead found - this is correct!');
      console.log('');
      console.log('🤔 If you\'re still getting duplicate errors, the issue is:');
      console.log('   - Your code is trying to INSERT instead of UPDATE');
      console.log('   - Check: Does the webhook handler check for existing lead first?');
    } else {
      console.log('✅ No leads found with null discordUserId');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDuplicates();
