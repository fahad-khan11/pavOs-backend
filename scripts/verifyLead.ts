import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Lead } from '../src/models/index.js';

dotenv.config();

async function verify() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const lead = await Lead.findById('695811511a18e59352f273a6');
  console.log('✅ Updated Lead:', {
    name: lead?.name,
    whopCustomerId: (lead as any)?.whopCustomerId,
    source: lead?.source,
  });
  await mongoose.disconnect();
}

verify();
