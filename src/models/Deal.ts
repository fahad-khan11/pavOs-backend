import mongoose, { Schema } from 'mongoose';
import { IDeal } from '../types/index.js';

const dealSchema = new Schema<IDeal>(
  {
    creatorId: {
      type: String,
      required: [true, 'Creator ID is required'],
      ref: 'User',
      index: true,
    },
    whopCompanyId: {
      type: String,
      required: false,  // Optional for backward compatibility
      index: true,      // Index for fast company-based queries
    },
    brandName: {
      type: String,
      required: [true, 'Brand name is required'],
      trim: true,
    },
    brandContact: {
      type: String,
      required: [true, 'Brand contact is required'],
      trim: true,
    },
    dealValue: {
      type: Number,
      required: [true, 'Deal value is required'],
      min: [0, 'Deal value must be positive'],
    },
    stage: {
      type: String,
      enum: ['Lead', 'Contacted', 'Proposal', 'Negotiation', 'Contracted', 'Completed'],
      default: 'Lead',
      index: true,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    deadline: {
      type: Date,
      required: [true, 'Deadline is required'],
    },
    notes: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'completed'],
      default: 'active',
    },
    attachments: [{
      type: String,
    }],
    contactId: {
      type: String,
      ref: 'Contact',
    },
    contactName: {
      type: String,
    },
    company: {
      type: String,
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    expectedCloseDate: {
      type: Date,
    },
    createdDate: {
      type: Date,
      default: Date.now,
    },
    tags: [{
      type: String,
      trim: true,
    }],
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
        if (ret.startDate) {
          ret.startDate = new Date(ret.startDate).toISOString();
        }
        if (ret.deadline) {
          ret.deadline = new Date(ret.deadline).toISOString();
        }
        if (ret.expectedCloseDate) {
          ret.expectedCloseDate = new Date(ret.expectedCloseDate).toISOString();
        }
        if (ret.createdDate) {
          ret.createdDate = new Date(ret.createdDate).toISOString();
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
dealSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes for faster queries
dealSchema.index({ creatorId: 1, stage: 1 });
dealSchema.index({ creatorId: 1, status: 1 });
dealSchema.index({ contactId: 1 });
dealSchema.index({ deadline: 1 });

// Update contact's deal count and total value on save
dealSchema.post('save', async function () {
  if (this.contactId) {
    const Contact = mongoose.model('Contact');
    const deals = await mongoose.model('Deal').find({
      contactId: this.contactId,
      status: 'active',
    });

    const dealsCount = deals.length;
    const totalValue = deals.reduce((sum, deal) => sum + deal.dealValue, 0);

    await Contact.findByIdAndUpdate(this.contactId, {
      deals: dealsCount,
      totalValue: totalValue,
    });
  }
});

export const Deal = mongoose.model<IDeal>('Deal', dealSchema);
export default Deal;
