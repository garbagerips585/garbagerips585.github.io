/**
 * Writes THREE sample pages under public/, each a copy of the REAL home page
 * with one candidate replacement for the play button on every video artwork.
 *
 *     public/preview-rip-a.html   A  RIP STRIP    a tear strip across the pack
 *     public/preview-rip-b.html   B  PULL TAB     a seam with a pull on it
 *     public/preview-rip-c.html   C  OPEN BAR     nothing on the artwork at all
 *
 *     node scripts/gen-rip-samples.mjs        (AFTER scripts/build-all.mjs)
 *
 * WHY THIS EXISTS. Tim, 19 August 2026: "Need you to re-think the play buttons
 * on all the pages for all the videos, right now they kind of get lost, and i
 * think we rethink them as a click to rip pack button, so its more interactive
 * and people know they can click there to rip open the pack and watch the
 * video, can you try another design for those play buttons with that in mind?"
 *
 * THE COMPLAINT IS MEASURABLE AND IT MEASURES TRUE. Today's control is
 * `<span class="play">`, a 44.7px disc of rgba(255,255,255,.94) with a dark
 * triangle in it, centred on the artwork. The artwork is a photograph of a foil
 * booster pack, and EVERY pack skin on this site contains pure black and
 * near-white pixels inside the disc's own footprint: sampled at the real tile
 * size, the darkest pixel under the disc is L=0.0032 (paradox-rift) and the
 * brightest is L=0.8579 (151). A single white disc has ONE edge colour, so
 * wherever the wrapper is already light the disc's outline contributes
 * essentially nothing and the shape survives on its drop shadow alone. That is
 * "it gets lost", stated as a number.
 *
 * SO EVERY CANDIDATE HERE CARRIES TWO EDGE COLOURS, NOT ONE. Each control is a
 * teal fill inside a near-black 2px keyline inside a near-white 2px ring. The
 * shape then reads against a light ground (the black keyline does it) and
 * against a dark one (the white ring does it) WITHOUT depending on which. That
 * is the property the white disc had in one direction only, kept and doubled,
 * which is the condition Tim's ask has to be met under rather than traded off
 * against. The self check at the foot of this file measures it and throws.
 *
 * THE WORDS ARE THE POINT AND THEY ARE THE SITE'S OWN. Every tile already
 * carries "Rip it open ->" underneath it, so the control says RIP IT OPEN
 * rather than inventing a fourth phrase for the same act.
 *
 * COLOUR IS THE SHIPPING PALETTE AND NOTHING NEW IS MIXED HERE. Fill is
 * --mustard (#70B5D9, the teal that is every button fill on this site), ink is
 * --on-accent, keyline is --on-accent, ring is --ink, the SEALED chip's word is
 * --ketchup-deep because a status word is the site talking and not a route.
 * NO GOLD: that is the Hall of Fame's and it stays there.
 *
 * ------------------------------------------------------------------ guards --
 * The same four gen-palette-samples.mjs buys its exception with, for the same
 * reason: a phone cannot open a file off this laptop's disk, so a page Tim is
 * meant to judge on a phone has to sit in the deploy root at a real url.
 *
 *   1. noindex,nofollow, and the canonical, og:url and JSON-LD are STRIPPED
 *      rather than left pointing at the real home page.
 *   2. None is in sitemap.xml. check-build.py fails the build on any noindex
 *      page that turns up there, so this is checked rather than trusted.
 *   3. NOTHING ON THE SITE LINKS TO THEM. They link to each other in a ring,
 *      plus one link back to the real home page so the current design is one
 *      tap away, which is the whole comparison.
 *   4. assets-source/ui.css is NOT touched and neither is the built copy. Each
 *      candidate is a <style> block in its own file and dies with it. Every
 *      other page in the tree is byte identical after this script runs.
 *
 * DELIBERATELY NAMED gen- RATHER THAN build-. check-build.py fails on any
 * scripts/build-* that build-all.mjs does not run, and build-all.mjs must NOT
 * run this: it writes pages that are going to be deleted, and wiring a
 * throwaway into the nightly is how it stops being one. check-build.py's
 * _NOT_BUILT is `glob("public/preview-*.html")`, so these three are already
 * exempt from the staleness check by name and nothing there needs editing.
 *
 * IT REGENERATES FROM public/index.html EVERY RUN, so run it AFTER
 * build-all.mjs. Run it before and you get three previews of the last build.
 *
 * ============================ DELETE THESE BEFORE LAUNCH ====================
 *     rm public/preview-rip-a.html public/preview-rip-b.html \
 *        public/preview-rip-c.html
 *     rm scripts/gen-rip-samples.mjs
 *     node scripts/build-all.mjs
 *
 * AND IF TIM PICKS ONE, MOVE IT BEFORE YOU DELETE THE FILE. Unlike the palette
 * samples, whose answer went into assets-source/ui.css as a token block, the
 * answer here is a CSS RULE SET plus a one-line markup change in SEVEN places,
 * counted rather than remembered:
 *
 *     scripts/build-proto.mjs     314   videoTile
 *     scripts/build-proto.mjs     580   Hall of Fame trophy, with a duration
 *     scripts/build-proto.mjs     581   Hall of Fame trophy, without one
 *     scripts/build-proto.mjs     703   heroTile, every carousel slide
 *     scripts/build-proto.mjs     977   libCard, /videos.html server render
 *     scripts/build-playlists.mjs 475   the 22 playlist pages
 *     public/assets/app.js        129   /videos.html's tiles, in the browser
 *
 * THE LAST ONE IS THE ONE THAT GETS MISSED, because it is the only emitter
 * that is not a builder. /videos.html renders its grid from JSON after load and
 * re-renders it on every filter change, so a change made in the six builders
 * leaves the page with the most tiles on the site still drawing discs, and no
 * build check can see it. The rules live in the CANDIDATES block below and
 * nowhere else. LAUNCH.md carries the same reminder.
 * ===========================================================================
 */
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/* ==========================================================================
   WCAG ARITHMETIC. The self check at the foot of this file uses it, so no
   ratio quoted in the report is asserted. Same four functions as
   gen-palette-samples.mjs; they are eight lines and importing that file would
   run its own writer.
   ========================================================================== */
const hex = (h) => {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = (c) => {
  const [r, g, b] = (typeof c === "string" ? hex(c) : c).map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const fmt = (n) => n.toFixed(2) + ":1";

/* ==========================================================================
   THE PALETTE THIS READS RATHER THAN DECLARES.

   Every value below is parsed out of the BUILT stylesheet, so a candidate
   cannot quietly ship a hex that ui.css has since moved. CLAUDE.md's rule for
   this palette is "do not re-derive a number here; read it from there", and a
   preview whose teal is one step off the site's teal is a preview of a design
   nobody is going to get.
   ========================================================================== */
const CSS = await readFile(join(ROOT, "public/assets/ui.css"), "utf8");
function token(name) {
  const m = new RegExp(`--${name}\\s*:\\s*(#[0-9A-Fa-f]{3,8})`).exec(CSS);
  if (!m) throw new Error(`ui.css no longer declares --${name} as a literal hex`);
  return m[1].toUpperCase();
}
const T = {
  fill: token("mustard"),        // #70B5D9  the teal every CTA on this site is
  ink: token("on-accent"),       // #231F20  Trubbish's own outline
  ring: token("ink"),            // #E4DCCC  the near-white the page writes in
  say: token("ketchup-deep"),    // #EEA0B9  the small pink, for a status word
  band: token("band-bg"),        // #192D22  the darkest painted surface
};
if (T.fill !== "#70B5D9") {
  // Not fatal in itself, but the argument above names this colour, so say so.
  console.log(`  NOTE: --mustard is ${T.fill}, not the #70B5D9 this file's header describes.`);
}

/* ==========================================================================
   SHARED CHROME.

   .rpx is the one element every candidate replaces `<span class="play">` with.
   It is decorative and it stays decorative: aria-hidden, pointer-events:none,
   inside the anchor that already carries the accessible name. THAT IS NOT A
   DETAIL. The tile is already a link; a real <button> in here would be an
   interactive element nested in an interactive element, and it would also
   break the thing this control exists to trigger, because packplayer.js's
   delegated handler works by finding `a[href*="/rip/"]` and calling
   preventDefault on it. pointer-events:none means the click that lands on
   these pixels is a click on the anchor, which is what it has to be for the
   pack to rip in place, for a middle click to open a tab, and for a reader
   with no JavaScript to get the rip page.

   NO NEW FONT WEIGHT. `700 var(--t-micro) var(--mono)` is exactly what .dur
   already paints on every one of these tiles, so nothing here fetches a second
   Space Mono file. See the "A SINGLE font-weight IN NEW CSS" note in CLAUDE.md,
   which is about a bug of that shape found on this very page.

   THE DOUBLE EDGE IS THE WHOLE ARGUMENT and it is one declaration:
   `border:2px solid ink` with `box-shadow:0 0 0 2px ring`. Reading outward the
   control is fill / black / white / photograph. Against a light wrapper the
   black line draws the shape; against a dark one the white ring does; and the
   pair of them contrast with each other at a ratio no pack art can touch,
   which is why this does not have to be argued per skin.
   ========================================================================== */
const base = `
/* RIP CONTROL SAMPLE. Not part of the site. Deleted with this file. */
.rpx{position:absolute;z-index:5;pointer-events:none;
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  display:flex;align-items:center;justify-content:center;gap:6px;
  color:${T.ink};background:${T.fill};
  border:2px solid ${T.ink};box-shadow:0 0 0 2px ${T.ring},0 6px 16px rgba(0,0,0,.5)}
.rpx b{font:inherit;white-space:nowrap}
/* The glyph is drawn, not typed. An emoji or a dingbat here would be a second
   font file on the critical path of the home page. */
.rpx i{flex:none;width:0;height:0;border-left:7px solid currentColor;
  border-top:5px solid transparent;border-bottom:5px solid transparent}
/* The perforation reads on any ground for the same reason the control does:
   it alternates the two edge colours, so one half of every dash separates
   whatever the wrapper is doing underneath it. */
.rpseam{position:absolute;left:0;right:0;z-index:4;height:3px;pointer-events:none;
  background:repeating-linear-gradient(90deg,${T.ink} 0 7px,${T.ring} 7px 14px)}

/* ------------------------------------------------------------------------
   WHERE ON THE PACK, AND IT IS NOT THE SAME PERCENTAGE IN THE TWO BOXES.

   Every wrapper on this site is one 810x1440 image, so 9:16, and the two art
   boxes on the home page show DIFFERENT AMOUNTS OF IT:

     .hofx-art  is the img at width:100%, height:auto. 9:16, uncropped, so a
                percentage of the box IS a percentage of the artwork.
     .hero-art  is aspect-ratio:2/3 with object-fit:cover, which is WIDER than
                the art, so it scales to the width and crops the ends: the box
                shows art 7.8% to 92.2%, a span of 84.4%.

   A control placed at one flat percentage therefore lands 5 points lower on
   the carousel slides than on the trophy, and 5 points is the difference
   between sitting on the crimp and sitting across the set logo. It did, and it
   is what these two custom properties fix: y_box = (y_art - .078) / .844.

   THE TARGET IS THE GAP, and it was read off the artwork rather than picked.
   The crimped foil ends around 14% and the set logo starts around 23%, on
   every skin, because these are one illustration re-skinned. The strip goes at
   15% of the ARTWORK and the seam at 19%, so both sit in that gap.

   IT STOPS CLEARING ON A SMALL TILE AND THAT IS A REAL COST OF A, NOT A BUG.
   44px is 8.6% of the 510px-tall hero on a phone and 20.7% of the 213px-tall
   tile /videos.html renders at a 320px viewport, so at the small end A's band
   crosses the top of the set logo. B's pull is centred rather than banded, so
   it only clips the logo's first line there. C never touches either.
   ------------------------------------------------------------------------ */
.hofx-art{--rp-strip:15%;--rp-seam:19%}
.hero-art{--rp-strip:8.5%;--rp-seam:13.3%}
`;

/* ==========================================================================
   THE THREE CANDIDATES.

   They differ in KIND, not in styling, which was the brief. A is a band ON the
   artwork, B is a seam ACROSS it with a pull that opens on press, and C puts
   nothing on the photograph at all.

   ALL THREE ARE STILL 44px OF CONTROL and none of them is the tap target: the
   anchor is, and it is 340x510 at 390x844 on the home page and 142x213 at
   worst anywhere on the site. The 44px minimum is about the control LOOKING
   like something you can hit, and every candidate holds it at every width.

   MOTION IS PRESS AND HOVER ONLY, NEVER LOAD. ui.css already carries
   `@media(prefers-reduced-motion:reduce){*{transition:none!important}}`, which
   kills the tween but leaves the end state, so each candidate ALSO turns its
   own transforms off under the same query. A reader who asked for no motion
   gets a control that does not move, not one that jumps.
   ========================================================================== */
const CANDIDATES = [
  {
    id: "a",
    file: "preview-rip-a.html",
    label: "A",
    name: "Rip strip",
    pitch: "The control is the pack's own tear strip: a full-width band under a line of perforation.",
    /* THE STRIP IS FULL WIDTH ON PURPOSE, and that is what makes it the
       candidate that cannot mush. Its label has the whole tile to read in, so
       at the narrowest artwork on the site it still has 100+px of room for
       eleven characters of 11px mono. A centred pill has to fit itself in.

       IT SITS AT 17% RATHER THAN IN THE MIDDLE because that is where the tear
       strip is on a real booster pack, and because dead centre is where
       Trubbish is on every one of these wrappers. */
    css: `
.rpa{left:0;right:0;top:var(--rp-strip);min-height:44px;padding:0 8px;
  border-left:0;border-right:0;box-shadow:0 -2px 0 ${T.ring},0 2px 0 ${T.ring},0 8px 18px rgba(0,0,0,.45)}
.rpa .rpseam{top:-11px}
/* Press and hover pull the strip away from the perforation, which is the whole
   gesture the words are asking for, said in 4px. */
.rpa,.rpa .rpseam{transition:transform .16s ease}
.hero-art:hover .rpa,.hero-art:focus-visible .rpa,.hero-art:active .rpa,
.hofx:hover .rpa,.hofx:focus-visible .rpa,.hofx:active .rpa{transform:translateY(3px)}
.hero-art:hover .rpa .rpseam,.hero-art:focus-visible .rpa .rpseam,.hero-art:active .rpa .rpseam,
.hofx:hover .rpa .rpseam,.hofx:focus-visible .rpa .rpseam,.hofx:active .rpa .rpseam{transform:translateY(-4px)}
@media(prefers-reduced-motion:reduce){
  .rpa,.rpa .rpseam{transform:none!important;transition:none!important}
}`,
    html: `<span class="rpx rpa" aria-hidden="true"><span class="rpseam"></span><i></i><b>Rip it open</b></span>`,
  },

  {
    id: "b",
    file: "preview-rip-b.html",
    label: "B",
    name: "Pull tab",
    pitch: "A perforated seam runs across the pack and a pull rides on it; press and the seam opens.",
    /* THE ONE THAT ANSWERS "MORE INTERACTIVE" LITERALLY. At rest it is a seam
       and a pull, which is a picture of a pack that is about to come apart.
       Under a finger or a cursor the seam OPENS: a teal split grows out of the
       perforation and the pull lifts off it. Nothing moves on load.

       THE SPLIT IS A LIT EDGE, NOT A GAP, because a gap would need the artwork
       cut in two and the artwork is one <img>. A 7px teal wedge under the
       perforation reads as light getting in, which is what a tear looks like
       from the front. */
    css: `
/* THE PADDING IS THE ONLY THING THAT SHRINKS, AND IT IS WHY B READS AT 118px.
   A and C are full width, so their label always has the tile to sit in. B's
   pull is content sized, so at 14px of padding it measured 126.3px wide and a
   118px artwork box CLIPPED IT: the one candidate here that can fail on a
   narrow tile, found by forcing the box to seven widths rather than by looking
   at it. clamp() takes the padding to 6px at the bottom of the range, which
   holds the pull to 110px, and the max-width is the belt to that brace. The
   TYPE never changes size: an 11px label that becomes a 9px label on a small
   tile is the failure this is avoiding, not a fix for it. */
.rpb{left:50%;top:var(--rp-seam);transform:translate(-50%,-50%);min-height:44px;
  padding:0 clamp(6px,5%,14px);max-width:calc(100% - 8px);
  border-radius:999px}
.rpb-seam{top:var(--rp-seam);margin-top:-1.5px}
/* THE SPLIT IS THE RING COLOUR, NOT THE TEAL, AND THAT WAS A CORRECTION. It
   was --mustard, and --mustard is a mid blue: on chaos-rising, phantasmal-
   flames, twilight-masquerade and every other blue or purple wrapper the tear
   opened in a colour the pack was already painted, so the one thing this
   candidate does that the others do not was invisible on a third of the
   library. Near-white is also the truer picture: what you see when a foil
   pack splits is the inside of the foil. The 1px dark cap on top of it is the
   same two-colour trick as everything else here, for the light wrappers. */
.rpsplit{position:absolute;left:8%;right:8%;top:var(--rp-seam);height:0;z-index:3;pointer-events:none;
  background:linear-gradient(180deg,${T.ink} 0 1px,${T.ring} 1px 5px,rgba(228,220,204,0));
  transition:height .18s ease}
.rpb{transition:transform .18s ease,box-shadow .18s ease}
.hero-art:hover .rpsplit,.hero-art:focus-visible .rpsplit,.hero-art:active .rpsplit,
.hofx:hover .rpsplit,.hofx:focus-visible .rpsplit,.hofx:active .rpsplit{height:9px}
.hero-art:hover .rpb,.hero-art:focus-visible .rpb,.hero-art:active .rpb,
.hofx:hover .rpb,.hofx:focus-visible .rpb,.hofx:active .rpb{
  transform:translate(-50%,calc(-50% - 3px));
  box-shadow:0 0 0 2px ${T.ring},0 10px 22px rgba(0,0,0,.55)}
@media(prefers-reduced-motion:reduce){
  .rpb{transform:translate(-50%,-50%)!important;transition:none!important}
  .rpsplit{height:0!important;transition:none!important}
}`,
    html: `<span class="rpseam rpb-seam" aria-hidden="true"></span>` +
      `<span class="rpsplit" aria-hidden="true"></span>` +
      `<span class="rpx rpb" aria-hidden="true"><i></i><b>Rip it open</b></span>`,
  },

  {
    id: "c",
    file: "preview-rip-c.html",
    label: "C",
    name: "Open bar",
    pitch: "Nothing sits on the photograph: the artwork's bottom edge becomes the button, so its contrast is structural rather than defended.",
    /* THE ONE THAT IS DIFFERENT IN KIND. A and B are marks drawn OVER a
       photograph and both spend their design on surviving it. C stops doing
       that: the bar is fused to the bottom edge of the artwork, full width and
       fully opaque, so the only pack pixels it ever meets are along one
       horizontal line. Its label's contrast is then a constant and does not
       have to be argued per skin at all, and the wrapper art is completely
       unobscured, which is worth something on artwork somebody was paid to
       draw.

       THE COST IS REAL AND IS NOT HIDDEN: the hero tile's body already says
       "Rip it open ->" 12px below this bar, and the Hall of Fame card says
       "Watch the pull ->". C therefore prints the same instruction twice on
       the two largest cards on the page. That is the thing to look at when
       judging it.

       THE DURATION CHIP HAS TO MOVE or the bar lands on top of it. It is the
       only element inside these art boxes that shares the bottom edge. */
    css: `
.rpc{left:0;right:0;bottom:0;min-height:44px;padding:0 10px;
  border-left:0;border-right:0;border-bottom:0;
  border-radius:0 0 8px 8px;
  box-shadow:0 -2px 0 ${T.ring}}
.rpc .rpar{flex:none;transition:transform .16s ease}
.rpc-scrim{position:absolute;left:0;right:0;bottom:0;height:26%;z-index:3;pointer-events:none;
  border-radius:0 0 8px 8px;
  background:linear-gradient(180deg,rgba(25,45,34,0),rgba(25,45,34,.85))}
/* SEALED is the site saying what this is, not a route, so it is the small pink
   on a dark chip and never the teal. Same two-colour edge as the bar. */
.rpseal{position:absolute;left:8px;top:8px;z-index:5;pointer-events:none;
  font:700 var(--t-micro)/1 var(--mono);letter-spacing:.1em;text-transform:uppercase;
  color:${T.say};background:${T.ink};padding:6px 8px;border-radius:4px;
  border:1px solid ${T.ink};box-shadow:0 0 0 1px rgba(228,220,204,.75)}
.hero-art .dur,.hofx-art .dur{bottom:52px}
.hero-art:hover .rpc .rpar,.hero-art:focus-visible .rpc .rpar,.hero-art:active .rpc .rpar,
.hofx:hover .rpc .rpar,.hofx:focus-visible .rpc .rpar,.hofx:active .rpc .rpar{transform:translateX(4px)}
@media(prefers-reduced-motion:reduce){
  .rpc .rpar{transform:none!important;transition:none!important}
}`,
    html: `<span class="rpseal" aria-hidden="true">Sealed</span>` +
      `<span class="rpc-scrim" aria-hidden="true"></span>` +
      `<span class="rpx rpc" aria-hidden="true"><b>Rip it open</b><span class="rpar">&rarr;</span></span>`,
  },
];

/* ==========================================================================
   THE FLIP CONTROL. Lifted from gen-palette-samples.mjs, same reasons, same
   literal colours: it must not read as part of the thing being judged, so
   nothing in it is a token.

   ONE DIFFERENCE, AND IT IS THE POINT OF THE WHOLE EXERCISE: the ring carries
   a link to the REAL home page as well. The complaint is that today's control
   gets lost, so the current design has to be one tap away or there is nothing
   to compare against.
   ========================================================================== */
const barCss = `
.pvbar{position:fixed;left:50%;transform:translateX(-50%);bottom:0;z-index:200;
  max-width:min(600px,calc(100vw - 20px));width:max-content;
  margin-bottom:calc(10px + env(safe-area-inset-bottom,0px));
  display:flex;align-items:center;gap:8px;padding:8px 10px 8px 14px;
  border-radius:999px;background:rgba(20,20,22,.94);border:1px solid rgba(255,255,255,.28);
  box-shadow:0 6px 22px rgba(0,0,0,.55);backdrop-filter:blur(6px)}
.pvbar b{font:700 12px/1.2 'Space Mono',ui-monospace,monospace;letter-spacing:.06em;
  color:#FFFFFF;text-transform:uppercase;white-space:nowrap}
.pvbar a{display:inline-flex;align-items:center;min-height:44px;padding:0 13px;
  border-radius:999px;background:#FFFFFF;color:#141416;text-decoration:none;
  font:700 13px/1.1 'Outfit',system-ui,sans-serif;white-space:nowrap}
.pvbar a.now{background:transparent;color:#FFFFFF;border:1px solid rgba(255,255,255,.5);padding:0 11px}
.pvbar a:hover,.pvbar a:focus-visible{background:#E4E4E8;color:#141416}
body{padding-bottom:76px}
@media(max-width:430px){
  .pvbar{gap:6px;padding:7px 8px 7px 11px}
  .pvbar b{font-size:10px}
  .pvbar a{font-size:12px;padding:0 10px}
  .pvbar a.now{padding:0 9px}
}`;
const barHtml = (s, next) =>
  `<div class="pvbar" role="group" aria-label="Rip button sample switcher">` +
  `<b>${s.label} &middot; ${s.name}</b>` +
  `<a class="now" href="/index.html">Now</a>` +
  `<a href="/${next.file}">Next: ${next.label} &rarr;</a>` +
  `</div>`;

/* ==========================================================================
   THE PAGE. A transform of the BUILT home page rather than a rebuild of it, so
   the drops band, the Hall of Fame trophy, the two carousels and the real pack
   art are the real markup at the real sizes. It sits at the deploy root
   exactly like index.html, so every relative asset path in it resolves.
   ========================================================================== */
const PLAY = /<span class="play"><\/span>/g;
const src = await readFile(join(ROOT, "public/index.html"), "utf8");
const nPlay = (src.match(PLAY) || []).length;
if (nPlay < 5) {
  throw new Error(
    `public/index.html holds ${nPlay} \`<span class="play"></span>\`. ` +
    `The markup moved; rewrite PLAY before trusting anything this script writes.`
  );
}

function build(s, next) {
  let h = src;

  // 1. Nothing here may claim to be the home page.
  h = h.replace(/^.*<link rel="canonical"[^>]*>\n/m, "");
  h = h.replace(/^.*<meta property="og:url"[^>]*>\n/m, "");
  h = h.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, "");
  h = h.replace(
    /<meta name="viewport"([^>]*)>/,
    `<meta name="viewport"$1>\n<meta name="robots" content="noindex,nofollow">`
  );
  if (!/name="robots" content="noindex,nofollow"/.test(h)) {
    throw new Error("robots meta was not inserted: the viewport tag moved");
  }
  if (/rel="canonical"|og:url|application\/ld\+json/.test(h)) {
    throw new Error("canonical, og:url or JSON-LD survived the strip");
  }

  // 2. Say what it is, so a screenshot of one cannot be taken for the site.
  h = h.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>Rip button sample ${s.label}: ${s.name} &mdash; Garbage Rips 585 home page</title>`
  );
  h = h.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="Temporary sample. The Garbage Rips 585 home page with candidate ${s.label}, ${s.name}, in place of the play button on every video. Not a real page of the site.">`
  );

  // 3. The control itself, in place of every play disc on the page.
  const before = (h.match(PLAY) || []).length;
  h = h.replace(PLAY, s.html);
  if ((h.match(PLAY) || []).length !== 0 || before !== nPlay) {
    throw new Error(`${s.label}: expected ${nPlay} play discs, replaced ${before}`);
  }

  // 4. The rules, last in <head>, after ui.css and after build-proto.mjs's own
  //    HOMECSS block, so source order decides at equal specificity.
  const style =
    `<style>\n/* ===== RIP BUTTON SAMPLE ${s.label}: ${s.name}. TEMPORARY. =====\n` +
    `   ${s.pitch}\n` +
    `   Written by scripts/gen-rip-samples.mjs. ui.css is NOT touched: this\n` +
    `   block is scoped to this one file and dies with it. */\n` +
    base + s.css + "\n" + barCss + `\n</style>\n`;
  h = h.replace(/<\/head>/, `${style}</head>`);

  // 5. The flip control, last thing in <body>.
  h = h.replace(/<\/body>/, `${barHtml(s, next)}\n</body>`);
  return h;
}

/* ==========================================================================
   THE SELF CHECK, AND IT RUNS BEFORE ANYTHING IS WRITTEN.

   A control that quietly ships an illegible label is worse than one that
   refuses to build, because the illegible one gets picked.

   THE ROWS THAT ARE GATED AND WHY EACH GATE IS THE ONE IT IS:
     - LABEL vs FILL. 11px bold, which is SMALL text under WCAG whatever the
       weight, so 4.5:1. This ratio is a constant: the fill is opaque, so no
       pack skin can move it. That is the whole reason these controls are
       opaque and the reason the number is worth printing once rather than
       nineteen times.
     - KEYLINE vs FILL and RING vs KEYLINE. 3:1, the graphical-object gate.
       These two are what make the SHAPE readable, and both are constants for
       the same reason. RING vs KEYLINE is the load bearing one: it is the pair
       that survives when the pack art matches one of them, which is the
       failure the white disc has today.
     - SEALED vs its chip, on C only.

   WHAT IS DELIBERATELY NOT GATED HERE: the control against the pack art. It
   cannot be, honestly. Sampled at the real tile size, every skin on this site
   puts both L=0.000 and L=1.000 pixels inside every one of these footprints,
   so a per-pixel worst case against the wrapper is 1:1 for ANY opaque colour
   including today's white, and gating it would fail every candidate including
   the one that shipped. The measurement that means something is the outer
   edge, and it is made in the browser against the real rendered page rather
   than asserted here.
   ========================================================================== */
console.log(`\n  RIP BUTTON SAMPLES. Palette read from public/assets/ui.css.`);
console.log(`  fill ${T.fill}  ink ${T.ink}  ring ${T.ring}  say ${T.say}\n`);
console.log("  Gate is 4.5:1 for the label (11px is small text) and 3:1 for an edge.\n");

const fails = [];
for (const s of CANDIDATES) {
  const rows = [
    ["label vs fill", T.ink, T.fill, 4.5],
    ["keyline vs fill", T.ink, T.fill, 3],
    ["ring vs keyline", T.ring, T.ink, 3],
  ];
  if (s.id === "c") rows.push(["SEALED vs chip", T.say, T.ink, 4.5]);
  const parts = rows.map(([n, a, b, g]) => {
    const r = ratio(a, b);
    if (r < g) fails.push(`${s.label} ${n}: ${fmt(r)} < ${g}:1`);
    return `${n} ${fmt(r).padStart(8)} ${r >= g ? "ok" : "FAIL"}`;
  });
  console.log(`  ${s.label}  ${s.name.padEnd(11)} ${parts.join("   ")}`);
}
if (fails.length) {
  throw new Error("contrast gate failed, nothing written:\n    " + fails.join("\n    "));
}
console.log();

for (let i = 0; i < CANDIDATES.length; i++) {
  const s = CANDIDATES[i];
  const next = CANDIDATES[(i + 1) % CANDIDATES.length];
  const out = build(s, next);
  await writeFile(join(ROOT, "public", s.file), out);
  console.log(
    `  wrote public/${s.file.padEnd(22)} ${(out.length / 1024).toFixed(1)}KB  ` +
    `${nPlay} controls  -> ${next.label}`
  );
}
console.log(`\n  TEMPORARY. Delete all ${CANDIDATES.length} files and this script before launch.`);
console.log("  ls public/preview-*.html is the check that cannot drift.\n");
