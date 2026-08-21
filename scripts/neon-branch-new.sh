#!/usr/bin/env bash
#
# Create a Neon branch that deletes itself.
#
# `docs/database-workflow.md` already says that a spike, an experiment or "an
# agent that needs somewhere destructive to work" should create its branch
# **with an expiry** so it cleans itself up. Nobody did, including the agent that
# wrote this — because the documented-correct command was a raw two-line
# `neonctl` invocation while `npm run db:branch:new -- <name>` was one word and
# produced `Expires At: never`. When the convenient path and the correct path
# differ, the convention loses. So the default moved here instead.
#
# Neon does the deleting, which is the point: forgetting is now harmless, and it
# stays harmless when the laptop that made the branch is closed for a week.
#
# Two things this deliberately does not do:
#
#   - It does not expire `dev/*`. Per-developer branches are documented as
#     long-lived and hold a developer's `.env.local` target; auto-deleting one
#     mid-task would be the destructive version of this problem. Refresh them
#     with `db:branch:reset`.
#   - It does not expire anything you pass `--keep`. A branch you are about to
#     spend a week on is a real case, and the escape hatch should be one word
#     rather than a reason to go around the script.
#
# The PR-driven branches need none of this: `.github/workflows/neon-preview-branch.yml`
# deletes `preview/pr-<n>` when the PR closes, merged or not. And
# `preview/<git-branch>` belongs to the Neon-managed Vercel integration, which
# removes it when the git branch goes — so those two classes are already covered
# and this only fills the third, the ones cut by hand.
set -euo pipefail

PROJECT_ID=bold-bar-07861256
DEFAULT_DAYS=3

keep=false
name=""

while [ $# -gt 0 ]; do
  case "$1" in
    --keep) keep=true; shift ;;
    --days) DEFAULT_DAYS="$2"; shift 2 ;;
    -*) echo "unknown option: $1" >&2; exit 2 ;;
    *) name="$1"; shift ;;
  esac
done

if [ -z "$name" ]; then
  cat >&2 <<'USAGE'
usage: npm run db:branch:new -- <branch-name> [--days N] [--keep]

  Forks from `production`. Expires in 3 days unless you say otherwise, so a
  branch you forget about disappears instead of accumulating.

    npm run db:branch:new -- rehearsal-cutover        # gone in 3 days
    npm run db:branch:new -- spike-thing --days 14
    npm run db:branch:new -- dev/justin               # long-lived, no expiry
    npm run db:branch:new -- keep-me --keep           # long-lived, explicit

  npm run db:branch:ls   # what exists, and when each one expires
  npm run db:branch:rm   # delete one early
USAGE
  exit 2
fi

# `dev/*` is the documented long-lived, per-developer shape — see
# docs/database-workflow.md. Expiring one would delete the branch somebody's
# .env.local points at.
case "$name" in
  dev/*) keep=true ;;
esac

if [ "$keep" = true ]; then
  echo "Creating '$name' with no expiry (long-lived)." >&2
  echo "  Delete it yourself when done: npm run db:branch:rm -- $name" >&2
  exec neonctl branches create --project-id "$PROJECT_ID" --parent production --name "$name"
fi

# Computed with node rather than `date`, because `date -v+3d` is BSD and
# `date -d '+3 days'` is GNU, and this runs on both macOS and ubuntu runners.
expires_at="$(node -e "console.log(new Date(Date.now() + $DEFAULT_DAYS * 86400000).toISOString())")"

echo "Creating '$name', expiring $expires_at (in ${DEFAULT_DAYS} day(s))." >&2
echo "  Neon deletes it — you do not have to remember. Pass --keep to opt out," >&2
echo "  or --days N for longer. Note: a branch with an expiry cannot have children." >&2

exec neonctl branches create \
  --project-id "$PROJECT_ID" \
  --parent production \
  --name "$name" \
  --expires-at "$expires_at"
