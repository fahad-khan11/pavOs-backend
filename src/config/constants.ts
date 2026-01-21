export const CONSTANTS = {
  // Server
  PORT: process.env.PORT || 5000,
  API_VERSION: process.env.API_VERSION || 'v1',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // JWT - REMOVED: Whop-only authentication (no custom tokens)
  // Authentication is handled entirely by Whop SDK

  // URLs
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000', 

  // Whop Integration
  WHOP_API_KEY: process.env.WHOP_API_KEY || '',
  WHOP_APP_ID: process.env.WHOP_APP_ID || '',
  WHOP_COMPANY_ID: process.env.WHOP_COMPANY_ID || '',
  WHOP_WEBHOOK_SECRET: process.env.WHOP_WEBHOOK_SECRET || '',

  // Google OAuth (legacy, disabled)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/v1/auth/google/callback',

  // Stripe
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || '',
  STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY || '',
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || '',

  // File Upload
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  ALLOWED_FILE_TYPES: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
  ],

  // CSV Import
  CSV_UNDO_EXPIRY_HOURS: 24,
  CSV_MAX_ROWS: 10000,

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),

  // Demo User
  DEMO_USER_EMAIL: process.env.DEMO_USER_EMAIL || 'demo@paveos.com',
  DEMO_USER_PASSWORD: process.env.DEMO_USER_PASSWORD || 'demo123',

  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // Deal Stages
  DEAL_STAGES: ['Lead', 'Contacted', 'Proposal', 'Negotiation', 'Contracted', 'Completed'] as const,

  // Pipeline Stage Values for Calculations
  STAGE_PROBABILITIES: {
    Lead: 0.1,
    Contacted: 0.2,
    Proposal: 0.4,
    Negotiation: 0.6,
    Contracted: 0.9,
    Completed: 1.0,
  },

  // Contact Status
  CONTACT_STATUS: ['active', 'prospect', 'inactive'] as const,

  // User Roles
  USER_ROLES: ['creator', 'manager', 'admin'] as const,

  // Subscription Plans
  SUBSCRIPTION_PLANS: ['Starter', 'Pro', 'Agency'] as const,

  // Activity Types
  ACTIVITY_TYPES: [
    'email',
    'call',
    'meeting',
    'note',
    'payment',
    'deliverable',
    'deal_created',
    'deal_updated',
    'contact_created',
  ] as const,

  // Telemetry Events
  TELEMETRY_EVENTS: [
    'user_registered',
    'user_login',
    'first_deal_created',
    'first_payment_received',
    'csv_import_completed',
    'stripe_connected',
    'whop_connected',
    'lead_created',
    'lead_converted',
    'deal_won',
    'deal_lost',
  ] as const,
};

export default CONSTANTS;
