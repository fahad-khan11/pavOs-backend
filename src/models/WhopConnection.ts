import mongoose, { Schema } from 'mongoose';
import { IWhopConnection } from '../types/index.js';

const whopConnectionSchema = new Schema<IWhopConnection>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      unique: true,
      index: true,
    },
    whopUserId: {
      type: String,
      index: true,
    },
    whopCompanyId: {
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
    syncedCustomersCount: {
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
whopConnectionSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const WhopConnection = mongoose.model<IWhopConnection>(
  'WhopConnection',
  whopConnectionSchema
);
export default WhopConnection;
