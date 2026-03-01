/**
 * NextAuth.js configuration — centralised `authOptions` object.
 *
 * Exported from here (not from the route handler) so it can be imported in
 * Server Components via `getServerSession(authOptions)` without pulling in
 * the full Next.js route API.
 *
 * Scopes requested from GitHub:
 *   read:user   — name, avatar, bio
 *   user:email  — primary email address
 *   read:org    — organisation membership (used later for enriched profiling)
 *
 * Session strategy: JWT (stored in a signed, encrypted cookie).
 * The GitHub OAuth access_token is embedded in the JWT so Server Actions
 * and API Routes can call the GitHub API on behalf of the user without a
 * round-trip to the database.
 *
 * User / account / session documents are persisted to MongoDB via the
 * official @auth/mongodb-adapter, giving us a permanent record per user.
 */

import { NextAuthOptions } from "next-auth";
import GithubProvider from "next-auth/providers/github";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/db/mongodb";

if (!process.env.GITHUB_ID) throw new Error('Missing env var: "GITHUB_ID"');
if (!process.env.GITHUB_SECRET) throw new Error('Missing env var: "GITHUB_SECRET"');
if (!process.env.NEXTAUTH_SECRET) throw new Error('Missing env var: "NEXTAUTH_SECRET"');

export const authOptions: NextAuthOptions = {
  // ── Adapter ────────────────────────────────────────────────────────────────
  // Persists User, Account, and Session documents to MongoDB even though we
  // use JWT sessions; the adapter is still used for the createUser / linkAccount
  // lifecycle hooks on first sign-in.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adapter: MongoDBAdapter(clientPromise) as any,

  // ── Providers ──────────────────────────────────────────────────────────────
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      authorization: {
        params: {
          scope: "read:user user:email read:org",
        },
      },
    }),
  ],

  // ── Session ────────────────────────────────────────────────────────────────
  // JWT strategy allows us to embed the GitHub access_token directly in the
  // session cookie, avoiding a DB round-trip on every authenticated request.
  session: {
    strategy: "jwt",
    // 30-day sliding window; re-sign whenever the user visits within that window
    maxAge: 30 * 24 * 60 * 60,
  },

  // ── Callbacks ──────────────────────────────────────────────────────────────
  callbacks: {
    /**
     * jwt — called whenever a JWT is created or updated.
     * On the initial sign-in `account` and `profile` are populated; on
     * subsequent requests only `token` is present.
     */
    async jwt({ token, account, user, profile }) {
      if (account && user) {
        // Store the GitHub OAuth access_token so we can use it in server code.
        token.accessToken = account.access_token!;
        // MongoDB document id of the User record
        token.userId = user.id;
        // GitHub username (login), e.g. "torvalds"
        token.githubLogin = (profile as { login?: string })?.login ?? "";
      }
      return token;
    },

    /**
     * session — called whenever `getServerSession` or `useSession` is invoked.
     * Shape the public session object that is safe to expose to the client.
     */
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.user.id = token.userId;
      session.user.githubLogin = token.githubLogin;
      return session;
    },
  },

  // ── Custom Pages ───────────────────────────────────────────────────────────
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },

  // ── Debug ──────────────────────────────────────────────────────────────────
  debug: process.env.NODE_ENV === "development",
};
