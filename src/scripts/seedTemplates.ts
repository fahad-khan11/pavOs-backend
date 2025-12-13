import DealTemplate from '../models/DealTemplate.js';
import { connectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';

const defaultTemplates = [
  {
    name: 'Sponsored Social Media Post',
    description: 'Single sponsored post on Instagram, Twitter, or TikTok with brand mention and product showcase',
    category: 'social_media',
    defaultValue: 2500,
    valueRange: {
      min: 500,
      max: 5000,
    },
    defaultStage: 'Lead',
    deliverables: [
      {
        title: 'Content Draft for Approval',
        description: 'Submit content draft including caption, hashtags, and media for brand approval',
        daysToComplete: 3,
      },
      {
        title: 'Final Post Published',
        description: 'Publish final approved content and provide screenshot/link as proof',
        daysToComplete: 7,
      },
      {
        title: 'Engagement Report',
        description: 'Share post analytics including reach, impressions, and engagement after 24 hours',
        daysToComplete: 8,
      },
    ],
    isDefault: true,
  },
  {
    name: 'YouTube Integration',
    description: 'Dedicated YouTube video featuring brand product or service with integration segment',
    category: 'video',
    defaultValue: 5000,
    valueRange: {
      min: 1000,
      max: 10000,
    },
    defaultStage: 'Lead',
    deliverables: [
      {
        title: 'Video Concept & Script',
        description: 'Submit video concept, script, and integration talking points for approval',
        daysToComplete: 5,
      },
      {
        title: 'Raw Integration Footage',
        description: 'Send raw footage of brand integration segment for review before final edit',
        daysToComplete: 10,
      },
      {
        title: 'Published Video',
        description: 'Upload final video with integration, provide link and thumbnail',
        daysToComplete: 14,
      },
      {
        title: '30-Day Performance Report',
        description: 'Share video analytics including views, watch time, and click-through rate',
        daysToComplete: 44,
      },
    ],
    isDefault: true,
  },
  {
    name: 'Brand Ambassador Program',
    description: 'Multi-month brand partnership with ongoing content creation and promotion',
    category: 'brand_partnership',
    defaultValue: 8000,
    valueRange: {
      min: 2000,
      max: 15000,
    },
    defaultStage: 'Lead',
    deliverables: [
      {
        title: 'Ambassador Agreement Signed',
        description: 'Review and sign brand ambassador agreement with content calendar',
        daysToComplete: 7,
      },
      {
        title: 'Month 1 Content Package',
        description: '4 pieces of content across platforms per agreed calendar',
        daysToComplete: 30,
      },
      {
        title: 'Month 2 Content Package',
        description: '4 pieces of content across platforms per agreed calendar',
        daysToComplete: 60,
      },
      {
        title: 'Month 3 Content Package',
        description: '4 pieces of content across platforms per agreed calendar',
        daysToComplete: 90,
      },
      {
        title: 'Quarterly Performance Report',
        description: 'Comprehensive report on reach, engagement, and conversions',
        daysToComplete: 95,
      },
    ],
    isDefault: true,
  },
  {
    name: 'Affiliate Partnership',
    description: 'Performance-based partnership with unique affiliate link and commission structure',
    category: 'affiliate',
    defaultValue: 1500,
    valueRange: {
      min: 500,
      max: 3000,
    },
    defaultStage: 'Lead',
    deliverables: [
      {
        title: 'Affiliate Agreement Signed',
        description: 'Sign affiliate agreement with commission terms and payout schedule',
        daysToComplete: 3,
      },
      {
        title: 'Promotional Content Created',
        description: 'Create and share initial promotional content with affiliate link',
        daysToComplete: 7,
      },
      {
        title: 'Month 1 Sales Report',
        description: 'Provide sales data and commission calculation for first month',
        daysToComplete: 37,
      },
    ],
    isDefault: true,
  },
  {
    name: 'Content Series (3-5 Posts)',
    description: 'Multi-post content series telling a brand story across multiple pieces of content',
    category: 'content_series',
    defaultValue: 10000,
    valueRange: {
      min: 3000,
      max: 20000,
    },
    defaultStage: 'Lead',
    deliverables: [
      {
        title: 'Series Concept & Calendar',
        description: 'Submit series concept, content calendar, and creative direction',
        daysToComplete: 7,
      },
      {
        title: 'Post 1 Published',
        description: 'Publish first post in series with brand integration',
        daysToComplete: 14,
      },
      {
        title: 'Post 2 Published',
        description: 'Publish second post in series',
        daysToComplete: 21,
      },
      {
        title: 'Post 3 Published',
        description: 'Publish third post in series',
        daysToComplete: 28,
      },
      {
        title: 'Series Performance Report',
        description: 'Comprehensive analytics across all posts in series',
        daysToComplete: 35,
      },
    ],
    isDefault: true,
  },
  {
    name: 'Product Review Video',
    description: 'Dedicated product review or unboxing video showcasing brand product',
    category: 'video',
    defaultValue: 3500,
    valueRange: {
      min: 1500,
      max: 8000,
    },
    defaultStage: 'Lead',
    deliverables: [
      {
        title: 'Video Outline Approved',
        description: 'Submit video outline and key talking points for brand approval',
        daysToComplete: 3,
      },
      {
        title: 'Draft Video for Review',
        description: 'Send draft video for brand feedback before publishing',
        daysToComplete: 10,
      },
      {
        title: 'Published Video',
        description: 'Publish final approved review video',
        daysToComplete: 14,
      },
      {
        title: 'Performance Analytics',
        description: 'Share video performance metrics after 7 days',
        daysToComplete: 21,
      },
    ],
    isDefault: true,
  },
];

export const seedDealTemplates = async () => {
  try {
    await connectDatabase();

    // Clear existing default templates
    await DealTemplate.deleteMany({ isDefault: true });

    // Insert new templates
    const templates = await DealTemplate.insertMany(defaultTemplates);

    logger.info(`✅ Successfully seeded ${templates.length} deal templates`);

    return templates;
  } catch (error) {
    logger.error('Error seeding deal templates:', error);
    throw error;
  }
};

// Run if called directly
if (require.main === module) {
  seedDealTemplates()
    .then(() => {
      logger.info('Template seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Template seeding failed:', error);
      process.exit(1);
    });
}
