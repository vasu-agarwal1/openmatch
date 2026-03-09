/**
 * Catch-all NextAuth.js API route handler.
 *
 * Routes all requests under /api/auth/* (sign-in, callback, sign-out, session,
 * CSRF token, etc.) through NextAuth.
 *
 * Must export both GET and POST from this file — NextAuth uses GET for
 * redirects/session reads and POST for form submissions / sign-out.
 */

import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
