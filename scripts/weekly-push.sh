#!/usr/bin/env bash
# Commit the weekly price job's work and push it, surviving a push race.
#
#   bash scripts/weekly-push.sh
#
# THIS IS scripts/nightly-push.sh WITH A DIFFERENT LIST AND A DIFFERENT COMMIT
# MESSAGE, COPIED ON PURPOSE. That script takes no arguments and its group list
# and message are literals, and the nightly is not the place to add a mode for a
# job that runs once a week. The loop below is its loop, line for line; the
# reasoning for every step of it (a race is resolved by REBUILDING, never by
# merging; a person's edit always wins; nothing generated is carried over) is
# written there and in .github/workflows/refresh.yml and is not repeated here.
# IF YOU FIX A BUG IN ONE, FIX IT IN THE OTHER.
#
# What differs:
#   - GROUPS_OWNED is the files the weekly chains write (scripts/weekly-run.sh
#     and scripts/snapshot-prices.mjs). Each is its own group: no two of them
#     have to agree with each other.
#   - The commit message is "Weekly price lists: <date>". scripts/check-live.sh
#     looks for "Nightly refresh: " to decide whether the nightly committed, so
#     this message must never start with those words.
#   - When a push lands it writes `pushed=1` to $GITHUB_OUTPUT, which the
#     workflow reads to decide whether there is anything to deploy.
set -u

GROUPS_OWNED=(
  # sync-pricecharting.mjs
  "data/graded.json"
  # sync-graded-top.mjs + verify-graded-top.mjs
  "data/top-graded.json"
  # sync-raw-top.mjs + verify-raw-top.mjs
  "data/top-raw.json"
  # sync-topps-top.mjs + verify-topps-top.mjs
  "data/topps-top.json"
  # sync-first-partner.mjs (prices only; see scripts/weekly-run.sh)
  "data/first-partner.json"
  # snapshot-prices.mjs
  "data/price-history"
)

git config user.name "garbage-rips-bot"
git config user.email "bot@garbagerips585.invalid"

commit_all() {
  git add -A
  if git diff --cached --quiet; then return 1; fi
  git commit -q -m "Weekly price lists: $(date +%Y-%m-%d)

$(git diff --cached --stat | tail -1)"
}

pushed() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "pushed=1" >> "$GITHUB_OUTPUT"; fi
  exit 0
}

if ! commit_all; then
  echo "Nothing changed this week."
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$branch" = "HEAD" ]; then branch="${GITHUB_REF_NAME:-main}"; fi

for i in 1 2 3 4; do
  if git push origin "HEAD:refs/heads/$branch"; then pushed; fi

  week=$(git rev-parse HEAD)
  base=$(git rev-parse HEAD~1)
  git fetch -q origin "$branch" || exit 1
  theirs=$(git rev-parse FETCH_HEAD)

  if [ "$theirs" = "$base" ]; then
    echo "Push rejected (attempt $i) and origin has not moved. Waiting and trying the same commit again."
    sleep 20
    continue
  fi

  echo "Push rejected (attempt $i). Origin moved $base -> $theirs. Taking it, putting this week's price files back, rebuilding."
  git reset -q --hard "$theirs"

  for group in "${GROUPS_OWNED[@]}"; do
    # shellcheck disable=SC2086
    set -- $group
    if git diff --quiet "$base" "$week" -- "$@"; then
      continue                                   # the weekly job did not change it
    fi
    if ! git diff --quiet "$base" "$theirs" -- "$@"; then
      echo "  theirs wins, changed by the other push: $group"
      continue
    fi
    have=()
    for p in "$@"; do
      if [ -n "$(git ls-tree -r --name-only "$week" -- "$p" | head -1)" ]; then have+=("$p"); fi
    done
    if [ ${#have[@]} -gt 0 ]; then
      git checkout "$week" -- "${have[@]}"
      echo "  kept this week's: $group"
    fi
  done

  bash scripts/nightly-build.sh node scripts/build-all.mjs || exit 1
  if ! commit_all; then
    echo "Rebuilt on top of their push and nothing differs. Their tree already has it."
    exit 0
  fi
done

echo "Still could not push after four attempts."
exit 1
