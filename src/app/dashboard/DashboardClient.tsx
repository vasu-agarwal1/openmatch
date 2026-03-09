"use client";

/**
 * DashboardClient — interactive dashboard body.
 *
 * Receives session user data as props from the server component.
 * Handles the "Analyse" button click, loading state, and rendering
 * matched issues returned from POST /api/analyse.
 */

import { useState } from "react";
import Image from "next/image";
import {
  Zap,
  Github,
  ExternalLink,
  Star,
  MessageSquare,
  Loader2,
  ChevronDown,
  ChevronUp,
  Tag,
} from "lucide-react";

// ── Types (mirroring API response) ───────────────────────────────────────────

interface LanguageStat {
  name: string;
  percentage: number;
}

interface MatchedIssue {
  issue: {
    title: string;
    url: string;
    body: string;
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
}

interface ProfileData {
  githubLogin: string;
  name: string;
  avatarUrl: string;
  bio: string;
  followers: number;
  totalCommits: number;
  totalPRs: number;
  totalStars: number;
  languages: LanguageStat[];
  experienceLevel: string;
}

interface Props {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    githubLogin: string;
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardClient({ user }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [matches, setMatches] = useState<MatchedIssue[]>([]);
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);

  async function handleAnalyse() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analyse", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Analysis failed");
        return;
      }

      setProfile(data.profile);
      setMatches(data.matches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  const analysed = profile !== null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">

      {/* ── Welcome ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome back, {user.name?.split(" ")[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Here are your personalised open-source issue matches.
        </p>
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {/* GitHub account */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">GitHub account</p>
          <div className="flex items-center gap-3">
            {user.image && (
              <Image
                src={user.image}
                alt={user.name ?? "avatar"}
                width={40}
                height={40}
                className="rounded-full"
              />
            )}
            <div>
              <p className="font-semibold text-zinc-100">{user.name}</p>
              <a
                href={`https://github.com/${user.githubLogin}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-indigo-400 transition"
              >
                <Github className="h-3 w-3" />@{user.githubLogin}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Profile status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">Profile status</p>
          {analysed ? (
            <>
              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400 ring-1 ring-green-500/20">
                {profile.experienceLevel}
              </span>
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.languages.slice(0, 4).map((l) => (
                  <span key={l.name} className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                    {l.name} {l.percentage}%
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700">
                Not yet analysed
              </span>
              <p className="mt-2 text-xs text-zinc-500">Run an analysis to get matched issues.</p>
            </>
          )}
        </div>

        {/* Matches */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">Matches found</p>
          <p className="text-3xl font-bold text-zinc-100">
            {analysed ? matches.length : "—"}
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {analysed
              ? `${profile.totalCommits} commits · ${profile.totalPRs} PRs · ${profile.totalStars} ★`
              : "No analysis run yet."}
          </p>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* ── Analyse CTA ── */}
      <div className="mb-8 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-6">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
          <Zap className="h-5 w-5 text-indigo-400" />
        </div>
        <h2 className="mb-1 font-semibold text-zinc-100">
          {analysed ? "Re-analyse your profile" : "Analyse your GitHub profile"}
        </h2>
        <p className="mb-4 text-sm text-zinc-400">
          OpenMatch will fetch your languages and commit history, then use Gemini
          to rank the best open-source issues for you.
        </p>
        <button
          onClick={handleAnalyse}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analysing…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              {analysed ? "Re-run analysis" : "Find my matches"}
            </>
          )}
        </button>
      </div>

      {/* ── Matched issues ── */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-zinc-100">Your matched issues</h2>

        {matches.length > 0 ? (
          <div className="grid gap-4">
            {matches.map((m, i) => (
              <div
                key={m.issue.url}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-indigo-500/30"
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <a
                      href={m.issue.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-zinc-100 hover:text-indigo-400 transition"
                    >
                      {m.issue.title}
                    </a>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                      <a
                        href={m.issue.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 hover:text-indigo-400 transition"
                      >
                        <Github className="h-3 w-3" />
                        {m.issue.repoName}
                      </a>
                      <span className="flex items-center gap-0.5">
                        <Star className="h-3 w-3" /> {m.issue.repoStars.toLocaleString()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" /> {m.issue.commentCount}
                      </span>
                      {m.issue.repoLanguage && (
                        <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                          {m.issue.repoLanguage}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Score badge */}
                  <div className="flex flex-col items-center">
                    <span className="text-2xl font-bold text-indigo-400">{m.score}</span>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">match</span>
                  </div>
                </div>

                {/* Labels */}
                {m.issue.labels.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {m.issue.labels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reason */}
                <p className="mb-3 text-sm text-zinc-400">{m.reason}</p>

                {/* Guide toggle */}
                {m.guide && (
                  <div>
                    <button
                      onClick={() => setExpandedGuide(expandedGuide === i ? null : i)}
                      className="flex items-center gap-1 text-xs font-medium text-indigo-400 transition hover:text-indigo-300"
                    >
                      {expandedGuide === i ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> Hide guide
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> Getting started guide
                        </>
                      )}
                    </button>
                    {expandedGuide === i && (
                      <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-sm leading-relaxed text-zinc-300 prose-invert prose-sm">
                        {m.guide.split("\n").map((line, j) => (
                          <p key={j} className={line.trim() === "" ? "h-2" : ""}>
                            {line.startsWith("**") ? (
                              <strong className="text-zinc-100">{line.replace(/\*\*/g, "")}</strong>
                            ) : (
                              line
                            )}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* Skeleton cards */
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 opacity-30">
                  <div className="mb-3 h-4 w-3/4 rounded-md bg-zinc-700" />
                  <div className="mb-4 h-3 w-1/2 rounded-md bg-zinc-800" />
                  <div className="space-y-2">
                    <div className="h-3 w-full rounded-md bg-zinc-800" />
                    <div className="h-3 w-5/6 rounded-md bg-zinc-800" />
                    <div className="h-3 w-4/6 rounded-md bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-zinc-500">
              Run an analysis above to populate your matches.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
