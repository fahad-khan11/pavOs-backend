import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkState() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db();
    const connections = db.collection('discordconnections');
    
    const all = await connections.find({}).toArray();
    console.log(`\n📊 Total Discord connections in database: ${all.length}\n`);
    
    for (const conn of all) {
      console.log(`User: ${conn.userId}`);
      console.log(`  Company: ${conn.whopCompanyId}`);
      console.log(`  Active: ${conn.isActive}`);
      console.log(`  Guild ID: ${conn.discordGuildId || 'NOT SET'}`);
      console.log(`  Guild Name: ${conn.discordGuildName || 'NOT SET'}`);
      console.log(`  Has Tokens: ${conn.accessToken ? 'Yes' : 'No'}`);
      console.log('');
    }
    
  } finally {
    await client.close();
  }
}

checkState();
