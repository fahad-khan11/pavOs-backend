import mongoose, { Schema } from 'mongoose';
import { IDiscordConnection } from '../types/index.js';

const discordConnectionSchema = new Schema<IDiscordConnection>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      unique: true,
      index: true,
    },
    whopCompanyId: {
      type: String,
      index: true,
    },
    discordUserId: {
      type: String,
    },
    discordUsername: {
      type: String,
    },
    discordGuildId: {
      type: String,
      index: true, // Index for faster guild lookups
    },
    discordGuildName: {
      type: String,
    },
    accessToken: {
      type: String,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    botToken: {
      type: String,
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    lastSyncAt: {
      type: Date,
    },
    syncedMembersCount: {
      type: Number,
      default: 0,
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
        delete ret.accessToken;
        delete ret.refreshToken;
        delete ret.botToken;
        if (ret.connectedAt) {
          ret.connectedAt = new Date(ret.connectedAt).toISOString();
        }
        if (ret.lastSyncAt) {
          ret.lastSyncAt = new Date(ret.lastSyncAt).toISOString();
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

// Virtual for id field
discordConnectionSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const DiscordConnection = mongoose.model<IDiscordConnection>(
  'DiscordConnection',
  discordConnectionSchema
);
export default DiscordConnection;
