import { Request } from 'express';
import { Document, Types } from 'mongoose';

// ============================================
// USER TYPES (Matching Frontend lib/types.ts)
// ============================================

export type UserRole = 'creator' | 'manager' | 'admin';
export type SubscriptionPlan = 'Starter' | 'Pro' | 'Agency';

export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  subscriptionPlan: SubscriptionPlan;
  whopId?: string;
  whopUserId?: string;
  whopCompanyId?: string;
  googleId?: string;
  avatar?: string;
  isEmailVerified?: boolean;
  createdAt: Date;
  lastLogin: Date;
  refreshTokens: string[];
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ============================================
// CONTACT TYPES (Matching Frontend)
// ============================================

export type ContactStatus = 'active' | 'prospect' | 'inactive';

export interface IContact extends Document {
  id: string;
  userId: string;
  whopCompanyId?: string;  // ✅ Multi-tenant company isolation
  name: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  status: ContactStatus;
  tags: string[];
  lastContact: Date;
  notes: string;
  deals: number;
  totalValue: number;
  // Whop Integration
  whopMembershipId?: string;
  whopMembershipStatus?: 'active' | 'inactive' | 'cancelled' | 'expired';
  whopPlan?: string;
  whopJoinedAt?: Date;
  source?: 'manual' | 'whop' | 'stripe' | 'csv';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DEAL TYPES (Matching Frontend)
// ============================================

export type DealStage = 'Lead' | 'Contacted' | 'Proposal' | 'Negotiation' | 'Contracted' | 'Completed';
export type DealStatus = 'active' | 'completed';

export interface IDeal extends Document {
  id: string;
  creatorId: string;
  whopCompanyId?: string;  // ✅ Multi-tenant company isolation
  brandName: string;
  brandContact: string;
  dealValue: number;
  stage: DealStage;
  startDate: Date;
  deadline: Date;
  notes: string;
  status: DealStatus;
  attachments: string[];
  contactId?: string;
  contactName?: string;
  company?: string;
  probability?: number;
  expectedCloseDate?: Date;
  createdDate: Date;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// PAYMENT TYPES
// ============================================

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';

export interface IPayment extends Document {
  id: string;
  userId: string;
  dealId?: string;
  leadId?: string;
  amount: number;
  currency: string;
  paymentStatus: PaymentStatus;
  dueDate: Date;
  paidDate?: Date;
  stripePaymentId?: string;
  stripeInvoiceId?: string;
  whopPaymentId?: string;
  method?: 'stripe' | 'whop' | 'manual';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DELIVERABLE TYPES
// ============================================

export type DeliverableStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type DeliverablePriority = 'low' | 'medium' | 'high';

export interface IDeliverable extends Document {
  id: string;
  userId: string;
  dealId: string;
  title: string;
  description: string;
  dueDate: Date;
  status: DeliverableStatus;
  priority: DeliverablePriority;
  files: IFileUpload[];
  completedDate?: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// FILE UPLOAD TYPES
// ============================================

export interface IFileUpload {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

// ============================================
// ACTIVITY TYPES
// ============================================

export type ActivityType = 'email' | 'call' | 'meeting' | 'note' | 'payment' | 'deliverable' | 'deal_created' | 'deal_updated' | 'contact_created';

export interface IActivity extends Document {
  id: string;
  userId: string;
  type: ActivityType;
  title: string;
  description: string;
  relatedEntityType?: 'deal' | 'contact' | 'payment' | 'deliverable';
  relatedEntityId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}

// ============================================
// REMINDER TYPES
// ============================================

export type ReminderType = 'payment_due' | 'payment_overdue' | 'deliverable_due' | 'follow_up' | 'custom';
export type ReminderStatus = 'pending' | 'sent' | 'dismissed';

export interface IReminder extends Document {
  id: string;
  userId: string;
  type: ReminderType;
  title: string;
  message: string;
  dueDate: Date;
  status: ReminderStatus;
  relatedEntityType?: 'deal' | 'payment' | 'deliverable';
  relatedEntityId?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// TELEMETRY TYPES
// ============================================

export type TelemetryEventType =
  | 'user_registered'
  | 'user_login'
  | 'first_deal_created'
  | 'first_payment_received'
  | 'csv_import_completed'
  | 'stripe_connected'
  | 'whop_connected'
  | 'discord_connected'
  | 'discord_member_synced'
  | 'discord_message_sent'
  | 'lead_created'
  | 'lead_converted'
  | 'deal_won'
  | 'deal_lost';

export interface ITelemetryEvent extends Document {
  id: string;
  userId: string;
  eventType: TelemetryEventType;
  eventData?: Record<string, any>;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
}

// ============================================
// CSV IMPORT TYPES
// ============================================

export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'undone';

export interface ICSVImport extends Document {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  rowCount: number;
  importedCount: number;
  failedCount: number;
  status: ImportStatus;
  mapping: Record<string, string>;
  importedRecordIds: string[];
  errorLog?: string[];
  undoExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// STRIPE CONNECTION TYPES
// ============================================

export interface IStripeConnection extends Document {
  id: string;
  userId: string;
  stripeAccountId: string;
  stripeCustomerId?: string;
  isActive: boolean;
  accessToken?: string;
  refreshToken?: string;
  connectedAt: Date;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// WHOP CONNECTION TYPES
// ============================================

export interface IWhopConnection extends Document {
  id: string;
  userId: string;
  whopUserId?: string;
  whopCompanyId?: string;
  accessToken?: string;
  refreshToken?: string;
  isActive: boolean;
  connectedAt: Date;
  lastSyncAt?: Date;
  syncedCustomersCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DISCORD CONNECTION TYPES
// ============================================

export interface IDiscordConnection extends Document {
  id: string;
  userId: string;
  whopCompanyId?: string;
  discordUserId?: string;
  discordUsername?: string;
  discordGuildId?: string;
  discordGuildName?: string;
  accessToken?: string;
  refreshToken?: string;
  botToken?: string;
  isActive: boolean;
  connectedAt: Date;
  lastSyncAt?: Date;
  syncedMembersCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// DISCORD MESSAGE TYPES
// ============================================

export type MessageDirection = 'incoming' | 'outgoing';

export interface IDiscordMessage extends Document {
  id: string;
  userId: string;
  contactId?: string;
  leadId?: string;
  discordChannelId: string;
  discordMessageId: string;
  authorDiscordId: string;
  authorUsername?: string;
  content: string;
  direction: MessageDirection;
  isRead: boolean;
  tags: string[];
  metadata?: Record<string, any>;
  attachments?: Array<{
    url: string;
    filename: string;
    size: number;
    contentType: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// LEAD TYPES
// ============================================

export type LeadSource = 'discord' | 'instagram' | 'tiktok' | 'whop' | 'manual' | 'referral';
export type LeadStatus = 'new' | 'in_conversation' | 'proposal' | 'negotiation' | 'won' | 'lost';

export interface ILead extends Document {
  id: string;
  userId: string;
  whopCompanyId?: string;  // ✅ Multi-tenant company isolation
  contactId?: string;
  name: string;
  email?: string;
  phone?: string;
  discordUserId?: string;
  discordUsername?: string;
  instagramUsername?: string;
  tiktokUsername?: string;
  source: LeadSource;
  status: LeadStatus;
  tags: string[];
  notes: string;
  lastContactDate?: Date;
  nextFollowUpDate?: Date;
  estimatedValue?: number;
  actualValue?: number;
  // Whop integration fields
  whopMembershipId?: string;
  whopCustomerId?: string;
  wonAt?: Date;
  customFields?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// AUTH TYPES
// ============================================

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthRequest extends Request {
  user?: JWTPayload | any; // Allow both JWT payload and Passport user
  userId?: string;
  whopCompanyId?: string;  // ✅ Multi-tenant company ID
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// DASHBOARD TYPES
// ============================================

export interface DashboardStats {
  totalRevenue: number;
  closeRate: number;
  activeContacts: number;
  dealsInProgress: number;
  monthlyRevenue: number;
  weeklyRevenue: number;
  pendingPayments: number;
  overduePayments: number;
}

export interface RecentActivity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: Date;
  relatedEntity?: {
    type: string;
    id: string;
    name: string;
  };
}

export interface UpcomingDeliverable {
  id: string;
  dealId: string;
  dealName: string;
  title: string;
  dueDate: Date;
  priority: DeliverablePriority;
  status: DeliverableStatus;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface RevenueTrend {
  date: string;
  revenue: number;
  deals: number;
}

export interface DealsByIndustry {
  industry: string;
  count: number;
  value: number;
}

export interface ConversionFunnel {
  stage: DealStage;
  count: number;
  value: number;
  conversionRate: number;
}

export interface PipelineHealth {
  totalValue: number;
  weightedValue: number;
  averageDealSize: number;
  dealsByStage: {
    stage: DealStage;
    count: number;
    value: number;
  }[];
}
