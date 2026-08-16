# Decommission record — the old MERN stack

What was retired at [CUTOVER.md](CUTOVER.md) step 10 (#42), when, and what is still
owed. This exists so the 30-day window has a date attached to it that somebody can
actually find.

## Dates that matter

| | |
|---|---|
| Final `mongodump` taken | **2026-08-16** |
| **30-day read-only window ends** | **2026-09-15** |

Until 2026-09-15, the MongoDB cluster is the last independent check on the content
import. It was read once, imported into Payload, and never read again — so if the
import got something wrong, this window is what catches it. Do not drop the cluster
before that date.

## The backup

Taken with `mongodump` from the `Cornerstone` database on
`cluster0.jssui.mongodb.net`, to a path outside both the repository and the old host:

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
