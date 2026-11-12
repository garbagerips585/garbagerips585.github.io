# Build, verify, commit

Covers the commands, the order to run them in, what each check proves, and the git habits that keep the tree honest.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Written on 2026-11-11 from the scripts and workflows at HEAD. The measurements behind several of these rules are in docs/css.md.

## The shape of the repo

`public/` is generated AND committed, and GitHub Pages serves exactly that directory. There is no server build
step. So every change is: edit source, rebuild, check, commit the source and `public/` together.

## The sequence

1. `git pull` first. The nightly commits to main (see docs/nightly-and-deploy.md) and can arrive hours late, so
   a tree that was current yesterday evening may not be this morning.
2. Edit source: `scripts/`, `shared/`, `assets-source/`, `data/`. Never edit a file under `public/` by hand.
3. `GR_SKIP_IMAGE_BUILDERS=1 TZ=America/New_York node scripts/build-all.mjs`
   - Runs every builder in the nightly's order and ends with a line of the form "N of N builders ok". Anything
     else is a failed build.
   - It only BUILDS. It needs no API key and pulls no fresh data. (Two steps fetch a file they do not already
     hold and are no-ops afterwards: fetch-fonts.sh and sync-symbols.mjs.)
   - `GR_SKIP_IMAGE_BUILDERS=1` skips the image steps, which rewrite their files on every run and differ by
     machine. Leave it off only when you mean to regenerate share cards or pack art.
   - `TZ=America/New_York` because the site bakes "today" into its HTML through shared/today.mjs. CI and the
     nightly both run in New York time; a build in another zone stamps a different day.
4. `python3 scripts/check-build.py`
   - Ends "all checks pass" and exits 0 when the tree is good.
   - Exit 1: a broken build. Fix it.
   - Exit 2: the build is fine and the owner's workbook has a cell that needs him (for example a mistyped
     rarity). The nightly tolerates 2 on purpose so one cell cannot stop every commit. Report it, do not "fix" it
     in data/hits.json.
5. Before a commit that touches `public/`:
   `GR_SKIP_IMAGE_BUILDERS=1 TZ=America/New_York node scripts/check-tree-drift.mjs --staged`
   - It exports the commit to a scratch directory, builds it, and hashes every file against the committed
     `public/`. Without `--staged` it asks about HEAD, which is one commit too late. `--diff` prints what differs.
   - Both environment variables are required: without them it reports drift that is only image bytes or the
     calendar. verify.yml runs it with exactly these two.
   - It takes minutes. check-build.py is the fast check; drift is the proof.
6. `TZ=America/New_York node scripts/check-freshness.mjs` reads the date stamps the nightly owns and fails when
   one has stopped moving. It tells you whether the nightly is alive, not whether your change is right.
7. Commit source and `public/` in the same commit, staging by explicit path.

## Rules that came out of incidents

- **Always finish with build-all.mjs.** A single builder run afterwards leaves that page's inline `<style>`
  comments in (stamp-assets.mjs strips them and runs last) and undoes the page-CSS split, so the committed tree
  stops matching a fresh build. This is true even of a builder run only to read its output. check-build.py
  catches it. Full story in docs/css.md.
- **Never `git add -A` or `git add -u` while other agents are editing.** It commits their half-finished work.
  Stage by path.
- **Commit `public/` with the source that produced it.** A commit that changes a builder and not its pages
  passes every local check and ships a stale site; that is the failure check-tree-drift.mjs exists for.
- **Never run a `sync-*` or `refresh-*` script casually.** They hit other people's servers and rewrite data.
  The ones that are deliberately NOT in build-all.mjs (sync-decks.mjs, sync-shop-map.mjs,
  sync-card-show-map.mjs, sweep-scans.mjs, sync-plate-photos.py, sync-subset-scans.py, the Topps sync and
  verify scripts, build-og.py) are run by hand by somebody who then re-reads what the pages claim.
- **`node --check` on a .mjs builder can pass a broken file.** Run the builder.

## Counting things

Do not write page, builder or video counts into CLAUDE.md or these docs as constants; they have gone stale every
time. Get them when you need them:

- builders: the last line of build-all.mjs
- videos and tagging: `node scripts/build-untagged.mjs` (it also rewrites UNTAGGED.md, which is generated)
- built pages: `find public -name '*.html' | wc -l`
- stylesheet size: the one-liner in docs/css.md

## Local preview

`node .claude/server.js` (port 4585), or the "grips" entry in the parent
Codex .claude/launch.json. .claude/ is gitignored, so it never deploys.

In a git worktree `.claude/` may be absent; `python3 -m http.server <port> --directory public` or a small Node
static server does the same job. Drive headless Chrome over CDP for measurements; the in-app browser pane
freezes transitions and lazy images and reads as bugs that are not there.

## Layout and accessibility checks for any page change

- One h1 per page; new sections use h2 and h3 in order; a new nav landmark needs an aria-label.
- No horizontal overflow at 320, 390, 768 and 1440. The test that means something is an element whose right
  edge is past `documentElement.clientWidth` with no clipping ancestor (docs/video.md, "DO NOT MEASURE THIS WITH
  `window.innerWidth`").
- Standalone links and buttons are at least 44px tall on a phone. A link that is a flex child can have a tap
  target far smaller than it looks; measure the box.
- Small text needs 4.5:1 against the ground actually painted under it (docs/brand.md).
- Honor `prefers-reduced-motion` for any animation (docs/gotchas.md).
- Look at a screenshot at 390x844 and 1440x900 before calling a change done, and check the console for errors.
