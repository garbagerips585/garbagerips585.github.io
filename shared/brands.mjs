// The venue marks for /buying.html and /selling.html, and the one box they all
// sit in. Imported by build-buying.mjs and build-selling.mjs.
//
// WHY A SHARED MODULE RATHER THAN A COPY IN EACH BUILDER. Nine venues appear on
// BOTH pages, and the two builders each own their own inline <style> block. Two
// copies of a 34px box, two copies of the id-to-mark map and two copies of the
// credit line is three chances for the pages to disagree about what Whatnot's
// mark is or how big it is drawn. shared/app-compare.mjs already exists for
// exactly this reason on the two app pages.
//
// THE FILES COME FROM scripts/sync-brands.mjs. Read that script before changing
// anything here: it records where each mark came from, what its licence is and
// why ten venues deliberately have none.
//
// THE BOX IS FIXED AND THE MARK IS CONTAINED IN IT. These marks run from a 1:1
// roundel (Target) to a 10.8:1 wordmark (The Pokemon Company). Nothing sensible
// happens if each one is allowed its own size: a logo row where Target is 32px
// wide and Walmart is 136px does not read as a row. One box, object-fit
// contain, centred, and the marks land at wildly different areas inside it,
// which is correct and is what every logo wall does.
//
// LIGHT GROUND ONLY, AND THIS WAS MEASURED RATHER THAN ASSUMED. Rendered on
// the site's dark chrome, five of the thirteen marks vanish or go unreadable:
// Whatnot, Amazon, Best Buy, PayPal and The Pokemon Company are all drawn in
// near-black with no light variant in the file. Both pages are light, so this
// is fine today. If a dark band ever wants these, it needs a second set of
// files, not a CSS filter.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./format.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let MARKS = {};
try {
  MARKS = JSON.parse(readFileSync(join(ROOT, "data/brand-marks.json"), "utf8")).marks || {};
} catch {
  /* run: node scripts/sync-brands.mjs. Every venue falls back to its name tile. */
}

/**
 * Venue id -> mark id. Ids are the ones in data/buying.json and data/selling.json.
 *
 * Most are the identity, which is why only the exceptions are listed. `big-box`
 * is one venue entry covering four companies, so it resolves to four marks and
 * the builder lays them out as a row; that is the one row on either page where
 * the pictures carry information the heading does not, because "Target, Walmart,
 * Best Buy and Costco" is a sentence and four marks is a glance.
 */
const ALIAS = {
  "big-box": ["target", "walmart", "bestbuy", "costco"],
  // /drops.html keys its retailers with a hyphen where /buying.html's mark file
  // does not. One line here rather than renaming a mirrored file that three
  // pages already point at.
  "best-buy": ["bestbuy"],
  // SAME MISMATCH, AND IT HAD BEEN READING AS A FINDING RATHER THAN AS A TYPO.
  // data/drops.json keys this retailer `dollar-general`; the mirrored file is
  // `dollargeneral.svg` and has been on disk since sync-brands.mjs first ran.
  // With no alias the lookup missed and shared/brands.mjs did exactly what it
  // promises for a venue Commons has nothing for: it drew the hatched name
  // tile. That is the right fallback and it is the wrong answer here, because
  // the mark exists. Nothing errored, the page looked deliberate, and the tile
  // was being quoted back as "Dollar General has no mark". CHECK THE MANIFEST
  // BEFORE BELIEVING A NAME TILE: the fallback cannot tell "no file" from "no
  // alias" apart, and only one of those is a finding.
  "dollar-general": ["dollargeneral"],
};

/**
 * The ten venues with no mark, and the short label their tile carries.
 *
 * THE TILE TEXT IS NOT ALWAYS THE VENUE NAME and that is on purpose: the box is
 * 112px wide and "Dave and Adam's Card World" set in it at a legible size is
 * four lines of shrapnel. The heading beside the tile still carries the full
 * name, so nothing is lost. Where a name genuinely fits, it is used unchanged.
 */
const TILE = {
  "family-dollar": "Family Dollar",
  coolstuffinc: "CoolStuffInc",
  "card-cavern": "Card Cavern",
  "dave-and-adams": "Dave &amp; Adam's",
  "troll-and-toad": "Troll &amp; Toad",
  comc: "COMC",
  sportlots: "Sportlots",
  goldin: "Goldin",
  heritage: "Heritage",
};

/**
 * Drawn glyphs for the rows that are not companies at all.
 *
 * FOUR ROWS ACROSS THE TWO PAGES DESCRIBE A SITUATION RATHER THAN A BRAND:
 * "Local card shop", "Card show", "Buying sealed product at retail" and
 * "Buying across a counter" / "A private cash sale". A name tile reading "Card
 * show" next to a heading reading "Card show" is the word twice and a picture
 * never. These are the honest picture: a shopfront, a table of cards, a sealed
 * carton, notes changing hands. Inline, monochrome, currentColor, weightless.
 *
 * stroke-width is 1.6 against a 24 unit box so they hold up at the 22px the
 * chip draws them at, and every one is on the same 24x24 grid so they read as
 * one set rather than four drawings.
 */
const G = (d) =>
  `<svg class="bmk-g" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" ` +
  `fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;

const GLYPH = {
  // A shopfront: awning over a door and a window.
  shop: G(`<path d="M3 8.5 4.6 4h14.8L21 8.5"/><path d="M4.5 8.5V20h15V8.5"/><path d="M9.5 20v-6h5v6"/><path d="M3 8.5h18"/>`),
  // A trestle table with three cards standing on it.
  table: G(`<path d="M2.5 13.5h19"/><path d="M5 13.5 4 20.5"/><path d="M19 13.5l1 7"/><rect x="6.5" y="6" width="4" height="7.5" rx=".6"/><rect x="13.5" y="4.5" width="4" height="9" rx=".6"/>`),
  // A sealed carton: box with a taped seam.
  sealed: G(`<path d="M3.5 7.5 12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M12 8.5v12"/><path d="M3.5 7.5 12 11.5l8.5-4"/><path d="M8.5 5.4v4.2"/>`),
  // Cash across a counter: a note and a hand under it.
  cash: G(`<rect x="3" y="6" width="18" height="8" rx="1.2"/><circle cx="12" cy="10" r="2"/><path d="M4.5 17.5c2.5 1.7 5 2.5 7.5 2.5s5-.8 7.5-2.5"/>`),
};

/** Venue id -> drawn glyph, for the rows that are situations rather than brands. */
const DRAWN = {
  "local-shop": ["shop", "A card shop counter"],
  "card-show": ["table", "A card show table"],
  "big-box-retail": ["sealed", "A sealed carton"],
  counter: ["cash", "Cash across a counter"],
};

/**
 * Protection-section venue NAME -> venue id.
 *
 * The safety files key their protections by a human string rather than by an
 * id, because "eBay Money Back Guarantee" and "eBay Authenticity Guarantee" are
 * two policies of one company and neither is a venue. So the lookup is by name
 * and several names point at one mark, which is correct: they are eBay's.
 */
export const PROT_MARK = {
  "TCGplayer": "tcgplayer",
  "eBay": "ebay",
  "eBay Money Back Guarantee": "ebay",
  "eBay Authenticity Guarantee": "ebay",
  "Whatnot": "whatnot",
  "Mercari": "mercari",
  "Amazon A-to-z Guarantee": "amazon",
  "PayPal Goods and Services": "paypal",
  "Facebook Marketplace": "facebook",
  "Buying sealed product at retail": "big-box-retail",
  "Buying across a counter": "counter",
  "A private cash sale": "counter",
};

/** Does this venue resolve to anything at all? Used only by the credit line. */
export const hasMark = (id) => Boolean(MARKS[id] || ALIAS[id] || DRAWN[id] || TILE[id]);

/** How many real company marks a page is actually painting. */
export const countMarks = (ids) =>
  new Set(ids.flatMap((id) => (ALIAS[id] || [id])).filter((m) => MARKS[m])).size;

/**
 * One mark box for a venue.
 *
 * `label` is the venue's full name and is used for the accessible name when the
 * mark is a drawn glyph or a tile. A real company mark carries its OWN alt from
 * the manifest, which is what the file actually draws and is not always the
 * venue name: /buying.html's Pokemon Center row shows The Pokemon Company's
 * mark, because that is the company whose warehouse the parcel leaves and there
 * is no separate Pokemon Center wordmark to be had.
 *
 * `lazy` defaults true. Every one of these is below the fold on both pages:
 * the first venue card on /buying.html starts 1,180px down at 390x844 because
 * the lede and the jump nav come first. The FIRST one is still lazy on purpose
 * rather than eager, because Chrome fetches a lazy image that is within a
 * viewport or so of the fold anyway and nothing here is LCP.
 */
export function brandMark(id, label = "") {
  const marks = ALIAS[id] || [id];
  const real = marks.map((m) => MARKS[m]).filter(Boolean);

  if (real.length) {
    const imgs = real
      .map(
        (m) =>
          `<img src="${esc(m.file)}" alt="${esc(m.alt)}" width="${m.w}" height="${m.h}" ` +
          `loading="lazy" decoding="async">`
      )
      .join("");
    // A four-up row gets a wider box rather than four boxes: they are one
    // venue entry on the page and four separate chips would read as four.
    // ON A DARK PLATE ONLY IF EVERY MARK IN THE BOX NEEDS ONE. A mixed box would
    // sacrifice one mark either way, and today no box mixes them: target is the
    // only white-on-transparent file in the set.
    const onDark = real.every((m) => WHITE_INK.has(m.file.split("/").pop()));
    return `<span class="bmk${real.length > 1 ? " bmk-multi" : ""}${onDark ? " bmk-onDark" : ""}">${imgs}</span>`;
  }

  const drawn = DRAWN[id];
  if (drawn) {
    return `<span class="bmk bmk-d" role="img" aria-label="${esc(drawn[1])}">${GLYPH[drawn[0]]}</span>`;
  }

  // The no-mark box. NOT A HOLE AND NOT A SUBSTITUTE. Same footprint as a real
  // mark so the headings stay on one line, and the name set in the site's own
  // mono, which is the same answer /drops.html already gives for retailer names
  // it has no mark for: "drawn in this site's own typeface and the property of
  // their owners".
  const text = TILE[id] || esc(label || id);
  return `<span class="bmk bmk-n" aria-hidden="true"><b>${text}</b></span>`;
}

/**
 * The credit, one line per page.
 *
 * Says three things and all three are load bearing: whose marks these are, that
 * the pages are not affiliated with any of them, and where the files came from
 * so the claim is checkable. The set guides carry the same shape for TCGplayer's
 * product photography.
 */
export const BRAND_CREDIT =
  "Company names and logos on this page are the trademarks of their owners and are used to " +
  "identify the companies described. Nothing here is sponsored, affiliated or endorsed. " +
  "Marks are mirrored from Wikimedia Commons, where each carries a public domain copyright tag; " +
  "the venues with no mark have their name set in this site's own typeface instead.";

/**
 * The box. Exported as a string so both builders paste the identical rules into
 * their own inline <style>, because public/assets/ui.css is generated from
 * assets-source/ui.css and neither is this pass's to edit.
 *
 * THE HEIGHT IS THE ONLY FIXED DIMENSION AND THE WIDTH IS A MAXIMUM. A hard
 * 112x34 forces the 10.8:1 Pokemon wordmark down to 3.2px tall to fit, which is
 * a grey smear. Capping the width instead lets the tall marks use the full
 * height and the wide ones use the full width, and every mark ends up on the
 * same baseline inside the same 34px band, which is what makes the column read.
 */
/* Marks drawn as white on transparent, which need the dark plate rather than
   the white one. Derived by reading every fill in every file in
   public/assets/brands/, not by eye. Add a filename here if a new mark is
   white-only; leave it out if the mark has any dark or saturated ink at all. */
const WHITE_INK = new Set(["target.svg"]);

const BMK_BOX = `
.bmk{flex:none;display:inline-flex;align-items:center;justify-content:center;gap:10px;
  height:34px;min-width:56px;max-width:124px;padding:4px 9px;box-sizing:border-box;
  /* THE PLATE STAYS LIGHT AND THAT IS THE WHOLE POINT OF IT.
     The comment at the top of this file predicted this exact failure: these are
     third-party marks drawn as dark ink on transparent, with no light variant
     in the file, and it said "both pages are light, so this is fine today".
     The 18 August 2026 repaint made every page dark, --paper-2 went from
     #FFFFFF to #2F4F39, the token NAME did not change so nothing flagged it,
     and 21 logos across 14 pages dropped to between 1.68:1 and 2.30:1 at their
     STRONGEST pixel. The Pokemon Company's mark rendered near-black on green.
     A brand mark is somebody else's artwork and we do not get to recolour it,
     so the plate it sits on has to stay the colour it was drawn for. This is
     now a literal rather than a token, because the whole bug was a token whose
     value moved out from under content that could not move with it. */
  background:#FFFFFF;border:1px solid var(--hair);border-radius:var(--r-sm)}
/* ONE MARK IS DRAWN THE OTHER WAY ROUND. target.svg fills with #FFF and nothing
   else, so it is the single mark in the set that would vanish on the white
   plate the other twenty need. Checked by reading every fill in every file
   rather than by eye: tcgplayer is five saturated colours, costco is blue, red
   and white, pokemon-center is #231916 with a white counter, and all three read
   on white. Only target is white-on-transparent. Its plate stays dark, which is
   also what Target's own brand guidance asks for. */
.bmk-onDark{background:var(--chrome-bg)}
.bmk img{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;display:block}
`;

const BMK_MULTI = `/* Four marks for one venue entry. Wider box, and each mark gets a share of it.
   The row wraps to two-by-two under 420px rather than shrinking to illegible. */
.bmk-multi{max-width:100%;flex-wrap:wrap;gap:6px 12px;height:auto;min-height:34px;padding:6px 10px}
.bmk-multi img{max-height:22px;max-width:74px}
@media(max-width:420px){.bmk-multi img{max-height:19px;max-width:64px}}
/* The drawn glyphs and the name tiles. Same box, deliberately. */
.bmk-d{color:var(--ink-2)}
`;

const BMK_TILE = `/* THE SITE'S OWN NO-ART HATCH, the same 45 degree one .set-noart uses for a set
   with no logo and .op-cn uses for a product with no publishable photograph.
   Reusing it rather than inventing a treatment is the point: a reader who has
   seen it on /sets/ already knows it means "there is no picture of this", so
   eight name tiles read as a stated absence instead of as eight bugs. */
.bmk-n{background:repeating-linear-gradient(45deg,var(--paper-3) 0 8px,var(--paper-2) 8px 16px)}
.bmk-n b{font:700 var(--t-micro)/1.15 var(--mono);letter-spacing:.01em;color:var(--ink);
  text-align:center;overflow-wrap:anywhere;background:var(--paper-2);
  box-shadow:0 0 0 3px var(--paper-2);border-radius:2px}
`;

// THE THREE PIECES ARE JOINED IN THE ORIGINAL ORDER AND BRAND_STYLE IS BYTE FOR
// BYTE WHAT IT ALWAYS WAS. That is a requirement, not a nicety: /buying.html,
// /selling.html and /retailers.html paste this whole string into their own
// <style>, and reordering it would move `.bmk-multi img` in front of `.bmk img`,
// which are the SAME specificity (0,1,1), so the four-up row would silently lose
// its 22px cap. Keep any new rule inside the piece it belongs to.
export const BRAND_STYLE = BMK_BOX + BMK_MULTI + BMK_TILE;

/**
 * The same box WITHOUT the rules a page cannot reach.
 *
 * FOR THE HOME PAGE, AND THE REASON IS THAT PAGE AND NOT TIDINESS. The drops
 * band on index.html draws one single company mark per row, so `.bmk-multi`
 * (four marks for one venue) and `.bmk-d` (the drawn glyphs for the rows that
 * are situations rather than companies) can never match anything there: no
 * retailer id in data/drops.json resolves to more than one mark and none of them
 * is in DRAWN. index.html is the most visited document on the site and its
 * <style> is in the critical path, so those four dead rules are 475 bytes it
 * would carry above the fold to no reader's benefit.
 *
 * It is a SUBSET of BRAND_STYLE, sharing the same source text rather than
 * copying it, so a change to the box lands on all four pages at once. If a page
 * using this ever needs a multi-mark row or a drawn glyph, switch it to
 * BRAND_STYLE rather than pasting the missing rules in beside this one.
 */
export const BRAND_STYLE_MIN = BMK_BOX + BMK_TILE;
