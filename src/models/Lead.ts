import mongoose, { Schema } from 'mongoose';
import { ILead } from '../types/index.js';

const leadSchema = new Schema<ILead>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    whopCompanyId: {
      type: String,
      required: [true, 'Whop Company ID is required'],  // ✅ REFACTORED: Now required
      index: true,      // Index for fast company-based queries
    },
    contactId: {
      type: String,
      ref: 'Contact',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Lead name is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    discordUserId: {
      type: String,
      index: true,
    },
    discordUsername: {
      type: String,
    },
    discordChannelId: {
      type: String,
      index: true,
    },
    discordInviteSent: {
      type: Boolean,
      default: false,
    },
    discordJoinedChannel: {
      type: Boolean,
      default: false,
    },
    instagramUsername: {
      type: String,
    },
    tiktokUsername: {
      type: String,
    },
    source: {
      type: String,
      enum: ['discord', 'instagram', 'tiktok', 'whop', 'manual', 'referral'],
      required: [true, 'Lead source is required'],
      default: 'manual',
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'in_conversation', 'proposal', 'negotiation', 'won', 'lost'],
      required: [true, 'Lead status is required'],
      default: 'new',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    notes: {
      type: String,
      default: '',
    },
    lastContactDate: {
      type: Date,
      index: true,
    },
    nextFollowUpDate: {
      type: Date,
      index: true,
    },
    estimatedValue: {
      type: Number,
      default: 0,
    },
    actualValue: {
      type: Number,
      default: 0,
    },
    // Whop integration fields
    whopMembershipId: {
      type: String,
      index: true,
    },
    whopCustomerId: {
      type: String,
      index: true,
    },
    whopSupportChannelId: {
      type: String,
      index: true,
      sparse: true,  // Only indexed if value exists
    },
    lastWhopMessageAt: {
      type: Date,
      index: true,
    },
    wonAt: {
      type: Date,
    },
    customFields: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (_doc, ret: any) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (ret.lastContactDate) {
          ret.lastContactDate = new Date(ret.lastContactDate).toISOString();
        }
        if (ret.nextFollowUpDate) {
          ret.nextFollowUpDate = new Date(ret.nextFollowUpDate).toISOString();
        }
        if (ret.wonAt) {
          ret.wonAt = new Date(ret.wonAt).toISOString();
        }
        if (ret.createdAt) {
          ret.createdAt = new Date(ret.createdAt).toISOString();
        }
        if (ret.updatedAt) {
          ret.updatedAt = new Date(ret.updatedAt).toISOString();
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  }
);

// Indexes for efficient querying
leadSchema.index({ userId: 1, status: 1 });
leadSchema.index({ userId: 1, nextFollowUpDate: 1 });
leadSchema.index({ userId: 1, createdAt: -1 });
leadSchema.index({ email: 1 }, { sparse: true });
leadSchema.index({ discordUserId: 1 }, { sparse: true });
// ✅ REFACTORED: Add compound index for multi-tenant queries
leadSchema.index({ whopCompanyId: 1, status: 1 });
leadSchema.index({ whopCompanyId: 1, source: 1 });
leadSchema.index({ whopCompanyId: 1, createdAt: -1 });

// ✅ UNIQUE CONSTRAINT: Prevent duplicate Whop memberships
leadSchema.index(
  { whopCompanyId: 1, whopMembershipId: 1 },
  {
    unique: true,
    partialFilterExpression: { whopMembershipId: { $type: 'string' } }, // Only for docs with whopMembershipId
    name: 'unique_whop_membership_per_company',
  }
);

// ✅ UNIQUE CONSTRAINT: Prevent duplicate Discord users per company
// Uses partialFilterExpression to ONLY apply to Discord leads (where discordUserId exists)
// This allows unlimited manual and Whop leads with null discordUserId
leadSchema.index(
  { whopCompanyId: 1, discordUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { discordUserId: { $type: 'string' } }, // Only for docs with discordUserId
    name: 'unique_discord_user_per_company',
  }
);

// Virtual for id field
leadSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Virtual for conversation history (populated separately)
leadSchema.virtual('messages', {
  ref: 'DiscordMessage',
  localField: '_id',
  foreignField: 'leadId',
  options: { sort: { createdAt: -1 } },
});

export const Lead = mongoose.model<ILead>('Lead', leadSchema);
export default Lead;
