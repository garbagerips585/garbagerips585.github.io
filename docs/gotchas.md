# Gotchas

Covers reduced motion, font weights, and what the home page performance sweep found.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.


> **Note added in the restructure, 11 November 2026.** The first bullet below ("Shorts playlist embed") describes
> the `/embed/videoseries` playlist embeds the site used before it had a page per video. No built page contains
> `videoseries` today (`grep -rl videoseries public` returns nothing), so that bullet is history.

## Gotchas
- Shorts playlist embed plays in a normal player, not the Shorts UI.
- prefers-reduced-motion is honoured in three places and all three matter:
  a blanket rule kills every transition and animation, a specific rule stops
  the pack shake and tear so the video is simply revealed, and the tool cards
  only get their hover transform under `no-preference`. This entry used to
  name a ticker, a card tilt and a card flip, none of which exist any more.
  Check the page before writing a rule about it.
- Keep page weight low; images are pre-compressed in assets/.
- **A SINGLE `font-weight` IN NEW CSS CAN COST MORE THAN THE FEATURE IT STYLES.**
  The drops band's channel label was written `font:400 ... var(--mono)`. Every
  other Space Mono on the home page is 700, so that one declaration fetched a
  second weight file, 9.4KB and an extra request above the fold, against 1.3KB
  for the whole band's markup. Nothing looked wrong: the markup, the CSS and the
  render were all correct. It was found by diffing the REQUEST LOG against the
  same page with the band stripped out, which is the only place it appears.
  Check the weights already on a page before adding a declaration to it.
- **THE HOME PAGE HAS NO RUNTIME PROBLEM AND A REPORT OF ONE SHOULD BE MET WITH
  A MEASUREMENT FIRST.** Chased 16 August 2026 after "lags and loads slowly on
  desktop", swept at 1280x800, 1440x900 and 1920x1080 at DPR 1 and 2 in headless
  Chrome: Total Blocking Time 0ms at every width and every DPR, ZERO long tasks
  unthrottled, and scrolling the full page produced NOT ONE frame over 33.3ms in
  any run, worst frame 18.7ms. Under 4x CPU throttling there is exactly one long
  task, 60 to 70ms, and it starts at ~81ms, which is before first contentful
  paint: it is the initial parse and style pass, so it lands outside the TBT
  window and ahead of anything a reader can see. LOAD AND LAG ARE DIFFERENT
  COMPLAINTS and only the first reproduced. The weight was real: 807.7KB
  on-load, 84% of it pack art. Look at bytes before looking at JavaScript.
- The date sweep at the bottom of index.html was checked for layout work in a
  loop and does none: it reads no geometry at all, only `datetime` attributes.
  `hydrateSlides` in packplayer.js DID interleave a `getBoundingClientRect` with
  an `src` write, so each measurement after the first forced a re-layout. It
  reads every slide then writes every slide now. It cost 0ms either way at every
  width measured; it was separated because the pattern is a trap, not because it
  showed up.
