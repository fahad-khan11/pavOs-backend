import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User, Contact, Deal } from '../src/models';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paveos';

const seedDemoData = async () => {
  try {
    console.log('🌱 Starting demo data seeding...');

    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find or create demo user
    let demoUser = await User.findOne({ email: 'demo@paveos.com' });

    if (!demoUser) {
      demoUser = await User.create({
        name: 'Demo User',
        email: 'demo@paveos.com',
        password: 'demo123',
        role: 'creator',
        subscriptionPlan: 'Pro',
      });
      console.log('✅ Demo user created');
    } else {
      console.log('ℹ️  Demo user already exists');
    }

    const userId = demoUser._id.toString();

    // Check if demo data already exists
    const existingContacts = await Contact.countDocuments({ userId });
    if (existingContacts > 0) {
      console.log('ℹ️  Demo data already exists. Skipping...');
      await mongoose.connection.close();
      return;
    }

    // Create demo contacts
    const contacts = await Contact.insertMany([
      {
        userId,
        name: 'Sarah Johnson',
        email: 'sarah.johnson@techbrand.com',
        phone: '+1 (555) 123-4567',
        company: 'TechBrand Inc.',
        position: 'Marketing Director',
        status: 'active',
        tags: ['Tech', 'B2B'],
        notes: 'Interested in Q2 campaign collaboration',
        deals: 2,
        totalValue: 15000,
        lastContact: new Date('2024-10-20'),
      },
      {
        userId,
        name: 'Michael Chen',
        email: 'mchen@styleapparel.com',
        phone: '+1 (555) 234-5678',
        company: 'Style Apparel',
        position: 'Brand Manager',
        status: 'active',
        tags: ['Fashion', 'Lifestyle'],
        notes: 'Looking for lifestyle content creators',
        deals: 1,
        totalValue: 8000,
        lastContact: new Date('2024-10-18'),
      },
      {
        userId,
        name: 'Emily Rodriguez',
        email: 'emily.r@healthylife.com',
        phone: '+1 (555) 345-6789',
        company: 'HealthyLife Products',
        position: 'Partnerships Lead',
        status: 'active',
        tags: ['Health', 'Wellness'],
        notes: 'Quarterly partnership opportunity',
        deals: 1,
        totalValue: 12000,
        lastContact: new Date('2024-10-15'),
      },
      {
        userId,
        name: 'David Park',
        email: 'dpark@gamezone.io',
        phone: '+1 (555) 456-7890',
        company: 'GameZone',
        position: 'Community Manager',
        status: 'prospect',
        tags: ['Gaming', 'Entertainment'],
        notes: 'Exploring gaming content sponsorship',
        deals: 0,
        totalValue: 0,
        lastContact: new Date('2024-10-12'),
      },
      {
        userId,
        name: 'Lisa Wong',
        email: 'lwong@foodiebrands.com',
        phone: '+1 (555) 567-8901',
        company: 'Foodie Brands',
        position: 'Influencer Relations',
        status: 'active',
        tags: ['Food', 'Lifestyle'],
        notes: 'Recipe content collaboration',
        deals: 1,
        totalValue: 6000,
        lastContact: new Date('2024-10-22'),
      },
    ]);
    console.log(`✅ Created ${contacts.length} demo contacts`);

    // Create demo deals
    const deals = await Deal.insertMany([
      {
        creatorId: userId,
        brandName: 'TechBrand Inc.',
        brandContact: 'sarah.johnson@techbrand.com',
        dealValue: 10000,
        stage: 'Negotiation',
        startDate: new Date('2024-10-01'),
        deadline: new Date('2024-11-30'),
        notes: 'Tech product review series',
        status: 'active',
        contactId: contacts[0]._id.toString(),
        contactName: 'Sarah Johnson',
        company: 'TechBrand Inc.',
        probability: 70,
        expectedCloseDate: new Date('2024-11-15'),
        createdDate: new Date('2024-10-01'),
        tags: ['Tech', 'Product Review'],
      },
      {
        creatorId: userId,
        brandName: 'Style Apparel',
        brandContact: 'mchen@styleapparel.com',
        dealValue: 8000,
        stage: 'Contracted',
        startDate: new Date('2024-09-15'),
        deadline: new Date('2024-12-15'),
        notes: 'Fall/Winter fashion campaign',
        status: 'active',
        contactId: contacts[1]._id.toString(),
        contactName: 'Michael Chen',
        company: 'Style Apparel',
        probability: 90,
        expectedCloseDate: new Date('2024-11-30'),
        createdDate: new Date('2024-09-15'),
        tags: ['Fashion', 'Campaign'],
      },
      {
        creatorId: userId,
        brandName: 'HealthyLife Products',
        brandContact: 'emily.r@healthylife.com',
        dealValue: 12000,
        stage: 'Proposal',
        startDate: new Date('2024-10-10'),
        deadline: new Date('2024-12-31'),
        notes: 'Wellness content series',
        status: 'active',
        contactId: contacts[2]._id.toString(),
        contactName: 'Emily Rodriguez',
        company: 'HealthyLife Products',
        probability: 50,
        expectedCloseDate: new Date('2024-12-01'),
        createdDate: new Date('2024-10-10'),
        tags: ['Health', 'Series'],
      },
      {
        creatorId: userId,
        brandName: 'GameZone',
        brandContact: 'dpark@gamezone.io',
        dealValue: 15000,
        stage: 'Lead',
        startDate: new Date('2024-10-20'),
        deadline: new Date('2025-01-31'),
        notes: 'Gaming tournament sponsorship',
        status: 'active',
        contactId: contacts[3]._id.toString(),
        contactName: 'David Park',
        company: 'GameZone',
        probability: 30,
        expectedCloseDate: new Date('2025-01-15'),
        createdDate: new Date('2024-10-20'),
        tags: ['Gaming', 'Sponsorship'],
      },
      {
        creatorId: userId,
        brandName: 'Foodie Brands',
        brandContact: 'lwong@foodiebrands.com',
        dealValue: 6000,
        stage: 'Completed',
        startDate: new Date('2024-08-01'),
        deadline: new Date('2024-10-15'),
        notes: 'Recipe video collaboration',
        status: 'active',
        contactId: contacts[4]._id.toString(),
        contactName: 'Lisa Wong',
        company: 'Foodie Brands',
        probability: 100,
        expectedCloseDate: new Date('2024-10-15'),
        createdDate: new Date('2024-08-01'),
        tags: ['Food', 'Video'],
      },
      {
        creatorId: userId,
        brandName: 'TechBrand Inc.',
        brandContact: 'sarah.johnson@techbrand.com',
        dealValue: 5000,
        stage: 'Completed',
        startDate: new Date('2024-07-01'),
        deadline: new Date('2024-09-30'),
        notes: 'Gadget unboxing videos',
        status: 'active',
        contactId: contacts[0]._id.toString(),
        contactName: 'Sarah Johnson',
        company: 'TechBrand Inc.',
        probability: 100,
        expectedCloseDate: new Date('2024-09-30'),
        createdDate: new Date('2024-07-01'),
        tags: ['Tech', 'Unboxing'],
      },
    ]);
    console.log(`✅ Created ${deals.length} demo deals`);

    console.log('\n🎉 Demo data seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - User: ${demoUser.email}`);
    console.log(`   - Contacts: ${contacts.length}`);
    console.log(`   - Deals: ${deals.length}`);
    console.log('\n💡 Use these credentials to login:');
    console.log('   Email: demo@paveos.com');
    console.log('   Password: demo123\n');

    await mongoose.connection.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  }
};

seedDemoData();
