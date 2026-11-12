# The pack wrapper and the end card

Covers the rip animation, the muted-then-unmuted autoplay handshake, the end card that appears when a rip finishes, and the traps in each.
CLAUDE.md at the repo root is the index and holds the one-line rules; this file holds the detail behind them. Text under the original headings was moved here word for word from CLAUDE.md on 2026-11-11. Notes added in that restructure are marked as such.

## The pack wrapper
The player on every rip page sits under a sealed booster pack that has to be
ripped open. This is not just decoration: YouTube's poster frame is usually
the pulled card, so the thumbnail spoils the video before you press play.

Built from two `.pack-face` halves, each holding a full copy of the pack art.
**SINCE 5 OCTOBER 2026 IT TEARS ACROSS THE TOP SEAL, NOT DOWN THE MIDDLE.**
The owner approved the redesign mockup: "use all of it, deploy the new rip site
wide, yes i like the new Proposed look and animation, update site wide". At
rest `.pack-l` is the whole pack (no seam) lying on a lit table
(`--pk-table`, on `.pack::before`, in the site's greens) with a contact shadow
off the art's alpha and the banner moved UNDER the bottom seal; on the click
`.pack-l` becomes the strip above the crimp and `.pack-r` the body. Click mounts
the iframe immediately, then ONE class, `.ripping`, schedules every phase by
`animation-delay`: grip (0-160ms), nick and tear run (160-462), strip yanked
off and flipped to its silver inside (462-800), body tugged, squeezed so card
edges show in the mouth, then dropped out of frame (160-940), table fades
(460-740). The full timeline is the header of the "pack rip" block in ui.css.
The old two-step (`.shaking`, then `.tearing` on packShake's animationend) is
gone: that main-thread hop fell exactly where the new iframe boots.
The reveal is driven by `animationend`, not by timers matching the CSS
durations, because background tabs clamp `setTimeout` and would desync the
reveal from the tear. **tearL on `.pack-l` ends LAST (1.0s) and is the only end
packplayer.js waits for**; tearR is 60ms shorter on purpose, and `.pack-l` also
runs packShake first, which `after()` ignores BY NAME, so that name filter is
load bearing now. Fallback 2200ms. `prefers-reduced-motion` skips straight to
the video.

**THE FACES ARE THE ART BOX.** Every tear percentage (`--tear:13.6%`, just
under the crimp ribs, `--seal`, the foil and card-edge insets, the transform
origins) is a percentage of the 9:16 artwork, measured on all 24 masters
(silhouette x 7.3-92.7%, seal top 6.2%, ribs end 12.8%, 13.3% on 30th
Celebration). Rather than re-derive them for each size the pack is drawn at,
the faces are SIZED to the file's 9:16 shape and centred (`aspect-ratio`,
`left:0;right:0;margin-inline:auto`, never `transform`, which belongs to the
hover and the animations): 94% of the
player's height on a rip page, the TILE's framing in `.tile-stage` so a tile's
pack tears from where it was clicked. `.pack-flash` is the one layer outside a
face and takes the same box. Change the art size by moving the face, never by
`background-size` on `.pack-art`, or the tear stops lining up with the crimp.

**TILES SHOW THE WHOLE PACK ABOVE THE BANNER** (the same redesign): the file is
drawn at 1.0867x the room above the 44px banner, lifted 3.85% of it, which puts
the silhouette across 94% of that room. `.pack--tile` and `.packshot` faces,
`.hero-art img` and `.hofx-art img` all carry that sum; `sizes` is untouched,
so no tile fetches a different file. The 404 page keeps the OLD vertical clip
on purpose (its joke is the left half of a pack split down the middle), which
is the only thing the base `.pack-l`/`.pack-r` polygons still serve.

The EIGHT `@keyframes` (packShake, packFade, tearL, tearR, packFlash,
tearFoil, tearSheen, packBack) live in **assets-source/pack-rip.css**, with
every other rip-only rule, since 5 October 2026 (the owner: "yes move the rip
styles to packs.css"): in ui.css they cost 1.77KB gzipped, render blocking, on
~1,000 pages that never show a pack. build-css.mjs strips that file into
public/assets/packs.css between RIP:START and RIP:END, after build-packs.py's
skins, and check-build.py fails if the block is missing or stale (a hand run of
build-packs.py --css-only drops it; run build-css.mjs after). The resting look
of tiles stays in ui.css because the home page paints its carousels before its
non-blocking packs.css arrives. They were once referenced by
name for a long time without existing, which is silent: a CSS animation naming
missing keyframes never runs and never fires `animationend`, so the pack simply
sat there. **scripts/check-build.py now fails the build** when any animation
name used in public/assets/*.css or a page's inline style has no matching
`@keyframes`. If the pack stops moving anyway, check the keyframes first.

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

## The end card

Added 1 September 2026. A rip is about twenty seconds long, and the player used
to stop on its last frame with nothing to do next: 330 videos, on 361 pages
carrying a player. When a video ends, `.rip-end` fades in over the frame with
the set, runtime and views as a kicker, the rip's title, a REAL SEALED PACK in
the NEXT rip's own skin, Watch again, Full rip page, and rows to the set and the
opening type. Everything it prints is already in the tile that was clicked;
nothing is fetched.

> **ADDED 11 NOVEMBER 2026 (note written in the restructure).** The card's action row now ends with Subscribe
> (`.rip-end-sub`, built in assets-source/js/packplayer.js). It has the same destination and the same label
> wording as the bar's own `.sub`, it sits LAST, it never replaces NEXT PACK, and the tiny card drops it. The
> reason recorded beside it: the end of a rip is the one moment a viewer has just decided whether they liked
> it, and the card offered the next pack and no way to follow the channel. On the rip page itself the Subscribe
> under the player now lives in the `.pitch` block from `shared/channel-pitch.mjs` (see the note in
> docs/links.md).

**IT IS ONE TAP, NOT ZERO, AND THAT IS NOT A UX PREFERENCE.** An iframe created
without a live gesture may autoplay MUTED ONLY, so auto-advancing lands the next
rip silent under YouTube's own unmute button, which is the exact symptom the
mute-then-unmute handshake above exists to prevent. Auto-advance would be
shipping a fixed bug back as a feature. NEXT PACK advances and rips in the same
gesture, so the tap that chooses is the tap that buys the sound. Do not
"improve" this into an autoplaying queue.

**IT WAS ONLY BUILDABLE AFTER ENDED BECAME HONEST.** Before 1 September, state 0
fell through to `retreat()`, which re-muted and restarted every finished rip.
And a SECOND path did the same thing until the end card was built: the "Tap for
sound" button set `phase='unmuting'` and cleared its watchdog without arming a
new one, so nothing ever moved the phase on, and twenty seconds later ENDED hit
the unmuting branch and restarted the rip. That was live on the path iOS reaches
most. If a rip ever restarts itself again, look at `phase` before anything else.

**THE FOUR CONTEXTS DISAGREE ABOUT EVERYTHING AND EACH ONE WAS MEASURED.**
Five families emit a playable tile and no two carry the same facts in the same
place: `.hero-art` has the set in `.hero-meta` and appends ", 0:29" to its own
aria-label; `.hofx` has no aria-label at all; `.art` on /videos.html is
RE-RENDERED IN THE BROWSER on every filter tap; playlist `.art` reads "multi" in
`.pack-brand` on ten tiles; and the 3,109 rip-rail `.vid-shell` tiles carried no
duration and no view count at all. All five emitters write `data-dur` and
`data-views` now and the visible spans are untouched. Read those, not the text.

**FOUR THINGS THAT LOOK RIGHT AND ARE WRONG. Do not re-derive these.**
- **`nextElementSibling` on the anchor is the SAME video.** A tile's `<a>` is the
  first child of an `<article>` and its next sibling is the `<h3>` holding that
  rip's own title link. Step at the CELL level.
- **The box rail's first tile is usually an EARLIER pack.** `build-pages.mjs`
  selects it next-packs-first and then re-sorts into PACK ORDER to render. Of
  the 249 pages carrying one, 207 have a later pack and tile zero is the honest
  next on only 99. Pick by pack number off `.rip-meta`, which comes in two
  shapes: "…, pack 5" and "… Pack #9".
- **A carousel slide can be visible and unreachable.** `offsetParent` only knows
  about `display:none`, so a slide off the right edge of the track passes a
  visibility test. [CORRECTED 11 November 2026: until that day the home page hid every slide but the first below 545px, so a phone had exactly two playable tiles. Both shelves are two-up swipe rows on a phone now (docs/home-page.md, "The phone rows"), so there are more than two, and a slide off the edge of the track is still visible and unreachable.] Advancing must both
  check visibility AND scroll the track, and the scroll comes strictly AFTER the
  mount so nothing sits between the click and the iframe.
- **A deferred slide has no `src`, only `data-packsrc`**, so a skin read returns
  "default" on the one control whose entire promise is the next set's own pack.

**WHERE THERE IS NO NEXT, THERE IS NO CONTROL.** The card drops NEXT PACK rather
than falling back to `pack--default`, because a generic wrapper is a claim about
which set is next and it would be false. That is the honest state on a phone
after the Latest slide, at the end of a playlist, and on the newest rip.

**ON A RIP PAGE THE CONTROL IS A LINK, NOT AN ADVANCE**, because that page's h1,
hit cards, description and source card are all about the hero video and swapping
it underneath them would leave the page describing something that is not
playing. That link carries a real `.pack`, which made it match `onDocClick`'s own
artwork test: it was swallowed on all 330 rip pages and mounted a player INSIDE
the card. `onDocClick` ignores anything inside `.rip-end` now.

**THE CARD IS SIZED OFF THE PLAYER, NEVER OFF THE VIEWPORT, AND THIS IS THE ONE
MOST LIKELY TO BE "FIXED" BACK.** It was `@media (max-height:420px)` and that
could never fire: a media query asks the VIEWPORT how tall it is, and the short
thing here is the PLAYER. On a portrait phone the viewport is 812px while a
rip-page rail tile's player is 247. Measured before the fix: **509px of card in a
247px frame**, NEXT PACK sliced through the middle, on the largest tile family on
the site. `showEndCard` measures the player and sets `.rip-end--tight` (<520px
tall) or `.rip-end--tiny` (<340px tall or <200px wide). The three families differ
by a factor of three: overlay 375x667, home tile ~309x464, rail tile ~136x247.
The order of sacrifice is the rows and the rule, then the title, then the
kicker. **NEXT PACK is never dropped, because it is the whole feature.**

**THE FINISHED PLAYER IS HIDDEN WHILE THE CARD IS UP** (`visibility:hidden` plus
`tabindex="-1"`), and that is two fixes in one. It stayed tabbable underneath:
8 to 14 blind Tab stops on YouTube's own controls beneath the scrim, and Escape
DEAD for that whole stretch, because a cross-origin iframe never lets the
document's keydown listener see the key. The focus trap was simply not in
effect. And `.94` is not opaque enough to hide YouTube's chrome: the scrubber and
the fullscreen button ghosted through onto the card's own rows. `lbFocusables`
also has to test `visibility`, because a hidden iframe keeps its `offsetParent`.

**THE SCRIM IS OPAQUE ON PURPOSE.** `.94` of `--navy-deep` rather than a wash
over the last frame, so every contrast pair is deterministic instead of
depending on whichever card happened to be on screen when the video stopped.
Measured at the worst possible rendered background: title 10.12:1, kicker
6.81:1, teal fill 7.22:1, rows 10.12:1. `.rip-end-next-meta` failed at 4.39:1
until its `opacity:.75` came off, which is CLAUDE.md's own "the big pink is not
large text" trap arriving in a different colour.

**VERIFIED IN A REAL BROWSER, and a 21-second rip is the test.** It played to its
end and the card appeared unaided at 21,083ms, which is the genuine ENDED signal
rather than the duration+1500ms backup. That backup reads `data-dur` off
`.rip-player`, so `buildHost` has to write it: it did not, and the backup was
dead on every tile and every overlay while working on rip pages only.
