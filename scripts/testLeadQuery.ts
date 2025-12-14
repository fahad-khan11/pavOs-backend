import { config } from 'dotenv';
import mongoose from 'mongoose';
import { Lead } from '../src/models/Lead.js';
import { User } from '../src/models/User.js';

config();

async function testLeadQuery() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(80));
    console.log('\n🧪 Testing Lead API Query Logic\n');
    console.log('='.repeat(80));

    const users = await User.find({ whopCompanyId: { $exists: true } }).lean();

    for (const user of users) {
      console.log(`\n\n👤 USER: ${user.name} (${user.email})`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Whop Company: ${user.whopCompanyId}\n`);

      // Simulate the API query from leadController.ts
      const userId = user._id.toString();
      const whopCompanyId = user.whopCompanyId;

      const query: any = { userId: String(userId) };
      
      if (whopCompanyId) {
        query.whopCompanyId = whopCompanyId;
      }

      console.log(`   🔍 API Query:`, JSON.stringify(query, null, 2));

      // Execute the query
      const leads = await Lead.find(query).lean();

      console.log(`\n   📊 Results: ${leads.length} leads found`);

      if (leads.length > 0) {
        console.log(`\n   ✅ LEADS:`);
        leads.forEach((lead, idx) => {
          console.log(`      ${idx + 1}. ${lead.name}`);
          console.log(`         - ID: ${lead._id}`);
          console.log(`         - Source: ${lead.source}`);
          console.log(`         - Status: ${lead.status}`);
          console.log(`         - userId: ${lead.userId}`);
          console.log(`         - whopCompanyId: ${lead.whopCompanyId || 'NONE'}`);
          console.log(`         - Discord: ${lead.discordUsername || 'N/A'}`);
        });
      } else {
        console.log(`   ❌ No leads found for this user`);
        
        // Debug: Check if leads exist without whopCompanyId filter
        const leadsWithoutCompanyFilter = await Lead.find({ userId: String(userId) }).lean();
        if (leadsWithoutCompanyFilter.length > 0) {
          console.log(`\n   ⚠️  Found ${leadsWithoutCompanyFilter.length} leads WITHOUT whopCompanyId filter:`);
          leadsWithoutCompanyFilter.forEach(lead => {
            console.log(`      - ${lead.name}: whopCompanyId = ${lead.whopCompanyId || 'MISSING'}`);
          });
        }
      }

      console.log('\n' + '-'.repeat(80));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Test Complete!\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

testLeadQuery();
