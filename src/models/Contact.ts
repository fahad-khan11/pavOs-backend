import mongoose, { Schema } from 'mongoose';
import { IContact } from '../types/index.js';

const contactSchema = new Schema<IContact>(
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
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: false, // Made optional to support Whop members without email (license keys)
      lowercase: true,
      trim: true,
      default: '',
      validate: {
        validator: function(v: string) {
          // Only validate email format if it's not empty
          return !v || /^\S+@\S+\.\S+$/.test(v);
        },
        message: 'Please provide a valid email'
      }
    },
    phone: {
      type: String,
      required: false,
      trim: true,
      default: '',
    },
    company: {
      type: String,
      required: [true, 'Company is required'],
      trim: true,
    },
    position: {
      type: String,
      required: [true, 'Position is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'prospect', 'inactive'],
      default: 'prospect',
    },
    tags: [{
      type: String,
      trim: true,
    }],
    lastContact: {
      type: Date,
      default: Date.now,
    },
    notes: {
      type: String,
      default: '',
    },
    deals: {
      type: Number,
      default: 0,
    },
    totalValue: {
      type: Number,
      default: 0,
    },
    // Whop Integration Fields
    whopMembershipId: {
      type: String,
      sparse: true,
    },
    whopMembershipStatus: {
      type: String,
      enum: [
        // Membership statuses (old API)
        'active', 'inactive', 'canceled', 'expired', 'completed', 'trialing', 'past_due', 'unpaid', 'drafted', 'unresolved',
        // Member statuses (new members API)
        'joined', 'left', 'kicked', 'banned'
      ],
    },
    whopPlan: {
      type: String,
    },
    whopJoinedAt: {
      type: Date,
    },
    source: {
      type: String,
      enum: ['manual', 'whop', 'stripe', 'csv'],
      default: 'manual',
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
        // Format dates to ISO string
        if (ret.lastContact) {
          ret.lastContact = new Date(ret.lastContact).toISOString();
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
contactSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes for faster queries
contactSchema.index({ userId: 1, status: 1 });
contactSchema.index({ userId: 1, company: 1 });
contactSchema.index({ email: 1, userId: 1 });

export const Contact = mongoose.model<IContact>('Contact', contactSchema);
export default Contact;
