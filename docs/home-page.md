# The home page (the old "Current state" section)

Covers the band order, the drops band and its expiry, play-in-place, the phone rows, the trophy and the fold, and the three desktop and tablet layouts.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## Current state
Homepage order: nav, THIS WEEK'S DROPS, Greatest Hits (the Hall of Fame card,
then a carousel), Latest rips (carousel), Most wanted, Card Pokedex, Card guides
and tools, the 585 hometown band, footer. The ORDER is the same at every width;
the LAYOUT of the first two content bands is not, and the difference is
described under "The home page is two layouts" below.

> **THE PHONE ROWS, 11 NOVEMBER 2026 (added in the restructure). The two paragraphs after this note, "one video
> per section on mobile" and "IT IS A CSS CUT", are SUPERSEDED and kept as written for their measurements.**
> Below 545px both shelves are now a swipe row, two whole tiles and 26px of a third, and Latest rips is drawn
> directly under Greatest Hits by CSS `order` (the markup keeps the owner's 24 August 2026 running order). The
> pager stays hidden on a phone. `main:has(>.hof)` scopes the column layout to the home page, because six other
> pages take their `<head>` by slicing index.html. The replacement text is note 3 after `homeCss` in
> scripts/build-proto.mjs, copied here word for word from HEAD:

```text
3. THE PHONE ROWS, max-width:544px, 11 November 2026. THIS REPLACES "ONE
VIDEO PER BAND", WHICH IS KEPT BELOW AS 3-OLD BECAUSE ITS MEASUREMENTS ARE
STILL THE REASON THE MARKUP IS SHAPED THE WAY IT IS.

WHAT WAS WRONG. Measured at 390x844 on the page as it stood: "Latest rips"
began at y=2,645, on the fourth screen, and showed one tile; Greatest Hits
showed one of its six. Between them sat the about text, the stat tiles and
the Rochester band. A phone visitor mostly arrives from a video description
wanting the newest rips and the best pulls, and the first two screens held
one playable tile. The owner approved changing it.

WHAT IT IS NOW. Both shelves are a swipe row, two whole tiles and 26px of a
third, and Latest rips is drawn directly under Greatest Hits. "Latest rips"
is at y=1,427 at 390. The first two screens hold the trophy, two whole hits
and the top of two latest rips, with eight more a swipe away, where they
held the trophy alone.

THE ORDER IS CSS `order` AND NOT A MOVE IN index.html, ON PURPOSE. The owner set
the running order himself on 24 August 2026 (the comment above .about in
index.html quotes him) and nothing about 545px and up was asked to change.
So the markup keeps his order and the phone block lifts one band. The cost
is that a screen reader or a keyboard on a phone meets Latest rips after the
Rochester band, where the eye meets it third; the bands are independent of
one another, so the sequence still makes sense read either way. If the owner
wants the same order at every width, move the Latest <div class="wrap"> in
index.html up under .hof and delete the four order/flex lines in 3a.

NOTHING IN packplayer.js CHANGED, AND THAT IS THE DESIGN. The carousel
script measures the real track (hydrateSlides, syncCarousel), so the same
markup that shows 2.35 to 3.3 slides on a desktop shows 2.2 here: slides the
track shows are promoted on load, the rest when a swipe brings them within
one slide, and every promoted image keeps loading="lazy". The end card's
NEXT PACK walks the visible slides of its own band and scrolls the track
after it mounts, which is the desktop path. Driven over CDP at 390x844 with
real touch input, a fresh browser context per run: tapping Latest slide 2
rips the pack in its own skin and mounts the player in that tile; with
prefers-reduced-motion the tile goes straight to the video; NEXT PACK
advances 2 to 3 to 4 to 5 with the playing slide on screen each time, slides
4 and 5 arriving with their own pack art, and no control after the fifth;
the trophy hands off to the #1 hit. One iframe live throughout.

THE TILE IS 9:16 HERE AND SO IS ITS STAGE. A 2:3 stage centres a 9:16
player, which in a tile this narrow is a video about 107px wide. With both
boxes 9:16 the video is the tile's full 128px (136 less the player's
border) and the card is 437.3px tall before, during and after a rip. It is
the same size of video /videos.html plays on a phone, which is the
precedent, and it is small: if the owner wants a bigger one, the number is the
`/ 2` in .vcar-slide's flex-basis. At 1.5 the video is about 190px wide and
each row shows one whole tile and half of the next.

THE LCP DID NOT MOVE AND THE REASON IS IN THE REQUEST LOG. The LCP element
is still the trophy's pack image, found by the preload scanner and fetched
at fetchpriority high. Every row image is loading="lazy", so none of them
starts until first layout, and at 390x844 DPR 3 on Slow 4G with 4x CPU the
trophy's file finishes at about 2,500ms and the first row image starts at
about 2,550: they do not share the line. Median of 5, two rounds each,
alternating, same harness: 2,648 and 2,592ms before, 2,684 and 2,680
after. FCP moved by the same 40 to 60ms, so that is the larger first layout
and not the images. CLS 0 on load and 0 across the rip.

WHAT IT COSTS. On load the phone fetches six 400w pack tiles (37 to 43KB of
AVIF each) where it fetched one 810w file (110KB): 141KB more over the
wire, all of it after the LCP image. The page is 236px taller (7,939 to
8,175 at 390).

THE PAGER STAYS HIDDEN ON A PHONE. A touch screen has the swipe, the cut
third tile says there is more, and the arrows and the "1 / 5" would cost
each row 56px. The arrows also assume a 16px gap when they step; the phone
rows use 12, which only matters to a control that is not shown.
```

**AND SINCE 18 August 2026 THE NUMBER OF TILES IS NOT THE SAME AT EVERY WIDTH
EITHER, BELOW 545px.** The owner: "only update to the home page on mobile is to only
show 1 video for each section, so show the Hall of fame video, but no other
greatest hits videos, then show the latest rip video but no other videos on home
page for now." So on a phone Greatest Hits is the trophy alone, its whole shelf
carousel hidden, and Latest rips is slide 0 alone. Both headings and both "see
all" links stay, because they are now the only way onward, and the counts in
them are untouched: "All 10 hits" and "All 316" count the DESTINATION pages, not
the tiles on screen. Three `display:none` rules in a `max-width:544px` block at
the end of `homeCss` in build-proto.mjs, layout only, no colour. Above 544 the
page is byte-identical: index.html's whole diff is that media query.

IT IS A CSS CUT AND THE USUAL OBJECTION TO ONE WAS TESTED RATHER THAN ASSUMED.
Hidden tiles normally still download their artwork, which would make this the
opposite of a mobile saving. None of these do: the Latest band's slides 1 to 4
were already deferred behind `data-packsrc`, and the Greatest Hits shelf's slide
0, which does carry a real `src`, is held back by its own `loading="lazy"`,
because a lazy image inside `display:none` never enters the viewport. **That is
the whole mechanism and it is one attribute deep**, so re-read the request log
if heroTile's `loading` ever changes. Measured at 390x844 DPR 2, gzipped, cache
off, filenames read off the network: 345.5 -> 389.9KB on load and 814.3 ->
717.3KB fully scrolled, 16 image requests to 15, page 7,638 -> 6,834px. The
on-load number goes UP and that is the reflow, not a regression: the page is
804px shorter, so Most wanted's six card scans (142KB) now fall inside Chrome's
lazy window at load instead of on the way down, while the 97KB pack that used to
be there has gone. Quote the pair or quote neither.

**This section described a different page until 14 August 2026 and was
believed.** It listed a ROC ticker, a Rochester skyline SVG, an "Anatomy of a
Rip" plate diagram, a socials-as-diner-menu band and a GMAX card that flipped
to a rainbow rare with a 3D tilt. None of them exist. The Gotchas below still
carried "the ticker and card tilt must stay disabled under
prefers-reduced-motion; card flip stays enabled", which is an instruction about
three elements that are not on the page. A QA agent driving the real page found
nothing to test and said so, which is the only reason it was caught.

If you change the home page, change this paragraph in the same commit. Stale
architecture notes are worse than none: they get quoted back as constraints.

WHAT THE HOME PAGE ACTUALLY DOES NOW, and what not to break:
- **THIS WEEK'S DROPS IS THE FIRST THING IN `<main>` AND IT CAN DELETE ITSELF.**
  Added 17 August 2026 on the owner's ask: "easy to just land on home page and see
  what upcoming pokemon drops to keep an eye out for this week". Three rows out
  of /drops.html's nine, generated into the `DROPS` region by build-proto.mjs
  from data/drops.json, linking through.

  **EACH ROW NOW CARRIES THE RETAILER'S OWN MARK, added later the same day on
  "can we add the store logos to these announcements instead of just the box
  that says pattern only".** THE ENTRY HERE SAID "it is text: no artwork, no
  extra request" AND THAT IS NO LONGER TRUE. It draws `brandMark` from
  shared/brands.mjs against the same mirrored Commons files /buying.html,
  /selling.html, /retailers.html and /drops.html's own retailer chip use, in a
  slightly shorter box (26px against 34px, capped at 96px wide). Nothing new was
  fetched and nothing is hotlinked.

  READ THE ASK THE WAY IT WAS MEANT: the row had the confidence chip INSTEAD of
  a logo, not as well as one, so THE CHIP STAYED. `Pattern only` is the weakest
  tier the site has, it exists because no retailer publishes a restock schedule,
  and a row wearing a retailer's mark reads as more official than the same row
  in plain text. The hedge is worth more beside a logo, not less. The band's
  source line also gained one sentence saying the logos are the retailers'
  trademarks and are there to name the shop; the existing "Not a retailer
  speaking" is untouched.

  WHAT IT COSTS, one harness, gzipped, cache off, the same tree with and without
  the marks, mark files read off the REQUEST LOG:

                          on-load           fully scrolled    band height
       390x844  DPR 2   354.0 -> 360.6KB    934.6 -> 941.1KB   550 -> 630px
       1440x900 DPR 1   439.8 -> 446.4KB   1798.0 -> 1804.6KB  265 -> 288px

  Three requests at every width, 5.3KB the set (pokemon-center.svg 2,878B,
  walmart.svg 2,174B, target.svg 401B over the wire), plus the document going
  15,632 to 16,929 bytes gzipped. So +6.6KB on load, 1.9% of a phone's, on a
  page that is still 84% pack art. The marks are `loading="lazy"` so they queue
  behind the artwork rather than in front of it.

  IT IS ABOVE GREATEST HITS AND THAT COST WAS MEASURED, NOT WAVED AT. **THE
  "802 of 844" THIS PARAGRAPH WATCHED IS GONE, because the band has been a
  COLLAPSED DISCLOSURE since then and was tightened again on 20 August 2026: it
  is 59.41px at 390 now, one summary row of 44 with 6px of padding either side
  and its 3px rule, and it puts the "Greatest Hits" heading at 127.41. The rows,
  the lede and the credit line all still exist, inside the closed body, so
  nothing this paragraph says must not be lost has been. The number that
  replaces 802 is the trophy banner's bottom edge and it is 700, not 844: see
  the trophy bullet below.** The band's own height is no longer the constraint,
  but a fourth row or a taller mark box still spends the OPEN state's height and
  the reasoning below stands. At 1440x900 the band
  is 288px, three columns, and Greatest Hits still shows three packs. The case
  for the position is that the Greatest Hits band alone is 1,656px tall on a
  phone, so anything under it is two screens down and nobody lands on the page
  and sees it. If a later editor decides the channel must own the whole first
  screen, move the two `DROPS` markers in index.html below the `.hof` section;
  do NOT instead shrink the band by cutting its lede or its credit line, which
  are the two things it must not lose.

  A RETAILER WITH NO MARK GETS THE HATCHED NAME TILE and that is the documented
  fallback, not a bug. It is also not proof there is no mark: `dollar-general`
  in data/drops.json had been drawing a name tile on /drops.html while
  `dollargeneral.svg` sat on disk, because shared/brands.mjs had no alias for
  the hyphen. One line in `ALIAS` fixed it and /drops.html gained its ninth
  mark, +2.2KB and one request on that page. CHECK data/brand-marks.json BEFORE
  BELIEVING A NAME TILE: the fallback cannot tell "no file" from "no alias".

  **THE EXPIRY IS THE WHOLE FEATURE AND IT IS SHARED, NOT COPIED.** A stale drop
  here is far worse than a stale drop on /drops.html, because "be ready for a
  possible drop today" above the fold on the front door is the loudest lie the
  site can tell. shared/drops.mjs owns the model and BOTH pages import it, so
  they cannot disagree about which rows are alive. Two layers, exactly as
  /drops.html has always had:
    - the BUILD drops rows whose `expires` has passed, on the later of the drops
      clock and the real build day (later can only ever expire more, never less)
    - a CLIENT sweep re-runs it on the reader's own clock, so a deploy that has
      stopped moving still tells the truth
  The band is STRICTER than /drops.html in one way: past `weekEnds` it removes
  itself entirely rather than showing a staleness banner. That page is the
  record and last week's list is worth reading there; a pointer to what to watch
  for THIS week has nothing to point at. If the sweep takes the last row the
  band also removes itself, so it can never sit there as an empty frame.

  Driven with the page's clock faked, on the page as built 17 August: 3 rows on
  the 17th, 2 on the 18th, 1 on the 20th and the 23rd, and NO BAND at all on the
  24th and the 31st, with `.hof` first in `<main>` again. /drops.html on the same
  dates still bands the week and turns its h1 past tense, unchanged.

  THE ROWS ARE PICKED BY RULE AND NOTHING IS EVER TRUNCATED (`homeBandRows`).
  A row goes in whole or not at all, because the hedge is usually the END of the
  sentence: "the trackers expect Tuesday around 3am Eastern based on recent
  patterns, WHICH IS A GUESS RATHER THAN A TIME". Shortening that to fit reads
  as tidying up and is how this band would start lying. So a row too long for a
  compact card is left off and stays on /drops.html with its notes, and
  build-proto.mjs SAYS SO in its output when it drops one. One row per retailer,
  at most two perishable rows so the band cannot empty itself mid-week, soonest
  first. The confidence word comes from `CONF_LABEL` in shared/drops.mjs, shared
  with /drops.html so "Pattern only" cannot quietly become "Expected" here.
- Every video band plays IN PLACE. Clicking a pack mounts the player over the
  tile, runs the rip animation and plays there. It does not navigate. This was
  an explicit request and it is easy to undo by accident, because the tile is
  still an `<a>` to the rip page and the handler is what stops it.
- Each tile's rip animation uses THAT VIDEO'S OWN pack art, not the generic
  wrapper. `packSet` in build-proto.mjs picks it.
- Bands other than Greatest Hits are a scroll-snap carousel with slide buttons,
  not grids. [CORRECTED 11 November 2026: on a phone it was one video at a time with a "1 / 5" counter until that day. It is now a swipe row of two whole tiles and part of a third, and the pager is hidden on a phone; see "The phone rows" above.] On a desktop it is two or three at a time; see below.
- A slide the track is not showing has NO pack art in its `<img>` yet. See
  "loading=lazy is a vertical heuristic" under Card images. If you change the
  carousel markup, keep slide 0's real `src` and keep the data- attributes on
  the rest, or the home page quietly goes back to 800KB on a phone.
- The Hall of Fame card keeps its text when the player mounts: the handler
  swaps only the art box, because replacing the whole card lost the title, the
  set and the view count.

  **AND THE TEARDOWN HALF OF THAT WAS BROKEN FROM THE DAY IT WAS WRITTEN, FIXED
  22 AUGUST 2026.** The owner: "if you click and watch any of the videos other than
  the hall of fame video then the hall of fame video disappears and you cant see
  it anymore". The `.hofx` branch of `playInTile` builds the playing state by
  MOVING the anchor's children into a new `<div class="hofx is-playing">` shell
  (`while (a.firstChild) shell.appendChild(a.firstChild)`), so **the original
  `<a class="hofx">` is empty from that moment on**, and its teardown put that
  empty anchor back. The single-live-embed registry (`open`/`live` at the foot
  of packplayer.js) fires that teardown the instant ANY other tile mounts a
  player, so the trophy came back as a blank stub: 304.2x660.3 to 304.2x44 at
  390, 3 children to 0, 113 characters of text to 0, and the whole Greatest Hits
  band 788.3px to 172. Tapping the stub then NAVIGATED, because an empty anchor
  contains neither an `<img>` nor a `.pack` and `onDocClick`'s artwork test
  rejects it, so the play-in-place handler declined the click it was written for.

  **THE ORDER IS THE DIAGNOSIS AND IT IS NOT THE ONE THE REPORT DESCRIBES.** It
  needs the trophy to have been played FIRST. Driven over CDP with real
  dispatched input at 390x844 DPR 3, 768x1024 DPR 2 and 1440x900 DPR 2, both
  motion modes, a fresh browser profile per run: HOF then another tile
  reproduces at ALL THREE widths, by pointer and by keyboard alike, and playing
  another tile WITHOUT having played the trophy never reproduces, nor does
  playing two non-trophy tiles, nor playing the trophy twice. [CORRECTED 11 November 2026: when this was written, 22 August 2026, it read as a phone bug because the trophy and the Latest slide were the only two playable tiles on a phone (the `max-width:544px` block hid the shelf and slides 1 to 4), so the second tap was almost forced. Since the phone rows of 11 November 2026 a phone shows more tiles than that; the bug and its fix are unchanged.]

  The fix is in the teardown, not in the shell: put `artBox` back over the
  stage, move the children home, then swap. Same nodes throughout, so the LCP
  image is neither refetched nor relaid out and the card is replayable
  afterwards. Verified after: every band box, all 21 rip-tile boxes, their text
  and `body.scrollHeight` are IDENTICAL before and after four plays plus a
  `GRPack.closeAll()`, at all three widths, and **CLS is 0.0000 on load and
  0.0000 after the interaction** at every one. packplayer.js is 11,110 to 11,231
  bytes gzipped, +121, and it is on 345 pages, so **stage those pages with the
  asset**: the `?v=` stamp moves on all of them.

  **THE HARNESS LIED TWICE BEFORE IT TOLD THE TRUTH, and both are reusable.**
  A naive `querySelectorAll(...)[0]` picks a tile inside the hidden shelf at 390
  and the click lands on nothing, which reads exactly like "no bug at this
  width"; filter to a VISIBLE box that actually contains artwork. And Chrome
  reuses a `--user-data-dir`, so a profile left over from the before-run served
  the OLD asset from cache at the SAME `?v=` url and half the after-run
  "failed". Use a unique profile per run, disable the cache, and assert which
  build is live by fetching the script from inside the page.
- **ONE CONTROL ON EVERY VIDEO ARTWORK ON THE SITE, AND IT IS THE RIP PAGE'S
  OWN BANNER -- EXCEPT ON THE RIP PAGE RAILS, WHERE A DISC SURVIVED THE CHANGE
  AND THIS FILE DID NOT KNOW IT.** This entry read "every pack, everywhere" until
  21 August 2026. **Re-counted on the built tree 22 August 2026: 300 of the 319
  rip pages carry 2,878 `.vid-play` discs**, emitted by `scripts/build-pages.mjs`
  (two call sites, lines 1627 and 1662), on the "More from &lt;box&gt;" and
  "More &lt;set&gt;" rail tiles. The count on 21 August was 288 pages / 2,588
  discs; the tree grew, so re-count before quoting it. Those tiles are real
  `pack pack--tile pack--img` wrappers with a play disc laid over them and no
  `.pack-hint` at all. The class is
  `.vid-play`, not `.play`, which is why "`<span class="play">` is GONE from the
  tree" below is literally true and still leaves the disc on the site: an audit
  that greps for the old name finds nothing and reports success.

  **THE CONTRAST FIGURE THIS ENTRY USED TO CARRY WAS THE WHITE DISC'S AND IT DOES
  NOT DESCRIBE `.vid-play`. RE-MEASURED 22 AUGUST 2026.** It said "1.00:1 at its
  worst point, up to 48% of its perimeter under 3:1 ... the same white disc". It
  is not the same disc and it is not white: since Trubbish Deep it is
  `--ketchup #E87EA1` inside a **3px `--paper-2 #2F4F39` ring**. Measured off
  RENDERED PIXELS (screenshot, sampled 2.5px outside the rim, on the rim, and in
  the fill, every 6 degrees, 54 discs whole-in-frame across the four rip pages
  below, 1440x900 DPR 1 and 390x844 DPR 2):

  | boundary | worst point | perimeter under 3:1 |
  |---|---|---|
  | outer edge: the `--paper-2` ring against the pack art | **1.00:1** | **88-97%** |
  | disc body `--ketchup` against the pack art | 1.00:1 | 55-73% |
  | **fill against its OWN ring, i.e. the disc's internal edge** | **3.45:1** | 0% |

  So the perimeter number is 88-97%, not "up to 48%" -- roughly twice as bad as
  recorded, because the pink matches the pink-heavy pack art nearly all the way
  round where the white disc only collided at one point.

  **AND THE THIRD ROW IS WHY "1.00:1" ALONE OVERSTATES IT, WHICH IS THE HALF
  BOTH EARLIER READINGS MISSED.** The disc is not a flat blob that vanishes: it
  carries its own two-tone edge at **3.45:1** the whole way round, with the glyph
  at **6.16:1** inside it. `--ketchup` and `--paper-2` are each declared exactly
  once, at `:root`; no skin overrides either, and skins only set `--pk-*` on the
  artwork. So that 3.45:1 self-contained edge is CONSTANT on every skin and does
  not depend on what is behind it. The disc reads as a disc even where its outer
  edge disappears into the art.

  **AND IT IS DECORATIVE, so nothing is lost to a screen reader.** It is
  `aria-hidden="true"` with `pointer-events:none`; the real control is the
  enclosing `<a class="vid-shell">`, which carries a full `aria-label`, and a
  visible `<h3 class="vid-title">` link plus a date sit directly beneath the
  tile. What is actually wrong is narrower than the old figure implied: an
  AFFORDANCE INCONSISTENCY. Every other pack on the site says CLICK TO RIP THE
  PACK at 3.82:1 and these 2,878 say it with a disc instead. **The fix, if it is
  taken, is `.pack-hint` at those two call sites in build-pages.mjs** -- that
  file's owner's call, and not a launch blocker, because no reader loses anything
  here they cannot get from the title link one line below. What is NOT open is
  quoting "up to 48%": that number was never about this disc.

  Everywhere else, since 19 August 2026, every pack carries
  `.pack-hint` reading CLICK TO RIP THE PACK across the foot of the artwork:
  the carousel slide, the Hall of Fame trophy, the 22 playlist pages, and
  /videos.html both server-rendered AND client-rendered, as well as the rip page
  it came from. SIX EMITTERS, NOT SEVEN, since 19 August: build-proto.mjs's
  tile() was on the list, returned the `<article class="v">` grid tile, and had
  no callers anywhere in the repo. It was edited in step with this change
  because the list said to, and its date chip was even moved to clear a banner
  it could never have collided with. Deleted. An emitter list is a maintenance
  contract, so an entry that renders nothing costs more than a missing one. The owner: "I do like the 'Click To Open Pack' banner on
  the video pages themselves, can we carry that accross to the home page, and
  remove the 'Rip it open' ctas all together not needed just that one banner
  acorss the bottom". The markup is `RIP_BANNER` in shared/format.mjs, imported
  by both builders; public/assets/app.js cannot import and restates it with a
  comment saying so. `<span class="play">`, the white disc, and `.hero-cta`,
  the "Rip it open ->" pill under every carousel slide, are both GONE from the
  tree. Do not reintroduce either: **that WHITE disc** measured 1.00:1 at its
  worst point against the nineteen wrappers with up to 48% of its perimeter
  under 3:1 -- a figure that describes `<span class="play">` and nothing else,
  so do not carry it over to the surviving pink `.vid-play`, which measures
  1.00:1 at 88-97% of its perimeter and has its own 3.45:1 internal edge; see
  the re-measurement above --
  while the banner floors at 3.82:1 on every skin because it is opaque and
  carries a near-white ring outside a near-black keyline, which are 14.6x apart
  in luminance so one of them always reads. `.hofx-cta`, "Watch the pull ->",
  is a DIFFERENT control and stays: it is about the card that came out, not
  about the pack.
- The trophy's duration chip and its banner both sit INSIDE `.hofx-art`, so
  playInTile takes them away with the artwork they describe. THE FOLD IS WHAT
  THE BANNER COSTS AND IT WAS MEASURED RATHER THAN WAVED AT, because the disc
  sat at the CENTRE of the artwork and the banner sits at its foot.

  **THE WHOLE BAR IS ABOVE THE FOLD ON A PHONE SINCE 20 August 2026, AND THE
  NUMBER TO BEAT IS 700 RATHER THAN 844.** The owner, on his own phone: "lets also
  make it so when you land on the home page you can see the entire hall of fame
  video on the screen, and see the click to rip open the pack banner and watch
  the video right when you land on home page above the fold no scrolling, we can
  make the video smaller so its fits and tighten up everything else." Safari's
  own chrome takes 100 to 140px of an iPhone's 844, so clearing 844 in a
  headless viewport is not clearing the fold on the phone he is holding. Bottom
  edge of `.pack-hint` on the trophy, read with getBoundingClientRect, before ->
  after:

        320x800    752.89 ->  608.58        414x896    903.00 ->  716.34
        360x800    807.00 ->  641.48        430x932    832.00 ->  656.48
        375x812    833.66 ->  662.28        500x900    937.00 ->  738.00
        390x844    860.33 ->  683.28        544x900   1003.00 ->  789.47
        820x1180   991.00 ->  991.00       1440x900    944.98 ->  944.98

  **81.59 OF THE 177.05px AT 390 CAME OFF THE CHROME BEFORE A PIXEL CAME OFF THE
  PACK**, which is the order that matters: 16 from main's padding-top, 31.59
  from the drops band, 16 from `.hof`'s padding-top, 18 from the run between the
  Greatest Hits heading and the artwork, and only then 95.45 from the pack
  itself, which goes 318.0x565.3 to 264.2x469.9. Every rule is inside
  `max-width:544`, so 820 and 1440 are identical to the pixel and to the byte.
  The full breakdown, the wire figures and the contrast re-read are in note 4 at
  the end of `homeCss` in build-proto.mjs and in the `max-width:544` block under
  `.hofx` in ui.css.

  **THE PACK IS NOW SMALLER THAN THE LATEST RIPS SLIDE UNDER IT** (264x470
  against 332x498, 31% less area), which is the comparison the `min-width:425`
  block in ui.css uses as its test. Rank is carried by the gold frame, the
  ribbon and first position instead, which is the same resolution the desktop
  layout reached when all three packs went to one width. **THE OTHER LEVER WAS
  THE BAND ORDER AND IT WAS DELIBERATELY NOT TAKEN.** Moving the two DROPS
  markers below `.hof` pays the band's whole 59.41px AND would leave the pack
  near 307 wide, but the owner asked for that band above the fold on 17 August in as
  many words, so it is a trade for him rather than for a stylesheet. If he wants
  the bigger pack, that swap is two markers and one paragraph.

  On the two wider screens the DURATION CHIP is still the mark that says "this
  is a video" above the fold, which is the job it was added for on 16 August
  2026.
- EVERY RELATIVE DATE ON THE PAGE IS RECOMPUTED IN THE BROWSER. `ago()` in
  build-proto.mjs runs on the build clock and its answer is then frozen into a
  static file, so a deploy that stops moving turns "TODAY" into a lie in the
  largest type above the fold. The nine `<time class="ago" datetime="...">`
  stamps carry the machine-readable date and an inline script at the bottom of
  index.html redoes the sum on read, using `data-built` on each `.vcar` as a
  floor so a reader whose clock is behind the build only ever sees what the
  server already rendered. Same idea as the date sweep in build-shows.mjs. The
  server render stays correct on its own, so the page is complete with JS off.
  The script lives outside every `NAME:START` marker, which is the only reason
  build-proto.mjs does not overwrite it.
- The newest rip wears a LABEL, not a timestamp: "Today's Rip", "Yesterday's
  Rip", or "Latest Rip" past that. The owner uploads daily so it reads "Today's Rip"
  almost every day, which is what he asked for, but it is derived from the
  video's own publish date and never hardcoded: the nightly has failed three
  nights running before now, and the video on show can be older than the page
  assumes. It used to read "Newest rip TODAY" over a tile saying 1 VIEW.

THE HOME PAGE IS TWO LAYOUTS, and the desktop one is younger than the phone
one. Until 16 August 2026 there was only the phone layout and a desktop got it
unchanged. Measured at 1440x900 that meant the first 3,307px of a 6,855px page
showed TWO videos: .hofx and every carousel card were capped at 520px and
centred inside a 1,392px .wrap while the slide itself ran the full width, so
three consecutive cards each left 872px of empty band either side and content
used 37% of the width. At 1920 it was 65%, because a fixed cap does not move.
The set grid and the tool grid below fill the same wrap completely, which is
why the top of the page read as a different site from the bottom.

The rules that fix it are the last block in `assets-source/ui.css` and they are
ALL `min-width`, so nothing a phone or a tablet renders changed. Three things:

- The carousels show 2.35 slides at 1000px, 2.75 at 1200 and 3.3 at 1400. The
  fractions are deliberate, so the next card is cut by the band's edge and the
  row reads as continuing. The count steps to hold the ARTWORK still: one fixed
  count across the range swings the pack from 359px to 478px wide.
- Greatest Hits becomes two columns at 1200: the trophy on the left, the rest
  of the hits beside it. That band was 2,105px tall to show one pack and one
  video and is now 1,109px at 1500 showing three. **SINCE 14 OCTOBER 2026 THE
  TWO COLUMNS START AT 700**, see "the gap below 1200" at the end of this
  section.
- Most wanted's tiles grow to fill their row instead of stopping at 168px.

THE TROPHY COLUMN IS NO LONGER "a fixed 460 to 520px" AND THIS BULLET SAID SO
UNTIL 17 August 2026. The owner: "home page layout on desktop is still wonky for the
first 3 videos". Those two picked numbers were the cause, because a SHARE is not
a SIZE: the trophy's artwork is its column less a 4px border and var(--s5)
padding, a slide's is half of what is left less a 1px border and var(--s4), and
no pair of fixed numbers makes those two agree. Measured at 1500 before the fix:

      trophy art 464px      slide art 408px      three sizes of pack
      trophy card ends 1435 slide cards end 1367 ragged bottoms, 68px
      trophy caption 1290   slide captions 1199  nothing on a line

The column is DERIVED now, in the ui.css block that owns it, from the boxes on
the way in, so all three packs are one width at every desktop width: 353.3px at
1280, 406.7 at 1440, 426.7 at 1500 and up. Bottoms and artwork tops line up to
0.0px at 1280, 1440, 1500, 1600 and 1920. The trophy gives up 37 to 51px of
artwork and every slide GAINS 25 to 27, so the smallest pack in the band grows
at every width, which is the test the old numbers were protecting. Rank is
carried by the gold frame, the ribbon and first position instead, and the
trophy's card is still the widest of the three.

IT COSTS BAND HEIGHT AND THAT WAS MEASURED, NOT WAVED AT: 968.6 to 999.3px at
1280, 1058.6 to 1079.3 at 1440, 1058.6 to 1109.3 at 1500 and up. The band buys
bigger artwork on two of its three cards with it.

ONE DOCUMENTED INVARIANT DID NOT SURVIVE, AND IT IS WRITTEN HERE RATHER THAN
LEFT TO BE REDISCOVERED. "The trophy is the LCP element at every width" is no
longer true above 1400: with the three images the same size the trophy's own
box rounds to 426.66x639.98 against the slides' 426.67x640.00, so a carousel
slide wins the LCP by FOUR SQUARE PIXELS. Nothing about the load changed and
that was checked rather than assumed: same `sizes`, same file picked off the
request log, fetchpriority still on the trophy alone, both LCP entries fire in
the same millisecond, and median LCP over 5 runs each is 176 to 200ms at 1280,
184 to 192 at 1500 and 208 to 200 at 1920 (before to after), with on-load weight
656.6 to 657.0KB. If somebody "fixes" this by making the trophy's artwork bigger
again they will have undone the whole change to win a rounding error.

Do not "simplify" those fractional counts to whole numbers and do not reinstate
a single centred card, which is what the two long comments above them are
arguing about. Both of those comments are still correct and still about the
PHONE: one column sized to the video is right when the slide is the whole
track. The desktop fix is not a wider card, it is more of them.

THERE IS A THIRD LAYOUT AND IT IS THE GAP THE OTHER TWO LEFT, 545px to 999px.
The desktop rules are all `min-width:1000`, which is what makes them safe, and
is also why everything below 1000 kept the phone layout at tablet size. Fixed
16 August 2026, in the `<style>` block generated by `build-proto.mjs` rather
than in ui.css, because `.vcar` and `.hofx` exist on this page and no other and
ui.css was being rewritten by another pass at the time. FOLD IT INTO UI.CSS'S
HOME PAGE BLOCK when that settles; the breakpoints and the argument are already
written to match. Measured, one slide of the Latest band:

                       BEFORE                        AFTER
      width   slide   card   art   art/slide     card   art   art/slide
        768     720    720   360      50%         520   440      61%
        899     851    851   360      42%         520   440      52%
        900     852    520   440      52%         349   315      90%
        999     951    520   440      46%         391   357      91%
       1000     391    391   357      91%       unchanged

- 545 to 899 was ui.css's own documented failure, still on the page: "a 360px
  pack marooned in a 720px card with 180px of white either side". Its answer,
  the `min-width:900` rule, caps the card at 520 and the art at 440, and now
  runs from 545, which is where the wrap first exceeds that cap. The caption
  used to be left aligned to an 851px card while the pack was centred in it, so
  at 768 the title started 180px left of the thing it named. Costs 288px of
  page height at 768 and buys 22% more artwork.
- 900 to 999 gets the multi-slide layout instead, at 2.35 slides, the same
  fraction as at 1000. 2.35 IS CHOSEN SO 999 AND 1000 ARE THE SAME PICTURE:
  artwork lands on 357px at 999 and the min-width:1000 rule computes 357px at
  1000, so the old 440 -> 357 cliff at that boundary is gone. Page height at
  900x900 went 7,628 to 7,339.

Nothing outside 545..999 moves. 390, 414, 500, 544, 1000, 1200, 1280, 1440 and
1920 were re-measured after and are identical to the pixel.

THE GAP BELOW 1200, FIXED 14 OCTOBER 2026 (QA pass). Under 1200 the trophy was a
520px card pinned left (`margin-inline:0 auto`, 641-1199) and the band's right
side was EMPTY: an 885px tall void of 224px at 768, 456 at 1024, 655 at 1199.
Now, in ui.css's Greatest Hits block (min-width:700) and nowhere else:
- 641-699 keeps the stacked, left-pinned trophy (the old rule, narrowed).
- 700-822: trophy beside ONE shelf slide, column derived so both packs are one
  width (`2L = W - s6 - 2*s4 + 2*s5 + 6px`), the pager pages to the rest.
- 823-1199: the trophy column stops at `--hof-cap` (the 1200 formula at its own
  floor, 382.67px) and slides stop at the matching card width, so the right
  column shows 1.17 slides at 900, 1.44 at 1000, 2.00 at 1199, and at 1200 it
  IS the three-pack layout: no step at the boundary.
- Pack image width: 220px at 700, 247 at 768, 272.6 from 823 to 1200 (the old
  stacked trophy was 398, a 390 phone's is 260). Bottoms and artwork tops equal
  to 0.0px at 700, 768, 822, 823, 900, 999, 1000, 1024, 1199, 1200; 1280, 1440
  and 1920 unchanged to the pixel; phone (<545) untouched.
- homeCss: the 900-999 `.hof .vcar-slide{...2}` line is gone, and the Latest
  band at 641-899 now has a slide of `min(520px, track - 48px)` with snap at
  start, so the next card peeks into what was 200px of empty band (184px of it
  at 768) and the pager is held to the card's 520px so it centres under it.

The banner art is the header, not a mid-page strip. Do not overlay copy on
it: Trubbish sits dead centre in the source image, so any scrim wide enough
to make text legible washes him out, and any panel large enough hides him.
The copy goes underneath.

[CORRECTED 11 November 2026, the original paragraph is in docs/history/claude-md-headstones.md.] Also at root:
favicon.ico / favicon-32.png / apple-touch-icon.png (all cropped from Trubbish's face in logo-square.jpg),
robots.txt, sitemap.xml. assets/og-image.jpg is a 1200x630 crop of banner-trubbish.jpg, wired up as og:image and
twitter:image. Absolute URLs come from `shared/site.mjs`. `LIVE` is `true` there now, so every canonical, og:url
and sitemap entry points at garbagerips.com (public/CNAME holds the same name). Do not hand-edit URLs.

## Added 11 November 2026 (written in the restructure, from the code at HEAD)

- **The phone rows.** See the note near the top of this file and note 3 after `homeCss` in
  scripts/build-proto.mjs. `PHONE_ROW_SIZES` in that builder is the `sizes` clause that goes with them
  (a DPR 3 phone at 390 takes the 400w tile); change the row's `/ 2` and that clause together.
- **The tile and its stage are both 9:16 on a phone.** Change one of the two, change the other.
