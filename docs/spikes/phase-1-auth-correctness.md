# Research #48 — Phase 1 correctness: Next.js integration, email delivery, preview origins

Research note for [issue #48](https://github.com/nihongojp/cornerstone/issues/48), a child of the
"Production-ready auth" map ([#47](https://github.com/nihongojp/cornerstone/issues/47)).
No code changed. This document is a findings record, not a plan.

**Versions the claims below were verified against.** Every "source reads" claim was checked
against the code actually installed in this repo, not against a blog post or a remembered API:

| Thing | Version | Where checked |
| --- | --- | --- |
| `better-auth` | 1.6.29 | `node_modules/better-auth/dist/**` |
| `@better-auth/core` | bundled with the above | `node_modules/@better-auth/core/dist/types/init-options.d.mts` |
| `next` | 16.3.x (docs page reports 16.3.1) | https://nextjs.org/docs/app/api-reference/file-conventions/proxy |
| `resend` | current hosted docs | https://resend.com/docs |

Two of the ticket's framing assumptions turn out to be wrong. Both are called out inline and
repeated in [§4](#4-where-the-docs-contradict-our-assumptions).

---

## 0. Verdict at a glance

**Nothing in the current Next.js wiring is broken.** The route handler, `requireSession()`,
and `proxy.ts` are all conformant. The Phase 1 work is almost entirely *additive* (the
passwordless features do not exist yet) plus *DNS and deliverability*, which is exactly where
map #47 said the risk was.

### Blockers — Phase 1 cannot ship correctly without these

| # | Blocker | Area |
| --- | --- | --- |
| B1 | `magicLink()` + `emailOTP()` server plugins are not installed; the matching client plugins are not in `auth-client.ts`. The feature does not exist. | 1 |
| B2 | No `socialProviders.google`. Google sign-in — a standing decision in #47 — is not configured at all. | 1 |
| B3 | No verified Resend sending domain and `EMAIL_FROM` is unset. Gmail has required SPF **or** DKIM from *all* senders since 2024-02-01. | 2 |
| B4 | The console-log email fallback must become unreachable for magic link and OTP, and preview deployments need a real sending path or an explicit non-email way in. | 2 |
| B5 | Rate-limit storage is in-memory by default, which is per-instance on Vercel and therefore close to useless. The plugins' own per-path limits (3/min, 5/min) do not hold. | 2 |
| B6 | Preview origins need a decision and a config change. The current "leave `BETTER_AUTH_URL` unset" strategy works by a mechanism different from the one the code comment describes, and it does **not** survive adding Google. | 3 |

### Recommended, not blocking

| # | Item | Area |
| --- | --- | --- |
| R1 | Install `nextCookies()` **last** in the plugins array. Not required by the docs for our current shape; genuinely useful because we enable `session.cookieCache` and read sessions from RSCs. | 1 |
| R2 | Wrap `getSession()` in React `cache()` to dedupe the layout-plus-page double read. | 1 |
| R3 | Wire `advanced.backgroundTasks.handler` to Vercel's `waitUntil`, per the Better Auth email doc's timing-attack guidance. | 2 |
| R4 | Publish a DMARC record. Explicitly **not** required at our volume — see [§2.3](#23-dmarc-is-not-a-blocker-and-the-ticket-implies-it-might-be). | 2 |
| R5 | Send from a subdomain (`auth.` / `mail.`), decided once, because moving later resets reputation. | 2 |
| R6 | Set `emailAndPassword.disableSignUp: true` to implement the #47 soft-migration decision in config rather than in UI copy. | 1 |
| R7 | Correct the `x-forwarded-host` claim in the `src/lib/auth.ts` comment. | 3 |

---

## 1. Next.js integration conformance

### 1.1 Route handler — conformant

`src/app/(app)/api/auth/[...all]/route.ts` does:

```ts
export const { GET, POST } = toNextJsHandler(auth.handler);
```

The published guide shows `toNextJsHandler(auth)` instead
([next.md](https://better-auth.com/llms.txt/docs/integrations/next.md)). Both are correct.
The installed implementation accepts either:

```js
// node_modules/better-auth/dist/integrations/next-js.mjs
function toNextJsHandler(auth) {
	const handler = async (request) => {
		return "handler" in auth ? auth.handler(request) : auth(request);
	};
	return { GET: handler, POST: handler, PATCH: handler, PUT: handler, DELETE: handler };
}
```

Note it returns five methods and we destructure two. Grepping every core route and every
bundled plugin in 1.6.29 for `method: "PUT" | "PATCH" | "DELETE"` returns nothing — Better
Auth's whole surface is GET and POST. **Not a gap.** Re-exporting all five is free
future-proofing if someone wants it, but there is no bug here today.

### 1.2 `nextCookies()` and plugin ordering

**Is it needed?** The doc's stated reason does not apply to us. It says to use `nextCookies()`
"when calling cookie-setting functions in server actions"
([next.md](https://better-auth.com/llms.txt/docs/integrations/next.md)). We have exactly one
`"use server"` file — `src/app/(payload)/layout.tsx`, which is Payload's, not ours — and no
auth server actions. Sign-in today goes through the HTTP route handler, whose `Response`
carries `Set-Cookie` natively. So on the docs' own terms: **not required.**

Reading the source turns up a second reason the docs do not spell out, and this one *does*
apply to us. `nextCookies()` installs a `before` hook on `/get-session`:

```js
// integrations/next-js.mjs
const isRSC = headersStore.get("RSC") === "1";
const isServerAction = !!headersStore.get("next-action");
if (isRSC && !isServerAction) await setShouldSkipSessionRefresh(true);
```

That flag is consumed in `api/routes/session.mjs` in two places, and when it is false the
session route will (a) write a DB `updateSession` extending `expiresAt` and (b) emit a
`Set-Cookie` re-arming the session token's `maxAge` and the cookie cache. In an RSC render
Next.js cannot set cookies, so the DB write lands and the cookie write is silently dropped.
The result is a DB-vs-cookie divergence: the server believes the session was rolled forward,
the browser's cookie still expires 7 days after sign-in.

The hook explicitly skips itself when the call came in over the router
(`if ("_flag" in ctx && ctx._flag === "router") return;`), i.e. it is aimed precisely at
direct `auth.api.*` calls — which is what `src/lib/session.ts` does from every protected layout.

**Why this is R1 and not a blocker.** `Header.tsx` calls `useSession()`, which fetches
`/api/auth/get-session` over HTTP on essentially every page. *That* response does carry
`Set-Cookie`, so rolling renewal currently happens as a side effect of the header rendering.
The bug is real but masked. It stops being masked the moment anyone adds an auth server
action, or removes the client-side session read. Install the plugin.

**Is ordering significant?** Yes, and in 1.6.29 it is enforced with a runtime warning rather
than left to the reader:

```js
// integrations/cookie-plugin-guard.ts
// A plugin is considered misordered when there is at least one other plugin
// after it in the `plugins` array that declares `hooks.after`, since those
// hooks can set cookies that this integration will not see.
```

This matters concretely for Phase 1: `oAuthProxy` (§3) declares `hooks.after`. If we adopt
both, `nextCookies()` must come after it. The doc's phrasing — "make sure this is the last
plugin in the array" — is the right rule.

### 1.3 Server-side session reads — `requireSession()` is conformant

`src/lib/session.ts` matches the guide's RSC pattern exactly:

```ts
return auth.api.getSession({ headers: await headers() });
```

The one documented limitation applies to us and should be written down somewhere the team
will see it: *"As RSCs cannot set cookies, the cookie cache will not be refreshed until the
server is interacted with from the client via Server Actions or Route Handlers."*
([next.md](https://better-auth.com/llms.txt/docs/integrations/next.md)). Combined with
`cookieCache.maxAge: 5 * 60`, a user whose role or profile changes server-side can see up to
five minutes of stale session data on RSC-only navigation. For a language-learning app that
is acceptable; it would not be if `role` ever gated something that must revoke instantly.

**R2:** `getSession()` is called by a layout *and* often again by the page beneath it
(`(protected)/layout.tsx` then a route handler, `(dashboard)/layout.tsx`, `(player)/layout.tsx`).
There is no request-level dedupe. `cookieCache` absorbs most of the cost, but wrapping the
function in React's `cache()` is a two-line change that makes it exactly one read per request.

### 1.4 Caching pitfalls — clean

Audited. Nothing caches a session response:

- `unstable_cache` appears only in `src/lib/content/content.ts`, over Payload content. No
  session value is captured in any cache key or closure.
- All four session-reading route handlers already declare `export const dynamic = "force-dynamic"`.
- `headers()` makes every `getSession()` caller dynamic by construction, so RSC session reads
  cannot be statically rendered.

**No gap.** This is the pitfall the ticket asked about and we are not in it.

### 1.5 Next 16 `proxy.ts` — nothing breaks, and one thing to watch

The rename is real and total: *"The `middleware` file convention is deprecated and has been
renamed to `proxy`"*, with `v16.0.0` recorded as "Middleware is deprecated and renamed to
Proxy. Proxy defaults to the Node.js runtime"
([proxy.js](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)). Our file
exports `proxy` and a `config.matcher` — conformant.

`getSessionCookie()` is unaffected by the rename; it is a pure cookie parse over
`request.headers`, and it handles the `__Secure-` prefix that Vercel's HTTPS deployments get:

```js
const getCookie = (name) => parsedCookie.get(`__Secure-${name}`) ?? parsedCookie.get(name);
```

Better Auth's own warning — `getSessionCookie()` "does not validate it. Relying solely on this
check for security is dangerous" ([next.md](https://better-auth.com/llms.txt/docs/integrations/next.md))
— is already honoured: `proxy.ts` is optimistic-only and the real boundary is in the layouts.

One correction to the comment in `src/proxy.ts`. It says Next's guidance "says outright that it
should not be a project's session-management or authorization solution." The Next 16 proxy
reference does not use that wording. What it *does* say is sharper and more useful to us:

> Server Functions are not separate routes in this chain. They are handled as POST requests to
> the route where they are used, so a Proxy matcher that excludes a path will also skip Proxy
> coverage on that path. […] Always verify authentication and authorization inside each Server
> Function rather than relying on Proxy alone.

Our matcher is a narrow allowlist of seven paths. Any future Server Function outside those
paths gets no proxy coverage at all. Since we never relied on the proxy for enforcement, this
is a documentation fix, not a behaviour fix — but the comment should quote the real guidance.

### 1.6 One config lever the map's decisions already imply

#47 states password login "keeps working for existing accounts, is never offered to new ones."
Today that is enforced only by UI copy. `emailAndPassword.disableSignUp?: boolean` exists in
`@better-auth/core/dist/types/init-options.d.mts:588` and closes `/sign-up/email` at the API
while leaving `/sign-in/email` open — which is precisely the stated decision. **R6.**

---

## 2. Email delivery under passwordless

### 2.1 What Better Auth expects

- `emailVerification.sendVerificationEmail` receives `{ user, url, token }` plus the request.
  ([email.md](https://better-auth.com/llms.txt/docs/concepts/email.md))
- `magicLink({ sendMagicLink: async ({ email, token, url, metadata }, ctx) => {} })`, default
  `expiresIn` 300s, `storeToken` of `"plain" | "hashed" | custom`. Tokens are *"consumed
  atomically on the first attempt; retries always fail."*
  ([magic-link.md](https://better-auth.com/llms.txt/docs/plugins/magic-link.md))
- `emailOTP({ sendVerificationOTP({ email, otp, type }) })` where `type` is
  `"sign-in" | "email-verification" | "forget-password"`; `otpLength` 6, `expiresIn` 300,
  `allowedAttempts` 3. ([email-otp.md](https://better-auth.com/llms.txt/docs/plugins/email-otp.md))

**Schema impact: none.** Neither plugin declares a `schema:` block in 1.6.29 — both ride the
existing `verification` table, which `src/lib/db/auth-schema.ts` already has. No Drizzle
migration is needed to add magic link or email OTP. (A migration *is* needed if we adopt B5's
database rate-limit storage.)

One shape detail worth knowing before the UI is built: magic-link sign-up sets
`name: name || ""` for a brand-new user (`plugins/magic-link/index.mjs:163`). Our `user.name`
column is `notNull`, so this satisfies the constraint but produces empty display names unless
the sign-in form collects a name. Same for `firstName`/`lastName`, which stay null.

**The timing-attack instruction.** The email doc says outright: *"Avoid awaiting the email
sending to prevent timing attacks"*, and to use `waitUntil` or similar on serverless
([email.md](https://better-auth.com/llms.txt/docs/concepts/email.md)). Our current
`sendResetPasswordEmail` awaits the Resend call. 1.6.29 ships the hook for this —
`advanced.backgroundTasks.handler`, whose own doc comment gives the Vercel recipe:

```ts
// @better-auth/core/dist/types/init-options.d.mts
// import { waitUntil } from "@vercel/functions";
// advanced: { backgroundTasks: { handler: waitUntil } }
```

**R3.** This is a correctness nicety, not a blocker: the observable leak is whether an address
exists, and under passwordless the sign-in form already reveals nothing else.

### 2.2 What Resend requires — B3

Resend requires you to *"add and verify at least one domain"* before sending
([domains](https://resend.com/docs/dashboard/domains/introduction)). Verification is three DNS
records ([DNS setup](https://resend.com/docs/dashboard/domains/cloudflare)):

| Type | Name | Notes |
| --- | --- | --- |
| MX | `send` | priority 10, e.g. `feedback-smtp.us-east-1.amazonses.com` — this is the bounce/complaint feedback path |
| TXT | `send` | SPF, e.g. `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey` | DKIM public key |

Resend's own guidance is to send from a **subdomain** rather than the root domain, for
*"isolating your sending reputation"* (same page). **R5**, and it is a one-way door in
practice — reputation is per-sending-domain, so relocating later starts from zero.

This is a blocker because `EMAIL_FROM` is currently empty in `.env.example` and no domain is
verified. Under passwordless there is no other way in.

### 2.3 DMARC is *not* a blocker — and the ticket implies it might be

The ticket asks "what does Resend require to authenticate a sending domain (SPF, DKIM,
DMARC)". Checked against the primary sources, the honest answer separates them:

- **SPF or DKIM: mandatory.** Google: *"Starting February 1, 2024, all email senders who send
  email to Gmail accounts must meet the requirements"*, including SPF or DKIM, valid forward
  and reverse DNS (PTR), and TLS. *"Messages that aren't authenticated with these methods might
  be marked as spam."* ([Google sender guidelines](https://support.google.com/a/answer/81126))
  Resend's verification flow gives us both, so this is satisfied by B3 with nothing extra.
- **DMARC: required only of bulk senders**, defined by Google as 5,000+ messages per day. At
  that volume you also need DMARC alignment and one-click unsubscribe for marketing mail.
  Cornerstone's login mail is nowhere near 5,000/day. Resend's own DMARC page presents it as a
  post-verification option to *"build trust and improve inbox placement"*, not a requirement
  ([DMARC](https://resend.com/docs/dashboard/domains/dmarc)).
- Resend's DNS setup page *"does not mention DMARC record requirements for domain verification"*
  at all.

So: publish `v=DMARC1; p=none; rua=mailto:…` because it is free monitoring and the escalation
path to `p=quarantine` then `p=reject` is well-trodden — but do not let DMARC sit on the
critical path to shipping. **R4.**

The genuinely load-bearing threshold is the spam-rate one: Google wants complaints below
**0.30%** for all senders, **0.10%** for bulk. Under passwordless, the failure mode is not
"marked as spam once" — it is a young domain with no positive engagement history sending
exclusively link-bearing transactional mail, which is the exact profile aggressive corporate
and K-12 filters distrust. That risk is not fixed by DNS; it is fixed by warm-up, by low
volume, and by having a second way in.

### 2.4 What the console-log fallback must become — B4

Today (`src/lib/auth.ts`):

```ts
if (!apiKey || !from) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("RESEND_API_KEY/EMAIL_FROM missing — cannot send reset email");
  }
  console.warn(`[auth] password reset link for ${to}: ${url}`);
  return;
}
```

For a password reset with password login still available, degrading to a console log is
defensible. For a magic link it is not: the log line *is* a valid credential, and in any
environment where the log is visible to more than one person that is a live account-takeover
primitive. Three concrete consequences:

1. **Local development is fine as-is.** Keep the console fallback for `magicLink` and
   `emailOTP` on localhost — it is how the flow stays testable without burning real sends.
2. **Preview deployments are not local.** Vercel sets `NODE_ENV=production` for preview
   builds, so today's guard would *throw* on a preview lacking `RESEND_API_KEY` rather than
   log. That is the safe direction, but it means previews cannot exercise sign-in at all
   unless the Preview environment gets its own Resend key. Decide deliberately: either
   provision a preview key on the same verified domain, or accept that preview sign-in
   requires a seeded session.
3. **The throw must be unconditional in production, and it must be observable.** Right now a
   Resend outage surfaces to the user as a generic failure and to us as nothing. Under
   passwordless a silent send failure is indistinguishable from a spam-filtered message —
   both look like "the email never came" — and only one of them is our fault. The delivery
   callback needs to log the Resend message ID on success and alert on failure, otherwise the
   #47 concern ("a user who can never sign in and has no way to tell us") is unfalsifiable.

Email OTP is the designed mitigation here and #47 already names it as the inline fallback. It
matters because it fails differently: an OTP is copy-pasteable from a preview pane, survives
link-rewriting security appliances that mangle magic-link URLs, and is not consumed by
automated link scanners. (Better Auth's magic-link tokens are *"consumed atomically on the
first attempt"* — meaning a corporate scanner that pre-fetches URLs burns the user's link
before they click it. That is a real and common failure mode in exactly the school and
corporate environments #47 is worried about.)

### 2.5 Rate limiting — B5

Both plugins ship their own per-path limits, which is better than I expected:

```js
// plugins/email-otp/index.mjs — five paths, each:
window: opts.rateLimit?.window || 60, max: opts.rateLimit?.max || 3
// plugins/magic-link/index.mjs:
window: opts.rateLimit?.window || 60, max: opts.rateLimit?.max || 5
```

Better Auth's global default is 100 requests / 60s, with `/sign-in/email` at 3/10s; rate
limiting is *enabled in production and disabled in development by default*
([rate-limit.md](https://better-auth.com/llms.txt/docs/concepts/rate-limit.md)).

The problem is storage. The default is **memory**, with database and secondary storage as
opt-ins (same page). On Vercel, functions are horizontally scaled and short-lived, so an
in-memory counter is per-instance and effectively resets under any concurrency. *(This is
reasoning from the deployment model, not a quoted doc statement — but it is the direct
consequence of "memory" plus serverless.)* The practical effect is that the 3/min and 5/min
limits above do not hold in production, and mail send is the one endpoint class where that
costs real money and real domain reputation rather than just CPU.

Switching `rateLimit.storage` to `"database"` requires a migration (the docs say so
explicitly) and adds a write per auth request. Given that #47 calls deliverability *the*
Phase 1 risk, and that an unthrottled send endpoint is the fastest way to destroy a young
sending domain, this is a blocker rather than a nice-to-have.

---

## 3. Preview-deployment origins

### 3.1 What `oAuthProxy()` actually solves

It solves **OAuth provider redirect-URI registration**, not `INVALID_ORIGIN`. Those are two
different checks in two different places, and the ticket's framing conflates them.

Google requires every `redirect_uri` to be pre-registered as an exact string. Preview
hostnames are unpredictable, so they can never be registered. `oAuthProxy` sidesteps this by
rewriting `ctx.context.baseURL` to the production origin before the provider redirect is
built:

```js
// plugins/oauth-proxy/index.mjs — before hook on /sign-in/social
if (productionURL) {
  const productionBaseURL = `${stripTrailingSlash(productionURL)}${ctx.context.options.basePath || "/api/auth"}`;
  ctx.context.baseURL = productionBaseURL;
}
const newCallbackURL = `${stripTrailingSlash(currentURL.origin)}…/oauth-proxy-callback?callbackURL=…`;
```

Google then calls back to *production*, production exchanges the code, encrypts the profile,
and redirects the browser to the preview's `/oauth-proxy-callback`, which decrypts it and
mints a local session ([oauth-proxy.md](https://better-auth.com/llms.txt/docs/plugins/oauth-proxy.md)).

`INVALID_ORIGIN`, by contrast, is thrown by `validateOrigin` in
`api/middlewares/origin-check.mjs`, comparing the request's `Origin`/`Referer` header against
`trustedOrigins`. `oAuthProxy` never touches that path.

**It not only fails to fix the origin check — it depends on it already being fixed.** Two
places in the source make this explicit:

```js
// plugins/oauth-proxy/utils.mjs — resolveCurrentURL
// So a request-derived origin is only honored when it is an explicitly trusted origin
if (origin && ctx.context.isTrustedOrigin(origin)) return new URL(requestURL);
```

```js
// plugins/oauth-proxy/index.mjs — the callback endpoint itself
use: [originCheck((ctx) => ctx.query.callbackURL)],
```

If the preview origin is not trusted, `resolveCurrentURL` silently falls back to
`VERCEL_URL`/base URL — sending the profile to the wrong host — and the callback endpoint
403s on `callbackURL` anyway. The plugin's own doc agrees: `trustedOrigins` *"Must list all
preview and development domains that will redirect through production."*

**Where it genuinely helps.** The `auth.ts` comment correctly notes that under Vercel Standard
Protection, preview hostnames are not publicly reachable. Google's server-to-server callback
to a preview URL would therefore fail no matter what we put in `trustedOrigins`. `oAuthProxy`
routes that callback to production instead, and the final hop to the preview is a *browser*
redirect carrying the user's protection-bypass cookie. So if we keep Deployment Protection on
and want Google sign-in on previews, `oAuthProxy` is not optional — it is the mechanism.

### 3.2 What it costs

1. **A shared encryption key across every environment.** The key defaults to the main secret:
   `const getEncryptionKey = (ctx) => opts?.secret ?? ctx.context.secretConfig;`. The docs warn
   that mismatched secrets produce `state_mismatch` and that *"All environments (production,
   preview, localhost) must use the same encryption key to communicate."* This **directly
   contradicts `.env.example`**, which instructs "Use a different value per environment" for
   `BETTER_AUTH_SECRET`. Resolve by passing a dedicated `secret` (a separate
   `OAUTH_PROXY_SECRET` shared across environments) and leaving `BETTER_AUTH_SECRET` per-environment.
   The docs endorse exactly this: a dedicated secret limits a compromise to "OAuth flow
   hijacking during the short `maxAge` window."
2. **An encrypted profile in a URL query parameter.** `proxyCallbackURL.searchParams.set("profile", encryptedPayload)`.
   Query strings land in access logs, proxy logs, and `Referer` headers. The 60-second default
   `maxAge` and the state binding bound the damage, but it is a real exposure surface.
3. **Preview sign-in becomes dependent on production being healthy.**
4. **Ordering discipline.** `oAuthProxy` declares `hooks.after`, so if `nextCookies()` is also
   installed it must come after — see §1.2.

### 3.3 The actual fix for `INVALID_ORIGIN` — and a correction

**The `src/lib/auth.ts` comment's stated mechanism is wrong for 1.6.29.** It says leaving
`BETTER_AUTH_URL` unset means "better-auth derives the origin from each request's
`x-forwarded-host`." Tracing it:

```js
// utils/url.mjs — getBaseURL
const fromRequest = request?.headers.get("x-forwarded-host");
const fromRequestProto = request?.headers.get("x-forwarded-proto");
if (fromRequest && fromRequestProto && trustedProxyHeaders) { … }
if (request) { const url = getOrigin(request.url); … }
```

`x-forwarded-host` is honoured **only when `trustedProxyHeaders` is enabled**. And
`getTrustedOrigins` calls `getBaseURL` without passing that argument at all:

```js
// context/helpers.mjs
const baseURL = getBaseURL(typeof options.baseURL === "string" ? options.baseURL : void 0, options.basePath, request);
```

Five parameters, three supplied — `trustedProxyHeaders` arrives as `undefined`, so the
forwarded-host branch is dead on this path. The origin is actually derived from
`getOrigin(request.url)`. On Vercel that usually resolves to the host the user asked for, so
the current setup does mostly work — but by a different mechanism than the comment claims, and
one that depends on how Next reconstructs `request.url` rather than on an explicit config.
Relying on undocumented incidental behaviour for a security check is the thing to fix. **R7**
for the comment; **B6** for the config.

**Better Auth 1.6.29 ships a purpose-built answer.** `baseURL` accepts a dynamic config
object, and its own type documentation names our exact scenario:

```ts
// @better-auth/core/dist/types/init-options.d.mts
/**
 * Configuration for dynamic base URL resolution.
 * Allows Better Auth to work with multiple domains (e.g., Vercel preview deployments).
 */
type DynamicBaseURLConfig = {
  allowedHosts: string[];  // "myapp.com" | "*.vercel.app" | "preview-*.myapp.com"
  …
};
```

On this path the forwarded-header handling flips to secure-by-default:

```js
// context/helpers.mjs
function resolveDynamicTrustedProxyHeaders(options) {
	return options.advanced?.trustedProxyHeaders ?? true;
}
```

and the host is validated against the allowlist before it is trusted
(`resolveDynamicBaseURL` in `utils/url.mjs`), with a `fallback` for when no host can be
derived. `getTrustedOrigins` then seeds `trustedOrigins` from `allowedHosts` directly, so
`INVALID_ORIGIN` is solved by construction rather than by a second parallel list.

A lighter-weight alternative, if the dynamic `baseURL` feels like too much surface: leave
`baseURL` as-is and give `trustedOrigins` wildcard patterns or a function. `matchesOriginPattern`
supports `*` and `?` against either the full origin or the host, and `validateOrigin` merges the
static list with a function's per-request result. `BETTER_AUTH_TRUSTED_ORIGINS` (comma-separated
env var) is also read automatically — probably the smallest possible change.

**Whichever route is chosen, wildcard scope is the security decision.** `*.vercel.app` trusts
every Vercel deployment on the internet, not just ours. The correct pattern is the
project-scoped one — `cornerstone-*-<team>.vercel.app` — and that decision belongs to whoever
resolves this ticket, not to this document.

---

## 4. Where the docs contradict our assumptions

Two, both stated plainly above and repeated here because the ticket's framing carries them:

1. **`x-forwarded-host` is not how the current preview setup works.** The comment in
   `src/lib/auth.ts` describes a code path that is inert in 1.6.29 because
   `getTrustedOrigins` never passes `trustedProxyHeaders`. The real mechanism is
   `getOrigin(request.url)`. The setup mostly works; the explanation is wrong; the fix is to
   stop depending on incidental behaviour. (§3.3)
2. **DMARC is not required.** The ticket groups "SPF, DKIM, DMARC" as what Resend requires.
   Resend requires SPF and DKIM (via its three verification records) and nowhere requires
   DMARC. Google requires DMARC only above 5,000 messages/day, which we will not approach.
   DMARC is worth doing; it is not a gate. (§2.3)

A third, smaller: the ticket asks whether `oAuthProxy` "solves this for Google sign-in on
previews, or solves a different problem." It is genuinely both — it solves a *different*
problem (redirect-URI registration, plus Deployment Protection reachability) and it
*presupposes* the origin problem is already solved. Adopting it does not let us skip the
`trustedOrigins` work. (§3.1)

---

## Sources

Primary docs:

- Better Auth — Next.js integration: https://better-auth.com/llms.txt/docs/integrations/next.md
- Better Auth — Email: https://better-auth.com/llms.txt/docs/concepts/email.md
- Better Auth — OAuth Proxy plugin: https://better-auth.com/llms.txt/docs/plugins/oauth-proxy.md
- Better Auth — Magic Link plugin: https://better-auth.com/llms.txt/docs/plugins/magic-link.md
- Better Auth — Email OTP plugin: https://better-auth.com/llms.txt/docs/plugins/email-otp.md
- Better Auth — Rate limiting: https://better-auth.com/llms.txt/docs/concepts/rate-limit.md
- Next.js 16 — `proxy.js` file convention: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
- Resend — Domains overview: https://resend.com/docs/dashboard/domains/introduction
- Resend — DNS records for verification: https://resend.com/docs/dashboard/domains/cloudflare
- Resend — DMARC: https://resend.com/docs/dashboard/domains/dmarc
- Resend — API rate limit (10 req/s per team): https://resend.com/docs/api-reference/introduction
- Google — Email sender guidelines: https://support.google.com/a/answer/81126

Installed source read directly (better-auth 1.6.29):

- `dist/integrations/next-js.mjs` — `toNextJsHandler`, `nextCookies`
- `dist/integrations/cookie-plugin-guard.mjs` — plugin-ordering warning
- `dist/api/routes/session.mjs` — cookie cache and session-refresh behaviour
- `dist/api/middlewares/origin-check.mjs` — `INVALID_ORIGIN` / `INVALID_CALLBACK_URL`
- `dist/auth/trusted-origins.mjs` — wildcard origin matching
- `dist/context/helpers.mjs` — `getTrustedOrigins`, `resolveDynamicTrustedProxyHeaders`
- `dist/utils/url.mjs` — `getBaseURL`, `resolveDynamicBaseURL`, `matchesHostPattern`
- `dist/cookies/index.mjs` — `getSessionCookie`, `getCookieCache`
- `dist/plugins/oauth-proxy/{index,utils}.mjs`
- `dist/plugins/{magic-link,email-otp}/index.mjs` — rate limits, no schema additions
- `@better-auth/core/dist/types/init-options.d.mts` — `DynamicBaseURLConfig`,
  `emailAndPassword.disableSignUp`, `session.cookieCache`, `advanced.backgroundTasks`

Repo files reviewed: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`,
`src/proxy.ts`, `src/app/(app)/api/auth/[...all]/route.ts`, `src/lib/db/auth-schema.ts`,
`.env.example`, plus a full audit of `getSession`/`requireSession` call sites and of
`unstable_cache` / `dynamic` / `revalidate` usage under `src/`.
