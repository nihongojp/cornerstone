# Cutover Runbook

Taking Nihon-Go! from the old CRA + Express + MongoDB stack to production on Vercel.

Everything the app needs is built and verified. What's left is provisioning
infrastructure, moving the content, and switching the domain. The old stack keeps
running untouched the whole time, which is what makes this reversible.

**Do it when nobody is authoring content.** Step 4 starts a freeze that lasts until step
9 passes. The rehearsal (#33) measured it: the scripts total under a minute, and what
the window really costs is one approval click, DNS, and step 9's by-hand checklist — see
[The freeze window](#the-freeze-window).

**Production domain: `cornerstone.nihongojp.com` — provisional.** The subdomain name is
an unsettled product-naming question. Renaming it costs a DNS record, a
`BETTER_AUTH_URL` change and a redeploy today; once learners have bookmarks and saved
password-manager entries it costs those plus a redirect that has to stay up
indefinitely. If the name is going to change, change it before step 8.

Because it is provisional, the steps below write it as `<the production domain>` rather
than repeating it — so a rename is this one paragraph and step 8, not a search across the
runbook.

---

## Before you start

Collect these. Step 3 onward is blocked without them.

| What | Where from | Cost |
|---|---|---|
| Neon project `cornerstone` (`bold-bar-07861256`), `production` branch | already exists — [docs/database-workflow.md](docs/database-workflow.md) | free tier fine |
| Vercel project | [vercel.com](https://vercel.com) | free tier fine |
| Vercel Blob store | the Vercel project's **Storage** tab | free tier fine |
| Resend API key + verified sender | [resend.com](https://resend.com) | free tier fine |
| Container host for pronunciation | Railway / Render / Fly.io | **~$5–20/mo** |
| GitHub Actions secrets on this repo | [docs/database-workflow.md](docs/database-workflow.md) § One-time setup | — |

The container host is the only recurring cost, and the only piece that can't be free —
it needs ~2GB RAM and must stay warm.

Blob storage backs media uploaded through the CMS. Adding it to the Vercel project sets
`BLOB_READ_WRITE_TOKEN` for you.

There is no Airtable step any more, and no Airtable webhook to register. Content lives
in Payload, in the same Neon database as everything else (#20).

**Two secrets are generated fresh here and never copied from a developer's
`.env.local`:** `BETTER_AUTH_SECRET` and `PAYLOAD_SECRET`. Generate each with
`openssl rand -base64 32`. Rotating `PAYLOAD_SECRET` later invalidates every admin
session and every outstanding password-reset link, so pick it once and put it in
1Password.

---

## 1. Confirm the Neon `production` branch

The Neon project already exists; nothing is provisioned here. Confirm the branch and
take its **pooled** connection string (it has `-pooler` in the host).

```bash
npm run db:branch:ls
npm run db:branch:url -- production
```

**Verify:** `production` is listed as the default branch, and the URL contains
`-pooler`. Keep it — steps 3, 5, 6 and 7 all want it.

Two migration systems share this database: drizzle-kit owns the `public` schema (Better
Auth tables + `user_progress`), Payload owns the `payload` schema. **The order is fixed
and not interchangeable:** Payload never issues `CREATE SCHEMA`, so drizzle has to run
first and create `payload`; the cross-schema foreign key from `user_progress` to
`lessons(slug)` then lands in Payload's migration, the first point at which both sides
of it exist. That order is baked into step 5's workflow — you don't run it by hand.

While you're in the Neon console: mark `production` as a **protected branch**, which
blocks deletion and can restrict connections. Recommended in
[docs/database-workflow.md](docs/database-workflow.md) § One-time setup; not a gate on
any later step here.

**Never point `.env.local` at `production`.** Steps 6 and 7 are the two deliberate
exceptions, and both say so.

---

## 2. Deploy the pronunciation service

From `services/pronunciation/`. Any host that runs a Dockerfile works; Railway is the
least work.

```bash
openssl rand -hex 32     # save this — it's PRONUNCIATION_SERVICE_SECRET
```

Set on the container: `PRONUNCIATION_SERVICE_SECRET`, and `PORT` if the host requires
one.

Requirements — getting these wrong is the usual failure:

- **Always on.** No scale-to-zero, or every cold start reloads the model. On Cloud Run
  set `min-instances=1`.
- **≥2GB RAM.** Less will OOM during inference.
- The image is large (~1.5GB) because the model is baked in. That's deliberate.

**Verify:**

```bash
curl https://<your-service-url>/health
```

Expect `{"ok":true,"modelReady":true}`. `modelReady` may be `false` for ~10s after boot.

---

## 3. Create the Vercel project and deploy

Import the repo, framework preset **Next.js**, root directory **`.`** (the repo root,
not `client/`).

**Turn on Deployment Protection before the first deploy** (Settings → Deployment
Protection → Standard Protection). Preview and `*.vercel.app` URLs then sit behind
Vercel's auth wall, which is what keeps Payload's unauthenticated first-user form
unreachable between this step and step 6 (#32).

Environment variables — set for Production *and* Preview. This list is
`.env.example` minus `MONGODB_URI`; there is nothing else to set and nothing here to
skip:

```
DATABASE_URL                  = <the pooled production URL from step 1>
PAYLOAD_SECRET                = <openssl rand -base64 32>   ← fresh; required
BLOB_READ_WRITE_TOKEN         = set for you when Blob storage is added
BETTER_AUTH_SECRET            = <openssl rand -base64 32>   ← fresh, not your local one
BETTER_AUTH_URL               = https://<the production domain>
RESEND_API_KEY                = <resend key>
EMAIL_FROM                    = noreply@<your-verified-domain>
PRONUNCIATION_SERVICE_URL     = https://<service-url>
PRONUNCIATION_SERVICE_SECRET  = <the secret from step 2>
```

`PAYLOAD_SECRET` is **required — the app does not boot without it.** There is no silent
fallback: with it unset, Payload fails to initialize, so `/admin` 500s and every page
that reads content 500s alongside it, because content is read in-process at build and at
request time. Use the same value in the GitHub Actions secret for step 5, or the
migration runs against a different secret than the app boots with.

`AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID` and `REVALIDATE_SECRET` are gone — delete them
from any environment that still has them. `/api/revalidate` existed for an Airtable
automation to call and no longer exists either.

**Do not set `MONGODB_URI` on Vercel.** It is only read by the local import script.

Deploy.

> **The first deploy may fail at build, and that is not a misconfiguration.** The
> database has no schema until step 5, and pages like `/resources` are prerendered at
> build time and read Payload in-process, so the build can die reading content. If it
> does, leave the project as it is, run step 5, and redeploy — the environment you just
> set is what step 5's workflow and the redeploy both consume. Nothing here needs
> changing.

**Verify — two checks, and note what is deliberately *not* checked yet:**

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<deployment-url>/admin
```

1. The build finishes and the deployment is reachable.
2. That `curl`, unauthenticated, returns Vercel's auth wall — a `401`, or a `307` to
   `vercel.com/sso-api` — **not** Payload's login or first-user screen. That is the
   assertion #32 asks for, and it is the only thing standing between the deployment URL
   and a stranger claiming the CMS until step 6 runs.

**Do not try to sign up yet, and do not expect content.** The database has no schema
until step 5, so `public.user` does not exist and sign-up will 500. Sign-up is verified
in step 9, against the real domain, once there is something to sign up into.

If the **build itself** fails reading content, that is the same cause: pages are
prerendered at build time and read Payload in-process. Run step 5, then redeploy.

Rather than doing this step by hand — it is ~10 variables across two
environments, so 20 dashboard entries — run the wizard:

```bash
./scripts/wizard-vercel-project.sh
```

It imports and links the project, pushes every variable above to Production and
Preview over the CLI, audits that the retired names are absent and the required
ones present, reads the build log to confirm Node 24.x, and runs the same
`/admin` auth-wall check as above. It also captures the Protection Bypass for
Automation secret into `.env.local`, which is what lets `npm run parity` reach a
protected deployment later.

Its last stage offers to run `npm run parity`. **Say no when you are here at
step 3** — for the reason directly above, sign-up 500s and there is no content
until steps 5 and 7. The wizard says so at that prompt. Re-run it after step 7
if you want parity against the preview; step 9 runs it against the real domain
either way.

---

## 4. Announce the content freeze

Tell anyone who authors lessons to **stop editing in MongoDB Compass**. Any edit after
this point is lost unless step 7 is re-run.

From here on, Payload is the source of truth for content — `/admin` on the new site.

Nothing has to be wired up for edits to appear: the collection hooks in
`src/payload/hooks/revalidate.ts` drop the affected cache tags in-process on every save
and delete, because Payload runs inside the app. There is no webhook, no automation and
no shared secret. (A one-hour backstop expiry covers anything a hook misses.)

**Verify — record the high-water mark**, so that "did someone edit after the freeze?" is
a question you can answer instead of guess:

```bash
mongosh "$MONGODB_URI" --quiet --eval '
  ["lessons", "newlessons", "Resource"].forEach((c) =>
    print(c, db[c].countDocuments(),
      JSON.stringify(db[c].find({}, {updatedAt: 1}).sort({updatedAt: -1}).limit(1).toArray())))'
```

Those are the three source collections the import reads. Note the counts and timestamps.
Re-run it immediately before step 7: if anything moved, someone edited through the freeze
— which is fine, step 7 picks it up. If it moves *after* step 7, the import has to be
re-run. (Should these documents carry no `updatedAt`, the counts alone still catch
additions and deletions, which are the edits that matter most here.)

### The freeze window

The freeze runs from here to the end of step 9.

**Measured 2026-08-15 (#33).** The sequence was rehearsed end to end, in this order, on a
throwaway Neon branch forked from `production` and wiped to an empty database, so these
are timings for a run that starts with nothing:

| Step | Command | Empty branch | Re-run |
|---|---|---|---|
| 5 | `npm run db:migrate` | 2s | — |
| 5 | `npm run payload:migrate` | 4s | — |
| 6 | `npm run payload:seed-admins` | 3s | 1s |
| 7 | `npm run migrate:content` | 12s | 17s |
| 9 | `npm run parity` | 2s | — |

**The scripts total under a minute.** That corrects the guess this section used to carry:
step 7 does not scale into anything meaningful at this catalogue size — 5 lessons and 141
exercises import in twelve seconds — and it is not the long pole. Nothing in steps 5–7 is
worth planning around.

What the rehearsal could **not** measure, and what therefore actually sizes the freeze:

- **Step 5's approval gate.** The rehearsal ran `db:migrate` and `payload:migrate`
  directly. The real step 5 goes through `migrate-production.yml` on the `production`
  GitHub Environment, so it costs a workflow queue and spin-up plus however long a
  required reviewer takes to click approve. If a reviewer has to be found, that alone can
  exceed everything in the table.
- **Step 8's DNS propagation**, which is out of anyone's hands.
- **Step 9's by-hand checklist** — six items including a password-reset round trip
  through real email and a pronunciation check against the container. This remains the
  long pole, and it is the one the original guess got right.

**So: promise Sachi an hour, and tell her it will probably be less.** The honest shape is
a few minutes of scripts inside a window bounded by one approval click, one DNS change
and one human working a checklist. Do not quote the sub-minute figure to her as if it
were the outage — it is only the part a computer does.

---

## 5. Migrate the production database

Run through the gated CI workflow, not from a laptop:
`.github/workflows/migrate-production.yml`, triggered by **workflow_dispatch** (or by
any merge to `master`/`main` that touches `drizzle/`, `src/payload/migrations/`,
`src/lib/db/schema.ts` or `src/payload.config.ts`).

```bash
gh workflow run migrate-production.yml
gh run watch
```

It needs the repo secrets from [docs/database-workflow.md](docs/database-workflow.md) —
`PRODUCTION_DATABASE_URL` (pooled, `production` branch) and `PAYLOAD_SECRET` (the same
value you set on Vercel in step 3). It targets the `production` GitHub Environment, so
required reviewers there turn each run into an explicit human approval.

The workflow runs `npm run db:migrate` and then `npm run payload:migrate`, in that
order, for the reason given in step 1. Doing it here rather than in Vercel's build is
deliberate: a Vercel build can run more than once per deploy and runs for previews too,
so migrations belong in one gated place.

**Do not assume `production` is unmigrated — check first, this drifts.** As of
2026-08-15 its drizzle journal was complete but Payload had applied only 1 of 3
migrations, so `db:migrate` reported nothing to do while `payload:migrate` applied the
rest. That kind of asymmetric run is expected here, not a failure — what would be a
failure is *both* commands finding nothing to do, which means the workflow never
reached the database. For the live state rather than that snapshot:

```bash
npm run payload:migrate:status
```

**Verify:**

Using the pooled URL from step 1 (the workflow reads it from a repo secret; you have it
in your shell or in 1Password):

```bash
psql "<the pooled production URL>" \
  -c '\dt public.*' \
  -c "select conname from pg_constraint where conname = 'user_progress_lesson_id_lessons_slug_fk'"
```

Five tables in `public` — `user`, `session`, `account`, `verification`, `user_progress` —
all empty, plus the constraint row.

The workflow's `Show pending Payload migrations` step runs *before* the two migration
steps, so on a fresh branch it lists everything as pending and may error on the absent
`payload` schema. That is diagnostic output, not a result — read the two migration steps'
own exit status, and the `psql` check above, for whether it worked.
### Verify the Vercel auth wall after migrations

This is the check the protection wizard asks you to repeat after step 5. Before
migrations, a protected deployment can only prove that Vercel intercepts `/admin`; after
migrations, the bypassed request must also prove that the Payload admin and its
`cms_admins` table are reachable.

Use the deployment URL and the bypass secret saved by
`./scripts/wizard-vercel-protection.sh` in `.env.local`:

```bash
set -a; source .env.local; set +a
admin_url="${VERCEL_DEPLOYMENT_URL%/}/admin"
init_url="${VERCEL_DEPLOYMENT_URL%/}/api/cms_admins/init"

# Without the bypass, Vercel must still answer before Payload.
curl -sS -o /dev/null -w '%{http_code} %{redirect_url}\n' "$admin_url"

# With the bypass, the migrated deployment must reach Payload.
curl -sS -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  "$admin_url" | grep -F 'Nihon-Go! CMS'
curl -sS -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  "$init_url"
```

Expect the first command to return Vercel's auth wall (`401`, or a `307` redirect to
`vercel.com/sso-api`). The admin response with the bypass must contain
`Nihon-Go! CMS`, proving the request reached this Payload instance rather than merely
some deployment answering at the URL. Immediately after step 5,
`/api/cms_admins/init` should return `{"initialized":false}` — the table exists, but step
6 has not seeded an account yet. Run the protection check again after step 6 and expect
`{"initialized":true}`.

A `200` or Payload first-user page **without** the bypass means Deployment Protection is
not covering this URL. A `401` **with** the bypass means the secret is missing, stale, or
the request is going to a different deployment. A `500` from the bypassed request means
the deployment's environment does not match the migrated database (usually
`PAYLOAD_SECRET` or `DATABASE_URL`). Do not continue until the unauthenticated wall
still passes and the bypassed request reaches Payload.

---

## 6. Seed the CMS admin accounts

Immediately after the database has a schema, and **before** the content import. The
import takes real time, and until the first `cms_admins` row exists Payload serves an
**unauthenticated first-user form** at `/admin` to anyone who reaches the URL — one
submission away from a stranger owning the CMS (#32). Deployment protection from step 3
covers that window; this closes it permanently. Seeding needs only the database and
`PAYLOAD_SECRET`, so there is no reason to wait for content.

```bash
# .env.local pointing DATABASE_URL at the production pooled URL, PAYLOAD_SECRET
# at the value from step 3. Node 24, like every payload:* command.
npm run payload:seed-admins
```

**The committed roster is two people — Justin and Sachi.** Dev's and Ryoko's addresses
weren't settled when the script was written. Add anyone else with a one-line `ROSTER`
entry in `scripts/payload/seed-admins.ts` or on the command line:

```bash
npm run payload:seed-admins -- "Dev <dev@example.com>"
```

Both paths are idempotent, so adding someone by flag now and by roster line later is
fine. **Do not expect four accounts** unless you have added the other two.

**Expected output** against a fresh production branch — one pair of lines per account,
then the tally:

```
  + me@jlee.cool                created
      password: <24 characters>
  + 2631sachi@gmail.com         created
      password: <24 characters>

2 created, 0 already existed.
```

Exit codes: `0` seeded or nothing left to do, `1` failed partway, `2` bad input or a
missing `PAYLOAD_SECRET`/`DATABASE_URL` — nothing attempted, before Payload loads.

**Re-running is safe.** An existing account is left untouched down to its password hash
and `updatedAt`. A cutover that dies at or after this step resumes by running it again.

**Passwords print exactly once and are stored nowhere** — not written to disk, not
emailed. Deliver them through 1Password; each person changes theirs at `/admin` on first
sign-in. `npm run payload:seed-admins | tee admins.txt` does capture them intact (stdout
is drained before exit), but that file then holds live credentials — delete it as soon as
they are in 1Password.

**Verify:**

```bash
set -a; source .env.local; set +a
curl -sS \
  -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  "${VERCEL_DEPLOYMENT_URL%/}/api/cms_admins/init"
```

Expect `{"initialized":true}`. `false` means the window is still open. Step 9's parity
check asserts this too, but do not wait until then to find out. The bypass header is
required here because Standard Protection still covers the `*.vercel.app` URL.

> **`/admin`'s "Forgot password?" link does not work, and it fails silently.** With no
> email adapter Payload returns `200 {"message":"Success"}` and sends nothing, so an
> admin who loses their password before first sign-in waits for mail that never comes.
> Recovery, all three verified: another admin resets it under **Settings → CMS admins**;
> or, with database access, read `reset_password_token` from `payload.cms_admins` and
> open `/admin/reset/<token>` within the hour; or delete that one row and re-seed.
> Deleting *every* row reopens `create-first-user`. See
> [docs/payload-content-model.md](docs/payload-content-model.md#when-a-password-is-lost).

---

## 7. Import the content

Locally, with `.env.local` pointing `DATABASE_URL` at the production pooled URL,
`PAYLOAD_SECRET` at the value from step 3, and `MONGODB_URI` at production Mongo
**including the `/Cornerstone` database name** — without it you silently get an empty
`test` database.

```bash
npm run migrate:content    # Mongo → Payload; ends with a round-trip verification
```

Source is Mongo only — the content that was unique to Airtable was deliberately dropped
in #26, so there is nothing to reconcile. The script also bakes the checkpoint expansion
(#27): exercise batches that used to be synthesised on every render become real,
editable content exactly once, here.

It is idempotent — lessons and resource groups upsert on the Mongo `_id`, courses on
slug — so it is safe to re-run.

**Expected output.** It refuses to import a partial set, gating on the survey volume:

| Stage | Expect |
|---|---|
| Source volume | 2 legacy lessons, 3 grammar lessons, 8 resource groups |
| Grammar items in | `l1-v1` 18, `l1-v2` 23, `l2-v1` 27 — expanded on the way in, so more exercises come out than went in |
| Legacy exercises in | `hiragana-l1-v1-hokkaido` 14, `hiragana-l2-v1-iwate` 9 |
| legacyJson | `✓ nothing routed to legacyJson — every item mapped to a real block` |
| Verification | `✓ VERIFICATION PASSED — the stored content reproduces the learner-visible sequence computed from Mongo exactly (same exercises, same order).` |

Then the final tally — five lines, the last two being derived totals rather than gated
expectations:

```
Final content in Payload
  courses:   2
  lessons:   5
  resources: 8
  exercises: 141
  blocks:    <total blocks written>
```

**Five lessons and two courses is the whole live catalogue**, not a partial import: 2
legacy prefecture lessons plus 3 grammar lessons, per the content scope agreed in #26.
"2 courses, 5 lessons" reads as success. The 141 exercises are more than the source items
because of the one-way expansion above.

The counts the script actually *gates* on are the "Source volume" and per-slug rows in
the table; `exercises` and `blocks` are totals it computes at the end and does not check.
141 is what the development import produced. If it differs, read the verification block
above it — that is the assertion that matters — rather than treating the tally as the
failure.

**The round-trip verification is a hard gate.** It re-reads everything through Payload,
maps it back to the contract shapes in `src/lib/types/lessons.ts`, and diffs it against
the sequence computed straight from Mongo — that diff is the only proof the expansion
was done correctly. The script exits non-zero on any rejected record or any diff. If it
reports a problem, **stop.** Do not proceed to step 8 until it passes.

---

## 8. Point the domain at Vercel

Add `cornerstone.nihongojp.com` in Vercel and update DNS. Confirm `BETTER_AUTH_URL` is
the final domain, then redeploy so the change takes effect.

**This is the point of no easy return** — see [Rollback](#rollback).

**Verify:** `curl -I https://<the production domain>` returns 200 from Vercel, and
signing in keeps you signed in across a reload. A session that does not persist means
`BETTER_AUTH_URL` does not match the real domain.

---

## 9. Verify production

```bash
npm run parity https://<the production domain>
```

Against the custom domain this needs nothing extra — Standard Protection leaves custom
production domains public. Running it earlier against the **preview** or `*.vercel.app`
URL needs `VERCEL_AUTOMATION_BYPASS_SECRET` (Vercel → Settings → Deployment Protection →
Protection Bypass for Automation) in `.env.local`; without it Vercel Authentication
answers 401 and the run measures the auth wall rather than the deployment. The script
says so when it sees a 401.

The signed-in half of the check needs an account, so the run **signs up a throwaway user
over the public API and deletes it again** — including here, against production. It is
named `parity-<random>@parity-check.invalid`, and `.invalid` can never be a real domain.
If the run is interrupted the account can survive; the script prints the address when it
fails to clean up. To use an existing account and have it create nothing, run it as
`PARITY_EMAIL=… PARITY_PASSWORD=… npm run parity https://<the production domain>`.

**Expected output** — two blocks, and both have to be clean:

```
36/36 checks passed — full parity with the CRA route table

CMS
...
4/4 CMS checks passed — admin is up and content is served by Payload
```

The CMS block is the one that catches a deployment serving nothing: it asserts that the
Payload admin boots at all, that the admin bootstrap is closed — so no stranger can
claim the CMS — and that `/resources` and a known lesson come back with their actual
content, not merely a 200.

The bootstrap line is the one to read for that second property. An admin with the
bootstrap still open serves the create-first-user screen at `/admin/login` with a 200 and
a `Login — …` title, indistinguishable over HTTP from the real login screen, so only that
line can tell you which you have.

A failing bootstrap line means step 6 was skipped against this environment; a failing
content line means step 7 was. A 5xx on the whole run usually means step 5 never ran.

Then by hand. Every one of these is doable on a brand-new account — there are no
migrated legacy users, by design (all legacy user support was dropped pre-release), so
nothing here waits on one:

- [ ] Sign up as a new user, sign out, sign back in
- [ ] Password reset: request it, receive the email, complete it, sign in with the new password
- [ ] Play a grammar lesson end to end; Save & Exit, reopen, confirm it resumes at the same exercise
- [ ] Pronunciation check on `l1-v1` returns a score (the only lesson with real reference audio)
- [ ] Dashboard map renders; clicking a prefecture lists its lessons
- [ ] Sign in to `/admin` as a seeded admin, edit a lesson title, reload the site — the new title is there

The freeze ends here.

---

## 10. Decommission

Only after everything above passes.

**Take the dump first.** It is what makes step 8's rollback survivable at all once the
old stack is gone:

```bash
mongodump --uri="$MONGODB_URI" --out=./mongo-final-backup
```

**Keep MongoDB read-only for 30 days.** Then:

```bash
git rm -r client server
git commit -m "task: remove the CRA client and Express server after cutover"
```

Also: shut down the old Express host, and fix the docs that still describe the old stack
(#43).

**Verify:**

```bash
ls mongo-final-backup/Cornerstone/lessons.bson   # the dump exists and is non-empty
npm run typecheck && npm run build               # nothing in src/ depended on client/ or server/
npm run parity https://<the production domain>   # still 36/36 and 4/4
```

The dump check comes first because it is the one thing here that cannot be redone later:
after the old host is off and Mongo is gone, that file is the only pre-cutover copy.

---

## Rollback

Reversibility changes at exactly two points.

**Before step 8 — rollback is doing nothing.** The old stack is still serving traffic
and you simply don't switch DNS. Everything up to here is additive: a new database
branch, a new Vercel project, a new container. Nothing about the running site has
changed. A step that fails here can be retried indefinitely, or abandoned at no cost
beyond the freeze.

**After step 8 — rollback is pointing DNS back.** The old stack is untouched and still
works. The only thing you lose is learner activity that happened on the new site during
the window, which is why the right move is to decide fast rather than debug live: every
minute spent diagnosing is a minute of activity that a rollback discards.

**After step 10 it stops being cheap.** `client/` and `server/` are gone from the
working tree (recoverable from git), the old host is shut down (recoverable, slowly),
and Mongo is the only copy of the pre-cutover data — recoverable only from the dump.
That asymmetry is the whole reason decommission is last and the dump is mandatory.

---

## If something breaks

| Symptom | Cause |
|---|---|
| `payload:migrate` says `schema "payload" does not exist` | `db:migrate` was skipped or failed — it creates the schema |
| `payload:*` dies with `ERR_VM_MODULE_LINK_FAILURE` | Node 22. These commands need Node 24 |
| Migration workflow fails at "Check migration files are load-safe" | A generated Payload migration needs the `import type` codemod — `npm run payload:fix-migrations` |
| Build fails reading content | `DATABASE_URL` or `PAYLOAD_SECRET` missing on Vercel — pages are prerendered at build and read Payload in-process |
| Every page 500s | `BETTER_AUTH_SECRET` or `DATABASE_URL` missing. Deliberate: no silent fallback |
| Sign-in works, session doesn't persist | `BETTER_AUTH_URL` doesn't match the real domain |
| `parity` exits 2 at the fixture account, `INVALID_ORIGIN` (403) | The check sends `Origin:` set to the URL you passed it, and better-auth trusts only `BETTER_AUTH_URL`. Those two have to be the same origin — port included |
| `parity` passes 36/36 against something you didn't deploy | It checks whatever answers that URL, and a server already holding the port answers instead of the one you just started. Locally, confirm the process on the port is yours before believing a pass |
| Reset emails never arrive | Resend domain not verified, or `EMAIL_FROM` isn't on that domain |
| `/admin` offers to create the first user | Step 6 never ran against this environment. Do it now |
| `/admin` 500s | `PAYLOAD_SECRET` unset, or the `payload` schema was never migrated |
| `/admin`'s "Forgot password?" does nothing | Expected — no email adapter. Recover via step 6's three routes |
| `payload:seed-admins` exits 2 immediately | `PAYLOAD_SECRET` or `DATABASE_URL` missing, or a malformed `Name <email>` argument |
| Media uploads fail in the admin | `BLOB_READ_WRITE_TOKEN` missing — add Blob storage to the Vercel project |
| Pronunciation 502s | Container down or asleep. Check `/health` |
| Pronunciation 503s | `PRONUNCIATION_SERVICE_URL`/`_SECRET` missing on Vercel |
| Lessons and resources empty, no errors | The import (step 7) hasn't run against this database |
| Import stops at "Source volume" | Mongo moved under you since the survey — reconcile before importing a partial set |
| Deleting a lesson fails | Someone has progress on it — unpublish instead. The FK is doing its job (#11) |
| Import finds nothing | `MONGODB_URI` missing the `/Cornerstone` database name |
| Parity run reports 401 on every route | Preview/`*.vercel.app` URL without `VERCEL_AUTOMATION_BYPASS_SECRET` — you measured the auth wall |
