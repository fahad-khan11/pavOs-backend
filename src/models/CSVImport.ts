import mongoose, { Schema } from 'mongoose';
import { ICSVImport } from '../types/index.js';
import { CONSTANTS } from '../config/constants.js';

const csvImportSchema = new Schema<ICSVImport>(
  {
    userId: {
      type: String,
      required: [true, 'User ID is required'],
      ref: 'User',
      index: true,
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
    },
    fileSize: {
      type: Number,
      required: [true, 'File size is required'],
    },
    rowCount: {
      type: Number,
      required: [true, 'Row count is required'],
    },
    importedCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'undone'],
      default: 'pending',
      index: true,
    },
    mapping: {
      type: Schema.Types.Mixed,
      required: [true, 'Field mapping is required'],
    },
    importedRecordIds: [{
      type: String,
    }],
    errorLog: [{
      type: String,
    }],
    undoExpiresAt: {
      type: Date,
      required: true,
      default: function () {
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + CONSTANTS.CSV_UNDO_EXPIRY_HOURS);
        return expiryDate;
      },
      index: true,
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
        if (ret.undoExpiresAt) {
          ret.undoExpiresAt = new Date(ret.undoExpiresAt).toISOString();
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
csvImportSchema.virtual('id').get(function () {
  return this._id.toString();
});

// Indexes
csvImportSchema.index({ userId: 1, createdAt: -1 });
csvImportSchema.index({ status: 1 });

export const CSVImport = mongoose.model<ICSVImport>('CSVImport', csvImportSchema);
export default CSVImport;
