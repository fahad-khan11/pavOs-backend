import mongoose, { Schema } from 'mongoose';
import { ILead } from '../types/index.js';

const leadSchema = new Schema<ILead>(
  {
    whopLeadId: {
      type: String,
      required: true,
      index: true,
      unique: true,
    },
    whopCompanyId: {
      type: String,
      required: true,
      index: true,
    },
    whopUserId: {
      type: String,
      sparse: true,
      index: true,
    },
    email: {
      type: String,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      sparse: true,
      trim: true,
    },
    productId: {
      type: String,
      sparse: true,
    },
    productTitle: {
      type: String,
      sparse: true,
    },
    referrer: {
      type: String,
      sparse: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    memberId: {
      type: String,
      sparse: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'converted', 'lost'],
      default: 'new',
      index: true,
    },
    whopCreatedAt: {
      type: Date,
      required: true,
    },
    whopUpdatedAt: {
      type: Date,
      required: true,
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
        return ret;
      },
    },
  }
);

// Virtual for id field
leadSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Index for faster queries
leadSchema.index({ whopCompanyId: 1, status: 1 });
leadSchema.index({ whopUserId: 1 });
leadSchema.index({ email: 1, whopCompanyId: 1 });

export const Lead = mongoose.model<ILead>('Lead', leadSchema);
export default Lead;
