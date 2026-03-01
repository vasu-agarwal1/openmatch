/**
 * NextAuth.js TypeScript module augmentation.
 *
 * Extends the built-in Session, User, and JWT interfaces with the additional
 * fields we add in the jwt / session callbacks inside `src/lib/auth.ts`.
 */

import type { DefaultSession, DefaultUser } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    /**
     * The GitHub OAuth access token for the signed-in user.
     * Use this in Server Actions / API Routes to call the GitHub API.
     */
    accessToken: string;

    user: {
      /** MongoDB ObjectId of the user document. */
      id: string;
      /** GitHub username, e.g. "torvalds". */
      githubLogin: string;
    } & DefaultSession["user"];
  }

  // Extend the User interface if you access it directly (e.g. in the adapter)
  interface User extends DefaultUser {
    id: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    accessToken: string;
    userId: string;
    githubLogin: string;
  }
}
