import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { Resend } from "resend";
import { db, schema } from "./db";

// No fallback on purpose. The Express app defaulted JWT_SECRET to "devsecret",
// which meant a deployment missing the env var silently accepted forged tokens.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not set — see .env.example");
}

// Production pins the origin via BETTER_AUTH_URL. Everywhere else — previews
// above all — returns undefined on purpose, so better-auth derives the origin
// from each request's x-forwarded-host instead.
//
// Not VERCEL_URL: that is the immutable per-deployment hostname, but the link
// people open from a PR is the *-git-* branch alias, and trustedOrigins defaults
// to exactly baseURL, so pinning the wrong one of the two answers 403
// INVALID_ORIGIN on sign-in. Vercel says the same thing for its own reason —
// under Standard Protection neither VERCEL_URL nor VERCEL_BRANCH_URL is publicly
// reachable, and requests should target the domain the user actually asked for.
function resolveBaseURL(): string | undefined {
  return process.env.BETTER_AUTH_URL || undefined;
}

async function sendResetPasswordEmail(to: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    // Local development without mail credentials: surface the link instead of
    // failing the request, so the reset flow stays testable.
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY/EMAIL_FROM missing — cannot send reset email");
    }
    console.warn(`[auth] password reset link for ${to}: ${url}`);
    return;
  }

  await new Resend(apiKey).emails.send({
    from,
    to,
    subject: "Reset your Nihon-Go! password",
    text: `Someone requested a password reset for this account.\n\nReset your password: ${url}\n\nThis link expires in one hour. If you didn't request it, you can ignore this email.`,
  });
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret,
  baseURL: resolveBaseURL(),
  emailAndPassword: {
    enabled: true,
    // The signup screen has always returned the user to the login tab with
    // "Account created. Please log in." Auto sign-in would contradict that copy.
    autoSignIn: false,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
    // Signing out everywhere on reset is the point of a reset — if the account
    // was taken over, the attacker's sessions must die with the old password.
    revokeSessionsOnPasswordReset: true,
  },
  user: {
    additionalFields: {
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      // Carried over from the Mongoose model. Not user-settable: `input: false`
      // keeps it out of signup/update payloads so nobody can self-assign a role.
      role: { type: "string", required: false, input: false, defaultValue: "Volunteer" },
    },
    changeEmail: { enabled: true },
    deleteUser: { enabled: true },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days, matching the old JWT lifetime
    updateAge: 60 * 60 * 24,
    // Serves the session from a signed cookie for short windows, so a page
    // render doesn't cost a database round trip.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
});

export type Session = typeof auth.$Infer.Session;
