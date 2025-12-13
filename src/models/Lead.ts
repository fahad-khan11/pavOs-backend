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
      required: false,  // Optional for backward compatibility
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
