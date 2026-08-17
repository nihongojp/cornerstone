import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins/magic-link";
import { emailOTP } from "better-auth/plugins/email-otp";
import { nextCookies } from "better-auth/next-js";
import { identifierLookup } from "./auth-plugins/identifier-lookup";
import { db, schema } from "./db";
import {
  resetPasswordEmail,
  sendMail,
  signInCodeEmail,
  signInLinkEmail,
  verifyEmail,
} from "./mail";

// No fallback on purpose. The Express app defaulted JWT_SECRET to "devsecret",
// which meant a deployment missing the env var silently accepted forged tokens.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error("BETTER_AUTH_SECRET is not set — see .env.example");
}

/*
 * Which hosts this app will answer as.
 *
 * The previous approach — pin BETTER_AUTH_URL in production, leave it unset
 * everywhere else and let the origin be derived per request — worked, but by an
 * undocumented accident. The comment that used to live here said the origin
 * came from `x-forwarded-host`; #48 read the 1.6.29 source and found that
 * branch is gated on `trustedProxyHeaders`, which arrives `undefined` because
 * `getTrustedOrigins` calls `getBaseURL` with three of its five arguments. The
 * branch is dead code. The origin actually came from `getOrigin(request.url)`.
 *
 * `baseURL: { allowedHosts }` is the documented mechanism for this, so previews
 * now work on purpose rather than by luck.
 *
 * The preview pattern is deliberately PROJECT-SCOPED. A bare `*.vercel.app`
 * would trust every Vercel deployment on the internet to act as this app's
 * origin. VERCEL_PROJECT_PRODUCTION_URL is set by Vercel on every deployment.
 */
function resolveBaseURL() {
  const explicit = process.env.BETTER_AUTH_URL;
  const projectHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

  const allowedHosts = [
    "localhost:3000",
    ...(explicit ? [new URL(explicit).host] : []),
    ...(projectHost
      ? [
          projectHost,
          // Covers both the immutable per-deployment host and the *-git-<branch>
          // alias people actually open from a PR — scoped to this project's
          // name rather than all of vercel.app.
          `${projectHost.split(".")[0]}-*.vercel.app`,
        ]
      : []),
  ];

  return {
    allowedHosts: [...new Set(allowedHosts)],
    // Without a fallback Better Auth throws when the host matches nothing. An
    // explicit production URL is a better answer than a 500.
    ...(explicit ? { fallback: explicit } : {}),
  };
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    /*
     * Deliberately NOT `transaction: true`. It throws under Neon's HTTP driver,
     * which is what production uses — while local development runs
     * node-postgres, so the failure would only appear after deploy (#49).
     */
  }),
  secret,
  baseURL: resolveBaseURL(),
  telemetry: { enabled: false },

  emailAndPassword: {
    /*
     * Retained, but never offered at signup. Passwords stay reachable at
     * sign-in for accounts that already have one, and as the escape hatch for
     * anyone whose mail provider eats sign-in links — the risk that reversed
     * the original drop-passwords-entirely decision (see #47 Notes).
     */
    enabled: true,
    autoSignIn: false,
    /*
     * Structural rather than hygiene, now that password signup is the one path
     * that creates an account without proving inbox control. It is also what
     * keeps those accounts able to link Google later: `requireLocalEmailVerified`
     * gates on the local row, so an unverified account can never link (#51).
     */
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendMail({ to: user.email, ...resetPasswordEmail(url) });
    },
    // Signing out everywhere on reset is the point of a reset — if the account
    // was taken over, the attacker's sessions must die with the old password.
    revokeSessionsOnPasswordReset: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendMail({ to: user.email, ...verifyEmail(url) });
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      /*
       * Required, and easy to miss because it fails silently.
       *
       * `updateUserInfoOnLink` copies additional user fields from the provider
       * profile by MATCHING KEY NAMES (`oauth2/link-account.mjs:161-170`).
       * Google sends `given_name`/`family_name`; our columns are
       * `firstName`/`lastName`. Without this mapping they never populate — no
       * error, just empty columns (#51).
       */
      mapProfileToUser: (profile) => ({
        firstName: profile.given_name,
        lastName: profile.family_name,
      }),
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      /*
       * Close to a no-op, kept as a statement of intent: the trust clause only
       * matters for providers that do NOT assert `email_verified`, and Google
       * always does.
       *
       * The takeover vector — an attacker pre-registering an unverified account
       * at a victim's address, then having the victim's Google identity merged
       * into it — is closed by `requireLocalEmailVerified`, which defaults true
       * and becomes unconditional next minor. We rely on that default rather
       * than restating it (#51).
       */
      trustedProviders: ["google"],
      // The setting Apple's @privaterelay.appleid.com addresses will break.
      // Flipping it to true is flagged in Better Auth's own source as a
      // takeover risk; Apple's ticket inherits that as a known problem.
      allowDifferentEmails: false,
      /*
       * Take Google's name and avatar on link. Safe by construction: `email`
       * and `emailVerified` are destructured out before the update, so a link
       * cannot rebind an account's identity, and `role` is skipped because
       * `input: false` fields are excluded from provider-profile parsing
       * (`db/schema.mjs:120`).
       */
      updateUserInfoOnLink: true,
    },
  },

  user: {
    additionalFields: {
      firstName: { type: "string", required: false, input: true },
      lastName: { type: "string", required: false, input: true },
      // `input: false` keeps this out of signup/update payloads AND out of
      // OAuth profile mapping, so no provider can self-assign a role.
      role: { type: "string", required: false, input: false, defaultValue: "user" },
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

  rateLimit: {
    /*
     * Better Auth enables rate limiting on production only. That is a sensible
     * default and it is kept — but it means the limiter is inert in every
     * environment a developer can see, so a broken configuration would only
     * ever surface in production. RATE_LIMIT_IN_DEV=1 turns it on locally to
     * check it actually writes to the database.
     */
    ...(process.env.RATE_LIMIT_IN_DEV === "1" ? { enabled: true } : {}),
    /*
     * Default storage is an in-process Map. On Vercel that means the real limit
     * is `max` × live-instance-count and a cold start resets it — so Better
     * Auth's own per-path limits (sign-in 3/10s, OTP send 3/60s) were
     * decorative in production (#49). They are the only thing standing in front
     * of the mail-send endpoints, which is what stops the app being used as an
     * email cannon now that mail is the login system.
     */
    storage: "database",
    customRules: {
      /*
       * Must ship in the same change as the storage switch, not after it.
       * `useSession()` sits in the global Header, so every page view hits this
       * endpoint — with shared storage suddenly working, the default limit
       * would throttle ordinary browsing.
       */
      "/get-session": false,
      /*
       * Tighter than the default. This endpoint is an accepted account-existence
       * oracle (#59) — accepting a visible branch in the UI is not the same as
       * accepting a dictionary walked through it, and unlike the sign-in paths
       * it costs nothing to call, so nothing else slows an attacker down.
       */
      "/identifier-lookup": { window: 60, max: 10 },
    },
  },

  plugins: [
    identifierLookup(),
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        await sendMail({ to: email, ...signInLinkEmail(url) });
      },
    }),
    emailOTP({
      expiresIn: 60 * 15,
      otpLength: 6,
      sendVerificationOTP: async ({ email, otp }) => {
        await sendMail({ to: email, ...signInCodeEmail(otp) });
      },
    }),
    /*
     * Must be last: it reads the cookies the other plugins set and flushes them
     * onto the Next response. Any plugin declaring `hooks.after` — as
     * `oAuthProxy()` would — has to come before it (#48).
     */
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
