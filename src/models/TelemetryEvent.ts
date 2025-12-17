import mongoose, { Schema } from 'mongoose';
import { ITelemetryEvent } from '../types/index.js';

const telemetryEventSchema = new Schema<ITelemetryEvent>(
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
    eventType: {
      type: String,
      enum: [
        'user_registered',
        'user_login',
        'first_deal_created',
        'first_payment_received',
        'csv_import_completed',
        'stripe_connected',
        'whop_connected',
        'discord_connected',
        'discord_member_synced',
        'discord_message_sent',
        'lead_created',
        'lead_converted',
        'deal_won',
        'deal_lost',
      ],
      required: [true, 'Event type is required'],
      index: true,
    },
    eventData: {
      type: Schema.Types.Mixed,
      default: {},
    },
    userAgent: {
      type: String,
    },
    ipAddress: {
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
telemetryEventSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes
telemetryEventSchema.index({ userId: 1, eventType: 1 });
telemetryEventSchema.index({ whopCompanyId: 1, createdAt: -1 });
telemetryEventSchema.index({ createdAt: -1 });

export const TelemetryEvent = mongoose.model<ITelemetryEvent>(
  'TelemetryEvent',
  telemetryEventSchema
);
export default TelemetryEvent;
