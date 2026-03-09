"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AlertCircle, GitMerge } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:
    "There is a server configuration problem. Please contact the administrator.",
  AccessDenied: "You do not have permission to access this resource.",
  Verification: "The sign-in link has expired or has already been used.",
  Default: "An unexpected authentication error occurred.",
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = ERROR_MESSAGES[error] ?? ERROR_MESSAGES.Default;

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
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
              <AlertCircle className="h-7 w-7 text-red-400" />
            </div>
            <h1 className="mb-2 text-xl font-bold tracking-tight">Authentication Error</h1>
            <p className="mb-1 text-sm text-zinc-400">{message}</p>
            <p className="mb-6 font-mono text-xs text-zinc-600">code: {error}</p>
            <Link
              href="/auth/signin"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              ← Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense>
      <AuthErrorContent />
    </Suspense>
  );
}
