# Research #49 — Hardening sweep: security options, abuse defense, performance

Research note for [#49](https://github.com/nihongojp/cornerstone/issues/49), child of map
[#47](https://github.com/nihongojp/cornerstone/issues/47). **No code changed.** This is a
decision document; the config edits it recommends belong to the Phase 1 build ticket
([#55](https://github.com/nihongojp/cornerstone/issues/55)) or their own tickets.

Pinned versions this was verified against: `better-auth@1.6.29` (the installed tree, not
just the docs), `@better-auth/core` and `@better-auth/drizzle-adapter` as deduped by that,
`drizzle-orm@0.45.2`, `next@16.3.0`, `@neondatabase/serverless@1.1.0`. Deployment shape:
Vercel serverless, Neon Postgres over the **HTTP driver** in production
(`src/lib/db/index.ts`), node-postgres locally.

## Method note: the published docs are wrong about two load-bearing defaults

Better Auth's own doc pages contradict each other, and both contradict the shipped code.
Every default in this document was read out of the installed package, with the doc page
cited alongside so the disagreement is visible.

| Fact | `options.md` says | `rate-limit.md` says | **1.6.29 source says** |
|---|---|---|---|
| Default IP headers | `["x-client-ip", "x-real-ip"]` | `x-forwarded-for` | **`["x-forwarded-for"]`** |
| Default rate-limit window | `10` seconds | `60` seconds | **`10` seconds** |

Source of truth for the IP default: `@better-auth/core/dist/utils/ip.mjs`

```js
const DEFAULT_IP_HEADERS = ["x-forwarded-for"];
```

Source of truth for the window/max/storage defaults: `better-auth/dist/context/create-context.mjs`

```js
rateLimit: {
  ...options.rateLimit,
  enabled: options.rateLimit?.enabled ?? isProduction,
  window: options.rateLimit?.window || 10,
  max: options.rateLimit?.max || 100,
  storage: options.rateLimit?.storage || (options.secondaryStorage ? "secondary-storage" : "memory")
}
```

**This matters practically.** `options.md`'s claim that the default is
`["x-client-ip", "x-real-ip"]` is not merely stale — following it would be actively
harmful on Vercel. See §1.2.

Docs consulted:
- <https://better-auth.com/llms.txt/docs/reference/security.md>
- <https://better-auth.com/llms.txt/docs/reference/options.md>
- <https://better-auth.com/llms.txt/docs/concepts/rate-limit.md>
- <https://better-auth.com/llms.txt/docs/guides/optimizing-for-performance.md>
- <https://better-auth.com/docs/plugins/captcha>

---

## 1. Security options

### 1.1 Rate limiting: the defaults do **not** survive serverless — this is the top finding

Rate limiting is on in production (`enabled: isProduction`), but **the default storage is
an in-process `Map`**:

```js
storage: options.rateLimit?.storage || (options.secondaryStorage ? "secondary-storage" : "memory")
```

and the memory backend is a module-scoped `Map` keyed per instance
(`better-auth/dist/api/rate-limiter/index.mjs`). On Vercel each concurrent lambda instance
gets its own, and instances are recycled freely. Consequences:

- The effective limit is **`max` × (number of live instances)**, which is unbounded and
  attacker-influenced — concurrency rises *because* of the attack.
- A cold start resets the counter to zero. An attacker pacing requests to trigger new
  instances is never limited at all.

So today's built-in limits — including the good ones in §1.3 — are close to decorative in
production. Documented storage choices
(<https://better-auth.com/llms.txt/docs/concepts/rate-limit.md>): `"database"`,
`"secondary-storage"`, or a `customStorage`.

**`"database"` is the right call for us**, because it needs no new infrastructure and we
already have Postgres. Cost is ~2 Neon HTTP round trips per rate-limited request (one read,
one conditional `UPDATE ... WHERE count < max`, from `createDatabaseStorageWrapper`), and it
is atomic — the check-and-increment happens in one step in the request phase, so concurrent
requests cannot all pass a stale read.

It requires a table Better Auth does not create for you. Exact shape from
`@better-auth/core/dist/db/get-tables.mjs` (only added when `storage === "database"`):

| field | type | notes |
|---|---|---|
| `key` | string | **unique**, required |
| `count` | number | required |
| `lastRequest` | number | required, **bigint** (ms epoch) |

`"secondary-storage"` (Upstash/Redis) is faster and would also let us move sessions out of
Postgres, but it adds a vendor, a bill, and a new failure mode. Not worth it at current
scale — revisit if auth traffic makes the DB round trips show up in latency.

### 1.2 IP detection behind Vercel — currently correct **by luck**, and one doc-following edit away from broken

This is the "rate limiting keyed on the wrong header does nothing" question, and the answer
has two halves.

**Half one: the default works on Vercel.** Better Auth defaults to `x-forwarded-for`, and
Vercel documents that header as "The public IP address of the client that made the
request." Critically, Vercel states
(<https://vercel.com/docs/headers/request-headers>):

> "If you are trying to use Vercel behind a proxy, we currently **overwrite** the
> `X-Forwarded-For` header and **do not forward external IPs**. This restriction is in place
> to **prevent IP spoofing**."

Overwrite, not append — so the header arrives as a single trustworthy value. That matters
because of how Better Auth parses it (`@better-auth/core/dist/utils/ip.mjs`):

```js
if (forwardedIps.length !== 1) return null;
```

Without `trustedProxies` configured, a comma-separated chain is **rejected outright**.
Vercel's single-value overwrite is exactly what satisfies this. On a platform that appended
instead, `getIp` would return `null` — and the fallback is genuinely bad:

```js
const NO_TRUSTED_IP_KEY = "no-trusted-ip";
// ...
const key = createRateLimitKey(ip ?? NO_TRUSTED_IP_KEY, path);
```

Every client collapses into **one shared bucket per path**. That is worse than no rate
limiting: one attacker exhausts the shared bucket and locks every legitimate user out of
sign-in. Better Auth logs a warning once when this happens — worth alerting on.

**Half two: the trap.** If someone "fixes" IP detection by following `options.md` and sets
`ipAddressHeaders: ["x-client-ip", "x-real-ip"]`, rate limiting becomes **trivially
bypassable**. `x-client-ip` is not a Vercel-set header and appears nowhere in Vercel's docs;
Vercel's anti-spoofing guarantee is scoped explicitly and only to `X-Forwarded-For`. An
attacker sending `x-client-ip: <random>` gets a fresh bucket per request. `getIp` walks
`ipAddressHeaders` **in order** and returns the first that parses, so putting a spoofable
header anywhere in that list — even with a safe one after it — is enough to defeat it.

**Recommendation:** set the header list explicitly rather than relying on an undocumented-
in-practice default, and comment *why*, so nobody later "corrects" it toward the docs:

```ts
advanced: {
  ipAddress: {
    // Vercel overwrites x-forwarded-for with the real client IP and refuses to
    // forward external ones, so it is the only header here that cannot be spoofed.
    // Do NOT add x-client-ip / x-real-ip: getIp() returns the FIRST header that
    // parses, so one spoofable entry defeats the whole list.
    ipAddressHeaders: ["x-forwarded-for"],
  },
},
```

`x-vercel-forwarded-for` is documented as identical to `x-forwarded-for` but survives a
proxy placed in front of Vercel. We have no such proxy; if one is ever added, switch to it.
Do not set `trustedProxies` — it is for parsing forwarded chains, and Vercel does not give
us one.

### 1.3 The built-in per-path limits are good — and they already cover passwordless

Undocumented on the options page, but present in
`better-auth/dist/api/rate-limiter/index.mjs`:

| paths | window | max |
|---|---|---|
| `/sign-in*`, `/sign-up*`, `/change-password*`, `/change-email*` | 10s | 3 |
| `/request-password-reset`, `/send-verification-email`, `/forget-password*`, `/email-otp/send-verification-otp`, `/email-otp/request-password-reset` | 60s | 3 |

Plugins layer their own on top: magic link is 60s/5 for `/sign-in/magic-link` and
`/magic-link/verify`; email OTP is 60s/3 on send, check, and verify.

Note `/sign-in/magic-link` also matches the `/sign-in` prefix rule — the plugin rule is
applied after and wins. Either way it is limited.

**These are sensible and need no tuning.** They are simply not enforced today, because of
§1.1. Fixing storage is what makes them real.

Two caveats worth recording. First, the plugin docs themselves document **no** rate limiting
— the word does not appear in either the magic-link or email-OTP page — so anyone reading
the docs alone would conclude the send endpoints are unprotected and reach for captcha. The
limits are real; they are just only discoverable in the source. Second, the plugins' own
abuse controls are **verify-side, not send-side**: email OTP's `allowedAttempts` (default
`3`) caps guesses against an issued code, and magic-link tokens are single-use and consumed
atomically (its `allowedAttempts` is deprecated and ignored). Neither caps how many codes or
links can be *requested* — that is entirely the rate limiter's job, which is precisely why
§1.1 is P0. Both plugins default to `expiresIn: 300` (5 minutes), which is appropriately
tight.

### 1.4 `trustedOrigins` and the preview-deploy comment is subtly wrong

`src/lib/auth.ts` leaves `baseURL` undefined outside production so that, per its comment,
"better-auth derives the origin from each request's `x-forwarded-host`." **That is not what
1.6.29 does on this path.** From `better-auth/dist/auth/base.mjs`:

```js
const baseURL = getBaseURL(void 0, basePath, request, void 0, ctx.options.advanced?.trustedProxyHeaders);
```

`advanced.trustedProxyHeaders` is unset, so `undefined` is passed, and in
`better-auth/dist/utils/url.mjs` the forwarded-host branch is gated on it:

```js
if (fromRequest && fromRequestProto && trustedProxyHeaders) { ... }
if (request) { const url = getOrigin(request.url); ... }
```

So previews actually fall through to **the request URL's origin**, not `x-forwarded-host`.
On Vercel + Next these usually agree, which is why nothing is visibly broken — but the code
comment describes a mechanism that is switched off, and the config is one refactor away
from behaving differently than its comment promises.

(There is a separate helper, `resolveDynamicTrustedProxyHeaders`, that defaults to `true` —
but it serves the *dynamic `baseURL`* config path, which we do not use. That is very likely
the source of the confusion.)

Low urgency, low effort: either set `advanced.trustedProxyHeaders: true` to make the comment
true, or correct the comment. Prefer setting it — Vercel sets `x-forwarded-host` and
`x-forwarded-proto` itself, the value is validated against an injection blocklist before use
(`validateProxyHeader`), and it is the more robust of the two.

Note also that `resolveBaseURL()` in `auth.ts` is near-redundant: `getBaseURL` already reads
`BETTER_AUTH_URL` from the environment as its second step. Harmless, but the explicitness is
doing less than it looks like.

`trustedOrigins` itself is left at its default, which is exactly `baseURL`. That is correct
and deliberately narrow. Once passwordless ships there is nothing new to add unless a
non-web client appears. **No change recommended.**

### 1.5 Cookies and `advanced`: defaults are already right

Per <https://better-auth.com/llms.txt/docs/reference/security.md>: `httpOnly` on,
`sameSite: lax`, `secure` automatically in production (`advanced.useSecureCookies` defaults
to true there). CSRF is defended by origin validation against `trustedOrigins`, plus
`Sec-Fetch-*` metadata checks, plus no mutations on GET, plus OAuth `state`/`nonce`.

**No change recommended, and specifically: do not set `disableCSRFCheck` or
`disableOriginCheck`.** Both are documented as opening the app to CSRF. Worth writing down
because the temptation appears when preview-deploy origins misbehave, and §1.4 is exactly
the kind of confusion that leads someone there.

`advanced.database.generateId` defaults to random base62, which is fine. `crossSubDomainCookies`
stays off unless the Medical Translator shared-identity ticket needs it — that decision
belongs to that ticket, not this one.

### 1.6 `session.freshAge` — currently 1 day, and passwordless changes what that guards

Default is `86400` (1 day), confirmed in `create-context.mjs`:

```js
freshAge: options.session?.freshAge === void 0 ? 3600 * 24 : options.session.freshAge
```

It gates `freshSessionMiddleware`, and account deletion checks it inline
(`api/routes/update-user.mjs`): `if (!ctx.body.password && ctx.context.sessionConfig.freshAge !== 0)`.

**The passwordless bet interacts with this.** That condition falls back to freshness *only
when no password is supplied*. Password users re-authenticate to delete their account;
passwordless users have no password to give, so a session that is merely under 24h old is
the entire barrier to irreversible account deletion. Since `deleteUser` and `changeEmail`
are both enabled in `src/lib/auth.ts`, this is a real exposure on a stolen or shared-device
session.

Worth an explicit decision rather than inheriting the default. Reducing `freshAge` to ~15
minutes means a sensitive action requires a recent sign-in, which under passwordless means
"prove inbox control again" — a meaningful barrier that costs a legitimate user one magic
link.

Reassuringly, `sensitiveSessionMiddleware` (used for password and email changes) calls
`getAuthoritativeSessionFromCtx`, which **bypasses the cookie cache**. So our 5-minute
`cookieCache` does not weaken sensitive operations. Good as-is.

### 1.7 Not asked, but found: there is no email verification at all today

`src/lib/auth.ts` configures no `emailVerification` block and does not set
`requireEmailVerification`, which defaults to `false`
(<https://better-auth.com/llms.txt/docs/reference/options.md>). Email+password signup
therefore creates an immediately usable account at an address the registrant never proved
they control — which permits account pre-hijacking (register someone else's address, wait
for them to be added to it) and gives spam signups a free ride.

This is largely mooted by the passwordless migration — magic link and OTP prove inbox
control inherently — but password signup is still enabled and still the default path until
Phase 1 lands. Given map #47's standing decision that legacy password login stays for
existing accounts only, the cleanest fix is not to add a verification flow to a code path
we are retiring: it is to stop offering password *signup* while leaving password *login*
alive. That is a Phase 1 concern, flagged here so it is not lost.

---

## 2. Abuse defense that works against real inboxes

### 2.1 What the plugin actually is

Read from `better-auth/dist/plugins/captcha/` rather than the docs page, because the
shipped provider list is longer than the page suggests.

Providers (`constants.mjs`): `cloudflare-turnstile`, `google-recaptcha`, `hcaptcha`,
**`captchafox`**.

It is an `onRequest` middleware intercepting `POST`s to the configured paths. The client
sends the provider token in an **`x-captcha-response`** header; the server verifies it
against the provider's `/siteverify` endpoint before the endpoint runs. There is no client
plugin and no widget — rendering the challenge and attaching the header is entirely ours to
build (<https://better-auth.com/docs/plugins/captcha>).

Other options worth knowing: `minScore` (reCAPTCHA v3 only, default `0.5`), `siteKey`
(hCaptcha and CaptchaFox only, binds a token to our sitekey), and
**`siteVerifyURLOverride`** — note the name, not `siteVerifyURL`.

**It fails closed, including when the provider is unreachable.** The plugin rejects the
request if the token is missing, rejected, *or* if `/siteverify` is unavailable (10s
timeout in `constants.mjs`). Under passwordless that is a sharp edge: a Cloudflare or
hCaptcha outage does not degrade sign-in, it **stops sign-in entirely**, with no password
path to fall back to. That is an availability risk to weigh against the abuse it prevents,
and it argues for putting captcha on the *send* endpoints only rather than on verification.

### 2.2 The default endpoint list protects nothing a passwordless user touches

```js
const defaultEndpoints = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset"
];
```

**All three are email+password endpoints.** Under map #47's passwordless-first decision, a
new user hits `/sign-in/magic-link`, `/email-otp/send-verification-otp`, or
`/sign-in/social` — none of which are covered. Dropping the captcha plugin in with default
config would protect only the code path we are retiring, and would look like it was working.

**`endpoints` replaces the default list — it does not extend it.** The docs are explicit:
"If set, only the specified paths will be protected." So listing only the passwordless
endpoints would silently *unprotect* the password endpoints. Every path we want covered must
be re-listed:

```ts
captcha({
  provider: "cloudflare-turnstile",
  secretKey: process.env.TURNSTILE_SECRET_KEY!,
  endpoints: [
    // the defaults, restated — omitting them turns them OFF
    "/sign-up/email",
    "/sign-in/email",
    "/request-password-reset",
    // the ones that actually matter under passwordless
    "/sign-in/magic-link",
    "/email-otp/send-verification-otp",
  ],
})
```

Matching is substring-based (`pathname.includes(endpoint)`), with a built-in exemption so
`/sign-in/email` does not accidentally capture `/sign-in/email-otp`. Note that
`/sign-in/social` cannot usefully be captcha'd — the abuse there is Google's problem, not
ours.

### 2.3 The honest assessment: what captcha adds over passwordless — and it is not what hypergo.io needed

The hypergo.io experience is the important input: sustained fake signups that **confirmed
real inboxes**. That fact is doing a lot of work, and it should change the conclusion rather
than decorate it.

An attacker who confirms a real inbox has already defeated every control that tests inbox
control. Passwordless signup *is* a control that tests inbox control. So:

**Captcha does not stop the hypergo.io attack.** An adversary running real mailboxes and
completing verification is, by construction, either solving captchas (they are cheaply
solvable at scale by human farms and increasingly by models) or driving a real browser that
passes them. Anyone with the patience to confirm inboxes has the patience to clear a
Turnstile challenge.

What captcha *does* buy, honestly and narrowly:

1. **It raises the unit cost of the naive, high-volume script** — the crude flood, not the
   determined adversary. Real, but a lower ceiling than it is usually sold as.
2. **It protects the mail-send endpoints from being used as a free email cannon.** This is
   the strongest argument and it is not really an authentication argument at all. Every
   unauthenticated `POST /sign-in/magic-link` sends an email *from our domain to an
   attacker-chosen address*. At volume that is a reputational attack on our sending domain
   — and map #47 already names deliverability as the real Phase 1 risk. Under passwordless,
   burning the sending domain does not degrade the product; it *is* an outage, because mail
   is the login system.

That second point is the whole case, and it reframes the priority: the endpoint that most
needs protection is the **magic-link / OTP send** endpoint, and the risk being reduced is
**deliverability**, not account fraud.

But it also means captcha is the *second*-best tool for the job. Rate limiting protects the
same endpoint against the same risk, costs no user friction, adds no vendor, does not fail
closed (§2.1), and — once §1.1 is fixed — is already configured and already correct. **Fix
rate-limit storage first and measure. Adopt captcha only if abuse persists past working rate
limits.** Shipping captcha on top of rate limiting that provably does not work would be
treating the symptom while the actual control stays broken — and would newly couple our
ability to log in at all to a third party's uptime.

### 2.4 Provider tradeoffs, if it comes to that

**Cloudflare Turnstile wins on all three axes, and it is not close.**

| | free tier | friction on the free tier | privacy |
|---|---|---|---|
| **Turnstile** | **Unlimited** challenges. Limits are structural: 20 widgets/account, 10 hostnames/widget | **Managed / non-interactive / invisible** — low friction is the free default | Strongest. Processes only IP, TLS fingerprint, User-Agent, sitekey |
| **hCaptcha** | **10,000 req/month**, org-wide | **Interactive image challenges.** Passive mode is Pro/Enterprise | Explicitly not in the targeted-ad business |
| **reCAPTCHA** | 1M `/siteverify` calls/month (classic) | v3 invisible | Weakest — a Google tracking surface on our sign-in page |

Three specifics that matter more than the table:

1. **hCaptcha's free limit is 10k/month and it is not on the pricing page** — it is in the
   ToS, it aggregates across all accounts an organization holds, and the stated remedy for
   overage is *service termination*, not overage billing. Combined with interactive image
   challenges on the free tier, hCaptcha is the worst of the three for us.
2. **Classic reCAPTCHA v3 fails *open* when over quota** — it returns a static score of 0.9
   with `"Over free quota."` and, per Google, "there are no user-visible indications." Our
   protection would silently switch itself off. Note this is the opposite of the plugin's own
   fail-closed behavior, so the failure mode depends on *which* thing broke.
3. **Google's two free tiers differ by 1000×** and we did not reconcile them: the FAQ says 1M
   classic `/siteverify` calls/month; Cloud pricing says 10,000 Enterprise `createAssessment`
   assessments/month. Better Auth calls `/siteverify`, so the 1M figure is the one that
   applies — but Google is actively pushing migration to Enterprise, so it is not a number to
   build a plan on.

Privacy is a live concern for us specifically, not a box-tick: Nihon-Go! is aimed partly at
schools, and reCAPTCHA sets a Google cookie on the sign-in page. Turnstile's signals are
documented as "strictly necessary," which is also the easier consent posture.

CaptchaFox is supported by the plugin but is a much smaller vendor; no reason to take that
risk when Turnstile is free and unlimited.

Worth noting an alternative the plugin does not cover: **Vercel BotID** applies an invisible
check per route, is free at the basic tier on all plans, and needs no third-party script on
our sign-in page. Given we are already on Vercel, it is likely the lower-friction option if
we decide we need bot defense at all. Vercel WAF rate limiting is a second platform-level
option that runs *before* our function and cannot be spoofed via app-visible headers —
though note Vercel documents its rate-limit counters as **per-region**, so a global limit is
not what it delivers.

### 2.5 Disposable-email blocking: not in the open-source core; exists only as a paid add-on

`grep -rniE "disposable|tempmail|mailinator|throwaway"` across `better-auth/dist` and
`@better-auth/core/dist` returns **zero matches**. There is no such feature, under any name,
in the 1.6.29 packages we have installed.

It does exist in **Sentinel** (`@better-auth/infra`), which
<https://better-auth.com/docs/infrastructure/introduction> states plainly is "a paid
service." Its `security.emailValidation` offers `low` ("block only known disposable
domains") / `medium` (adds MX-record checks) / `high` (heuristics), with
`action: "log" | "challenge" | "block"`. Sentinel also bundles velocity limits, credential-
stuffing defense, and — notably for our case — `emailNormalization`, which strips Gmail
plus-tags and dots to defeat alias-based multi-accounting.

Sentinel is worth *knowing about* as the buy-instead-of-build option, but taking on a paid
vendor dependency for the whole auth layer is a much bigger decision than this ticket, and
belongs to map #47 if anywhere.

**If we build it ourselves, use a request-level `hooks.before`, not `databaseHooks`.**
The docs' own example for `hooks.before` is literally domain filtering. The distinction is
load-bearing under passwordless: `databaseHooks.user.create.before` fires at user-row
creation, which happens *after* the magic-link or OTP email has already been sent to an
unregistered address — so it does not stop the send-side abuse that §2.3 identifies as the
actual risk. Only a `before` hook on the send endpoints does.

**But weigh it against the same evidence as §2.3.** Hypergo.io's attackers used inboxes that
*confirmed*, which is consistent with real or long-lived mailboxes rather than
throwaway-domain addresses. A blocklist would not have stopped them, and blocklists carry a
real false-positive cost: they are maintained by third parties, they go stale, and they
reject legitimate users with no recourse and no signal to us. Under passwordless, a
wrongly-blocked domain is a user who can never sign up and never tells us why.

**Recommendation: do not build this now.** Revisit only if signup logs actually show
throwaway domains clustering — which is a question our telemetry should be able to answer,
and currently cannot.

---

## 3. Performance

Against <https://better-auth.com/llms.txt/docs/guides/optimizing-for-performance.md>.

### 3.1 Missing database indexes — the one unambiguous win

The guide names the indexes Better Auth's own queries need. Checked against
`src/lib/db/auth-schema.ts` and `drizzle/0000_outstanding_stone_men.sql`, which contains
exactly one index (`user_progress_user_lesson_uq`):

| table | column | present? |
|---|---|---|
| `user` | `email` | yes — implied by `.unique()` |
| `session` | `token` | yes — implied by `.unique()` |
| `session` | `user_id` | **MISSING** |
| `account` | `user_id` | **MISSING** |
| `verification` | `identifier` | **MISSING** |

`verification.identifier` is the one that will bite. Every magic-link and OTP verification
looks a row up by it, so the passwordless migration turns this table from nearly-unused into
the hottest lookup in the auth path — on an unindexed sequential scan that grows with every
link ever issued. **Add these before passwordless ships, not after.**

Cheap, reversible, no application change: three `CREATE INDEX` statements in a Drizzle
migration.

### 3.2 `cookieCache` is already doing the heavy lifting

Already enabled at 5 minutes in `src/lib/auth.ts` — the guide's headline recommendation, and
already correct. Nothing to change. As noted in §1.6 it does not weaken sensitive endpoints,
which use an authoritative lookup regardless.

### 3.3 `advanced.backgroundTasks` is a correctness fix on serverless, not just a speed one

Without a handler, deferred work is **awaited inline** (`create-context.mjs`):

```js
if (options.advanced?.backgroundTasks?.handler) { ...handler(promise)... }
else await promise;
```

and the fire-and-forget variant (`runInBackground`) is a bare `p.catch(() => {})`, which on
serverless can be frozen mid-flight when the response returns — work silently lost.

This becomes directly relevant if we adopt database rate-limit storage (§1.1), because
expired-row pruning runs through `runInBackgroundOrAwait` — so without a handler, requests
that cross a window boundary also pay for a `DELETE`.

Next 16.3.0 gives us the right handler natively. Note Vercel's docs explicitly steer Next
15.1+ users to `after()` rather than `@vercel/functions`' `waitUntil`
(<https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package>), and
we do not have `@vercel/functions` installed:

```ts
import { after } from "next/server";
// ...
advanced: { backgroundTasks: { handler: (p) => after(p) } }
```

### 3.4 Exempt `/get-session` from rate limiting when moving to database storage

`useSession()` is called in `Header.tsx` — which renders on every page — plus `Home.tsx` and
`Profile.tsx`. Each is a client-side `GET /api/auth/get-session` over HTTP, and the rate
limiter runs in the router's `onRequest` (`api/index.mjs`), so every one of those would take
the ~2 extra Neon round trips once storage is `"database"`.

Server-side `auth.api.getSession()` calls — `src/lib/session.ts`, the layouts, the API
routes — go through the direct API and **bypass the router**, so they are unaffected either
way. Only the browser calls pay.

```ts
rateLimit: {
  storage: "database",
  customRules: { "/get-session": false },
}
```

Disabling it is safe: a session-read flood is not the abuse we care about, and cookieCache
already absorbs most of these. Documented at
<https://better-auth.com/llms.txt/docs/concepts/rate-limit.md>.

### 3.5 SSR session hand-off — real, but a UX win more than a perf one

The guide recommends pre-fetching the session server-side and passing it to the client as a
fallback. We do the opposite: server components call `requireSession()`, then `Header.tsx`
independently re-fetches over HTTP. Every page load carries a redundant round trip, and
`isPending` causes header auth state to flash on first paint.

Worth doing, but it touches component wiring rather than config, so it is a bigger change
than anything else here.

### 3.6 Micro-optimizations — explicitly not worth it

- **`better-auth/minimal`** (drops Kysely). Bundle size on a server-rendered Vercel app is
  not our bottleneck, and it costs us drizzle-kit-independent migrations. Skip.
- **Wrapping `getSession` in React `cache()`** to dedupe layout+page calls within one
  render. Genuinely tidy, but cookieCache already makes each call cheap. Do it if touching
  `src/lib/session.ts` anyway; not worth a dedicated change.

### 3.7 Not a recommendation, but worth recording: transactions and the Neon HTTP driver

`drizzle-orm/neon-http` throws on `db.transaction()`:

```js
async transaction(_transaction, _config = {}) {
  throw new Error("No transactions support in neon-http driver");
}
```

We are safe today for two reasons: the Drizzle adapter's `transaction` config defaults to
**`false`** (`transaction: config.transaction ?? false ? ... : false`), and its three
internal `db.transaction()` call sites are all gated on `config.provider === "mysql"` — we
pass `"pg"`.

Two things follow. **Never set `transaction: true` on `drizzleAdapter`** while production
uses the HTTP driver; it would throw at runtime in production only, since local dev uses
node-postgres and would pass. Worth a comment in `src/lib/auth.ts` next to the adapter.

And the accepted consequence: multi-step auth writes (create user + create account on
signup) are **not atomic**, so a mid-sequence failure can orphan a user row with no account.
Low frequency, not fixable without abandoning the HTTP driver, and cheaper to detect than to
prevent. Recording it so it is a known quantity rather than a surprise.

---

## Prioritized recommendations

Effort estimates are implementation + review, excluding deploy verification.

### P0 — do before passwordless ships

| # | Change | Risk reduced | Effort |
|---|---|---|---|
| 1 | `rateLimit.storage: "database"` + migration for the `rateLimit` table (§1.1) | **Brute force / credential stuffing / mail-send flooding.** Today's limits are near-decorative on serverless; every other rate-limit control depends on this one. | ~2h (migration + config + verify limiting across instances) |
| 2 | Add indexes on `session.user_id`, `account.user_id`, `verification.identifier` (§3.1) | **Auth latency degrading with table growth.** `verification.identifier` becomes the hottest auth lookup under magic link / OTP and is currently a sequential scan. | ~30m |
| 3 | Pin `ipAddressHeaders: ["x-forwarded-for"]` with a comment explaining why (§1.2) | **Rate-limit bypass via header spoofing.** Correct today by luck; the published docs actively recommend the spoofable configuration. | ~15m |
| 4 | `advanced.backgroundTasks.handler = (p) => after(p)` (§3.3) | **Silently dropped background work; inline latency.** Becomes load-bearing the moment #1 lands. | ~15m |
| 5 | `customRules: { "/get-session": false }` (§3.4) | **Latency regression introduced by #1** — `useSession()` in the global header means every page load would otherwise pay 2 extra DB round trips. Ship with #1, not after. | ~10m |

### P1 — decide during Phase 1

| # | Change | Risk reduced | Effort |
|---|---|---|---|
| 6 | Stop offering password *signup*; keep password login for existing accounts (§1.7) | **Account pre-hijacking and spam signups** via unverified email+password registration, which is unverified today. Aligns with #47's soft-migration decision. | ~1–2h |
| 7 | Set `session.freshAge` explicitly (~15m) (§1.6) | **Irreversible actions from a stolen session.** Passwordless removes the password re-prompt that currently backstops account deletion. | ~15m + a UX decision |
| 8 | Alert on the "could not determine a client IP" warning (§1.2) | **Silent collapse into a single shared rate-limit bucket** — which self-DoSes sign-in. Currently invisible. | ~30m |
| 9 | Fix the `baseURL`/`x-forwarded-host` comment, or set `advanced.trustedProxyHeaders: true` (§1.4) | **Config drift.** No live bug; the comment describes a mechanism that is switched off, which will mislead the next reader. | ~15m |

### P2 — only if evidence appears

| # | Change | Risk reduced | Effort |
|---|---|---|---|
| 10 | SSR session hand-off to `Header.tsx` (§3.5) | Redundant round trip per page load; auth-state flash on first paint. More UX than perf. | ~2–3h |
| 11 | Captcha (Turnstile) on the send endpoints — with **every** default path re-listed in `endpoints` (§2.2, §2.4) | **Sending-domain reputation** (email cannon), *not* account fraud. Gated on abuse persisting after #1 works. Would not have stopped the hypergo.io attack, and **fails closed** — a vendor outage means no sign-in at all. | ~4–6h + vendor setup |
| 12 | Disposable-email blocking via a `hooks.before` on the send endpoints (§2.5) | Low-quality signups. **Not in the OSS core** — ours to build, or buy via paid Sentinel. Gated on telemetry showing throwaway domains clustering; carries real false-positive cost under passwordless. | ~3h + ongoing list maintenance |

### Explicitly recommended against

- `disableCSRFCheck` / `disableOriginCheck` — documented as opening the app to CSRF (§1.5).
- `ipAddressHeaders: ["x-client-ip", ...]` — what `options.md` implies, and trivially
  spoofable on Vercel (§1.2).
- `transaction: true` on `drizzleAdapter` — throws under the Neon HTTP driver, in production
  only (§3.7).
- `better-auth/minimal` — no benefit for our shape, costs migration independence (§3.6).
- Secondary storage / Redis — solves §1.1 too, but adds a vendor for no gain at current
  scale (§1.1).

## Open questions this research could not close

- **Vercel BotID and WAF rate limiting** (§2.4) may be a better fit than the Better Auth
  captcha plugin given we are already on Vercel — BotID is invisible, free at the basic
  tier, needs no third-party script on our sign-in page, and does not fail closed the way
  the plugin does. Not evaluated in depth; worth its own ticket if #11 is ever triggered.
  Caveat already noted: Vercel's WAF rate-limit counters are **per-region**, so it is not a
  drop-in replacement for #1.
- **Better Auth Sentinel** (§2.5) is the buy-instead-of-build answer to several items here
  at once — disposable email, velocity limits, email normalization. It is a paid dependency
  for the auth layer, so the decision belongs to map #47, not this ticket. Flagged, not
  evaluated.
- **What telemetry would trigger #11 or #12?** Both are gated on "if abuse persists," but we
  currently log nothing that would tell us. Map #47 already lists deciding the passwordless
  reversal signal as unspecified; this is the same gap wearing a different hat, and it
  should probably be one ticket.
