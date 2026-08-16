#!/usr/bin/env bash
#
# Delete a Neon branch, refusing the two that are not yours to delete.
#
# `db:branch:new` hardcodes `--parent production`, so "production" is the word
# most likely to be sitting in your shell history when you reach for a delete.
# Neon's own branch protection would stop that one — but it is opt-in, it is
# still listed as not-yet-done in docs/database-workflow.md, and it protects
# nothing on `development`, which every developer's .env.local points at.
#
# So the guard lives here rather than relying on the console being configured.
set -euo pipefail

PROJECT_ID=bold-bar-07861256
PROTECTED=(production development)

branch="${1-}"

if [ -z "$branch" ]; then
  echo "usage: npm run db:branch:rm -- <branch-name>" >&2
  echo "       npm run db:branch:ls   # to see what exists" >&2
  exit 2
fi

for protected in "${PROTECTED[@]}"; do
  if [ "$branch" = "$protected" ]; then
    echo "Refusing to delete '$branch' — it is a long-lived shared branch." >&2
    echo "  production  is what the deployed app uses." >&2
    echo "  development is what every developer's .env.local points at." >&2
    echo "If you genuinely mean to, do it in the Neon console where it is" >&2
    echo "deliberate rather than one shell-history arrow key away." >&2
    exit 1
  fi
done

exec neonctl branches delete --project-id "$PROJECT_ID" "$branch"
