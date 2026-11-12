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
