import { config } from 'dotenv';
import mongoose from 'mongoose';
import { Lead } from '../src/models/Lead.js';
import { User } from '../src/models/User.js';

config();

async function analyzeMultiTenantIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('\n✅ Connected to MongoDB\n');
    console.log('='.repeat(80));
    console.log('\n🔍 MULTI-TENANT SECURITY ANALYSIS\n');
    console.log('='.repeat(80));

    // Get all users
    const users = await User.find({}).lean();
    console.log(`\n👥 Total Users: ${users.length}\n`);

    // Get all leads
    const allLeads = await Lead.find({}).lean();
    console.log(`📊 Total Leads: ${allLeads.length}\n`);

    console.log('='.repeat(80));
    console.log('\n📋 DETAILED BREAKDOWN:\n');

    for (const user of users) {
      console.log(`\n👤 USER: ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   User ID: ${user._id}`);
      console.log(`   Whop Company ID: ${user.whopCompanyId || 'NONE ⚠️'}`);
      console.log(`   Whop User ID: ${user.whopUserId || 'N/A'}`);

      // Count leads for this user
      const userLeads = allLeads.filter(lead => lead.userId?.toString() === user._id.toString());
      console.log(`\n   📊 Leads for this user: ${userLeads.length}`);

      if (userLeads.length > 0) {
        userLeads.forEach((lead, idx) => {
          console.log(`\n      Lead ${idx + 1}: ${lead.name}`);
          console.log(`         - Lead ID: ${lead._id}`);
          console.log(`         - userId: ${lead.userId}`);
          console.log(`         - whopCompanyId: ${lead.whopCompanyId || '❌ MISSING'}`);
          console.log(`         - Source: ${lead.source}`);
          console.log(`         - Status: ${lead.status}`);
          console.log(`         - Discord User: ${lead.discordUsername || 'N/A'}`);
          
          // Check if whopCompanyId matches
          if (user.whopCompanyId && lead.whopCompanyId !== user.whopCompanyId) {
            console.log(`         ⚠️  WARNING: Lead whopCompanyId doesn't match user!`);
            console.log(`             User: ${user.whopCompanyId}`);
            console.log(`             Lead: ${lead.whopCompanyId}`);
          } else if (user.whopCompanyId && lead.whopCompanyId === user.whopCompanyId) {
            console.log(`         ✅ whopCompanyId matches`);
          } else if (!lead.whopCompanyId) {
            console.log(`         ❌ Lead missing whopCompanyId (security issue!)`);
          }
        });
      }

      // Simulate API query
      console.log(`\n   🔍 API Query Simulation:`);
      const query: any = { userId: user._id.toString() };
      if (user.whopCompanyId) {
        query.whopCompanyId = user.whopCompanyId;
      }
      console.log(`      Query:`, JSON.stringify(query, null, 2));

      const apiResults = await Lead.find(query).lean();
      console.log(`      Results: ${apiResults.length} leads`);

      if (apiResults.length !== userLeads.length) {
        console.log(`      ⚠️  MISMATCH! Expected ${userLeads.length}, got ${apiResults.length}`);
        console.log(`      This means some leads are being filtered out due to missing whopCompanyId`);
      }

      console.log('\n' + '-'.repeat(80));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n🔒 SECURITY CHECK: Cross-Company Data Leaks\n');
    console.log('='.repeat(80));

    // Check for potential data leaks
    const companies = [...new Set(users.map(u => u.whopCompanyId).filter(Boolean))];
    console.log(`\n🏢 Unique Companies: ${companies.length}`);

    for (const companyId of companies) {
      console.log(`\n🏢 Company: ${companyId}`);
      
      const companyUsers = users.filter(u => u.whopCompanyId === companyId);
      console.log(`   Users in this company: ${companyUsers.length}`);
      companyUsers.forEach(u => console.log(`      - ${u.name} (${u.email})`));

      const companyLeads = allLeads.filter(l => l.whopCompanyId === companyId);
      console.log(`\n   Leads with this company ID: ${companyLeads.length}`);

      // Check if leads belong to users in this company
      for (const lead of companyLeads) {
        const leadOwner = companyUsers.find(u => u._id.toString() === lead.userId?.toString());
        if (!leadOwner) {
          console.log(`      ⚠️  WARNING: Lead "${lead.name}" (${lead._id}) has company ID but owner not in company!`);
          console.log(`         Lead userId: ${lead.userId}`);
        }
      }
    }

    // Check for leads without whopCompanyId
    const leadsWithoutCompany = allLeads.filter(l => !l.whopCompanyId);
    if (leadsWithoutCompany.length > 0) {
      console.log(`\n❌ SECURITY ISSUE: ${leadsWithoutCompany.length} leads missing whopCompanyId`);
      leadsWithoutCompany.forEach(lead => {
        const owner = users.find(u => u._id.toString() === lead.userId?.toString());
        console.log(`   - "${lead.name}" owned by ${owner?.name} (company: ${owner?.whopCompanyId || 'NONE'})`);
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Analysis Complete\n');

    await mongoose.disconnect();
  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

analyzeMultiTenantIssue();
