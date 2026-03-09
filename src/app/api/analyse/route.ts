/**
 * POST /api/analyse
 *
 * Orchestrates the full analysis pipeline:
 *   1. Verify session (must be authenticated)
 *   2. Fetch the user's GitHub profile via GraphQL
 *   3. Upsert the UserProfile document in MongoDB
 *   4. Fetch a pool of matching issues from GitHub
 *   5. Rank the issues with Gemini
 *   6. Generate a getting-started guide for each top match
 *   7. Return the matched issues with guides
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db/mongoose";
import UserProfile from "@/models/UserProfile";
import { fetchGitHubProfile } from "@/lib/github/fetchProfile";
import { fetchIssuePool } from "@/lib/github/fetchIssues";
import { rankIssues, generateGuide } from "@/lib/gemini/matchIssues";

export async function POST() {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accessToken, user } = session;

  try {
    // 2. Fetch GitHub profile
    const profileData = await fetchGitHubProfile(accessToken, user.githubLogin);

    // 3. Upsert UserProfile in MongoDB
    await connectDB();
    await UserProfile.findOneAndUpdate(
      { userId: user.id },
      {
        ...profileData,
        userId: user.id,
        lastAnalysedAt: new Date(),
      },
      { upsert: true, returnDocument: "after" },
    );

    // 4. Fetch issue pool based on user's languages (20 per lang, up to 5 langs)
    const languageNames = profileData.languages.map((l) => l.name);
    const issues = await fetchIssuePool(accessToken, languageNames, 20);

    if (issues.length === 0) {
      return NextResponse.json({
        profile: profileData,
        matches: [],
        message: "No matching issues found for your languages.",
      });
    }

    // 5. Rank with Gemini
    const ranked = await rankIssues(profileData, issues);

    // 6. Generate guides for top 5 (lazy-load the rest on the client)
    const withGuides = await Promise.all(
      ranked.map(async (match, i) => ({
        ...match,
        guide:
          i < 5
            ? await generateGuide(profileData, match.issue)
            : undefined,
      })),
    );

    // 7. Return
    return NextResponse.json({
      profile: profileData,
      matches: withGuides,
    });
  } catch (err) {
    console.error("Analysis failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 },
    );
  }
}
