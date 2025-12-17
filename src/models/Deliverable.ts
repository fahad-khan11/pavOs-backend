import mongoose, { Schema } from 'mongoose';
import { IDeliverable, IFileUpload } from '../types/index.js';

const fileUploadSchema = new Schema<IFileUpload>(
  {
    id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const deliverableSchema = new Schema<IDeliverable>(
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
    dealId: {
      type: String,
      required: [true, 'Deal ID is required'],
      ref: 'Deal',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    files: [fileUploadSchema],
    completedDate: {
      type: Date,
    },
    notes: {
      type: String,
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
        // Format dates
        if (ret.dueDate) {
          ret.dueDate = new Date(ret.dueDate).toISOString();
        }
        if (ret.completedDate) {
          ret.completedDate = new Date(ret.completedDate).toISOString();
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
deliverableSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes
deliverableSchema.index({ userId: 1, status: 1 });
deliverableSchema.index({ whopCompanyId: 1, status: 1 });
deliverableSchema.index({ dealId: 1 });
deliverableSchema.index({ dueDate: 1 });

export const Deliverable = mongoose.model<IDeliverable>('Deliverable', deliverableSchema);
export default Deliverable;
