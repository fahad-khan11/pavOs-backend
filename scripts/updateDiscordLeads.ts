import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;

async function updateDiscordLeads() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');
    
    const usersCollection = db.collection('users');
    const leadsCollection = db.collection('leads');
    
    // Get all Discord leads without whopCompanyId
    const discordLeads = await leadsCollection.find({
      source: 'discord',
      whopCompanyId: { $exists: false }
    }).toArray();
    
    console.log(`📋 Found ${discordLeads.length} Discord leads without whopCompanyId\n`);
    
    let updated = 0;
    for (const lead of discordLeads) {
      // Get user's whopCompanyId
      const user = await usersCollection.findOne({ _id: new mongoose.Types.ObjectId(lead.userId) });
      
      if (user?.whopCompanyId) {
        await leadsCollection.updateOne(
          { _id: lead._id },
          { $set: { whopCompanyId: user.whopCompanyId } }
        );
        console.log(`✅ Updated lead ${lead._id} with whopCompanyId: ${user.whopCompanyId}`);
        updated++;
      } else {
        console.log(`⚠️  User ${lead.userId} doesn't have whopCompanyId, skipping lead ${lead._id}`);
      }
    }
    
    console.log(`\n✅ Updated ${updated} Discord leads with whopCompanyId`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

updateDiscordLeads();
