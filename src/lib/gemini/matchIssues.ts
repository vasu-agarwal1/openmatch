/**
 * Gemini API — match issues to a developer profile & generate guides.
 *
 * Two main functions:
 *
 * 1. `rankIssues`  — sends the user profile + issue pool to Gemini and asks
 *    it to pick the top 5 issues most suited to the developer, with a match
 *    score and a short rationale for each.
 *
 * 2. `generateGuide` — for a single matched issue, asks Gemini for a concise
 *    "Getting Started" guide (what the codebase does, where to start, first step).
 *
 * We use the Gemini REST API (v1beta) via plain `fetch` — no SDK needed.
 */

import type { GitHubProfileData } from "@/lib/github/fetchProfile";
import type { GitHubIssue } from "@/lib/github/fetchIssues";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing env var: GEMINI_API_KEY");
  return key;
}

/** Fetch with retry — automatically retries on 429 (rate-limit) up to 3 times
 *  with exponential back-off (2 s → 4 s → 8 s). */
async function geminiPost(body: object): Promise<Response> {
  const url = `${GEMINI_URL}?key=${apiKey()}`;
  const opts: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };

  let lastRes: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    lastRes = await fetch(url, opts);
    if (lastRes.status !== 429 && lastRes.status !== 503) return lastRes;
    // wait before retrying (prefer server-provided retry delay when available)
    let delay = 2000 * Math.pow(2, attempt); // 2s, 4s, 8s
    try {
      const json = await lastRes.clone().json();
      const retryInfo = json?.error?.details?.find(
        (d: { "@type"?: string }) =>
          d?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo",
      );
      const retryDelay = retryInfo?.retryDelay as string | undefined;
      if (retryDelay) {
        const seconds = Number.parseFloat(retryDelay.replace("s", ""));
        if (!Number.isNaN(seconds) && seconds > 0) {
          delay = Math.round(seconds * 1000);
        }
      }
    } catch {
      // ignore parse issues, keep exponential backoff
    }
    console.warn(
      `Gemini ${lastRes.status} – retrying in ${delay / 1000}s (attempt ${attempt + 1}/3)`,
    );
    await new Promise((r) => setTimeout(r, delay));
  }
  return lastRes!;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function heuristicRankIssues(
  profile: GitHubProfileData,
  issues: GitHubIssue[],
  limit = 10,
): MatchedIssue[] {
  const topLanguages = new Set(
    profile.languages.slice(0, 5).map((l) => l.name.toLowerCase()),
  );

  const ranked = issues.map((issue) => {
    let score = 30;

    if (topLanguages.has(issue.repoLanguage.toLowerCase())) score += 25;

    const labelsLower = issue.labels.map((l) => l.toLowerCase());
    if (labelsLower.some((l) => l.includes("good first issue"))) score += 20;
    if (labelsLower.some((l) => l.includes("help wanted"))) score += 8;

    const daysOld =
      (Date.now() - new Date(issue.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysOld <= 14) score += 12;
    else if (daysOld <= 30) score += 8;
    else if (daysOld <= 90) score += 4;

    score += clamp(Math.log10(issue.repoStars + 1) * 6, 0, 12);
    score += clamp(Math.log10(issue.commentCount + issue.reactionCount + 1) * 3, 0, 6);

    const roundedScore = Math.round(clamp(score, 0, 100));
    const reason =
      `Matched via language fit (${issue.repoLanguage || "unknown"}), issue freshness, and repository activity.`;

    return {
      issue,
      score: roundedScore,
      reason,
    };
  });

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface MatchedIssue {
  /** Original issue data */
  issue: GitHubIssue;
  /** 0–100 match score assigned by Gemini */
  score: number;
  /** One-sentence rationale for the match */
  reason: string;
  /** AI-generated getting-started guide (populated separately) */
  guide?: string;
}

// ── 1. Rank issues ──────────────────────────────────────────────────────────

export async function rankIssues(
  profile: GitHubProfileData,
  issues: GitHubIssue[],
): Promise<MatchedIssue[]> {
  const candidateIssues = issues.slice(0, 40);

  // Build a concise profile summary for the prompt
  const profileSummary = [
    `GitHub: @${profile.githubLogin}`,
    `Level: ${profile.experienceLevel}`,
    `Languages: ${profile.languages.map((l) => `${l.name} (${l.percentage}%)`).join(", ")}`,
    `Commits: ${profile.totalCommits}, PRs: ${profile.totalPRs}, Stars: ${profile.totalStars}`,
    `Top repos: ${profile.topRepos.slice(0, 5).map((r) => r.name).join(", ")}`,
  ].join("\n");

  // Trim each issue to essentials so the prompt stays small
  const issueList = candidateIssues.map((iss, i) => ({
    idx: i,
    title: iss.title,
    repo: iss.repoName,
    lang: iss.repoLanguage,
    stars: iss.repoStars,
    labels: iss.labels.join(", "),
    body: iss.body.slice(0, 200),
  }));

  const prompt = `You are an expert open-source mentor.

DEVELOPER PROFILE:
${profileSummary}

CANDIDATE ISSUES (JSON array):
${JSON.stringify(issueList, null, 2)}

TASK:
Pick the top 10 issues best suited for this developer (or fewer if less are available). Consider:
- Language overlap with the developer's skills
- Issue complexity vs the developer's experience level
- Repo popularity (stars) and community activity
- How well the issue description aligns with the developer's background
- Recency — prefer recently created issues

Return ONLY a valid JSON array (no markdown, no explanation) with up to 10 objects:
[
  { "idx": <number>, "score": <0-100>, "reason": "<one sentence>" },
  ...
]

Sort by score descending. Respond with the JSON array only.`;

  const res = await geminiPost({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    if (
      res.status === 429 ||
      res.status === 503 ||
      body.includes("RESOURCE_EXHAUSTED") ||
      body.includes("UNAVAILABLE")
    ) {
      console.warn("Gemini quota reached, using heuristic ranking fallback.");
      return heuristicRankIssues(profile, issues, 10);
    }
    throw new Error(`Gemini API error ${res.status}: ${body}`);
  }

  const json = await res.json();

  // Gemini 2.5 models may return thinking + response in separate parts.
  // Grab the last text part which is the actual answer.
  const parts: Array<{ text?: string }> =
    json?.candidates?.[0]?.content?.parts ?? [];
  let rawText =
    parts
      .filter((p: { text?: string }) => p.text)
      .map((p: { text?: string }) => p.text!)
      .pop() ?? "[]";

  // Strip markdown code fences that Gemini often wraps around JSON
  rawText = rawText.replace(/```(?:json)?\s*/gi, "").trim();

  // Extract JSON array from the response
  let jsonMatch = rawText.match(/\[[\s\S]*\]/);

  // If no complete array found, try to repair truncated JSON
  if (!jsonMatch) {
    const start = rawText.indexOf("[");
    if (start !== -1) {
      let partial = rawText.slice(start);
      // Close any unclosed strings / objects, then close the array
      if (!partial.endsWith("]")) {
        // Remove last incomplete object
        const lastComplete = partial.lastIndexOf("}");
        if (lastComplete !== -1) {
          partial = partial.slice(0, lastComplete + 1) + "]";
        }
      }
      jsonMatch = partial.match(/\[[\s\S]*\]/);
    }
  }

  if (!jsonMatch) {
    console.error("Gemini returned non-JSON:", rawText.slice(0, 300));
    return heuristicRankIssues(profile, issues, 10);
  }

  let ranked: Array<{ idx: number; score: number; reason: string }>;
  try {
    ranked = JSON.parse(jsonMatch[0]);
  } catch {
    console.error("Failed to parse Gemini ranking:", jsonMatch[0].slice(0, 300));
    return heuristicRankIssues(profile, issues, 10);
  }

  return ranked
    .filter((r) => r.idx >= 0 && r.idx < candidateIssues.length)
    .map((r) => ({
      issue: candidateIssues[r.idx],
      score: r.score,
      reason: r.reason,
    }))
    .slice(0, 10);
}

// ── 2. Generate getting-started guide ────────────────────────────────────────

export async function generateGuide(
  profile: GitHubProfileData,
  issue: GitHubIssue,
): Promise<string> {
  const prompt = `You are a friendly open-source mentor helping a ${profile.experienceLevel}-level developer.

ISSUE:
Title: ${issue.title}
Repo: ${issue.repoName} (${issue.repoLanguage}, ★ ${issue.repoStars})
URL: ${issue.url}
Labels: ${issue.labels.join(", ")}
Description:
${issue.body.slice(0, 400)}

Write a concise "Getting Started" guide (max 200 words) with:
1. **What this repo does** — one sentence
2. **Key files to read first** — 2-3 likely file paths
3. **Suggested first step** — a concrete, actionable step

Use Markdown formatting. Be encouraging and practical.`;

  const res = await geminiPost({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 512,
    },
  });

  if (!res.ok) {
    return "_Could not generate a guide at this time._";
  }

  const json = await res.json();
  return (
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "_No guide generated._"
  );
}
