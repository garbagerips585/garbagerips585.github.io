#!/usr/bin/env bash
# Commit the nightly's work and push it, surviving a push race without losing
# the night's data.
#
#   bash scripts/nightly-push.sh
#
# A PUSH RACE IS RESOLVED BY REBUILDING, NEVER BY MERGING. That rule is argued
# at length beside this step in .github/workflows/refresh.yml and it stands:
# generated pages are never merged, public/ is always one fresh build-all.mjs
# run over the final source.
#
# WHAT CHANGED ON 11 NOVEMBER 2026. The old loop did `git reset --hard HEAD~1`,
# pulled, and ran ONLY build-all. The reset threw away every file the syncs had
# just written (prices, videos.json) and the syncs were not run again, so the
# retry committed at most a date roll and the job went green: the night's
# refresh was silently lost. And GitHub starts this job 5 to 10 hours late, at
# 8am to 2pm Eastern, which is exactly when a person pushes, so the race is
# the likely case rather than the rare one.
#
# Now, on a rejected push:
#   1. Remember the rejected commit's sha (it stays readable by sha).
#   2. Reset to the new origin: their source, their pages, their data.
#   3. Put back the DATA FILES THE SYNCS OWN from the rejected commit, one
#      group at a time, and only where the other push did not touch that group.
#      If a person changed any file in a group, their whole group wins and the
#      nightly's copy of it waits for tomorrow. Hand-edited files (overrides,
#      hits, drops, shows and so on) are in no group and are never touched.
#   4. Rebuild everything with scripts/nightly-build.sh and commit that.
#
# A GROUP is the set of files one sync chain writes together and that must
# agree with each other. The list is derived from what each sync step in
# refresh.yml writes; keep the two in step. Nothing under public/ other than
# these synced data files is ever carried over: the rest of public/data/ is
# build output (card-numbers/, site-index.json, games/ and so on).
set -u

GROUPS_OWNED=(
  # sync-youtube.mjs
  "data/descriptions.json public/data/videos.json public/data/playlists.json"
  # sync-products.mjs
  "public/data/products.json public/data/products-intl.json"
  # sync-intl.mjs
  "public/data/intl-sets.json"
  # sync-intl-guides.mjs
  "public/data/intl-guides.json"
  # (refresh-prices.mjs and sync-pricecharting-cards.mjs are off from
  # 13 November 2026: see shared/no-pricecharting.mjs)
  # sync-30th-prices.mjs
  "data/30th-prices.json"
  # sync-30th-card-data.mjs, sync-cards.mjs and reconcile-cards.mjs: one group,
  # because reconcile exists to make these files agree with each other.
  "public/data/cards public/data/card-index.json public/data/sets.json public/data/wanted.json"
  # sync-preorders.mjs
  "public/data/preorders.json"
  # sync-chase.mjs
  "data/chase-tcg.json"
  # sync-prices.mjs
  "data/psa10.json"
)

git config user.name "garbage-rips-bot"
git config user.email "bot@garbagerips585.invalid"

commit_all() {
  git add -A
  if git diff --cached --quiet; then return 1; fi
  git commit -q -m "Nightly refresh: $(date +%Y-%m-%d)

$(git diff --cached --stat | tail -1)"
}

if ! commit_all; then
  echo "Nothing changed today."
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD)
# A detached checkout answers "HEAD". Actions checks out a real branch for a
# schedule or a manual run, so this is only a guard.
if [ "$branch" = "HEAD" ]; then branch="${GITHUB_REF_NAME:-main}"; fi

for i in 1 2 3 4; do
  if git push origin "HEAD:refs/heads/$branch"; then exit 0; fi

  night=$(git rev-parse HEAD)
  base=$(git rev-parse HEAD~1)
  git fetch -q origin "$branch" || exit 1
  theirs=$(git rev-parse FETCH_HEAD)

  if [ "$theirs" = "$base" ]; then
    # Rejected, but nobody pushed. Not a race, so there is nothing to rebuild
    # on; rebuilding four times would only burn the job's clock.
    echo "Push rejected (attempt $i) and origin has not moved. Waiting and trying the same commit again."
    sleep 20
    continue
  fi

  echo "Push rejected (attempt $i). Origin moved $base -> $theirs. Taking it, putting tonight's synced data back, rebuilding."
  git reset -q --hard "$theirs"

  for group in "${GROUPS_OWNED[@]}"; do
    # shellcheck disable=SC2086
    set -- $group
    if git diff --quiet "$base" "$night" -- "$@"; then
      continue                                   # the nightly did not change it
    fi
    if ! git diff --quiet "$base" "$theirs" -- "$@"; then
      echo "  theirs wins, changed by the other push: $group"
      continue
    fi
    have=()
    for p in "$@"; do
      if [ -n "$(git ls-tree -r --name-only "$night" -- "$p" | head -1)" ]; then have+=("$p"); fi
    done
    if [ ${#have[@]} -gt 0 ]; then
      git checkout "$night" -- "${have[@]}"
      echo "  kept tonight's: $group"
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
