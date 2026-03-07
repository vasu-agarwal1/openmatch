"use client";

/**
 * Client-side provider wrapper.
 *
 * Next.js App Router Server Components cannot use React context directly.
 * We wrap `SessionProvider` (which internally uses context) in its own
 * Client Component and render it once at the root layout level.
 *
 * Passing the initial `session` prop from the server avoids a client-side
 * fetch on first load, eliminating the "loading" flash on the auth state.
 */

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

interface ProvidersProps {
  children: React.ReactNode;
  session?: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
