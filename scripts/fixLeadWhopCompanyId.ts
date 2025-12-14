import { config } from 'dotenv';
import mongoose from 'mongoose';
import { Lead } from '../src/models/Lead.js';
import { User } from '../src/models/User.js';

config();

async function fixLeadWhopCompanyId() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(80));
    console.log('\n🔧 Fixing Leads Missing whopCompanyId\n');
    console.log('='.repeat(80));

    // Get all users with whopCompanyId
    const users = await User.find({ whopCompanyId: { $exists: true, $ne: null } }).lean();
    console.log(`\n👥 Found ${users.length} users with whopCompanyId\n`);

    let totalFixed = 0;

    for (const user of users) {
      console.log(`\n👤 Processing user: ${user.name} (${user.email})`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Whop Company: ${user.whopCompanyId}`);

      // Find leads for this user that are missing whopCompanyId
      const leadsToFix = await Lead.find({
        userId: user._id.toString(),
        $or: [
          { whopCompanyId: { $exists: false } },
          { whopCompanyId: null },
          { whopCompanyId: '' }
        ]
      });

      if (leadsToFix.length === 0) {
        console.log(`   ✓ No leads need fixing`);
        continue;
      }

      console.log(`   🔧 Found ${leadsToFix.length} leads missing whopCompanyId`);

      for (const lead of leadsToFix) {
        console.log(`      - Fixing lead: ${lead.name} (${lead._id})`);
        lead.whopCompanyId = user.whopCompanyId;
        await lead.save();
        totalFixed++;
      }

      console.log(`   ✅ Fixed ${leadsToFix.length} leads for this user`);
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Done! Fixed ${totalFixed} leads in total\n`);
    console.log('='.repeat(80));

    // Verify the fix
    console.log('\n📊 Verification:\n');
    
    for (const user of users) {
      const userLeads = await Lead.find({ 
        userId: user._id.toString(),
        whopCompanyId: user.whopCompanyId 
      }).lean();
      
      console.log(`👤 ${user.name}: ${userLeads.length} leads with correct whopCompanyId`);
      if (userLeads.length > 0) {
        userLeads.forEach(lead => {
          console.log(`   ✓ ${lead.name} - ${lead.source} - ${lead.status}`);
        });
      }
    }

    console.log('\n✅ Verification complete!\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixLeadWhopCompanyId();
