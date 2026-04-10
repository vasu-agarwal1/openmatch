"use client";



import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
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
  Clock,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Circle,
  History,
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

// ── Progress steps ───────────────────────────────────────────────────────────

const STEPS = [
  "Fetching your GitHub profile",
  "Saving profile to database",
  "Searching GitHub for open issues",
  "AI is ranking the best issues",
  "Generating getting-started guides",
  "Done!",
];

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardClient({ user }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [matches, setMatches] = useState<MatchedIssue[]>([]);
  const [expandedGuide, setExpandedGuide] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [bookmarkedUrls, setBookmarkedUrls] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<MatchedIssue[]>([]);
  const [activeTab, setActiveTab] = useState<"matches" | "saved">("matches");
  const [historyDate, setHistoryDate] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // ── Load last analysis & bookmarks on mount ──────────────────────────────

  const loadHistory = useCallback(async () => {
    try {
      const [histRes, bookRes] = await Promise.all([
        fetch("/api/analyse"),
        fetch("/api/bookmarks"),
      ]);

      if (histRes.ok) {
        const { history } = await histRes.json();
        if (history) {
          setProfile(history.profile);
          setMatches(history.matches ?? []);
          setHistoryDate(history.createdAt);
        }
      }

      if (bookRes.ok) {
        const { bookmarks: bmarks } = await bookRes.json();
        setBookmarkedUrls(
          new Set(bmarks.map((b: { issueUrl: string }) => b.issueUrl)),
        );
        setBookmarks(
          bmarks.map((b: { issue: MatchedIssue["issue"]; score: number; reason: string; guide?: string }) => ({
            issue: b.issue,
            score: b.score,
            reason: b.reason,
            guide: b.guide,
          })),
        );
      }
    } catch {
      // Silent — user can still run a fresh analysis
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // ── Streaming analysis ───────────────────────────────────────────────────

  async function handleAnalyse() {
    setLoading(true);
    setError(null);
    setCurrentStep(0);
    setCompletedSteps(new Set());

    try {
      const res = await fetch("/api/analyse", { method: "POST" });

      if (!res.ok && !res.body) {
        const data = await res.json();
        setError(data.error ?? "Analysis failed");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError("No response stream");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);

            if (event.error) {
              setError(event.error);
              return;
            }

            if (event.step !== undefined) {
              setCurrentStep(event.step);
              if (event.done) {
                setCompletedSteps((prev) => new Set([...prev, event.step]));
              }
            }

            if (event.result) {
              setProfile(event.result.profile);
              setMatches(event.result.matches ?? []);
              setHistoryDate(new Date().toISOString());
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  // ── Bookmark toggle ──────────────────────────────────────────────────────

  async function toggleBookmark(m: MatchedIssue) {
    try {
      const res = await fetch("/api/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          issue: m.issue,
          score: m.score,
          reason: m.reason,
          guide: m.guide,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBookmarkedUrls((prev) => {
          const next = new Set(prev);
          if (data.bookmarked) {
            next.add(data.issueUrl);
          } else {
            next.delete(data.issueUrl);
          }
          return next;
        });
        // Sync bookmarks list
        if (data.bookmarked) {
          setBookmarks((prev) => [{ issue: m.issue, score: m.score, reason: m.reason, guide: m.guide }, ...prev]);
        } else {
          setBookmarks((prev) => prev.filter((b) => b.issue.url !== m.issue.url));
        }
      }
    } catch {
      // Silent fail
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
        {historyDate && !loading && (
          <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
            <History className="h-3 w-3" />
            Last analysis:{" "}
            {new Date(historyDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>

      {/* ── Stat cards ── */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {/* GitHub account */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">
            GitHub account
          </p>
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
                className="flex items-center gap-1 text-xs text-zinc-400 transition hover:text-indigo-400"
              >
                <Github className="h-3 w-3" />@{user.githubLogin}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* Profile status */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">
            Profile status
          </p>
          {analysed ? (
            <>
              <span className="inline-flex items-center rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400 ring-1 ring-green-500/20">
                {profile.experienceLevel}
              </span>
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.languages.slice(0, 4).map((l) => (
                  <span
                    key={l.name}
                    className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300"
                  >
                    {l.name} {l.percentage}%
                  </span>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="inline-flex items-center rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700">
                {loadingHistory ? "Loading…" : "Not yet analysed"}
              </span>
              {!loadingHistory && (
                <p className="mt-2 text-xs text-zinc-500">
                  Run an analysis to get matched issues.
                </p>
              )}
            </>
          )}
        </div>

        {/* Matches */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500">
            Matches found
          </p>
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

      {/* ── Progress steps (visible during loading) ── */}
      {loading && (
        <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h3 className="mb-4 text-sm font-semibold text-zinc-100">
            Analysis in progress…
          </h3>
          <div className="space-y-3">
            {STEPS.map((label, i) => {
              const stepNum = i + 1;
              const isDone = completedSteps.has(stepNum);
              const isCurrent = currentStep === stepNum && !isDone;
              const isPending = stepNum > currentStep;

              return (
                <div
                  key={stepNum}
                  className={`flex items-center gap-3 text-sm transition-opacity ${
                    isPending ? "opacity-30" : "opacity-100"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
                  ) : isCurrent ? (
                    <Loader2 className="h-5 w-5 shrink-0 animate-spin text-indigo-400" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-zinc-600" />
                  )}
                  <span
                    className={
                      isDone
                        ? "text-zinc-400 line-through"
                        : isCurrent
                          ? "font-medium text-indigo-300"
                          : "text-zinc-500"
                    }
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Analyse CTA ── */}
      {!loading && (
        <div className="mb-8 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-6">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
            <Zap className="h-5 w-5 text-indigo-400" />
          </div>
          <h2 className="mb-1 font-semibold text-zinc-100">
            {analysed ? "Re-analyse your profile" : "Analyse your GitHub profile"}
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            OpenMatch will fetch your languages and commit history, then use
            Gemini to rank the best open-source issues for you.
          </p>
          <button
            onClick={handleAnalyse}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Zap className="h-4 w-4" />
            {analysed ? "Re-run analysis" : "Find my matches"}
          </button>
        </div>
      )}

      {/* ── Tab switcher ── */}
      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-800 bg-zinc-900 p-1 w-fit">
        <button
          onClick={() => setActiveTab("matches")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "matches"
              ? "bg-indigo-600 text-white shadow"
              : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          Matches {matches.length > 0 && `(${matches.length})`}
        </button>
        <button
          onClick={() => setActiveTab("saved")}
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "saved"
              ? "bg-amber-600 text-white shadow"
              : "text-zinc-400 hover:text-zinc-100"
          }`}
        >
          <BookmarkCheck className="h-3.5 w-3.5" />
          Saved {bookmarks.length > 0 && `(${bookmarks.length})`}
        </button>
      </div>

      {/* ── Issues section ── */}
      <div>
        <h2 className="mb-4 text-base font-semibold text-zinc-100">
          {activeTab === "matches" ? "Your matched issues" : "Your saved issues"}
        </h2>

        {matches.length > 0 && activeTab === "matches" ? (
          <div className="grid gap-4">
            {matches.map((m, i) => {
              const isBookmarked = bookmarkedUrls.has(m.issue.url);

              return (
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
                        className="font-semibold text-zinc-100 transition hover:text-indigo-400"
                      >
                        {m.issue.title}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <a
                          href={m.issue.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 transition hover:text-indigo-400"
                        >
                          <Github className="h-3 w-3" />
                          {m.issue.repoName}
                        </a>
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3" />{" "}
                          {m.issue.repoStars.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" />{" "}
                          {m.issue.commentCount}
                        </span>
                        {m.issue.createdAt && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {new Date(m.issue.createdAt).toLocaleDateString(
                              "en-GB",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              },
                            )}
                          </span>
                        )}
                        {m.issue.repoLanguage && (
                          <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                            {m.issue.repoLanguage}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score + Bookmark */}
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleBookmark(m)}
                        title={isBookmarked ? "Remove bookmark" : "Bookmark issue"}
                        className="rounded-lg p-1.5 transition hover:bg-zinc-800"
                      >
                        {isBookmarked ? (
                          <BookmarkCheck className="h-5 w-5 text-amber-400" />
                        ) : (
                          <Bookmark className="h-5 w-5 text-zinc-500 hover:text-amber-400" />
                        )}
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-indigo-400">
                          {m.score}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                          match
                        </span>
                      </div>
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
                        onClick={() =>
                          setExpandedGuide(expandedGuide === i ? null : i)
                        }
                        className="flex items-center gap-1 text-xs font-medium text-indigo-400 transition hover:text-indigo-300"
                      >
                        {expandedGuide === i ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" /> Hide guide
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" /> Getting
                            started guide
                          </>
                        )}
                      </button>
                      {expandedGuide === i && (
                        <div className="prose prose-sm prose-invert mt-3 max-w-none rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-sm leading-relaxed text-zinc-300">
                          <ReactMarkdown>{m.guide}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : activeTab === "saved" ? (
          bookmarks.length > 0 ? (
            <div className="grid gap-4">
              {bookmarks.map((m, i) => (
                <div
                  key={m.issue.url}
                  className="rounded-xl border border-amber-500/20 bg-zinc-900 p-5 transition hover:border-amber-500/40"
                >
                  {/* Header */}
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <a
                        href={m.issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-zinc-100 transition hover:text-indigo-400"
                      >
                        {m.issue.title}
                      </a>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <a
                          href={m.issue.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 transition hover:text-indigo-400"
                        >
                          <Github className="h-3 w-3" />
                          {m.issue.repoName}
                        </a>
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3" />{" "}
                          {m.issue.repoStars.toLocaleString()}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" />{" "}
                          {m.issue.commentCount}
                        </span>
                        {m.issue.createdAt && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {new Date(m.issue.createdAt).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short", year: "numeric" },
                            )}
                          </span>
                        )}
                        {m.issue.repoLanguage && (
                          <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                            {m.issue.repoLanguage}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score + Remove bookmark */}
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleBookmark(m)}
                        title="Remove bookmark"
                        className="rounded-lg p-1.5 transition hover:bg-zinc-800"
                      >
                        <BookmarkCheck className="h-5 w-5 text-amber-400" />
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-bold text-indigo-400">
                          {m.score}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                          match
                        </span>
                      </div>
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
                        onClick={() =>
                          setExpandedGuide(expandedGuide === i + 1000 ? null : i + 1000)
                        }
                        className="flex items-center gap-1 text-xs font-medium text-indigo-400 transition hover:text-indigo-300"
                      >
                        {expandedGuide === i + 1000 ? (
                          <>
                            <ChevronUp className="h-3.5 w-3.5" /> Hide guide
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3.5 w-3.5" /> Getting
                            started guide
                          </>
                        )}
                      </button>
                      {expandedGuide === i + 1000 && (
                        <div className="prose prose-sm prose-invert mt-3 max-w-none rounded-lg border border-zinc-700 bg-zinc-800 p-4 text-sm leading-relaxed text-zinc-300">
                          <ReactMarkdown>{m.guide}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50 p-10 text-center">
              <Bookmark className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-400">No saved issues yet</p>
              <p className="mt-1 text-xs text-zinc-500">
                Click the bookmark icon on any matched issue to save it here.
              </p>
            </div>
          )
        ) : loadingHistory ? (
          /* Loading skeleton */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-xl border border-zinc-800 bg-zinc-900 p-5"
              >
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
        ) : (
          /* Empty state */
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 opacity-30"
                >
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
