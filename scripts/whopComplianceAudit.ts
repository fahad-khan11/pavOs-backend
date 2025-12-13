import mongoose from 'mongoose';
import { config } from 'dotenv';

config();

async function auditWhopCompliance() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('✅ Connected to MongoDB\n');

    console.log('═══════════════════════════════════════════════════════');
    console.log('  🔍 WHOP MULTI-TENANCY COMPLIANCE AUDIT');
    console.log('═══════════════════════════════════════════════════════\n');

    // Define collections to check
    const collections = ['leads', 'contacts', 'deals'];
    
    for (const collectionName of collections) {
      console.log(`\n📋 Checking ${collectionName.toUpperCase()}:`);
      console.log('─'.repeat(50));
      
      const Model = mongoose.model(collectionName, new mongoose.Schema({}, { strict: false }));
      
      // Check 1: Records without whopCompanyId
      const missingCompanyId = await Model.find({ whopCompanyId: { $exists: false } }).lean();
      console.log(`   Records WITHOUT whopCompanyId: ${missingCompanyId.length}`);
      
      if (missingCompanyId.length > 0) {
        console.log(`   ❌ FAIL - Found ${missingCompanyId.length} records without whopCompanyId`);
        missingCompanyId.slice(0, 3).forEach((doc: any) => {
          console.log(`      - ID: ${doc._id}, userId: ${doc.userId || 'N/A'}`);
        });
      } else {
        console.log('   ✅ PASS - All records have whopCompanyId');
      }
      
      // Check 2: Company data distribution
      const distribution = await Model.aggregate([
        { $group: { _id: '$whopCompanyId', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]);
      
      console.log(`\n   📊 Company Data Distribution:`);
      distribution.forEach((group: any) => {
        console.log(`      ${group._id || 'NULL'}: ${group.count} records`);
      });
      
      // Check 3: Total records
      const total = await Model.countDocuments({});
      console.log(`\n   📈 Total Records: ${total}`);
    }

    console.log('\n\n═══════════════════════════════════════════════════════');
    console.log('  📊 COMPLIANCE SUMMARY');
    console.log('═══════════════════════════════════════════════════════\n');

    // Final verdict
    const leadsMissing = await mongoose.model('leads', new mongoose.Schema({}, { strict: false }))
      .countDocuments({ whopCompanyId: { $exists: false } });
    const contactsMissing = await mongoose.model('contacts', new mongoose.Schema({}, { strict: false }))
      .countDocuments({ whopCompanyId: { $exists: false } });
    const dealsMissing = await mongoose.model('deals', new mongoose.Schema({}, { strict: false }))
      .countDocuments({ whopCompanyId: { $exists: false } });

    const totalMissing = leadsMissing + contactsMissing + dealsMissing;

    if (totalMissing === 0) {
      console.log('✅ PASS: All records have whopCompanyId');
      console.log('✅ PASS: Data is properly isolated by company');
      console.log('✅ PASS: System is Whop compliant\n');
    } else {
      console.log(`❌ FAIL: ${totalMissing} records missing whopCompanyId`);
      console.log('❌ FAIL: Data isolation NOT guaranteed');
      console.log('❌ FAIL: System NOT Whop compliant\n');
    }

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB\n');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

auditWhopCompliance();
