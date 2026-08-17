"use client";

import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  magicLinkClient,
  emailOTPClient,
} from "better-auth/client/plugins";
import type { auth } from "./auth";

/*
 * Type-only import of the server config so firstName/lastName/role come through
 * typed on the session user. `import type` is erased at build time, so none of
 * the server-side database or secret handling reaches the browser bundle.
 *
 * The plugin list mirrors the server's. Each client plugin only adds the
 * methods for calling its endpoints — there is no shared behaviour to keep in
 * sync beyond the names.
 */
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), magicLinkClient(), emailOTPClient()],
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
  emailOtp,
} = authClient;

export type SessionUser = typeof authClient.$Infer.Session.user;
