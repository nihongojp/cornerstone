# Orientation

You have the app running — the README's setup steps, or `/onboard-dev`. This page is
what to know now: the parts of this project that are not standard Next.js, the recipes
for common tasks, and the traps that have already cost us time.

For architecture, read [AGENTS.md](../AGENTS.md). For what our words mean — Learner vs
Editor, the content model, the routing rules — read [CONTEXT.md](../CONTEXT.md).

## Five things that will surprise you

**1. The CMS runs inside this app.** Payload is not an external service. It is mounted
at `/admin` from `src/app/(payload)/`, and it reads the same Postgres database the app
does. There is no webhook and no API key: when an editor saves, a Payload hook drops
the affected cache tags in-process ([`src/payload/hooks/revalidate.ts`](../src/payload/hooks/revalidate.ts)).

**2. One database, two schemas, two migration systems.** Drizzle owns `public` (auth
tables, `user_progress`). Payload owns `payload` (all content). **Always migrate
Drizzle first** — Payload never issues `CREATE SCHEMA`, so the schema it needs has to
already exist:

```bash
npm run db:migrate       # drizzle — public schema
npm run payload:migrate  # payload — content
```

Backwards, and the second command fails on a schema that is not there.

**3. There is no local Postgres.** Everyone works against a Neon branch, so local
behaviour matches production exactly. Your `.env.local` points at the shared
`development` branch. Need somewhere destructive? Cut your own throwaway — it deletes
itself in three days:

```bash
npm run db:branch:new -- my-experiment
```

**Never point `DATABASE_URL` at `production`.** See [database-workflow.md](database-workflow.md).

**4. Merging does not ship content.** This one has caught us more than once.
`migrate-production.yml` applies *schema* when a PR merges to `main`, and stops there.
Content lives in `content/snapshot/` and is imported by hand:

```bash
DATABASE_URL="$(npm run --silent db:branch:url -- production)" npm run content:import -- --yes
```

So a PR that changes the *shape* of content leaves production serving blank lessons
until somebody runs that. If your change touches `src/payload/`, read
[production-merge-runbook.md](production-merge-runbook.md) **before** you merge, not after.

**5. Folders in parentheses are route groups.** `src/app/(app)/(public)/gallery/page.tsx`
serves `/gallery` — `(app)` and `(public)` are *not* in the URL. They exist to attach a
layout and an auth rule. Pick the group by who is allowed to see the page:

| Group | Auth | Chrome |
|---|---|---|
| `(public)` | none | Header and Footer |
| `(learn)` | `requireSession()` | Header and Footer |
| `(dashboard)` | `requireSession()` | Header only |
| `(player)` | `requirePlayerAccess()` | none |

`(player)` is a sibling of `(learn)` so a CMS editor can preview a draft without a
learner session. `/auth` guards itself: a layout is never given `searchParams`.

```bash
find src/app -type d | sort
```

## The content model

```
Course ──< Lesson ──< Step ──< Block ──> Term
                                          ▲
         user_progress ─── keyed on lesson slug
```

The one that trips people: **a Step is one screen, not one question.** A step can be
pure prose with nothing to answer. What makes it interactive is the blocks on it. It
was called `exercise` until that name kept promising a question half of them did not have.

Definitions in [CONTEXT.md](../CONTEXT.md#content-model). Field-level detail in
[payload-content-model.md](payload-content-model.md).

## Naming rules

Two, and both exist because we broke them:

- **Route segments are kebab-case**, and **`[param]` is named for what it holds** — a
  Payload `slug` field is `[slug]`, never `[id]`. We shipped `[lessonId]` holding a
  slug, and a `version` field holding a part number. Both cost an afternoon to unpick.
- **Content slugs** are `<family>-l<level>-v<version>` — `grammar-l1-v1`,
  `hiragana-l2-v1-akita` — enforced by
  [`src/payload/fields/slugFormat.ts`](../src/payload/fields/slugFormat.ts).

## Recipes

**Add a page.** Pick the route group by who is allowed to see it, then add a folder
with a `page.tsx`. The auth rule lives in that group's `layout.tsx` — open it and read
it rather than assuming. Add the path to `scripts/parity-check.mjs`'s route table in
the same PR, or nothing is guarding it.

**Change a Payload field.** This is a migration, not an edit:

```bash
npm run payload:migrate:create   # needs a real TTY — see the traps table
npm run payload:migrate
npm run payload:types            # regenerate payload-types.ts — never hand-edit that file
```

Test it against a throwaway branch first. Payload generates the `ADD` and the `DROP`
and **never the data movement in between** — if you do not write the backfill yourself,
the data is silently gone.

**Change the shape of content.** Prefer the snapshot round-trip over hand-written SQL:
export, transform the JSON, migrate, re-import. That is what
[`scripts/content/roundtrip.sh`](../scripts/content/roundtrip.sh) exists for, and it is
how the `steps` rename shipped without a line of backfill SQL.

## Traps, and the symptom you will actually see

| Symptom | Cause | Fix |
|---|---|---|
| `EBADENGINE`, or odd module errors | `node` resolves to v22; this repo needs 24 | check `fnm list`, then put the v24 bin on `PATH` ahead of `/usr/local` and `~/.local/bin` |
| typecheck fails on files you just deleted | stale `.next/dev/types` after a branch switch | `rm -rf .next` |
| `payload:migrate:create` hangs forever | drizzle-kit is asking whether a column was renamed, and needs a TTY | drive it with `expect`, answer "create column", then grep the output for `RENAME` — there must be none |
| `invalid: slug` from `content:import` | the row was matched on a key that has since been renamed | it falls back to `sourceId` now; if it still fails, the snapshot's `key` is wrong |
| parity passes but the page is visibly broken | `unstable_cache` answered from an entry built before your change | trust `npm run content:verify`, which reads through Payload with no cache in front of it |

## What each check actually proves

| Command | Proves | Does not prove |
|---|---|---|
| `npm run typecheck` | the types line up | that anything runs |
| `npm test` (89) | the pure logic is right | that any page renders |
| `npm run parity` (40 route checks + 5 CMS) | every route's guard and chrome | that content is correct — it can be answered from cache |
| `npm run content:verify` | every media and term reference resolves, uncached | that a page renders |

None of them replace opening the page in a browser. Do that too.

## Working agreements

- Issues are GitHub issues in `nihongojp/cornerstone`, via `gh`.
- **Pre-launch, the current shape is not a constraint.** There are no users yet. When a
  fix has a cheap-but-wrong option and a correct-but-larger one, propose the correct
  one — changing fields, schemas and dependencies is in bounds. Weigh "would we build
  it this way today?" over "what changes least?". This stops applying at launch.
- This is an old first project carrying real content alongside accumulated dead code.
  Confirm a thing is wired up before treating its existence as intent.

## If something here is wrong

It will be, eventually — this describes a codebase that is still moving. Fix it in place
and say so in your PR. A guide nobody corrects is worse than no guide.
