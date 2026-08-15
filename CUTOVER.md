# Cutover Runbook

Taking Nihon-Go! from the old CRA + Express + MongoDB stack to production on Vercel.

Everything in phases P0–P5 is built and verified. What's left is provisioning infrastructure, moving the data, and switching the domain. The old stack keeps running untouched the whole time, which is what makes this reversible.

**Expect ~2 hours**, most of it waiting on provisioning. Do it when nobody is authoring content.

**The authoring outage inside those two hours is much shorter.** The whole
sequence was rehearsed end to end on a throwaway Neon branch on 2026-08-15
(#33), starting from a genuinely empty database. The commands took under a
minute of machine time between them:

| Command | Empty branch | Re-run |
|---|---|---|
| `npm run db:migrate` | 2s | — |
| `npm run payload:migrate` | 4s | — |
| `npm run migrate:content` | 12s | 17s |
| `npm run payload:seed-admins` | 3s | 1s |
| `npm run parity` | 2s | — |

Measured against a Neon branch from a laptop, so a production run over the same
pooled connection should land in the same range. What they exclude is every
human part: reading the import's verification output, checking the counts
against the table in step 6, deciding whether to continue. **Budget 15 minutes
for the freeze in step 5 and tell Sachi half an hour.** The scripts are not the
slow part of this.

---

## Before you start

Collect these. Steps 4 onward are blocked without them.

| What | Where from | Cost |
|---|---|---|
| Neon Postgres database | [neon.tech](https://neon.tech) or Vercel's integration | free tier fine |
| Vercel project | [vercel.com](https://vercel.com) | free tier fine |
| Vercel Blob store | the Vercel project's **Storage** tab | free tier fine |
| Resend API key + verified sender | [resend.com](https://resend.com) | free tier fine |
| Container host for pronunciation | Railway / Render / Fly.io | **~$5–20/mo** |

The container host is the only recurring cost, and the only piece that can't be free — it needs ~2GB RAM and must stay warm.

Blob storage backs media uploaded through the CMS. Adding it to the Vercel project sets `BLOB_READ_WRITE_TOKEN` for you.

There is no Airtable step any more. Content lives in Payload, in the same Neon database as everything else (#20).

---

## 1. Provision Postgres

Create the Neon database and copy the **pooled** connection string (it has `-pooler` in the host).

The Neon project already exists (`cornerstone`, `bold-bar-07861256`) and its
`production` branch is **partly migrated**: as of 2026-08-15 drizzle is fully
applied but Payload has only `20260815_071846_initial_content_model` of three,
so `lessons.format` and the `user_progress → lessons` foreign key are both
missing there. Expect `db:migrate` to report nothing to do and `payload:migrate`
to apply the remaining two. That is the normal path, not a problem — but it does
mean step 1 is not a no-op and cannot be skipped.

Two migration systems share this database: drizzle-kit owns the `public` schema (auth + `user_progress`), Payload owns the `payload` schema. See [docs/database-workflow.md](docs/database-workflow.md).

**The order matters and is not interchangeable.** Payload never issues
`CREATE SCHEMA`, so drizzle has to go first; the cross-schema foreign key from
`user_progress` to `lessons` then lands in Payload's migration, the first point
at which both sides of it exist (#44).

```bash
# in .env.local, temporarily:
DATABASE_URL=<neon pooled url>
PAYLOAD_SECRET=<openssl rand -base64 32>

npm run db:migrate         # public schema, and CREATE SCHEMA payload
npm run payload:migrate    # the payload schema, and the cross-schema FK
```

Use the same `PAYLOAD_SECRET` here that you set on Vercel in step 3 — it is only used to sign admin sessions, but a mismatch means the migration you just ran was against a different secret than the app boots with, which is confusing later for no reason.

**Verify:**

```bash
psql "$DATABASE_URL" -c '\dt public.*' \
  -c "select conname from pg_constraint where conname = 'user_progress_lesson_id_lessons_slug_fk'"
```

Five tables in `public` — `user`, `session`, `account`, `verification`, `user_progress` — and the constraint row. `npm run db:studio` shows the same five, empty.

This is the same pair of commands `.github/workflows/migrate-production.yml` runs on every merge, so nothing here is cutover-specific.

---

## 2. Deploy the pronunciation service

From `services/pronunciation/`. Any host that runs a Dockerfile works; Railway is the least work.

```bash
openssl rand -hex 32     # save this — it's PRONUNCIATION_SERVICE_SECRET
```

Set on the container: `PRONUNCIATION_SERVICE_SECRET`, and `PORT` if the host requires one.

Requirements — getting these wrong is the usual failure:
- **Always on.** No scale-to-zero, or every cold start reloads the model. On Cloud Run set `min-instances=1`.
- **≥2GB RAM.** Less will OOM during inference.
- The image is large (~1.5GB) because the model is baked in. That's deliberate.

**Verify:**

```bash
curl https://<your-service-url>/health
# {"ok":true,"modelReady":true}   — modelReady may be false for ~10s after boot
```

---

## 3. Configure Vercel

Import the repo, framework preset **Next.js**, root directory **`.`** (the repo root, not `client/`).

Environment variables — set for Production *and* Preview:

```
DATABASE_URL                  = <neon pooled url>
PAYLOAD_SECRET                = <the value from step 1>
BLOB_READ_WRITE_TOKEN         = set for you when Blob storage is added
BETTER_AUTH_SECRET            = <openssl rand -base64 32>   ← fresh, not your local one
BETTER_AUTH_URL               = https://<your-domain>
RESEND_API_KEY                = <resend key>
EMAIL_FROM                    = noreply@<your-verified-domain>
PRONUNCIATION_SERVICE_URL     = https://<service-url>
PRONUNCIATION_SERVICE_SECRET  = <the secret from step 2>
```

`AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` and `REVALIDATE_SECRET` are gone — delete them from any environment that still has them. `/api/revalidate` existed for an Airtable automation to call and no longer exists either.

**Do not set `MONGODB_URI` on Vercel.** It's only for the local migration script.

Deploy. **Verify** the preview URL loads and you can sign up.

---

## 4. Seed the CMS admins — immediately

Do this in the same sitting as the first deploy, before anything else. It is not optional and it is not cosmetic: while zero `cms_admins` rows exist, Payload serves an **unauthenticated first-user form** at `/admin` to anyone who finds the URL, one submission away from a stranger owning the CMS (#32). Creating the first account closes that window permanently.

```bash
# with .env.local still pointing DATABASE_URL at Neon
npm run payload:seed-admins
```

It creates the committed roster in `scripts/payload/seed-admins.ts`, printing a generated password per account **once** — nothing is written to disk and nothing is emailed. Deliver them through 1Password; each person changes theirs at `/admin` on first sign-in. Someone not on the roster:

```bash
npm run payload:seed-admins -- "Ryoko <ryoko@example.com>"
```

Idempotent by email — an existing account is left completely alone, so it is safe to re-run after a partial failure. Rehearsed in #33: a second run prints `0 created, 2 already existed` and exits 0.

The committed roster is **two** people today, Justin and Sachi. Dev and Ryoko are a commented-out line each in that file, waiting on confirmed addresses — if they need access on the day, pass them on the command line as above rather than editing the roster mid-cutover.

**Verify:**

```bash
curl https://<your-domain>/api/cms_admins/init
# {"initialized":true}
```

`false` means the window is still open. Step 8's parity check asserts this too, but do not wait until then to find out.

The "Forgot password?" link on `/admin` **does not work and fails silently** — Payload has no email adapter. Recovery is another admin resetting it under Settings → CMS admins. See [docs/payload-content-model.md](docs/payload-content-model.md#when-a-password-is-lost).

---

## 5. Announce the content freeze

Tell anyone who authors lessons to **stop editing in MongoDB Compass**. Any edit after this point is lost unless you re-run step 6.

This is the start of the authoring outage. It ends when step 6 reports
`VERIFICATION PASSED` — the admin accounts were already seeded in step 4, so
there is nothing else to wait for. Rehearsed, step 6 is ~15 seconds of machine
time; the window is however long you take to read its output and believe it.
Fifteen minutes is a fair promise, half an hour a safe one.

From here on, Payload is the source of truth for content — `/admin` on the new site.

Nothing has to be wired up for edits to appear: the collection hooks in `src/payload/hooks/revalidate.ts` drop the affected cache tags in-process on every save and delete, because Payload runs inside the app. There is no webhook, no automation and no shared secret. (A one-hour backstop expiry covers anything a hook misses.)

---

## 6. Migrate the data

Locally, with `.env.local` pointing `DATABASE_URL` at **Neon**, `PAYLOAD_SECRET` at the value from step 1, and `MONGODB_URI` at production Mongo (including the `/Cornerstone` database name — without it you get an empty `test` database).

```bash
npm run migrate:content    # Mongo → Payload; ends with a round-trip verification
```

Source is Mongo only — the content that was unique to Airtable was deliberately dropped in #26, so there is nothing to reconcile. The script also bakes the checkpoint expansion (#27): exercise batches that used to be synthesised on every render become real, editable content exactly once, here.

It is idempotent — lessons and resource groups upsert on the Mongo `_id`, courses on slug — so it is safe to re-run.

**Expected output.** It refuses to import a partial set, gating on the survey volume:

| Stage | Expect |
|---|---|
| Source volume | 2 legacy lessons, 3 grammar lessons, 8 resource groups |
| Grammar items in | `l1-v1` 18, `l1-v2` 23, `l2-v1` 27 — expanded on the way in, so more exercises come out than went in |
| legacyJson | "nothing routed to legacyJson — every item mapped to a real block" |
| Verification | "VERIFICATION PASSED — the stored content reproduces the learner-visible sequence computed from Mongo exactly" |
| Final counts | 2 courses, 5 lessons, 8 resources |

The verification pass re-reads everything through Payload, maps it back to the contract shapes in `src/lib/types/lessons.ts`, and diffs it against the sequence computed straight from Mongo. That diff is the only proof the one-way expansion was done correctly.

The script exits non-zero on any rejected record or any diff. If it reports a problem, **stop** — do not proceed until it passes.

---

## 7. Point the domain at Vercel

Add the domain in Vercel and update DNS. Set `BETTER_AUTH_URL` to the final domain if you hadn't already, and redeploy.

---

## 8. Verify production

```bash
npm run parity https://<your-domain>
```

The signed-in half of the check needs an account, so the run **signs up a
throwaway user over the public API and deletes it again** — including here,
against production. It is named `parity-<random>@parity-check.invalid`, and
`.invalid` can never be a real domain. If the run is interrupted the account
can survive; the script prints the address when it fails to clean up. To use an
existing account and have it create nothing, run it as
`PARITY_EMAIL=… PARITY_PASSWORD=… npm run parity https://<your-domain>`.

Expect **36/36**, then **4/4** in the CMS block below it. The CMS block is the
one that catches a deployment serving nothing: it asserts that the Payload admin
boots at all, that at least one `cms_admins` account exists — so the
unauthenticated first-user bootstrap is shut — and that `/resources` and a known
lesson come back with their actual content, not merely a 200.

The bootstrap line is the one to read for that second property. An admin with
the bootstrap still open serves the create-first-user screen at `/admin/login`
with a 200 and a `Login — …` title, indistinguishable over HTTP from the real
login screen, so only that line can tell you which you have.

A failing bootstrap line means step 4 was skipped against this environment; a
failing content line means step 6 was. A 5xx on the whole run usually means the
database was never migrated — `npm run db:migrate` and `npm run payload:migrate`,
step 1.

Then by hand:

- [ ] Sign up as a new user, sign out, sign back in
- [ ] Password reset: request it, receive the email, complete it, sign in with the new password
- [ ] Play a grammar lesson end to end; Save & Exit, reopen, confirm it resumes at the same exercise
- [ ] Pronunciation check on `l1-v1` returns a score (only lesson with real reference audio)
- [ ] Dashboard map renders; clicking a prefecture lists its lessons
- [ ] Sign in to `/admin`, edit a lesson title, reload the site — the new title is there

---

## 9. Decommission

Only after everything above passes.

```bash
git rm -r client server
git commit -m "task: remove the CRA client and Express server after cutover"
```

Also: shut down the old Express host, and update `CLAUDE.md` and `.cursor/rules/` — they still describe the old stack.

**Keep MongoDB read-only for 30 days.** Take a final dump before you touch anything:

```bash
mongodump --uri="$MONGODB_URI" --out=./mongo-final-backup
```

---

## Rollback

Until step 7, rollback is nothing — the old stack is still serving traffic and you just don't switch DNS.

After step 7: **point DNS back**. The old stack is untouched and still works. The only thing you lose is user activity that happened on the new site during the window, so decide quickly.

After step 9 it gets harder — that's why decommissioning is last and the dump is mandatory.

---

## If something breaks

| Symptom | Cause |
|---|---|
| `payload:migrate` says `schema "payload" does not exist` | `db:migrate` was skipped or failed — it creates the schema |
| `payload:*` dies with `ERR_VM_MODULE_LINK_FAILURE` | Node 22. These commands need Node 24 |
| Build fails reading content | `DATABASE_URL` or `PAYLOAD_SECRET` missing on Vercel — pages are prerendered at build and read Payload in-process |
| Every page 500s | `BETTER_AUTH_SECRET` or `DATABASE_URL` missing. Deliberate: no silent fallback |
| Sign-in works, session doesn't persist | `BETTER_AUTH_URL` doesn't match the real domain |
| `parity` exits 2 at the fixture account, `INVALID_ORIGIN` (403) | The check sends `Origin:` set to the URL you passed it, and better-auth trusts only `BETTER_AUTH_URL`. Those two have to be the same origin — port included |
| `parity` passes 36/36 against something you didn't deploy | It checks whatever answers that URL, and a server already holding the port answers instead of the one you just started. Locally, confirm the process on the port is yours before believing a pass |
| Reset emails never arrive | Resend domain not verified, or `EMAIL_FROM` isn't on that domain |
| `/admin` offers to create the first user | Step 4 never ran against this environment. Do it now |
| `/admin` 500s | `PAYLOAD_SECRET` unset, or the `payload` schema was never migrated |
| Media uploads fail in the admin | `BLOB_READ_WRITE_TOKEN` missing — add Blob storage to the Vercel project |
| Pronunciation 502s | Container down or asleep. Check `/health` |
| Pronunciation 503s | `PRONUNCIATION_SERVICE_URL`/`_SECRET` missing on Vercel |
| Lessons and resources empty, no errors | The import (step 6) hasn't run against this database |
| Deleting a lesson fails | Someone has progress on it — unpublish instead. The FK is doing its job (#11) |
| Migration finds nothing | `MONGODB_URI` missing the `/Cornerstone` database name |
