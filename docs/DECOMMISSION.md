# Decommission record — the old MERN stack

What was retired at [CUTOVER.md](CUTOVER.md) step 10 (#42), when, and what is still
owed. This exists so the 30-day window has a date attached to it that somebody can
actually find.

## Dates that matter

| | |
|---|---|
| Final `mongodump` taken | **2026-08-16** |
| Cluster set read-only | **not yet — fill this in** |
| **30-day window ends** | **2026-09-15 (provisional)** |

The window is the last independent check on the content import: Mongo was read once,
imported into Payload, and never read again, so if the import got something wrong this
is what catches it. Do not drop the cluster before the end date.

**The provisional date counts 30 days from the dump, which is the earliest it could
possibly end.** The window that actually matters runs from the day the cluster goes
read-only — until then the data can still change underneath you, which is the thing the
window exists to prevent. If read-only lands a week late, this date is a week early.
When you set it, put the real date in the table above and strike "provisional".

## The #41 question

This decommission proceeded while **#41 (verify production) was still open**, as a
deliberate call rather than an oversight. Production was verified directly — Vercel
serving Next.js + Payload on `learn.nihongojp.com`, CMS admins seeded, and
`npm run parity` reporting 36/36 plus 4/4 CMS — so the ticket was treated as passed in
substance.

One thing could not be confirmed from outside at the time — the pronunciation container
(CUTOVER step 2), since `POST /api/pronunciation/check` returns 401 without a session,
which proves the Next route exists rather than that the container behind it is up.
**That has since been checked by hand**: a real pronunciation check on `l1-v1`, the only
lesson with reference audio, returns a score. The container is up and every part of
step 2 is accounted for.

(#37 remains open as tracker bookkeeping rather than outstanding work — as do #39, #40
and #41. Treat the deployment as the source of truth over the tracker.)

## The backup

Taken with `mongodump` from the `Cornerstone` database (connection string in
`MONGODB_URI`), to a path outside both the repository and the old host:

```
~/cornerstone-mongo-final-backup/Cornerstone/
```

Verified non-empty at 12 collections:

| Collection | Docs | | Collection | Docs |
|---|---|---|---|---|
| `attempts` | 89 | | `Character` | 11 |
| `userprogresses` | 25 | | `Resource` | 8 |
| `reviewitems` | 22 | | `users` | 5 |
| `Achievement` | 19 | | `User` | 3 |
| `newlessons` | 3 | | `lessons` | 2 |
| `Item` | 1 | | `resources` | 0 |

Two of those counts look wrong at a glance and are not:

- **`lessons` has 2, not the 9** that the survey section of
  [MIGRATION_PLAN.md](MIGRATION_PLAN.md) mentions. Two is correct — it is what
  `scripts/migrate/01-content-to-payload.ts` gates on (`EXPECTED.legacyLessons = 2`,
  and the import refuses to run on a mismatch), and production serves exactly 5 lessons
  (2 `flashcard` + 3 `step`). The 9 in that historical doc is the stale figure.
- **`resources` has 0** because the live collection is the capitalised `Resource` (8
  docs). Mongoose would have created the lowercase one; it was never used.

This backup is **not** in the repository and never should be — it contains real user
records. It is one directory of BSON; if it needs to live somewhere more durable than a
laptop, move it somewhere private and note where here.

## Restoring, if it ever comes to that

```bash
mongorestore --uri="<uri>" ~/cornerstone-mongo-final-backup
```

Read [CUTOVER.md § Rollback](CUTOVER.md#rollback) first. After step 10 a rollback is a
restore, not a DNS change — the asymmetry is the reason the dump was mandatory.

## Still outstanding

These are infrastructure and credential actions, not repository changes:

- [ ] Shut down the old Express host
- [ ] Set the MongoDB cluster read-only
- [ ] **Rotate the MongoDB credential** — the old connection string has been in more
      `.env.local` files than anyone can now enumerate, so rotating it is what makes a
      stale copy on somebody's laptop worthless. This is separate from the read-only
      window: one is about recoverability, the other about a leaked credential.

The credential rotation is worth doing even though the cluster is going read-only —
read access to real user records is still access.

**Rotation is also what retires `scripts/migrate/`.** Those scripts (`migrate:survey`,
`migrate:content`) and the `MONGODB_URI` entry in `.env.example` still work today and
are still accurate; they stop working the moment the credential changes. That is the
intended end state — they were one-off imports — but nothing else in the repo says so,
so treat this as the notice. Once rotated, they are readable history like everything
else here.
