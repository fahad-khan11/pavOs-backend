import mongoose, { Schema } from 'mongoose';
import { IPayment } from '../types/index.js';

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    dealId: {
      type: String,
      ref: 'Deal',
      index: true,
    },
    leadId: {
      type: String,
      ref: 'Lead',
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Amount is required'],
      min: [0, 'Amount must be positive'],
    },
    currency: {
      type: String,
      default: 'USD',
      uppercase: true,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'overdue', 'cancelled'],
      default: 'pending',
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    paidDate: {
      type: Date,
    },
    stripePaymentId: {
      type: String,
    },
    stripeInvoiceId: {
      type: String,
    },
    whopPaymentId: {
      type: String,
    },
    method: {
      type: String,
      enum: ['stripe', 'whop', 'manual'],
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
        // Format dates to ISO string
        if (ret.dueDate) {
          ret.dueDate = new Date(ret.dueDate).toISOString();
        }
        if (ret.paidDate) {
          ret.paidDate = new Date(ret.paidDate).toISOString();
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
paymentSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes
paymentSchema.index({ userId: 1, paymentStatus: 1 });
paymentSchema.index({ dealId: 1 });
paymentSchema.index({ dueDate: 1, paymentStatus: 1 });

// Auto-update payment status to overdue
paymentSchema.pre('save', function (next) {
  if (this.paymentStatus === 'pending' && this.dueDate < new Date()) {
    this.paymentStatus = 'overdue';
  }
  next();
});

export const Payment = mongoose.model<IPayment>('Payment', paymentSchema);
export default Payment;
