# Cutover Runbook

Taking Nihon-Go! from the old CRA + Express + MongoDB stack to production on Vercel.

Everything in phases P0–P5 is built and verified. What's left is provisioning infrastructure, moving the data, and switching the domain. The old stack keeps running untouched the whole time, which is what makes this reversible.

**Expect ~2 hours**, most of it waiting on provisioning. Do it when nobody is authoring content.

---

## Before you start

Collect these. Steps 4 onward are blocked without them.

| What | Where from | Cost |
|---|---|---|
| Neon Postgres database | [neon.tech](https://neon.tech) or Vercel's integration | free tier fine |
| Vercel project | [vercel.com](https://vercel.com) | free tier fine |
| Resend API key + verified sender | [resend.com](https://resend.com) | free tier fine |
| Container host for pronunciation | Railway / Render / Fly.io | **~$5–20/mo** |
| Airtable PAT | [airtable.com/create/tokens](https://airtable.com/create/tokens) | free |

The container host is the only recurring cost, and the only piece that can't be free — it needs ~2GB RAM and must stay warm.

---

## 1. Provision Postgres

Create the Neon database and copy the **pooled** connection string (it has `-pooler` in the host).

```bash
# in .env.local, temporarily, to create the tables:
DATABASE_URL=<neon pooled url>
npm run db:migrate
```

**Verify:** `npm run db:studio` shows five empty tables — `user`, `session`, `account`, `verification`, `user_progress`.

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
BETTER_AUTH_SECRET            = <openssl rand -base64 32>   ← fresh, not your local one
BETTER_AUTH_URL               = https://<your-domain>
AIRTABLE_API_KEY              = <PAT, data.records:read>
AIRTABLE_BASE_ID              = appMVqVTfpIWVGjgO
RESEND_API_KEY                = <resend key>
EMAIL_FROM                    = noreply@<your-verified-domain>
REVALIDATE_SECRET             = <openssl rand -hex 16>
PRONUNCIATION_SERVICE_URL     = https://<service-url>
PRONUNCIATION_SERVICE_SECRET  = <the secret from step 2>
```

**Do not set `MONGODB_URI` on Vercel.** It's only for the local migration scripts.

Deploy. **Verify** the preview URL loads and you can sign up.

---

## 4. Announce the content freeze

Tell anyone who authors lessons to **stop editing in MongoDB Compass**. Any edit after this point is lost unless you re-run step 6.

From here on, Airtable is the source of truth for content.

---

## 5. Wire up Airtable revalidation

In the Cornerstone Content base: **Automations → When record updated → Run script**, one per table.

```js
await fetch("https://<your-domain>/api/revalidate?secret=<REVALIDATE_SECRET>", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ table: "Lessons" }),   // or NewLessons / Resources
});
```

**Verify:** edit a lesson title in Airtable, reload the site twice — the first request serves the cached copy and triggers a refresh, the second shows the new value.

---

## 6. Migrate the data

Locally, with `.env.local` pointing `DATABASE_URL` at **Neon** and `MONGODB_URI` at production Mongo (including the `/Cornerstone` database name — without it you get an empty `test` database).

```bash
npm run migrate:content    # Mongo → Airtable; ends with a round-trip verification
```

It is idempotent — safe to re-run.

**Expected output**, based on the rehearsal:

| Script | Expect |
|---|---|
| content | 9 lessons, 3 grammar lessons, 8 resources, 19 achievements · "All records round-tripped cleanly" |

If content reports any problem, **stop** — do not proceed until it round-trips cleanly.

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

A failing bootstrap line means `npm run payload:seed-admins` has not been run
against this environment; a failing content line means the import has not.

Then by hand:

- [ ] Sign up as a new user, sign out, sign back in
- [ ] Password reset: request it, receive the email, complete it, sign in with the new password
- [ ] Play a grammar lesson end to end; Save & Exit, reopen, confirm it resumes at the same exercise
- [ ] Pronunciation check on `l1-v1` returns a score (only lesson with real reference audio)
- [ ] Dashboard map renders; clicking a prefecture lists its lessons

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
| Build fails, `AIRTABLE_API_KEY not set` | Env var missing on Vercel — `/resources` is prerendered at build |
| Every page 500s | `BETTER_AUTH_SECRET` or `DATABASE_URL` missing. Deliberate: no silent fallback |
| Sign-in works, session doesn't persist | `BETTER_AUTH_URL` doesn't match the real domain |
| Reset emails never arrive | Resend domain not verified, or `EMAIL_FROM` isn't on that domain |
| Pronunciation 502s | Container down or asleep. Check `/health` |
| Pronunciation 503s | `PRONUNCIATION_SERVICE_URL`/`_SECRET` missing on Vercel |
| Lessons empty, no errors | Airtable PAT lacks access to the base, or wrong `AIRTABLE_BASE_ID` |
| Migration finds nothing | `MONGODB_URI` missing the `/Cornerstone` database name |
