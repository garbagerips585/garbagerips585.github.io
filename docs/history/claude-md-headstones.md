# Headstones: statements removed from CLAUDE.md because the repo has moved on

Covers text that was in CLAUDE.md until 11 November 2026 and is no longer true, kept so nobody has to wonder what it said. Nothing in this file is a current instruction.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

Each block is the original text, word for word, followed by what replaced it and the evidence.

## How the feeds work (no API keys)
YouTube auto-playlists derived from the channel ID:
- All uploads: UUnpEGJ2G_0af1YRyW2euIZQ
- Shorts only: UUSHnpEGJ2G_0af1YRyW2euIZQ
- Long-form only: UULFnpEGJ2G_0af1YRyW2euIZQ
Embedded via /embed/videoseries?list=... so they self-update.
RSS is also available: youtube.com/feeds/videos.xml?channel_id=UC...

**Why it is here.** The site no longer embeds auto-playlists. Every video has its own page under /rip/ and no
built page contains `videoseries`. The catalogue is written by scripts/sync-youtube.mjs, which needs
`YT_API_KEY` (see .env.example and the nightly workflow), so "no API keys" is also false. The three playlist
ids are still correct facts about the channel.

## Layout
```
public/        deployed static root (index, videos, playlists, assets/, data/)
assets-source/ the stylesheet source, the pack art originals and the palette
               preview, none of it deployed. The preview moved here from the
               deploy root on 16 August 2026: it is a 135KB decision aid that
               nothing links to, and it would have published itself the moment
               LIVE flips in shared/site.mjs.
scripts/       sync-youtube.mjs, local only, needs YT_API_KEY in the environment
shared/        taxonomy.mjs, the set/product tag rules, imported by both
```

**Why it is here.** scripts/ holds well over a hundred files, not one local script; shared/ holds dozens of
modules; the palette preview was deleted on 19 August 2026 (docs/brand.md says so); and `LIVE` has flipped.
The current layout is in CLAUDE.md.

## Deploy
Git repo, main branch, pushed to garbagerips585/garbagerips585.github.io.
`pages.yml` publishes public/ on every push. Going live is one flag: set LIVE
in shared/site.mjs and run build-all.mjs, which moves every canonical and the
sitemap onto the real domain and generates public/CNAME. Background and the
post-flip checks in DEPLOY.md; **the ordered thing to follow on the day is
LAUNCH-DAY.md**, which is the DNS, the flip and the GitHub settings as one
sequence with a proof after every step. `python3 scripts/rehearse-flip.py`
rehearses the whole flip from `git archive HEAD` in a scratch tree and must exit
0 before the day.

**Why it is here.** The flip happened: `LIVE = true` in shared/site.mjs and the site answers on garbagerips.com.
"Going live is one flag" and "must exit 0 before the day" describe a day that has passed. The launch
documents moved to docs/history/LAUNCH.md and docs/history/LAUNCH-DAY.md. The `public/CNAME` paragraph that
followed this one is still true and lives in docs/nightly-and-deploy.md.

## Current state: the root-files paragraph

Also at root: favicon.ico / favicon-32.png / apple-touch-icon.png (all
cropped from Trubbish's face in logo-square.jpg), robots.txt, sitemap.xml.
assets/og-image.jpg is a 1200x630 crop of banner-trubbish.jpg, wired up as
og:image and twitter:image. Absolute URLs come from `shared/site.mjs`, which
switches on one flag: `LIVE` is still false, so every canonical, og:url and
sitemap entry points at garbagerips585.github.io. Flip `LIVE` and rebuild to
move the whole site onto the real domain in one step. Do not hand-edit URLs.

**Why it is here.** "`LIVE` is still false" stopped being true at launch. The corrected paragraph is at the end
of the moved text in docs/home-page.md.

## Sentences corrected in place on 11 November 2026

One sentence in each of these three passages was edited where it now lives, because leaving it would have told
a reader something false about the phone layout. Each passage is given here whole, as it was, then the sentence
that changed and the evidence:

### docs/pack-wrapper.md, The end card, third 'looks right and is wrong' bullet

- **A carousel slide can be visible and unreachable.** `offsetParent` only knows
  about `display:none`, so a slide off the right edge of the track passes a
  visibility test. Below 545px the home page hides every slide but the first, so
  there are exactly TWO playable tiles on the whole page. Advancing must both
  check visibility AND scroll the track, and the scroll comes strictly AFTER the
  mount so nothing sits between the click and the iframe.

**The sentence that changed:** "Below 545px the home page hides every slide but the first, so there are exactly TWO playable tiles on the whole page."

**Evidence:** scripts/build-proto.mjs note 3 after homeCss (11 November 2026): the three display:none rules were replaced by two swipe rows, so a phone shows more than two playable tiles.

### docs/home-page.md, 'WHAT THE HOME PAGE ACTUALLY DOES NOW', carousel bullet

- Bands other than Greatest Hits are a scroll-snap carousel with slide buttons,
  not grids. ON A PHONE that is one video at a time and the counter reads
  "1 / 5". On a desktop it is two or three at a time; see below.

**The sentence that changed:** "ON A PHONE that is one video at a time and the counter reads "1 / 5"."

**Evidence:** scripts/build-proto.mjs note 3: on a phone both shelves show two whole tiles and part of a third, and the pager (arrows and the 1 / 5 counter) is hidden.

### docs/home-page.md, 'THE ORDER IS THE DIAGNOSIS' paragraph, last sentence

  **THE ORDER IS THE DIAGNOSIS AND IT IS NOT THE ONE THE REPORT DESCRIBES.** It
  needs the trophy to have been played FIRST. Driven over CDP with real
  dispatched input at 390x844 DPR 3, 768x1024 DPR 2 and 1440x900 DPR 2, both
  motion modes, a fresh browser profile per run: HOF then another tile
  reproduces at ALL THREE widths, by pointer and by keyboard alike, and playing
  another tile WITHOUT having played the trophy never reproduces, nor does
  playing two non-trophy tiles, nor playing the trophy twice. It reads as a
  phone bug because a phone is the width where the trophy and the Latest slide
  are the ONLY two playable tiles on the page (the `max-width:544px` block hides
  the shelf and slides 1 to 4), so the second tap is almost forced.

**The sentence that changed:** "It reads as a phone bug because a phone is the width where the trophy and the Latest slide are the ONLY two playable tiles on the page (the `max-width:544px` block hides the shelf and slides 1 to 4), so the second tap is almost forced."

**Evidence:** scripts/build-proto.mjs note 3: the max-width:544px block no longer hides the shelf or slides 1 to 4.

