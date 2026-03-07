"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Github, Loader2, GitMerge } from "lucide-react";
import Link from "next/link";

const AUTH_ERROR_MAP: Record<string, string> = {
  OAuthSignin: "Could not initiate sign-in with GitHub. Please try again.",
  OAuthCallback: "GitHub returned an error during sign-in. Please try again.",
  OAuthAccountNotLinked:
    "Another account is already linked to this email. Sign in with the original provider.",
  AccessDenied:
    "You denied access to your GitHub account. Please try again and accept the permissions.",
  Default: "An unexpected error occurred. Please try again.",
};

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode
    ? (AUTH_ERROR_MAP[errorCode] ?? AUTH_ERROR_MAP.Default)
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* ── Nav ── */}
      <header className="border-b border-zinc-800 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-zinc-100">
          <GitMerge className="h-5 w-5 text-indigo-400" />
          OpenMatch
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/20">
              <GitMerge className="h-7 w-7 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome to OpenMatch</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Discover open-source issues matched to your exact skill level.
            </p>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {errorMessage}
            </div>
          )}

          {/* Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-5 text-center text-sm text-zinc-400">
              Sign in with your GitHub account to get personalised issue recommendations.
            </p>

            <button
              onClick={() => signIn("github", { callbackUrl, redirect: true })}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 active:scale-95"
            >
              <Github className="h-5 w-5" />
              Continue with GitHub
            </button>

            <p className="mt-4 text-center text-xs text-zinc-500">
              We request{" "}
              <span className="font-semibold text-zinc-300">read-only</span>{" "}
              access to your public profile. We never push code or create issues on your behalf.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
