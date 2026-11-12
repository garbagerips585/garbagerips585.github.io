# Runbook: the nightly, the weekly price job, and the syncs in neither

One page. `DEPLOY.md` explains how the nightly works; this is what to do about
it, and what it does not cover. Dates below were read from each data file's own
stamp on 11 November 2026. For today's ages, run:

```bash
node scripts/check-freshness.mjs
```

The top five rows of that output are hard (they turn `verify.yml` red). The
rest is a soft table that only warns. A row marked `LATE` with owner `weekly`
is the weekly price job (its own section below); with owner `hand` it is
something in the tables below.

## The nightly is red, or an alert issue opened. Now what?

1. **Read the issue comment.** "Nightly refresh is not healthy" lists what
   failed in plain sentences and links the run. One sync failing for one night
   needs nothing from you: that source shows last night's data and tries again
   tomorrow.
2. **Is the site itself current?** Compare the live commit with `main`:
   `rtk proxy curl -s "https://garbagerips.com/build.txt?$(date +%s)"; git rev-parse origin/main`.
   If they match, the site is deployed and only data is behind.
3. **The same sync three nights running** is an upstream change, not an outage.
   Open the run, read that step's log (the error message is at the top of the
   Node error, not the bottom) and fix the script. A YouTube `quotaExceeded`
   resets at midnight Pacific; if it comes back every night, something else
   is spending the key's daily quota.
4. **"DEGRADED NIGHT"** means a page builder threw on fresh data and the site
   was rebuilt from yesterday's. The comment names the builder. Reproduce it
   locally: run the nightly's sync steps you can (they are listed in
   `.github/workflows/refresh.yml`), then `node scripts/build-all.mjs`, and fix
   the builder or the script that feeds it. Until then prices and videos stay
   frozen while dates keep rolling.
5. **"The job ended failure"** means nothing was committed or nothing deployed.
   Read the first red step. If it is "Rebuild every page", both builds failed
   and the fault is in the source on `main`: `node scripts/build-all.mjs`
   locally will show the same error. If it is "Commit if anything changed", the
   push lost four races in a row; just run it again.
6. **"Nightly refresh did not commit"**: open Actions, Nightly refresh. Look
   inside the newest run at the `refresh` JOB. A run can be green with the job
   skipped. No run at all for a day is GitHub dropping the schedule; run it by
   hand.
7. **"The live site is behind main"**: open Actions, Deploy to GitHub Pages.
   A queued run older than 20 minutes will time out by itself. A failed one
   needs a new push: `git commit --allow-empty -m "Redeploy" && git push`.
8. **Run the nightly by hand** after any fix: `gh workflow run "Nightly refresh"`,
   or Actions, Nightly refresh, Run workflow. It is safe to run twice.

## The weekly price job ("Weekly price lists")

`.github/workflows/weekly-prices.yml` runs once a week, booked for Sunday 22:17
UTC. GitHub starts it hours late, so it lands Sunday evening to about 3am
Monday in Rochester, NY, clear of the nightly. It commits as
"Weekly price lists: <date>" and starts the Pages deploy itself.

**What it owns** (the nightly does not touch these, and nobody has to run them
by hand any more):

| File | Chain (`bash scripts/weekly-run.sh <name>`) | Pages |
| --- | --- | --- |
| `data/graded.json` | `graded`: `sync-pricecharting.mjs --chase` | Hall of Fame, grading, promo prices on rip pages, luck, wanted |
| `data/top-graded.json` | `graded-top`: `sync-graded-top.mjs` (from the nightly's cache, no `--refresh`) then `verify-graded-top.mjs` | /top-graded.html, /base-set.html |
| `data/top-raw.json` | `raw-top`: `sync-raw-top.mjs` then `verify-raw-top.mjs` | /most-valuable-cards.html, 30th pages |
| `data/topps-top.json` | `topps-top`: `sync-topps-top.mjs` then `verify-topps-top.mjs` | /topps.html, /topps-card-values.html |
| `data/first-partner.json` | `first-partner`: `sync-first-partner.mjs --refresh`, prices only | First Partner guide, Hall of Fame |
| `data/price-history/<week>.json` | `node scripts/snapshot-prices.mjs` | none yet (kept for a future trend) |

**Each chain is all or nothing.** If the sync, the verifier or the check that
judges the result fails, that one file goes back to last week's copy and the
others carry on. `scripts/weekly-check.mjs` is the judge; its header says what
it refuses.

**The three ranked lists show two dates on purpose.** The figure on the page
comes from a console listing the nightly read some time in the last month (the
cold rotation is a month deep by design), so the page's "read" date is the
OLDEST listing read behind the list, usually three to four weeks back. Every
printed row was re-read from its own product page on the day the job ran
(`verify.ran` in the file) and is within 15% of that read, or it is not printed.
Those lists get fresher than a month only if the consoles behind them are read
more often, which is the owner's call; see docs/nightly-and-deploy.md.

**"Weekly price lists are not healthy" opened or got a comment. Now what?**

1. Read the comment. Each sentence is one chain that kept last week's file, and
   it links the run. One chain failing for one week needs nothing from you.
2. "was not publishable this week": open the run, open that step. The log names
   the rows. A handful of named rows that "neither PriceCharting's own change
   figure nor an older listing read explains" means the two reads of those
   cards disagree and a person should look at the two PriceCharting pages. "Only
   N of M rows agree" or "more than a fifth" means the parse broke or
   PriceCharting blocked the run: do not publish by hand, fix
   `shared/pricecharting.mjs` or wait a week.
3. "failed or came back thin": PriceCharting refused part of the run. It tries
   again next week. Three weeks running is a block or a changed page.
4. "The page build failed on this week's ranked lists": a page builder has a
   hard check the new ranking tripped (a named card that must be double-read on
   /base-set.html, an expected row on a Topps page). The step's log names the
   builder. The graded and First Partner prices still published.
5. "did not start ... inside the hours the nightly refresh lands in": GitHub
   delivered the run very late. Start it by hand after 20:00 UTC.
6. A clean week closes the issue by itself.

**Run it by hand.** The whole job: `gh workflow run "Weekly price lists"`, or
Actions, Weekly price lists, Run workflow (untick "ranked" to skip the three
ranked lists). Not between 11:00 and 20:00 UTC, when the nightly lands: the two
share a lock. One chain on your own machine:

```bash
bash scripts/weekly-run.sh graded          # about 11 minutes, 600 requests
bash scripts/weekly-run.sh graded-top      # reads .cache/, then 120 product pages
bash scripts/weekly-run.sh raw-top         # 160 product pages
bash scripts/weekly-run.sh topps-top       # 179 product pages
bash scripts/weekly-run.sh first-partner   # about 32 pages
node scripts/snapshot-prices.mjs && node scripts/snapshot-prices.mjs --check
GR_SKIP_IMAGE_BUILDERS=1 TZ=America/New_York node scripts/build-all.mjs
```

A chain that exits non-zero has left a file you must not commit:
`git checkout HEAD -- data/<that file>`. On your machine the ranked chains read
YOUR `.cache/pricecharting-console/`, which is only as fresh as your last
crawl, not the nightly's; the runner's copy is the current one.

## What the nightly refreshes (nothing to do by hand)

YouTube videos and playlists, sealed product prices, foreign set lists and
guides, PriceCharting card prices (28 set guides nightly, the rest on a 30 day
rotation), 30th Celebration prices, card checklists, preorder prices, TCGplayer
links, PSA 10 prices (50 cards a night).

## Hand-run syncs that carry prices or dates a page prints

None of these run on a schedule. (The graded prices, the three card rankings
and the First Partner prices used to be in this table; the weekly job above owns
them now. `sync-graded-top.mjs --refresh`, the full recrawl of every console
page, is still a hand run and still about 20 minutes of requests.) "How often"
is a suggested review interval,
matching the soft leashes in `check-freshness.mjs`; it is a proposal, not a
measured need. Every one is followed by `node scripts/build-all.mjs`.

| Script | Refreshes | Pages that read it | How often | Last run |
| --- | --- | --- | --- | --- |
| `sync-top100.mjs` | `data/top100.json` (TCGplayer sealed prices) | /most-expensive-sealed.html | every 6 weeks | 2026-09-23 |
| `sync-wanted.mjs` | `public/data/wanted.json` from `data/wanted.json` | /wanted.html, Hall of Fame, home | when the hunt list changes | 2026-08-11 |
| `sync-decks.mjs` | `data/decks.json` (Limitless deck usage) | /decks.html, /top-100-playable.html | each rotation, or quarterly | 2026-08-16 |
| `sync-sets.mjs` | `public/data/sets.json` | every set guide, Pokemon pages, most guides | when a new English set releases | 2026-11-07 |
| `sync-expansions.mjs` | `public/data/expansions.json` | /expansions.html, /what-set.html, /pack-prices.html | when a new set releases | 2026-11-07 |
| `sync-extra-products.mjs` | `data/extra-products.json` (pinned sealed products and photos) | /msrp.html, /what-to-buy.html, retailers, openings | when a product is added | 2026-08-18 |
| `sync-30th-tcgplayer.mjs`, `sync-30th-illustrators.mjs` | `data/30th.json`, `data/30th-checklist.json`, `data/30th-illustrators.json` | 30th Celebration pages | when the set's card list changes | 2026-09-23, 2026-09-25 |
| `sync-jumbo.mjs` | `data/jumbo-catalogue.json` | jumbo cards page | quarterly | 2026-09-23 |
| `import-sheet.mjs` | `data/hits.json`, `data/overrides.json`, `data/manual.json` from the video log workbook | rip pages, Hall of Fame, luck, set guides | after every workbook edit | hits.json committed 2026-11-11 |
| `import-cards.mjs` | `data/wanted.json` or `data/shops.json` from a CSV export of the Chase Cards or Shops tab | /wanted.html, /shops.html | after editing those sheet tabs | not stamped |

## Files edited by hand, with no script

| File | Pages | How often | Last dated |
| --- | --- | --- | --- |
| `data/drops.json` | /drops.html | weekly; overdue once `weekEnds` passes | week ending 2026-11-15 |
| `data/shows.json` | /card-shows.html and /shows/ | every two weeks | 2026-11-07 |
| `data/retailer-prices.json` | retailer pages | every 6 weeks | 2026-09-30 |
| `data/msrp.json`, `data/pokemon-center-prices.json` | /msrp.html, set guides, what to buy | quarterly, and at each new set | 2026-08-17 |
| `data/grading.json` | /grading.html | quarterly (fees change) | 2026-08-13 |
| `data/selling.json`, `data/buying.json` | selling and buying guides | quarterly | 2026-08-15 |
| `data/shops.json` | /shops.html | quarterly (hours change) | 2026-08-15 |

## Hand-run syncs for pictures and reference data (run when the thing changes)

These fetch art, maps or reference tables. They do not go stale on a clock;
run one when its subject changes (a new set, a new shop, a new game).

| Script | Refreshes | Last run |
| --- | --- | --- |
| `sync-all-printings.mjs` | `public/data/printings/` for the card search and Pokemon pages | 2026-09-01 |
| `sync-pokedex.mjs`, `sync-evolution.mjs`, `sync-type-chart.mjs`, `sync-species-art.mjs` | `data/pokedex.json`, `data/evolutions.json`, `data/type-chart.json`, `data/species-art.json` | 2026-08-13 to 2026-08-20 |
| `sync-card-thumbs.mjs` | card thumbnails under `public/assets/cards/` | not stamped |
| `sync-subset-scans.py` | `data/subset-scans.json` and `public/assets/subset/` | 2026-10-02 |
| `sweep-scans.mjs` | `data/no-scan.json` (scans that 404) | 2026-08-14 |
| `sync-topps-images.mjs` | `data/topps-images.json` | 2026-08-18 |
| `sync-playlist-covers.mjs`, `build-playlist-covers.py` | `data/playlist-covers.json` and the cover art | 2026-08-23 |
| `sync-game-covers.mjs`, `sync-game-shots.mjs`, `sync-app-shots.mjs` | video game covers, screenshots, app screenshots | 2026-08-16 to 2026-08-20 |
| `sync-card-show-map.mjs`, `sync-shop-map.mjs` | `data/card-show-map.json`, `data/shop-map.json` (OpenStreetMap) | 2026-08-20 |
| `sync-places.py` | `public/data/places.json` (zip codes for "near me") | not stamped |
| `sync-plate-photos.py` | Garbage Plate photos and their license check | data updated 2026-09-23 |
| `retag-videos.mjs` | set and product tags in `public/data/videos.json`, offline | run after changing tag rules |
| `build-og.py` and the other `build-*.py` asset builders not in `build-all.mjs` | share cards, logos, favicon, pack art | run after a palette or art change |

## Rules that apply to all of the above

- Finish with `node scripts/build-all.mjs`, then `python3 scripts/check-build.py`.
- Stage files by name. Never `git add -A` while anything else is working in
  the repository.
- The nightly lands between 8am and 2pm Eastern. A push in that window is fine:
  the nightly rebuilds on top of it and keeps hand edits.
