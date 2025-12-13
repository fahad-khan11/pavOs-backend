import mongoose, { Schema, Document } from 'mongoose';

export interface IDealTemplate extends Document {
  name: string;
  description: string;
  category: string;
  defaultValue: number;
  valueRange: {
    min: number;
    max: number;
  };
  defaultStage: string;
  deliverables: {
    title: string;
    description: string;
    daysToComplete: number;
  }[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const dealTemplateSchema = new Schema<IDealTemplate>(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      minlength: [3, 'Template name must be at least 3 characters'],
      maxlength: [100, 'Template name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Template description is required'],
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: ['social_media', 'video', 'brand_partnership', 'affiliate', 'content_series', 'other'],
      default: 'other',
    },
    defaultValue: {
      type: Number,
      required: [true, 'Default value is required'],
      min: [0, 'Default value must be positive'],
    },
    valueRange: {
      min: {
        type: Number,
        required: [true, 'Minimum value is required'],
        min: [0, 'Minimum value must be positive'],
      },
      max: {
        type: Number,
        required: [true, 'Maximum value is required'],
        validate: {
          validator: function (this: IDealTemplate, value: number) {
            return value >= this.valueRange.min;
          },
          message: 'Maximum value must be greater than or equal to minimum value',
        },
      },
    },
    defaultStage: {
      type: String,
      required: [true, 'Default stage is required'],
      enum: ['Lead', 'Contacted', 'Proposal', 'Negotiation', 'Contracted', 'Completed'],
      default: 'Lead',
    },
    deliverables: [
      {
        title: {
          type: String,
          required: [true, 'Deliverable title is required'],
          trim: true,
        },
        description: {
          type: String,
          trim: true,
        },
        daysToComplete: {
          type: Number,
          required: [true, 'Days to complete is required'],
          min: [1, 'Days to complete must be at least 1'],
        },
      },
    ],
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
dealTemplateSchema.index({ category: 1, isDefault: 1 });

const DealTemplate = mongoose.model<IDealTemplate>('DealTemplate', dealTemplateSchema);

export default DealTemplate;
