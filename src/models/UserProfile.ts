/**
 * UserProfile model — stores the developer profile derived from GitHub.
 *
 * Created (or updated) after we call the GitHub GraphQL API to analyse
 * a user's languages, commit history, and contribution patterns.
 *
 * Fields like `languages`, `topRepos`, and `experienceLevel` are used by
 * the Gemini matching service to rank issues.
 *
 * The `userId` field is the MongoDB ObjectId created by the NextAuth adapter
 * in the `users` collection.
 */

import mongoose, { Schema, Document, Model } from "mongoose";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ILanguageStat {
  name: string;       // e.g. "TypeScript"
  percentage: number; // 0–100
  bytes: number;      // total bytes of code
}

export interface ITopRepo {
  name: string;          // "owner/repo"
  description: string;
  url: string;
  stars: number;
  primaryLanguage: string;
  commitCount: number;   // user's commits in this repo
}

export interface IUserProfile extends Document {
  userId: string;           // NextAuth User._id
  githubLogin: string;      // e.g. "torvalds"
  name: string;
  avatarUrl: string;
  bio: string;
  languages: ILanguageStat[];
  topRepos: ITopRepo[];
  totalCommits: number;
  totalPRs: number;
  totalStars: number;
  followers: number;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  lastAnalysedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ───────────────────────────────────────────────────────────────────

const LanguageStatSchema = new Schema<ILanguageStat>(
  {
    name: { type: String, required: true },
    percentage: { type: Number, required: true },
    bytes: { type: Number, required: true },
  },
  { _id: false },
);

const TopRepoSchema = new Schema<ITopRepo>(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    url: { type: String, required: true },
    stars: { type: Number, default: 0 },
    primaryLanguage: { type: String, default: "" },
    commitCount: { type: Number, default: 0 },
  },
  { _id: false },
);

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    githubLogin: { type: String, required: true, unique: true },
    name: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    bio: { type: String, default: "" },
    languages: { type: [LanguageStatSchema], default: [] },
    topRepos: { type: [TopRepoSchema], default: [] },
    totalCommits: { type: Number, default: 0 },
    totalPRs: { type: Number, default: 0 },
    totalStars: { type: Number, default: 0 },
    followers: { type: Number, default: 0 },
    experienceLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced"],
      default: "beginner",
    },
    lastAnalysedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── Model ────────────────────────────────────────────────────────────────────
// Reuse existing model if it was already compiled (HMR in dev)

const UserProfile: Model<IUserProfile> =
  mongoose.models.UserProfile ||
  mongoose.model<IUserProfile>("UserProfile", UserProfileSchema);

export default UserProfile;
