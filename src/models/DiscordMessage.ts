import mongoose, { Schema } from 'mongoose';
import { IDiscordMessage } from '../types/index.js';

const discordMessageSchema = new Schema<IDiscordMessage>(
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
      index: true,
    },
    contactId: {
      type: String,
      ref: 'Contact',
      index: true,
    },
    leadId: {
      type: String,
      ref: 'Lead',
      index: true,
    },
    discordGuildId: {
      type: String,
      index: true,
    },
    discordChannelId: {
      type: String,
      index: true,
    },
    discordMessageId: {
      type: String,
      unique: true,
      sparse: true, // Allow null for Whop messages
      index: true,
    },
    authorDiscordId: {
      type: String,
      index: true,
    },
    // Whop-specific fields
    whopChannelId: {
      type: String,
      index: true,
    },
    whopMessageId: {
      type: String,
      unique: true,
      sparse: true, // Allow null for Discord messages
      index: true,
    },
    source: {
      type: String,
      enum: ['discord', 'whop'],
      default: 'discord',
      required: true,
      index: true,
    },
    authorUsername: {
      type: String,
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
    },
    direction: {
      type: String,
      enum: ['incoming', 'outgoing'],
      required: [true, 'Message direction is required'],
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    attachments: {
      type: [
        {
          url: String,
          filename: String,
          size: Number,
          contentType: String,
        },
      ],
      default: [],
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

// Index for efficient querying
discordMessageSchema.index({ userId: 1, createdAt: -1 });
discordMessageSchema.index({ whopCompanyId: 1, createdAt: -1 });
discordMessageSchema.index({ contactId: 1, createdAt: -1 });
discordMessageSchema.index({ leadId: 1, createdAt: -1 });
discordMessageSchema.index({ discordChannelId: 1, createdAt: -1 });
discordMessageSchema.index({ discordGuildId: 1, createdAt: -1 });
discordMessageSchema.index({ whopChannelId: 1, createdAt: -1 });
discordMessageSchema.index({ source: 1, createdAt: -1 });
discordMessageSchema.index({ isRead: 1, userId: 1 });

// Virtual for id field
discordMessageSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const DiscordMessage = mongoose.model<IDiscordMessage>(
  'DiscordMessage',
  discordMessageSchema
);
export default DiscordMessage;
