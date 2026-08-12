"use client";

import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

/*
 * Type-only import of the server config so firstName/lastName/role come through
 * typed on the session user. `import type` is erased at build time, so none of
 * the server-side database or secret handling reaches the browser bundle.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
  requestPasswordReset,
  resetPassword,
  changePassword,
  changeEmail,
  updateUser,
  deleteUser,
} = authClient;

export type SessionUser = typeof authClient.$Infer.Session.user;
