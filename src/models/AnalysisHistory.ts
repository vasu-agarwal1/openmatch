/**
 * AnalysisHistory model — stores past analysis results so users can
 * see their latest matches instantly without re-running the pipeline.
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAnalysisHistory extends Document {
  userId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  profile: any;
  matches: Array<{
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    issue: any;
    score: number;
    reason: string;
    guide?: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const AnalysisHistorySchema = new Schema<IAnalysisHistory>(
  {
    userId: { type: String, required: true, index: true },
    profile: { type: Schema.Types.Mixed, required: true },
    matches: [
      {
        issue: { type: Schema.Types.Mixed, required: true },
        score: { type: Number, required: true },
        reason: { type: String, required: true },
        guide: { type: String },
      },
    ],
  },
  { timestamps: true },
);

// Keep only the latest 5 analyses per user — auto-clean old ones via a TTL
// or we can prune manually. For now, we just query the latest.

const AnalysisHistory: Model<IAnalysisHistory> =
  mongoose.models.AnalysisHistory ||
  mongoose.model<IAnalysisHistory>("AnalysisHistory", AnalysisHistorySchema);

export default AnalysisHistory;
