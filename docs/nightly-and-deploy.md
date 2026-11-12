# The nightly refresh and the deploy

Covers how the site refreshes itself every night, how to tell whether it did, the alert added on 11 November 2026, and one fact about the custom domain.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. DEPLOY.md at the repo root is the operating document for deploys (and RUNBOOK.md for incidents, where it exists); this file does not repeat them. Written on 2026-11-11 from the workflows at HEAD, except the CNAME section, which was moved word for word from CLAUDE.md.

## How it works

- `.github/workflows/refresh.yml` ("Nightly refresh") runs at about 3am in Rochester, NY. GitHub cron is UTC and
  knows nothing about daylight saving, so two crons are scheduled, 07:17 and 08:17 UTC, and the job's first step
  skips whichever one is not 3am in New York that day. Skipping is not failing.
- GitHub runs scheduled jobs late: 54 minutes to 3 hours was measured here. So the nightly's commit can land
  any time up to about 6:20am Eastern. Pull before you edit.
- The job runs with `TZ: America/New_York` at job level. shared/today.mjs reads the process timezone; without
  it the job ran in UTC and a run after 7pm Eastern stamped tomorrow's date on every page while verify.yml and a
  local build, both New York, disagreed.
- It syncs (YouTube with `YT_API_KEY`, card checklists and prices, PriceCharting, PSA 10 by rotation with
  `PPT_API_KEY`), runs build-all.mjs and check-build.py, and commits. check-build.py's exit 2 (a workbook cell
  that needs the owner) is tolerated; exit 1 stops the commit.
- `.github/workflows/pages.yml` uploads `public/` and nothing else, on every push to main and when the nightly
  finishes (a push made with the default token does not trigger other workflows, so `workflow_run` is what
  deploys the nightly's commit). Nothing outside `public/` is ever published, which includes this `docs/`
  directory.
- `.github/workflows/verify.yml` runs the drift check and the freshness check on every push and once a day at
  16:40 UTC. It does not block the deploy on purpose: a red tick beside a green deploy means the site is up and
  is not what the source says.

## The alert (11 November 2026)

From 4 to 8 November 2026 the nightly was red five nights running and nobody was told, because a red X on the
Actions tab is only a signal to somebody looking at the Actions tab. The last step of refresh.yml now keeps ONE
GitHub issue titled "Nightly refresh is not healthy":

- a bad night adds a comment naming what failed (the whole job, the YouTube sync, or the PriceCharting refresh)
  with a link to the run, creating the issue if none is open;
- a clean night closes it with a comment.

GitHub emails issue activity to the repository's watchers, which is the whole mechanism; there is no outside
service. The step runs `if: always()` with `continue-on-error`, so it can never fail the job or block a deploy.

## What killed those five nights

`paginate()` in scripts/sync-youtube.mjs looped forever on a playlist that answered an empty page with a
`nextPageToken`, and burned the YouTube API quota. It now stops on an empty page, a repeated token, or 200
pages. Details in docs/video.md. On 11 November a second, unrelated freeze came from TCGdex renaming a rarity;
see "Mega Attack Rare" in docs/set-pages.md.

## How to check the nightly

- `gh issue list --search "Nightly refresh is not healthy"`: an open issue means it is not healthy.
- `gh run list --workflow=refresh.yml --limit 5`: one run a day should be a success; the other cron's run is a
  quick skip.
- `git log --oneline -5 origin/main`: the bot's commit should be there from this morning.
- `TZ=America/New_York node scripts/check-freshness.mjs`: prints each watched data file with its stamp, its age
  in days and its leash, and fails if any is past it.

## The weekly price job (11 November 2026)

`.github/workflows/weekly-prices.yml` ("Weekly price lists") puts the price syncs that used to be hand runs on a
schedule: `data/graded.json`, the three ranked lists (`data/top-graded.json`, `data/top-raw.json`,
`data/topps-top.json`) and `data/first-partner.json`. RUNBOOK.md is the operating page (what it owns, how to run
it by hand, what its alert means). What is worth knowing before changing it:

- **Booked Sunday 22:17 UTC, in the nightly's concurrency group (`refresh`).** The two can never run at once. A
  concurrency group holds only one WAITING run and a newer one cancels it, and the nightly is two crons of which
  the earlier is the wanted one from March to November. So a scheduled weekly run that GitHub delivers between
  11:00 and 19:59 UTC does not start (its `gate` job says so on the alert issue). Do not move the cron into the
  hours before the nightly's landing window without redoing that sum.
- **It restores the nightly's API cache and never saves one.** The ranked lists are built from
  `.cache/pricecharting-console/`, which only the nightly fills. A save from a week where the restore came back
  empty would hand the next nightly an empty cache.
- **It adds no crawl.** `sync-graded-top.mjs` runs without `--refresh` and under `scripts/weekly-net-guard.mjs`
  with a budget of 40 requests; the two other ranked syncs make none. The requests it does make are the ones
  the hand runs made: searches and product pages for graded.json, one product page per ranked row, about 32
  pages for First Partner, all at about 1.1 seconds apart. `--cold 26` in refresh.yml is untouched.
- **Each chain is one command, `scripts/weekly-run.sh <name>`, run through `scripts/nightly-step.sh`**, so a
  failure anywhere in a chain puts that chain's file back to HEAD and leaves a sentence for the alert issue
  ("Weekly price lists are not healthy"). A sync and its verifier are one chain because they write one file.
- **`scripts/weekly-check.mjs` is the judgment a person used to supply.** It refuses a thin graded.json; it sets
  a ranked list's `checked` to the oldest console listing read behind the rows it can print (from
  `data/price-rotation.json`) and records the spread in `listingReads`; it writes an `excluded` entry for a
  disagreeing row only when PriceCharting's own change figure reconciles the two reads to the cent or the
  listing was read on an earlier day than the product page, and refuses the whole file when a row fits neither,
  when more than a fifth disagree or when the corpus shrank. Entries it writes carry `auto: true`.
- **First Partner is prices only.** The sync runs with every host except pricecharting.com refused, the
  committed pictures are put back, and only `checked` and each card's `pc` block are taken from the new read.
- **The build runs twice.** Once as a probe that puts only the three ranked files back if a builder rejects
  them, then `scripts/nightly-build.sh` as in the nightly. `scripts/weekly-push.sh` is a copy of the nightly's
  push loop with the weekly's own file groups.
- **Deploy.** A push made with the default token starts no workflow and pages.yml's `workflow_run` names only
  "Nightly refresh", so the job's last step runs `gh workflow run pages.yml` (the one event that token may
  raise; it needs `actions: write`). If pages.yml ever gains "Weekly price lists" in its `workflow_run` list,
  delete that step.
- **`data/top100.json` (sealed) is not in it.** `sync-top100.mjs` reads an undocumented TCGplayer endpoint and
  runs unattended nowhere. It stays a hand run.

### How fresh the ranked lists really are

Measured 11 November 2026 from `data/price-rotation.json`: the rows those three lists can print come from 86
consoles, nearly all in the cold rotation. The listing behind 2 of 120 top-graded rows, 5 of 160 top-raw rows
and 0 of 179 Topps rows had been read in the previous 7 days; 72, 72 and 179 were more than 21 days old. The
weekly job cannot change that inside the owner's limit (no extra console crawl), which is why it dates each
list by its oldest listing read rather than by the day it ran. `check-freshness.mjs` watches these three by
`verify.ran`, the day the rows were last re-read from their product pages. Making the lists themselves weekly
fresh would mean reading those 86 consoles every week, in addition to or ahead of the cold rotation. That is
a load decision for the owner and has not been made.

## The weekly price snapshot (`data/price-history/`)

`scripts/snapshot-prices.mjs` writes one file per ISO week, `data/price-history/2026-W46.json`, from
`public/data/cards/*.json`. No network and no clock: the week is the one the NEWEST `pricesChecked` falls in,
so a run on stale data rewrites nothing. The weekly job runs it after the syncs and before the build; the first
file was taken by hand on 11 November 2026. No page reads these yet. A 30 day trend needs four of them.

```
{ "week": "2026-W46", "unit": "US cents", "newestRead": "2026-11-10", "oldestRead": "2026-11-10",
  "counts": { "sets": 31, "cards": 5695, "raw": 5695, "grade9": 5646, "psa10": 5644 },
  "sets": { "<set id>": { "read": "<that set's pricesChecked>",
                          "cards": [ ["<number>", raw, grade9, psa10], ["002", 126, 1874, 14637, "Reverse Holo"] ] } } }
```

- Money is integer US cents; `null` means the card file holds no figure. A card with none of the three is left out.
- A fifth element names the printing the row's figures are for when it is not a standard one (the card file
  prices the most valuable printing of a number). If it differs between two weeks, the change is not a market
  move: do not chart across it.
- A second run in the same week overwrites the file only when no set's read is older and at least one is newer.
  `--force` overrides that.
- `node scripts/snapshot-prices.mjs --check` fails if a file does not parse, is not named for the week it
  holds, has a malformed row, or if the files are not in strictly increasing order of `newestRead`.
- Size, first file: 165KB, 49KB gzipped, one line per set so a weekly diff stays readable.

## The custom domain

**`public/CNAME` IS NOT THE SWITCH, and all three docs now say so.** DEPLOY.md
used to claim an Actions-deployed Pages site "reads the custom domain from a
CNAME file inside the uploaded artifact" and that "without it the custom domain
setting is dropped on the next deploy". GitHub documents the opposite for
exactly this publishing source: "If you are publishing from a custom GitHub
Actions workflow, no `CNAME` file is created, and any existing `CNAME` file is
ignored and is not required." (docs.github.com, Managing a custom domain for
your GitHub Pages site, checked 21 August 2026.) This repo publishes with
`actions/deploy-pages@v4`, so the custom domain lives in Settings -> Pages and
nowhere else. Generating the file is harmless and worth keeping as a record of
intent. DEPLOY.md was corrected the same day and LAUNCH-DAY.md step 8 is where
the domain actually gets set; believing the old version costs an hour of looking
in the wrong place if the domain does not answer on launch day.

(Note added in the restructure: LAUNCH-DAY.md now lives at docs/history/LAUNCH-DAY.md. The fact above is current; the launch day it refers to has passed.)
