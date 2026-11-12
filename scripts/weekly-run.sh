#!/usr/bin/env bash
# One chain of the weekly price job, start to finish, as ONE command.
#
#   bash scripts/weekly-run.sh graded          data/graded.json
#   bash scripts/weekly-run.sh graded-top      data/top-graded.json
#   bash scripts/weekly-run.sh raw-top         data/top-raw.json
#   bash scripts/weekly-run.sh topps-top       data/topps-top.json
#   bash scripts/weekly-run.sh first-partner   data/first-partner.json
#
# .github/workflows/weekly-prices.yml runs each of these through
# scripts/nightly-step.sh, which is what gives a chain its contract: if ANY link
# exits non-zero (the sync, the verifier, or the check that judges the result),
# the file goes back to the last committed copy. A sync and its verifier are one
# chain here on purpose. They write the same file, and a list that was re-ranked
# and then only half verified must never be what the build reads.
#
# It is also how to run the weekly job by hand; see RUNBOOK.md. These talk to
# pricecharting.com at the scripts' own pacing (about 1.1 seconds a page), the
# same requests the hand-run steps always made. Nothing here is new load:
#
#   graded         about 300 searches and 300 product pages (hits plus each
#                  set's top 3 chase cards; `--chase` is how the committed file
#                  was made)
#   graded-top     120 product pages     raw-top    160 product pages
#   topps-top      179 product pages     first-partner   about 32 pages
#
# THE THREE RANKED CHAINS READ THE NIGHTLY'S PAGE CACHE AND DO NOT CRAWL.
# sync-graded-top.mjs runs WITHOUT --refresh (that flag refetches all 1,160
# console pages) and under scripts/weekly-net-guard.mjs with a budget of 40
# requests, so a cache that came back empty stops the chain instead of starting
# the crawl. sync-raw-top.mjs and sync-topps-top.mjs make no request at all.
# Then scripts/weekly-check.mjs dates the list by its real listing reads, the
# verifier re-reads every row from its product page, and weekly-check.mjs
# decides whether the result may be published. Read that file's header.
#
# EVERY VERIFICATION IS A NEW READ. The verifiers read
# .cache/pricecharting-product/ before the network, and on the runner .cache is
# restored from the last run. Left alone, week two would "verify" against week
# one's pages and call it a second read. On the runner that cache is emptied
# once per run (a marker file in the runner's temp directory), so a card on both
# the raw and the graded list is still fetched once, as the verifiers intend.
# On a person's machine nothing is deleted: the verifiers get --refresh instead,
# which refetches and overwrites page by page.
set -euo pipefail

cd "$(dirname "$0")/.."
what=${1:-}
node_guard=(node --import ./scripts/weekly-net-guard.mjs)

verify_flags=()
fresh_product_cache() {
  if [ "${GITHUB_ACTIONS:-}" != "true" ]; then verify_flags=(--refresh); return 0; fi
  local marker="${RUNNER_TEMP:-/tmp}/weekly-product-cache-emptied-${GITHUB_RUN_ID:-0}"
  if [ -e "$marker" ]; then return 0; fi
  # A literal path, never a variable: this is a removal.
  rm -rf .cache/pricecharting-product
  mkdir -p .cache/pricecharting-product
  : > "$marker"
  echo "weekly-run: emptied the product-page cache, so every verification below is a new read."
}

case "$what" in
  graded)
    node scripts/sync-pricecharting.mjs --chase
    node scripts/weekly-check.mjs graded
    ;;
  graded-top)
    fresh_product_cache
    WEEKLY_FETCH_BUDGET=40 "${node_guard[@]}" scripts/sync-graded-top.mjs
    node scripts/weekly-check.mjs redate data/top-graded.json
    node scripts/verify-graded-top.mjs ${verify_flags[@]+"${verify_flags[@]}"}
    node scripts/weekly-check.mjs ranked data/top-graded.json
    ;;
  raw-top)
    fresh_product_cache
    node scripts/sync-raw-top.mjs
    node scripts/weekly-check.mjs redate data/top-raw.json
    node scripts/verify-raw-top.mjs ${verify_flags[@]+"${verify_flags[@]}"}
    node scripts/weekly-check.mjs ranked data/top-raw.json
    ;;
  topps-top)
    fresh_product_cache
    node scripts/sync-topps-top.mjs
    node scripts/weekly-check.mjs redate data/topps-top.json
    node scripts/verify-topps-top.mjs ${verify_flags[@]+"${verify_flags[@]}"}
    node scripts/weekly-check.mjs ranked data/topps-top.json
    ;;
  first-partner)
    # Prices only. pokemon.com is not asked for the artwork again and the
    # committed pictures are put back whatever the script did to them.
    WEEKLY_FETCH_HOSTS=www.pricecharting.com "${node_guard[@]}" scripts/sync-first-partner.mjs --refresh
    git checkout HEAD -- public/assets/first-partner
    git clean -fdq -- public/assets/first-partner
    node scripts/weekly-check.mjs first-partner
    ;;
  *)
    echo "usage: weekly-run.sh graded | graded-top | raw-top | topps-top | first-partner" >&2
    exit 64
    ;;
esac
