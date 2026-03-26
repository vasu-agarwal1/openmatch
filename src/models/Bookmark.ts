/**
 * Bookmark model — stores issues bookmarked by the user.
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBookmark extends Document {
  userId: string;
  issueUrl: string;
  issue: {
    title: string;
    url: string;
    body: string;
    createdAt: string;
    labels: string[];
    repoName: string;
    repoUrl: string;
    repoStars: number;
    repoLanguage: string;
    commentCount: number;
    reactionCount: number;
  };
  score: number;
  reason: string;
  guide?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookmarkSchema = new Schema<IBookmark>(
  {
    userId: { type: String, required: true, index: true },
    issueUrl: { type: String, required: true },
    issue: { type: Schema.Types.Mixed, required: true },
    score: { type: Number, required: true },
    reason: { type: String, required: true },
    guide: { type: String },
  },
  { timestamps: true },
);

// One bookmark per user per issue
BookmarkSchema.index({ userId: 1, issueUrl: 1 }, { unique: true });

const Bookmark: Model<IBookmark> =
  mongoose.models.Bookmark ||
  mongoose.model<IBookmark>("Bookmark", BookmarkSchema);

export default Bookmark;
