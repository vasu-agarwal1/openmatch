/**
 * POST /api/analyse
 *
 * Orchestrates the full analysis pipeline with streaming progress:
 *   1. Verify session (must be authenticated)
 *   2. Fetch the user's GitHub profile via GraphQL
 *   3. Upsert the UserProfile document in MongoDB
 *   4. Fetch a pool of matching issues from GitHub
 *   5. Rank the issues with Gemini
 *   6. Generate a getting-started guide for each top match
 *   7. Save analysis result to AnalysisHistory
 *   8. Stream each step's status to the client via SSE-style JSON lines
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import connectDB from "@/lib/db/mongoose";
import UserProfile from "@/models/UserProfile";
import AnalysisHistory from "@/models/AnalysisHistory";
import { fetchGitHubProfile } from "@/lib/github/fetchProfile";
import { fetchIssuePool } from "@/lib/github/fetchIssues";
import { rankIssues, generateGuide } from "@/lib/gemini/matchIssues";

export async function POST() {
  // 1. Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { accessToken, user } = session;

  // Create a streaming response using ReadableStream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      }

      try {
        // Step 1: Fetch GitHub profile
        send({ step: 1, label: "Fetching your GitHub profile…" });
        const profileData = await fetchGitHubProfile(accessToken, user.githubLogin);
        send({ step: 1, done: true });

        // Step 2: Save profile to MongoDB
        send({ step: 2, label: "Saving profile to database…" });
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
        send({ step: 2, done: true });

        // Step 3: Fetch issue pool
        send({ step: 3, label: "Searching GitHub for open issues…" });
        const languageNames = profileData.languages.map((l) => l.name);
        const issues = await fetchIssuePool(accessToken, languageNames, 20);
        send({ step: 3, done: true, issueCount: issues.length });

        if (issues.length === 0) {
          send({
            step: 4,
            label: "No matching issues found.",
            done: true,
            result: { profile: profileData, matches: [] },
          });
          controller.close();
          return;
        }

        // Step 4: Rank with Gemini
        send({ step: 4, label: "AI is ranking the best issues for you…" });
        const ranked = await rankIssues(profileData, issues);
        send({ step: 4, done: true, matchCount: ranked.length });

        // Step 5: Generate guides (top 2 only to keep Gemini usage low)
        send({ step: 5, label: "Generating getting-started guides…" });
        const withGuides = await Promise.all(
          ranked.map(async (match, i) => ({
            ...match,
            guide:
              i < 2
                ? await generateGuide(profileData, match.issue)
                : undefined,
          })),
        );
        send({ step: 5, done: true });

        // Step 6: Save to analysis history
        await connectDB();
        await AnalysisHistory.create({
          userId: user.id,
          profile: profileData,
          matches: withGuides.map((m) => ({
            issue: m.issue,
            score: m.score,
            reason: m.reason,
            guide: m.guide,
          })),
        });

        // Final result
        send({
          step: 6,
          done: true,
          label: "Done!",
          result: {
            profile: profileData,
            matches: withGuides,
          },
        });
      } catch (err) {
        console.error("Analysis failed:", err);
        send({
          error: err instanceof Error ? err.message : "Analysis failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "Cache-Control": "no-cache",
    },
  });
}

// GET /api/analyse — return last analysis from history
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await connectDB();
  const last = await AnalysisHistory.findOne({ userId: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  if (!last) {
    return new Response(JSON.stringify({ history: null }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      history: {
        profile: last.profile,
        matches: last.matches,
        createdAt: last.createdAt,
      },
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}
