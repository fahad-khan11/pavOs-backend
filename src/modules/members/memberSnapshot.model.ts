import mongoose, { Schema } from "mongoose";

export type MemberSnapshotDoc = {
  companyId: string;
  memberId: string;
  payload: Record<string, unknown>;
  lastSyncedAt: Date;
};

const memberSnapshotSchema = new Schema<MemberSnapshotDoc>(
  {
    companyId: { type: String, index: true, required: true },
    memberId: { type: String, index: true, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    lastSyncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

memberSnapshotSchema.index({ companyId: 1, memberId: 1 }, { unique: true });

export const MemberSnapshot = mongoose.model<MemberSnapshotDoc>(
  "MemberSnapshot",
  memberSnapshotSchema
);
