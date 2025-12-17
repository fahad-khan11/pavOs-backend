import mongoose, { Schema } from 'mongoose';
import { IReminder } from '../types/index.js';

const reminderSchema = new Schema<IReminder>(
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
    type: {
      type: String,
      enum: ['payment_due', 'payment_overdue', 'deliverable_due', 'follow_up', 'custom'],
      required: [true, 'Reminder type is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'dismissed'],
      default: 'pending',
      index: true,
    },
    relatedEntityType: {
      type: String,
      enum: ['deal', 'payment', 'deliverable'],
    },
    relatedEntityId: {
      type: String,
    },
    sentAt: {
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
        if (ret.dueDate) {
          ret.dueDate = new Date(ret.dueDate).toISOString();
        }
        if (ret.sentAt) {
          ret.sentAt = new Date(ret.sentAt).toISOString();
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
reminderSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes
reminderSchema.index({ userId: 1, status: 1 });
reminderSchema.index({ whopCompanyId: 1, dueDate: 1 });
reminderSchema.index({ dueDate: 1, status: 1 });

export const Reminder = mongoose.model<IReminder>('Reminder', reminderSchema);
export default Reminder;
