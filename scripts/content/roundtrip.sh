#!/usr/bin/env bash
#
# The content snapshot round trip: export → wipe a throwaway branch → import →
# parity.
#
#   npm run content:roundtrip
#   npm run content:roundtrip -- --keep          # leave the branch for inspection
#   npm run content:roundtrip -- --branch my-rt  # name it yourself
#
# ── What this proves, and why it is not in CI ────────────────────────────────
#
# This is the acceptance test for the content snapshot (Phase 0b) and the
# regression test for every phase that re-imports rather than migrating: if the
# snapshot can rebuild the site from empty and the result still passes parity,
# then the snapshot is a real backup and every future block-schema change can be
# a JSON transform instead of hand-written SQL.
#
# It is deliberately a command rather than a workflow step. Three reasons, in
# order of how much they matter:
#
#   1. It runs `content:import --wipe`, which is the single most destructive
#      operation in this repository. In CI that is one mistyped environment
#      variable away from emptying something real. Here the script owns the
#      target: it creates its own Neon branch and refuses to touch anything it
#      did not create, unless you name a branch explicitly.
#   2. Parity needs a running server on port 3000 — `BETTER_AUTH_URL` is pinned
#      to it — and its signed-in half reads a one-time code from a file the
#      *server* writes under the system temp directory. That works on one host
#      and nowhere else, which a CI runner satisfies but only by accident.
#   3. It is minutes, not seconds, and every pull request already gets the
#      deterministic half of this signal from `content:verify` in
#      `.github/workflows/neon-preview-branch.yml`.
#
# Run it before a re-import phase lands, and after anything that changes the
# snapshot format. See `docs/database-workflow.md`.
set -euo pipefail

cd "$(dirname "$0")/../.."

KEEP=false
BRANCH=""
OWNED=true

while [ $# -gt 0 ]; do
  case "$1" in
    --keep) KEEP=true; shift ;;
    --branch) BRANCH="$2"; OWNED=false; shift 2 ;;
    -h|--help)
      # The header comment, up to the first line that is not one. A line range
      # would drift the moment anybody edits the comment.
      awk 'NR > 1 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "$0"
      exit 0
      ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

say() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
die() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ── Guards, before anything is created or written ────────────────────────────

# Parity drives a real browser-shaped client against a fixed origin, so a server
# already on 3000 would be silently checked instead of ours — most likely a
# worktree's dev server pointed at a completely different database.
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  die "port 3000 is in use. Parity is pinned to it — stop that server first:
     lsof -nP -iTCP:3000 -sTCP:LISTEN"
fi

# `next dev` loads .env.development.local ahead of .env.local, which is how the
# server gets pointed at the throwaway branch. Clobbering somebody's existing
# one would silently retarget their next dev run.
ENVFILE=".env.development.local"
ENVBACKUP=""
if [ -f "$ENVFILE" ]; then
  ENVBACKUP="$(mktemp)"
  cp "$ENVFILE" "$ENVBACKUP"
  echo "note: $ENVFILE exists; it is restored on exit."
fi

# Both of these, not just the snapshot. `content:export` writes the quarantine
# report too, and that file is the *only* remaining copy of the eight blocks
# Phase 4b could not map — an export from a database where they no longer exist
# rewrites it to `[]`. Measured: 726 lines to 6.
WRITTEN_BY_EXPORT="content/snapshot content/quarantine.json"

if [ -n "$(git status --porcelain -- $WRITTEN_BY_EXPORT 2>/dev/null)" ]; then
  die "content/snapshot or content/quarantine.json has uncommitted changes. The
     export below overwrites both, and the point of this test is whether the
     round trip reproduces what is committed — commit or stash first."
fi

if [ -z "$BRANCH" ]; then
  BRANCH="roundtrip-$(git rev-parse --short HEAD)"
fi

# ── Teardown, registered before the first thing that needs it ────────────────

SERVER_PID=""
cleanup() {
  local status=$?

  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi

  if [ -n "$ENVBACKUP" ]; then
    cp "$ENVBACKUP" "$ENVFILE"
    rm -f "$ENVBACKUP"
  else
    rm -f "$ENVFILE"
  fi

  # Put the exported files back. This is a test, not a capture —
  # `content:export` is the capture tool — and the export in step 1 writes over
  # the tracked files in place. Leaving them modified would mean a test run
  # quietly replaced the committed snapshot, and emptied the quarantine record,
  # with whatever was in the database it happened to point at. That is how the
  # wrong content gets committed. The diff is reported before this runs; the
  # diff is the signal worth keeping, not the files.
  if [ -n "${EXPORTED:-}" ]; then
    git checkout -- $WRITTEN_BY_EXPORT 2>/dev/null || true
  fi

  # Only ever delete a branch this script made. A branch passed in with
  # --branch belongs to whoever passed it.
  if [ "$OWNED" = true ] && [ "$KEEP" = false ] && [ -n "${BRANCH_CREATED:-}" ]; then
    say "Deleting the throwaway branch"
    npm run db:branch:rm -- "$BRANCH" >/dev/null 2>&1 || \
      echo "  could not delete '$BRANCH' — it expires on its own."
  elif [ -n "${BRANCH_CREATED:-}" ]; then
    echo
    echo "Branch '$BRANCH' left in place. Remove it with:"
    echo "  npm run db:branch:rm -- $BRANCH"
  fi

  exit $status
}
trap cleanup EXIT INT TERM

# ── 1. Export from wherever the working tree currently points ────────────────

# The source is whatever DATABASE_URL resolves to — a shell variable if one is
# set, otherwise .env.local. Worth being deliberate about: .env.local points at
# the shared `development` branch, which is not always on the current schema.
#
#   DATABASE_URL="$(npm run --silent db:branch:url -- <branch>)" npm run content:roundtrip
say "Exporting the content snapshot from the current DATABASE_URL"
EXPORTED=1
npm run content:export

# A round trip that changes the committed snapshot is the regression this test
# exists to catch, so it is reported rather than passed over. It is not fatal on
# its own — an intended content edit shows up here too.
if [ -n "$(git status --porcelain -- $WRITTEN_BY_EXPORT)" ]; then
  echo
  echo "⚠ the export differs from what is committed:"
  git --no-pager diff --stat -- $WRITTEN_BY_EXPORT
  echo "  The rest of this run imports what was just exported, not the committed"
  echo "  files. Both are restored when this finishes — nothing here is a commit."
fi

# ── 2. A branch of its own to destroy ────────────────────────────────────────

if [ "$OWNED" = true ]; then
  say "Creating throwaway Neon branch '$BRANCH'"
  npm run db:branch:new -- "$BRANCH"
  BRANCH_CREATED=1
else
  say "Using existing branch '$BRANCH' (not created or deleted by this script)"
fi

DB_URL="$(npm run --silent db:branch:url -- "$BRANCH")"
[ -n "$DB_URL" ] || die "could not resolve a connection string for '$BRANCH'"

# ── 3. Rebuild it from empty ─────────────────────────────────────────────────

say "Applying migrations to '$BRANCH'"
DATABASE_URL="$DB_URL" npm run db:migrate
DATABASE_URL="$DB_URL" npm run payload:migrate

# `--wipe` deletes lessons, and `public.user_progress.lesson_id` is an
# ON DELETE RESTRICT foreign key — so on a branch forked from `production`, where
# ten real progress rows live, every lesson delete is refused and the wipe stops.
# That constraint is doing its job; it is simply pointed at a copy here.
#
# Only ever on a branch this script created. A branch named with --branch might
# be somebody's, and progress rows are not ours to clear on it — the import will
# fail with its own explanation instead, which says the same thing.
if [ "$OWNED" = true ]; then
  say "Clearing copied learner progress on '$BRANCH'"
  DATABASE_URL="$DB_URL" node --import tsx/esm -e '
    import { Client } from "pg";
    import { pinSslMode } from "./src/lib/db/connection.ts";
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const c = new Client({ connectionString: pinSslMode(url) });
    try {
      await c.connect();
      const r = await c.query("DELETE FROM public.user_progress");
      console.log(`  removed ${r.rowCount} progress row(s) — this is a fork, not the original`);
      await c.end();
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }
  '
fi

say "Wiping and importing the snapshot"
DATABASE_URL="$DB_URL" npm run content:import -- --wipe --yes

say "Verifying content structure"
DATABASE_URL="$DB_URL" npm run content:verify

# ── 4. Parity, which needs the app in front of it ────────────────────────────

printf 'DATABASE_URL=%s\n' "$DB_URL" > "$ENVFILE"

# Both the file and the variable, deliberately. `next dev` loads
# .env.development.local ahead of .env.local, but this script is usually invoked
# with DATABASE_URL already set to name the *export* source — and an inherited
# variable pointing somewhere else would have parity quietly checking the wrong
# database, which is the exact failure this whole test exists to catch.
say "Starting the app against '$BRANCH'"
DATABASE_URL="$DB_URL" npm run dev >/tmp/roundtrip-server.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null http://localhost:3000/ 2>/dev/null; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    die "the server exited during startup. Log: /tmp/roundtrip-server.log"
  fi
  sleep 2
done
curl -fsS -o /dev/null http://localhost:3000/ 2>/dev/null || \
  die "the server did not answer on :3000 within 120s. Log: /tmp/roundtrip-server.log"

say "Running parity"
npm run parity

say "Round trip complete — export, wipe, import, verify and parity all passed."
