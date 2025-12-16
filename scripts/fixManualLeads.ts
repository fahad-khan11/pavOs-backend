import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';
import { User } from '../src/models/User.js';

dotenv.config();

async function fixManualLeads() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    // Find all leads without whopCompanyId
    const leadsWithoutCompany = await Lead.find({
      $or: [
        { whopCompanyId: { $exists: false } },
        { whopCompanyId: null }
      ]
    }).lean();

    console.log(`Found ${leadsWithoutCompany.length} leads without whopCompanyId\n`);

    let fixedCount = 0;

    for (const lead of leadsWithoutCompany) {
      // Get the user who owns this lead
      const user = await User.findById(lead.userId);
      
      if (!user) {
        console.log(`⚠️  Lead ${lead._id} has invalid userId: ${lead.userId}`);
        continue;
      }

      if (!user.whopCompanyId) {
        console.log(`⚠️  User ${user.email} doesn't have whopCompanyId, skipping lead ${lead._id}`);
        continue;
      }

      console.log(`🔧 Fixing lead: ${lead.name || lead._id}`);
      console.log(`   User: ${user.email}`);
      console.log(`   Adding whopCompanyId: ${user.whopCompanyId}`);

      // Update the lead with whopCompanyId
      await Lead.updateOne(
        { _id: lead._id },
        { $set: { whopCompanyId: user.whopCompanyId } }
      );

      fixedCount++;
    }

    console.log(`\n✅ Fixed ${fixedCount} leads`);
    console.log(`⏭️  Skipped ${leadsWithoutCompany.length - fixedCount} leads`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

fixManualLeads();
