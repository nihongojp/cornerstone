# Research #50 — Platform surface: hosted infrastructure and the admin/role model

Part of map #47 ("Production-ready auth"). Research only — no code changes proposed here
are applied on this branch.

**Tree audited:** `research/platform-surface`, cut from `main` (merge `d025d49`, the
Next.js/Vercel migration merge). `better-auth@^1.6.29` (`package.json:48`),
`payload@3.88.0`, `drizzle-orm@^0.45.2`.

**Note on tree state:** map #47 describes passwordless sign-in (Google + magic link +
email OTP) as shipped. It is **not on `main`**. `src/lib/auth.ts:53-64` configures
`emailAndPassword` only; there is no `socialProviders` key and no `plugins` array on the
server instance, and `src/pages-client/AuthForm.tsx:98` calls `signIn.email(...)` and
nothing else. Everything below is measured against the tree as it actually is.

**Primary sources**

- <https://better-auth.com/llms.txt/docs/infrastructure/getting-started.md>
- <https://better-auth.com/llms.txt/docs/infrastructure/introduction.md>
- <https://better-auth.com/llms.txt/docs/infrastructure/plugins/dash.md>
- <https://better-auth.com/llms.txt/docs/infrastructure/plugins/sentinel.md>
- <https://better-auth.com/llms.txt/docs/infrastructure/plugins/audit-logs.md>
- <https://better-auth.com/pricing>
- <https://better-auth.com/llms.txt/docs/plugins/admin.md>
- <https://better-auth.com/llms.txt/docs/plugins/last-login-method.md>
- The published artifact `@better-auth/infra@0.3.7` on the npm registry (inspected
  directly — see §1.3; docs alone do not answer the data-egress question)
- <https://github.com/better-auth/better-auth/issues/8754>

---

## VERDICTS

1. **Hosted infrastructure — do not adopt now.** `dash()` and `sentinel()` are thin
   client plugins for a **closed-source hosted SaaS**. Both ship auth events —
   including IP address, city and country — to `https://dash.better-auth.com`.
   `sentinel()` additionally puts a synchronous call to a third-party host **on the
   sign-in path**. The $0 Starter tier's audit-log retention is **1 day**, which makes
   it a demo, not an audit log. Exit cost is low (they are additive plugins), but the
   entry cost is a new synchronous external dependency on the login path and a new
   category of PII egress.
2. **`user.role` gates nothing. Hypothesis CONFIRMED.** There are exactly **three**
   non-comment occurrences of `role` in `src/` outside ARIA attributes, and all three
   are declarations. Zero reads, zero comparisons, zero branches. Details in §2.
3. **The `admin` plugin fits `admin`/`member`/`user` with one rename.** Its own
   vocabulary is `admin` + `user`; `member` is added as a plain custom role. It does
   **not** replace a hosted Dashboard — it ships **no UI at all**, only APIs. Migration
   is four nullable columns plus a data backfill of the `"Volunteer"` default. Details
   in §3.
4. **`last-login-method` — adopt, but only once passwordless actually ships.** Free,
   OSS, cookie-only by default, zero schema change. On a Google + magic-link screen it
   is worth having. On today's single-method screen it has nothing to say. Details in §4.

---

## 1. Better Auth hosted infrastructure

### 1.1 What Dashboard and Sentinel concretely are

They are **npm plugins that talk to a hosted service**. Not self-hostable, not
standalone.

Both come from one package (`getting-started.md`):

```bash
npm install @better-auth/infra
```

```ts
import { dash, sentinel } from "@better-auth/infra";
export const auth = betterAuth({
  plugins: [
    dash({ apiKey: process.env.BETTER_AUTH_API_KEY }),
    sentinel({ apiKey: process.env.BETTER_AUTH_API_KEY })
  ],
});
```

- `dash()` — "analytics tracking, audit logging, dashboard admin APIs"
  (`getting-started.md`). `dash.md` describes it as the connection between your Better
  Auth instance and Better Auth Infrastructure, powering the web dashboard with
  real-time data.
- `sentinel()` — "security checks and abuse protection" (`getting-started.md`).

The Infrastructure introduction page calls the whole thing "Enterprise-grade dashboard,
security, and managed services for Better Auth" — explicitly **a paid service layer on
top of the OSS library** (`introduction.md`).

Both require `BETTER_AUTH_API_KEY`, "obtained from the infrastructure dashboard"
(`getting-started.md`). No key, no function. There is no local-only mode documented and
none in the shipped code.

**The audit-log plugin is not separate.** `audit-logs.md` says setup is just adding
`dash()` — audit logs *are* the hosted service, not a local table.

### 1.2 Open source status — it is not

`@better-auth/infra@0.3.7` declares `"license": "MIT"` and
`"repository": "git+https://github.com/better-auth/infrastructure.git"`, but that repo
returns **404** (verified). So does `github.com/better-auth/better-auth-infra`, the URL
named in issue #8754. The published tarball contains `dist/` only —
`"files": ["dist", "README.md", "CHANGELOG.md"]` — i.e. compiled JS with no source.

This is the substance of
[better-auth#8754](https://github.com/better-auth/better-auth/issues/8754) (opened
2026-03-24, **closed and locked after 7 days with no maintainer answer**), which raised
exactly the questions we are asking: where is the data stored, what is the retention,
who can access it. They were not answered.

Treat "MIT" in the manifest as unverifiable. There is no source to read and no repo to
fork.

### 1.3 What data leaves, and where it goes

The docs do not say. The shipped bundle does. From
`@better-auth/infra@0.3.7`, `dist/constants-AfApXLhx.mjs`:

```js
const INFRA_API_URL = env.BETTER_AUTH_API_URL || "https://dash.better-auth.com";
const INFRA_KV_URL  = env.BETTER_AUTH_KV_URL  || "https://kv.better-auth.com";
const KV_TIMEOUT_MS = 1e3;
const INFRA_API_TIMEOUT_MS = 3e3;
```

Two third-party hosts. Route paths found in `dist/index.mjs` include `/events/track`,
`/events/activity`, `/events/user`, `/events/organization`, `/events/list`,
`/security/check`, `/security/pow/generate`, `/security/pow/verify`, `/email/validate`,
`/dash/user`, `/dash/sessions/revoke`, `/v1/sms/send`.

The event payload builder in `dist/index.mjs` sets `ipAddress: location?.ipAddress`,
and the `location` object it reads carries `city`, `country`, `countryCode`,
`ipAddress`. `userAgent` is likewise attached to tracked events. Country is derived
from `cf-ipcountry` / `x-vercel-ip-country` headers.

So, concretely, per event to `dash.better-auth.com`: **user id and identity fields, event
type, IP address, city, country, user agent, session and organization identifiers.**

`dash.md` enumerates the event categories: registration, profile updates, avatar
changes, email verification, ban/unban, deletion; sign-in/out, session
create/revoke, impersonation; social account link/unlink, password changes; password
reset request and completion, verification sends. That is the whole learner lifecycle.

`dash.md` documents **no sampling, redaction, or per-event opt-out options.** The only
knobs are `apiTimeout` (3000ms), `kvTimeout` (1000ms), and
`activityTracking.{enabled,updateInterval}`.

**Sentinel is worse from a coupling standpoint.** Its checks are inline and blocking on
the auth request path (`sentinel.md`): credential stuffing (challenge after 3 failed
attempts, block after 5), impossible travel, free-trial abuse via device fingerprinting
(an `X-Visitor-Id` header), compromised-password checks against HaveIBeenPwned
(k-anonymity — first 5 chars of the hash only, which is the one genuinely well-behaved
part), stale-account monitoring, geo-blocking, bot detection, suspicious-IP blocking,
velocity limits, and disposable-email blocking. Triggered checks return **HTTP 423** with
a Proof-of-Work challenge the client must solve.

That means: with `sentinel()` enabled, every sign-in attempt makes a synchronous HTTPS
call to `dash.better-auth.com` with a 3s timeout budget before our own login can
complete. `sentinel.md` states only that checks "may fall back to allow mode" when the
API key is missing; **outage behaviour is not documented**. For a login system this is
the single most important unanswered question about the product.

Given map #47's framing — mail *is* the login system under passwordless, and the real
risk is deliverability — adding an undocumented-failure-mode remote dependency to the
same path is the wrong direction.

### 1.4 The free tier, and what bites

From <https://better-auth.com/pricing>:

**Starter — $0/month**

- 1 dashboard seat
- 10,000 audit logs / month, **1 day retention**
- 1,000 security detections / month
- Community support

**Pro — $20/month**

- Unlimited seats
- 20,000 audit logs / month, then $0.0001 per event
- **7 days** audit log retention
- 10,000 security detections / month, then $0.001 per event
- Self-service SSO & Directory Sync: 1 connection, then $50/month per connection
- Transactional email ($0.001/email) & SMS ($0.09/SMS)
- Email templates & abuse protection
- Email support

**Enterprise — custom.** Custom usage and retention; custom domain and **log drain**;
Dashboard RBAC; Slack support; custom MSA and DPA.

No MAU limit is stated on any tier.

What bites, in order:

1. **1-day retention on free.** An audit log you cannot query about yesterday is not an
   audit log. Any incident review — "who signed in as this learner last week" — is
   impossible. Even Pro's 7 days is short for a volunteer-run project where nobody looks
   until Monday.
2. **1,000 security detections/month on free.** `sentinel.md` counts detections, not
   requests, so a single credential-stuffing burst can eat the monthly budget in
   minutes — precisely when the protection matters. Behaviour past the cap is not
   documented.
3. **1 dashboard seat on free.** Single-operator only. No second admin, no handoff.
4. **Log drain is Enterprise-only.** There is no documented way on Starter or Pro to get
   our own events into our own storage. The data goes one way.
5. **No DPA below Enterprise.** "Custom MSA and DPA" is listed only under Enterprise. We
   would be shipping learner PII (IP, city, country) to a vendor with no data-processing
   agreement. For an education product with plausibly under-18 users, that is a real
   objection, not a theoretical one.

### 1.5 Lock-in and exit cost

Lock-in is **low on code, total on data**.

- *Code:* both are additive plugins. Deleting `dash()` and `sentinel()` from
  `src/lib/auth.ts` and dropping `@better-auth/infra` returns the app to its current
  state. The core `betterAuth()` config, our Drizzle schema, and our tables are
  untouched. No migration to unwind, with one exception: `dash({ activityTracking })`
  adds a `lastActiveAt` column to `user` (`dash.md`) — one nullable column, trivially
  kept or dropped.
- *Data:* on Starter and Pro there is no log drain and no documented export. Whatever
  audit history accumulates is gone at cancellation, and on Starter it is gone in 24
  hours anyway. There is nothing to migrate because there is nothing we could have kept.
- *Behavioural:* if `sentinel()` is ever load-bearing (it is the only brute-force
  protection), removing it is not a config change, it is a security regression that needs
  a replacement built first. This is the one that would actually trap us. **Do not let
  Sentinel become the only rate limiter.**

### 1.6 Recommendation

**Do not adopt either plugin now.** Reasons, in priority order: closed source with a
404 repo and an unanswered, locked issue about exactly this; undocumented outage
behaviour on a plugin that sits inline on sign-in; 1-day retention that makes the free
audit log ornamental; no DPA below Enterprise while shipping learner IP and geolocation.

The constraint "we will try free things" is satisfiable at zero risk by trying `dash()`
**against a preview deployment on a disposable Neon branch only**, never production —
enough to see the dashboard UI and judge whether it is worth $20/month later. That
experiment is genuinely free and genuinely reversible.

If brute-force protection is the real want, Better Auth core already ships rate limiting
in the OSS library, and it runs entirely on our infrastructure. That is the thing to
reach for before Sentinel.

---

## 2. Codebase audit — where `role` is actually read or enforced

**Nowhere. Confirmed by exhaustive grep, not by inspection of likely files.**

`grep -rni "role" src/` returns **16 hits total**. Classified, all 16:

### 2.1 Declarations (3 — the only functional code)

| File:line | What |
|---|---|
| `src/lib/auth.ts:71` | `role: { type: "string", required: false, input: false, defaultValue: "Volunteer" }` — Better Auth `additionalFields` declaration |
| `src/lib/db/auth-schema.ts:22` | `role: text("role").default("Volunteer")` — Drizzle column |
| `drizzle/0000_outstanding_stone_men.sql:49` | `"role" text DEFAULT 'Volunteer',` — the DDL that created it |

That is the entire lifecycle of the field: it is declared, it is defaulted, it is
persisted. Nothing ever reads it back.

### 2.2 Comments referencing it (4 — no behaviour)

- `src/lib/auth.ts:69-70` — "Not user-settable: `input: false` keeps it out of
  signup/update payloads so nobody can self-assign a role."
- `src/lib/db/auth-schema.ts:8` — notes it carries over the shape of the old Mongoose
  `User` model.
- `src/lib/auth-client.ts:8` — notes the type-only import makes `role` typed on the
  session user.
- `src/payload/collections/CmsAdmins.ts:11` — **"learner admin and analytics are
  authenticated Next routes keyed off `user.role`, not Payload views (#16)."** This
  sentence describes an intention, not the code. No such route exists. Worth correcting
  when the role model lands, so it stops reading as a statement of fact.

### 2.3 ARIA attributes (7 — unrelated)

`src/pages-client/Resources.tsx:433,567`; `src/components/DragDropPlaceholder.tsx:237`;
`src/components/PronunciationExercise.tsx:392,503`;
`src/components/NewLessonPageItem.tsx:118`; `src/components/DragDropCombination.tsx:255`;
`src/components/DragDrop.tsx:336`. All `role="button"` / `role="alert"` /
`role={disabled ? "article" : "button"}`.

### 2.4 Payload migration snapshots (2 — unrelated)

`src/payload/migrations/20260815_071846_initial_content_model.json:7932` and
`src/payload/migrations/20260815_090103_lesson_format.json:7994`, both `"roles": {}` —
Payload's own DB-role snapshot key, nothing to do with learner accounts.

### 2.5 Every enforcement point, verified as role-blind

This is the part worth being explicit about: the places that *could* read `role` and
demonstrably do not.

| Enforcement point | File:line | What it actually checks |
|---|---|---|
| Edge gate | `src/proxy.ts:20` | `if (getSessionCookie(request)) return NextResponse.next();` — **cookie presence only**, not even validity. Its own comment (`src/proxy.ts:9-13`) says so. Matcher at `src/proxy.ts:29-38` covers `/dashboard`, `/lesson/*`, `/newlesson/*`, `/new-lessons`, `/watch`, `/talk`, `/profile`. |
| Session helper | `src/lib/session.ts:7-9` | `getSession()` returns `auth.api.getSession(...)` verbatim. No role logic. |
| Session helper | `src/lib/session.ts:16-20` | `requireSession()` — `if (!session) redirect("/auth")`. Authentication only. This is described in-file as "the real auth boundary", and it is binary. |
| Dashboard layout | `src/app/(app)/(dashboard)/layout.tsx:6` | `await requireSession();` |
| Player layout | `src/app/(app)/(player)/layout.tsx:13` | `await requireSession();` |
| Protected layout | `src/app/(app)/(site)/(protected)/layout.tsx:10` | `await requireSession();` |
| Public-only layout | `src/app/(app)/(site)/(public-only)/layout.tsx:11` | `if (await getSession()) redirect("/new-lessons");` — inverse check, still binary |
| `POST/GET /api/progress` | `src/app/(app)/api/progress/route.ts:15,39,71,79` | `getSession()`, then `session.user.id` as an ownership scope on the query. Ownership, not role. |
| `GET /api/progress/[lessonId]` | `src/app/(app)/api/progress/[lessonId]/route.ts:13,25` | same shape — `session.user.id` scoping |
| `GET /api/progress/up-next` | `src/app/(app)/api/progress/up-next/route.ts:23,33` | same shape |
| `POST /api/pronunciation/check` | `src/app/(app)/api/pronunciation/check/route.ts:22` | `getSession()` only. **Any signed-in account reaches the GPU proxy.** This is the abuse-gating gap map #47 already flags under "Not yet specified". |
| Auth catch-all | `src/app/(app)/api/auth/[...all]/route.ts` | Better Auth's own handler |
| Payload routes | `src/app/(payload)/api/**` | Guarded by Payload's `cms_admins` collection (`src/payload/collections/CmsAdmins.ts:13-16`), a wholly separate auth system |

### 2.6 Where it reaches the client, and dies

`src/lib/auth-client.ts:13` uses `inferAdditionalFields<typeof auth>()`, so `role` is
**typed** on `authClient.$Infer.Session.user` (`src/lib/auth-client.ts:29`) and present
in the session payload the browser receives. Two consumers touch that object:

- `src/components/Header.tsx:38` — `const me = session?.user ?? null;` then reads name
  and email only.
- `src/pages-client/Profile.tsx:59-73` — `normalizeUser()` explicitly projects to
  `firstName`, `lastName`, `email`, `rememberMe`, `createdAt`, `updatedAt`, `lastLogin`.
  **`role` is dropped on the floor.**

So `role` is serialised to every browser and used by nothing.

### 2.7 Consequences for the migration

- The field is a **dead column with one distinct value**. Every row is `"Volunteer"`
  or `NULL`. There is no data to preserve, no semantics to translate, and no behaviour
  that can regress.
- Changing the default and rewriting every row is therefore **behaviourally a no-op**.
  This is the cheapest possible moment to fix the vocabulary — it gets more expensive
  the instant anything starts reading it.
- `input: false` (`src/lib/auth.ts:71`) is correct and must survive whatever replaces
  it. Note that the `admin` plugin's `setRole` endpoint is the sanctioned way to write
  it, and that endpoint is admin-gated — so `input: false` and the plugin are
  complementary, not in conflict.

---

## 3. The `admin` plugin against `admin` / `member` / `user`

Source: <https://better-auth.com/llms.txt/docs/plugins/admin.md>

### 3.1 Does its vocabulary fit ours?

**Two of our three names are its defaults.** The plugin ships exactly two roles: `admin`
("full administrative control over other users") and `user` ("no control over
administrative operations"). It imposes no others.

Our `member` is simply a third role we define. Nothing in the plugin objects to extra
roles; it only needs to know which roles are *administrative*, via `adminRoles` (defaults
to `["admin"]` — correct for us as-is).

Two facts that matter for our model:

- **Roles are multi-valued.** "A user can have multiple roles. Multiple roles are stored
  as string separated by comma (`,`)." So `role` stays a `text` column; it is a
  comma-joined list, not an enum. Any code we write must not assume `role === "admin"` —
  it must go through the plugin's `hasPermission()` / `checkRolePermission()`.
- **`defaultRole` is configurable** and defaults to `"user"`. Since our unregistered tier
  is also called `user`, `defaultRole` needs no override — the plugin's default is
  already our intended default. That is a happy accident worth not disturbing.

For `member` to mean anything beyond a label, we need the access-control layer:

```ts
import { createAccessControl } from "better-auth/plugins/access";
const statement = { /* our resources */ } as const;
const ac = createAccessControl(statement);
```

then `ac.newRole({...})` per role and `admin({ ac, roles: { admin, member, user } })` on
both server and client. When overriding the built-ins, the docs require merging
`defaultStatements` and `adminAc.statements` rather than replacing them.

That access-control work is only needed once `member` actually gates something.
Since paid tiers are explicitly unsettled (map #47), the sane sequencing is: land the
vocabulary and the schema now, define `member`'s permissions when there is a paid
feature to protect.

### 3.2 What it gives us

Server APIs and matching client methods, no UI:

- **Users:** `createUser`, `listUsers` (filter, search, sort, paginate), `getUser`,
  `updateUser`, `removeUser` (hard delete)
- **Roles/credentials:** `setRole`, `setUserPassword`
- **Banning:** `banUser` (blocks sign-in *and* revokes sessions; optional reason and
  expiry), `unbanUser`
- **Sessions:** `listUserSessions`, `revokeUserSession`, `revokeUserSessions`
- **Impersonation:** `impersonateUser`, `stopImpersonating`
  (`impersonationSessionDuration` defaults to 3600s)
- **Permission checks:** `hasPermission` (server), `checkRolePermission` (sync, client)

Default permission statements: `user` resource — `create list set-role ban impersonate
impersonate-admins delete set-password set-email get update`; `session` resource —
`list revoke delete`.

Also available: `admin({ adminUserIds: [...] })`, which grants full admin rights by user
id independent of role. These OR together with role-based admin. **This is the
bootstrap answer** — it makes the first admin without a manual `UPDATE`, and without a
chicken-and-egg where you need an admin to create an admin.

### 3.3 Does it replace a hosted Dashboard subscription?

**Partly, and the part it does not cover is the part we would be paying for.**

- **It replaces the Dashboard's user-management functions.** Listing, searching, banning,
  session revocation, impersonation — all of it, on our own infrastructure, for free,
  reading our own Postgres.
- **It does not replace the analytics or audit log**, because it does not record events
  at all. Nothing writes a history.
- **It ships no UI.** `admin.md` is explicit: backend APIs and client methods only. A
  usable admin screen is ours to build.

So the honest comparison is: `admin` plugin = free, self-hosted, no history, build the
screen yourself. Hosted Dashboard = $0–20/month, a UI you get immediately, an event
history with 1–7 day retention, and learner PII on someone else's servers.

Given §1, the `admin` plugin is the right answer, and a modest internal admin page is the
work it implies. If we later want history, an append-only `audit_log` table written from
Better Auth's own database hooks stays on our infrastructure, has retention we choose,
and costs nothing.

Payload's `cms_admins` stays exactly where it is
(`src/payload/collections/CmsAdmins.ts:13-16`, its own `payload` schema). This plugin
touches `public.user` only. The two systems remain unconnected, as settled in map #47.

### 3.4 The migration it implies

Additive and small. Better Auth's schema tables from `admin.md`:

**`user`** — `role` (string, optional) already exists as
`src/lib/db/auth-schema.ts:22`. Three new nullable columns:

| Column | Type | Notes |
|---|---|---|
| `banned` | boolean, nullable | |
| `banReason` | string, nullable | |
| `banExpires` | date, nullable | |

**`session`** — one new nullable column:

| Column | Type | Notes |
|---|---|---|
| `impersonatedBy` | string, nullable | admin's user id |

Plus the value change, which is the only part touching existing rows:

1. `ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';`
2. `UPDATE "user" SET role = 'user' WHERE role = 'Volunteer' OR role IS NULL;`

Per §2.7 this is safe by construction — no code reads the old value, so no code can
break on the new one. It should still be a forward-only Drizzle migration
(`npm run db:generate`, per `package.json:16-17`), not a manual statement.

Config change at `src/lib/auth.ts:71` — the `additionalFields` entry for `role` is
superseded by the plugin's own `role` field. Keep the write-protection intent; verify
against the plugin whether `input: false` is still needed or whether the plugin's
field declaration already excludes it from signup payloads. **This is the one point
worth testing rather than assuming** — self-assignment of `admin` at signup is the
failure mode that matters, and it is the exact thing `src/lib/auth.ts:69-70` was
written to prevent.

Client change at `src/lib/auth-client.ts:13` — add `adminClient()` alongside
`inferAdditionalFields`.

Recommended rollout: install the plugin with `adminUserIds` set to the founding admin's
id, migrate the columns, backfill `"Volunteer"` → `"user"`, then use `setRole` to grant
the real `admin` role and drop `adminUserIds` afterwards. Define `member` permissions
when paid tiers exist.

---

## 4. `last-login-method`

Source: <https://better-auth.com/llms.txt/docs/plugins/last-login-method.md>

### 4.1 What it is and what it costs

Tracks "the most recent authentication method used by users (email, OAuth providers,
etc.)" so a sign-in screen can show "Last signed in with Google".

**Cost: zero.** Core OSS plugin, no hosted dependency, no API key, no pricing mentioned
anywhere in its docs.

**Schema cost: zero by default.** It writes a **non-`httpOnly` cookie**
(`better-auth.last_used_login_method`, `maxAge` 2592000 = 30 days) readable by
client-side JS. A `user.lastLoginMethod` column exists only if you opt in with
`storeInDatabase: true`, which then needs a migration.

Client API: `authClient.getLastUsedLoginMethod()`,
`authClient.isLastUsedLoginMethod("google")`,
`authClient.clearLastUsedLoginMethod()`.

Other options: `cookieName`, `maxAge`, `customResolveMethod`, `beforeStoreCookie` (an
async consent/GDPR hook returning a boolean), `schema` for field renaming. Client side
takes a matching `cookieName` and, for cross-subdomain clearing, `domain`.

### 4.2 Does it earn a place on a Google + magic-link screen?

**Yes — and more here than on a typical screen.** The argument is specific to
passwordless.

Under passwordless with two entry points, the returning user's failure mode is picking
the wrong one: they signed up with Google, come back, type their email into the magic-link
box, and now they are waiting on an email that — per map #47's own risk framing — may
never arrive. A "Last signed in with Google" hint removes that fork before it happens,
which converts a deliverability failure into a click.

It is also *cheap in the right way*: a cookie, not a column; a hint, not a gate; and
`clearLastUsedLoginMethod()` gives a shared-device escape hatch.

Two caveats to respect:

1. **The cookie is deliberately non-`httpOnly`.** It reveals which provider an email
   address uses, to any script on the origin. Low severity, but it is a real
   account-enumeration hint and should be a conscious choice, not a default we drifted
   into. `beforeStoreCookie` is the documented place to gate it on consent.
2. **Skip `storeInDatabase`.** The value is a UI hint on the device in front of the user;
   putting it in Postgres buys nothing and adds a migration and a per-login write.

### 4.3 Timing

Not yet. Per the header note, `main` ships one sign-in method
(`src/pages-client/AuthForm.tsx:98`), and a plugin that tells a user "you last signed in
with email" when email is the only option is noise. It should land **in the same change
as** the Google + magic-link screen, not before.

---

## Open questions this research could not close

1. **Sentinel's behaviour when `dash.better-auth.com` is unreachable or slow.** Not
   documented; source not available. This is disqualifying on its own for an inline
   sign-in dependency, and it is the first thing to ask if Better Auth Infrastructure is
   ever reconsidered.
2. **Where hosted data physically resides, and retention beyond the tier line.** Not
   stated on any page read. Issue #8754 asked and was closed without an answer.
3. **Whether `input: false` on `role` (`src/lib/auth.ts:71`) is still required, or
   redundant, once the `admin` plugin owns the field.** Must be verified empirically
   against `better-auth@1.6.29` before the migration lands — see §3.4.
4. **What `member` actually permits.** Blocked on paid tiers, which map #47 says are
   unsettled and not a blocker. The vocabulary can land without it.
