import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/Lead.js';

dotenv.config();

async function checkManualLead() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    const leadId = '6940ed28871841ed72ff8100';
    const lead = await Lead.findById(leadId).lean();

    if (!lead) {
      console.log('❌ Lead not found!');
    } else {
      console.log('✅ Lead found:');
      console.log(`   ID: ${lead._id}`);
      console.log(`   Name: ${lead.name}`);
      console.log(`   Email: ${lead.email}`);
      console.log(`   Phone: ${lead.phone}`);
      console.log(`   Discord: ${lead.discordUsername || 'none'}`);
      console.log(`   Source: ${lead.source}`);
      console.log(`   UserId: ${lead.userId}`);
      console.log(`   WhopCompanyId: ${lead.whopCompanyId || 'NONE ❌'}`);
      console.log(`   Created: ${lead.createdAt}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkManualLead();
