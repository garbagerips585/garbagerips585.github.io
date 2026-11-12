# Card images

Covers `sizes` and srcset at DPR 3, the image hosts and their real widths, AVIF, lazy loading, pack art renditions, dead scans, and image credits.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## Card images (measured, and two things here are counterintuitive)

**EVERY `sizes` ON THIS SITE WAS CHECKED AT DPR 2 AND SHIPPED AT DPR 3, AND
THAT IS THE ONE SENTENCE TO TAKE OUT OF THIS SECTION.** Fixed 21 August 2026.
`sizes` declares the CSS BOX, so the browser asks for box x DPR and picks the
first candidate that covers it. Every note below this line, and every builder
comment they came from, does its arithmetic at DPR 2 and stops. **The phone in
a restock line is DPR 3.** Nine separate placements were correct at DPR 1 and
DPR 2 and reached for the largest file on the ladder at DPR 3:

      page family              box    DPR2 pick     DPR3 pick before the fix
      /hall.html               120px  245w  ok      600w   79 scans
      set guides x41           88px   200w  ok      547x1000 JPEG  225 imgs
      /openings/ + 5 pages     88px   200w  ok      547x1000 JPEG
      /how-many-packs.html     88px   200w  ok      547x1000 JPEG   22 imgs
      /playlists/ x13          84px   200w  ok      547x1000 JPEG
      /what-to-buy.html        72px   150w  ok      547x1000 JPEG   23 imgs
      /msrp.html               64px   150w  ok      547x1000 JPEG   32 imgs
      /wanted.html             151px  310w  ok      600w   10 scans
      ETB price tables         48px   150w  ok      150w   the only safe one

**IT IS THE RUNG THAT DECIDES, NOT THE BOX, and reading the box is how the
64px row got filed as safe.** 64px is the SMALLEST box on the site that carries
a srcset, so it looks like the 48px tables that genuinely are safe. It is not:
48 x 3 = 144 and its rung is 150w, while 64 x 3 = 192 and its rung is also
150w. Check what the small candidate IS before deciding a box is fine.

**AND LOOK AT HOW LITTLE HEADROOM THE DPR 2 ROW HAS.** /hall.html declared
120px against a 245w candidate: 240 against 245, FIVE PIXELS. Any box wider
than 122px fires the same bug on the far more common DPR 2, and nothing in the
CSS looks wrong when it does. **Leave real headroom, and state the DPR you
checked at.**

**THE FIX ABOVE LEFT 2.47MB ON A DPR 3 PHONE, IN TWO PLACES, AND BOTH WERE THE
LADDER RATHER THAN THE DECLARATION.** Swept 21 August 2026, and the two causes
are worth keeping apart because only one of them looks like the bug above:

- **/msrp.html, 926.6KB, a MISSING RUNG.** `productSrcset()` had probed the CDN,
  written down that 150w, 200w and 400w are the three real widths, and then
  offered only TWO of them: the caller's own small rung and 400w. So a 150w
  caller got a ladder with a 2.67x step in it. A 64px box asks 192 at DPR 3,
  which is 42 past 150 and 8 SHORT of a file the CDN had all along, and all 32
  pins took _400w. **Every declaration on that page was correct**: `sizes` is
  64px, .ms-pic is 64px, and 400w genuinely is the smallest candidate ON THAT
  LADDER that covers 192. Re-probed before changing anything and 220, 240, 250,
  260, 270, 280, 300, 320, 350 and 360 are all still 403, so 150/200/400 is the
  whole ladder and it is offered whole now, from each caller's small rung up.
- **The twelve /openings/ pages, 1,604.6KB across 55 logos, a `sizes` THAT KNEW
  ABOUT ONE OF THE TWO BOXES.** `@media(max-width:560px)` drops the .op-sw plate
  from 116x42 to 88x34 so the row can go to two columns, and `setLogoTag` wrote
  its drawn width against the DESKTOP plate and then wrote it FLAT. A phone was
  told the logo is painted up to 1.32x wider than it is, on the density where
  that costs the most: 116 x 3 = 348 reaches the 955w, 892w, 806w and 483w
  masters where the real box wants 258 and the -sm.webp beside them is 318, 303,
  269 or 300. It is a media query in the stylesheet and a literal in the builder,
  which is the same shape as the eight-pixel gap above and just as invisible.

**87 PICKS MOVED AND EVERY ONE OF THEM IS AT DPR 3.** Zero at DPR 1, zero at
DPR 2, at 390 and at 1440, and /msrp.html is the only page that moves on a
desktop at all. Read off `currentSrc` at all three densities against two trees
served from two ports, 150 pages at 390 and 33 at 1440, the page list drawn from
a static scan of all 1,486 built HTML files (37,689 `<img>`, 228 distinct
class/ladder/sizes shapes) so the representatives are the whole surface and not
a guess. Bytes are the sum of the ACTUAL file sizes of the rungs taken:

                                DPR 1   DPR 2      DPR 3
      /msrp.html at 390          same    same    -926.6KB
      /msrp.html at 1440         same    same    -926.6KB
      /openings/ x12 at 390      same    same  -1,604.6KB
      /openings/ x12 at 1440     same    same       same

The markup cost is +234 bytes gzipped on /msrp.html and 124 to 195 on the
openings pages, and /what-to-buy.html pays 145 for a 200w candidate it never
takes below DPR 4. That is the price of offering the ladder whole rather than
per caller, and it is the same argument the 48px tables were already given.

**`naturalWidth` IS NOT THE RUNG AND A QA PASS BUILT A 958-IMAGE FINDING ON IT.**
With `w` descriptors the spec density-corrects it, so it hands back the `sizes`
value and every image on the site looks exactly the size it was declared to be.
Read `currentSrc`. Say which DPR.

**AND `getBoundingClientRect().width` IS NOT THE RUNG EITHER WHEN THE IMAGE IS
`object-fit:contain`.** The first pass over the openings logos flagged 39 of its
own fixes as under-serves, because it checked the chosen file against the 86px
LAYOUT box when contain draws most of those logos 51 to 79px wide inside it.
Re-checked against `min(boxW, boxH * w/h)` with the real pixel dimensions read
off disk: 222 reads at 390 and 1440 at DPR 1, 2 and 3, **zero under-serves**,
tightest headroom 1.042x (Pokemon GO, 154 device px wanted against 160 available)
against 1.023x on the desktop rows, which is pre-existing and untouched.

**IT IS A REAL PICTURE CHANGE AND SAYING SO IS THE POINT.** /msrp.html's pins
were being handed 400 pixels for a 192 pixel box, so the browser was
supersampling 2.08x and the result was CRISPER than a correctly sized image can
be. Screenshotted element-exact at 390 and 1440 at DPR 3, before against after:
PSNR 28.5 and 24.9 dB over two pins, mean absolute Laplacian 9.8 -> 5.2 and
14.1 -> 5.8. Nothing is blurred -- 200 real pixels cover a 192 pixel box -- but
a 64px thumbnail that used to be drawn from four times its own area now is not.
The precedent is /topps-card-values.html three entries down, which ACCEPTED an
11% short pick rather than put a megabyte back on a phone; this one is 4% long.

**TWO OF THE FOUR REPORTED OVER-PICKS WERE MEASURED AND ARE NOT FIXABLE, and
one of them would have made the page HEAVIER:**

- **/rarity.html's twelve 96px ladder cards are RIGHT to carry no `sizes`.** The
  report called this the worst and the simplest of the four. Every one of those
  twelve urls is ALSO the source of a 600px magnified crop in the same row, which
  is exactly what CROP_CARDS in build-rarity.mjs exists to protect, and it was
  checked from the DOM rather than from the markup: 12 of 12 shared, at DPR 1, 2
  and 3. Give them a 245w/600w ladder and DPR 1 and DPR 2 fetch the low file for
  the card AND the high file for the crop: **637.3KB and 12 requests becomes
  808.9KB and 24**, +171.6KB, and DPR 3 does not move at all because 96 x 3 = 288
  clears 245 anyway. Do not "fix" it.
- **/what-to-buy.html's 1.85x IS THE LADDER'S GRANULARITY, not a declaration
  bug.** .wtb-pic is 72px, which asks 216 at DPR 3, and 200w is 7.4% SHORT of
  that while the next real file is 400w. Nothing between them exists. The prize
  is real but it needs data this repo does not keep: those photographs are
  `object-fit:contain` in a SQUARE box, so a portrait one is drawn narrower than
  72 and 8 of the page's 13 would fit 200w on their DRAWN width, worth 337.2KB.
  **THE OBVIOUS SHORTCUT IS WRONG AND THIS IS THE NUMBER THAT KILLS IT:** the
  file's own line above says tcgplayer-cdn runs "200x268 to 200x417", so a blanket
  0.746 factor looks safe. Fetched all 315 product photographs the site uses and
  measured them: **162 of the 315 are square or LANDSCAPE**, up to 200x88, and
  contain draws every one of those at the full box width. A per-image `sizes`
  needs a per-product dims file and a sync to keep it true, the way
  logo-dims.json and cover-dims.json already are, and its failure mode is silent
  blur. That is its own change, not a rider on this one.

Measured with one harness at 390x844 DPR 3, Slow 4G with a 4x CPU slowdown,
over HTTP/2 against a local TLS server, cache off, medians of 3. "on load" is
network-quiet with no scroll; "last picture" is when the last image a reader
gets without scrolling has arrived. **QUOTE A ROW, NEVER A COLUMN.**

                              on load          fully scrolled     last picture
      /hall.html          473.6 -> 232.4KB   4,520 -> 1,564KB   4,574 -> 3,359ms
      /msrp.html          488.2 -> 254.9KB   3,837 -> 1,565KB   3,756 -> 3,017ms
      /openings/          982.5 -> 500.9KB   1,277 ->   642KB   7,087 -> 4,661ms
      /wanted.html        986.1 -> 778.4KB   1,005 ->   797KB   7,093 -> 5,956ms
      /what-to-buy.html   508.2 -> 339.7KB   1,803 ->   839KB   4,432 -> 3,016ms
      /how-many-packs     140.8 -> 140.7KB   2,701 -> 1,003KB   2,873 -> 2,881ms
      /sets/chaos-rising  355.7 -> 355.7KB   1,638 -> 1,126KB   3,961 -> 3,938ms
      /openings/etb.html  410.3 -> 333.7KB     617 ->   541KB   4,002 -> 3,996ms
      /playlists/<one>    326.8 -> 287.0KB     346 ->   306KB   3,540 -> 3,381ms
      /about.html         164.4 -> 162.5KB     183 ->   181KB   2,827 -> 2,827ms

**NOTHING MOVED AT DPR 1 OR DPR 2 AND THAT WAS MEASURED RATHER THAN REASONED.**
`currentSrc` was read off every image on nine pages at all three densities,
before and after, against the two trees served from two ports: **0 candidate
changes at DPR 1, 0 at DPR 2, 181 at DPR 3**, all of them the intended ones.
Read `currentSrc`, never the markup. Settling a srcset argument by reading the
HTML is how this shipped.

**THE FIX IS ONE FUNCTION, `productSrcset()` IN shared/format.mjs, BECAUSE
SEVEN BUILDERS EACH WROTE THIS SRCSET BY HAND AND ALL SEVEN WROTE THE SAME
BUG.** It probes out to the rungs TCGplayer's CDN really has (150w, 200w, 400w
are real files; 250w, 300w, 320w, 500w, 600w and 800w all 403) and tops the
ladder at `_400w.jpg`. It THROWS for a box over 133px, because 400w is the top
of that ladder and a wider placement needs a decision rather than a silent soft
picture. **`_in_1000x1000.jpg` is off every ladder and is not coming back:** it
fits the photo inside a 1000x1000 square, so its real width is 547, 673 or 642
depending on the product and no single `w` descriptor is right for all of them.
That descriptor said 1000w for years.

**TWO PAGES WERE MEASURED AND DELIBERATELY NOT "FIXED", and both would have
been made WORSE for a phone by the obvious change:**

- **/topps-card-values.html**, 2,175KB fully scrolled over 200 hotlinked
  PriceCharting scans (156 distinct; 44 appear on both hundreds and are cache
  hits). There is no oversizing here. `.tp-art` is 64x90 CSS px and those files
  are a fixed 240 HIGH, so they are 2.67x: exactly right at DPR 2 and 11% short
  at DPR 3. PriceCharting publishes 60, 120, 240, 320 and 1600 and nothing
  between, and **320.jpg is 62% heavier than 240.jpg** (112,534 against 69,385
  bytes over six real cards from the page). Making DPR 3 exact would put over a
  megabyte back on the phone to fix an 11% softness nobody has reported. The
  page is heavy because it holds 200 pictures, not because they are big. The one
  real win left is DPR 1 only, `120.jpg` at a 1.33x descriptor for a 65% cut on
  a desktop, and this file's own rule is that a desktop number is a footnote.
- The **footer badge, the eleven Garbage Plate photographs, the fonts, the
  shops map and Chase Match's hotlink** were all left alone on the standing
  arguments recorded elsewhere in this file. None was re-opened.

**AND ONE PAGE WAS FIXED THE OTHER WAY, BY MAKING A WIDTH THAT DID NOT EXIST.**
/wanted.html was NOT the `sizes` bug: its box is 151px, so it asks 453 device
pixels at DPR 3 and 600w genuinely was the correct pick out of 245/310/420/600.
The answer there was a rung, and `sync-card-thumbs.mjs` already mirrors that
family, so it now writes a 460w one as well. Measured over the ten cards
through that encoder: 460w is 707,522 bytes against TCGdex's 883,293 at 600w,
**-19.9% at 3.05 device pixels per CSS pixel rather than 3.97**, so it is not a
downgrade. **520w was the tidier-looking width and it is the one to reject: it
would also cover 414 and 430px phones and it saves 2.9%,** which is that
script's own "Pillow only wins by dropping pixels" finding arriving somewhere
new. 414 and 430px phones keep the 600w on purpose.

**packs.css IS RENDER BLOCKING AND TWELVE PAGES CARRIED IT WITH NO PACK ON
THEM**: /about.html, /garbage-plate.html, /hall.html, /shops.html,
/wanted.html, /sets/index.html and six set guides whose set has never been
ripped on camera. 1,888 bytes gzipped, and a whole extra blocking round trip in
the window where ui.css and the fonts are already competing. `dropUnusedPacksCSS`
in shared/chrome.mjs takes it off a FINISHED page and is a no-op on any page
that has anything for it to style. **CONFIRM FROM THE BUILT HTML, NOT FROM A
COVERAGE TOOL:** coverage reported packs.css at 0% on a page that plainly
renders pack art, because the art is a background on a class it never sampled.
Verified in the runtime DOM instead, at 390x844 DPR 3, after app.js ran and
after dispatching a real click on every `/rip/` link on the page (80 of them on
/hall.html): 0 of packs.css's 25 class names on any of the twelve, with
/videos.html, /playlists.html, a ripped set guide and the home page as positive
controls. **THE HOME PAGE IS THE CONTROL THAT MATTERS** and it only fires after
a click, so a test that cancels the click in the CAPTURE phase suppresses the
thing it is looking for: packplayer ignores an event whose default is already
prevented. Cancel in a bubble listener on `window` instead.

Card scans come from four hosts and they do NOT behave alike. `imgDims(url)` in
`shared/format.mjs` holds the intrinsic sizes, all measured by fetching the
files, and every builder calls it rather than declaring dimensions by hand. A
blanket rewrite that assumed everything was a TCGdex `low.webp` once made 173
images wrong, including 16 that had been right.

  assets.tcgdex.net      low 245x337, high 600x825
  images.pokemontcg.io   245x342, _hires 733x1024
  images.scrydex.com     small 245x342, large 733x1024
  tcgplayer-cdn          VARIABLE, 200x268 to 200x417, so NO width/height

**TCGdex serves four FORMATS at each of its two widths, and avif is 35%
smaller than webp for identical pixels.** Same path, different extension. This
is easy to miss because the two WIDTHS are genuinely all there is, and a pass
that checked for a third width correctly concluded there was none and stopped.
`avifPicture()` wraps an img in a `<picture>` with the avif source and leaves
the webp underneath as the fallback. There is no middle width at any host:
`medium.webp`, `mid.webp` and `600.webp` all 404, and Scrydex ignores `?w=`.

**THE COMPANION SUBSETS ARE PRICED AND THEIR SCANS ARE SELF-HOSTED, since 2
October 2026** (the owner: "yes price the shining fates, crown zenith and
celebrations subsets"). The Shiny Vault, Galarian Gallery and Classic Collection,
217 cards, are priced from the cached PriceCharting crawl into
`data/companion-prices.json` (`sync-pricecharting-cards.mjs --companions` writes
only that file; a plain local run of that script without the flag rewrites
`data/pricecharting-cards.json` from whatever cache is on this machine, so mind
the date). TCGdex has no scan for any of them and images.pokemontcg.io serves a
183KB PNG and a 1.2MB `_hires`, nothing between, which put 550KB of PNG in two
heroes. `python3 scripts/sync-subset-scans.py` (NOT in build-all, it fetches)
re-encodes the 192 that exist into `public/assets/subset/`: a 245w .webp + .avif
and a 600w .avif for the pop-up, 17.2MB on disk. The 600w is AVIF only on
purpose: both formats were 30MB, and a browser without AVIF falls back to the
remote PNG on a tap. `data/subset-scans.json` is the manifest the builder reads;
a base it does not hold keeps the remote url.

**`loading="lazy"` IS A VERTICAL HEURISTIC AND NOTHING ELSE.** Chrome measures
how far an image is from the viewport DOWN the page. A slide parked 407px to the
right inside a horizontal scroll track is, by that measure, right next to you,
so every slide in a carousel fetches its artwork at first paint whatever
`loading` says. On the home page that was 289.9KB of pack art for slides behind
the band's right-hand edge, on a band that was itself below the fold: measured
at 390x844 with DPR 3, gzipped, cache off, the page was 804.9KB with 681.6KB of
pack art, and one pack was on screen. This is invisible from the markup, which
looks correct.

The fix is in `heroTile` in build-proto.mjs and `hydrateSlides` in
packplayer.js: slide 0 keeps a real `src`, later slides carry theirs as
`data-packsrc`/`data-packsrcset`/`data-packsizes`, and the script promotes them
when the TRACK is about to show them, one slide of lead on a swipe or an arrow
and none on load. It measures the real track rather than repeating ui.css's
breakpoints, because the visible slide count is 1 / 2.35 / 2.75 / 3.3 by width
and the Hall of Fame band overrides all of it with exactly 2. `loading="lazy"`
stays on the promoted image, so the vertical half of the decision is still the
browser's; this only takes back the horizontal half. Phone went 804.9KB to
515.1KB, pack art 681.6KB to 391.7KB. Desktop is unchanged by design and
measured to be: 800.2KB to 800.3KB at 1280, because at 1280 and 1920 those
slides are genuinely on screen and the hydration lands before first contentful
paint (70ms against 84ms at 1280). A `<noscript>` copy, laid over the box by
ui.css, is what a reader with JS off gets.

**Do not add a 700w rendition.** That was measured with the files actually
generated: 560w and 700w together save 302KB at 1280 and 1920 at DPR 1, and
NOTHING at DPR 2 or 3, because 810w is already the smallest candidate that
satisfies a 464px box on a retina screen. 700w was picked in exactly one case, a
DPR 2 phone, and 560w ALONE buys the entire 1x desktop win.

**560w WAS ADDED 16 AUGUST 2026 and the paragraphs below are what it cost and
bought.** `MID` in build-packs.py, 19 files and 1.42MB on disk, a third `w`
candidate in `heroTile` and in the Hall of Fame frame in build-proto.mjs. The
existing 400w and 810w files are byte identical after the regeneration, so the
encoder is deterministic and a re-run is not churn.

**AND THE 1x DESKTOP WIN IS BIGGER THAN THAT ENTRY MAKES IT SOUND, measured on
the home page 16 August 2026: EVERY pack request on that page takes the 810w
file, at every width and every DPR, and not one ever lands on the 400w tile.**
Logged from the network, cache off: 3 packs at 390 (DPR 2 and 3), 5 at 1280,
1440 and 1920 (DPR 1 and 2), all of them the full file, 125 to 158KB against
the tile's 40 to 52KB. The phone is right to: 340px at DPR 2 needs 680. The
DPR 1 desktop is not, and the reason is `sizes`, not the renditions.
`heroTile` declares `(max-width:640px) 87vw, 440px` while the real box measures
328px at 1280, 373 to 378 at 1440 and 391 to 408 at 1920, so 440 is over
declared everywhere above 640 and 440 at DPR 1 always beats the 400w candidate.
The honest figure would pick the 400w tile at 1440, worth about 380KB of a
799KB load. `sizes` IS STILL 440px AND WAS DELIBERATELY LEFT THAT WAY: an
accurate one needs the 1000/1200/1400 slide-count breakpoints written a second
time in build-proto.mjs (see the "NO MEDIA QUERY IN HERE" note in `heroTile`,
which is about exactly this) and it goes silently soft the day ui.css's counts
move. 560w wins at all three desktop widths with no breakpoints at all, which is
what makes it the right fix rather than the cheap one.

**THE 560w RENDITION FIXED THE DPR 1 HALF OF THAT AND NOTHING ELSE, re-measured
the same day with one harness, gzipped, cache off, against `.claude/server.js`'s
tree served with gzip on text.** Every figure below is an on-load number with no
scroll, and the fully-scrolled pair is beside it because they answer different
questions:

                          on-load            fully scrolled     pack file
      1280 DPR 1     807.7 -> 506.2KB    2166.9 -> 1864.4KB     810 -> 560
      1440 DPR 1     807.7 -> 506.2KB    2165.9 -> 1864.4KB     810 -> 560
      1920 DPR 1     949.0 -> 647.6KB    2165.9 -> 1864.4KB     810 -> 560
      1280 DPR 2     807.7 -> 808.6KB    2165.9 -> 2166.8KB     810 -> 810
      1440 DPR 2     807.7 -> 808.6KB    2165.9 -> 2166.8KB     810 -> 810
      1920 DPR 2     949.0 -> 950.0KB    2165.9 -> 2166.8KB     810 -> 810
       390 DPR 2     517.7 -> 518.7KB      986.5 -> 987.5KB     810 -> 810
       390 DPR 3     517.7 -> 518.7KB      986.5 -> 987.5KB     810 -> 810

VERIFIED FROM THE NETWORK, NOT FROM THE MARKUP: the picked filename was read off
the request log at every row. The +0.9 to +1.0KB on the DPR 2 and phone rows is
the third srcset candidate in the gzipped HTML, which is the whole cost of the
change to a reader it cannot help. Nothing about the phone moved, by design and
by measurement.

**SO A RETINA DESKTOP IS UNCHANGED BY 560w, AND THAT IS THE HALF THAT ENTRY KEPT
UNDERSELLING.** A 402px box at DPR 2 asks for 804 device pixels and 810w is the
smallest candidate that satisfies it, so 560w left a MacBook at 1440 pulling the
same 681.6KB of pack art it always had. If somebody reports a slow desktop and is
on a retina screen, 560w is not their fix and pointing at the table above will
mislead them.

**THE FIX FOR THAT CASE IS AVIF AND IT WENT IN THE SAME DAY, 16 AUGUST 2026.**
build-packs.py writes every rendition TWICE, .webp and .avif, and the three
places that emit pack art put the AVIF in front: `heroTile` and the Hall of Fame
frame in build-proto.mjs both go through `avifPicture()`, and packs.css carries a
plain `url()` followed by an `image-set()` for the pack wrapper, which is a CSS
background and cannot be a `<picture>`. 57 new files, 3.9MB on disk, and the
browser fetches one format or the other, never both.

Unlike a width, a codec shrinks whichever candidate the browser had already
chosen, so this is the one lever that pays at EVERY DPR. Measured with one
harness, gzipped, cache off, on-load with no scroll beside fully scrolled, and
the picked filename read off the REQUEST LOG at every row:

                          on-load            fully scrolled     pack file
      1280 DPR 1     501.8 -> 430.8KB    1861.1 -> 1790.1KB     560 webp -> avif
      1440 DPR 1     501.8 -> 430.8KB    1861.1 -> 1790.1KB     560 webp -> avif
      1920 DPR 1     644.3 -> 573.3KB    1861.1 -> 1790.1KB     560 webp -> avif
      1280 DPR 2     804.3 -> 662.2KB    2163.6 -> 2021.5KB     810 webp -> avif
      1440 DPR 2     804.3 -> 662.2KB    2163.6 -> 2021.5KB     810 webp -> avif
      1920 DPR 2     946.8 -> 804.7KB    2163.6 -> 2021.5KB     810 webp -> avif
       390 DPR 2     519.1 -> 431.9KB    1277.8 -> 1135.8KB     810 webp -> avif
       390 DPR 3     514.4 -> 427.2KB    1272.5 -> 1130.5KB     810 webp -> avif

Pack art on-load: 681.6 -> 538.8KB retina, 391.7 -> 303.8KB phone, 379.1 ->
307.4KB at DPR 1. The `<picture>` markup cost is 183 bytes gzipped on the whole
home page, so it pays 390 times over on the cheapest row.

**THERE IS NO SHARPNESS TRADE HERE AND THAT WAS MEASURED RATHER THAN ASSERTED.**
AVIF q60 is both SMALLER AND CLOSER TO THE MASTER than WebP q78, PSNR against the
same LANCZOS-resized source over the opaque pixels only: paradox-rift 810w
150.6KB/33.03 dB -> 123.1KB/34.21 dB, default 129.6KB/33.41 dB -> 96.9KB/34.46
dB. Rendered at 1440 DPR 2 and diffed, before against after, the Hall of Fame
frame is 39.5 dB and the carousel slide 38.2 dB, and mean absolute Laplacian
(a crude sharpness proxy) went UP slightly on all three elements screenshotted.
Do not read that as headroom: q55 drops BELOW the WebP's fidelity, and the pack
art is commissioned brand artwork.

**THE TRAP THAT COST A CACHE HIT, and it only shows up with the cache ON.** A
background image cannot be a `<picture>`, so when the `<img>` tags moved to AVIF
the pack wrapper that `playInTile` mounts on click was still asking packs.css for
WebP. On the home page that turned a free cache hit into a 124KB download on
every click: the tile fetched pitch-black-...pack.avif, the click asked for
pitch-black-...pack.webp. Logged from the network before and after a real
dispatched click. The `image-set()` in packs.css is what closes it, written as a
SECOND declaration after the plain `url()` so that a browser too old to parse it
drops that line and keeps the WebP; inverting those two would leave an empty
table where the pack should be (it was "a flat #161D26 rectangle" until the
backdrop colour came out of packs.css on 5 October 2026, see The pack wrapper),
because `.pack-art::before` and `.pack-brand` are switched off in the same
block. `python3 scripts/build-packs.py --css-only` rewrites packs.css without
re-encoding any image.

**AND THE `<source>` ON A DEFERRED SLIDE HAS TO BE DEFERRED TOO.** A `<picture>`
whose `<source>` matches loads that source even when the `<img>` carries no src
at all, so a live `srcset` there would fetch every carousel slide at first paint
and put the phone back to 800KB in a new format, with the markup still looking
correct. `avifPicture(img, {defer:true})` writes the source's candidates under
the same `data-packsrcset`/`data-packsizes` names the img uses, and
`hydrateSlides` promotes the SOURCE FIRST, sizes before srcset, then the img.
Promoting the img first fails quietly: the source has no srcset yet, so the
browser resolves the img's WebP and commits to it. Verified from the request log:
3 pack files on load at 390 and 5 fully scrolled, all AVIF, none fetched twice.

The other lever named here was a lower WebP quality than 78. It is now moot for
anything that supports AVIF and was not done.

**/evolution.html GAINED 340 PICTURES AND THE COMMIT THAT DID IT CALLED THAT A
SAVING. IT IS NOT ONE.** 5b4e3028c says "the 1,025 species portraits gain a 96px
rendition, 3.98MB against 12.41MB, for /evolution.html's 340 line headings. That
page drew the 256px file 340 times." The library comparison is true. The
sentence built on it is false: before that commit the page carried ZERO species
images, and the commit ADDED 340. Measured at 390x844, cache off: 11 requests on
load before and after, because every one is lazy, and 351 requests fully
scrolled where there were 11. The page is 106,483px tall.

So the change is defensible and the framing was not. The right sentence is
already written in data/species-art.json's own readme, in the conditional: the
256px file "WOULD HAVE BEEN 4.4MB of one page". Choosing the 96px rendition
saved 4.4MB against a heavier version of the same new feature; it did not make
an existing page lighter. QUOTE THE PAIR OR QUOTE NEITHER, which this file says
five times elsewhere and which that commit did not do for the page it changed.

**A CSS background cannot be lazy.** rarity.html's magnified corners were
backgrounds, so all 13 full-size scans were fetched at first paint whether or
not anyone scrolled to that row.

**THE PACK TILES WENT THE SAME WAY ON 20 August 2026 AND TAUGHT TWO THINGS THIS
FILE HAD HALF RIGHT.** A grid tile's artwork is an `<img loading="lazy">` inside
the same facade now; packs.css takes the background off exactly those tiles with
a third class, `.pack--<set>.pack--tile.pack--img`, at (0,4,0) so it cannot lose
a specificity contest, and it is opt IN, so the facade app.js builds in the
browser and the one `playInTile` mounts on a click keep their backgrounds and
neither file had to change. /videos.html went 435.2 -> 231.7KB on load at 390
and /playlists.html 606.8 -> 408.5KB, fully scrolled unchanged.

**THE MEASUREMENT WINDOW IS THE TRAP AND IT ALMOST KILLED THE CHANGE.** An
off-screen background arrives SECONDS after the load event. A 2.5 second window
showed two of /videos.html's seven tile files and read exactly like a browser
that was already deferring the rest, which would have been a "measured and left
alone" for a win that was really there. Wait for the network to go quiet.

**AND `loading="lazy"` IN THE FIRST VIEWPORT IS NOT ALWAYS THE TIMING BUG THE
NOTE BELOW SAYS IT IS.** That note is right that the browser fetches such an
image immediately anyway and that the attribute costs the preload scanner. What
it does not say is that the preload scanner is sometimes the thing you want to
lose. Marking the four above-fold tiles eager moved ZERO bytes, to a tenth of a
kilobyte, on every page and both viewports, and cost 592ms of LCP on
/videos.html and 748ms of first paint on /playlists.html, measured Slow 4G with
a 4x CPU slowdown over HTTP/2, five runs, medians. An eager tile is discovered
during the HTML parse and spends the pipe the render-blocking stylesheet is
still waiting on; a lazy one the browser can see is fetched at LAYOUT, which is
after it, and is the same moment the background used to be fetched at. So the
rule is about what the image IS: the LCP element wants the scanner and a preload
of its own, a decorative thumbnail does not. Measure it over HTTP/2, because an
HTTP/1.1 preview has a six connection ceiling that flatters the wrong answer.

**THE RIP PAGES WERE MEASURED AND LEFT WITH NOTHING TO GAIN.** LAUNCH.md
promised 38.8KB on each of 317 of them. The rail tile sits 930px below the fold
at 390 and 396px at 1440, both inside Chrome's 1250px lazy threshold on a 4G
connection, so it is fetched whatever the attribute says, and 256 of the 288
pages with rails draw every tile in the hero's own set (it said "248 of the 279"
until 21 August 2026; the ratio held, the totals moved). That family moved by the
markup and nothing else. They are `<img loading="lazy">` now and the
page went 2,536KB to 388KB at 390px. If you move a background to an img,
re-screenshot: doing it here brought the scans into reach of a later rule at
equal specificity and turned eleven magnified corners into whole shrunken
cards, which looks almost right.

**THOSE TWO NUMBERS ARE ON-LOAD AND UNGZIPPED, AND THIS ENTRY DID NOT SAY SO
UNTIL 16 August 2026, by which point the 388 had been quoted back as a reason
not to look at the page.** Nothing regressed. Both figures are a cold load with
NO scroll, served by `.claude/server.js`, which sends no Content-Encoding. The
change was real and it is exactly what the entry claims: it moved 2.1MB off the
LOAD PATH. It did not remove a byte from the page, because a lazy image is
deferred, not cancelled.

Rebuilt from the commit that recorded them and re-measured with one harness,
390x844 DPR 2, cache off, so the four numbers are comparable:

                            on-load    fully scrolled, lazy forced
    at c58bf3ce, ungzipped    386.9KB    3,167.7KB
    at c58bf3ce, gzipped      219.7KB    3,000.6KB

So 388 reproduces to within a kilobyte, as an ON-LOAD UNGZIPPED number, and the
same page was already over 3MB to a reader who scrolled it. QUOTE THE PAIR OR
QUOTE NEITHER: they answer different questions and only the first is what a
reader waits for. Serve gzipped for any transfer figure, because the dev server
inflates HTML, CSS and JS three to five times and none of that is images.

**One card on that page was 1.1MB of the 3.1MB, and it was a PNG.** The Mega
Hyper Rare ladder row hotlinked `images.scrydex.com/pokemon/me5-120/large`,
1,100,908 bytes, drawn in a 96px box and a 132px corner crop. It was the only
image over 200KB on the whole site, checked across 167 pages. TCGdex has the
same card at `en/me/me05/120` and serves it as 26,529 bytes of AVIF, a 97.6%
cut, so `data/rarity.json` names the TCGdex url now and the page went 3,151KB
to 2,105KB fully scrolled. THE LESSON IS THE HOST, NOT THE CARD: every other
scan on that page is TCGdex and gets `avifPicture` and `imgDims` for free, and
one Scrydex url quietly opted out of both. Check the host before assuming a
heavy page needs a new pipeline.

**Some images do not exist and never will.** `data/no-scan.json` records the
TCGdex bases that 404 and 4 TCGplayer urls that 403. They all carried
`onerror="this.remove()"`, so nothing looked broken: the picture silently
vanished and the site paid for a dead round trip to find out. Builders skip
them up front instead. The file is safe to go stale in the only direction it
can.

**THAT ENTRY SAID 101 BASES "FOUND BY FETCHING ALL 4,655 IMAGE URLS THE SITE
EMITS" AND THE SECOND HALF WAS THE PROBLEM.** 4,655 was a list of pages
somebody had in front of them on 14 August 2026, not a rule, so it went stale
the moment the tree grew and nobody could tell. Re-swept from `public/` itself
on 18 August: 24,237 distinct card bases in the HTML, seven times that surface,
plus 6,326 more that appear only in the JSON under `public/data`. 528 of the
30,563 answer 404, so the 101 were 19% of it. The file holds 629 now.

`scripts/sweep-scans.mjs` IS THE SWEEP AND ITS INPUT IS THE BUILT TREE, which
is what stops it going stale again: `public/` IS what a reader gets. It is not
in build-all.mjs and must not be added to it, same arrangement and same reason
as sync-decks.mjs. `--recheck` re-tests what is on file; the default only ever
adds.

**AND NONE OF THEM WERE EVER IN THE HTML, which is worth knowing before anybody
goes looking for a broken `<img>` on a page.** A QA sweep reported 371 dead
scans "across 239 /pokemon/ pages". Substring-searched across all 1,480 built
HTML files: zero hits. Every one lives in `public/data/printings/*.json` and
`public/data/games/setquiz.json`, which the card search on /cards.html fetches
and turns into `<img onerror="this.remove()">` IN THE BROWSER. Real, and worse
than a server-rendered one because no build check can see it.

The cause was one level up: `sync-all-printings.mjs` proves an image path by
probing ONE CARD PER SET, which proves the set has scans and nothing about the
other four hundred cards in it. It applies `no-scan.json` per card now, in that
file rather than in a page builder, for the reason build-cards.mjs argues at
length: a page builder rewriting a sync's output is undone by the next sync.
629 cards dropped a base; the built tree emits zero dead ones, HTML and JSON.

**THE RIP PAGES WERE THE LAST FAMILY TAKING THE FULL SIZE SET LOGO,** 530
`<img>` across 268 of the 316, while /sets/, /openings/ and /playlists/ had all
moved to the `-sm.webp` months ago. This was an inconsistency, not a missing
asset: the small file was already on disk. Measured at 390x844 DPR 2 off the
request log, one page 383.0 -> 344.3KB, logo 52,472 -> 13,678 bytes, and 8.85MB
across the family. The same image was also above the fold at y=709 of 844 and
carried `loading="lazy"`, so it was oversized AND deferred; both are fixed in
`setLogoImg` in build-pages.mjs.

**AND THE OBVIOUS FIX MADE A RETINA DESKTOP WORSE BEFORE IT MADE IT BETTER.**
The page shows the SAME logo twice at two sizes, and giving each element its own
honest `sizes` made them resolve to DIFFERENT candidates at 1440x900 DPR 2: the
hero took the master and the heading took the -sm, so the page fetched BOTH,
66.2KB against the 52.5KB it paid when the second was a cache hit. Two
individually correct declarations, one regression. The smaller element declares
the LARGER one's box now, so it can only ever be handed a file already fetched.
Read both elements' `currentSrc` off the DOM before believing a `sizes` change
on a page that shows one picture twice.

**WHO'S THAT POKEMON WAS HOTLINKING raw.githubusercontent.com** for artwork the
site already hosts, 63% of that page's weight, re-fetched every round from a
rate-limited source host that is not a CDN. `/assets/species/lg/` is the same
475x475 pixels re-coded: 126.5MB of PNG becomes 19.5MB of WebP over the 1,025
species, #132 Ditto 129,274 -> 9,718 bytes. Page 421.3 -> 188.7KB median on
load, no request leaves the origin, and build-games.mjs now THROWS if any dex id
lacks an `lg` file, because a missing sprite is a round with no picture in it and
nothing errors.

**`loading="lazy"` IN THE FIRST VIEWPORT IS A TIMING BUG, NOT A WEIGHT ONE, and
that is why it kept getting written.** 22 images across 11 page families were
lazy and inside the first screen at 390x844. Removing the attribute moved page
weight by between -17 and +5 bytes, because a lazy image the browser can already
see is fetched immediately anyway; what it costs is the PRELOAD SCANNER, the one
chance the fetch had to start during the HTML parse instead of after layout. So
nothing here moved onto the load path and /rarity.html's 2.1MB is still off it.

THREE BUILDERS' COMMENTS WERE WRONG ABOUT THEIR OWN GEOMETRY and had been quoted
as reasons: build-pokemon.mjs said "on the narrowest phone only one is above the
fold" of a TWO COLUMN grid whose second row starts at y=822, build-eevee.mjs said
the same of its own two-column grid, and build-games.mjs said its first card sits
"about 250px down" when it is 460. MEASURE THE FOLD BY READING EACH IMG'S OWN
BORDER BOX AT SCROLL 0. Counting rows by eye is what produced all three.

**AN IMAGE THIS SITE DID NOT MAKE AND DOES NOT OWN NEEDS A VISIBLE CREDIT, AND
THE SHAPE IS SET.** Everything above this line is about card scans, pack art and
species portraits, none of which carry a per-image credit: the scans are
identified by the card they show and the artwork is commissioned or is the
publisher's. Two families are not like that. The retailer marks in
shared/brands.mjs are all PUBLIC DOMAIN on Commons and are credited in
data/brand-marks.json only, which is enough for a public-domain file. The eleven
photographs on /garbage-plate.html are CC BY, CC BY-SA and one public domain,
and an attribution license is granted ON CONDITION of naming the photographer
and LINKING the license, so a credit in a JSON file nobody reads does not meet
it. `photoFig` in build-garbage-plate.mjs is the pattern: a `<figure>` whose
`<figcaption>` reads "Photograph by NAME, LICENCE, via Wikimedia Commons", NAME
linking to the file and LICENCE linking to the deed, directly under the picture.
**Copy that shape rather than inventing a second one**, and read the license on
the file's OWN description page before publishing anything: a search result
claiming a license is not a license, and neither is a restaurant being pleased
about the picture.
