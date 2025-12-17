import mongoose, { Schema } from 'mongoose';
import { IDiscordLeadChannel } from '../types/index.js';

const discordLeadChannelSchema = new Schema<IDiscordLeadChannel>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    whopCompanyId: {
      type: String,
      required: [true, 'Whop Company ID is required'],
      index: true,
    },
    leadId: {
      type: String,
      required: [true, 'Lead ID is required'],
      ref: 'Lead',
      unique: true,
      index: true,
    },
    discordGuildId: {
      type: String,
      required: [true, 'Discord Guild ID is required'],
      index: true,
    },
    discordChannelId: {
      type: String,
      required: [true, 'Discord Channel ID is required'],
      unique: true,
      index: true,
    },
    discordChannelName: {
      type: String,
      required: [true, 'Discord Channel Name is required'],
    },
    discordUserId: {
      type: String,
      index: true,
    },
    discordUsername: {
      type: String,
    },
    channelCreatedAt: {
      type: Date,
      default: Date.now,
    },
    lastMessageAt: {
      type: Date,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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
        if (ret.channelCreatedAt) {
          ret.channelCreatedAt = new Date(ret.channelCreatedAt).toISOString();
        }
        if (ret.lastMessageAt) {
          ret.lastMessageAt = new Date(ret.lastMessageAt).toISOString();
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

// Compound indexes for efficient queries
discordLeadChannelSchema.index({ whopCompanyId: 1, isActive: 1 });
discordLeadChannelSchema.index({ discordGuildId: 1, isActive: 1 });

// Virtual for id field
discordLeadChannelSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const DiscordLeadChannel = mongoose.model<IDiscordLeadChannel>(
  'DiscordLeadChannel',
  discordLeadChannelSchema
);
export default DiscordLeadChannel;
