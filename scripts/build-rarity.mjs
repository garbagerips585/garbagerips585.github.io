#!/usr/bin/env node
// Build public/rarity.html: how to tell what a card is by looking at it.
//
//   node scripts/build-rarity.mjs
//
// For two audiences at once: someone who just opened their first pack, and
// someone who collected in 1999 or 2005 and has come back to a game with
// eleven rarities instead of three.
//
// EVERY SYMBOL ON THIS PAGE IS A REAL CARD, magnified at its printed corner,
// rather than an illustration of a symbol. That matters more than it sounds:
// the research behind this page checked actual card scans and found two things
// that widely-read guides state incorrectly.
//
//   1. The rarity symbol moved to the bottom LEFT at Sun & Moon in 2017, not
//      at Scarlet & Violet in 2023. Several guides say SV; one says modern
//      cards are bottom-right, which is backwards. Verified across Base Set,
//      EX, Diamond & Pearl, Black & White, XY (all bottom-right) and Sun &
//      Moon onward (all bottom-left), on Pokemon and Trainer cards both.
//   2. The Mega Hyper Rare symbol is a single four-pointed gold sparkle with a
//      heavy black outline, NOT three gold stars. At least one popular guide
//      says three stars. The cards say otherwise.
//
// Because those are checkable by anyone holding a card, the page shows the
// corner rather than asserting the fact.
//
// Things deliberately left off are listed in data/rarity.json. The short
// version: nothing goes on this page that could not be verified, because the
// entire value of a beginner's guide is that a beginner cannot tell when it is
// wrong.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SITE } from "../shared/site.mjs";
import { faqBlock, FAQ_CSS } from "../shared/faq.mjs";
import { priceNote, priceFooter, priceRead } from "../shared/card-prices.mjs";
// NEITHER packplayer.js NOR packs.css. Nothing on this page plays a rip where
// it sits, so both attach to nothing: ~11.9KB gzipped and 2 requests for a
// script that finds no tile and a stylesheet whose classes never appear.
// CHECKED BY DRIVING THE PAGE, not by grepping it: packplayer's entry point is
// a delegated click on an <a> to a rip that WRAPS an <img> or a .pack facade,
// which no scan for [data-vcar] or img[data-packsrc] can see. The three
// conditions a page must meet, and why the obvious scan gives the wrong answer,
// are in shared/chrome.mjs beside the two exports. READ THAT BEFORE ADDING A
// VIDEO TILE OR A CAROUSEL HERE: a tile added without putting packplayer.js
// back navigates instead of playing in place, which reads as a design choice
// rather than as a bug.
import {
  BAR, MENU, SPRITE, SKIP, footer, FONTS,
  STYLES_NO_PACKS_CSS as STYLES,
  APP_JS_NO_PACKPLAYER as APP_JS,
} from "../shared/chrome.mjs";
import { esc, longDate, imgDims, avifPicture, moneyCompact } from "../shared/format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const d = JSON.parse(await readFile(join(ROOT, "data/rarity.json"), "utf8"));

/* ------------------------------------------------- a real one, out of a pack
 *
 * WHAT THIS PAGE COULD SAY THAT NO OTHER RARITY GUIDE CAN. Every site explains
 * the star symbols. This one is written by somebody who opens the packs, and
 * until now the page never said so: ten rungs of explanation, a magnified
 * corner on each, and not one link to a video of one of these actually coming
 * out of a wrapper.
 *
 * THE SOURCE IS data/hits.json, NOT THE `pulls` TAGS, and the difference
 * matters. `pulls` is DERIVED FROM VIDEO TITLES by shared/taxonomy.mjs, and
 * build-luck.mjs spells out why that is unsafe: a title is not a record of
 * what came out, and the Ultra Rare pattern matches a title that says there
 * was no Ultra Rare in it. hits.json is Tim's own per-card log, keyed by video
 * id, with the rarity written by hand. It is the same file the Hall of Fame is
 * built from and it cannot claim a card the channel did not pull.
 *
 * FIVE OF THE TEN RUNGS HAVE ONE TODAY, and the other five render nothing at
 * all rather than borrowing a neighbouring tier's card. The rarity strings in
 * hits.json are already the ladder's own names, so this is an exact match on a
 * label and not a fuzzy one; a rung with no hit is simply a rung the channel
 * has not pulled yet.
 *
 * TEXT, NOT A TILE. See the note beside the chrome imports above: this page
 * ships without packplayer.js, so a video tile here would navigate rather than
 * play in place, which reads as a bug. The line links the rip page, where the
 * pack wrapper and the player live.
 */
const pulledAt = await (async () => {
  const hits = JSON.parse(await readFile(join(ROOT, "data/hits.json"), "utf8")).videos || {};
  const byId = new Map(
    (JSON.parse(await readFile(join(ROOT, "public/data/videos.json"), "utf8")).videos || [])
      .map((v) => [v.id, v]),
  );
  const out = new Map();
  for (const [vid, list] of Object.entries(hits)) {
    const v = byId.get(vid);
    if (!v?.path) continue;
    for (const h of list) {
      if (!h.rarity) continue;
      const prev = out.get(h.rarity);
      // NEWEST RIP WINS, so the page tracks the channel rather than freezing on
      // whichever hit happens to be first in the file. Four of the five tiers
      // resolve to one Costco UPC video today, which is honest: that is where
      // the cards came from.
      if (prev && String(prev.v.published || "") >= String(v.published || "")) continue;
      out.set(h.rarity, { card: h.card, set: h.setName || null, v });
    }
  }
  return out;
})();

/* ------------------------------------------------- prices, not price WORDS --
 *
 * NO PRICE ON THIS PAGE IS TYPED INTO data/rarity.json ANY MORE.
 *
 * The "Hit" entry read "Umbreon ex, Prismatic Evolutions. $1,470" as a literal
 * string, and $1,470 is not what the site says that card is worth: the
 * checklist holds $1,470.58, /complete-a-set.html and every other page that
 * prints it round to $1,471 through moneyCompact, and this one was a hand typed
 * truncation that happened to look like a rounding bug. It was also frozen: the
 * card moves and the sentence would not, which is the failure this whole
 * codebase is built to avoid.
 *
 * So an entry names the CARD it is quoting, `"priceOf": {"set", "number"}`, and
 * the figure is read out of the same checklist /sets/ and /cards.html read and
 * formatted with the same function they format it with. Two pages can no longer
 * disagree about one card because there is only one number now.
 *
 * A card with no market price yet (the newest sets ship without one for weeks)
 * simply keeps its example sentence with no figure appended, which is the same
 * thing the set pages do. Applied to any entry anywhere in the file that
 * carries `priceOf`, so the ladder and the "came and went" list can use it too.
 */
const checklists = new Map();
// THIS PAGE PRINTED A PRICE WITH NO SOURCE AND NO DATE ON IT, which is the one
// thing the rest of the site never does: the ladder's example cards each carry a
// figure ("Umbreon ex, Prismatic Evolutions. $1,499") and nothing anywhere said
// where it came from or when it was read. Found in the 18 August 2026 sourcing
// sweep. The stamps are collected here, from the same files the figures come
// from, so the note at the foot cannot drift from the numbers above it.
let priceDoc = null;
async function priceFor(ref) {
  if (!ref?.set || !ref?.number) return null;
  if (!checklists.has(ref.set)) {
    try {
      const doc = JSON.parse(
        await readFile(join(ROOT, `public/data/cards/${ref.set}.json`), "utf8")
      );
      checklists.set(ref.set, doc.cards);
      if (!priceDoc)
        priceDoc = {
          priceSource: doc.priceSource,
          pricesChecked: doc.pricesChecked,
          checked: doc.checked,
          // Left at zero on purpose: this page prints a handful of named example
          // cards rather than a whole checklist, and every one of them resolved
          // through PriceCharting. A fallback count borrowed from the whole file
          // would be describing cards this page never shows.
          pricedBy: { pricecharting: 0, tcgdex: 0 },
        };
    } catch {
      checklists.set(ref.set, null);
    }
  }
  const c = (checklists.get(ref.set) || []).find((x) => String(x.n) === String(ref.number));
  return typeof c?.price === "number" ? c.price : null;
}
for (const group of [d.ladder, d.offLadder, d.slang, d.gone, [d.eras?.old, d.eras?.new]]) {
  for (const e of group || []) {
    if (!e?.priceOf) continue;
    const p = await priceFor(e.priceOf);
    if (p !== null) e.example = `${e.example}. ${moneyCompact(p)}`;
  }
}

// COUNTED, NOT TYPED. The intro said "stars for five different rarities" while
// the ladder below it lists six: Rare, Double Rare, Ultra Rare, Illustration
// Rare, Special Illustration Rare and Hyper Rare. Mega Hyper Rare is the one
// that is NOT a star, it is a sparkle, which is presumably where five came
// from. Counting the ladder means the sentence follows the data.
const starRarities = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"][
  d.ladder.filter((x) => /star/i.test(x.symbol || "")).length
];

/* ------------------------------------------------- card art, right-sized --
 *
 * THIS PAGE MOVED 2,253KB OF CARD SCANS to paint boxes 132 and 150px wide.
 * Measured at 390x844 and 1440x900: 2,522KB total transfer, 89% of it images,
 * on a page whose largest rendered card art is 150 CSS px.
 *
 * The figures are capped in the stylesheet and the caps do not move with the
 * viewport, measured at 360/390/560/768/900/1100/1440/1920:
 *
 *   .gone-fig img    132px at every width
 *   .gloss-fig img   132px at every width
 *   .ex-fig img      150px at every width
 *   .rr-card img      96px narrow, 120px from 900 up
 *
 * TCGdex's low.webp is 245x337 and about 25KB against high.webp's 600x825 and
 * 100-205KB, so 245 covers every one of those boxes at 2x, and the srcset has
 * two candidates because TCGdex publishes exactly two WIDTHS. It publishes four
 * FORMATS at each of them, which is the other half of this and lives in
 * avifPicture: same pixels, 35% fewer bytes.
 *
 * BUT NOT EVERY IMAGE HERE CAN TAKE THE SMALL ONE, and getting that wrong makes
 * the page HEAVIER. Ten of the 27 card URLs are used twice: once as an <img>
 * and once inside a magnified `.crop`, which paints the source at its own 600px
 * width on purpose (see SRC_W below). Give one of those an srcset that resolves
 * to low.webp and the browser fetches the small file for the img AND the big one
 * for the crop: two requests where there was one. CROP_CARDS is built from the
 * same data the crops are, and anything in it keeps high.webp.
 *
 * The ladder is why nine of those ten exist: every ladder row shows the card and
 * then magnifies its corner, so .rr-card cannot be downsized while that is true.
 *
 * WHAT THIS DOES AND DOES NOT BUY. This paragraph used to end "first-load
 * transfer is unchanged: the 2,253KB that lands on load is the crops, and the
 * crops are the page", and it was right about the cause and wrong about the
 * conclusion. Every FIGURE here was already lazy; the CROPS were not, because
 * they were CSS backgrounds and a background cannot be. They are <img> now and
 * the 2,245KB is no longer on the load path. See `corner` below.
 */
const CROP_CARDS = new Set([
  ...d.ladder.map((r) => r.card),
  // offLadder rows are built exactly like a ladder row: the card AND its
  // magnified corner, from the same url. Miss them here and each one costs two
  // requests instead of one, which is the trap the paragraph above describes.
  ...(d.offLadder || []).map((r) => r.card),
  d.eras?.old?.card,
  d.eras?.new?.card,
  ...d.slang.filter((s) => s.show === "crop").map((s) => s.card),
].filter(Boolean));

const TCGDEX_HIGH = /^(https:\/\/assets\.tcgdex\.net\/.+)\/high\.webp$/;
/**
 * A whole card scan, as a tag. `size` is the CSS cap in px, `dims` the
 * width/height pair from imgDims.
 *
 * This used to hand back `{src, extra}` for the caller to assemble, and all
 * five callers then called it TWICE on the same url to get both halves. Two
 * calls that have to agree is a drift waiting to happen, and it also meant
 * there was no single place to wrap the result, which is what the AVIF source
 * needs.
 */
function cardArt(url, size, alt, dims) {
  const m = TCGDEX_HIGH.exec(url || "");
  const small = m && !CROP_CARDS.has(url);
  const src = small ? `${m[1]}/low.webp` : url;
  const extra = small ? ` srcset="${esc(src)} 245w, ${esc(url)} 600w" sizes="${size}px"` : "";
  return avifPicture(
    `<img src="${esc(src)}"${extra} alt="${esc(alt)}" loading="lazy" onerror="this.remove()" decoding="async"${dims}>`,
  );
}


/**
 * A magnified crop of a card's bottom corner.
 *
 * The card is pinned to the corner the symbol actually sits in, so what you see
 * is the real printing.
 *
 * THE MAGNIFICATION IS IN PIXELS, NOT PER CENT, AND THAT IS THE WHOLE POINT.
 *
 * Almost every card here is a TCGdex `high.webp`, and TCGdex offers exactly two
 * sizes: low is 245x337 and high is 600x825. 600px is the ceiling, measured
 * rather than assumed, and there is no third size to ask for. The one exception
 * is the Mega Hyper Rare, which comes from Scrydex at 712x997, so 600 is inside
 * that one too.
 *
 * THE SCRYDEX PNG STAYS, and it is the single heaviest file on the site: 1,075KB
 * for one card, against 50KB for TCGdex's WebP of the SAME card (me05-120, Mega
 * Darkrai ex 120/084). Swapping it was tried and rejected on the pictures, which
 * are in the git history of this comment if you want them. TCGdex's scan of that
 * card is a flat, blown-out yellow: the etched gold is gone and the sparkle's
 * outline reads thin and brownish. rarity.json's note on that exact row says the
 * symbol is "a single four pointed sparkle with a HEAVY BLACK OUTLINE, not three
 * stars: several guides get this wrong", and the figure exists to prove that
 * sentence to somebody holding the card. A scan that softens the outline argues
 * against the caption above it, and 1,024KB is not worth a figure that no longer
 * demonstrates its own claim. Scrydex publishes no WebP or AVIF (`large.webp`
 * 400s, an Accept header changes nothing, resize params are ignored) and its
 * /medium is 365px, which this crop would have to upscale 1.6x.
 * It is lazy now, so nobody pays for it unless they scroll to that row. If you
 * want the bytes back, the honest route is re-encoding that one scan and serving
 * it ourselves, which is a redistribution decision rather than a perf one.
 *
 * This used to say `background-size: 340%`, a percentage of a box that grows
 * with the viewport. On a 1280px screen the two "which corner" figures are 570px
 * wide, so the browser was being told to paint a 600px scan at 1938px: a 3.2x
 * upscale in CSS pixels and 6.5x on a retina screen. That adds no detail, only
 * blur, and it got worse the bigger the screen, which is exactly backwards.
 *
 * Setting the size to the source's own width means the scan is never painted
 * larger than it was made, at any viewport. The box then decides how MUCH of the
 * card you see rather than how badly it is stretched, and `.crop` is capped in
 * the stylesheet so it stays a corner rather than the whole bottom edge.
 *
 * The two sides need different framing. On a bottom-RIGHT card the symbol is the
 * last thing on the row, so pinning hard right catches it. On a bottom-LEFT card
 * the symbol sits at the END of the left-hand group, after the illustrator
 * credit, regulation mark, set code and number, so pinning hard left cuts the
 * symbol off at the edge: the one thing the crop exists to show. A small
 * percentage lands the whole group in view and, because the offset is measured
 * against (box - image) and the image is now the fixed side, it frames the same
 * part of the card whatever the box is doing.
 *
 * ---- IT IS AN <img> NOW, AND THAT IS THE WHOLE POINT ----
 *
 * These fourteen crops used to be CSS `background-image`, and a background has
 * no `loading` attribute. Every one of them was fetched at first paint whether
 * or not it was anywhere near the screen, which on a page this long is thirteen
 * full-size scans nobody has scrolled to: 2,245KB of the 2,535KB that landed at
 * 1440x900. That is why the previous pass concluded the crops could not be made
 * cheaper. They could not be made SMALLER, which is true and still is. They can
 * be made LATER.
 *
 * So the background moves onto a real `<img loading="lazy">` inside the same
 * box, positioned to paint the identical pixels:
 *
 *   background-size: 600px auto      ->  width:600px; height:auto
 *   background-position: X 100%      ->  bottom:0; left:calc(X - X*600px/100%)
 *   background-repeat: no-repeat     ->  an element repeats zero times
 *   (the box)                        ->  position:relative; overflow:hidden
 *
 * The `left` maths is the one bit worth spelling out. A percentage background
 * position resolves against (box - image), so 8% means 0.08*(B - 600) and 100%
 * means (B - 600). An absolutely positioned `left` percentage resolves against
 * B alone, so the same offsets are `calc(8% - 48px)` and `calc(100% - 600px)`.
 * Those are identities, not approximations, and they hold at every box width,
 * which matters because .crop is fluid up to its 320px cap.
 *
 * `max-width:none` is not optional: ui.css sets `img{max-width:100%}` globally,
 * which would shrink a 600px image into a 320px box and undo the magnification
 * this figure exists for. It fails by looking almost right, so it is easy to
 * miss: you get the whole bottom of the card, small, instead of the corner.
 */
const SRC_W = 600; // px, and no wider than the narrowest source. See above.
const CROP = {
  // `off` is the CSS `left` that reproduces this background-position exactly.
  right: { cls: "cr-r", off: `calc(100% - ${SRC_W}px)` },
  left: { cls: "cr-l", off: `calc(8% - ${SRC_W * 0.08}px)` },
};
/*
 * `eager` IS FOR THE TWO CROPS IN THE FIRST SCREEN AND FOR NOTHING ELSE, and it
 * does NOT undo the change argued above.
 *
 * Measured over CDP at 390x844 DPR 2, reading each img's own border box at
 * scroll 0: the two "which corner" figures are the only crops on this page a
 * reader can see without scrolling. `loading="lazy"` is a VERTICAL heuristic, so
 * an image already inside the viewport is fetched immediately anyway; what the
 * attribute actually costs there is the PRELOAD SCANNER, which is the only
 * chance the fetch had to start during the HTML parse instead of after layout.
 *
 * SO THIS MOVES NO BYTES ONTO THE LOAD PATH AND THAT WAS CHECKED RATHER THAN
 * ASSERTED: the on-load figure for this page is the same before and after,
 * because those two scans were always in the on-load number. The 2.1MB the
 * entry in CLAUDE.md is about is the OTHER eleven crops, and every one of them
 * still carries the attribute.
 */
const corner = (card, side, label, { eager = false } = {}) => `<figure class="crop">
        <div class="crop-img ${CROP[side].cls}">${avifPicture(
          // alt="" on purpose: the figcaption right below already names the card
          // and the set, so alt text here would read the same thing twice.
          `<img src="${esc(card)}" alt=""${eager ? "" : ` loading="lazy"`} decoding="async" onerror="this.remove()"${imgDims(card)}>`,
        )}</div>
        <figcaption>${esc(label)}</figcaption>
      </figure>`;

/**
 * One glossary term, with a real card where an honest one exists.
 *
 * `show` picks the treatment: "card" for the whole card, "crop" for the
 * magnified bottom-left corner where the thing being described is a number or
 * a letter too small to read at card size, absent where no honest picture
 * exists. Three terms have none on purpose and rarity.json says why; the point
 * is that a missing image here is a decision, so do not "fix" one by reaching
 * for a stock photo.
 *
 * The caption names the card and set every time. It is what makes the example
 * checkable rather than decorative, and it is the same reason the ladder above
 * carries `example`.
 */

/**
 * A slab, drawn rather than photographed.
 *
 * We own no graded cards and will not use a grading company's product shot, so
 * this is a schematic and is captioned as one. It can do something a photo
 * cannot anyway: point at the three parts that matter, the grade, the cert
 * number and the seal, instead of leaving a reader to work out which bit of a
 * glossy product image is the point.
 *
 * Colours come from the site palette, not from any company's branding, and it
 * carries no company name. It is a slab, not a PSA slab.
 */
const slabDiagram = () => `<figure class="gloss-fig is-diagram">
            <svg viewBox="0 0 220 300" role="img" aria-label="Diagram of a graded card in a sealed holder, showing the grade, the certification number and the sealed edge">
              <!-- LITERALS, AND THEY HAVE TO BE. These are SVG presentation
                   attributes, and var() is not honoured in one: a fill of
                   var(--ink) written as an attribute is not a fallback to
                   something, it paints nothing. NO BACKTICKS IN HERE EITHER:
                   this block sits inside a JS template literal and one backtick
                   ends the string, which is how this comment broke the build
                   the first time it was written. So the palette
                   is transcribed here by hand and this block has to be updated by
                   hand when the palette moves.

                   THE SLAB PAINTS ITS OWN LIGHT PLATE AND THAT IS WHY THIS
                   BLOCK SURVIVED "Trubbish Deep" ALMOST INTACT. Everything in
                   here is drawn on #E6E4DD or on a panel laid over it, not on
                   the figure ground, so the dark ink stayed dark. Re-measured
                   against the plate rather than against the card: the black
                   type is 14.84:1, the dashed inner rule 3.57:1, the small
                   grey type on the card window 5.90:1. And the plate itself
                   reads 7.18:1 against the new #2F4F39 card, so the SILHOUETTE
                   is now carried by the fill where it used to be carried by
                   the outline. The outline's outer half does disappear into
                   the dark ground at 1.22:1 and it was left alone deliberately:
                   repainting it light would erase the crisp inner edge the plate
                   still needs, to fix a silhouette that is not broken.

                   ONE MARK DID CHANGE. The sealed-edge ticks were --gold-deep
                   #6E5000, 5.87:1 on the plate. Gold is out of the palette
                   entirely and NO teal in it reads on a cream plate: --gold is
                   2.37:1 there, --mustard 1.77 and --gold-deep 1.59, all under
                   the 3:1 a graphical mark needs. They are --paper-3 #405D49
                   now, 5.73:1, which lands within a tenth of what the gold
                   measured and is still a different hue from the near-black
                   type beside it, which was the whole reason the tick was not
                   drawn in ink in the first place.

                   The values below are ui.css's --paper-3, --keyline, a mid
                   grey, --paper, --sky-tint, --sky-deep and --paper-3 again,
                   in that order of appearance. Before "Black / White / Gold"
                   they were #EDE6CB, #15263A, #9FB0C0, #F7F2DE, #DCF2FB,
                   #0E6E96 and #D9482B. -->
              <rect x="6" y="6" width="208" height="288" rx="10" fill="#E6E4DD" stroke="#111111" stroke-width="3"/>
              <rect x="14" y="14" width="192" height="272" rx="7" fill="none" stroke="#767676" stroke-width="1.5" stroke-dasharray="4 4"/>
              <rect x="24" y="26" width="172" height="58" rx="4" fill="#F4F3EF" stroke="#111111" stroke-width="2"/>
              <!-- All the small type in here was #5A6150, the olive meant for the
                   cream page. On the slab's own fills it measured 2.79:1 (CARD NAME
                   & SET), 3.11:1 (the sealed-edge line) and 4.10:1 (GRADE), all under
                   the 4.5:1 AA needs. The palette moved to greys since, so the figure below is the old one:
                   #111111 is the ink already used for GEM MT 10 in the same diagram
                   and measures 14.84:1 on the worst of these fills now.
                   The 7px labels also go to 8px: the viewBox is 220 wide and renders
                   at 132px, so 7px in the box is about 4.2 real pixels. -->
              <text x="34" y="46" font-family="monospace" font-size="9" fill="#111111">CARD NAME &amp; SET</text>
              ${/* GEM MT 10, NOT "MINT 10", AND THE OLD LABEL WAS A REAL ERROR.
                    PSA prints GEM MT on a 10 and MINT on a NINE, so this diagram
                    was showing a beginner a grade label that PSA has never
                    printed, on the one page whose own header says it exists
                    because "a beginner cannot tell when a guide is wrong".
                    Caught 24 August 2026 while sourcing a photograph to replace
                    this schematic. */ ""}
              <text x="34" y="72" font-family="monospace" font-size="22" font-weight="bold" fill="#111111">GEM MT 10</text>
              <text x="150" y="72" font-family="monospace" font-size="8" fill="#111111">GRADE</text>
              <text x="34" y="83" font-family="monospace" font-size="8" fill="#111111">CERT 000000000</text>
              <rect x="34" y="96" width="152" height="176" rx="4" fill="#F1EFE8" stroke="#5B5B5B" stroke-width="2"/>
              <text x="110" y="190" font-family="monospace" font-size="9" fill="#5B5B5B" text-anchor="middle">the card, sealed inside</text>
              <path d="M6 150 L14 150 M206 150 L214 150" stroke="#405D49" stroke-width="3"/>
              <text x="110" y="292" font-family="monospace" font-size="8" fill="#111111" text-anchor="middle">sealed edge: opening it voids the grade</text>
            </svg>
            <figcaption>A schematic, not a photo of a real slab</figcaption>
          </figure>`;

const slangCard = (s) => {
  const art = s.show === "diagram"
    ? slabDiagram()
    : !s.card
    ? ""
    : s.show === "crop"
      ? `<div class="gloss-fig is-crop">${corner(s.card, "left", s.example)}</div>`
      : `<figure class="gloss-fig">
            ${cardArt(s.card, 132, /* alt="" - the caption below repeats this string exactly */ "", imgDims(s.card))}
            <figcaption>${esc(s.example)}</figcaption>
          </figure>`;
  return `        <li${s.card ? "" : ' class="no-fig"'}>
          <b>${esc(s.term)}</b>
          <p>${esc(s.meaning)}</p>
          ${art}
        </li>`;
};


// ---------------------------------------------------------------------------
// THE .rr LADDER ROW'S GUTTER RULES. This sits here, as a JS comment, and not
// beside the declarations in the style block below, because that block ships to
// the browser verbatim: nothing strips comments out of a page-level <style> the
// way build-css.mjs strips them out of ui.css, so prose written in there is
// render-blocking page weight on this page. Measured: this note cost 1,411
// bytes gzipped on /rarity.html when it lived in the CSS.
//
// min-width:0 IS A GUTTER FIX AND IT IS THE SAME BUG ui.css RECORDS ON .hitcard
// AND .fact. The 1fr third track of .rr has a default minimum of MIN-CONTENT,
// so the widest unbreakable word in the body sets the track rather than the
// space left over. Measured on this page at 320 before the fix: seven rows
// computed 34px 96px 92px as intended and THREE came out 109.562px and 115px,
// which pushed the h3, the description, the example line and the magnified
// corner up to 6px past the wrap's right edge while the <li> box itself stayed
// pinned at 16..304. The row is a flex child, so nothing widened visibly and
// the page never scrolled sideways: only the contents hung over.
// The words are display-font headings in Titan One at var(--t-m), and the
// overflow-wrap on the heading is what gives the browser somewhere to break so
// min-width:0 has an effect at min-content rather than just relocating the
// overflow. anywhere and not break-word: only anywhere is honoured when the
// browser computes the min-content the track is sized from.
//
// THOSE TWO STOP THE GUTTER FAULT AND ON THEIR OWN THEY LOOK BAD, WHICH IS WHY
// THE max-width:380 MEDIA QUERY IN THE STYLE BLOCK IS THE REAL FIX. With just the pair above,
// 320px rendered the heading "Uncommon" as "Uncom" over "mon". That is not a
// near miss, it is the column being genuinely too small: the body track solves
// to W - 236 (the two 20px gutters, 32px of card padding, 2px of border, and
// the 34 + 16 + 96 + 16 of number, gap, card and gap), so it is 84px at 320,
// and the widest word on the page is "Illustration" at 115.0px with "Uncommon"
// at 109.6. No amount of breaking makes 115px of one word fit 84px of column.
//
// SO BELOW 380px THE BODY TAKES ITS OWN ROW, which is the pattern .rr-zoom
// already uses on this same grid. The body gets the full 246px at 320 and
// nothing breaks mid-word at any width. 380 is chosen off the arithmetic
// rather than picked, and both sides of it were then MEASURED rather than
// trusted: at 381 the row is still three columns and the body track is
// 145.0px against that 115px word, at 380 it stacks and the body is 306.0px.
// So the breakpoint sits exactly where the column stops being able to hold
// the content with headroom, and 390 was never affected either way.
// THE PAIR ABOVE STAYS ANYWAY. They are what makes it impossible for this row
// to reach the gutter again if a future rarity name is longer than any of
// today's, and with the stack in place neither of them has to fire on the
// content the page actually has.
// ---------------------------------------------------------------------------
const ladderRow = (r, i) => `      <li class="rr${r.chase ? " is-chase" : ""}">
        <div class="rr-n">${i + 1}</div>
        <div class="rr-card">
          ${cardArt(r.card, 120, /* alt="" - .rr-eg below prints r.example */ "", imgDims(r.card))}
        </div>
        <div class="rr-body">
          <h3>${esc(r.name)}${r.chase ? ` <span class="rr-chase">worth chasing</span>` : ""}</h3>
          <p class="rr-sym"><b>${esc(r.symbol)}</b></p>
          <p class="rr-look">${esc(r.look)}</p>
          ${r.note ? `<p class="rr-note">${esc(r.note)}</p>` : ""}
          <p class="rr-eg">${esc(r.example)}</p>
          ${pulledAt.has(r.name)
            ? `<p class="rr-pulled"><a href="/${esc(pulledAt.get(r.name).v.path)}">We pulled one on camera:
                <b>${esc(pulledAt.get(r.name).card)}</b>${
                  pulledAt.get(r.name).set ? `, ${esc(pulledAt.get(r.name).set)}` : ""
                }</a></p>`
            : ""}
        </div>
        <div class="rr-zoom">
          ${corner(r.card, "left", "the corner, magnified")}
        </div>
      </li>`;

/**
 * One rarity that this site's own checklists print but the ladder does not
 * cover.
 *
 * WHY THIS SECTION EXISTS AT ALL. The ladder answers "what are the tiers a
 * modern pack prints", which is the right question for the person this page is
 * for. It is not the same question as "what could the corner of a card in my
 * hand say", and the gap between those two is where a beginner's guide fails
 * silently: the reader looks up the words on the set page, finds nothing, and
 * has no way to tell whether the guide is incomplete or they misread the card.
 * Measured across public/data/cards on 15 August 2026, two names were in that
 * gap, Holo Rare on 88 cards and Black White Rare on 4.
 *
 * Same treatment as a ladder row, card plus magnified corner, because in both
 * cases the whole claim is about a symbol: one says the second star is hollow,
 * the other says the star is the SAME one a plain Rare prints. Neither is
 * worth asserting on this page without the corner underneath it.
 *
 * A ROW IS NOT A LADDER ROW, so it does not reuse .rr. `.rr-sym` and `.rr-eg`
 * are single-class rules and anything scoped like `.offl-body p` would beat
 * them and quietly drop the plum and the mono, so this block declares its own
 * and touches no bare tag selectors. See the .crop comment for the same bug
 * caught the other way round.
 */
const offLadderRow = (r) => `      <li>
        <div class="offl-card">
          ${cardArt(r.card, 120, r.example, imgDims(r.card))}
        </div>
        <div class="offl-body">
          <h3>${esc(r.name)} <span class="offl-flag">${esc(r.flag)}</span></h3>
          <p class="offl-sym"><b>${esc(r.symbol)}</b></p>
          <p class="offl-p">${esc(r.body)}</p>
          <p class="offl-p">${esc(r.ladder)}</p>
          <p class="offl-eg">${esc(r.era)}</p>
        </div>
        <div class="offl-zoom">
          ${corner(r.card, "left", r.example)}
        </div>
      </li>`;

const style = `
.rg{padding:var(--s7) 0 var(--s5)}
.rg-lede{font-size:var(--t-lede);color:var(--ink-2);max-width:42em;margin-bottom:var(--s5)}
.rg h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s3)}
.rg-sec{padding:var(--s6) 0}
.rg-sec h2{font:400 var(--t-l)/1.15 var(--display);margin-bottom:var(--s3)}
.rg-p{color:var(--ink-2);max-width:46em;margin-bottom:var(--s4)}

/* The magnified corner. A background image pinned to the corner the symbol is
   actually printed in, so it is the real card rather than a drawing of one.

   CAPPED AT THE SOURCE WIDTH ON PURPOSE. The scan is 600px wide and is painted
   at 600px (see SRC_W in this script), so a box any wider than that would just
   add empty card either side of the corner, and a box that stretched the scan to
   fill itself would be the upscale this cap exists to stop. 320px shows a bit
   over half the card's width, which is the whole bottom-left group and then
   some, at every pixel of detail the source actually has. */
.crop{border:2px solid var(--ink);border-radius:var(--r);overflow:hidden;background:var(--card);
  max-width:320px}
/* The window. The scan inside it is a lazy <img> pinned to the corner, not a
   background: see the 'corner' function in build-rarity.mjs for why, and for
   the identity that turns background-position into 'left'. */
.crop-img{position:relative;aspect-ratio:16/5;overflow:hidden;background:var(--card)}
/* .crop .crop-img, not .crop-img, AND THAT IS NOT TIDINESS.
   Moving the scan from a background to an <img> put it in reach of every
   container-img rule on this page for the first time. .gloss-fig img is
   width:100%;max-width:132px and sits LATER in this stylesheet at the same
   (0,1,1) specificity, so it won, and the eleven glossary crops each painted a
   whole card shrunk to 132px instead of a magnified corner. The page still
   looked fine at a glance: a card in a box, just the wrong picture, with the
   caption underneath still promising the corner. The extra class takes these to
   (0,2,1) so they beat any single-class img rule here or added later.
   The border, radius and background are reset for the same reason: .gloss-fig
   img donates all three, and .crop already draws its own frame. */
.crop .crop-img img{position:absolute;bottom:0;width:${SRC_W}px;height:auto;max-width:none;
  border:0;border-radius:0;background:none}
.crop .cr-r img{left:${CROP.right.off}}
.crop .cr-l img{left:${CROP.left.off}}
.crop figcaption{font:700 var(--t-micro)/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;
  color:var(--ink-2);padding:8px var(--s3);border-top:1px solid var(--hair);background:var(--page)}

/* Where is it? Two eras side by side. */
.era{display:grid;grid-template-columns:1fr 1fr;gap:var(--s4)}
@media(max-width:640px){.era{grid-template-columns:1fr}}
.era-one{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
.era-one h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:4px}
.era-one .who{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;
  text-transform:uppercase;margin-bottom:var(--s3)}
.era-one .crop{margin-bottom:var(--s3)}

/* The two-step rule, as a thing you can actually follow. */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin:var(--s5) 0}
@media(max-width:760px){.steps{grid-template-columns:1fr}}
.step{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.step b{display:block;font:400 var(--t-l)/1 var(--display);color:var(--ketchup-deep);margin-bottom:6px}
.step h3{font:700 var(--t-body)/1.3 var(--body);margin-bottom:6px}
.step p{color:var(--ink-2);font-size:var(--t-sm)}

.tip{background:var(--mustard);border:2px solid var(--gold-deep);border-radius:var(--r);
  padding:var(--s5);margin:var(--s5) 0}
/* BOTH LINES BELOW NAME --on-accent AND NEITHER USED TO. .tip is a filled
   accent panel, and --mustard is a LIGHT teal now, so the heading inherited
   --ink and the paragraph asked for it outright: #EEF1EF on #70B5D9, 1.99:1,
   a near-white panel with near-white writing on it. --on-accent is the token
   ui.css defines for text drawn on the gold and mustard fills and it measures
   7.22:1 here. The heading needs its own declaration because it inherits from
   the page rather than from .tip's own colour. */
.tip h3{font:400 var(--t-m)/1.15 var(--display);color:var(--on-accent);margin-bottom:6px}
.tip p{color:var(--on-accent);max-width:48em}
/* The 12% black wash SURVIVED THE REPAINT and was checked rather than assumed:
   it sat on #E8B93A at 1.29:1 and sits on #70B5D9 at 1.28:1, so the code chip
   is exactly as distinct from its panel as it ever was, and --on-accent still
   reads 5.62:1 on the washed patch. Left alone. */
.tip code{font:700 var(--t-sm)/1 var(--mono);background:rgba(0,0,0,.12);padding:2px 6px;border-radius:4px}

/* The ladder. */
.ladder{list-style:none;display:flex;flex-direction:column;gap:var(--s4)}
.rr{display:grid;grid-template-columns:34px 96px 1fr;gap:var(--s4);align-items:start;
  background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
@media(min-width:820px){.rr{grid-template-columns:34px 120px 1fr 220px}}
.rr.is-chase{border-color:var(--gold-deep);box-shadow:0 4px 0 var(--gold-deep),var(--lift)}
.rr-n{font:400 var(--t-m)/1 var(--display);color:var(--ink-2);text-align:center;padding-top:4px}
.rr-card img{width:100%;height:auto;border-radius:6px;display:block}
/* The gutter rules for this row are argued in the JS comment above ladderRow. */
.rr-body,.offl li>div:last-child{min-width:0}
.rr-body h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:4px;overflow-wrap:anywhere}
/* Tracks unchanged, span only: see the note above ladderRow. */
@media(max-width:380px){
  .rr-body{grid-column:1/-1}
  .offl li>div:last-child{grid-column:1/-1}
}
.rr-chase{font:700 9px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  background:var(--mustard);border:1px solid var(--gold-deep);color:var(--on-accent);
  padding:4px 7px;border-radius:var(--r-pill);vertical-align:middle}
/* --on-accent, not --ink, for the same reason .tip carries it: this is a
   filled accent pill and --mustard is light. --ink measured 1.99:1 on it,
   --on-accent measures 7.22:1, and at 9px this is small text needing 4.5. */
.rr-sym{font:700 var(--t-sm)/1.4 var(--mono);color:var(--plum);margin-bottom:6px;letter-spacing:.03em}
.rr-look{color:var(--ink-2);font-size:var(--t-sm)}
.rr-note{font:700 var(--t-micro)/1.6 var(--mono);color:var(--plum);background:var(--lilac-pale);
  border-radius:calc(var(--r) - 8px);padding:8px var(--s3);margin-top:8px}
.rr-eg{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.04em;
  text-transform:uppercase;margin-top:8px}
/* THE ONE ON THIS PAGE THAT CAME OUT OF A PACK. See pulledAt at the top of
   this file for where it comes from and why it is not the pull tags.
   TEAL because it is a route, --sky-deep and not --sky because the type is
   small: 4.50:1 on --card #2F4F39 where --sky is 4.05:1 and fails. The card
   name inside it is --ink at 6.70:1 rather than a second accent, so the row
   still reads as one link with an emphasis in it rather than two colours
   arguing. 44px minimum because it is a tap target on a phone and the rest of
   this row is prose. */
.rr-pulled{margin-top:10px;font:400 var(--t-sm)/1.4 var(--body)}
.rr-pulled a{display:block;min-height:44px;color:var(--sky-deep)}
.rr-pulled a:hover,.rr-pulled a:focus-visible{text-decoration:underline}
.rr-pulled b{color:var(--ink);font-weight:600}
.rr-zoom{grid-column:1/-1}
@media(min-width:820px){.rr-zoom{grid-column:auto}}

/* Not on the ladder. Same shape as .rr minus the number column, and every
   selector carries its own class: see offLadderRow for why a bare p selector in
   here would silently unstyle the symbol line. */
.offl{list-style:none;display:flex;flex-direction:column;gap:var(--s4)}
.offl li{display:grid;grid-template-columns:96px 1fr;gap:var(--s4);align-items:start;
  background:var(--card);border:1px solid var(--hair);border-radius:var(--r);
  padding:var(--s4);box-shadow:var(--lift)}
@media(min-width:820px){.offl li{grid-template-columns:120px 1fr 220px}}
.offl-card img{width:100%;height:auto;border-radius:6px;display:block}
.offl-body h3{font:400 var(--t-m)/1.15 var(--display);margin-bottom:4px}
/* nowrap is load bearing at 390px: "still current" broke across two lines
   INSIDE the pill, so the border ran off the right edge of one line and picked
   up again on the next, which reads as a clipped box rather than a badge. As
   one unit it wraps whole onto its own line under the heading. */
.offl-flag{display:inline-block;white-space:nowrap;
  font:700 9px/1 var(--mono);letter-spacing:.08em;text-transform:uppercase;
  background:var(--page);border:1px solid var(--hair);color:var(--ink-2);
  padding:4px 7px;border-radius:var(--r-pill);vertical-align:middle}
.offl-sym{font:700 var(--t-sm)/1.4 var(--mono);color:var(--plum);margin-bottom:6px;letter-spacing:.03em}
.offl-p{color:var(--ink-2);font-size:var(--t-sm);margin-bottom:6px}
.offl-eg{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.04em;
  text-transform:uppercase;margin-top:8px}
.offl-zoom{grid-column:1/-1}
@media(min-width:820px){.offl-zoom{grid-column:auto}}

/* Returning collectors. */
/* The card sits under the years and above the prose: you see the three
   Charizards side by side first, which is the comparison, and read why after. */
.ex-fig{margin:var(--s3) 0}
.ex-fig img{display:block;width:100%;max-width:150px;height:auto;border-radius:6px;
  border:1px solid var(--hair);background:var(--page)}
.ex-fig figcaption{font:400 var(--t-micro)/1.45 var(--mono);color:var(--ink-2);margin-top:6px;min-height:2.9em}
.exs{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--s4);margin-bottom:var(--s5)}
@media(max-width:760px){.exs{grid-template-columns:1fr}}
.ex1{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s5);
  box-shadow:var(--lift)}
.ex1 b{display:block;font:400 var(--t-l)/1 var(--display);margin-bottom:4px}
.ex1 .yrs{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ketchup-deep);letter-spacing:.05em;
  text-transform:uppercase;margin-bottom:8px}
.ex1 p{color:var(--ink-2);font-size:var(--t-sm)}

.gone{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:var(--s3)}
.gone li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4)}
.gone b{display:block;font-weight:700}
.gone .yrs{font:700 var(--t-micro)/1.4 var(--mono);color:var(--ink-2);letter-spacing:.05em;margin:2px 0 6px}
.gone p{color:var(--ink-2);font-size:var(--t-sm)}
/* Same treatment as the glossary: flex column, figure pushed to the bottom, two
   caption lines reserved, so the cards land on a line across each row instead
   of stepping up and down with the length of the prose above them. */
.gone li{display:flex;flex-direction:column}
.gone-fig{margin:var(--s4) 0 0;padding-top:var(--s3);border-top:1px solid var(--hair);margin-top:auto}
.gone-fig img{display:block;width:100%;max-width:132px;height:auto;border-radius:6px;
  border:1px solid var(--hair);background:var(--page)}
.gone-fig figcaption{font:400 var(--t-micro)/1.45 var(--mono);color:var(--ink-2);margin-top:6px;min-height:2.9em}

.gloss{list-style:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s3)}
/* Flex column with the figure pushed to the bottom by margin-top:auto. Tiles in
   a row stretch to the tallest, and three terms carry no image at all, so
   without this the pictures sit at whatever height their own text ended at and
   the row of cards reads as ragged rather than as a row. */
.gloss li{background:var(--card);border:1px solid var(--hair);border-radius:var(--r);padding:var(--s4);
  display:flex;flex-direction:column}
.gloss b{font:700 var(--t-body)/1.3 var(--body);color:var(--ketchup-deep)}
.gloss p{color:var(--ink-2);font-size:var(--t-sm);margin-top:4px}
/* Every figure bottom-anchored, crops included. A crop is a wide short strip
   and a card is tall, so the two can never line up on their tops when they land
   in the same row; anchoring the bottoms is the alignment that holds for both. */
.gloss-fig{margin:var(--s4) 0 0;padding-top:var(--s3);border-top:1px solid var(--hair);margin-top:auto}
/* Capped rather than full width: a 600x825 scan at tile width makes every entry
   a foot tall and buries the definitions, which are still the point. */
.gloss-fig img{display:block;width:100%;max-width:132px;height:auto;border-radius:6px;
  border:1px solid var(--hair);background:var(--page)}
/* Two lines reserved whether the caption fills them or not. The figures are
   bottom-anchored, so a caption that wraps to two lines where its neighbor
   used one lifts that card 16px above the rest of the row. Reserving the space
   keeps the cards on a line across the row regardless of caption length. */
.gloss-fig figcaption{font:400 var(--t-micro)/1.45 var(--mono);color:var(--ink-2);margin-top:6px;
  min-height:2.9em}
/* The crop takes the tile's width up to the 320px cap on .crop, unlike the card
   images above it, which stop at 132px. It is a magnified corner and the corner
   is the point, so it gets every pixel the source has rather than being shrunk
   to match a thumbnail. */
.gloss-fig.is-crop .crop{margin-top:0}
/* No aspect override here any more. This said 16/6 back when the base was 16/7,
   to make the glossary strip the SHORTER of the two. The base is 16/5 now, so
   the same 16/6 would have quietly flipped that round and made it the taller
   one. One ratio for every crop is the thing that cannot drift. */

.rg-foot{font:700 var(--t-micro)/1.7 var(--mono);color:var(--ink-2);
  border-left:3px solid var(--lilac);padding-left:var(--s3);margin:var(--s6) 0;max-width:56em}

/* DESKTOP READING MEASURE. The caps above were written in em as if 1em were
   one character. It is not: Outfit runs 2.31 to 2.47 characters per em here,
   so 46em bought .rg-p 112 real characters a line at 1440. ui.css already caps
   main prose at var(--measure) and these rules only outranked it by landing
   after the stylesheet. All min-width:1000, ui.css's own desktop breakpoint,
   so the phone and the tablet range keep exactly the rules they had.

   .rg-foot IS DELIBERATELY NOT IN HERE AND ITS 56em IS NOT THE SAME MISTAKE.
   It is Space Mono at 11px, and mono runs about 1.77 characters per em rather
   than Outfit's 2.31, so its 616px box measures 81 to 87 real characters, not
   one line over 90. Capping it to 36em would take it to about 55 and make it
   worse. Same reason ui.css keeps .price-note on its own 52em: the font is
   what decides how many characters an em width buys, so a mono block does not
   join the shared number. Measured, 1440x900, 16 August 2026. */
@media(min-width:1000px){
.rg-lede,.rg-p,.tip p{max-width:var(--measure)}
}
${FAQ_CSS}
`;

/* THE SHORT ANSWERS, VISIBLE AND IN THE SCHEMA, FROM ONE ARRAY.
 *
 * These seven were in the FAQPage block and nowhere else until 21 August 2026:
 * an audit normalised every question and answer on the site and searched the
 * page's own rendered text for it, and this page scored 0 of 7 on both. The
 * long argument is in shared/faq.mjs; the short version is that Google asks
 * for the content to be visible and gives this site no rich result either way,
 * so invisible markup was pure downside.
 *
 * RENDERING THEM WAS THE RIGHT HALF OF THAT FIX HERE, not deleting them. The
 * same measurement asked how much of each answer the page ALREADY said, in
 * 6-word runs: this page came out at 4%, the lowest on the site. "Alt art is
 * collector slang rather than a printed rarity" and "a reverse holo Common is
 * still a Common" are the two things a beginner most often has wrong, the
 * ladder above never says either in those words, and both were written and
 * then hidden. 275 words of real copy that no reader could reach.
 *
 * ORDER IS THE READER'S, NOT THE SCHEMA'S: where the symbol is, then what the
 * stars mean, then the four names people arrive already confused by.
 */
const FAQ = faqBlock(
  [
    [
      "Where is the rarity symbol on a Pokemon card?",
      "In the bottom corner, next to the card number. On cards from Sun and Moon (2017) onward it is in the bottom left. On XY era cards and older it is in the bottom right.",
    ],
    [
      "What do the stars on a Pokemon card mean?",
      "Count them, then check the color. One black star is a Rare, two black stars a Double Rare, two silver stars an Ultra Rare, one gold star an Illustration Rare, two gold stars a Special Illustration Rare and three gold stars a Hyper Rare.",
    ],
    [
      "Does a reverse holo make a card rare?",
      "No. Reverse holo is a finish, not a rarity. The foil sits on everything except the artwork, and the card keeps whatever rarity symbol it was printed with. A reverse holo Common is still a Common.",
    ],
    [
      "What is an alt art Pokemon card?",
      "Alt art is collector slang rather than a printed rarity. It appears on no card and in no official rarity list. On a modern card it usually means an Illustration Rare or a Special Illustration Rare.",
    ],
    [
      "How do I know if a card is a secret rare?",
      "Its collector number is higher than the set total, for example 199/198. Secret rares are the Illustration Rare, Ultra Rare, Special Illustration Rare and Hyper Rare tiers.",
    ],
    // The two names a checklist on this site can show you that the ladder does
    // not name. Both answers restate data/rarity.json's offLadder entries, and
    // the sources for every claim in them are in that file.
    [
      "What is a Black White Rare Pokemon card?",
      "A rarity introduced with Scarlet and Violet Black Bolt and White Flare in July 2025. The card is a full art printed in a single color, black or white throughout, and the corner prints two stars: the first filled in and the second an outline. Only those two sets have it.",
    ],
    [
      "What is the difference between a Rare and a Holo Rare?",
      "The symbol is the same. Both print one black star in the corner. A Holo Rare has foil on the artwork window and a plain Rare does not. Sword and Shield checklists and older list the two separately, which is where the name comes from.",
    ],
  ],
  {
    heading: "The seven questions this page gets asked",
    path: "/rarity.html",
    site: SITE,
  }
);

const body = `
<main id="main">
  <section class="rg">
    <div class="wrap">
      ${/* THE H1 CARRIED NO TOPIC WORD AT ALL. "What have I actually got" names
          neither rarity nor cards nor Pokemon, so the biggest heading on the
          page was the one place a reader arriving from "pokemon card rarity
          symbols" could not confirm they had landed right, and the nav label
          ("Rarity guide") echoed nothing on the page it led to. The question
          voice is kept, the noun is put back in it, and the highlight moves
          onto the word that matters. The title is unchanged. */ ""}
      <div class="brk"><h1>What <span class="hl">rarity</span> have I got?</h1><span class="ln"></span></div>
      <p class="rg-lede">Every Pokemon card tells you how rare it is, in one corner, with one small
        symbol. Once you know where to look it takes about a second. Here is the corner, magnified,
        on real cards.</p>
    </div>
  </section>

  <section class="band rg-sec">
    <div class="wrap">
      <h2>First: <span class="hl">which corner</span></h2>${/* "the bit" is British for "the part", and this is the first sentence of
           the first section a beginner reads. It is not a word a -our/-ise sweep
           looks for, which is how it survived several. Same fix on
           /grading.html, /msrp.html, /how-many-packs.html and the trivia page. */ ""}
      <p class="rg-p">This is the part almost every guide online gets wrong, and it is easy to check
        yourself. The symbol moved from the bottom right to the bottom left in 2017, at Sun and Moon.
        Not at Scarlet and Violet, which is what you will usually be told.</p>
      <div class="era">
        <div class="era-one">
          <h3>Bottom right</h3>
          <p class="who">${esc(d.eras.old.set)} &bull; XY era and older</p>
          ${corner(d.eras.old.card, "right", `${d.eras.old.name}, bottom right corner`, { eager: true })}
          <p class="rg-p" style="margin:0">If the number and symbol are on the right, you are holding
            something from 2016 or earlier.</p>
        </div>
        <div class="era-one">
          <h3>Bottom left</h3>
          <p class="who">${esc(d.eras.new.set)} &bull; Sun and Moon onward</p>
          ${corner(d.eras.new.card, "left", `${d.eras.new.name}, bottom left corner`, { eager: true })}
          <p class="rg-p" style="margin:0">On the left, and it is 2017 or newer. Everything below is
            about these.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="rg-sec">
    <div class="wrap">
      <h2>Then: <span class="hl">count, then color</span></h2>
      <p class="rg-p">Modern sets use stars for ${starRarities} different rarities, which sounds impossible
        until you know the trick. It is two questions, in this order.</p>
      <div class="steps">
        <div class="step"><b>1</b><h3>How many?</h3><p>One, two or three. Count them before you look
          at anything else.</p></div>
        <div class="step"><b>2</b><h3>What color?</h3><p>Black, silvery white, or gold. Black is the
          ordinary game rarities, silver is a full art ex, gold is the collector tiers.</p></div>
        <div class="step"><b>3</b><h3>That is it</h3><p>Two black stars is a Double Rare. Two gold
          stars is a Special Illustration Rare. Same count, completely different card.</p></div>
      </div>

      <div class="tip">
        <h3>The shortcut that skips all of it</h3>
        <p>Look at the card number instead. If the left number is <b>bigger</b> than the right one,
          like <code>199/198</code>, it is a secret rare and it is one of the good ones. Cards inside
          the set total are the ordinary tiers. You can do this across a table without squinting.</p>
      </div>
    </div>
  </section>

  <section class="band rg-sec">
    <div class="wrap">
      <h2>The whole <span class="hl">ladder</span></h2>
      <p class="rg-p">Lowest to highest, as the modern sets print them. One thing worth knowing
        right away: this is not a price order. Illustration Rares usually sell for less than Ultra
        Rares, and Special Illustration Rares often beat everything except gold. Rarity ladder and
        value ladder are two different things.</p>
      <ul class="ladder">
${d.ladder.map(ladderRow).join("\n")}
      </ul>
    </div>
  </section>

  <section class="rg-sec">
    <div class="wrap">
      <h2>Corners the ladder <span class="hl">does not explain</span></h2>
      ${/* "One is on a set you can still buy" was here and it is a print status
           claim, which this site keeps in data/set-notes.json for a human and
           does not guess. Dates say the same thing without asserting it. */ ""}
      <p class="rg-p">Two names turn up on the set checklists here that are not rungs on the ladder
        above. One arrived in 2025, the other belongs to the older sets. If you looked up what you
        pulled and came back with nothing, it is probably one of these.</p>
      <ul class="offl">
${(d.offLadder || []).map(offLadderRow).join("\n")}
      </ul>
    </div>
  </section>

  ${/* NOT a .band. section.band draws a 3px border top AND bottom, so two in a
       row read as a 6px seam, and the ladder above is already one. */ ""}
  <section class="rg-sec">
    <div class="wrap">
      <h2>Shiny, but <span class="hl">not rare</span></h2>
      <p class="rg-p"><b>Reverse holo</b> is the one that catches everybody. The foil is on everything
        <em>except</em> the artwork, so the card looks shiny everywhere the picture is not.
        It does not change the
        card's rarity at all: a reverse holo Common still prints a black circle and is still a Common.
        A regular <b>holo</b> is the opposite, foil on the artwork window only.</p>
      <p class="rg-p"><b>"Alt art" is not a rarity.</b> It is not printed on any card and it is not in
        Pokemon's rarity list. It is collector slang, and on a modern card it almost always means an
        Illustration Rare or a Special Illustration Rare. Check the star color.</p>
      <p class="rg-p"><b>Texture</b> is felt rather than printed. Tilt the card under a light and run a
        fingernail across the art: modern top tier full arts are usually embossed, with the texture
        following the artwork. It is a good signal, not a rule.</p>
    </div>
  </section>

  <section class="band rg-sec">
    <div class="wrap">
      <h2>Coming back after a <span class="hl">few years</span></h2>
      <p class="rg-p">If you collected once and stopped, the single most confusing thing is that
        <b>"ex" has meant three different things</b>. All three give up two prizes, and they are not
        the same card.</p>
      <div class="exs">
        <div class="ex1"><b>Pokemon-ex</b><p class="yrs">2003 to 2007, lowercase</p>
          <figure class="ex-fig">${cardArt("https://assets.tcgdex.net/en/ex/ex6/105/high.webp", 150, /* alt="" - the caption below repeats this string exactly */ "", ' width="600" height="825"')}<figcaption>Charizard ex, FireRed &amp; LeafGreen, 2004</figcaption></figure>
          <p>The original. No rule box: the rule is plain italic text along the bottom, and abilities
            are called Poke-POWER or Poke-BODY.</p></div>
        <div class="ex1"><b>Pokemon-EX</b><p class="yrs">2012 to 2016, uppercase</p>
          <figure class="ex-fig">${cardArt("https://assets.tcgdex.net/en/xy/xy2/11/high.webp", 150, /* alt="" - the caption below repeats this string exactly */ "", ' width="600" height="825"')}<figcaption>Charizard EX, Flashfire, 2014</figcaption></figure>
          <p>Black and White through XY. Almost always Basic, whatever the Pokemon's real stage.
            Mega EX ended your turn unless you played a Spirit Link.</p></div>
        <div class="ex1"><b>Pokemon ex</b><p class="yrs">2023 to now, lowercase again</p>
          <figure class="ex-fig">${cardArt("https://assets.tcgdex.net/en/sv/sv03/125/high.webp", 150, /* alt="" - the caption below repeats this string exactly */ "", ' width="600" height="825"')}<figcaption>Charizard ex, Obsidian Flames, 2023</figcaption></figure>
          <p>Current. Has a bordered rule box in the bottom corner where the Pokedex entry would sit.
            That box is the quickest way to tell it from a 2003 one.</p></div>
      </div>

      ${/* THE 1999 READER, who is a big share of the people this section is
            written for. Everything on this page reads a symbol printed on the
            card. Base Set prints no expansion symbol at all and its three print
            runs carry no rarity difference between them, so a reader who came
            back after twenty years and works through the ladder above gets no
            answer for the card they are most likely to be holding. That is a
            different check and it has its own page. */ ""}
      <p class="rg-p" style="margin-top:var(--s5)"><b>If what you kept is from 1999, none of the above applies to
        it.</b> Base Set has no set symbol in the corner, and what decides its value is which of the three print
        runs it came from: 1st Edition, Shadowless or Unlimited. That is a stamp and a drop shadow rather than a
        star, and it is on <a href="/base-set.html">its own page</a>, magnified on a real card the same way these
        corners are.</p>

      <h2 style="margin-top:var(--s6)">Everything that came and <span class="hl">went</span></h2>
      <p class="rg-p">If you remember any of these, they are all out of print. None of them are coming
        out of a pack you buy today.</p>
      <ul class="gone">
${d.gone
  .map(
    (g) => `        <li>
          <b>${esc(g.name)}</b><p class="yrs">${esc(g.years)}</p><p>${esc(g.note)}</p>
          ${
            g.card
              ? `<figure class="gone-fig">
            ${cardArt(g.card, 132, /* alt="" - the caption below repeats this string exactly */ "", imgDims(g.card))}
            <figcaption>${esc(g.example)}</figcaption>
          </figure>`
              : ""
          }
        </li>`,
  )
  .join("\n")}
      </ul>
    </div>
  </section>

  <section class="rg-sec">
    <div class="wrap">
      <h2>What everyone is <span class="hl">saying</span></h2>
      <p class="rg-p">The words you will hit in the first five minutes of any card video, including
        ours.</p>
      <ul class="gloss">
${d.slang.map(slangCard).join("\n")}
      </ul>
    </div>
  </section>

${FAQ.html}

  <section class="rg-sec">
    <div class="wrap">
      <p class="rg-foot">CHECKED ${esc(longDate(d.checked).toUpperCase())} AGAINST REAL CARD SCANS,
        NOT AGAINST OTHER GUIDES. THE CORNER IMAGES ON THIS PAGE ARE MAGNIFIED CROPS OF ACTUAL CARDS,
        SO YOU CAN CHECK ANY OF IT AGAINST SOMETHING IN YOUR OWN BINDER. A COUPLE OF CLAIMS THAT
        CIRCULATE WIDELY ARE LEFT OFF BECAUSE THEY COULD NOT BE VERIFIED. IF YOU SPOT SOMETHING WRONG
        HERE, SAY SO ON ANY OF THE SOCIALS AND IT GETS FIXED. FAN MADE GUIDE, NOT AFFILIATED WITH THE
        POKEMON COMPANY.</p>
    </div>
  </section>
</main>`;


const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pokemon Card Rarity Symbols Explained, With Real Cards</title>
<meta name="description" content="How to tell what a Pokemon card is by the symbol in its corner, shown magnified on real cards. Every rarity from Common to Mega Hyper Rare, and what changed.">
<link rel="canonical" href="${SITE}/rarity.html">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#192D22">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Garbage Rips 585">
<meta property="og:title" content="Pokemon Card Rarity Symbols, Explained With Real Cards">
<meta property="og:description" content="The corner of the card, magnified. Every rarity from Common to Mega Hyper Rare.">
<meta property="og:url" content="${SITE}/rarity.html">
<meta property="og:image" content="${SITE}/assets/og-image.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.jpg">
${FONTS}
${STYLES}
<style>${style}</style>
<script type="application/ld+json">
${JSON.stringify(FAQ.ld, null, 2)}
</script>
</head>
<body>
${SKIP}
${SPRITE}

${BAR}
${MENU}
${body}

${/* Do not repeat "not affiliated with The Pokemon Company" here: footer()
      appends it, and the two ran together in the same paragraph. */ ""}
${/* THE .wrap IS LOAD BEARING AND THIS PARAGRAPH SHIPPED WITHOUT IT. Every
      other .price-note on the site sits inside a section's .wrap and inherits
      the site gutter from it; this one is a direct child of <body>, between
      </main> and <footer>, so it had NO gutter at all. Measured 18 August 2026
      at 320, 360, 375, 390 and 414: left edge 0, right edge exactly the
      viewport width, so four lines of 10.9px mono ran into both screen edges
      and the 4px border-left that names it as a note was painted off-screen.
      It is wrong at desktop widths too, where the block starts at x=0 while
      everything above it starts at 24. A bare .wrap is the fix rather than
      moving it inside <main>: it is a footnote about the page, its position
      after </main> is deliberate, and .wrap carries both the gutter and the
      1500px cap the rest of the page has. */ ""}
${priceDoc ? `<div class="wrap"><p class="price-note">${esc(priceNote(priceDoc, { lead: "The example prices" }))} They are the same figures the set guides and the card search print for those cards.</p></div>` : ""}
${/* THIS FOOTER CREDITED THE WRONG SOURCE AND HAD FOR AS LONG AS THE PAGE HAS
      BEEN ON TCGdex. It read "Card images from the Pokemon TCG API", and this
      page makes ZERO requests to images.pokemontcg.io: all 153 image references
      in the served HTML are assets.tcgdex.net, and data/rarity.json holds 36
      TCGdex urls and not one pokemontcg.io url. Swept across all 1,484 built
      pages on 20 August 2026, it was the ONLY page on the site naming an image
      host it does not load from.

      IT IS A LICENSING LINE, NOT A NICETY, which is why it gets a note rather
      than a quiet edit. The official imagery here is used on condition its
      source is credited, so crediting the wrong source is closer to no credit
      than to a typo, and it lands on the page that leans on the pictures
      hardest: the whole argument of this page is that you can check every claim
      against a magnified crop of a real card.

      It is the same shape as the sixth-exception rule in CLAUDE.md, which says
      that when a page's source changes the link changes in the SAME edit. The
      pictures moved to TCGdex and the credit did not move with them. If the host
      changes again, this string changes in that commit. */ ""}
${footer("Card scans are TCGdex's. Every corner shown is a magnified crop of a real card.")}

${APP_JS}
</body>
</html>
`;

await writeFile(join(ROOT, "public/rarity.html"), html);

console.log(`Wrote public/rarity.html
  ${d.ladder.length} rarities, each with a real card and a magnified corner
  ${(d.offLadder || []).length} off-ladder names, same treatment
  ${d.gone.length} retired mechanics, ${d.slang.length} glossary terms
  ${FAQ.count} FAQ entries, visible on the page and in the schema from one array`);
