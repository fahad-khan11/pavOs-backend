import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI!;

async function checkLeads() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    if (!db) throw new Error('Database connection not established');
    
    const leadsCollection = db.collection('leads');
    const leads = await leadsCollection.find({}).toArray();

    console.log(`📋 Found ${leads.length} leads:\n`);
    leads.forEach((lead: any) => {
      console.log(`🎯 Lead ID: ${lead._id}`);
      console.log(`   User ID: ${lead.userId}`);
      console.log(`   Name: ${lead.name}`);
      console.log(`   Source: ${lead.source}`);
      console.log(`   Status: ${lead.status}`);
      console.log(`   Discord User ID: ${lead.discordUserId || 'N/A'}`);
      console.log(`   Discord Username: ${lead.discordUsername || 'N/A'}`);
      console.log(`   Company ID: ${lead.whopCompanyId || 'N/A'}`);
      console.log('');
    });

    // Check Discord messages
    const messagesCollection = db.collection('discordmessages');
    const messages = await messagesCollection.find({}).toArray();
    
    console.log(`\n💬 Found ${messages.length} Discord messages:\n`);
    messages.forEach((msg: any) => {
      console.log(`📨 Message ID: ${msg._id}`);
      console.log(`   User ID: ${msg.userId}`);
      console.log(`   Lead ID: ${msg.leadId || 'N/A'}`);
      console.log(`   Direction: ${msg.direction}`);
      console.log(`   Content: ${msg.content?.substring(0, 50)}...`);
      console.log(`   Created: ${msg.createdAt}`);
      console.log('');
    });

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkLeads();
