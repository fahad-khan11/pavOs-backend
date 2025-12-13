import mongoose, { Schema } from 'mongoose';
import { IActivity } from '../types/index.js';

const activitySchema = new Schema<IActivity>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    type: {
      type: String,
      enum: ['email', 'call', 'meeting', 'note', 'payment', 'deliverable', 'deal_created', 'deal_updated', 'contact_created'],
      required: [true, 'Activity type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
    },
    relatedEntityType: {
      type: String,
      enum: ['deal', 'contact', 'payment', 'deliverable'],
    },
    relatedEntityId: {
      type: String,
    },
    metadata: {
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
        if (ret.createdAt) {
          ret.createdAt = new Date(ret.createdAt).toISOString();
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
activitySchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ relatedEntityType: 1, relatedEntityId: 1 });

export const Activity = mongoose.model<IActivity>('Activity', activitySchema);
export default Activity;
