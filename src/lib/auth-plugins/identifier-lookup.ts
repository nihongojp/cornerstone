import { createAuthEndpoint } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";
import { and, eq } from "drizzle-orm";
import * as z from "zod";
import { db, schema } from "../db";

/**
 * Answers "what can this address do?" for the identifier-first sign-in screen.
 *
 * The screen asks for an email and then resolves to whatever that account
 * supports — a password field for an account that has one, "check your email"
 * for everyone else. Something has to answer that question, and this is it.
 *
 * ## This endpoint is an account-existence oracle, on purpose
 *
 * Anyone can send an address here and learn whether it has an account. That was
 * decided and accepted in #59: what leaks is "this address has an account on a
 * Japanese-learning app", the flow is materially better than the alternative
 * (mailing everyone a link before they can type a password they already know),
 * and it is what identifier-first sign-in means. #59 also records the triggers
 * that would reverse the decision — chiefly, shared identity spanning an app
 * where having an account is itself a disclosure.
 *
 * ## Why it is a plugin rather than a route handler
 *
 * Accepting a *visible* branch is not the same as accepting *bulk* enumeration.
 * A plain route under `src/app/api/` would sit outside Better Auth's rate
 * limiter entirely, so a dictionary of addresses could be walked through it for
 * free. Declared here, it is `/api/auth/identifier-lookup` and inherits the
 * database-backed limiter configured in auth.ts — plus a tighter per-path rule.
 *
 * ## What it deliberately does not return
 *
 * Only `hasPassword`. Not whether the user exists, not which social providers
 * are linked, not the display name. The screen needs exactly one bit to decide
 * whether to render a password field, and every extra field would widen the
 * disclosure past what #59 actually weighed.
 */
export const identifierLookup = () =>
  ({
    id: "identifier-lookup",
    endpoints: {
      identifierLookup: createAuthEndpoint(
        "/identifier-lookup",
        {
          method: "POST",
          body: z.object({ email: z.string().email() }),
        },
        async (ctx) => {
          const email = ctx.body.email.toLowerCase().trim();

          const found = await ctx.context.internalAdapter.findUserByEmail(email);
          if (!found) return ctx.json({ hasPassword: false });

          /*
           * A password lives on the `credential` account row, not on the user —
           * an account created through Google or a magic link has no such row.
           *
           * Queried directly rather than via `findUserByEmail(email, {
           * includeAccounts: true })`, which would be the obvious route. That
           * option drives an adapter-level join, and its absence is silent:
           * without it `accounts` comes back `[]` for everyone, so the lookup
           * would answer "no password" for every account and every legacy user
           * would be mailed a link instead of being shown their password field.
           * A wrong answer here is invisible — it just looks like the design
           * working — so this asks the question in the least clever way
           * available.
           */
          const credential = await db
            .select({ password: schema.account.password })
            .from(schema.account)
            .where(
              and(
                eq(schema.account.userId, found.user.id),
                eq(schema.account.providerId, "credential")
              )
            )
            .limit(1);

          return ctx.json({ hasPassword: Boolean(credential[0]?.password) });
        }
      ),
    },
  }) satisfies BetterAuthPlugin;
