import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Github, ArrowRight, GitMerge, Zap, Target, BookOpen, Star, Code2 } from "lucide-react";

const FEATURES = [
  {
    icon: Target,
    title: "Skill-Level Matching",
    description:
      "We analyse your GitHub commit history, languages, and contribution patterns to understand your actual experience — not your self-reported level.",
  },
  {
    icon: Zap,
    title: "AI-Powered Ranking",
    description:
      "Google Gemini embeds both your profile and open issues into a shared vector space, then ranks the issues most likely to be a great fit for you.",
  },
  {
    icon: BookOpen,
    title: "Getting-Started Guides",
    description:
      "For each matched issue, Gemini generates a concise guide: what the codebase does, which files to read first, and a suggested first step.",
  },
];

const HOW_IT_WORKS = [
  { step: "01", title: "Sign in with GitHub", description: "Read-only access to your public profile and repos." },
  { step: "02", title: "We build your profile", description: "Languages, commits, and starred repos via GitHub GraphQL." },
  { step: "03", title: "Issues are ranked for you", description: "Gemini matches your profile against a curated issue pool." },
  { step: "04", title: "Start contributing", description: "Pick an issue, read the AI guide, and make your first PR." },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-zinc-100">
            <GitMerge className="h-5 w-5 text-indigo-400" />
            OpenMatch
          </Link>
          <nav>
            {session ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                href="/auth/signin"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
              >
                <Github className="h-4 w-4" />
                Sign in with GitHub
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden py-28 sm:py-36">
          {/* subtle radial glow */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[600px] w-[600px] rounded-full bg-indigo-600/10 blur-3xl" />
          </div>

          <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
            <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
              <Star className="h-3 w-3" />
              AI-powered open-source matchmaking
            </span>

            <h1 className="mt-4 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
              Find open-source issues{" "}
              <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                made for you
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-lg text-zinc-400">
              OpenMatch analyses your GitHub history and uses AI to surface the
              issues you are most likely to solve — and gives you a guide to get started.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={session ? "/dashboard" : "/auth/signin"}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
              >
                <Github className="h-5 w-5" />
                {session ? "Go to Dashboard" : "Get matched — it's free"}
              </Link>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-6 py-3 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                <Code2 className="h-5 w-5" />
                Browse on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="border-t border-zinc-800 bg-zinc-900/50 py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight">Why OpenMatch?</h2>
              <p className="mt-3 text-zinc-400">
                Stop scrolling through hundreds of issues. Let AI do the work.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <div
                  key={title}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-indigo-500/40"
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10">
                    <Icon className="h-5 w-5 text-indigo-400" />
                  </div>
                  <h3 className="mb-2 font-semibold text-zinc-100">{title}</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight">How it works</h2>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_IT_WORKS.map(({ step, title, description }) => (
                <div key={step} className="flex flex-col gap-3">
                  <span className="text-4xl font-black text-indigo-500/30">{step}</span>
                  <h3 className="font-semibold text-zinc-100">{title}</h3>
                  <p className="text-sm text-zinc-400">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="border-t border-zinc-800 bg-zinc-900/50 py-20">
          <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">Ready to contribute?</h2>
            <p className="mt-4 text-zinc-400">
              Sign in with GitHub — no extra account needed. We only request read-only access.
            </p>
            <Link
              href={session ? "/dashboard" : "/auth/signin"}
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500"
            >
              <Github className="h-5 w-5" />
              {session ? "Go to Dashboard" : "Sign in with GitHub"}
            </Link>
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-zinc-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-indigo-400" />
            <span>OpenMatch</span>
          </div>
          <p>Built with Next.js, NextAuth, MongoDB &amp; Google Gemini.</p>
        </div>
      </footer>

    </div>
  );
}
