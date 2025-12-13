import mongoose, { Schema } from 'mongoose';
import { IStripeConnection } from '../types/index.js';

const stripeConnectionSchema = new Schema<IStripeConnection>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      unique: true,
      index: true,
    },
    stripeAccountId: {
      type: String,
      required: [true, 'Stripe account ID is required'],
    },
    stripeCustomerId: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    accessToken: {
      type: String,
      select: false,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    lastSyncAt: {
      type: Date,
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
stripeConnectionSchema.virtual('id').get(function () {
  return this._id.toString();
});

export const StripeConnection = mongoose.model<IStripeConnection>(
  'StripeConnection',
  stripeConnectionSchema
);
export default StripeConnection;
