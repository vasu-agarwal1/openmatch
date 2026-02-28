/**
 * Next.js 16 Proxy — route protection.
 *
 * Next.js 16 renamed "middleware" to "proxy". The file must export a function
 * as its default export (or as a named "proxy" export).
 *
 * `withAuth` from `next-auth/middleware` automatically redirects unauthenticated
 * requests to the `pages.signIn` URL configured in `authOptions` (/auth/signin).
 *
 * The `config.matcher` array controls which routes are protected.
 * Add any new authenticated-only path prefixes here as the app grows.
 *
 * Public routes (/, /auth/*, /api/auth/*) are NOT listed in the matcher
 * and therefore bypass auth checks entirely.
 */

import withAuth from "next-auth/middleware";

export default withAuth;

export const config = {
  matcher: [
    // Protect everything under /dashboard
    "/dashboard/:path*",
    // Add more protected route prefixes below as needed:
    // "/profile/:path*",
    // "/settings/:path*",
  ],
};
