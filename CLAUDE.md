# Garbage Rips 585 — brand hub site

Content hub + SEO home for Garbage Rips 585, a Pokemon card pack-ripping
channel from Rochester, NY (owner: Tim). Not an ecommerce site — the job is
brand entity SEO and funneling visitors to the channel and socials.

## Brand
- Voice: fun, chaotic, zero gatekeeping. Rochester references everywhere:
  Garbage Plate, 585 area code, Flower City, High Falls, Public Market,
  Wegmans, lake-effect weather, Trubbish/Garbodor as unofficial city Pokemon.
- Palette (sampled from commissioned art): sludge bg #1E2419 / #2A331F,
  trubbish olive #616A4F / #7C8A5F, gold #F5A62B, navy #22384F,
  ketchup #D9482B, mustard #EFC94C, paper cream #F1EDD2.
- Fonts: Titan One (display), Outfit (body), Space Mono (labels/ticker).
- Copy style: no em dashes in written copy. Natural, human tone.
- Art credit: card + sticker illustrations by Unableplacebo (commissioned).
  Footer must keep: "Fan content. Not affiliated with The Pokemon Company".

## Channels
- YouTube: https://www.youtube.com/@GarbageRips585
  (channel ID UCnpEGJ2G_0af1YRyW2euIZQ)
- Instagram: https://www.instagram.com/garbagerips585/
- TikTok: https://www.tiktok.com/@garbagerips585
- Facebook: https://www.facebook.com/GarbageRips585

## How the feeds work (no API keys)
YouTube auto-playlists derived from the channel ID:
- All uploads: UUnpEGJ2G_0af1YRyW2euIZQ
- Shorts only: UUSHnpEGJ2G_0af1YRyW2euIZQ
- Long-form only: UULFnpEGJ2G_0af1YRyW2euIZQ
Embedded via /embed/videoseries?list=... so they self-update.
RSS is also available: youtube.com/feeds/videos.xml?channel_id=UC...

## Layout
```
public/        deployed static root (index, videos, playlists, assets/, data/)
assets-source/ the stylesheet source and the pack art originals, not deployed
scripts/       sync-youtube.mjs, local only, needs YT_API_KEY in the environment
shared/        taxonomy.mjs, the set/product tag rules, imported by both
```

## The stylesheet: edit assets-source/ui.css

**`public/assets/ui.css` is GENERATED. Edit `assets-source/ui.css`, then run
`node scripts/build-css.mjs`.** The generated copy says so in its first line.

The build strips the comments and nothing else: same rules, same order, byte
for byte identical once whitespace and comments are removed. It exists because
the stylesheet is render blocking on all 426 pages and 40% of it was prose.
Measured, gzipped, which is how the host serves it: 42.4KB -> 17.4KB, a 59%
cut to the transfer of the one asset that delays first paint everywhere.

The comments are the point of the source file, so they are not a cleanup
target: most of them record a measurement or a bug that a tidy-up would
otherwise reintroduce. They cost nothing now, so write more of them.

`build-css.mjs` runs FIRST in build-all.mjs, before any page builder, because
shared/chrome.mjs hashes the built stylesheet at import time to make the
`?v=` cache buster. `stamp-assets.mjs` still runs LAST. check-build.py fails
if the two files have drifted apart, which is what catches an edit made to the
generated copy by habit.

Do NOT delete rules because coverage says they are unused. Only 6-15% of the
file is used on any one page, but coverage cannot see :hover, :focus, print,
media query or JS-toggled-class rules, and deleting those is how this site
breaks silently.
Host is GitHub Pages: .github/workflows/pages.yml uploads public/ on every
push to main. There is no server build step. See DEPLOY.md.

## Every click stays on the site
Video tiles everywhere link to that video's own page under `public/rip/`,
never to youtube.com. The embed lives on that page.

The deliberate outbound links are Subscribe, the social icons, every card
on /playlists.html, and one block of four at the foot of /how-to-play.html.
THE THIRD ONE IS AN EXCEPTION THIS FILE DID NOT ADMIT TO
until 14 August 2026, when it read "the only deliberate outbound links are
Subscribe and the social icons" while 22 cards on that page sent people to
YouTube. The rule and the page disagreed and the page was winning quietly.

The exception is arguable rather than obviously right, so here is the case
either way. A playlist is a YouTube object: an ordered, hand-curated run, and
watching it in order is a thing YouTube does that this site does not
replicate. The cards are labelled "Watch on YouTube" and carry an aria-label
saying it opens there, so nobody is tricked. Against that: the site holds a
page for every video in those playlists, so an on-site playlist view is
buildable, and the rule exists because sending people to YouTube is how a
content hub stops being one.

If you build the on-site version, delete this paragraph rather than editing
it. Until then, do not "fix" the outbound links without deciding that
question first: they are a known trade, not an oversight.

THE FOURTH EXCEPTION IS /how-to-play.html, added deliberately and argued here
rather than made quietly, which is the mistake the playlist cards made. That
page teaches the rules of the card game, and it ends with one labelled block of
four links to Pokemon's own sites: the Learn to Play hub, the Quick Start Rules
PDF, Pokemon TCG Live, and the full 44 page rulebook PDF.

The case for them is that this site cannot host the rules and should not
pretend to be a substitute for them. A beginner who wants more than our page
needs the real rulebook, and the single best thing to recommend to somebody
learning is the official free digital client, which teaches the rules and then
enforces them. A 101 page that refuses to name it is worse for its reader than
one that does. The case against is simply the count: four outbound links on one
page is more than the rest of the site holds outside the playlists.

The shape is the mitigation and it is the condition of the exception. They sit
in ONE block at the very END of the page, after every internal link, so nothing
sends a reader away mid-explanation. Each says it opens on Pokemon's site, in
an aria-label, exactly as the playlist cards do. The rulebook link warns that it
is 44 pages and around 50MB before anybody taps it on mobile data.

THE FIFTH EXCEPTION IS THE PAIR OF APP PAGES, /tcg-live.html and
/tcg-pocket.html, and it is the same shape as the fourth rather than a new
argument. Both are guides to a free official app, and a page that tells you to
download something and then refuses to say where is useless.

The shape is again the mitigation. /tcg-pocket.html carries ONE outbound link,
Pokemon's own site, in one labelled block at the very end. /tcg-live.html carries
TWO in its end block, the official TCG Live page and the redemption site, and
that page takes one further liberty which was argued rather than made quietly:
THE REDEMPTION LINK ALSO APPEARS INLINE, in the redeeming section. It is not a
"learn more" link, it is step one of a four step instruction, and burying it 900
words below where the reader is standing costs them more than the outbound rule
gains us. It is labelled and aria-labelled as leaving the site exactly like every
other one. If a later editor disagrees, the fix is to drop the inline copy and
name the domain in plain text there, not to spread more of them through the page.

THE FORBIDDEN LINK IS FORBIDDEN ON ALL THREE OF THOSE PAGES AND IT IS NOT A
STYLE CHOICE. The TCG Live page also links "Card Drop Rate Information". Do not
link it, quote it or summarise it from /how-to-play.html, from /tcg-live.html or
from /tcg-pocket.html, and the same goes for anything stating Pokemon TCG
Pocket's offering rates. The site never states pull rates, and linking a page of
them through a guide of ours is the same claim made at one remove. Both digital
games publish their own rates, which is precisely why the ban has to name these
pages: they are where somebody will argue that a published figure is different.
It is not. The research files record that those pages were deliberately never
fetched and that no url leading to them is stored, so there is nothing in the
tree to emit by accident. Keep it that way.

A playlist with zero videos does not render at all. Two exist on the channel
and were showing as cards reading "0 videos" whose only action was a link to
an empty YouTube playlist. They reappear the moment a video goes in.

`scripts/build-pages.mjs` generates a page for EVERY video, so no tile
can dead-end. Videos missing a set or product tag get `noindex` and stay out
of the sitemap, because they would be thin pages; tag them and re-run to
promote them. `shared/paths.mjs` owns the URL shape and the sync stamps
`path` onto every video, so the browser, the generator and the RSS function
cannot drift apart.

## The pack wrapper
The player on every rip page sits under a sealed booster pack that has to be
ripped open. This is not just decoration: YouTube's poster frame is usually
the pulled card, so the thumbnail spoils the video before you press play.

Built from two `.pack-face` halves, each holding a full copy of the pack art
and clipped with a jagged `clip-path` so together they read as one sealed
pack. Click mounts the iframe immediately, then runs shake (0.26s) and tear
(0.62s) over the top of the already-playing video.
The sequence is driven by `animationend`, not by timers matching the CSS
durations, because background tabs clamp `setTimeout` and would desync the
reveal from the tear. Generous fallback timers cover the case where the
animation never fires. `prefers-reduced-motion` skips straight to the video.

The five `@keyframes` (packShake, packFade, tearL, tearR, packFlash) live in
ui.css. They were referenced by name for a long time without existing, which
is silent: a CSS animation naming missing keyframes never runs and never
fires `animationend`, so the pack simply sat there. If the pack stops moving,
check the keyframes are still present before anything else.

**BEFORE BELIEVING A PACK FAILURE YOU FOUND WHILE TESTING, CHECK YOUR
HARNESS.** Driving many rip pages in one browser session produces false
failures that look exactly like the missing-keyframes bug: after roughly five
pages the accumulated YouTube embeds starve the renderer, no animation starts,
and the pack never clears. A QA pass measured 5 of 15 passing that way and 15
of 15 with a fresh browser per page. If you are automating this, isolate the
browser per page, and treat "it broke after the fifth one" as evidence about
the harness rather than about the site.

**The embed starts MUTED and unmutes itself a moment later. The ORDER is the
whole trick.** A muted media element is exempt from the user-gesture check; an
unmuted one is not, and a cross-origin iframe created during a click does not
reliably inherit that click (Chrome and Firefox usually honour an ancestor's
gesture through `allow="autoplay"`, WebKit does not). That is why this was
intermittent rather than broken: it varied by browser and by visit, never by
video or by page.

The trap that caused the reported bug: unmuting BEFORE playback begins throws
away the exemption `mute=1` just bought, so the player makes its autoplay
attempt as an unmuted element, is refused, and paints YouTube's own play
button. Asking for sound too eagerly causes the exact symptom it was meant to
fix. So:

1. Mount muted. Muted autoplay is never refused, so the rip always starts.
2. Wait for the player to REPORT playing (state 1).
3. Only then unmute. Sound arrives while the pack is still tearing.
4. If unmuting stops it, re-mute, resume, and show `#soundOn` for one tap.

Three things that are easy to get wrong and were all wrong once:
- `onStateChange` delivers `info` as a NUMBER, `infoDelivery` as an object.
  Handling only the object shape silently ignores every state change.
- The `listening` handshake must be REPEATED. The player installs its message
  handler well after the iframe's `load` event and drops anything earlier, so
  sending it once on `load` loses the feed and every decision is made blind.
- Never call `playVideo` on an unmuted, not-yet-started player: a refused
  scripted play is itself what triggers YouTube's play button.

## Set pages
`/sets/<id>.html` is a "Set 101" guide per card set, plus a `/sets/` index.
Two scripts, run in order:

    node scripts/sync-sets.mjs        pulls card data -> public/data/sets.json
    node scripts/build-set-pages.mjs  writes public/sets/

Data is the free Pokemon TCG API (api.pokemontcg.io). It rate-limits hard and
answers 500/502 rather than 429, which reads as missing data until you retry;
sync-sets.mjs backs off and caches raw responses under .cache/ (gitignored).
A cold run takes several minutes, re-runs are instant.

Two constraints that shape these pages:
- **THIS ENTRY USED TO SAY the four newest sets (Pitch Black, Chaos Rising,
  Perfect Order, Ascended Heroes) have card lists but NO market prices, and it
  was quoted back as a reason a page showed none.** That is true of
  api.pokemontcg.io only. `sync-cards.mjs` prices those sets in full from
  TCGdex, so all 295 Ascended Heroes cards have a figure. Anything on a set
  page that claims a price is missing is now reading the wrong file.
  Every price a set guide prints comes from `public/data/cards/<id>.json`:
  the chase grid, the rarity ladder, the value band and the checklist. ONE
  SOURCE PER PAGE, so the top of the page cannot disagree with the bottom of
  it. `sets.json` still supplies the counts, the dates and the rarity ladder's
  shape, and `data/chase-tcg.json` now supplies nothing but TCGplayer links.
  Do not reintroduce a second price feed to a page that already has one: 22 of
  28 guides once priced their own chase card twice, and on Ascended Heroes the
  second feed named the wrong card entirely.
- "Still in print" and pack prices are not in the API and are not guessed.
  They live in `data/set-notes.json` for a human, along with any fun facts,
  and are omitted when blank. Everything else is API fact or checklist
  arithmetic. Never state pull rates: we do not have them.

## Video data
- `public/data/videos.json` is the whole catalogue, `playlists.json` the
  playlists. Both are written by `scripts/sync-youtube.mjs`.
- Tags (card set, product type, pull grade) are derived from title plus
  description by `shared/taxonomy.mjs`. Coverage is roughly 90% when the
  description is available, about 50% from titles alone. Hand corrections go
  in `data/overrides.json` and always win.
- No live feed layer. /api/latest was a Cloudflare Function proxying the
  YouTube RSS feed (the feed sends no CORS headers, so the browser cannot read
  it directly). GitHub Pages cannot execute a function, so that fetch was a
  guaranteed 404 on every grid page and both it and functions/ are deleted.
  Freshness comes from the nightly refresh workflow instead.

## Card images (measured, and two things here are counterintuitive)

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

**Do not "fix" this by adding 560w and 700w renditions.** That was measured
too, with the files actually generated: it saves 302KB at 1280 and 1920 at DPR
1, and NOTHING at DPR 2 or 3, because 810w is already the smallest candidate
that satisfies a 464px box on a retina screen. It is a no-op on every modern
phone and every retina laptop, for 38 files and 3.43MB. If the 1x desktop win
is wanted later, 560w ALONE buys all of it (19 files, 1.42MB); 700w was only
ever picked in one case, a DPR 2 phone.

**A CSS background cannot be lazy.** rarity.html's magnified corners were
backgrounds, so all 13 full-size scans were fetched at first paint whether or
not anyone scrolled to that row. They are `<img loading="lazy">` now and the
page went 2,536KB to 388KB at 390px. If you move a background to an img,
re-screenshot: doing it here brought the scans into reach of a later rule at
equal specificity and turned eleven magnified corners into whole shrunken
cards, which looks almost right.

**Some images do not exist and never will.** `data/no-scan.json` records 101
TCGdex bases that 404 and 4 TCGplayer urls that 403, found by fetching all
4,655 image urls the site emits. They all carried `onerror="this.remove()"`,
so nothing looked broken: the picture silently vanished and the site paid for
a dead round trip to find out. Builders skip them up front instead. The file
is safe to go stale in the only direction it can.

## Video display rules (these were measured, do not "fix" them)
- Thumbnails come from `i.ytimg.com/vi_webp/<id>/oardefault.webp`, falling
  back to `oardefault.jpg` then `maxresdefault.jpg`. "oar" is the only
  variant at the video's true vertical shape; hqdefault and maxresdefault are
  4:3 and 16:9 crops that letterbox a Short.
- Grid tiles are **2:3**, not 9:16. YouTube, Instagram and TikTok all crop
  vertical video for grids; a true 9:16 tile is 1.78x tall and turns the page
  into a wall of skinny rectangles. The player opens to 9:16 on click so
  playback has no bars.
- Columns: 6 / 4 / 3 / 2, matching YouTube's own Shorts grid.
- Never put live iframes in a grid. One player is ~540KB, so the grid is a
  click-to-load facade and only one player is ever live at a time.
- `modestbranding` is deprecated and does nothing. `rel=0` still scopes end
  screens to this channel.
- All but one video is vertical. The exception is `kj7532tb0_I`. Counts are
  deliberately not written here: they were, and they went stale. Run
  `node scripts/build-untagged.mjs` for the current ones.

## Current state
Homepage order: nav, Greatest Hits (the Hall of Fame card, then a carousel),
Latest rips (carousel), Most wanted, Card Pokedex, Card guides and tools, the
585 hometown band, footer. The ORDER is the same at every width; the LAYOUT of
the first two bands is not, and the difference is described under "The home
page is two layouts" below.

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
- Every video band plays IN PLACE. Clicking a pack mounts the player over the
  tile, runs the rip animation and plays there. It does not navigate. This was
  an explicit request and it is easy to undo by accident, because the tile is
  still an `<a>` to the rip page and the handler is what stops it.
- Each tile's rip animation uses THAT VIDEO'S OWN pack art, not the generic
  wrapper. `packSet` in build-proto.mjs picks it.
- Bands other than Greatest Hits are a scroll-snap carousel with slide buttons,
  not grids. ON A PHONE that is one video at a time and the counter reads
  "1 / 5". On a desktop it is two or three at a time; see below.
- A slide the track is not showing has NO pack art in its `<img>` yet. See
  "loading=lazy is a vertical heuristic" under Card images. If you change the
  carousel markup, keep slide 0's real `src` and keep the data- attributes on
  the rest, or the home page quietly goes back to 800KB on a phone.
- The Hall of Fame card keeps its text when the player mounts: the handler
  swaps only the art box, because replacing the whole card lost the title, the
  set and the view count.
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
  Rip", or "Latest Rip" past that. Tim uploads daily so it reads "Today's Rip"
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
- Greatest Hits becomes two columns at 1200: the trophy on the left at a fixed
  460 to 520px, the rest of the hits beside it. That band was 2,105px tall to
  show one pack and one video and is now 1,187px showing three.
- Most wanted's tiles grow to fill their row instead of stopping at 168px.

Do not "simplify" those fractional counts to whole numbers and do not reinstate
a single centred card, which is what the two long comments above them are
arguing about. Both of those comments are still correct and still about the
PHONE: one column sized to the video is right when the slide is the whole
track. The desktop fix is not a wider card, it is more of them.

The banner art is the header, not a mid-page strip. Do not overlay copy on
it: Trubbish sits dead centre in the source image, so any scrim wide enough
to make text legible washes him out, and any panel large enough hides him.
The copy goes underneath.

Also at root: favicon.ico / favicon-32.png / apple-touch-icon.png (all
cropped from Trubbish's face in logo-square.jpg), robots.txt, sitemap.xml.
assets/og-image.jpg is a 1200x630 crop of banner-trubbish.jpg, wired up as
og:image and twitter:image. Absolute URLs come from `shared/site.mjs`, which
switches on one flag: `LIVE` is still false, so every canonical, og:url and
sitemap entry points at garbagerips585.github.io. Flip `LIVE` and rebuild to
move the whole site onto the real domain in one step. Do not hand-edit URLs.

## Local preview
`node .claude/server.js` (port 4585), or the "grips" entry in the parent
Codex .claude/launch.json. .claude/ is gitignored, so it never deploys.

## Deploy
Git repo, main branch, pushed to garbagerips585/garbagerips585.github.io.
`pages.yml` publishes public/ on every push. Going live is one flag: set LIVE
in shared/site.mjs and run build-all.mjs, which moves every canonical and the
sitemap onto the real domain and generates public/CNAME. Full walkthrough and
the post-flip checks in DEPLOY.md, which also records that the flip has been
rehearsed on a throwaway copy of the tree.

## TODO (rough priority)
1. Greatest Hits playlist. The band ranks by pull tier then views as a
   stand-in; Tim's own playlist would replace it. (The old note here pointed
   at a "HITS ONLY PLAYER" comment in index.html that no longer exists.)
2. Buy garbagerips585.com, set it in Settings > Pages, then verify in
   Google Search Console and submit sitemap.xml. See DEPLOY.md.
3. ~~About page~~ done: /about.html is written, linked and in the sitemap.
4. Blog for actual search traffic: set reviews, "Pokemon card shops
   Rochester NY" local angle. Each post embeds a video, and each new page
   goes in build-pages.mjs's sitemap list, not into sitemap.xml by hand.
   THIS LINE USED TO SAY "pull rates" and it should never have. The site's
   hard rule is that pull rates are never stated, because The Pokemon Company
   does not publish them, and /luck.html goes out of its way to say its
   numbers are observed results instead. A TODO naming a content plan the
   rest of the file forbids is exactly the kind of note that gets quoted back
   as permission.
5. Consider migrating to Astro if the blog grows (keep it static).
6. Naming consistency: "GarbageRips585" (one word, on sticker) vs
   "Garbage Rips 585" (spaced, on YouTube). Tim to pick one for H1/metadata.

## Gotchas
- Shorts playlist embed plays in a normal player, not the Shorts UI.
- prefers-reduced-motion is honoured in three places and all three matter:
  a blanket rule kills every transition and animation, a specific rule stops
  the pack shake and tear so the video is simply revealed, and the tool cards
  only get their hover transform under `no-preference`. This entry used to
  name a ticker, a card tilt and a card flip, none of which exist any more.
  Check the page before writing a rule about it.
- Keep page weight low; images are pre-compressed in assets/.
